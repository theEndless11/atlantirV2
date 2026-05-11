import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId')
  const workspaceId = searchParams.get('workspaceId')

  if (!taskId || !workspaceId)
    return NextResponse.json({ error: 'taskId and workspaceId are required' }, { status: 400 })

  const sb = supabaseAdmin()

  const [{ data: member }, taskData, runsData, artifactsData, approvalsData, messagesData] = await Promise.all([
    sb.from('workspace_members').select('id').eq('workspace_id', workspaceId).eq('user_id', user.id).single(),
    sb.from('tasks').select('*, employee:employees(id, name, avatar_url)').eq('id', taskId).single(),
    sb.from('workflow_runs').select('*').eq('task_id', taskId).order('started_at', { ascending: false }).limit(1),
    sb.from('artifacts').select('*').eq('task_id', taskId).order('version', { ascending: true }),
    sb.from('approval_requests').select('*').eq('task_id', taskId).eq('state', 'pending'),
    sb.from('messages').select('*').eq('task_id', taskId).order('created_at', { ascending: true }),
  ])

  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!taskData.data) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  return NextResponse.json({
    task: taskData.data,
    workflowRun: runsData.data?.[0] ?? null,
    artifacts: artifactsData.data ?? [],
    pendingApprovals: approvalsData.data ?? [],
    messages: messagesData.data ?? [],
  })
}
