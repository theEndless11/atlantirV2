import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { useAnthropic, AGENT_MODEL } from '@/lib/anthropic'
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

async function humaniseOutput(rawOutput: string, taskTitle: string, taskDescription: string): Promise<string> {
  const client = useAnthropic()
  try {
    const response = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: 1500,
      system: `You are a professional technical writer. Convert raw data or JSON output into clear, readable prose that directly answers what was asked.

Rules:
- Write in plain, professional English — no jargon
- Convert JSON arrays/objects into readable sentences and bullet lists
- Structure the response with a brief summary paragraph, then detail as needed
- Preserve every specific fact: names, IDs, column names, values, URLs
- Do not mention JSON, arrays, or data structures — just describe what the data contains
- Do not use emojis
- Output ONLY the human-readable version, nothing else`,
      messages: [{
        role: 'user',
        content: `Task: ${taskTitle}\n${taskDescription ? 'Details: ' + taskDescription + '\n' : ''}\nRaw output to convert:\n\n${rawOutput}`
      }]
    })
    const humanised = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text).join('').trim()
    return humanised || rawOutput
  } catch {
    return rawOutput
  }
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
      let content = finalOutput
      if (looksLikeRawData(finalOutput)) {
        content = await humaniseOutput(finalOutput, task.title, task.description || '')
      }
      await sb.from('artifacts').insert({
        workspace_id: task.workspace_id,
        task_id: task.id,
        title: task.title,
        type: task.assigned_agent === 'research' ? 'research'
          : task.assigned_agent === 'writer' ? 'document' : 'other',
        content,
        version: 1,
      })
      await sb.from('tasks').update({ status: 'completed' }).eq('id', task_id)
    })
    .catch(async () => {
      await sb.from('tasks').update({ status: 'approved' }).eq('id', task_id)
    })

  return NextResponse.json({ status: 'pipeline_started' })
}
