import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { useAnthropic, AGENT_MODEL } from '@/lib/anthropic'

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2 }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

async function embedQuery(text: string): Promise<number[] | null> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai/text-embedding-3-small', input: [text] }),
    })
    if (!res.ok) return null
    return (await res.json()).data?.[0]?.embedding ?? null
  } catch { return null }
}

async function vectorSearch(workspaceId: string, query: string, topK = 4): Promise<string> {
  const sb = supabaseAdmin()
  const vec = await embedQuery(query)

  if (vec) {
    const { data: rpcData, error: rpcErr } = await sb.rpc('match_file_chunks', {
      query_embedding: vec,
      match_workspace_id: workspaceId,
      match_threshold: 0.62,
      match_count: topK,
    })
    if (!rpcErr && rpcData?.length) {
      return rpcData.map((r: any) => r.content).join('\n---\n')
    }

    const { data: chunks } = await sb
      .from('file_chunks').select('content,embedding')
      .eq('workspace_id', workspaceId).not('embedding', 'is', null).limit(400)
    if (chunks?.length) {
      const scored = chunks.map((c: any) => {
        try {
          const v: number[] = typeof c.embedding === 'string' ? JSON.parse(c.embedding) : c.embedding
          return { content: c.content, score: cosine(vec, v) }
        } catch { return null }
      }).filter((c): c is { content: string; score: number } => c !== null && c.score > 0.60)
        .sort((a, b) => b.score - a.score).slice(0, topK)
      if (scored.length) return scored.map(c => c.content).join('\n---\n')
    }
  }

  const { data: ft } = await sb.from('file_chunks').select('content')
    .eq('workspace_id', workspaceId)
    .textSearch('content', query.trim().split(/\s+/).filter((w: string) => w.length > 3).join(' & '), { type: 'plain' })
    .limit(topK)
  return ft?.length ? ft.map((r: any) => r.content).join('\n---\n') : ''
}

async function getWorkspaceContext(workspaceId: string, query: string): Promise<string> {
  const sb = supabaseAdmin()
  const [intResult, taskResult, dbResult, knowledge] = await Promise.all([
    sb.from('integrations').select('type').eq('workspace_id', workspaceId).eq('status', 'connected'),
    sb.from('tasks').select('title,status').eq('workspace_id', workspaceId).in('status', ['pending_approval', 'in_progress']).limit(5),
    sb.from('db_connections').select('name,db_type,status,config').eq('workspace_id', workspaceId),
    vectorSearch(workspaceId, query, 4),
  ])
  const integrations = (intResult.data || []).map((i: any) => i.type).join(', ')
  const tasks = (taskResult.data || []).map((t: any) => `${t.title} (${t.status})`).join(', ')
  const databases = (dbResult.data || []).map((d: any) => {
    const tables = d.config?.tables?.join(', ') || ''
    return `${d.name} (${d.db_type})${tables ? ' — tables: ' + tables : ''}`
  }).join('; ')
  let ctx = ''
  if (integrations) ctx += `\nConnected integrations: ${integrations}`
  if (databases) ctx += `\nConnected databases: ${databases}`
  if (tasks) ctx += `\nActive tasks: ${tasks}`
  if (knowledge) ctx += `\n\nRelevant workspace knowledge:\n${knowledge.slice(0, 2000)}`
  return ctx
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspace_id, message, history } = body
  if (!workspace_id || !message)
    return NextResponse.json({ error: 'workspace_id and message required' }, { status: 400 })

  const context = await getWorkspaceContext(workspace_id, message)
  const client = useAnthropic()

  const systemPrompt = `You are an AI workspace assistant for Atlantir. You help users get work done through natural conversation.
${context}

You have full access to the workspace. You can create tasks, answer questions about company knowledge, list connected integrations and databases, help think through problems, draft content, and analyze data.
Keep responses SHORT and CONVERSATIONAL — 1-3 sentences max for voice. No markdown, no bullet points, plain spoken language only.`

  const messages = [...(history || []).slice(-6), { role: 'user', content: message }]
  const response = await client.messages.create({ model: AGENT_MODEL, max_tokens: 300, system: systemPrompt, messages })
  const reply = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
    .replace(/\*\*(.*?)\*\*/g, '$1').replace(/#{1,6}\s/g, '').replace(/- /g, '')
  return NextResponse.json({ reply })
}
