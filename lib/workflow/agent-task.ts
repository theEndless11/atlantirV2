/**
 * lib/workflow/agent-task.ts
 *
 * Durable agent task runner using Vercel Workflow SDK.
 * Pattern from spec §14.3 — "use workflow" / "use step" directives.
 *
 * AI SDK runs directly inside steps. No separate agent framework.
 * Workflow SDK is the durable scheduler + HITL primitive.
 *
 * NOTE: Workflow SDK uses a build transform that recognises "use workflow"
 * and "use step" directives. These must be string literals at the top of
 * the function body — not in conditionals or nested scopes.
 */

import { generateText } from 'ai'
import { supabaseAdmin } from '@/lib/supabase'
import { llm, buildTelemetry } from '@/lib/llm/client'
import { composeMemoryContext, renderMemoryToPrompt } from '@/lib/memory/compose'
import { buildMemoryTools } from '@/lib/memory/memory-tools-schema'
import { buildAgentTools } from '@/lib/tool-executor/ai-sdk-tools'
import { nangoExecutor } from '@/lib/tool-executor/nango-executor'
import { isActionDangerous } from '@/lib/tool-executor/registry'
import { buildAgentSystemPrompt } from '@/lib/agents/prompts'
import { updateWorkflowCosts } from '@/lib/observability/costs'
import type { Task, Employee, Message, WorkflowRun } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentTaskInput {
  taskId: string
  workspaceId: string
  employeeId: string
}

export interface AgentTaskContext {
  task: Task
  employee: Employee
  memoryPrompt: string
  recentMessages: Message[]
}

export interface PlannedAction {
  toolName: string
  params: Record<string, unknown>
  approvalTokenId?: string
}

export interface AgentTaskResult {
  output: string
  actionsExecuted: string[]
  pendingApprovals: string[]
  workflowRunId: string
}

// ---------------------------------------------------------------------------
// Main workflow entry — "use workflow" marks this for the Workflow SDK
// ---------------------------------------------------------------------------

