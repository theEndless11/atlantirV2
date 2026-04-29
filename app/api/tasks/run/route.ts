/**
 * app/api/tasks/run/route.ts
 *
 * Create a task and immediately trigger its agent workflow.
 * The workflow runs durably via Vercel Workflow SDK.
 *
 * POST /api/tasks/run
 * Body: { workspaceId, employeeId, title, description?, priority? }
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import { triggerAgentTask } from '@/lib/workflow/events'
import { assertAgentsEnabled } from '@/flags'
import { assertCostCapNotExceeded } from '@/lib/observability/costs'

export async function POST(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    workspaceId: string
    employeeId: string
    title: string
    description?: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { workspaceId, employeeId, title, description, priority = 'medium' } = body
  if (!workspaceId || !employeeId || !title) {
    return NextResponse.json({ error: 'workspaceId, employeeId, and title are required' }, { status: 400 })
  }

  // ── Verify workspace membership ───────────────────────────────────────────
  const sb = supabaseAdmin()
  const { data: member } = await sb
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Kill switch + cost cap ────────────────────────────────────────────────
  try {
    await assertAgentsEnabled()
    await assertCostCapNotExceeded(workspaceId)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 429 })
  }

  // ── Create task row ───────────────────────────────────────────────────────
  const { data: task, error: taskError } = await sb
    .from('tasks')
    .insert({
      workspace_id: workspaceId,
      employee_id: employeeId,
      title,
      description: description ?? null,
      priority,
      status: 'approved', // created by human = already approved
    })
    .select()
    .single()

  if (taskError || !task) {
    return NextResponse.json({ error: taskError?.message ?? 'Failed to create task' }, { status: 500 })
  }

  // ── Trigger durable workflow ──────────────────────────────────────────────
  const { runId } = await triggerAgentTask({
    taskId: task.id,
    workspaceId,
    employeeId,
  })

  return NextResponse.json({ task, workflowRunId: runId }, { status: 201 })
}
