import { callLLM, AGENT_MODEL, MAX_TOKENS, getLLM } from '../anthropic'
import { supabaseAdmin } from '../supabase'
import { streamText } from 'ai'
import type { AgentType, Task } from '@/types'

const AGENT_PROMPTS: Record<AgentType, string> = {
  orchestrator: '',
  research: `You are a Research Agent. Find accurate, up-to-date information on the given topic.
- Summarise findings clearly with source context where available
- If company knowledge is provided, prioritise it over general knowledge
- You can produce: richtext documents (markdown), tables of data, or graphs/charts when relevant
- Return a well-structured research summary`,
  writer: `You are a Writer Agent. Produce clear, professional written content.
- Match tone to context (formal for reports, conversational for emails)
- Structure content with headers where appropriate
- If company knowledge is provided, use it to personalise the content
- You can produce: richtext documents, tables (for structured comparisons), or graphs (for data visualisation)
- Return the complete document, ready to use`,
  analyst: `You are an Analyst Agent. Analyse information and produce insights.
- Use structured frameworks (pros/cons, comparisons, rankings)
- Back conclusions with reasoning
- If company knowledge is provided, incorporate it into the analysis
- If connected databases are listed, reference them in your analysis — the executor can query them if needed
- You can produce: tables (for data comparisons), graphs (bar, line, pie, scatter, area), or richtext reports
- Return a clear analysis with actionable recommendations`,
  executor: `You are an Executor Agent. Carry out specific tasks precisely using the connected tools and integrations available.
- Do exactly what is asked
- Use the connected integrations and databases listed in the workspace context
- IMPORTANT: If databases are listed as connected, you have access to them — do not claim otherwise
- When the task involves data, produce a table or graph artifact to visualise results
- Report what you did and the result clearly
- Return a clear completion report`
}

const CLARIFICATION_PROMPT = `You are about to work on a task. Before starting, decide if you have enough information.
If you need ONE specific piece of info to do the task well, ask it as a single short question.
If you have enough to proceed, respond with exactly: PROCEED
Do not ask obvious or unnecessary questions.`

async function embedQuery(text: string): Promise<number[] | null> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'openai/text-embedding-ada-002', input: [text] })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data[0].embedding
  } catch { return null }
}

async function getRelevantContext(query: string, workspaceId: string): Promise<string> {
  try {
    const sb = supabaseAdmin()
    const embedding = await embedQuery(query)
    if (!embedding) return ''
    const { data } = await sb.rpc('match_chunks', {
      query_embedding: embedding,
      workspace_filter: workspaceId,
      match_count: 5
    })
    if (!data?.length) return ''
    return data.map((c: any) => c.content).join('\n\n---\n\n')
  } catch { return '' }
}

async function getWorkspaceToolsContext(workspaceId: string): Promise<string> {
  try {
    const sb = supabaseAdmin()
    const [intResult, dbResult] = await Promise.all([
      sb.from('integrations').select('type').eq('workspace_id', workspaceId).eq('status', 'connected'),
      sb.from('db_connections').select('name, db_type, status, config').eq('workspace_id', workspaceId)
    ])
    const integrations = (intResult.data || []).map((i: any) => i.type)
    const databases = (dbResult.data || []).map((d: any) => {
      const tables = d.config?.tables?.join(', ') || ''
      return `${d.name} (${d.db_type}, status: ${d.status})${tables ? ' — tables: ' + tables : ''}`
    })
    let ctx = ''
    if (integrations.length) ctx += `\n\nConnected integrations available to use: ${integrations.join(', ')}`
    if (databases.length)    ctx += `\n\nConnected databases available to query: ${databases.join('; ')}`
    return ctx
  } catch { return '' }
}

async function getTaskMessages(taskId: string) {
  const sb = supabaseAdmin()
  const { data } = await sb
    .from('messages')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })
  return data || []
}

export async function checkNeedsClarification(task: Task, agentType: AgentType): Promise<string | null> {
  const text = await callLLM({
    model: AGENT_MODEL,
    system: CLARIFICATION_PROMPT,
    prompt: `Task: ${task.title}\n\n${task.description || ''}`,
    maxTokens: 300,
  })
  if (text.trim() === 'PROCEED') return null
  return text.trim()
}

export async function runAgent(task: Task, agentType: AgentType, runId: string): Promise<string> {
  const sb = supabaseAdmin()

  const [context, toolsContext, history] = await Promise.all([
    getRelevantContext(`${task.title} ${task.description || ''}`, task.workspace_id),
    getWorkspaceToolsContext(task.workspace_id),
    getTaskMessages(task.id)
  ])

  const agentBasePrompt = AGENT_PROMPTS[agentType]
  const systemPrompt = agentBasePrompt + (toolsContext ? `\n\nWorkspace tools context:${toolsContext}` : '')

  let prompt = ''
  if (context) {
    prompt += `Relevant company knowledge for this task:\n\n${context}\n\n---\n\n`
  }
  for (const msg of history) {
    prompt += `${msg.sender_type === 'human' ? 'User' : 'Assistant'}: ${msg.content}\n\n`
  }
  prompt += `Task: ${task.title}\n\n${task.description || ''}`

  // Emit "started" update
  await sb.from('task_updates').insert({
    workspace_id: task.workspace_id,
    task_id: task.id,
    agent_run_id: runId,
    pet_name: agentType,
    update_type: 'started',
    content: `${agentType} agent starting…`,
  })

  // Stream the response and emit chunks as progress updates
  let accumulated = ''
  let lastEmitLen = 0
  const EMIT_EVERY = 150

  const { textStream } = streamText({
    model: getLLM(AGENT_MODEL),
    system: systemPrompt,
    prompt,
    maxTokens: MAX_TOKENS,
  })

  for await (const delta of textStream) {
    accumulated += delta
    if (accumulated.length - lastEmitLen >= EMIT_EVERY) {
      lastEmitLen = accumulated.length
      await sb.from('task_updates').insert({
        workspace_id: task.workspace_id,
        task_id: task.id,
        agent_run_id: runId,
        pet_name: agentType,
        update_type: 'progress',
        content: accumulated,
      })
    }
  }

  const output = accumulated

  await sb.from('agent_runs').update({
    status: 'completed',
    output,
    tool_calls: [],
    ended_at: new Date().toISOString()
  }).eq('id', runId)

  return output
}