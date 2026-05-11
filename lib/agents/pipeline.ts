/**
 * Agent pipeline — runs a sequence of specialized agents (pets) to complete a task.
 *
 * Uses @ai-sdk/openai → OpenRouter for all LLM calls (fixes 401 errors that
 * occurred when the Anthropic SDK was incorrectly pointed at OpenRouter).
 */

import { getLLM, callLLM, AGENT_MODEL, EXECUTOR_MODEL, MAX_TOKENS } from '../anthropic'
import { generateText, streamText, tool } from 'ai'
import { z } from 'zod'
import { supabaseAdmin } from '../supabase'
import { PETS, getPipelineForTask } from './pets'
import type { PetName } from './pets'
import type { Task } from '@/types'
import { executeTools, type ToolCall } from '../tool-executor'
import { getConnectedTools, toAnthropicTool } from '../tool-registry'

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

  const lines = (data || []).map(i => {
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
  if (lines.length) summary += `\n\n## Connected integrations\n${lines.join('\n')}`
  summary += `\n\nAlways available:\n- Excel: generate .xlsx files\n- Web search: search the internet`

  if (dbData?.length) {
    const dbLines = dbData.map((d: any) => {
      const tables = d.config?.tables?.length ? ` (tables: ${d.config.tables.join(', ')})` : ''
      return `- ${d.name} [${d.db_type}] — status: ${d.status}${tables}`
    })
    summary += `\n\n## Connected databases\n${dbLines.join('\n')}`
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
    const memory = await callLLM({
      model: AGENT_MODEL,
      system: 'Extract 1 key fact worth remembering for future tasks. Return just the fact as one sentence, or "NONE".',
      prompt: content.slice(0, 800),
      maxTokens: 150,
    })
    if (memory && memory !== 'NONE') {
      const sb = supabaseAdmin()
      await sb.from('agent_memory').insert({
        workspace_id: workspaceId, agent_type: agentType,
        memory_type: 'fact', content: memory, source_task_id: taskId
      })
    }
  } catch {}
}

async function postProgress(taskId: string, workspaceId: string, petName: string, agentType: string, type: string, content: string) {
  const sb = supabaseAdmin()
  await sb.from('task_updates').insert({ task_id: taskId, workspace_id: workspaceId, agent_type: agentType, pet_name: petName, update_type: type, content })
}

// ─── Build AI SDK tools from tool-registry ───────────────────────────────────
// Maps each connected tool into AI SDK `tool()` format.
// The actual execution still goes through executeTools() so all the
// existing integration dispatch logic is preserved.

async function buildAiSdkTools(workspaceId: string): Promise<Record<string, any>> {
  const connected = await getConnectedTools(workspaceId)
  if (!connected.length) return {}

  const tools: Record<string, any> = {}

  for (const t of connected) {
    // Build a Zod schema from the tool's input_schema properties
    const props = t.input_schema?.properties || {}
    const required: string[] = t.input_schema?.required || []
    const shape: Record<string, any> = {}

    for (const [key, def] of Object.entries(props as Record<string, any>)) {
      let zField = z.string().describe(def.description || key)
      if (!required.includes(key)) zField = zField.optional() as any
      shape[key] = zField
    }

    const toolName = t.name
    const wid = workspaceId

    tools[toolName] = tool({
      description: t.description,
      parameters: z.object(shape),
      execute: async (input: Record<string, any>) => {
        const calls: ToolCall[] = [{
          id: `${toolName}-${Date.now()}`,
          name: toolName,
          input: Object.fromEntries(
            Object.entries(input).map(([k, v]) => [k, String(v ?? '')])
          ),
        }]
        const results = await executeTools(calls, wid)
        return results[0]?.content || 'Tool completed'
      },
    })
  }

  return tools
}

// ─── Agentic tool loop (for Bolt/executor) ────────────────────────────────────

async function runAgenticLoop(
  systemPrompt: string,
  userMessage: string,
  workspaceId: string,
  onProgress: (msg: string) => Promise<void>
): Promise<string> {
  const tools = await buildAiSdkTools(workspaceId)
  const hasTools = Object.keys(tools).length > 0

  try {
    const result = await generateText({
      model: getLLM(EXECUTOR_MODEL),
      system: systemPrompt,
      prompt: userMessage,
      tools: hasTools ? tools : undefined,
      maxSteps: 10,
      maxTokens: MAX_TOKENS,
      onStepFinish: async ({ text, toolCalls, toolResults }) => {
        if (text?.trim()) await onProgress(text.trim())
        if (toolCalls?.length) {
          const names = toolCalls.map((tc: any) => tc.toolName.replace(/_/g, ' ')).join(', ')
          await onProgress(`⚡ Executing: ${names}…`)
        }
      },
    })

    return result.text || result.steps?.map((s: any) => s.text).filter(Boolean).join('\n') || 'Task completed.'
  } catch (err: any) {
    // Surface a clean error rather than the raw 401 JSON
    const msg = err?.message || String(err)
    if (msg.includes('401') || msg.includes('User not found')) {
      return `Could not connect to the AI provider. Please check OPENROUTER_API_KEY in your .env.local file is valid and has credits.`
    }
    throw err
  }
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
    // Stream token by token, emit progress every ~120 chars
    let accumulated = ''
    let lastEmitLen = 0
    const EMIT_EVERY = 120

    const { textStream } = streamText({
      model: getLLM(AGENT_MODEL),
      system: systemPrompt,
      prompt: userMessage,
      maxTokens: MAX_TOKENS,
    })

    for await (const delta of textStream) {
      accumulated += delta
      if (accumulated.length - lastEmitLen >= EMIT_EVERY) {
        lastEmitLen = accumulated.length
        await postProgress(task.id, task.workspace_id, pet.displayName, pet.agentType, 'progress', accumulated)
      }
    }
    output = accumulated
    // Final progress emit with complete text
    if (output) await postProgress(task.id, task.workspace_id, pet.displayName, pet.agentType, 'progress', output)
  }

  await sb.from('task_pipeline').update({ status: 'completed', output, completed_at: new Date().toISOString() }).eq('id', stepId)
  saveMemory(task.workspace_id, pet.agentType, output, task.id).catch(() => {})
  return output
}

// ─── Run full pipeline ────────────────────────────────────────────────────────

export async function runPipeline(task: Task): Promise<string> {
  const sb = supabaseAdmin()
  const pipeline = getPipelineForTask(task.assigned_agent || 'default')

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
      outputs.push(`[${petName} failed: ${errMsg}]`)
    }
  }

  return [...outputs].reverse().find(o => !o.startsWith('[')) || outputs[outputs.length - 1] || ''
}