import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

type EmployeeUpdate = {
  name?: string
  avatar_url?: string
  system_prompt?: string
}

async function assertMember(workspaceId: string, userId: string) {
  const { data, error } = await supabaseAdmin()
    .from('workspace_members')
    .select('id, role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()

  if (error) return null
  return data
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')

  if (!workspaceId) {
    return NextResponse.json(
      { error: 'workspaceId required' },
      { status: 400 }
    )
  }

  const [member, employeesResult] = await Promise.all([
    assertMember(workspaceId, user.id),

    supabaseAdmin()
      .from('employees')
      .select('*, skills:employee_skills(skill:skills(*))')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true }),
  ])

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (employeesResult.error) {
    return NextResponse.json(
      { error: employeesResult.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json(employeesResult.data ?? [])
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    workspaceId: string
    name: string
    avatar_url?: string
    system_prompt?: string
    skill_ids?: string[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    workspaceId,
    name,
    avatar_url,
    system_prompt,
    skill_ids = [],
  } = body

  const trimmedName = name?.trim()

  if (!workspaceId || !trimmedName) {
    return NextResponse.json(
      { error: 'workspaceId and name are required' },
      { status: 400 }
    )
  }

  const member = await assertMember(workspaceId, user.id)

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sb = supabaseAdmin()

  const { data: employee, error: employeeError } = await sb
    .from('employees')
    .insert({
      workspace_id: workspaceId,
      name: trimmedName,
      avatar_url,
      system_prompt,
    })
    .select()
    .single()

  if (employeeError || !employee) {
    return NextResponse.json(
      {
        error: employeeError?.message ?? 'Failed to create employee',
      },
      { status: 500 }
    )
  }

  if (skill_ids.length > 0) {
    const { error: skillError } = await sb
      .from('employee_skills')
      .insert(
        skill_ids.map(skill_id => ({
          employee_id: employee.id,
          skill_id,
        }))
      )

    if (skillError) {
      return NextResponse.json(
        { error: skillError.message },
        { status: 500 }
      )
    }
  }

  const { data: fullEmployee, error: fullError } = await sb
    .from('employees')
    .select('*, skills:employee_skills(skill:skills(*))')
    .eq('id', employee.id)
    .single()

  if (fullError) {
    return NextResponse.json(
      { error: fullError.message },
      { status: 500 }
    )
  }

  return NextResponse.json(fullEmployee, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    id: string
    workspaceId: string
    name?: string
    avatar_url?: string
    system_prompt?: string
    skill_ids?: string[]
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    id,
    workspaceId,
    name,
    avatar_url,
    system_prompt,
    skill_ids,
  } = body

  if (!id || !workspaceId) {
    return NextResponse.json(
      { error: 'id and workspaceId are required' },
      { status: 400 }
    )
  }

  const member = await assertMember(workspaceId, user.id)

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sb = supabaseAdmin()

  const { data: existing, error: existingError } = await sb
    .from('employees')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single()

  if (existingError || !existing) {
    return NextResponse.json(
      { error: 'Employee not found' },
      { status: 404 }
    )
  }

  const updates: EmployeeUpdate = {}

  if (name !== undefined) {
    const trimmedName = name.trim()

    if (!trimmedName) {
      return NextResponse.json(
        { error: 'Name cannot be empty' },
        { status: 400 }
      )
    }

    updates.name = trimmedName
  }

  if (avatar_url !== undefined) {
    updates.avatar_url = avatar_url
  }

  if (system_prompt !== undefined) {
    updates.system_prompt = system_prompt
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await sb
      .from('employees')
      .update(updates)
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }
  }

  if (skill_ids !== undefined) {
    const { error: deleteError } = await sb
      .from('employee_skills')
      .delete()
      .eq('employee_id', id)

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }

    if (skill_ids.length > 0) {
      const { error: insertError } = await sb
        .from('employee_skills')
        .insert(
          skill_ids.map(skill_id => ({
            employee_id: id,
            skill_id,
          }))
        )

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        )
      }
    }
  }

  const { data: fullEmployee, error: fullError } = await sb
    .from('employees')
    .select('*, skills:employee_skills(skill:skills(*))')
    .eq('id', id)
    .single()

  if (fullError) {
    return NextResponse.json(
      { error: fullError.message },
      { status: 500 }
    )
  }

  return NextResponse.json(fullEmployee)
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')
  const workspaceId = req.nextUrl.searchParams.get('workspaceId')

  if (!id || !workspaceId) {
    return NextResponse.json(
      { error: 'id and workspaceId required' },
      { status: 400 }
    )
  }

  const member = await assertMember(workspaceId, user.id)

  if (!member) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (member.role === 'member') {
    return NextResponse.json(
      { error: 'Admin or owner required to delete employees' },
      { status: 403 }
    )
  }

  const { data: deletedEmployee, error } = await supabaseAdmin()
    .from('employees')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }

  if (!deletedEmployee) {
    return NextResponse.json(
      { error: 'Employee not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ deleted: true })
}