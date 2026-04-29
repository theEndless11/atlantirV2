import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const body = await req.json()
  const { workspace_id, connection_id, role, content, user_id, metadata } = body
  if (!workspace_id || !role || !content)
    return NextResponse.json({ error: 'workspace_id, role, content required' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data, error } = await sb.from('analyst_chats').insert({
    workspace_id, connection_id: connection_id || null,
    role, content, user_id: user_id || null, metadata: metadata || {},
  }).select('id,created_at').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
