import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const { workspace_id, connection_id } = await req.json()
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const sb = supabaseAdmin()
  let q = sb.from('analyst_chats').delete().eq('workspace_id', workspace_id)
  q = connection_id ? q.eq('connection_id', connection_id) : q.is('connection_id', null)
  await q
  return NextResponse.json({ success: true })
}
