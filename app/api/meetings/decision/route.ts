/**
 * app/api/meetings/decision/route.ts
 *
 * The meeting-time decision endpoint — called by Vexa bot at every VAD pause.
 * Runs the decision model (speak/act/silent) and returns the verdict.
 *
 * POST /api/meetings/decision
 * Auth: x-bot-secret header (same as existing bot routes)
 *
 * Body: {
 *   meetingId: string
 *   workspaceId: string
 *   employeeId: string
 *   recentSegments: TranscriptSegment[]   // last ~12 utterances
 *   currentSpeaker: string
 *   elapsedSilenceMs: number
 *   aiWasAddressed: boolean
 *   recentAiActions: string[]
 * }
 *
 * Response:
 *   { verdict: 'speak', response: string }   → Vexa plays TTS
 *   { verdict: 'act', task: string }          → triggers background task
 *   { verdict: 'silent' }                     → Vexa stays quiet
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { runDecisionLoop, wasAiAddressed } from '@/lib/agents/decision-loop'
import { triggerAgentTask } from '@/lib/workflow/events'
import { assertAgentsEnabled } from '@/flags'
import type { TranscriptSegment } from '@/types'

export async function POST(req: Request) {
  // ── Bot auth ──────────────────────────────────────────────────────────────
  const secret = req.headers.get('x-bot-secret')
  if (secret !== process.env.BOT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    meetingId: string
    workspaceId: string
    employeeId: string
    recentSegments: TranscriptSegment[]
    currentSpeaker: string
    elapsedSilenceMs: number
    aiWasAddressed?: boolean
    recentAiActions?: string[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    meetingId,
    workspaceId,
    employeeId,
    recentSegments,
    currentSpeaker,
    elapsedSilenceMs,
    aiWasAddressed: explicitAddressed,
    recentAiActions = [],
  } = body

  if (!meetingId || !workspaceId || !employeeId) {
    return NextResponse.json({ error: 'meetingId, workspaceId, and employeeId required' }, { status: 400 })
  }

  // ── Kill switch ────────────────────────────────────────────────────────────
  try {
    await assertAgentsEnabled()
  } catch (err: unknown) {
    return NextResponse.json({ verdict: 'silent', reason: 'agents_disabled' })
  }

  // ── Fetch employee name for prompts ───────────────────────────────────────
  const sb = supabaseAdmin()
  const { data: employee } = await sb
    .from('employees')
    .select('name')
    .eq('id', employeeId)
    .single()

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
  }

  // Determine if AI was addressed (use explicit flag or infer from last segment)
  const lastSegment = recentSegments[recentSegments.length - 1]
  const aiAddressed =
    explicitAddressed ??
    (lastSegment ? wasAiAddressed(lastSegment, employee.name) : false)

  // ── Run decision model ─────────────────────────────────────────────────────
  const decision = await runDecisionLoop({
    meetingId,
    workspaceId,
    employeeId,
    employeeName: employee.name,
    recentSegments,
    currentSpeaker,
    elapsedSilenceMs,
    aiWasAddressed: aiAddressed,
    recentAiActions,
  })

  // ── Handle "act" decisions — trigger async side-agent ─────────────────────
  if (decision.verdict === 'act' && decision.task) {
    // Create a task from the meeting context and trigger it non-blocking
    setImmediate(async () => {
      try {
        const { data: task } = await sb
          .from('tasks')
          .insert({
            workspace_id: workspaceId,
            employee_id: employeeId,
            meeting_id: meetingId,
            title: decision.task!.slice(0, 80),
            description: `Triggered during meeting. Context: ${recentSegments.slice(-3).map(s => `[${s.speaker_name}]: ${s.text}`).join(' | ')}`,
            priority: 'medium',
            status: 'approved',
          })
          .select()
          .single()

        if (task) {
          await triggerAgentTask({ taskId: task.id, workspaceId, employeeId })
        }
      } catch (err) {
        console.error('[meeting/decision] Failed to trigger side-agent:', err)
      }
    })
  }

  // ── Store transcript segments (for memory Layer 2) ────────────────────────
  // Fire and forget — don't block the decision response
  if (recentSegments.length > 0) {
    setImmediate(async () => {
      try {
        await sb.from('messages').upsert(
          recentSegments.map(seg => ({
            workspace_id: workspaceId,
            meeting_id: meetingId,
            sender_type: 'human' as const,
            content: `[${seg.speaker_name}]: ${seg.text}`,
            created_at: new Date(seg.timestamp_ms).toISOString(),
          })),
          { onConflict: 'workspace_id,meeting_id,created_at' }
        )
      } catch {
        /* best-effort */
      }
    })
  }

  // ── Return decision ────────────────────────────────────────────────────────
  return NextResponse.json({
    verdict: decision.verdict,
    response: decision.response,
    task: decision.task,
    latencyMs: decision.latencyMs,
  })
}
