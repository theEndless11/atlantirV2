/**
 * lib/artifacts/datagrid.ts
 *
 * Helpers for creating and versioning DataGrid artifacts.
 * Import and use these alongside the existing functions in lib/artifacts/index.ts
 */

import { z } from 'zod'
import { generateObject } from 'ai'
import { supabaseAdmin } from '@/lib/supabase'
import { llm, buildTelemetry } from '@/lib/llm/client'
import { createArtifact } from './index'
import type { DataGridArtifact, DataGridContent } from '@/types'

// ── Zod schema (matches DataGridContent) ──

export const DataGridContentSchema = z.object({
  headers:      z.array(z.string()),
  rows:         z.array(z.array(z.string())),
  columnWidths: z.array(z.number()).optional(),
  title:        z.string().optional(),
  sourceFile:   z.string().optional(),
})

// ── ARTIFACT_RENDERERS entry (add to the map in lib/artifacts/index.ts) ──────
// datagrid: 'datagrid'

// ── Create a blank datagrid artifact ──────

export async function createDataGridArtifact(opts: {
  workspaceId: string
  taskId?: string
  employeeId?: string
  title: string
  content: DataGridContent
  createdBy: string
}): Promise<DataGridArtifact> {
  return createArtifact({
    ...opts,
    type: 'datagrid',
    content: opts.content as Record<string, unknown>,
  }) as Promise<DataGridArtifact>
}

// ── Parse a CSV string into DataGridContent 

export function parseCsvToDataGrid(csv: string, title?: string): DataGridContent {
  const lines = csv
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)

  if (lines.length === 0) return { headers: [], rows: [], title }

  function parseLine(line: string): string[] {
    const cells: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"' && !inQ) { inQ = true; continue }
      if (ch === '"' && inQ) {
        if (line[i + 1] === '"') { cur += '"'; i++; continue }
        inQ = false; continue
      }
      if (ch === ',' && !inQ) { cells.push(cur); cur = ''; continue }
      cur += ch
    }
    cells.push(cur)
    return cells
  }

  const headers = parseLine(lines[0])
  const rows    = lines.slice(1).map(parseLine)

  return { headers, rows, title }
}

// ── AI-generate a datagrid from a natural language description 

export async function generateDataGridArtifact(opts: {
  workspaceId: string
  taskId?: string
  employeeId: string
  title: string
  prompt: string
  systemPrompt: string
}): Promise<DataGridArtifact> {
  const { object } = await generateObject({
    model: llm(),
    system: opts.systemPrompt,
    prompt: opts.prompt,
    schema: DataGridContentSchema,
    experimental_telemetry: buildTelemetry({
      functionId: 'artifact-generate-datagrid',
      workspaceId: opts.workspaceId,
      employeeId: opts.employeeId,
      taskId: opts.taskId,
    }),
  })

  return createArtifact({
    workspaceId: opts.workspaceId,
    taskId: opts.taskId,
    employeeId: opts.employeeId,
    type: 'datagrid',
    title: opts.title,
    content: object as Record<string, unknown>,
    createdBy: `agent:${opts.employeeId}`,
  }) as Promise<DataGridArtifact>
}

export async function updateDataGridContent(
  artifactId: string,
  content: DataGridContent
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('artifacts')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', artifactId)
  if (error) throw new Error(`Failed to update datagrid: ${error.message}`)
}