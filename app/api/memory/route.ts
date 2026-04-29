/**
 * REST API for the Memory tab UI.
 * GET  ?workspaceId=&path=  → memoryView
 * POST { workspaceId, path, content, action }  → create / update / delete
 *
 * Auth: validates workspace membership before any read/write.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase'
import {
  memoryView,
  memoryCreate,
  memoryStrReplace,
  memoryDelete,
} from '@/lib/memory/file-tools'

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function resolveUser(req: NextRequest): Promise<{ userId: string; error?: never } | { userId?: never; error: NextResponse }> {
  const db = await supabaseServer()
  const { data: { user }, error } = await db.auth.getUser()

  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { userId: user.id }
}

async function assertWorkspaceMember(userId: string, workspaceId: string): Promise<boolean> {
  const db = supabaseAdmin()
  const { data } = await db
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()
  return !!data
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { userId, error: authError } = await resolveUser(req)
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  const path = searchParams.get('path') ?? undefined

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  const isMember = await assertWorkspaceMember(userId!, workspaceId)
  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // List mode — no path: return file metadata array for the sidebar/preview UI
    if (!path) {
      const db = supabaseAdmin()
      const { data, error } = await db
        .from('memory_files')
        .select('id, path, updated_by, updated_at')
        .eq('workspace_id', workspaceId)
        .order('path', { ascending: true })
      if (error) throw error
      return NextResponse.json({ files: data ?? [] })
    }
    const result = await memoryView(workspaceId, path)
    return NextResponse.json({ content: result })
  } catch (err) {
    console.error('[api/memory GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId, error: authError } = await resolveUser(req)
  if (authError) return authError

  let body: {
    workspaceId?: string
    path?: string
    content?: string
    action?: 'create' | 'update' | 'delete'
    oldContent?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { workspaceId, path, content, action } = body

  if (!workspaceId || !path || !action) {
    return NextResponse.json({ error: 'workspaceId, path, and action are required' }, { status: 400 })
  }

  const isMember = await assertWorkspaceMember(userId!, workspaceId)
  if (!isMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updatedBy = `user:${userId}`

  try {
    let result: { ok: boolean; error?: string }

    switch (action) {
      case 'create': {
        if (!content) {
          return NextResponse.json({ error: 'content is required for create' }, { status: 400 })
        }
        result = await memoryCreate(workspaceId, path, content, updatedBy)
        break
      }

      case 'update': {
        if (content === undefined) {
          return NextResponse.json({ error: 'content is required for update' }, { status: 400 })
        }
        // For user edits, we fetch the current content and replace it wholesale
        const currentContent = await memoryView(workspaceId, path)

        if (currentContent.startsWith('_(file not found')) {
          // File doesn't exist yet — create it
          result = await memoryCreate(workspaceId, path, content, updatedBy)
        } else {
          // Replace entire content via str_replace (full content swap)
          result = await memoryStrReplace(
            workspaceId,
            path,
            currentContent,
            content,
            updatedBy,
          )
        }
        break
      }

      case 'delete': {
        result = await memoryDelete(workspaceId, path, updatedBy)
        break
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 422 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/memory POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}