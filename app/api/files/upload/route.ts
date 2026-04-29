import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
const anthropic = new Anthropic()
const AGENT_MODEL = 'claude-opus-4-5'

async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  if (mimeType === 'text/plain' || mimeType === 'text/markdown' || filename.endsWith('.md') || filename.endsWith('.txt')) {
    return buffer.toString('utf-8')
  }
  if (mimeType === 'application/pdf') {
    const base64 = buffer.toString('base64')
    const response = await anthropic.messages.create({
      model: AGENT_MODEL, max_tokens: 4096,
      messages: [{ role: 'user', content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } } as any,
        { type: 'text', text: 'Extract all text content from this document. Return only the raw text, preserve structure.' }
      ]}]
    })
    return response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
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
  const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'openai/text-embedding-3-small', input: chunks })
  })
  if (!res.ok) return chunks.map(() => new Array(1536).fill(0))
  const data = await res.json()
  return data.data.map((d: any) => d.embedding)
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const workspaceId = formData.get('workspace_id') as string | null
  const userId = formData.get('user_id') as string | null

  if (!file || !workspaceId) {
    return NextResponse.json({ error: 'file and workspace_id required' }, { status: 400 })
  }

  const filename = file.name
  const mimeType = file.type || 'text/plain'
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const storagePath = `${workspaceId}/${Date.now()}_${filename}`
  const { error: storageErr } = await sb.storage.from('files').upload(storagePath, buffer, { contentType: mimeType, upsert: false })
  if (storageErr) return NextResponse.json({ error: storageErr.message }, { status: 500 })

  const { data: fileRecord, error: fileErr } = await sb.from('files').insert({
    workspace_id: workspaceId, uploaded_by: userId || null,
    filename, storage_path: storagePath, mime_type: mimeType, size_bytes: buffer.length,
  }).select().single()
  if (fileErr) return NextResponse.json({ error: fileErr.message }, { status: 500 })

  try {
    const text = await extractText(buffer, mimeType, filename)
    const chunks = chunkText(text)
    if (chunks.length > 0) {
      const embeddings = await embedChunks(chunks)
      const chunkRows = chunks.map((content, i) => ({
        file_id: fileRecord.id, workspace_id: workspaceId, content,
        embedding: JSON.stringify(embeddings[i]),
        embedding_vec: `[${embeddings[i].join(',')}]`,
        chunk_index: i,
      }))
      await sb.from('file_chunks').insert(chunkRows)
      await sb.from('files').update({ embedding_meta: { chunks: chunks.length, status: 'indexed' } }).eq('id', fileRecord.id)
    }
  } catch {
    await sb.from('files').update({ embedding_meta: { status: 'index_failed' } }).eq('id', fileRecord.id)
  }

  return NextResponse.json(fileRecord)
}
