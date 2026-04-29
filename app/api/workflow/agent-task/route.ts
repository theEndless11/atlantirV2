/**
 * app/api/workflow/agent-task/route.ts
 *
 * Vercel Workflow SDK endpoint. Vercel calls this route to execute and resume
 * durable workflow runs. Do NOT call this directly — use triggerAgentTask()
 * from lib/workflow/events.ts instead.
 */

import { NextResponse } from 'next/server'
import { runAgentTask } from '@/lib/workflow/agent-task'
import type { AgentTaskInput } from '@/lib/workflow/agent-task'

export async function POST(req: Request) {
  let body: AgentTaskInput

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { taskId, workspaceId, employeeId } = body
  if (!taskId || !workspaceId || !employeeId) {
    return NextResponse.json({ error: 'taskId, workspaceId, and employeeId are required' }, { status: 400 })
  }

  try {
    const result = await runAgentTask({ taskId, workspaceId, employeeId })
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
