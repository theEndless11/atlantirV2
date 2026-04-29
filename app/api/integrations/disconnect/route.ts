import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const { workspace_id, type } = await req.json()
  if (!workspace_id || !type) return NextResponse.json({ error: 'workspace_id and type required' }, { status: 400 })
  await supabaseAdmin().from('integrations').update({ status: 'disconnected', config: {} })
    .eq('workspace_id', workspace_id).eq('type', type)
  return NextResponse.json({ success: true })
}
