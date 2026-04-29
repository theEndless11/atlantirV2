/**
 * Agent pipeline — runs a sequence of specialized agents (pets) to complete a task.
 *
 * Key upgrade: Bolt (executor) now uses Anthropic's native tool_use API instead of
 * parsing ACTION: text lines. This is more reliable, handles multi-step tool chaining,
 * and gives agents proper structured access to all 20+ connected integrations.
 *
 * Architecture inspired by:
 *  - Composio: structured tool definitions per integration
 *  - ACI.dev: only connected tools are passed to the agent (no context bloat)
 *  - Nango: per-workspace credential management via integrations table
 */

import { useAnthropic, AGENT_MODEL, EXECUTOR_MODEL, MAX_TOKENS } from '../utils/anthropic'
import { useSupabaseAdmin } from '../utils/supabase'
import { PETS, getPipelineForTask } from './pets'
import type { PetName } from './pets'
import type { Task } from '@/types'
import { getConnectedTools, toAnthropicTool } from '../utils/tool-registry'
import { executeTools, type ToolCall } from '../utils/tool-executor'

// ─── Context loaders ──────────────────────────────────────────────────────────

async function getRagContext(workspaceId: string, taskTitle: string, taskDesc: string): Promise<string> {
  try {
    const sb = supabaseAdmin()
    const keywords = (taskTitle + ' ' + (taskDesc || ''))
      .toLowerCase().split(/\s+/).filter(w => w.length > 4).slice(0, 6)
    if (!keywords.length) return ''
    const { data } = await sb.from('file_chunks').select('content').eq('workspace_id', workspaceId).limit(60)
    if (!data?.length) return ''
    const scored = data
      .map(chunk => ({ content: chunk.content, score: keywords.filter(k => chunk.content.toLowerCase().includes(k)).length }))
      .filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 4)
    if (!scored.length) return ''
    return `\n\n## Company knowledge\n${scored.map(c => c.content).join('\n\n---\n\n')}`
  } catch { return '' }
}

async function getIntegrationSummary(workspaceId: string): Promise<string> {
  const sb = supabaseAdmin()
  const [{ data }, { data: dbData }] = await Promise.all([
    sb.from('integrations').select('type, config').eq('workspace_id', workspaceId).eq('status', 'connected'),
    sb.from('db_connections').select('name, db_type, status, config').eq('workspace_id', workspaceId)
  ])
  const hasAnything = (data?.length || 0) + (dbData?.length || 0) > 0
  if (!hasAnything) return ''

  const lines = data.map(i => {
    const cfg = i.config as any
    const details: Record<string, string> = {
      slack:           `Slack (default channel: ${cfg?.channel || '#general'})`,
      github:          `GitHub (default repo: ${cfg?.repo || 'auto-detect'})`,
      notion:          `Notion (database: ${cfg?.database_id ? 'configured' : 'not set'})`,
      gmail:           `Gmail (sender: ${cfg?.sender_email || 'not set'})`,
      google_calendar: `Google Calendar (via webhook)`,
      zapier:          `Zapier (webhook: configured)`,
      jira:            `Jira (project: ${cfg?.project_key || 'PROJ'}, host: ${cfg?.host || 'not set'})`,
      linear:          `Linear (team: ${cfg?.team_id || 'default'})`,
      hubspot:         `HubSpot CRM`,
      twilio:          `Twilio (from: ${cfg?.from_number || 'not set'})`,
      stripe:          `Stripe (live: ${cfg?.secret_key?.startsWith('sk_live') ? 'yes' : 'test mode'})`,
      airtable:        `Airtable`,
      asana:           `Asana (project: ${cfg?.project_id || 'default'})`,
      trello:          `Trello`,
      intercom:        `Intercom`,
      zendesk:         `Zendesk (subdomain: ${cfg?.subdomain || 'not set'})`,
      vercel:          `Vercel (team: ${cfg?.team_id || 'personal'})`,
      pagerduty:       `PagerDuty`,
      sentry:          `Sentry (org: ${cfg?.org_slug || 'not set'})`,
      cloudflare:      `Cloudflare`,
    }
    return '- ' + (details[i.type] || i.type)
  })

  let summary = ''
  if (lines.length) {
    summary += `\n\n## Connected integrations\n${lines.join('\n')}`
  }
  summary += `\n\nAlways available (no connection needed):\n- Excel: generate .xlsx files\n- Web search: search the internet`

  if (dbData?.length) {
    const dbLines = dbData.map((d: any) => {
      const tables = d.config?.tables?.length ? ` (tables: ${d.config.tables.join(', ')})` : ''
      return `- ${d.name} [${d.db_type}] — status: ${d.status}${tables}`
    })
    summary += `\n\n## Connected databases (you CAN query these — they are available)\n${dbLines.join('\n')}`
  }

  return summary
}

