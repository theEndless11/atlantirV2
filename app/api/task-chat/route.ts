import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getLLM, AGENT_MODEL } from '@/lib/anthropic'
import { streamText, generateText } from 'ai'

// Fetch connected integrations + databases for this workspace
async function getWorkspaceContext(workspaceId: string): Promise<string> {
  try {
    const sb = supabaseAdmin()
    const [{ data: integrations }, { data: dbs }, { data: ws }] = await Promise.all([
      sb.from('integrations').select('type, config, status').eq('workspace_id', workspaceId).eq('status', 'connected'),
      sb.from('db_connections').select('name, db_type, status, config').eq('workspace_id', workspaceId),
      sb.from('workspaces').select('name').eq('id', workspaceId).single(),
    ])

    if (!integrations?.length && !dbs?.length) return ''

    const appLabel = (type: string, cfg: any): string => {
      const map: Record<string, string> = {
        slack: `Slack (channel: ${cfg?.channel || '#general'})`,
        github: `GitHub (repo: ${cfg?.repo || 'auto-detect'})`,
        notion: `Notion`,
        gmail: `Gmail (from: ${cfg?.sender_email || 'not set'})`,
        google_calendar: `Google Calendar`,
        zapier: `Zapier`,
        jira: `Jira (project: ${cfg?.project_key || 'PROJ'})`,
        linear: `Linear`,
        hubspot: `HubSpot CRM`,
        twilio: `Twilio`,
        stripe: `Stripe`,
        airtable: `Airtable`,
        asana: `Asana`,
        trello: `Trello`,
        zendesk: `Zendesk`,
        vercel: `Vercel`,
        sentry: `Sentry`,
        intercom: `Intercom`,
        pagerduty: `PagerDuty`,
        cloudflare: `Cloudflare`,
      }
      return map[type] || type
    }

    const parts: string[] = [
      `\n\n## Workspace: ${ws?.name || workspaceId}`,
      `\n\n## Connected apps & integrations`,
    ]

    if (integrations?.length) {
      integrations.forEach((i: any) => {
        parts.push(`\n- ${appLabel(i.type, i.config)}`)
      })
    } else {
      parts.push(`\nNo apps connected yet.`)
    }

    parts.push(`\n- Web search (always available)`)
    parts.push(`\n- File downloads: CSV, JSON, Markdown (always available)`)

    if (dbs?.length) {
      parts.push(`\n\n## Connected databases`)
      dbs.forEach((d: any) => {
        const tables = d.config?.tables?.length ? ` — tables: ${(d.config.tables as string[]).join(', ')}` : ''
        parts.push(`\n- ${d.name} [${d.db_type}]${tables} (${d.status})`)
      })
    }

    return parts.join('')
  } catch {
    return ''
  }
}


const INTENT_SYSTEM = `Classify the user's follow-up message about a task output. Reply ONLY with valid JSON:
{
  "intent": "chat" | "task" | "render_graph" | "render_table" | "update" | "download",
  "task_title": null or string (max 80 chars, only for intent=task),
  "task_description": null or string (only for intent=task),
  "task_agent": null or "research"|"writer"|"analyst"|"executor" (only for intent=task)
}

CRITICAL RULES:
- intent = "render_graph" → ANY request to show/draw/plot/visualize as a chart, graph, line, bar, pie. Use this when artifact_context has data. "show a line graph", "plot this", "make a bar chart", "visualize", "graph it", "compare visually" → render_graph. NEVER use "task" for graph requests.
- intent = "render_table" → user wants data as a table/grid/spreadsheet
- intent = "task" → ONLY for actions needing external integrations: post to Slack, create GitHub issue, send email, fetch from third-party. NEVER use for visualization.
- intent = "update" → rewrite/translate/summarise/reformat the existing text output
- intent = "chat" → questions, explanations, anything else
- intent = "download" → user wants to download, export, or save data as a file (CSV, JSON, zip, markdown, Excel)

When artifact_context is present, ALWAYS assume the user is asking about that data. Never classify a visualization request as "task".`

const CHAT_SYSTEM = `You are a helpful AI assistant embedded in a workspace tool.
The user is looking at a completed task and its output — the full content is provided below.
IMPORTANT: You have full access to the task output data. NEVER say you lack access to data or cannot see it.
If the user asks about the data, refer to it directly. Use markdown — bold, bullets, tables, code blocks.
Be concise and genuinely helpful.`

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const task_id = searchParams.get('task_id')
  if (!task_id) return NextResponse.json([])
  const sb = supabaseAdmin()
  const { data } = await sb
    .from('messages')
    .select('id, content, sender_type, created_at')
    .eq('task_id', task_id)
    .in('sender_type', ['human', 'agent'])
    .order('created_at', { ascending: true })
    .limit(60)
  return NextResponse.json(data || [])
}

