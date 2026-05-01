import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { TOOL_REGISTRY, isActionDangerous, getToolSchema } from './registry'
import { ToolExecutorError } from './types'
import type { ToolExecutor, ToolSchema } from './types'

function nangoHost(): string {
  const host = process.env.NANGO_HOST
  if (!host) throw new ToolExecutorError('UNKNOWN', 'NANGO_HOST env var not set')
  return host.replace(/\/$/, '')
}

function nangoConnectUiUrl(): string {
  const ui = process.env.NANGO_CONNECT_UI_URL
  if (ui) return ui.replace(/\/$/, '')
  return 'https://app.nango.dev'
}

function nangoHeaders(): Record<string, string> {
  const key = process.env.NANGO_SECRET_KEY
  if (!key) throw new ToolExecutorError('UNKNOWN', 'NANGO_SECRET_KEY env var not set')
  return {
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

function parseEntityId(entityId: string): { workspaceId: string; employeeId: string } {
  const match = entityId.match(/^ws:([^:]+):emp:(.+)$/)
  if (!match) throw new ToolExecutorError('UNKNOWN', `Invalid entityId format: ${entityId}`)
  return { workspaceId: match[1], employeeId: match[2] }
}

function hashParams(params: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 16)
}

export class NangoExecutor implements ToolExecutor {

  async initiateOAuth(args: { app: string; entityId: string; redirectUrl: string; scopes?: string[] }) {
    const { workspaceId, employeeId } = parseEntityId(args.entityId)
    const nangoApp = this._appForAction(args.app)
    const connectionId = `${workspaceId}-${employeeId}-${nangoApp}`

    const sessionRes = await fetch(`${nangoHost()}/connect/sessions`, {
      method: 'POST',
      headers: nangoHeaders(),
      body: JSON.stringify({
        end_user: { id: connectionId },
        allowed_integrations: [nangoApp],
        ...(args.scopes?.length
          ? { integrations_config_defaults: { [nangoApp]: { oauth_scopes: args.scopes.join(',') } } }
          : {}),
      }),
    })

    if (!sessionRes.ok) {
      const body = await sessionRes.text()
      const clean = body.startsWith('<')
        ? `HTTP ${sessionRes.status} from ${nangoHost()}/connect/sessions — check NANGO_HOST points to port 8080`
        : body
      throw new ToolExecutorError('UNKNOWN', `Nango connect session failed: ${clean}`)
    }

    const sessionData = await sessionRes.json()
    const sessionToken: string = sessionData.data?.token ?? sessionData.token

    if (!sessionToken) {
      throw new ToolExecutorError('UNKNOWN', `Nango did not return a session token. Response: ${JSON.stringify(sessionData)}`)
    }

    const rawConnectLink: string | undefined = sessionData.data?.connect_link
    let hostedUrl: string
    if (rawConnectLink) {
      try {
        const parsed = new URL(rawConnectLink)
        const base = nangoConnectUiUrl()
        hostedUrl = `${base}${parsed.search}&redirect_url=${encodeURIComponent(args.redirectUrl)}`
      } catch {
        hostedUrl = `${nangoConnectUiUrl()}/?session_token=${sessionToken}&redirect_url=${encodeURIComponent(args.redirectUrl)}`
      }
    } else {
      hostedUrl = `${nangoConnectUiUrl()}/?session_token=${sessionToken}&redirect_url=${encodeURIComponent(args.redirectUrl)}`
    }

    return { redirectUrl: hostedUrl, connectionId, sessionToken }
  }

  async getConnectionStatus(entityId: string, app: string) {
    const { workspaceId, employeeId } = parseEntityId(entityId)
    const nangoApp = this._appForAction(app)
    const connectionId = `${workspaceId}-${employeeId}-${nangoApp}`

    const res = await fetch(
      `${nangoHost()}/connection/${connectionId}?provider_config_key=${nangoApp}`,
      { headers: nangoHeaders() }
    )

    if (res.status === 404) return 'none'
    if (!res.ok) return 'none'

    const data = await res.json()
    if (data.credentials?.type === 'OAUTH2' && data.credentials?.expires_at) {
      const expiresAt = new Date(data.credentials.expires_at)
      if (expiresAt < new Date()) return 'expired'
    }

    return 'connected'
  }

  async revokeConnection(entityId: string, app: string) {
    const { workspaceId, employeeId } = parseEntityId(entityId)
    const nangoApp = this._appForAction(app)
    const connectionId = `${workspaceId}-${employeeId}-${nangoApp}`

    const res = await fetch(
      `${nangoHost()}/connection/${connectionId}?provider_config_key=${nangoApp}`,
      { method: 'DELETE', headers: nangoHeaders() }
    )

    if (!res.ok && res.status !== 404) {
      const body = await res.text()
      throw new ToolExecutorError('UNKNOWN', `Failed to revoke Nango connection: ${body}`)
    }
  }

  async listActions(app: string): Promise<ToolSchema[]> {
    return Object.values(TOOL_REGISTRY).filter(schema => {
      const prefix = app.toLowerCase().replace(/-/g, '_')
      const toolName = Object.entries(TOOL_REGISTRY).find(([, s]) => s === schema)?.[0] ?? ''
      return toolName.startsWith(prefix)
    })
  }

  async execute(args: {
    action: string
    entityId: string
    params: Record<string, unknown>
    approvalTokenId?: string
  }): Promise<{ success: boolean; result?: unknown; error?: string; auditId: string }> {
    const { action, entityId, params, approvalTokenId } = args
    const { workspaceId, employeeId } = parseEntityId(entityId)
    const sb = supabaseAdmin()

    const schema = getToolSchema(action)
    if (!schema) throw new ToolExecutorError('UNKNOWN', `Unknown action: ${action}`)

    if (isActionDangerous(action)) {
      if (!approvalTokenId) {
        throw new ToolExecutorError('APPROVAL_REQUIRED', `Action "${action}" requires an approval token.`)
      }

      const { data: approval, error: approvalErr } = await sb
        .from('approval_requests')
        .select('*')
        .eq('approval_token_id', approvalTokenId)
        .single()

      if (approvalErr || !approval) {
        throw new ToolExecutorError('APPROVAL_REQUIRED', `Approval token not found: ${approvalTokenId}`)
      }
      if (approval.state !== 'approved') {
        throw new ToolExecutorError('APPROVAL_REQUIRED', `Approval token is in state "${approval.state}", expected "approved".`)
      }
      if (approval.consumed_at) {
        throw new ToolExecutorError('APPROVAL_REQUIRED', `Approval token has already been consumed.`)
      }

      await sb
        .from('approval_requests')
        .update({ consumed_at: new Date().toISOString() })
        .eq('approval_token_id', approvalTokenId)
    }

    const { data: auditRow, error: auditInsertErr } = await sb
      .from('tool_audit_log')
      .insert({
        workspace_id: workspaceId,
        employee_id: employeeId,
        action,
        entity_id: entityId,
        params_hash: hashParams(params),
        approval_token_id: approvalTokenId ?? null,
        result_code: 'pending',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    const auditId: string = auditRow?.id ?? crypto.randomUUID()
    if (auditInsertErr) console.error('[NangoExecutor] Failed to insert audit row:', auditInsertErr)

    const connectionId = `${workspaceId}-${employeeId}-${this._appForAction(action)}`
    const startedAt = Date.now()
    let success = false
    let result: unknown
    let error: string | undefined

    try {
      const proxyRes = await fetch(
        `${nangoHost()}/connection/${connectionId}/proxy/${action}`,
        {
          method: 'POST',
          headers: nangoHeaders(),
          body: JSON.stringify(params),
        }
      )

      const latencyMs = Date.now() - startedAt

      if (!proxyRes.ok) {
        const errBody = await proxyRes.text()
        error = `Nango proxy returned ${proxyRes.status}: ${errBody}`
        if (proxyRes.status === 401 || proxyRes.status === 403) {
          throw new ToolExecutorError('CONNECTION_EXPIRED', `Connection expired for ${connectionId}`)
        }
        if (proxyRes.status === 429) {
          throw new ToolExecutorError('RATE_LIMITED', `Rate limited by integration`)
        }
      } else {
        result = await proxyRes.json().catch(() => undefined)
        success = true
        error = undefined
      }

      await sb
        .from('tool_audit_log')
        .update({ result_code: success ? 'ok' : 'error', latency_ms: latencyMs, error: error ?? null })
        .eq('id', auditId)

    } catch (err) {
      const latencyMs = Date.now() - startedAt
      if (err instanceof ToolExecutorError) {
        await sb.from('tool_audit_log').update({ result_code: 'error', latency_ms: latencyMs, error: err.message }).eq('id', auditId)
        throw err
      }
      const errMsg = err instanceof Error ? err.message : String(err)
      await sb.from('tool_audit_log').update({ result_code: 'error', latency_ms: latencyMs, error: errMsg }).eq('id', auditId)
      throw new ToolExecutorError('UNKNOWN', errMsg)
    }

    return { success, result, error, auditId }
  }

  private _appForAction(action: string): string {
    const APP_MAP: Record<string, string> = {
      slack: 'slack',
      gmail: 'google-mail',
      google_mail: 'google-mail',
      google_calendar: 'google-calendar',
      google_drive: 'google-drive',
      calendar: 'google-calendar',
      drive: 'google-drive',
      github: 'github',
      notion: 'notion',
      zapier: 'zapier',
      jira: 'jira',
      linear: 'linear',
      hubspot: 'hubspot',
      twilio: 'twilio',
      stripe: 'stripe',
      airtable: 'airtable',
      asana: 'asana',
      trello: 'trello',
      intercom: 'intercom',
      zendesk: 'zendesk',
      vercel: 'vercel',
      pagerduty: 'pagerduty',
      sentry: 'sentry',
      cloudflare: 'cloudflare',
      excel: 'microsoft-excel',
      microsoft_excel: 'microsoft-excel',
      web: 'web-search',
    }

    if (APP_MAP[action]) return APP_MAP[action]
    const prefix = action.split('_')[0]
    return APP_MAP[prefix] ?? prefix
  }
}

export const nangoExecutor = new NangoExecutor()