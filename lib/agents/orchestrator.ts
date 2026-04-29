import { useAnthropic, ORCHESTRATOR_MODEL, MAX_TOKENS } from '../utils/anthropic'
import { useSupabaseAdmin } from '../utils/supabase'
import type { CreateTaskPayload, OrchestratorResult } from '@/types'

async function getWorkspaceTools(workspaceId: string): Promise<string> {
  const sb = supabaseAdmin()
  const [intResult, dbResult, fileResult] = await Promise.all([
    sb.from('integrations').select('type').eq('workspace_id', workspaceId).eq('status', 'connected'),
    sb.from('db_connections').select('name, db_type, status').eq('workspace_id', workspaceId),
    sb.from('file_chunks').select('metadata').eq('workspace_id', workspaceId).limit(5)
  ])
  const integrations = (intResult.data || []).map((i: any) => i.type)
  const databases = (dbResult.data || []).map((d: any) => `${d.name} (${d.db_type}, ${d.status})`)
  const hasRag = (fileResult.data || []).length > 0

  let tools = ''
  if (integrations.length) tools += `\nConnected integrations (executor can use these): ${integrations.join(', ')}`
  if (databases.length) tools += `\nConnected databases (analyst can query these): ${databases.join('; ')}`
  if (hasRag) tools += `\nRAG knowledge base: available (files uploaded)`
  return tools
}

const BASE_SYSTEM_PROMPT = `You are an Orchestrator Agent inside an AI workspace tool.
Analyze a meeting transcript or goal and produce the MINIMUM number of tasks needed.

Rules:
- Create as FEW tasks as possible — combine related work into one task
- A single goal ("post slack + send email + make calendar event") = ONE task for the executor
- Only split into separate tasks when they require completely different agents AND cannot be done together
- Maximum 3 tasks total. Usually 1-2 is correct.
- Assign the right agent:
  - executor: ANYTHING that touches a connected integration (Slack, Gmail, GitHub, Google Calendar, Notion, Zapier) or a connected database — including reading, listing, or querying them, not just writing/sending
  - research: finding information from public web sources only — never use for tasks that involve connected integrations
  - writer: writing documents, reports, long-form content
  - analyst: data analysis, strategic frameworks, querying connected databases
- Keep task titles short and action-oriented (under 8 words)

CRITICAL: If the input involves multiple actions of the same type (e.g. "post slack AND send email AND create calendar event"), 
combine them into ONE executor task. Do NOT create separate tasks per tool.

CRITICAL: Any task that reads FROM or writes TO a connected integration (GitHub, Gmail, Slack, Google Calendar, Notion, Zapier) MUST be assigned to executor — never to research, writer, or analyst.

CRITICAL: If databases are listed in the workspace tools, the executor/analyst agents CAN access them. Do NOT say databases are inaccessible.

Respond with ONLY raw JSON, no markdown, no fences:
{
  "summary": "one sentence summary",
  "tasks": [
    {
      "title": "short action title",
      "description": "full details of everything that needs to be done",
      "assigned_agent": "executor|research|writer|analyst",
      "priority": "low|medium|high|urgent"
    }
  ]
}`

export async function runOrchestrator(
  input: string,
  workspaceId: string,
  meetingId?: string
): Promise<OrchestratorResult> {
  const client = useAnthropic()
  const tools = await getWorkspaceTools(workspaceId)
  const systemPrompt = BASE_SYSTEM_PROMPT + (tools ? `\n\nWorkspace tools available:${tools}` : '')

  const response = await client.messages.create({
    model: ORCHESTRATOR_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: input }]
  })

  const raw = response.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('').trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    throw new Error(`Orchestrator returned invalid JSON: ${raw.slice(0, 200)}`)
  }

  if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
    throw new Error('Orchestrator response missing tasks array')
  }

  const tasks: CreateTaskPayload[] = parsed.tasks.slice(0, 3).map((t: any) => ({
    title: t.title,
    description: t.description,
    assigned_agent: t.assigned_agent,
    priority: t.priority || 'medium',
    workspace_id: workspaceId,
    meeting_id: meetingId
  }))

  return { tasks, summary: parsed.summary || '' }
}
