import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { workspace_id, title, description, assigned_agent, priority } = body

  if (!workspace_id || !title)
    return NextResponse.json({ error: 'workspace_id and title required' }, { status: 400 })

  const sb = supabaseAdmin()

  const { data: member } = await sb.from('workspace_members').select('id')
    .eq('workspace_id', workspace_id).eq('user_id', user.id).single()
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: task, error } = await sb.from('tasks').insert({
    workspace_id,
    title: title.slice(0, 80),
    description: description || title,
    assigned_agent: assigned_agent || 'research',
    status: 'pending_approval',
    priority: priority || 'medium',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(task)
}
