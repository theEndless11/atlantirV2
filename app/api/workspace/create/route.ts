import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// POST /api/workspace/create
export async function POST(req: Request) {
  const body = await req.json()
  const { name, user_id, email, full_name, avatar_url } = body
  if (!name?.trim() || !user_id)
    return NextResponse.json({ error: 'name and user_id required' }, { status: 400 })

  const sb = supabaseAdmin()
  await sb.from('users').upsert({ id: user_id, email, full_name: full_name || null, avatar_url: avatar_url || null })

  const { data: ws, error: wsErr } = await sb
    .from('workspaces').insert({ name: name.trim(), owner_id: user_id }).select().single()
  if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 })

  await sb.from('workspace_members').insert({ workspace_id: ws.id, user_id, role: 'owner' })
  return NextResponse.json(ws)
}
