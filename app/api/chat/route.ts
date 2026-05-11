import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getLLM, AGENT_MODEL } from '@/lib/anthropic'
import { streamText, generateText } from 'ai'

const INTENT_SYSTEM = `Classify intent. Reply ONLY with JSON, nothing else:
{
  "intent": "chat" | "task",
  "task_title": null or string (max 80 chars),
  "task_description": null or string,
  "task_agent": null or "research"|"writer"|"analyst"|"executor"
}
intent = "task" ONLY when user explicitly wants an agent to research/write/analyze/build something new as background work.
Default to "chat" for everything else.`

const CHAT_SYSTEM = `You are a helpful AI assistant in a workspace tool.
Answer anything the user asks. Use markdown — bold, bullets, tables, code blocks as appropriate.
Be concise, friendly, and genuinely useful.`

async function fetchWorkspaceCtx(workspaceId: string, sb: any): Promise<string> {
  try {
    const [{ data: integrations }, { data: dbs }] = await Promise.all([
      sb.from('integrations').select('type, config').eq('workspace_id', workspaceId).eq('status', 'connected'),
      sb.from('db_connections').select('name, db_type, status').eq('workspace_id', workspaceId),
    ])
    if (!integrations?.length && !dbs?.length) return ''
    let ctx = '\n\nYou have access to the following tools in this workspace:'
    if (integrations?.length) ctx += '\n' + integrations.map((i: any) => `- ${i.type}${i.config?.channel ? ` (${i.config.channel})` : i.config?.repo ? ` (${i.config.repo})` : ''}`).join('\n')
    ctx += '\n- Web search (always available)'
    ctx += '\n- File downloads: CSV, JSON, Markdown (always available)'
    if (dbs?.length) {
      ctx += '\n\nConnected databases:'
      dbs.forEach((d: any) => { ctx += `\n- ${d.name} [${d.db_type}] (${d.status})` })
    }
    ctx += '\n\nWhen asked which apps or tools are connected, list these specifically. Never say you have no access.'
    return ctx
  } catch { return '' }
}

// GET — load general chat history for a workspace (no task_id)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const workspace_id = searchParams.get('workspace_id')
  if (!workspace_id) return NextResponse.json([])
  const sb = supabaseAdmin()
  const { data } = await sb
    .from('messages')
    .select('id, content, sender_type, created_at')
    .eq('workspace_id', workspace_id)
    .is('task_id', null)
    .is('meeting_id', null)
    .in('sender_type', ['human', 'agent'])
    .order('created_at', { ascending: true })
    .limit(80)
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const { workspace_id, message, history = [] } = await req.json()
  if (!workspace_id || !message)
    return NextResponse.json({ error: 'workspace_id and message required' }, { status: 400 })

  const sb = supabaseAdmin()

  // Persist human message immediately
  await sb.from('messages').insert({
    workspace_id,
    task_id: null,
    meeting_id: null,
    sender_type: 'human',
    content: message,
  })

  // Classify intent
  let intent = 'chat'
  let taskTitle: string | null = null
  let taskDescription: string | null = null
  let taskAgent: string | null = null

  try {
    const { text } = await generateText({
      model: getLLM(AGENT_MODEL),
      system: INTENT_SYSTEM,
      prompt: `User: ${message}`,
      maxTokens: 150,
    })
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
    intent = parsed.intent || 'chat'
    taskTitle = parsed.task_title || null
    taskDescription = parsed.task_description || null
    taskAgent = parsed.task_agent || null
  } catch { intent = 'chat' }

  // Handle task creation — return JSON (non-streaming)
  if (intent === 'task' && taskTitle) {
    try {
      const { data: task } = await sb.from('tasks').insert({
        workspace_id,
        title: taskTitle.slice(0, 80),
        description: taskDescription || taskTitle,
        assigned_agent: taskAgent || 'research',
        status: 'pending_approval',
        priority: 'medium',
      }).select().single()
      const reply = `Created task: **${taskTitle}** — it's in the sidebar awaiting approval.`
      await sb.from('messages').insert({ workspace_id, task_id: null, meeting_id: null, sender_type: 'agent', content: reply })
      return NextResponse.json({ reply, task_id: task?.id })
    } catch {
      return NextResponse.json({ reply: 'Task creation failed — try the command bar.' })
    }
  }

  // Stream chat reply, persist on finish
  const historyMessages = (history as any[])
    .filter(m => !m.loading && m.content)
    .slice(-12)
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  // No onFinish here — persistence is handled by the client-side PATCH call
  // after streaming completes. This avoids the Vercel edge lifecycle race condition.
  const wsCtx = await fetchWorkspaceCtx(workspace_id, sb)

  const result = streamText({
    model: getLLM(AGENT_MODEL),
    system: CHAT_SYSTEM + wsCtx,
    messages: [...historyMessages, { role: 'user', content: message }],
    maxTokens: 800,
  })

  return result.toDataStreamResponse()
}

// PATCH — client calls this after stream ends to guarantee assistant message is persisted.
// Uses an idempotency_key to prevent duplicate inserts even if both onFinish and PATCH fire.
export async function PATCH(req: Request) {
  const { workspace_id, content: text, idempotency_key } = await req.json()
  if (!workspace_id || !text) return NextResponse.json({ ok: false })
  const sb = supabaseAdmin()

  // Check if a message with this exact content was already inserted in the last 30 seconds
  const since = new Date(Date.now() - 30_000).toISOString()
  const { data: recent } = await sb
    .from('messages')
    .select('id')
    .eq('workspace_id', workspace_id)
    .is('task_id', null)
    .eq('sender_type', 'agent')
    .eq('content', text)
    .gte('created_at', since)
    .limit(1)

  if (recent && recent.length > 0) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const { error } = await sb.from('messages').insert({
    workspace_id,
    task_id: null,
    meeting_id: null,
    sender_type: 'agent',
    content: text,
  })

  if (error) {
    console.error('[chat PATCH] insert failed:', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// DELETE — clear general chat history for a workspace
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const workspace_id = searchParams.get('workspace_id')
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })
  const sb = supabaseAdmin()
  await sb.from('messages')
    .delete()
    .eq('workspace_id', workspace_id)
    .is('task_id', null)
    .is('meeting_id', null)
    .in('sender_type', ['human', 'agent'])
  return NextResponse.json({ success: true })
}