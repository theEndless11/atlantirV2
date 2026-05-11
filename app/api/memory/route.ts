import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { memoryView, memoryCreate, memoryStrReplace, memoryDelete } from '@/lib/memory/file-tools'

async function assertWorkspaceMember(userId: string, workspaceId: string) {
  const { data } = await supabaseAdmin()
    .from('workspace_members').select('id')
    .eq('workspace_id', workspaceId).eq('user_id', userId).single()
  return !!data
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspaceId')
  const path = searchParams.get('path') ?? undefined

  if (!workspaceId) return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })

  if (!path) {
    const [isMember, { data, error }] = await Promise.all([
      assertWorkspaceMember(user.id, workspaceId),
      supabaseAdmin().from('memory_files').select('id, path, updated_by, updated_at')
        .eq('workspace_id', workspaceId).order('path', { ascending: true }),
    ])
    if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (error) return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    return NextResponse.json({ files: data ?? [] })
  }

  const [isMember, result] = await Promise.all([
    assertWorkspaceMember(user.id, workspaceId),
    memoryView(workspaceId, path),
  ])
  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json({ content: result })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { workspaceId?: string; path?: string; content?: string; action?: 'create' | 'update' | 'delete'; oldContent?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const { workspaceId, path, content, action } = body
  if (!workspaceId || !path || !action)
    return NextResponse.json({ error: 'workspaceId, path, and action are required' }, { status: 400 })

  if (!await assertWorkspaceMember(user.id, workspaceId))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updatedBy = `user:${user.id}`

  try {
    let result: { ok: boolean; error?: string }
    switch (action) {
      case 'create': {
        if (!content) return NextResponse.json({ error: 'content is required for create' }, { status: 400 })
        result = await memoryCreate(workspaceId, path, content, updatedBy)
        break
      }
      case 'update': {
        if (content === undefined) return NextResponse.json({ error: 'content is required for update' }, { status: 400 })
        const currentContent = await memoryView(workspaceId, path)
        result = currentContent.startsWith('_(file not found')
          ? await memoryCreate(workspaceId, path, content, updatedBy)
          : await memoryStrReplace(workspaceId, path, currentContent, content, updatedBy)
        break
      }
      case 'delete': {
        result = await memoryDelete(workspaceId, path, updatedBy)
        break
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/memory POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
