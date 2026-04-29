import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const workspace_id = searchParams.get('workspace_id')
  const sb = supabaseAdmin()
  const { data } = await sb.from('workflows').select('*').eq('workspace_id', workspace_id).order('created_at', { ascending: false })
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const body = await req.json()
  const sb = supabaseAdmin()
  const { data, error } = await sb.from('workflows').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const { id, ...updates } = body
  const sb = supabaseAdmin()
  const { data, error } = await sb.from('workflows').update(updates).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: Request) {
  const body = await req.json()
  await supabaseAdmin().from('workflows').delete().eq('id', body.id)
  return NextResponse.json({ success: true })
}
