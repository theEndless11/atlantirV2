import { NextRequest, NextResponse } from 'next/server'
import { nangoExecutor } from '@/lib/tool-executor/nango-executor'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const { workspaceId, employeeId, app, redirectUrl, scopes } = body as {
    workspaceId?: string; employeeId?: string; app?: string
    redirectUrl?: string; scopes?: string[]
  }

  if (!workspaceId || !employeeId || !app || !redirectUrl) {
    return NextResponse.json({ error: 'workspaceId, employeeId, app, and redirectUrl are required' }, { status: 400 })
  }

  const sbUser = await supabaseServer()
  const { data: { user } } = await sbUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = supabaseAdmin()
  const { data: membership } = await sb
    .from('workspace_members').select('id')
    .eq('workspace_id', workspaceId).eq('user_id', user.id).single()
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const entityId = `ws:${workspaceId}:emp:${employeeId}`
    const { redirectUrl: oauthRedirectUrl, connectionId, sessionToken } = await nangoExecutor.initiateOAuth({
      app, entityId, redirectUrl, scopes,
    })
    return NextResponse.json({ redirectUrl: oauthRedirectUrl, connectionId, sessionToken })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[oauth POST]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}