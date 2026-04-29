/**
 * lib/workflow/events.ts
 *
 * Thin wrapper around the Workflow SDK event bus.
 * Called by the approvals API route when a human approves/rejects an action,
 * which resumes the paused waitForApproval() call in agent-task.ts.
 */

export interface ApprovalEventPayload {
  approved: boolean
  editedParams?: Record<string, unknown>
  reviewedBy: string
}

/**
 * Emit an approval decision event that resumes a suspended workflow task.
 * Called from: app/api/approvals/route.ts
 */
export async function emitApprovalEvent(
  taskId: string,
  approvalId: string,
  payload: ApprovalEventPayload
): Promise<void> {
  const eventName = `task.${taskId}.approval.${approvalId}`

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Workflow SDK dynamic import
    const { sendEvent } = await import('@vercel/workflow-sdk') as any
    await sendEvent(eventName, payload)
  } catch {
    // Workflow SDK not available (local dev without Vercel) — log and continue.
    // The approval row is already marked approved in DB; the task will be
    // picked up on the next poll cycle by the dashboard.
    console.warn(`[workflow/events] Could not emit event ${eventName} — Workflow SDK unavailable`)
  }
}

/**
 * Trigger a new agent task workflow run.
 * Called from: app/api/tasks/run/route.ts
 */
export async function triggerAgentTask(input: {
  taskId: string
  workspaceId: string
  employeeId: string
}): Promise<{ runId: string }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { trigger } = await import('@vercel/workflow-sdk') as any
    const result = await trigger('/api/workflow/agent-task', input)
    return { runId: result?.runId ?? 'local' }
  } catch {
    // Fallback: run inline without durability (dev mode)
    const { runAgentTask } = await import('./agent-task')
    const result = await runAgentTask(input)
    return { runId: result.workflowRunId }
  }
}
