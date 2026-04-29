import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const body = await req.json()
  const { workspace_id, email, role = 'member' } = body
  if (!workspace_id || !email)
    return NextResponse.json({ error: 'workspace_id and email required' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data: workspace } = await sb.from('workspaces').select('name').eq('id', workspace_id).single()
  if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

  const { data: existingUser } = await sb.from('users').select('id').eq('email', email).single()
  if (existingUser) {
    const { data: existing } = await sb.from('workspace_members').select('id')
      .eq('workspace_id', workspace_id).eq('user_id', existingUser.id).single()
    if (existing) return NextResponse.json({ error: 'User is already a member' }, { status: 409 })
    await sb.from('workspace_members').insert({ workspace_id, user_id: existingUser.id, role })
    return NextResponse.json({ status: 'added', message: `${email} added to workspace` })
  }

  const { error } = await sb.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.APP_URL || 'http://localhost:3000'}/auth/callback`,
    data: { invited_to_workspace: workspace_id, invited_role: role, workspace_name: workspace.name }
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: 'invited', message: `Invite sent to ${email}` })
}
