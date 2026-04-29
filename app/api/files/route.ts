import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { useAnthropic, AGENT_MODEL } from '@/lib/anthropic'

async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  if (mimeType === 'text/plain' || mimeType === 'text/markdown' || filename.endsWith('.md') || filename.endsWith('.txt')) {
    return buffer.toString('utf-8')
  }
  if (mimeType === 'application/pdf') {
    const client = useAnthropic()
    const base64 = buffer.toString('base64')
    const response = await client.messages.create({
      model: AGENT_MODEL, max_tokens: 4096,
      messages: [{ role: 'user', content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } } as any,
        { type: 'text', text: 'Extract all text content from this document. Return only the raw text, preserve structure.' }
      ]}]
    })
    return response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return buffer.toString('utf-8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  return buffer.toString('utf-8')
}

function chunkText(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/)
  const chunks: string[] = []
  let i = 0
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkSize).join(' '))
    i += chunkSize - overlap
  }
  return chunks.filter(c => c.trim().length > 20)
}

async function embedChunks(chunks: string[]): Promise<number[][]> {
  // Gemini text-embedding-004 via REST (768 dims)
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return chunks.map(() => new Array(768).fill(0))
  const results: number[][] = []
  for (const chunk of chunks) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'models/text-embedding-004', content: { parts: [{ text: chunk }] } }) }
      )
      if (!res.ok) { results.push(new Array(768).fill(0)); continue }
      const data = await res.json()
      results.push(data.embedding?.values ?? new Array(768).fill(0))
    } catch { results.push(new Array(768).fill(0)) }
  }
  return results
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  const sb = supabaseAdmin()
  const { data, error } = await sb.from('files').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const sb = supabaseAdmin()
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const workspaceId = formData.get('workspace_id')?.toString()
  const userId = formData.get('user_id')?.toString()

  if (!file || !workspaceId) return NextResponse.json({ error: 'file and workspace_id required' }, { status: 400 })

  const filename = file.name || 'upload'
  const mimeType = file.type || 'text/plain'
  const arrayBuf = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuf)

  const storagePath = `${workspaceId}/${Date.now()}_${filename}`
  const { error: storageErr } = await sb.storage.from('files').upload(storagePath, buffer, { contentType: mimeType, upsert: false })
  if (storageErr) return NextResponse.json({ error: storageErr.message }, { status: 500 })

  const { data: fileRecord, error: fileErr } = await sb.from('files').insert({
    workspace_id: workspaceId, uploaded_by: userId || null,
    filename, storage_path: storagePath, mime_type: mimeType, size_bytes: buffer.length,
  }).select().single()
  if (fileErr) return NextResponse.json({ error: fileErr.message }, { status: 500 })

  // Index in background
  ;(async () => {
    try {
      const text = await extractText(buffer, mimeType, filename)
      const chunks = chunkText(text)
      if (chunks.length > 0) {
        const embeddings = await embedChunks(chunks)
        await sb.from('file_chunks').insert(chunks.map((content, i) => ({
          file_id: fileRecord.id, workspace_id: workspaceId, content,
          embedding: JSON.stringify(embeddings[i]),
          embedding_vec: `[${embeddings[i].join(',')}]`,
          chunk_index: i,
        })))
        await sb.from('files').update({ embedding_meta: { chunks: chunks.length, status: 'indexed' } }).eq('id', fileRecord.id)
      }
    } catch {
      await sb.from('files').update({ embedding_meta: { status: 'index_failed' } }).eq('id', fileRecord.id)
    }
  })()

  return NextResponse.json(fileRecord)
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const fileId = searchParams.get('file_id') || (await req.json().catch(() => ({}))).file_id
  if (!fileId) return NextResponse.json({ error: 'file_id required' }, { status: 400 })
  const sb = supabaseAdmin()
  const { data: file } = await sb.from('files').select('storage_path').eq('id', fileId).single()
  if (file) await sb.storage.from('files').remove([file.storage_path])
  await sb.from('file_chunks').delete().eq('file_id', fileId)
  await sb.from('files').delete().eq('id', fileId)
  return NextResponse.json({ success: true })
}