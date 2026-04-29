import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const { workspace_id, type } = await req.json()
  if (!workspace_id || !type) return NextResponse.json({ error: 'workspace_id and type required' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data, error } = await sb.from('integrations').select('config,status').eq('workspace_id', workspace_id).eq('type', type).single()
  if (error || !data) return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
  if (data.status !== 'connected') return NextResponse.json({ result: 'Integration is not connected' })

  const config = data.config as Record<string, string>

  try {
    switch (type) {
      case 'slack': {
        const res = await fetch(config.webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '✅ Atlantir connection test successful!' }) })
        if (!res.ok) throw new Error(`Slack returned ${res.status}`)
        return NextResponse.json({ result: 'Slack message sent successfully!' })
      }
      case 'notion': {
        const res = await fetch('https://api.notion.com/v1/users/me', { headers: { Authorization: `Bearer ${config.api_key}`, 'Notion-Version': '2022-06-28' } })
        if (!res.ok) throw new Error(`Notion returned ${res.status}`)
        const user = await res.json() as { name?: string }
        return NextResponse.json({ result: `Connected as ${user.name || 'Notion user'}` })
      }
      case 'gmail': {
        if (!config.sender_email || !config.app_password) throw new Error('Missing email or app password')
        if (!config.sender_email.includes('@')) throw new Error('Invalid email address')
        return NextResponse.json({ result: `Gmail credentials look good for ${config.sender_email}` })
      }
      case 'github': {
        const res = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${config.token}`, Accept: 'application/vnd.github+json' } })
        if (!res.ok) throw new Error(`GitHub returned ${res.status}`)
        const user = await res.json() as { login?: string }
        return NextResponse.json({ result: `Connected as @${user.login}` })
      }
      case 'google_calendar': {
        if (!config.webhook_url) throw new Error('No webhook URL')
        const res = await fetch(config.webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'atlantir', test: true, summary: 'Atlantir test ping' }) })
        if (!res.ok) throw new Error(`Webhook returned ${res.status}`)
        return NextResponse.json({ result: 'Calendar webhook connected — test ping sent ✅' })
      }
      case 'excel':
        return NextResponse.json({ result: 'Excel generation is built-in — no external connection needed ✅' })
      case 'zapier': {
        const res = await fetch(config.webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: true, source: 'atlantir' }) })
        if (!res.ok) throw new Error(`Zapier returned ${res.status}`)
        return NextResponse.json({ result: 'Zapier webhook triggered successfully!' })
      }
      default:
        return NextResponse.json({ result: 'Unknown integration type' })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Test failed' })
  }
}
