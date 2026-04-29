import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { useAnthropic, AGENT_MODEL } from '@/lib/anthropic'

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2 }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

async function embedQuery(text: string): Promise<number[] | null> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai/text-embedding-3-small', input: [text] }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data?.[0]?.embedding ?? null
  } catch { return null }
}

export async function POST(req: Request) {
  const secret = req.headers.get('x-bot-secret')
  if (secret !== process.env.BOT_SECRET)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { transcript, workspace_id, instructions: sessionInstructions } = body
  if (!transcript || !workspace_id)
    return NextResponse.json({ error: 'transcript and workspace_id required' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data: workspace } = await sb.from('workspaces')
    .select('name,description,bot_name,bot_instructions,bot_response_mode').eq('id', workspace_id).single()

  const botInstructions = workspace?.bot_instructions?.trim() || ''
  const workspaceName = workspace?.name || 'this workspace'
  const workspaceDesc = workspace?.description?.trim() || ''

  let ragContext = ''
  const queryVec = await embedQuery(transcript)
  if (queryVec) {
    // Try pgvector RPC first
    const { data: rpcData, error: rpcErr } = await sb.rpc('match_file_chunks', {
      query_embedding: queryVec,
      match_workspace_id: workspace_id,
      match_threshold: 0.65,
      match_count: 5,
    })
    if (!rpcErr && rpcData?.length) {
      ragContext = `\n\nRelevant workspace knowledge:\n${rpcData.map((r: any, i: number) => `[${i + 1}] ${r.content}`).join('\n---\n')}`
    } else {
      // Client-side cosine fallback
      const { data: chunks } = await sb.from('file_chunks').select('content,embedding')
        .eq('workspace_id', workspace_id).not('embedding', 'is', null).limit(400)
      if (chunks?.length) {
        const scored = chunks.map((c: any) => {
          try {
            const vec: number[] = typeof c.embedding === 'string' ? JSON.parse(c.embedding) : c.embedding
            return { content: c.content, score: cosine(queryVec, vec) }
          } catch { return null }
        }).filter((c: any): c is { content: string; score: number } => c !== null && c.score > 0.65)
          .sort((a, b) => b.score - a.score).slice(0, 5)
        if (scored.length)
          ragContext = `\n\nRelevant workspace knowledge:\n${scored.map((c, i) => `[${i + 1}] ${c.content}`).join('\n---\n')}`
      }
    }
  }

  const { data: integrations } = await sb.from('integrations').select('name,type').eq('workspace_id', workspace_id).eq('enabled', true).limit(10)
  const integrationsCtx = integrations?.length ? `\nConnected tools: ${integrations.map((i: any) => i.name || i.type).join(', ')}.` : ''

  const effectiveInstructions = sessionInstructions?.trim() || botInstructions
  const systemParts = [
    effectiveInstructions || `You are an AI assistant named ${workspace?.bot_name || 'Atlantir'}, embedded live in a meeting call for "${workspaceName}".`,
    workspaceDesc && !botInstructions ? `Workspace: ${workspaceDesc}` : '',
    integrationsCtx,
    `\nYou are speaking aloud via text-to-speech. Rules:`,
    `- Maximum 2–3 sentences. No markdown, no lists, no formatting.`,
    `- Natural spoken language only. Be direct and concise.`,
    `- If you don't know something, say so briefly in one sentence.`,
    ragContext,
  ].filter(Boolean).join('\n')

  const client = useAnthropic()
  const response = await client.messages.create({
    model: AGENT_MODEL, max_tokens: 200,
    system: systemParts,
    messages: [{ role: 'user', content: transcript }],
  })

  const text = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
  return NextResponse.json({ response: text })
}
