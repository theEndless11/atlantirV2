import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

async function assertMember(workspaceId: string, userId: string) {
  const { data } = await supabaseAdmin()
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()
  return !!data
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  const [isMember, { data, error }] = await Promise.all([
    assertMember(workspaceId, user.id),
    supabaseAdmin().from('skills').select('*').eq('workspace_id', workspaceId).order('name', { ascending: true }),
  ])

  if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { workspaceId: string; name: string; description?: string; prompt_guidance?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { workspaceId, name, description, prompt_guidance } = body
  if (!workspaceId || !name?.trim())
    return NextResponse.json({ error: 'workspaceId and name required' }, { status: 400 })

  if (!await assertMember(workspaceId, user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin()
    .from('skills')
    .insert({ workspace_id: workspaceId, name: name.trim(), description, prompt_guidance })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id: string; workspaceId: string; name?: string; description?: string; prompt_guidance?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { id, workspaceId, ...updates } = body
  if (!id || !workspaceId)
    return NextResponse.json({ error: 'id and workspaceId required' }, { status: 400 })

  if (!await assertMember(workspaceId, user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin()
    .from('skills')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!id || !workspaceId)
    return NextResponse.json({ error: 'id and workspaceId required' }, { status: 400 })

  if (!await assertMember(workspaceId, user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabaseAdmin().from('skills').delete().eq('id', id).eq('workspace_id', workspaceId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
