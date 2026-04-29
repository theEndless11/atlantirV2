/**
 * Layer 1: File-based structured memory.
 * Anthropic-style tool interface operating on the `memory_files` table.
 */
import { supabaseAdmin } from '@/lib/supabase'

// ─── Types (mirror DB shape — real type lives in @/types) ────────────────────
interface MemoryFileRow {
  id: string
  workspace_id: string
  path: string
  content: string
  updated_by: string
  updated_at: string
}

// ─── View ────────────────────────────────────────────────────────────────────

/**
 * If no path: returns the full file tree as a markdown list.
 * If path given: returns the content of that file.
 */
export async function memoryView(workspaceId: string, path?: string): Promise<string> {
  const db = supabaseAdmin()

  if (!path) {
    const { data, error } = await db
      .from('memory_files')
      .select('path')
      .eq('workspace_id', workspaceId)
      .neq('content', '[DELETED]')
      .order('path')

    if (error) throw new Error(`memoryView tree failed: ${error.message}`)
    if (!data || data.length === 0) return '_(no memory files yet)_'

    const lines = data.map((r) => `- ${r.path}`)
    return lines.join('\n')
  }

  const { data, error } = await db
    .from('memory_files')
    .select('content')
    .eq('workspace_id', workspaceId)
    .eq('path', path)
    .neq('content', '[DELETED]')
    .single()

  if (error || !data) return `_(file not found: ${path})_`
  return data.content
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function memoryCreate(
  workspaceId: string,
  path: string,
  content: string,
  updatedBy: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin()

  // Check for existing non-deleted file
  const { data: existing } = await db
    .from('memory_files')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('path', path)
    .neq('content', '[DELETED]')
    .maybeSingle()

  if (existing) {
    return { ok: false, error: `File already exists at path: ${path}` }
  }

  const { error } = await db.from('memory_files').insert({
    workspace_id: workspaceId,
    path,
    content,
    updated_by: updatedBy,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ─── Str Replace ─────────────────────────────────────────────────────────────

/**
 * Preferred edit method.
 * Fails if oldStr is not found exactly once in the file.
 */
export async function memoryStrReplace(
  workspaceId: string,
  path: string,
  oldStr: string,
  newStr: string,
  updatedBy: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin()

  const { data, error } = await db
    .from('memory_files')
    .select('id, content')
    .eq('workspace_id', workspaceId)
    .eq('path', path)
    .neq('content', '[DELETED]')
    .single()

  if (error || !data) return { ok: false, error: `File not found: ${path}` }

  const occurrences = data.content.split(oldStr).length - 1
  if (occurrences === 0) return { ok: false, error: `oldStr not found in file: ${path}` }
  if (occurrences > 1) {
    return {
      ok: false,
      error: `oldStr found ${occurrences} times — must match exactly once for safe replacement`,
    }
  }

  const newContent = data.content.replace(oldStr, newStr)

  const { error: updateError } = await db
    .from('memory_files')
    .update({ content: newContent, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('id', data.id)

  if (updateError) return { ok: false, error: updateError.message }
  return { ok: true }
}

// ─── Insert ──────────────────────────────────────────────────────────────────

/**
 * Inserts `content` after the given 1-indexed line number.
 * Line 0 means insert before all content.
 */
export async function memoryInsert(
  workspaceId: string,
  path: string,
  line: number,
  content: string,
  updatedBy: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin()

  const { data, error } = await db
    .from('memory_files')
    .select('id, content')
    .eq('workspace_id', workspaceId)
    .eq('path', path)
    .neq('content', '[DELETED]')
    .single()

  if (error || !data) return { ok: false, error: `File not found: ${path}` }

  const lines = data.content.split('\n')
  const insertAt = Math.max(0, Math.min(line, lines.length))
  lines.splice(insertAt, 0, content)
  const newContent = lines.join('\n')

  const { error: updateError } = await db
    .from('memory_files')
    .update({ content: newContent, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('id', data.id)

  if (updateError) return { ok: false, error: updateError.message }
  return { ok: true }
}

// ─── Rename ──────────────────────────────────────────────────────────────────

export async function memoryRename(
  workspaceId: string,
  oldPath: string,
  newPath: string,
  updatedBy: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin()

  // Ensure source exists
  const { data: source } = await db
    .from('memory_files')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('path', oldPath)
    .neq('content', '[DELETED]')
    .single()

  if (!source) return { ok: false, error: `Source file not found: ${oldPath}` }

  // Ensure destination doesn't exist
  const { data: dest } = await db
    .from('memory_files')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('path', newPath)
    .neq('content', '[DELETED]')
    .maybeSingle()

  if (dest) return { ok: false, error: `Destination path already exists: ${newPath}` }

  const { error } = await db
    .from('memory_files')
    .update({ path: newPath, updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('id', source.id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ─── Delete (soft) ───────────────────────────────────────────────────────────

/**
 * Soft-delete: sets content = '[DELETED]', keeps row for audit.
 */
export async function memoryDelete(
  workspaceId: string,
  path: string,
  updatedBy: string,
): Promise<{ ok: boolean; error?: string }> {
  const db = supabaseAdmin()

  const { data, error } = await db
    .from('memory_files')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('path', path)
    .neq('content', '[DELETED]')
    .single()

  if (error || !data) return { ok: false, error: `File not found: ${path}` }

  const { error: updateError } = await db
    .from('memory_files')
    .update({ content: '[DELETED]', updated_by: updatedBy, updated_at: new Date().toISOString() })
    .eq('id', data.id)

  if (updateError) return { ok: false, error: updateError.message }
  return { ok: true }
}

// ─── Context builder ─────────────────────────────────────────────────────────

/**
 * Returns file tree (always) + inline content of company.md and
 * preferences.md if they exist. Used to seed the agent system prompt.
 */
export async function buildFileMemoryContext(workspaceId: string): Promise<string> {
  const db = supabaseAdmin()

  const { data: files } = await db
    .from('memory_files')
    .select('path, content')
    .eq('workspace_id', workspaceId)
    .neq('content', '[DELETED]')
    .order('path')

  if (!files || files.length === 0) return '_(no memory files)_'

  const tree = files.map((f: MemoryFileRow) => `- ${f.path}`).join('\n')

  const inlineFiles = ['company.md', 'preferences.md']
  const inlineParts: string[] = []

  for (const name of inlineFiles) {
    const file = files.find((f: MemoryFileRow) => f.path === name || f.path.endsWith(`/${name}`))
    if (file) {
      inlineParts.push(`### ${file.path}\n${file.content}`)
    }
  }

  let result = `## Memory File Tree\n${tree}`
  if (inlineParts.length > 0) {
    result += `\n\n## Key Memory Files\n${inlineParts.join('\n\n')}`
  }

  return result
}
