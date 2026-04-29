/**
 * lib/artifacts/index.ts
 *
 * Artifact system — spec §14.6.
 * Artifacts are first-class generated work products with type, renderer, and lifecycle.
 * Lifecycle: draft → reviewed → approved → executed
 *
 * This file handles:
 * - Creating artifact rows in Postgres
 * - Streaming artifact generation via AI SDK streamObject
 * - State transitions (mark reviewed, approve, execute, version)
 * - Type-safe content access
 */

import { streamObject, generateObject } from 'ai'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { llm, buildTelemetry } from '@/lib/llm/client'
import type { Artifact } from '@/types'

// ---------------------------------------------------------------------------
// Zod schemas for each artifact content type
// (mirrors the Artifact discriminated union in types/index.ts)
// ---------------------------------------------------------------------------

export const DocumentContentSchema = z.object({
  markdown: z.string(),
})

export const EmailContentSchema = z.object({
  subject: z.string(),
  body_mjml: z.string(),
  to: z.array(z.string().email()),
  cc: z.array(z.string().email()).optional(),
})

export const ChartContentSchema = z.object({
  chartType: z.enum(['bar', 'line', 'area', 'donut', 'scatter']),
  title: z.string(),
  data: z.array(z.record(z.unknown())),
  categories: z.array(z.string()),
  index: z.string(),
  colors: z.array(z.string()).optional(),
})

export const CodeContentSchema = z.object({
  language: z.string(),
  files: z.record(z.string()),
})

export const SlidesContentSchema = z.object({
  theme: z.string().optional(),
  slides: z.array(
    z.object({
      title: z.string(),
      content: z.string(),
      notes: z.string().optional(),
    })
  ),
})

export const VideoContentSchema = z.object({
  remotionPropsJSON: z.string(),
  compositionId: z.string(),
})

// ---------------------------------------------------------------------------
// Artifact type → renderer mapping
// ---------------------------------------------------------------------------

export const ARTIFACT_RENDERERS: Record<Artifact['type'], string> = {
  document: 'markdown',
  email: 'react-email',
  video: 'remotion',
  chart: 'tremor',
  code: 'e2b',
  slides: 'spectacle',
}

// ---------------------------------------------------------------------------
// Create an artifact row (draft state)
// ---------------------------------------------------------------------------

