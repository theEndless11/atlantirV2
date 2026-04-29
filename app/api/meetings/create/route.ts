import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const body = await req.json()
  const { workspace_id, title, created_by } = body
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const sb = supabaseAdmin()
  const insertPayload: Record<string, unknown> = {
    workspace_id,
    title: title || `Meeting — ${new Date().toLocaleDateString()}`,
    ...(created_by ? { created_by } : {}),
    status: 'live',
    started_at: new Date().toISOString(),
  }

  const { data, error } = await sb.from('meetings').insert(insertPayload).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}