async function loadMemory(workspaceId: string, agentType: string): Promise<string> {
  const sb = supabaseAdmin()
  const { data } = await sb.from('agent_memory').select('content')
    .eq('workspace_id', workspaceId).eq('agent_type', agentType)
    .order('created_at', { ascending: false }).limit(5)
  if (!data?.length) return ''
  return `\n\n## Memory from past tasks\n${data.map(m => `- ${m.content}`).join('\n')}`
}

async function saveMemory(workspaceId: string, agentType: string, content: string, taskId: string) {
  try {
    const client = useAnthropic()
    const res = await client.messages.create({
      model: AGENT_MODEL, max_tokens: 150,
      system: 'Extract 1 key fact worth remembering for future tasks. Return just the fact as one sentence, or "NONE".',
      messages: [{ role: 'user', content: content.slice(0, 800) }]
    })
    const memory = res.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
    if (memory && memory !== 'NONE') {
      const sb = supabaseAdmin()
      await sb.from('agent_memory').insert({ workspace_id: workspaceId, agent_type: agentType, memory_type: 'fact', content: memory, source_task_id: taskId })
    }
  } catch {}
}

async function postProgress(taskId: string, workspaceId: string, petName: string, agentType: string, type: string, content: string) {
  const sb = supabaseAdmin()
  await sb.from('task_updates').insert({ task_id: taskId, workspace_id: workspaceId, agent_type: agentType, pet_name: petName, update_type: type, content })
}

// ─── Agentic tool loop (for Bolt) ─────────────────────────────────────────────
// Runs an agentic loop: LLM calls tools → we execute them → LLM sees results → repeat
// until LLM produces a final text response. Max 10 rounds to prevent runaway loops.

async function runAgenticLoop(
  systemPrompt: string,
  userMessage: string,
  workspaceId: string,
  onProgress: (msg: string) => Promise<void>
): Promise<string> {
  const client = useAnthropic()
  const tools = await getConnectedTools(workspaceId)
  const anthropicTools = tools.map(toAnthropicTool)

  const messages: any[] = [{ role: 'user', content: userMessage }]
  let roundsLeft = 10
  const allToolResults: string[] = []

  while (roundsLeft-- > 0) {
    const response = await client.messages.create({
      model: EXECUTOR_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
      tool_choice: anthropicTools.length > 0 ? { type: 'auto' } : undefined,
      messages,
    })

    // Collect text output from this round
    const textBlocks = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text)
    if (textBlocks.length > 0 && textBlocks.join('').trim()) {
      await onProgress(textBlocks.join('\n').trim())
    }

    // If done — no tool calls — return final output
    if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
      const finalText = response.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text).join('\n').trim()
      if (allToolResults.length > 0) {
        return finalText + '\n\n**Actions completed:**\n' + allToolResults.join('\n')
      }
      return finalText
    }

    // Extract tool use blocks
    const toolUseBlocks = response.content.filter((b: any) => b.type === 'tool_use')
    if (toolUseBlocks.length === 0) break

    // Add assistant message with tool calls to history
    messages.push({ role: 'assistant', content: response.content })

    // Execute tools
    const calls: ToolCall[] = toolUseBlocks.map((b: any) => ({
      id: b.id, name: b.name, input: b.input
    }))

    const toolNames = calls.map(c => c.name.replace(/_/g, ' ')).join(', ')
    await onProgress(`⚡ Executing: ${toolNames}…`)

    const results = await executeTools(calls, workspaceId)
    allToolResults.push(...results.map(r => r.content))

    // Add tool results back to history
    messages.push({
      role: 'user',
      content: results.map(r => ({
        type: 'tool_result',
        tool_use_id: r.toolUseId,
        content: r.content,
        is_error: r.isError,
      }))
    })
  }

  // Exhausted rounds — synthesize from what we have
  const finalMessages = [...messages, {
    role: 'user',
    content: 'Summarize what was accomplished based on the tool results above.'
  }]
  const summary = await client.messages.create({
    model: EXECUTOR_MODEL, max_tokens: 1000,
    system: systemPrompt, messages: finalMessages,
  })
  const summaryText = summary.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim()

  return allToolResults.length > 0
    ? summaryText + '\n\n**Actions completed:**\n' + allToolResults.join('\n')
    : summaryText
}

