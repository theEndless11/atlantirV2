import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { triggerAgentTask } from '@/lib/workflow/events'
import { assertAgentsEnabled } from '@/flags'
import { assertCostCapNotExceeded } from '@/lib/observability/costs'

export async function POST(req: Request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { workspaceId: string; employeeId: string; title: string; description?: string; priority?: 'low' | 'medium' | 'high' | 'urgent' }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { workspaceId, employeeId, title, description, priority = 'medium' } = body
  if (!workspaceId || !employeeId || !title)
    return NextResponse.json({ error: 'workspaceId, employeeId, and title are required' }, { status: 400 })

  const sb = supabaseAdmin()

  const [{ data: member }] = await Promise.all([
    sb.from('workspace_members').select('id').eq('workspace_id', workspaceId).eq('user_id', user.id).single(),
  ])
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    await assertAgentsEnabled()
    await assertCostCapNotExceeded(workspaceId)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 429 })
  }

  const { data: task, error: taskError } = await sb
    .from('tasks')
    .insert({ workspace_id: workspaceId, employee_id: employeeId, title, description: description ?? null, priority, status: 'approved' })
    .select()
    .single()

  if (taskError || !task)
    return NextResponse.json({ error: taskError?.message ?? 'Failed to create task' }, { status: 500 })

  const { runId } = await triggerAgentTask({ taskId: task.id, workspaceId, employeeId })
  return NextResponse.json({ task, workflowRunId: runId }, { status: 201 })
}
