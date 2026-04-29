import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { runPipeline } from '@/lib/agents/pipeline'
import type { Task } from '@/types'

function injectVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`)
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workflow_id, triggered_by = 'manual', variables = {}, context = '' } = body
  if (!workflow_id) return NextResponse.json({ error: 'workflow_id required' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data: workflow } = await sb.from('workflows').select('*').eq('id', workflow_id).single()
  if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })

  const { data: run } = await sb.from('workflow_runs').insert({
    workflow_id, workspace_id: workflow.workspace_id,
    status: 'running', triggered_by, variables,
  }).select().single()

  const steps = workflow.steps as any[]
  const createdTasks: any[] = []
  let previousOutput = context

  for (const step of steps) {
    const title = injectVars(step.task_title, variables)
    const baseDesc = injectVars(step.task_description || '', variables)
    const description = previousOutput
      ? `${baseDesc}\n\nContext from previous step:\n${previousOutput.slice(0, 1500)}`
      : baseDesc

    const { data: task } = await sb.from('tasks').insert({
      workspace_id: workflow.workspace_id,
      title, description,
      assigned_agent: step.agent,
      priority: step.priority || 'medium',
      status: 'approved',
      approved_at: new Date().toISOString(),
    }).select().single()

    if (!task) continue
    createdTasks.push(task)

    try {
      await sb.from('tasks').update({ status: 'in_progress' }).eq('id', task.id)
      const output = await runPipeline(task as Task)
      previousOutput = output
      await sb.from('artifacts').insert({
        workspace_id: task.workspace_id, task_id: task.id, title: task.title,
        type: task.assigned_agent === 'research' ? 'research' : task.assigned_agent === 'writer' ? 'document' : 'other',
        content: output, version: 1,
      })
      await sb.from('tasks').update({ status: 'completed' }).eq('id', task.id)
    } catch {
      await sb.from('tasks').update({ status: 'approved' }).eq('id', task.id)
      previousOutput = ''
    }
  }

  await sb.from('workflow_runs').update({
    status: 'completed', tasks_created: createdTasks.length,
    final_output: previousOutput?.slice(0, 5000) || '',
    ended_at: new Date().toISOString(),
  }).eq('id', run!.id)

  await sb.from('workflows').update({
    run_count: (workflow.run_count || 0) + 1,
    last_run_at: new Date().toISOString(),
  }).eq('id', workflow_id)

  return NextResponse.json({ tasks: createdTasks, run, final_output: previousOutput })
}
