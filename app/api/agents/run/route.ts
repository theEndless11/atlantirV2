import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { callLLM, AGENT_MODEL } from '@/lib/anthropic'
import { runPipeline } from '@/lib/agents/pipeline'

function looksLikeRawData(text: string): boolean {
  const trimmed = text.trim()
  if (/^(\[|\{)/.test(trimmed)) return true
  if (/```(json)?\s*[\[{]/i.test(trimmed)) {
    const nonCodeLines = trimmed.replace(/```[\s\S]*?```/g, '').trim()
    if (nonCodeLines.length < trimmed.length * 0.3) return true
  }
  return false
}

// Infer a richer artifact type from task context
function inferArtifactType(
  agentType: string | undefined,
  taskTitle: string,
  taskDescription: string,
  output: string,
): 'table' | 'graph' | 'richtext' | 'document' | 'other' {
  const combined = `${taskTitle} ${taskDescription}`.toLowerCase()

  // Graph / chart signals
  const graphKeywords = ['chart', 'graph', 'plot', 'visuali', 'bar chart', 'line chart', 'pie chart', 'trend']
  if (graphKeywords.some(k => combined.includes(k))) return 'graph'

  // Table signals
  const tableKeywords = ['table', 'compare', 'comparison', 'list of', 'breakdown', 'ranking', 'leaderboard', 'spreadsheet']
  if (tableKeywords.some(k => combined.includes(k))) return 'table'

  // Rich text report signals
  const richTextKeywords = ['report', 'analysis', 'summary', 'write', 'draft', 'document', 'article', 'blog', 'essay', 'proposal', 'plan']
  if (richTextKeywords.some(k => combined.includes(k))) return 'richtext'

  // Agent-type fallback
  if (agentType === 'analyst') return 'richtext'
  if (agentType === 'writer') return 'richtext'
  if (agentType === 'research') return 'richtext'

  return 'other'
}

async function humaniseOutput(rawOutput: string, taskTitle: string, taskDescription: string): Promise<string> {
  try {
    return await callLLM({
      model: AGENT_MODEL,
      system: `You are a professional technical writer. Convert raw data or JSON output into clear, readable prose that directly answers what was asked.

Rules:
- Write in plain, professional English — no jargon
- Convert JSON arrays/objects into readable sentences and bullet lists
- Structure the response with a brief summary paragraph, then detail as needed
- Preserve every specific fact: names, IDs, column names, values, URLs
- Do not mention JSON, arrays, or data structures — just describe what the data contains
- Do not use emojis
- Output ONLY the human-readable version, nothing else`,
      prompt: `Task: ${taskTitle}\n${taskDescription ? 'Details: ' + taskDescription + '\n' : ''}\nRaw output to convert:\n\n${rawOutput}`,
      maxTokens: 1500,
    })
  } catch {
    return rawOutput
  }
}

// Build structured content for table/graph artifacts — always as composite (summary + visual)
async function structureOutputAsArtifact(
  type: 'table' | 'graph' | 'richtext',
  rawOutput: string,
  taskTitle: string,
  taskDescription: string,
): Promise<{ type: 'composite' | 'richtext'; content: Record<string, unknown> }> {
  if (type === 'richtext') {
    return { type: 'richtext', content: { title: taskTitle, markdown: rawOutput } }
  }

  // Generate a short prose summary to accompany the visual
  let summary = ''
  try {
    summary = await callLLM({
      model: AGENT_MODEL,
      system: `You are a concise analyst. Write 2-4 sentences summarising the key insight from the data below. Be specific about numbers, trends, and what matters most. No bullet points, plain prose only.`,
      prompt: `Task: ${taskTitle}\n\nData:\n${rawOutput.slice(0, 3000)}`,
      maxTokens: 200,
    })
  } catch { summary = '' }

  if (type === 'table') {
    try {
      const json = await callLLM({
        model: AGENT_MODEL,
        system: `Convert the following content into a JSON table artifact. Respond ONLY with valid JSON, no markdown fences, no explanation outside the JSON.

Required shape:
{ "title": string, "columns": string[], "rows": Array<Record<string, string|number>>, "sortable": true, "filterable": true }

STRICT RULES:
1. rows[] must contain REAL data — never empty arrays, never placeholder rows
2. Every row object must have a key for every column
3. If the input text doesn't have enough data, use your own knowledge to fill in realistic values
4. Minimum 3 rows, minimum 2 columns
5. Column names should be short and clear (Title Case)
6. Never respond with rows: []`,
        prompt: `Task: ${taskTitle}\n\nContent:\n${rawOutput}`,
        maxTokens: 2000,
      })
      const tableContent = JSON.parse(json.replace(/```json|```/g, '').trim())

      // Validate — never allow empty rows
      if (!tableContent.rows?.length || !tableContent.columns?.length) {
        throw new Error('Empty table — use fallback')
      }
      return {
        type: 'composite',
        content: {
          summary,
          blocks: [
            { type: 'table', ...tableContent },
          ],
        },
      }
    } catch {
      return {
        type: 'composite',
        content: {
          summary,
          blocks: [{ type: 'table', title: taskTitle, columns: ['#', 'Content'], rows: rawOutput.split('\n').filter(l => l.trim()).slice(0, 50).map((l, i) => ({ '#': i + 1, 'Content': l.replace(/^[-*]\s*/, '') })), sortable: false, filterable: true }],
        },
      }
    }
  }

  if (type === 'graph') {
    try {
      const json = await callLLM({
        model: AGENT_MODEL,
        system: `Convert the following content into a JSON graph artifact for Chart.js. Respond ONLY with valid JSON, no markdown fences, no explanation outside the JSON object.

Required shape:
{ "chartType": "bar"|"line"|"pie"|"scatter"|"doughnut"|"area", "title": string, "labels": string[], "datasets": [{ "label": string, "data": number[] }] }

STRICT RULES:
1. data[] must contain REAL numbers — integers or meaningful floats (e.g. 1200, 45.5). NEVER output 0, 0.0, 0.1–1.0 range unless the data is genuinely a percentage or proportion.
2. labels[] and every datasets[].data[] MUST have the same length (minimum 4 items).
3. If the input text has no numeric data, INVENT plausible hypothetical numbers and append "(Hypothetical)" to the title.
4. NEVER return empty arrays. If stuck, produce a 5-point line chart with realistic made-up values.
5. Choose chartType by data shape: line/area for trends over time, bar for category comparison, pie/doughnut for proportions.
6. Do NOT include a "color" field — handled by renderer.`,
        prompt: `Task: ${taskTitle}\n\nContent:\n${rawOutput}`,
        maxTokens: 2000,
      })
      const graphContent = JSON.parse(json.replace(/```json|```/g, '').trim())

      // Validate — never allow empty labels or empty data arrays
      if (!graphContent.labels?.length || !graphContent.datasets?.[0]?.data?.length) {
        throw new Error('Empty graph data — use fallback')
      }
      // Ensure lengths match
      const len = graphContent.labels.length
      graphContent.datasets = graphContent.datasets.map((ds: any) => ({
        ...ds,
        data: ds.data.length === len ? ds.data : Array.from({ length: len }, (_, i) => ds.data[i] ?? 0),
      }))
      return {
        type: 'composite',
        content: {
          summary,
          blocks: [
            { type: 'graph', ...graphContent },
          ],
        },
      }
    } catch {
      return {
        type: 'composite',
        content: {
          summary,
          blocks: [{ type: 'graph', chartType: 'bar', title: taskTitle, labels: ['No data'], datasets: [{ label: 'Result', data: [0] }] }],
        },
      }
    }
  }

  return { type: 'richtext', content: { title: taskTitle, markdown: rawOutput } }
}

export async function POST(req: Request) {
  const body = await req.json()
  const { task_id } = body
  if (!task_id) return NextResponse.json({ error: 'task_id required' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data: task, error: taskError } = await sb.from('tasks').select('*').eq('id', task_id).single()

  if (taskError || !task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (task.status !== 'approved') return NextResponse.json({ error: 'Task not approved' }, { status: 400 })

  await sb.from('tasks').update({ status: 'in_progress' }).eq('id', task_id)

  // Fire and forget — pipeline is async
  runPipeline(task)
    .then(async (finalOutput) => {
      let rawContent = finalOutput
      if (looksLikeRawData(finalOutput)) {
        rawContent = await humaniseOutput(finalOutput, task.title, task.description || '')
      }

      const artifactType = inferArtifactType(
        task.assigned_agent,
        task.title,
        task.description || '',
        rawContent,
      )

      let content: Record<string, unknown>
      let finalType: string = artifactType
      if (artifactType === 'table' || artifactType === 'graph' || artifactType === 'richtext') {
        const result = await structureOutputAsArtifact(artifactType, rawContent, task.title, task.description || '')
        content = result.content
        finalType = result.type
      } else {
        content = { markdown: rawContent } as any
        finalType = 'document'
      }

      await sb.from('artifacts').insert({
        workspace_id: task.workspace_id,
        task_id: task.id,
        title: task.title,
        type: finalType,
        content,
        version: 1,
        state: 'draft',
      })
      await sb.from('tasks').update({ status: 'completed' }).eq('id', task_id)
    })
    .catch(async () => {
      await sb.from('tasks').update({ status: 'approved' }).eq('id', task_id)
    })

  return NextResponse.json({ status: 'pipeline_started' })
}