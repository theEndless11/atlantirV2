import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const { meeting_id } = await req.json()
  if (!meeting_id) return NextResponse.json({ error: 'meeting_id required' }, { status: 400 })
  const sb = supabaseAdmin()
  await sb.from('messages').delete().eq('meeting_id', meeting_id)
  await sb.from('meetings').delete().eq('id', meeting_id)
  return NextResponse.json({ success: true })
}
