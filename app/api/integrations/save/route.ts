import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

function isMasked(value: string): boolean {
  return typeof value === 'string' && value.startsWith('••••')
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { workspace_id, type, config, status } = body

  if (!workspace_id || !type) {
    return NextResponse.json({ error: 'workspace_id and type required' }, { status: 400 })
  }

  const { data: existing } = await sb
    .from('integrations').select('config')
    .eq('workspace_id', workspace_id).eq('type', type).single()

  const existingConfig: Record<string, string> = (existing?.config as any) || {}
  const incomingConfig: Record<string, string> = config || {}

  const mergedConfig = { ...existingConfig }
  for (const [k, v] of Object.entries(incomingConfig)) {
    if (!isMasked(v as string)) mergedConfig[k] = v as string
  }

  const { data, error } = await sb
    .from('integrations')
    .upsert({ workspace_id, type, status: status || 'connected', config: mergedConfig, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id,type' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, type: data.type, status: data.status })
}
