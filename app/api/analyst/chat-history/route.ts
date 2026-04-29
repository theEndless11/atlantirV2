import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const workspace_id = searchParams.get('workspace_id')
  const connection_id = searchParams.get('connection_id')
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const sb = supabaseAdmin()
  let q = sb.from('analyst_chats')
    .select('id,role,content,user_id,metadata,created_at,users(full_name,email)')
    .eq('workspace_id', workspace_id)
    .order('created_at', { ascending: true }).limit(200)

  q = connection_id ? q.eq('connection_id', connection_id) : q.is('connection_id', null)
  const { data } = await q
  return NextResponse.json(data || [])
}
