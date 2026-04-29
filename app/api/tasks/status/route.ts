/**
 * app/api/tasks/status/route.ts
 *
 * GET /api/tasks/status?taskId=<id>&workspaceId=<id>
 *
 * Returns task status, workflow run, artifacts, and pending approvals.
 * Used by the dashboard to show live task progress via SWR polling.
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId')
  const workspaceId = searchParams.get('workspaceId')

  if (!taskId || !workspaceId) {
    return NextResponse.json({ error: 'taskId and workspaceId are required' }, { status: 400 })
  }

  const sb = supabaseAdmin()

  // Verify membership
  const { data: member } = await sb
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch everything in parallel
  const [
    { data: task },
    { data: workflowRuns },
    { data: artifacts },
    { data: approvals },
    { data: messages },
  ] = await Promise.all([
    sb.from('tasks').select('*, employee:employees(id, name, avatar_url)').eq('id', taskId).single(),
    sb.from('workflow_runs').select('*').eq('task_id', taskId).order('started_at', { ascending: false }).limit(1),
    sb.from('artifacts').select('*').eq('task_id', taskId).order('version', { ascending: true }),
    sb.from('approval_requests').select('*').eq('task_id', taskId).eq('state', 'pending'),
    sb.from('messages').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
  ])

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  return NextResponse.json({
    task,
    workflowRun: workflowRuns?.[0] ?? null,
    artifacts: artifacts ?? [],
    pendingApprovals: approvals ?? [],
    messages: messages ?? [],
  })
}