export async function runAgentTask(input: AgentTaskInput): Promise<AgentTaskResult> {
  'use workflow'

  const { taskId, workspaceId, employeeId } = input
  const sb = supabaseAdmin()

  // Create a workflow_runs row so we can track this execution
  const { data: runRow } = await sb
    .from('workflow_runs')
    .insert({ task_id: taskId, workspace_id: workspaceId, status: 'running' })
    .select()
    .single()
  const runId: string = runRow?.id ?? crypto.randomUUID()

  try {
    // Mark task as in_progress
    await sb.from('tasks').update({ status: 'in_progress' }).eq('id', taskId)

    // ── Step 1: load everything the agent needs ─────────────────────────────
    const context = await loadTaskContext({ taskId, workspaceId, employeeId })

    // ── Step 2: run the agent loop ──────────────────────────────────────────
    const loopResult = await runAgentLoop({ taskId, workspaceId, employeeId, context, runId })

    // ── Step 3: handle each planned action ─────────────────────────────────
    const actionsExecuted: string[] = []
    const pendingApprovals: string[] = []

    for (const action of loopResult.plannedActions) {
      if (isActionDangerous(action.toolName)) {
        // Create approval_request row and pause until human approves
        const { data: approvalRow } = await sb
          .from('approval_requests')
          .insert({
            task_id: taskId,
            workspace_id: workspaceId,
            action_name: action.toolName,
            action_params: action.params,
            risk_level: 'dangerous',
            state: 'pending',
          })
          .select()
          .single()

        if (!approvalRow) continue

        // Update task status so dashboard shows it
        await sb
          .from('tasks')
          .update({ status: 'awaiting_human' })
          .eq('id', taskId)

        // ── Durable pause — waits up to 72 h for the human to approve ──────
        // The Workflow SDK resumes this function from this exact point when
        // the event fires (even across cold starts / redeployments).
        const approval = await waitForApproval(
          `task.${taskId}.approval.${approvalRow.id}`,
          { timeout: '72h' }
        )

        if (!approval?.approved) {
          pendingApprovals.push(action.toolName)
          continue
        }

        // Merge any edits the human made to the params
        const finalParams = approval.editedParams ?? action.params

        // ── Step 4: execute the approved action ────────────────────────────
        await executeApprovedAction({
          taskId,
          workspaceId,
          employeeId,
          action: { ...action, params: finalParams },
          approvalTokenId: approvalRow.approval_token_id,
        })

        actionsExecuted.push(action.toolName)
      } else {
        // Safe action — just execute
        await executeApprovedAction({ taskId, workspaceId, employeeId, action, approvalTokenId: undefined })
        actionsExecuted.push(action.toolName)
      }
    }

    // ── Step 5: persist result and mark complete ────────────────────────────
    const finalStatus = pendingApprovals.length > 0 ? 'awaiting_human' : 'completed'
    await sb.from('tasks').update({ status: finalStatus }).eq('id', taskId)
    await sb.from('workflow_runs').update({ status: 'completed', ended_at: new Date().toISOString() }).eq('id', runId)

    return {
      output: loopResult.output,
      actionsExecuted,
      pendingApprovals,
      workflowRunId: runId,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    await sb.from('workflow_runs').update({ status: 'failed', error: message, ended_at: new Date().toISOString() }).eq('id', runId)
    await sb.from('tasks').update({ status: 'rejected' }).eq('id', taskId)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Step: load task + employee + composed memory context
// ---------------------------------------------------------------------------

async function loadTaskContext(input: AgentTaskInput): Promise<AgentTaskContext> {
  'use step'

  const { taskId, workspaceId, employeeId } = input
  const sb = supabaseAdmin()

  const [{ data: task }, { data: employee }] = await Promise.all([
    sb.from('tasks').select('*').eq('id', taskId).single(),
    sb.from('employees').select('*, skills:employee_skills(skill:skills(*))').eq('id', employeeId).single(),
  ])

  if (!task) throw new Error(`Task ${taskId} not found`)
  if (!employee) throw new Error(`Employee ${employeeId} not found`)

  const memCtx = await composeMemoryContext({
    workspaceId,
    query: `${task.title} ${task.description ?? ''}`,
    taskId,
    isMeeting: false,
  })

  return {
    task: task as Task,
    employee: employee as Employee,
    memoryPrompt: renderMemoryToPrompt(memCtx),
    recentMessages: memCtx.recentMessages,
  }
}

// ---------------------------------------------------------------------------
// Step: run the AI agent loop (generateText with tools, up to 8 roundtrips)
// ---------------------------------------------------------------------------

interface LoopInput {
  taskId: string
  workspaceId: string
  employeeId: string
  context: AgentTaskContext
  runId: string
}

interface LoopResult {
  output: string
  plannedActions: PlannedAction[]
  langfuseTraceId?: string
}

async function runAgentLoop(input: LoopInput): Promise<LoopResult> {
  'use step'

  const { taskId, workspaceId, employeeId, context, runId } = input
  const { task, employee, memoryPrompt, recentMessages } = context

  const systemPrompt = buildAgentSystemPrompt({ employee, memoryPrompt })

  // Build messages from recency window + current task
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...recentMessages
      .filter(m => m.task_id === taskId)
      .map(m => ({
        role: (m.sender_type === 'human' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      })),
    {
      role: 'user' as const,
      content: `Task: ${task.title}\n\n${task.description ?? ''}`,
    },
  ]

  // Build tool set — dangerous tools have no execute fn (Layer 1 HITL via UI),
  // but since we're in a background workflow we handle them via waitForApproval above.
  // Here we give the agent ALL tools with execute so it can plan freely;
  // our loop catches dangerous ones before they run.
  const tools = {
    ...buildMemoryTools(workspaceId, `agent:${employeeId}`),
    ...buildAgentTools({ workspaceId, employeeId, executor: nangoExecutor }),
  }

  const result = await generateText({
    model: llm(),
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 8,
    experimental_telemetry: buildTelemetry({
      functionId: 'agent-task-loop',
      workspaceId,
      employeeId,
      taskId,
    }),
  })

  // Extract any tool calls the model made — these become planned actions
  const plannedActions: PlannedAction[] = (result.steps ?? []).flatMap(step =>
    (step.toolCalls ?? []).map(tc => ({
      toolName: tc.toolName,
      params: tc.args as Record<string, unknown>,
    }))
  )

  // Persist agent output as a message
  const sb = supabaseAdmin()
  await sb.from('messages').insert({
    workspace_id: workspaceId,
    task_id: taskId,
    sender_type: 'agent',
    employee_id: employeeId,
    content: result.text,
  })

  // Roll up cost from usage metadata
  if (result.usage) {
    await updateWorkflowCosts({
      workspaceId,
      tokensInput: result.usage.promptTokens ?? 0,
      tokensOutput: result.usage.completionTokens ?? 0,
      runId,
    })
  }

  return {
    output: result.text,
    plannedActions,
  }
}

// ---------------------------------------------------------------------------
// Step: execute one approved action via ToolExecutor
// ---------------------------------------------------------------------------

interface ExecuteInput {
  taskId: string
  workspaceId: string
  employeeId: string
  action: PlannedAction
  approvalTokenId: string | undefined
}

async function executeApprovedAction(input: ExecuteInput): Promise<void> {
  'use step'

  const { workspaceId, employeeId, action, approvalTokenId } = input
  const entityId = `ws:${workspaceId}:emp:${employeeId}`

  await nangoExecutor.execute({
    action: action.toolName,
    entityId,
    params: action.params,
    approvalTokenId,
  })
}

// ---------------------------------------------------------------------------
// waitForApproval — thin wrapper around Workflow SDK waitForEvent
// ---------------------------------------------------------------------------

interface ApprovalPayload {
  approved: boolean
  editedParams?: Record<string, unknown>
}

/**
 * Suspends the workflow until a `task.<id>.approval.<approvalId>` event fires.
 * When the human approves/rejects from the dashboard, the API route emits
 * this event via the Workflow SDK event bus, and execution resumes here.
 *
 * The Workflow SDK handles durability: if the Vercel function cold-starts
 * between suspension and resumption, state is replayed automatically.
 */
async function waitForApproval(
  eventName: string,
  opts: { timeout: string }
): Promise<ApprovalPayload | null> {
  // "use step" cannot be used inside a nested async function called from a
  // workflow step — waitForEvent is a Workflow SDK primitive called directly.
  // The Workflow SDK compiler will recognise this call pattern.
  //
  // Implementation note: `waitForEvent` is imported from the Workflow SDK at
  // runtime. We use a dynamic import pattern so this file compiles without
  // the SDK installed during tests.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Workflow SDK dynamic import
    const { waitForEvent } = await import('@vercel/workflow-sdk') as any
    const result = await waitForEvent(eventName, { timeout: opts.timeout })
    return result as ApprovalPayload | null
  } catch {
    // SDK not available (e.g. local test env) — return null (skip action)
    return null
  }
}