// ─── Run a single pet step ────────────────────────────────────────────────────

async function runPet(petName: PetName, task: Task, previousOutputs: string[], stepId: string): Promise<string> {
  const pet = PETS[petName]
  const sb = supabaseAdmin()

  await sb.from('task_pipeline').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', stepId)
  await postProgress(task.id, task.workspace_id, pet.displayName, pet.agentType, 'started', `${pet.displayName} starting…`)

  const [memory, rag, integrationSummary] = await Promise.all([
    loadMemory(task.workspace_id, pet.agentType),
    getRagContext(task.workspace_id, task.title, task.description || ''),
    getIntegrationSummary(task.workspace_id),
  ])

  const context = previousOutputs.length > 0
    ? `\n\n## Previous step output\n${previousOutputs[previousOutputs.length - 1]}`
    : ''

  const systemPrompt = pet.systemPrompt + integrationSummary + memory + rag
  const userMessage = `Task: ${task.title}${task.description ? `\nDetails: ${task.description}` : ''}${context}`

  let output: string

  // Bolt uses the full agentic tool loop; other agents use simple text generation
  if (pet.agentType === 'executor') {
    output = await runAgenticLoop(
      systemPrompt,
      userMessage,
      task.workspace_id,
      async (msg) => {
        await postProgress(task.id, task.workspace_id, pet.displayName, pet.agentType, 'progress', msg)
      }
    )
  } else {
    const client = useAnthropic()
    const response = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })
    output = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n').trim()
    await postProgress(task.id, task.workspace_id, pet.displayName, pet.agentType, 'progress', output)
  }

  await sb.from('task_pipeline').update({ status: 'completed', output, completed_at: new Date().toISOString() }).eq('id', stepId)

  saveMemory(task.workspace_id, pet.agentType, output, task.id).catch(() => {})
  return output
}

// ─── Run full pipeline ────────────────────────────────────────────────────────

export async function runPipeline(task: Task): Promise<string> {
  const sb = supabaseAdmin()
  const pipeline = getPipelineForTask(task.assigned_agent || 'default')

  // Create pipeline step records
  const stepRecords: { petName: PetName; stepId: string }[] = []
  for (let i = 0; i < pipeline.length; i++) {
    const pet = PETS[pipeline[i]]
    const { data } = await sb.from('task_pipeline').insert({
      task_id: task.id, workspace_id: task.workspace_id,
      step_index: i, agent_type: pet.agentType,
      pet_name: pet.displayName, status: 'waiting'
    }).select().single()
    stepRecords.push({ petName: pipeline[i], stepId: data!.id })
  }

  const outputs: string[] = []

  for (const { petName, stepId } of stepRecords) {
    try {
      const output = await runPet(petName, task, outputs, stepId)
      outputs.push(output)
    } catch (err: any) {
      const errMsg = err.message || String(err)
      await sb.from('task_pipeline').update({ status: 'failed', completed_at: new Date().toISOString() }).eq('id', stepId)
      await postProgress(task.id, task.workspace_id, PETS[petName].displayName, PETS[petName].agentType, 'error', `${PETS[petName].displayName} failed: ${errMsg}`)
      // Push placeholder so subsequent steps still have something to work with
      outputs.push(`[${petName} failed: ${errMsg}]`)
    }
  }

  // Return last non-error output
  return [...outputs].reverse().find(o => !o.startsWith('[')) || outputs[outputs.length - 1] || ''
}