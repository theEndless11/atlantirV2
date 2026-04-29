import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const { meeting_id, title } = await req.json()
  if (!meeting_id || !title) return NextResponse.json({ error: 'meeting_id and title required' }, { status: 400 })
  await supabaseAdmin().from('meetings').update({ title }).eq('id', meeting_id)
  return NextResponse.json({ ok: true })
}
