import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const body = await req.json()
  const { workspace_id, user_id } = body
  if (!workspace_id || !user_id) return NextResponse.json({ error: 'workspace_id and user_id required' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data: workspace } = await sb.from('workspaces').select('owner_id').eq('id', workspace_id).single()
  if (workspace?.owner_id === user_id)
    return NextResponse.json({ error: 'Cannot remove the workspace owner' }, { status: 403 })

  const { error } = await sb.from('workspace_members').delete()
    .eq('workspace_id', workspace_id).eq('user_id', user_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
