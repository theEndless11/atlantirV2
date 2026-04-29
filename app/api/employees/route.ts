/**
 * app/api/employees/route.ts
 *
 * GET  /api/employees?workspaceId=   — list employees with their skills
 * POST /api/employees                — create a new employee
 * PATCH /api/employees               — update an employee (name, avatar, system_prompt, skills)
 * DELETE /api/employees?id=&workspaceId= — delete an employee
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
    .select('id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()
  return data
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { data: { user } } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })

  if (!await assertMember(workspaceId, user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('employees')
    .select('*, skills:employee_skills(skill:skills(*))')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { data: { user } } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    workspaceId: string
    name: string
    avatar_url?: string
    system_prompt?: string
    skill_ids?: string[]
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { workspaceId, name, avatar_url, system_prompt, skill_ids = [] } = body
  if (!workspaceId || !name?.trim())
    return NextResponse.json({ error: 'workspaceId and name are required' }, { status: 400 })

  if (!await assertMember(workspaceId, user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = supabaseAdmin()

  const { data: employee, error: empError } = await sb
    .from('employees')
    .insert({ workspace_id: workspaceId, name: name.trim(), avatar_url, system_prompt })
    .select()
    .single()

  if (empError || !employee)
    return NextResponse.json({ error: empError?.message ?? 'Failed to create employee' }, { status: 500 })

  // Attach skills
  if (skill_ids.length > 0) {
    await sb.from('employee_skills').insert(
      skill_ids.map(skill_id => ({ employee_id: employee.id, skill_id }))
    )
  }

  // Re-fetch with skills joined
  const { data: full } = await sb
    .from('employees')
    .select('*, skills:employee_skills(skill:skills(*))')
    .eq('id', employee.id)
    .single()

  return NextResponse.json(full, { status: 201 })
}

// ── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const { data: { user } } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    id: string
    workspaceId: string
    name?: string
    avatar_url?: string
    system_prompt?: string
    skill_ids?: string[]
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { id, workspaceId, name, avatar_url, system_prompt, skill_ids } = body
  if (!id || !workspaceId)
    return NextResponse.json({ error: 'id and workspaceId are required' }, { status: 400 })

  if (!await assertMember(workspaceId, user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = supabaseAdmin()

  // Verify employee belongs to workspace
  const { data: existing } = await sb
    .from('employees')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single()
  if (!existing) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  // Update fields
  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name.trim()
  if (avatar_url !== undefined) updates.avatar_url = avatar_url
  if (system_prompt !== undefined) updates.system_prompt = system_prompt

  if (Object.keys(updates).length > 0) {
    await sb.from('employees').update(updates).eq('id', id)
  }

  // Replace skills if provided
  if (skill_ids !== undefined) {
    await sb.from('employee_skills').delete().eq('employee_id', id)
    if (skill_ids.length > 0) {
      await sb.from('employee_skills').insert(
        skill_ids.map(skill_id => ({ employee_id: id, skill_id }))
      )
    }
  }

  const { data: full } = await sb
    .from('employees')
    .select('*, skills:employee_skills(skill:skills(*))')
    .eq('id', id)
    .single()

  return NextResponse.json(full)
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const { data: { user } } = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!id || !workspaceId)
    return NextResponse.json({ error: 'id and workspaceId required' }, { status: 400 })

  const member = await assertMember(workspaceId, user.id)
  if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (member.role === 'member')
    return NextResponse.json({ error: 'Admin or owner required to delete employees' }, { status: 403 })

  const sb = supabaseAdmin()
  const { error } = await sb
    .from('employees')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: true })
}