export async function createArtifact(opts: {
  workspaceId: string
  taskId?: string
  employeeId?: string
  type: Artifact['type']
  title: string
  content: Record<string, unknown>
  createdBy: string
}): Promise<Artifact> {
  const sb = supabaseAdmin()

  const { data, error } = await sb
    .from('artifacts')
    .insert({
      workspace_id: opts.workspaceId,
      task_id: opts.taskId ?? null,
      employee_id: opts.employeeId ?? null,
      type: opts.type,
      title: opts.title,
      content: opts.content,
      renderer: ARTIFACT_RENDERERS[opts.type],
      state: 'draft',
      version: 1,
      created_by: opts.createdBy,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create artifact: ${error.message}`)
  return data as Artifact
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

export async function markArtifactReviewed(artifactId: string): Promise<void> {
  const sb = supabaseAdmin()
  await sb.from('artifacts').update({ state: 'reviewed', updated_at: new Date().toISOString() }).eq('id', artifactId)
}

export async function approveArtifact(artifactId: string): Promise<void> {
  const sb = supabaseAdmin()
  await sb.from('artifacts').update({ state: 'approved', updated_at: new Date().toISOString() }).eq('id', artifactId)
}

export async function markArtifactExecuted(artifactId: string): Promise<void> {
  const sb = supabaseAdmin()
  await sb.from('artifacts').update({ state: 'executed', updated_at: new Date().toISOString() }).eq('id', artifactId)
}

/**
 * Create a new version of an artifact (freezes current, creates child).
 * Called when the user edits an approved/executed artifact.
 */
export async function versionArtifact(opts: {
  parentId: string
  content: Record<string, unknown>
  updatedBy: string
}): Promise<Artifact> {
  const sb = supabaseAdmin()

  const { data: parent } = await sb.from('artifacts').select('*').eq('id', opts.parentId).single()
  if (!parent) throw new Error(`Parent artifact ${opts.parentId} not found`)

  const { data, error } = await sb
    .from('artifacts')
    .insert({
      workspace_id: parent.workspace_id,
      task_id: parent.task_id,
      employee_id: parent.employee_id,
      type: parent.type,
      title: parent.title,
      content: opts.content,
      renderer: parent.renderer,
      state: 'draft',
      version: (parent.version ?? 1) + 1,
      parent_id: opts.parentId,
      created_by: opts.updatedBy,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to version artifact: ${error.message}`)
  return data as Artifact
}

// ---------------------------------------------------------------------------
// Generate a document artifact (streaming)
// ---------------------------------------------------------------------------

/**
 * Stream-generate a document artifact. The caller pipes the stream to the
 * client via a streaming Response; the artifact row is saved when complete.
 */
export async function generateDocumentArtifact(opts: {
  workspaceId: string
  taskId?: string
  employeeId: string
  title: string
  prompt: string
  systemPrompt: string
}): Promise<{ artifact: Artifact; stream: ReturnType<typeof streamObject> }> {
  const stream = streamObject({
    model: llm(),
    system: opts.systemPrompt,
    prompt: opts.prompt,
    schema: DocumentContentSchema,
    experimental_telemetry: buildTelemetry({
      functionId: 'artifact-generate-document',
      workspaceId: opts.workspaceId,
      employeeId: opts.employeeId,
      taskId: opts.taskId,
    }),
  })

  // Await full object to persist (non-blocking relative to stream)
  const fullObject = await stream.object

  const artifact = await createArtifact({
    workspaceId: opts.workspaceId,
    taskId: opts.taskId,
    employeeId: opts.employeeId,
    type: 'document',
    title: opts.title,
    content: fullObject as Record<string, unknown>,
    createdBy: `agent:${opts.employeeId}`,
  })

  return { artifact, stream }
}

/**
 * Generate an email artifact (non-streaming — emails are short enough).
 */
export async function generateEmailArtifact(opts: {
  workspaceId: string
  taskId?: string
  employeeId: string
  title: string
  prompt: string
  systemPrompt: string
}): Promise<Artifact> {
  const { object } = await generateObject({
    model: llm(),
    system: opts.systemPrompt,
    prompt: opts.prompt,
    schema: EmailContentSchema,
    experimental_telemetry: buildTelemetry({
      functionId: 'artifact-generate-email',
      workspaceId: opts.workspaceId,
      employeeId: opts.employeeId,
      taskId: opts.taskId,
    }),
  })

  return createArtifact({
    workspaceId: opts.workspaceId,
    taskId: opts.taskId,
    employeeId: opts.employeeId,
    type: 'email',
    title: opts.title,
    content: object as Record<string, unknown>,
    createdBy: `agent:${opts.employeeId}`,
  })
}

/**
 * Generate a chart artifact.
 */
export async function generateChartArtifact(opts: {
  workspaceId: string
  taskId?: string
  employeeId: string
  title: string
  prompt: string
  systemPrompt: string
}): Promise<Artifact> {
  const { object } = await generateObject({
    model: llm(),
    system: opts.systemPrompt,
    prompt: opts.prompt,
    schema: ChartContentSchema,
    experimental_telemetry: buildTelemetry({
      functionId: 'artifact-generate-chart',
      workspaceId: opts.workspaceId,
      employeeId: opts.employeeId,
      taskId: opts.taskId,
    }),
  })

  return createArtifact({
    workspaceId: opts.workspaceId,
    taskId: opts.taskId,
    employeeId: opts.employeeId,
    type: 'chart',
    title: opts.title,
    content: object as Record<string, unknown>,
    createdBy: `agent:${opts.employeeId}`,
  })
}

// ---------------------------------------------------------------------------
// Fetch artifacts for a task
// ---------------------------------------------------------------------------

export async function getTaskArtifacts(taskId: string): Promise<Artifact[]> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('artifacts')
    .select('*')
    .eq('task_id', taskId)
    .order('version', { ascending: true })

  if (error) throw new Error(`Failed to fetch artifacts: ${error.message}`)
  return (data ?? []) as Artifact[]
}

export async function getArtifact(artifactId: string): Promise<Artifact | null> {
  const sb = supabaseAdmin()
  const { data } = await sb.from('artifacts').select('*').eq('id', artifactId).single()
  return data as Artifact | null
}
