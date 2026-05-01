import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const { workspace_id, type, employee_id } = await req.json()
  if (!workspace_id || !type) return NextResponse.json({ error: 'workspace_id and type required' }, { status: 400 })
  const sb = supabaseAdmin()
  let query = sb.from('integrations').update({ status: 'disconnected', config: {} })
    .eq('workspace_id', workspace_id).eq('type', type)
  if (employee_id) query = query.eq('employee_id', employee_id)
  await query
  return NextResponse.json({ success: true })
}