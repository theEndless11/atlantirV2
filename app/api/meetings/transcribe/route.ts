import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const workspaceId = formData.get('workspace_id')?.toString()
  const title = formData.get('title')?.toString() || 'Uploaded recording'
  const createdBy = formData.get('user_id')?.toString()

  if (!file || !workspaceId)
    return NextResponse.json({ error: 'file and workspace_id required' }, { status: 400 })

  const dgKey = process.env.DEEPGRAM_API_KEY
  if (!dgKey) return NextResponse.json({ error: 'Deepgram API key not configured' }, { status: 500 })

  const dgRes = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&paragraphs=true',
    {
      method: 'POST',
      headers: { 'Authorization': `Token ${dgKey}`, 'Content-Type': file.type || 'audio/mpeg' },
      body: await file.arrayBuffer(),
    }
  )

  if (!dgRes.ok) {
    const errText = await dgRes.text()
    return NextResponse.json({ error: `Deepgram error: ${errText}` }, { status: 500 })
  }

  const dgData = await dgRes.json()
  const transcript = dgData?.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
  if (!transcript) return NextResponse.json({ error: 'No speech detected in file' }, { status: 422 })

  const sb = supabaseAdmin()
  const { data: meeting, error } = await sb.from('meetings').insert({
    workspace_id: workspaceId,
    created_by: createdBy || null,
    title,
    status: 'ended',
    transcript,
    started_at: new Date().toISOString(),
    ended_at: new Date().toISOString(),
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(meeting)
}
