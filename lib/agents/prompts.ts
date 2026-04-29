/**
 * lib/agents/prompts.ts
 *
 * Builds the system prompt for an AI employee agent turn.
 * Composes: employee identity + stacked skill guidance + memory context.
 * Per spec §3: skills are stacked guidance layers, not tool gates.
 */

import type { Employee } from '@/types'

interface PromptInput {
  employee: Employee
  memoryPrompt: string
}

/**
 * Build the full system prompt for an agent task loop or meeting response.
 * The employee's custom system_prompt (if set) is the base. Skills are stacked
 * on top as additional guidance layers. Memory context is injected last.
 */
export function buildAgentSystemPrompt({ employee, memoryPrompt }: PromptInput): string {
  const parts: string[] = []

  // ── Identity ────────────────────────────────────────────────────────────
  parts.push(
    `You are ${employee.name}, an AI employee at this company. You always identify yourself as AI — never pretend to be human.`
  )

  // ── Employee custom system prompt ────────────────────────────────────────
  if (employee.system_prompt?.trim()) {
    parts.push(employee.system_prompt.trim())
  }

  // ── Stacked skill guidance ───────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- skills join shape varies
  const skills = (employee as any).skills as Array<{ skill: { name: string; prompt_guidance: string } }> | undefined
  if (skills?.length) {
    const skillLines = skills
      .filter(s => s.skill?.prompt_guidance?.trim())
      .map(s => `[${s.skill.name}]\n${s.skill.prompt_guidance.trim()}`)
    if (skillLines.length) {
      parts.push(`## Your skill guidance\n\n${skillLines.join('\n\n')}`)
    }
  }

  // ── Behavioural rules ────────────────────────────────────────────────────
  parts.push(`## Rules
- Complete tasks with the minimum number of tool calls required.
- For dangerous actions (sending emails, posting publicly, writing to production), you will queue them for human approval — do not attempt to bypass this.
- If you need information you don't have, use the search or knowledge tools rather than guessing.
- After completing work, update memory files with anything durable you learned (company facts, preferences, project state). Use str_replace for edits, not create.
- Write naturally and professionally. Avoid filler phrases ("Certainly!", "Of course!", "Absolutely!").`)

  // ── Workspace memory (injected last) ────────────────────────────────────
  if (memoryPrompt.trim()) {
    parts.push(`## Workspace memory\n\n${memoryPrompt.trim()}`)
  }

  return parts.join('\n\n')
}

/**
 * Shorter prompt for the meeting decision model (speak/act/stay silent).
 * Deliberately lean — runs at every VAD pause in the voice path.
 */
export function buildDecisionSystemPrompt(employeeName: string): string {
  return `You are ${employeeName}, an AI employee in a live meeting. You must decide whether to speak, take an action, or stay silent.

Respond with ONLY one of these exact JSON objects (no other text):
{"decision": "speak", "response": "<what to say, ≤3 sentences, natural spoken language>"}
{"decision": "act", "task": "<brief description of the action to take>"}
{"decision": "silent"}

Guidelines:
- speak: only when directly addressed by name, asked a question, or you have something genuinely useful to add
- act: when someone mentions a task you could handle (create ticket, send message, schedule meeting, etc.)
- silent: default — when humans are talking among themselves and your input is not needed
- Never speak more than 3 sentences. No markdown, no lists.
- You are speaking aloud via text-to-speech — write as spoken language.`
}

/**
 * Post-meeting processing prompt — generates task list from a full transcript.
 * Replaces the old orchestrator prompt with employee-aware version.
 */
export function buildMeetingProcessPrompt(employeeName: string): string {
  return `You are ${employeeName}. You just attended a meeting and need to extract action items.

Review the full meeting transcript and produce the MINIMUM number of tasks needed — usually 1-3.

Rules:
- Combine related actions into one task where the same agent can handle them together
- Keep titles short and action-oriented (under 8 words)
- Assign priority based on urgency signals in the transcript

Respond with ONLY raw JSON (no markdown fences):
{
  "summary": "one sentence summary of the meeting",
  "tasks": [
    {
      "title": "short action title",
      "description": "full details of what needs to be done, including context from the meeting",
      "priority": "low|medium|high|urgent"
    }
  ]
}`
}
