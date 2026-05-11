import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { callLLM, AGENT_MODEL } from '@/lib/anthropic'

// Detect if a follow-up message actually needs the agent to re-run
// Returns true only for substantive requests, false for casual chat
async function isActionableFollowUp(content: string, taskTitle: string): Promise<boolean> {
  const text = content.trim().toLowerCase()

  // Hard-coded fast rejections — never re-run for these
  const casual = ['hi', 'hey', 'hello', 'ok', 'okay', 'thanks', 'thank you', 'got it',
    'nice', 'cool', 'great', 'awesome', 'sounds good', 'perfect', 'good', 'noted',
    'lol', 'haha', 'yes', 'no', 'sure', 'yep', 'nope', 'k', 'ok thanks']
  if (casual.some(w => text === w || text === w + '.' || text === w + '!')) return false
  if (text.split(' ').length <= 3 && !text.includes('?') &&
      !['update', 'redo', 'retry', 'fix', 'change', 'add', 'remove', 'show', 'make', 'create', 'include'].some(w => text.includes(w))) {
    return false
  }

  // For ambiguous messages, ask the LLM
  try {
    const result = await callLLM({
      model: AGENT_MODEL,
      system: `You decide if a follow-up message to an AI task requires the agent to re-run and produce new output.
Reply with exactly YES or NO.
YES: requests changes, asks for more detail, requests a new version, asks a question about the task output, asks for additions
NO: casual chat, greetings, acknowledgements, reactions, simple thank-yous, off-topic conversation`,
      prompt: `Task: "${taskTitle}"\nFollow-up message: "${content}"\n\nDoes this require the agent to re-run?`,
      maxTokens: 5,
    })
    return result.trim().toUpperCase().startsWith('YES')
  } catch {
    // On error, be conservative — only re-run if message looks substantive
    return content.trim().split(' ').length > 6
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspace_id, task_id, meeting_id, content, sender_id } = body
  if (!workspace_id || !content)
    return NextResponse.json({ error: 'workspace_id and content required' }, { status: 400 })

  const sb = supabaseAdmin()

  // Save the human message first
  const { data: message } = await sb.from('messages').insert({
    workspace_id,
    task_id: task_id || null,
    meeting_id: meeting_id || null,
    sender_id: sender_id || null,
    sender_type: 'human',
    content,
  }).select().single()

  if (task_id) {
    const { data: task } = await sb.from('tasks').select('*').eq('id', task_id).single()

    const eligibleStatus = task && task.assigned_agent && (
      task.status === 'needs_clarification' ||
      task.status === 'completed' ||
      task.status === 'in_progress'
    )

    if (eligibleStatus) {
      // Check if this message actually warrants re-running the agent
      const shouldRerun = await isActionableFollowUp(content, task.title)

      if (shouldRerun) {
        const updatedDescription = [
          task.description || task.title,
          `\n\nFollow-up from user: ${content}`,
        ].join('')

        await sb.from('tasks').update({
          status: 'approved',
          description: updatedDescription,
        }).eq('id', task_id)

        const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        fetch(`${baseUrl}/api/agents/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id }),
        }).catch(() => {})
      }
      // For casual messages: just save the message, no agent re-run
    }
  }

  return NextResponse.json(message)
}