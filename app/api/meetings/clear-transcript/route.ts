import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const { meeting_id } = await req.json()
  if (!meeting_id) return NextResponse.json({ error: 'meeting_id required' }, { status: 400 })
  await supabaseAdmin().from('meetings').update({ transcript: null }).eq('id', meeting_id)
  return NextResponse.json({ success: true })
}