export async function POST(req: Request) {
  const {
    workspace_id, task_id, task_title,
    message, artifact_context, history = []
  } = await req.json()

  if (!workspace_id || !message)
    return NextResponse.json({ error: 'workspace_id and message required' }, { status: 400 })

  const sb = supabaseAdmin()

  // Persist human message
  await sb.from('messages').insert({
    workspace_id,
    task_id: task_id || null,
    sender_type: 'human',
    content: message,
  })

  // Fetch workspace context (integrations + databases) — injected into every LLM call
  const workspaceCtx = await getWorkspaceContext(workspace_id)

  // ── Classify intent ───────────────────────────────────────────────────────
  let intent = 'chat'
  let newTaskTitle: string | null = null
  let newTaskDescription: string | null = null
  let newTaskAgent: string | null = null
  let alsoChat = false

  try {
    const { text: raw } = await generateText({
      model: getLLM(AGENT_MODEL),
      system: INTENT_SYSTEM,
      prompt: `Task context: "${task_title || ''}"\nArtifact exists: ${!!artifact_context}\nConnected apps: ${workspaceCtx ? "yes" : "none"}\nUser message: ${message}`,
      maxTokens: 150,
    })
    const p = JSON.parse(raw.replace(/```json|```/g, '').trim())
    intent = p.intent || 'chat'
    newTaskTitle = p.task_title || null
    newTaskDescription = p.task_description || null
    newTaskAgent = p.task_agent || null
  } catch { intent = 'chat' }

  // Detect combined requests: analysis question + graph request in same message
  const msgLower = message.toLowerCase()
  const hasVisual = /graph|chart|plot|visuali[sz]|pie|bar|line/.test(msgLower)
  const hasAnalysis = /pattern|explain|analys|insight|find|what|why|how|summarize|describe|tell me/.test(msgLower)
  if (intent === 'render_graph' && hasAnalysis && artifact_context) alsoChat = true

  // ── New background task ───────────────────────────────────────────────────
  if (intent === 'task' && newTaskTitle) {
    try {
      const { data: newTask } = await sb.from('tasks').insert({
        workspace_id,
        title: newTaskTitle.slice(0, 80),
        description: newTaskDescription || newTaskTitle,
        assigned_agent: newTaskAgent || 'executor',
        status: 'pending_approval',
        priority: 'medium',
      }).select().single()
      const reply = `Created task **${newTaskTitle}** — it's in the sidebar awaiting approval.`
      await sb.from('messages').insert({ workspace_id, task_id: task_id || null, sender_type: 'agent', content: reply })
      return NextResponse.json({ reply, intent: 'task', new_task_id: newTask?.id })
    } catch {
      return NextResponse.json({ reply: 'Task creation failed — try the command bar above.', intent: 'chat' })
    }
  }

  // ── If combined (analysis + graph), stream analysis first then render graph ──
  if (intent === 'render_graph' && alsoChat && artifact_context) {
    // Run analysis synchronously, then fall through to render_graph
    try {
      const { text: analysisText } = await generateText({
        model: getLLM(AGENT_MODEL),
        system: `You are an analyst. The user wants both: (1) a text analysis/explanation of the data, AND (2) a visualization. Provide ONLY the text analysis here — concise, insightful, markdown formatted. The graph will be shown separately.`,
        prompt: `Data:
${artifact_context.slice(0, 2000)}

User: ${message}`,
        maxTokens: 500,
      })
      await sb.from('messages').insert({ workspace_id, task_id, sender_type: 'agent', content: analysisText })
      // The analysis will be picked up by realtime — continue to render graph below
    } catch { /* skip analysis if it fails */ }
  }

  // ── Render graph inline — generate structured Chart.js data, no new artifact ───
  if (intent === 'render_graph' && task_id) {
    try {
      const { text: raw } = await generateText({
        model: getLLM(AGENT_MODEL),
        system: `You convert data/text into a Chart.js graph definition. Respond ONLY with valid JSON, no markdown fences, no explanation outside the JSON.

Required shape:
{ "chartType": "line"|"bar"|"pie"|"doughnut", "title": string, "labels": string[], "datasets": [{ "label": string, "data": number[], "color": string }] }

RULES:
1. DEFAULT to "line" chart unless the user explicitly asks for bar/pie/doughnut. Line charts look cleaner and more professional.
2. data[] must contain REAL numbers from the context. NEVER use 0s as placeholders.
3. labels[] and every datasets[].data[] MUST have the same length (min 3 items).
4. If no numeric data exists, invent plausible numbers and append "(Estimated)" to the title.
5. For color, assign each dataset a distinct professional color from: "#60a5fa","#34d399","#f59e0b","#f87171","#a78bfa","#38bdf8","#4ade80","#fb923c"
6. Multiple datasets are allowed — use one per metric being compared.`,
        prompt: `Task: ${task_title || ''}\n\nContent to visualize:\n${(artifact_context || '').slice(0, 3000)}\n\nUser request: ${message}`,
        maxTokens: 1200,
      })

      const graphContent = JSON.parse(raw.replace(/```json|```/g, '').trim())
      const replyText = `Here's a graph of the data.`
      // Embed the chart JSON in the DB message using a sentinel so it survives refresh
      const persistContent = replyText + '\n\n<!--render_graph:' + JSON.stringify(graphContent) + '-->'
      await sb.from('messages').insert({ workspace_id, task_id, sender_type: 'agent', content: persistContent })

      return NextResponse.json({
        reply: replyText,
        intent: 'render_graph',
        rendered: { type: 'graph', content: graphContent },
        append: alsoChat, // if true, frontend should append rather than replace loading msg
      })
    } catch {
      // Fall through to chat if parsing fails
      intent = 'chat'
    }
  }

  // ── Render table inline — no new artifact ─────────────────────────────────
  if (intent === 'render_table' && task_id) {
    try {
      const { text: raw } = await generateText({
        model: getLLM(AGENT_MODEL),
        system: `You convert data/text into a table definition. Respond ONLY with valid JSON, no markdown fences, no explanation outside the JSON.

Required shape:
{ "title": string, "columns": string[], "rows": Array<Record<string, string|number>>, "sortable": true, "filterable": true }

RULES:
1. rows[] must contain REAL data — never empty arrays.
2. Every row object must have a key for every column.
3. Minimum 3 rows, minimum 2 columns.
4. Column names should be short and clear (Title Case).`,
        prompt: `Task: ${task_title || ''}\n\nContent to tabulate:\n${(artifact_context || '').slice(0, 3000)}\n\nUser request: ${message}`,
        maxTokens: 2000,
      })

      const tableContent = JSON.parse(raw.replace(/```json|```/g, '').trim())
      if (!tableContent.rows?.length || !tableContent.columns?.length) throw new Error('empty')

      const replyText = `Here's the data as a table.`
      const persistContent = replyText + '\n\n<!--render_table:' + JSON.stringify(tableContent) + '-->'
      await sb.from('messages').insert({ workspace_id, task_id, sender_type: 'agent', content: persistContent })

      return NextResponse.json({
        reply: replyText,
        intent: 'render_table',
        rendered: { type: 'table', content: tableContent },
      })
    } catch {
      intent = 'chat'
    }
  }

  // ── Download / export data as file ──────────────────────────────────────────
  if (intent === 'download' && artifact_context) {
    try {
      const { text: raw } = await generateText({
        model: getLLM(AGENT_MODEL),
        system: `You generate downloadable file content from task data. Respond ONLY with valid JSON:
{
  "filename": string (e.g. "data.csv", "report.md", "export.json"),
  "mimeType": "text/csv" | "application/json" | "text/markdown" | "text/plain",
  "content": string (the full file content, properly formatted)
}
For CSV: proper headers + rows. For JSON: pretty-printed. For markdown: clean formatted report.`,
        prompt: `Task: ${task_title || ''}

Data:
${artifact_context.slice(0, 3000)}

User request: ${message}`,
        maxTokens: 2000,
      })
      const parsed = JSON.parse(raw.replace(/\`\`\`json|\`\`\`/g, '').trim())
      const reply = `Ready to download **${parsed.filename}**.`
      await sb.from('messages').insert({ workspace_id, task_id: task_id || null, sender_type: 'agent', content: reply })
      return NextResponse.json({
        reply,
        intent: 'download',
        download: { filename: parsed.filename, mimeType: parsed.mimeType, content: parsed.content },
      })
    } catch {
      // Fall through to chat
    }
  }

  // ── Update artifact inline (stream text) ──────────────────────────────────
  if (intent === 'update' && task_id) {
    const updateSystem = `You are an expert analyst and writer. The user wants you to update or extend the current task output.
Produce the complete updated content directly. Use clear structure and markdown formatting.
Be thorough and produce high-quality output.${workspaceCtx}`

    const updatePrompt = [
      artifact_context ? `Current output:\n${artifact_context}` : null,
      `User request: ${message}`,
    ].filter(Boolean).join('\n\n')

    const result = streamText({
      model: getLLM(AGENT_MODEL),
      system: updateSystem,
      prompt: updatePrompt,
      maxTokens: 1200,
      onFinish: async ({ text }: { text: string }) => {
        await sb.from('messages').insert({ workspace_id, task_id, sender_type: 'agent', content: text })
      },
    })
    return result.toDataStreamResponse()
  }

  // ── Streaming chat reply ──────────────────────────────────────────────────
  const historyMsgs = (history as any[])
    .filter(m => !m.loading && m.content)
    .slice(-12)
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const systemWithCtx = `${CHAT_SYSTEM}${workspaceCtx}` +
    (artifact_context ? `\n\n---\nTask: "${task_title || ''}"\nCurrent output:\n${artifact_context.slice(0, 2000)}` : '')

  const result = streamText({
    model: getLLM(AGENT_MODEL),
    system: systemWithCtx,
    messages: [...historyMsgs, { role: 'user', content: message }],
    maxTokens: 800,
    onFinish: async ({ text }: { text: string }) => {
      await sb.from('messages').insert({ workspace_id, task_id: task_id || null, sender_type: 'agent', content: text })
    },
  })
  return result.toDataStreamResponse()
}