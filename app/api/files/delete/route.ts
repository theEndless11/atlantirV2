import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const { file_id } = await req.json()
  if (!file_id) return NextResponse.json({ error: 'file_id required' }, { status: 400 })
  const sb = supabaseAdmin()
  const { data: file } = await sb.from('files').select('storage_path').eq('id', file_id).single()
  if (file) await sb.storage.from('files').remove([file.storage_path])
  await sb.from('file_chunks').delete().eq('file_id', file_id)
  await sb.from('files').delete().eq('id', file_id)
  return NextResponse.json({ success: true })
}
