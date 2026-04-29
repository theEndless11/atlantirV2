/**
 * app/api/meetings/process/route.ts
 *
 * Post-meeting processing — replaces the old orchestrator-based version.
 * Takes a full transcript, generates tasks via the employee's agent,
 * and inserts them into the normal approval/workflow pipeline.
 *
 * POST /api/meetings/process
 * Body: { meetingId?, workspaceId, employeeId, transcript }
 */

import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { llm, buildTelemetry } from '@/lib/llm/client'
import { composeMemoryContext, renderMemoryToPrompt } from '@/lib/memory/compose'
import { buildMeetingProcessPrompt } from '@/lib/agents/prompts'
import { assertAgentsEnabled } from '@/flags'

const MeetingTasksSchema = z.object({
  summary: z.string(),
  tasks: z.array(
    z.object({
      title: z.string().max(80),
      description: z.string(),
      priority: z.enum(['low', 'medium', 'high', 'urgent']),
    })
  ).max(5),
})

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { meetingId?: string; workspaceId: string; employeeId: string; transcript: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { meetingId, workspaceId, employeeId, transcript } = body
  if (!workspaceId || !employeeId || !transcript)
    return NextResponse.json({ error: 'workspaceId, employeeId, and transcript required' }, { status: 400 })

  try { await assertAgentsEnabled() }
  catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 429 })
  }

  const sb = supabaseAdmin()
  const { data: member } = await sb.from('workspace_members').select('id')
    .eq('workspace_id', workspaceId).eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: employee } = await sb.from('employees').select('name').eq('id', employeeId).single()
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  const memCtx = await composeMemoryContext({
    workspaceId, query: transcript.slice(0, 500), meetingId, isMeeting: true,
  })

  const systemPrompt = [
    buildMeetingProcessPrompt(employee.name),
    renderMemoryToPrompt(memCtx) ? `\n## Workspace memory\n\n${renderMemoryToPrompt(memCtx)}` : '',
  ].filter(Boolean).join('\n\n')

  const { object } = await generateObject({
    model: llm(),
    system: systemPrompt,
    prompt: `Full meeting transcript:\n\n${transcript}`,
    schema: MeetingTasksSchema,
    experimental_telemetry: buildTelemetry({
      functionId: 'meeting-process', workspaceId, employeeId, taskId: meetingId,
    }),
  })

  const { data: tasks, error } = await sb.from('tasks').insert(
    object.tasks.map(t => ({
      workspace_id: workspaceId,
      employee_id: employeeId,
      meeting_id: meetingId ?? null,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: 'pending_approval',
    }))
  ).select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (meetingId) await sb.from('meetings').update({ status: 'done' }).eq('id', meetingId)

  return NextResponse.json({ tasks, summary: object.summary })
}
