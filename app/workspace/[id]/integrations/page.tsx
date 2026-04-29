'use client'
import Nango from '@nangohq/frontend'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

// Integration metadata 

type IntegrationCategory = 'Messaging' | 'Dev' | 'CRM' | 'PM' | 'Finance' | 'Infra'
type AuthType = 'oauth' | 'apikey'

interface ApiKeyField {
  key: string
  label: string
  placeholder: string
  secret?: boolean
  hint?: string
}

interface IntegrationMeta {
  name: string
  description: string
  category: IntegrationCategory
  color: string
  authType: AuthType
  // OAuth only
  nangoApp?: string
  // API key only
  fields?: ApiKeyField[]
}

const INTEGRATIONS: Record<string, IntegrationMeta> = {
  // ── OAuth ──────────────────────────────────────────────────────────────────
  gmail:           { name: 'Gmail',           description: 'Send emails from your Gmail account.',            category: 'Messaging', color: '#ea4335', authType: 'oauth', nangoApp: 'google-mail' },
  google_calendar: { name: 'Google Calendar', description: 'Create and manage calendar events.',              category: 'Messaging', color: '#4285f4', authType: 'oauth', nangoApp: 'google-calendar' },
  slack:           { name: 'Slack',           description: 'Post messages and updates to channels.',          category: 'Messaging', color: '#4a154b', authType: 'oauth', nangoApp: 'slack' },
  intercom:        { name: 'Intercom',        description: 'Message users via Intercom.',                     category: 'Messaging', color: '#286efa', authType: 'oauth', nangoApp: 'intercom' },
  github:          { name: 'GitHub',          description: 'Create issues, PRs, and commit files.',           category: 'Dev',      color: '#24292e', authType: 'oauth', nangoApp: 'github' },
  google_drive:    { name: 'Google Drive',    description: 'List and access files in Drive.',                 category: 'Dev',      color: '#0f9d58', authType: 'oauth', nangoApp: 'google-drive' },
  jira:            { name: 'Jira',            description: 'Create and manage issues in Jira.',               category: 'Dev',      color: '#0052cc', authType: 'oauth', nangoApp: 'jira' },
  linear:          { name: 'Linear',          description: 'Create and track Linear issues.',                 category: 'Dev',      color: '#5e6ad2', authType: 'oauth', nangoApp: 'linear' },
  notion:          { name: 'Notion',          description: 'Write docs and research to Notion pages.',        category: 'Dev',      color: '#1a1a1a', authType: 'oauth', nangoApp: 'notion' },
  hubspot:         { name: 'HubSpot',         description: 'Manage contacts and deals in HubSpot CRM.',       category: 'CRM',      color: '#ff7a59', authType: 'oauth', nangoApp: 'hubspot' },
  zendesk:         { name: 'Zendesk',         description: 'Create and manage support tickets.',              category: 'CRM',      color: '#03363d', authType: 'oauth', nangoApp: 'zendesk' },
  asana:           { name: 'Asana',           description: 'Create and assign tasks in Asana projects.',      category: 'PM',       color: '#fc636b', authType: 'oauth', nangoApp: 'asana' },
  trello:          { name: 'Trello',          description: 'Create cards in Trello boards.',                  category: 'PM',       color: '#0052cc', authType: 'oauth', nangoApp: 'trello' },
  excel:           { name: 'Microsoft Excel', description: 'Create and manage Excel spreadsheets.',           category: 'Finance',  color: '#217346', authType: 'oauth', nangoApp: 'microsoft-excel' },
  vercel:          { name: 'Vercel',          description: 'Monitor deployments and project status.',         category: 'Infra',    color: '#000000', authType: 'oauth', nangoApp: 'vercel' },
  pagerduty:       { name: 'PagerDuty',       description: 'Trigger and manage incidents.',                   category: 'Infra',    color: '#06ac38', authType: 'oauth', nangoApp: 'pagerduty' },

  // ── API Key ────────────────────────────────────────────────────────────────
  twilio: {
    name: 'Twilio', description: 'Send SMS messages to any phone number.', category: 'Messaging', color: '#f22f46', authType: 'apikey',
    fields: [
      { key: 'account_sid', label: 'Account SID', placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
      { key: 'auth_token',  label: 'Auth Token',  placeholder: 'your_auth_token', secret: true },
      { key: 'from_number', label: 'From Number', placeholder: '+15551234567' },
    ],
  },
  zapier: {
    name: 'Zapier', description: 'Trigger any automation via webhooks.', category: 'Dev', color: '#ff4a00', authType: 'apikey',
    fields: [
      { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://hooks.zapier.com/hooks/catch/...', hint: 'Create a Zap with "Webhooks by Zapier" trigger' },
    ],
  },
  airtable: {
    name: 'Airtable', description: 'Create and query records in Airtable bases.', category: 'PM', color: '#18bfff', authType: 'apikey',
    fields: [
      { key: 'api_key',  label: 'API Key',  placeholder: 'patXXXXXXXXXXXXXX', secret: true, hint: 'Find in airtable.com/create/tokens' },
      { key: 'base_id',  label: 'Base ID',  placeholder: 'appXXXXXXXXXXXXXX', hint: 'From your Airtable base URL' },
    ],
  },
  stripe: {
    name: 'Stripe', description: 'Query customers, revenue, and payments.', category: 'Finance', color: '#635bff', authType: 'apikey',
    fields: [
      { key: 'api_key', label: 'Secret Key', placeholder: 'sk_live_...', secret: true, hint: 'Use sk_test_... for testing. Find in Stripe Dashboard → Developers → API keys' },
    ],
  },
  sentry: {
    name: 'Sentry', description: 'Query errors and issues from Sentry.', category: 'Infra', color: '#362d59', authType: 'apikey',
    fields: [
      { key: 'auth_token', label: 'Auth Token', placeholder: 'your_sentry_token', secret: true, hint: 'Create at sentry.io/settings/account/api/auth-tokens/' },
      { key: 'org_slug',   label: 'Org Slug',   placeholder: 'my-org' },
    ],
  },
  cloudflare: {
    name: 'Cloudflare', description: 'Manage zones, DNS records, and cache.', category: 'Infra', color: '#f48120', authType: 'apikey',
    fields: [
      { key: 'api_token', label: 'API Token', placeholder: 'your_cloudflare_token', secret: true, hint: 'Create at dash.cloudflare.com/profile/api-tokens' },
    ],
  },
}

const CATEGORIES: IntegrationCategory[] = ['Messaging', 'Dev', 'CRM', 'PM', 'Finance', 'Infra']

// ─── Types ────────────────────────────────────────────────────────────────────

interface Employee { id: string; name: string; role?: string }
type ConnectionStatus = 'connected' | 'expired' | 'none' | 'loading'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isMasked(v: string) { return typeof v === 'string' && v.startsWith('••••') }

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === 'loading') return <Badge variant="outline" className="text-xs animate-pulse">Checking…</Badge>
  if (status === 'connected') return <Badge className="text-xs bg-green-600 hover:bg-green-600 text-white">Connected</Badge>
  if (status === 'expired') return <Badge variant="destructive" className="text-xs">Expired</Badge>
  return <Badge variant="outline" className="text-xs text-muted-foreground">Not connected</Badge>
}

