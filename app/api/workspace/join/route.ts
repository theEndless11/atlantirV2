import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const body = await req.json()
  const { token, user_id, email, full_name } = body
  if (!token || !user_id) return NextResponse.json({ error: 'token and user_id required' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data: workspace } = await sb
    .from('workspaces').select('id, name, invite_enabled').eq('invite_token', token).single()

  if (!workspace) return NextResponse.json({ error: 'Invalid or expired invite link' }, { status: 404 })
  if (!workspace.invite_enabled) return NextResponse.json({ error: 'Invite link has been disabled' }, { status: 403 })

  const { data: existing } = await sb.from('workspace_members').select('id, role')
    .eq('workspace_id', workspace.id).eq('user_id', user_id).single()
  if (existing)
    return NextResponse.json({ workspace_id: workspace.id, workspace_name: workspace.name, already_member: true, role: existing.role })

  await sb.from('users').upsert({ id: user_id, email, full_name: full_name || null })
  await sb.from('workspace_members').insert({ workspace_id: workspace.id, user_id, role: 'member' })
  return NextResponse.json({ workspace_id: workspace.id, workspace_name: workspace.name, already_member: false, role: 'member' })
}
