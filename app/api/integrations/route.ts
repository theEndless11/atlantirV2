import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const SECRET_KEYS = new Set(['app_password','api_key','token','auth_token','api_token','access_token','webhook_url','oauth_token','secret_key','routing_key','account_sid'])

function maskSecret(value: string): string {
  if (!value || value.length < 4) return '••••'
  return '••••' + value.slice(-4)
}

function stripSecrets(config: Record<string, any>): Record<string, string> {
  return Object.fromEntries(Object.entries(config).map(([k, v]) => SECRET_KEYS.has(k) ? [k, maskSecret(String(v))] : [k, v]))
}

function isMasked(value: string): boolean {
  return typeof value === 'string' && value.startsWith('••••')
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data } = await sb.from('integrations').select('type,status,config,id,employee_id').eq('workspace_id', workspaceId)
  return NextResponse.json((data || []).map(i => ({
    type: i.type, status: i.status,
    config: i.config ? stripSecrets(i.config as Record<string, any>) : {},
    id: i.id,
    employee_id: i.employee_id ?? null,
  })))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { workspace_id, type, config, status, employee_id } = body
  if (!workspace_id || !type) return NextResponse.json({ error: 'workspace_id and type required' }, { status: 400 })

  const sb = supabaseAdmin()

  // Build conflict key: OAuth integrations are per-employee, API key integrations are per-workspace
  const conflictColumns = employee_id ? 'workspace_id,type,employee_id' : 'workspace_id,type'

  // Fetch existing config to merge (avoid overwriting with masked values)
  let existingQuery = sb.from('integrations').select('config').eq('workspace_id', workspace_id).eq('type', type)
  if (employee_id) existingQuery = existingQuery.eq('employee_id', employee_id)
  const { data: existing } = await existingQuery.single()

  const existingConfig: Record<string, string> = (existing?.config as any) || {}
  const incomingConfig: Record<string, string> = config || {}
  const mergedConfig = { ...existingConfig }
  for (const [k, v] of Object.entries(incomingConfig)) {
    if (!isMasked(v as string)) mergedConfig[k] = v as string
  }

  const upsertData: Record<string, any> = {
    workspace_id, type, status: status || 'connected', config: mergedConfig,
    updated_at: new Date().toISOString(),
  }
  if (employee_id) upsertData.employee_id = employee_id

  const { data, error } = await sb.from('integrations').upsert(upsertData, { onConflict: conflictColumns }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, type: data.type, status: data.status })
}