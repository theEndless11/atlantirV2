/**
 * app/api/skills/route.ts
 *
 * GET  /api/skills?workspaceId=  — list skills
 * POST /api/skills               — create a skill
 * PATCH /api/skills              — update a skill
 * DELETE /api/skills?id=&workspaceId= — delete
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  return supabase.auth.getUser()
}

async function assertMember(workspaceId: string, userId: string) {
  const sb = supabaseAdmin()
  const { data } = await sb
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()
  return !!data
}

export async function GET(req: NextRequest) {
  const { data: { user } } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  if (!await assertMember(workspaceId, user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('skills')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const { data: { user } } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { workspaceId: string; name: string; description?: string; prompt_guidance?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { workspaceId, name, description, prompt_guidance } = body
  if (!workspaceId || !name?.trim())
    return NextResponse.json({ error: 'workspaceId and name required' }, { status: 400 })

  if (!await assertMember(workspaceId, user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('skills')
    .insert({ workspace_id: workspaceId, name: name.trim(), description, prompt_guidance })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { data: { user } } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id: string; workspaceId: string; name?: string; description?: string; prompt_guidance?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { id, workspaceId, ...updates } = body
  if (!id || !workspaceId)
    return NextResponse.json({ error: 'id and workspaceId required' }, { status: 400 })

  if (!await assertMember(workspaceId, user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = supabaseAdmin()
  const { data, error } = await sb
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
  const { data: { user } } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!id || !workspaceId)
    return NextResponse.json({ error: 'id and workspaceId required' }, { status: 400 })

  if (!await assertMember(workspaceId, user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = supabaseAdmin()
  const { error } = await sb
    .from('skills')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
