import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const body = await req.json()
  const { task_id, assigned_agent, approved_by } = body
  if (!task_id) return NextResponse.json({ error: 'task_id required' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data, error } = await sb.from('tasks').update({
    status: 'approved',
    assigned_agent,
    approved_by,
    approved_at: new Date().toISOString(),
  }).eq('id', task_id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
