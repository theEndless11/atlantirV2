import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const workflow_id = searchParams.get('workflow_id')
  const limit = Number(searchParams.get('limit') || '5')
  if (!workflow_id) return NextResponse.json({ error: 'workflow_id required' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data } = await sb.from('workflow_runs').select('*')
    .eq('workflow_id', workflow_id).order('created_at', { ascending: false }).limit(limit)
  return NextResponse.json(data || [])
}