// ─── API Key form ─────────────────────────────────────────────────────────────

function ApiKeyForm({
  meta, existing, onSave, onDisconnect, saving, disconnecting,
}: {
  meta: IntegrationMeta
  existing: Record<string, string>
  onSave: (values: Record<string, string>) => void
  onDisconnect: () => void
  saving: boolean
  disconnecting: boolean
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of meta.fields ?? []) init[f.key] = existing[f.key] ?? ''
    return init
  })
  const [show, setShow] = useState<Record<string, boolean>>({})

  const hasExisting = Object.values(existing).some(v => v && !isMasked(v) || isMasked(v))
  const isDirty = (meta.fields ?? []).some(f => values[f.key] && !isMasked(values[f.key]))

  return (
    <div className="mt-3 space-y-2">
      {(meta.fields ?? []).map(f => (
        <div key={f.key}>
          <label className="text-xs font-medium text-muted-foreground block mb-1">{f.label}</label>
          <div className="relative">
            <input
              type={f.secret && !show[f.key] ? 'password' : 'text'}
              value={values[f.key]}
              onChange={e => setValues(p => ({ ...p, [f.key]: e.target.value }))}
              placeholder={existing[f.key] ? '••••••••' : f.placeholder}
              className="w-full text-xs h-8 px-2 rounded border bg-background border-border focus:outline-none focus:ring-1 focus:ring-primary pr-8"
            />
            {f.secret && (
              <button
                type="button"
                onClick={() => setShow(p => ({ ...p, [f.key]: !p[f.key] }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
              >
                {show[f.key] ? '🙈' : '👁'}
              </button>
            )}
          </div>
          {f.hint && <p className="text-xs text-muted-foreground mt-0.5">{f.hint}</p>}
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm" className="text-xs h-7"
          onClick={() => onSave(values)}
          disabled={saving || !isDirty}
        >
          {saving ? 'Saving…' : hasExisting ? 'Update' : 'Save & Connect'}
        </Button>
        {hasExisting && (
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={onDisconnect} disabled={disconnecting}>
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Integration card ─────────────────────────────────────────────────────────

function IntegrationCard({
  appKey, meta, status, savedConfig,
  onOAuthConnect, onOAuthDisconnect, onApiKeySave, onApiKeyDisconnect,
  connecting, disconnecting, saving,
}: {
  appKey: string
  meta: IntegrationMeta
  status: ConnectionStatus
  savedConfig: Record<string, string>
  onOAuthConnect: () => void
  onOAuthDisconnect: () => void
  onApiKeySave: (values: Record<string, string>) => void
  onApiKeyDisconnect: () => void
  connecting: boolean
  disconnecting: boolean
  saving: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 text-xs font-bold"
            style={{ backgroundColor: meta.color + '18', border: `1.5px solid ${meta.color}30`, color: meta.color }}
          >
            {meta.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold">{meta.name}</CardTitle>
            <StatusBadge status={status} />
          </div>
          {meta.authType === 'apikey' && (
            <button
              onClick={() => setExpanded(p => !p)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
            >
              {expanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <CardDescription className="text-xs mb-3">{meta.description}</CardDescription>

        {meta.authType === 'oauth' && (
          <div className="flex gap-2">
            {status === 'connected' ? (
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={onOAuthDisconnect} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            ) : (
              <Button size="sm" className="text-xs h-7" onClick={onOAuthConnect} disabled={connecting || status === 'loading'}>
                {connecting ? 'Connecting…' : status === 'expired' ? 'Reconnect' : 'Connect'}
              </Button>
            )}
          </div>
        )}

        {meta.authType === 'apikey' && (expanded || status === 'none') && (
          <ApiKeyForm
            meta={meta}
            existing={savedConfig}
            onSave={onApiKeySave}
            onDisconnect={onApiKeyDisconnect}
            saving={saving}
            disconnecting={disconnecting}
          />
        )}

        {meta.authType === 'apikey' && !expanded && status === 'connected' && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setExpanded(true)}>
              Edit credentials
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7 text-destructive" onClick={onApiKeyDisconnect} disabled={disconnecting}>
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const params = useParams()
  const workspaceId = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('')

  // OAuth statuses (per-employee via Nango)
  const [oauthStatuses, setOauthStatuses] = useState<Record<string, ConnectionStatus>>({})

  // API key statuses + saved configs (per-workspace via Supabase integrations table)
  const [apikeyStatuses, setApikeyStatuses] = useState<Record<string, ConnectionStatus>>({})
  const [savedConfigs, setSavedConfigs] = useState<Record<string, Record<string, string>>>({})

  const [connecting, setConnecting] = useState<Record<string, boolean>>({})
  const [disconnecting, setDisconnecting] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [toast, setToast] = useState<string>('')
  const [activeCategory, setActiveCategory] = useState<IntegrationCategory | 'All'>('All')

  // Load employees
  useEffect(() => {
    fetch(`/api/employees?workspaceId=${workspaceId}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: Employee[]) => {
        setEmployees(data)
        if (data.length > 0) setSelectedEmployeeId(data[0].id)
      })
      .catch(() => {})
  }, [workspaceId])

  // Load API key statuses + configs (workspace-level, no employee needed)
  useEffect(() => {
    fetch(`/api/integrations?workspace_id=${workspaceId}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: { type: string; status: string; config: Record<string, string> }[]) => {
        const statuses: Record<string, ConnectionStatus> = {}
        const configs: Record<string, Record<string, string>> = {}
        for (const row of data) {
          const appKey = row.type
          if (INTEGRATIONS[appKey]?.authType === 'apikey') {
            statuses[appKey] = row.status === 'connected' ? 'connected' : 'none'
            configs[appKey] = row.config ?? {}
          }
        }
        setApikeyStatuses(statuses)
        setSavedConfigs(configs)
      })
      .catch(() => {})
  }, [workspaceId])

  // Fetch OAuth statuses for selected employee
  const fetchOauthStatuses = useCallback(async (employeeId: string) => {
    if (!employeeId) return
    const entityId = `ws:${workspaceId}:emp:${employeeId}`
    const oauthKeys = Object.keys(INTEGRATIONS).filter(k => INTEGRATIONS[k].authType === 'oauth')

    const loading: Record<string, ConnectionStatus> = {}
    for (const k of oauthKeys) loading[k] = 'loading'
    setOauthStatuses(loading)

    const results = await Promise.allSettled(
      oauthKeys.map(async (appKey) => {
        const res = await fetch(`/api/integrations/status?entityId=${encodeURIComponent(entityId)}&app=${appKey}`)
        const data = res.ok ? await res.json() : { status: 'none' }
        return [appKey, (data.status ?? 'none') as ConnectionStatus] as const
      })
    )

    const next: Record<string, ConnectionStatus> = {}
    for (const r of results) {
      if (r.status === 'fulfilled') next[r.value[0]] = r.value[1]
    }
    for (const k of oauthKeys) {
      if (!next[k]) next[k] = 'none'
    }
    setOauthStatuses(next)
  }, [workspaceId])

  useEffect(() => {
    if (selectedEmployeeId) fetchOauthStatuses(selectedEmployeeId)
  }, [selectedEmployeeId, fetchOauthStatuses])

  function showToast(msg: string) {
    const stripped = msg.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
    const truncated = stripped.length > 160 ? stripped.slice(0, 157) + '…' : stripped
    setToast(truncated)
    setTimeout(() => setToast(''), 6000)
  }

  // ── OAuth connect ──────────────────────────────────────────────────────────
  async function handleOAuthConnect(appKey: string) {
    if (!selectedEmployeeId) { showToast('Select an employee first.'); return }
    setConnecting(p => ({ ...p, [appKey]: true }))
    try {
      const redirectUrl = `${window.location.origin}/api/integrations/oauth/callback?workspaceId=${workspaceId}&employeeId=${selectedEmployeeId}&app=${appKey}`
      const res = await fetch('/api/integrations/oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, employeeId: selectedEmployeeId, app: appKey, redirectUrl }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed') }
      const { sessionToken } = await res.json()

      const nango = new Nango({
        host: process.env.NEXT_PUBLIC_NANGO_HOST,
        connectSessionToken: sessionToken,
      })

      await nango.auth(INTEGRATIONS[appKey].nangoApp!)
      showToast(`${INTEGRATIONS[appKey].name} connected!`)
      setOauthStatuses(p => ({ ...p, [appKey]: 'connected' }))
    } catch (err) {
      const rawMsg = (err as Error).message || ''
      const friendly = rawMsg.includes('Integration does not exist')
        ? `"${INTEGRATIONS[appKey]?.nangoApp}" isn't set up in Nango yet.`
        : rawMsg.includes('cancelled') || rawMsg.includes('Cancelled')
        ? 'Cancelled.'
        : rawMsg
      if (!friendly.includes('Cancelled')) showToast(`Failed to connect ${INTEGRATIONS[appKey]?.name}: ${friendly}`)
    } finally {
      setConnecting(p => ({ ...p, [appKey]: false }))
    }
  }

  // ── OAuth disconnect ───────────────────────────────────────────────────────
  async function handleOAuthDisconnect(appKey: string) {
    if (!selectedEmployeeId) return
    if (!confirm(`Disconnect ${INTEGRATIONS[appKey]?.name}?`)) return
    setDisconnecting(p => ({ ...p, [appKey]: true }))
    try {
      const entityId = `ws:${workspaceId}:emp:${selectedEmployeeId}`
      const res = await fetch('/api/integrations/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId, app: appKey }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed') }
      showToast(`${INTEGRATIONS[appKey]?.name} disconnected.`)
      setOauthStatuses(p => ({ ...p, [appKey]: 'none' }))
    } catch (err) {
      showToast(`Disconnect failed: ${(err as Error).message}`)
    } finally {
      setDisconnecting(p => ({ ...p, [appKey]: false }))
    }
  }

  // ── API key save ───────────────────────────────────────────────────────────
  async function handleApiKeySave(appKey: string, values: Record<string, string>) {
    setSaving(p => ({ ...p, [appKey]: true }))
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, type: appKey, config: values, status: 'connected' }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed') }
      showToast(`${INTEGRATIONS[appKey]?.name} credentials saved!`)
      setApikeyStatuses(p => ({ ...p, [appKey]: 'connected' }))
      setSavedConfigs(p => ({ ...p, [appKey]: { ...p[appKey], ...values } }))
    } catch (err) {
      showToast(`Save failed: ${(err as Error).message}`)
    } finally {
      setSaving(p => ({ ...p, [appKey]: false }))
    }
  }

  // ── API key disconnect ─────────────────────────────────────────────────────
  async function handleApiKeyDisconnect(appKey: string) {
    if (!confirm(`Disconnect ${INTEGRATIONS[appKey]?.name}?`)) return
    setDisconnecting(p => ({ ...p, [appKey]: true }))
    try {
      const res = await fetch('/api/integrations/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, type: appKey }),
      })
      if (!res.ok) throw new Error('Failed')
      showToast(`${INTEGRATIONS[appKey]?.name} disconnected.`)
      setApikeyStatuses(p => ({ ...p, [appKey]: 'none' }))
      setSavedConfigs(p => ({ ...p, [appKey]: {} }))
    } catch (err) {
      showToast(`Disconnect failed: ${(err as Error).message}`)
    } finally {
      setDisconnecting(p => ({ ...p, [appKey]: false }))
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const getStatus = (appKey: string): ConnectionStatus => {
    const meta = INTEGRATIONS[appKey]
    if (!meta) return 'none'
    if (meta.authType === 'oauth') return selectedEmployeeId ? (oauthStatuses[appKey] ?? 'none') : 'none'
    return apikeyStatuses[appKey] ?? 'none'
  }

  const filteredKeys = Object.keys(INTEGRATIONS).filter(
    k => activeCategory === 'All' || INTEGRATIONS[k].category === activeCategory
  )
  const grouped = CATEGORIES.reduce<Record<string, string[]>>((acc, cat) => {
    const keys = filteredKeys.filter(k => INTEGRATIONS[k].category === cat)
    if (keys.length) acc[cat] = keys
    return acc
  }, {})

  const connectedCount = Object.keys(INTEGRATIONS).filter(k => getStatus(k) === 'connected').length
  const oauthKeys = Object.keys(INTEGRATIONS).filter(k => INTEGRATIONS[k].authType === 'oauth')
  const showEmployeeWarning = oauthKeys.some(k => filteredKeys.includes(k)) && !selectedEmployeeId

  return (
    <div className="page-shell" style={{ background: 'var(--bg)' }}>
      <div className="max-w-5xl mx-auto px-6 py-8">

        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect tools so the AI agent can take actions on behalf of each employee.
          </p>
        </div>

        {/* Employee selector — only relevant for OAuth integrations */}
        <div className="flex flex-wrap items-center gap-4 mb-6 p-4 rounded-lg border bg-muted/30">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">OAuth connections — acting as employee</p>
            <p className="text-xs text-muted-foreground">Google, Slack, GitHub etc. are connected per-employee. API key integrations are shared across the workspace.</p>
          </div>
          {employees.length > 0 ? (
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select employee…" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}{emp.role ? ` — ${emp.role}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground italic">No employees configured</span>
          )}
          {connectedCount > 0 && (
            <Badge variant="secondary">{connectedCount} connected</Badge>
          )}
        </div>

        {showEmployeeWarning && (
          <div className="mb-4 px-4 py-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-xs text-yellow-700 dark:text-yellow-400">
            Select an employee above to connect OAuth integrations (Gmail, Slack, GitHub, etc.)
          </div>
        )}

        {/* Category tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {(['All', ...CATEGORIES] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Integration groups */}
        {Object.entries(grouped).map(([category, keys]) => (
          <div key={category} className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-semibold">{category}</h2>
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {keys.filter(k => getStatus(k) === 'connected').length}/{keys.length} connected
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {keys.map(appKey => (
                <IntegrationCard
                  key={appKey}
                  appKey={appKey}
                  meta={INTEGRATIONS[appKey]}
                  status={getStatus(appKey)}
                  savedConfig={savedConfigs[appKey] ?? {}}
                  onOAuthConnect={() => handleOAuthConnect(appKey)}
                  onOAuthDisconnect={() => handleOAuthDisconnect(appKey)}
                  onApiKeySave={(values) => handleApiKeySave(appKey, values)}
                  onApiKeyDisconnect={() => handleApiKeyDisconnect(appKey)}
                  connecting={!!connecting[appKey]}
                  disconnecting={!!disconnecting[appKey]}
                  saving={!!saving[appKey]}
                />
              ))}
            </div>
          </div>
        ))}

        {filteredKeys.length === 0 && (
          <p className="text-center py-16 text-muted-foreground text-sm">No integrations in this category.</p>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-foreground text-background text-sm shadow-lg max-w-md text-center">
          {toast}
        </div>
      )}
    </div>
  )
}