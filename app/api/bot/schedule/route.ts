import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const body = await req.json()
  const { workspace_id, room_url, bot_name, response_mode, instructions, scheduled_at, timezone, platform } = body
  if (!workspace_id || !room_url || !scheduled_at)
    return NextResponse.json({ error: 'workspace_id, room_url, and scheduled_at required' }, { status: 400 })
  if (new Date(scheduled_at) <= new Date())
    return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data, error } = await sb.from('scheduled_bots').insert({
    workspace_id, room_url,
    bot_name: bot_name || 'Atlantir',
    response_mode: response_mode || 'addressed',
    instructions: instructions || null,
    scheduled_at,
    timezone: timezone || 'UTC',
    platform: platform || 'zoom',
    status: 'pending',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
