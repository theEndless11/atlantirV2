import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data } = await sb.from('workspaces').select('id, name, invite_enabled').eq('invite_token', token).single()
  if (!data) return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 })
  if (!data.invite_enabled) return NextResponse.json({ error: 'Invite link has been disabled' }, { status: 403 })

  const { count } = await sb.from('workspace_members')
    .select('*', { count: 'exact', head: true }).eq('workspace_id', data.id)
  return NextResponse.json({ id: data.id, name: data.name, member_count: count || 0 })
}
