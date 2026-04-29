import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const body = await req.json()
  if (body?.secret !== process.env.CRON_SECRET)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sb = supabaseAdmin()
  const now = new Date()
  const windowEnd = new Date(now.getTime() + 2 * 60 * 1000).toISOString()

  const { data: due, error } = await sb.from('scheduled_bots').select('*')
    .eq('status', 'pending').lte('scheduled_at', windowEnd)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due?.length) return NextResponse.json({ checked: 0, fired: 0, failed: 0, at: now.toISOString() })

  const botServiceUrl = process.env.BOT_SERVICE_URL || 'http://localhost:3021'
  const secret = process.env.BOT_SECRET || 'changeme'

  const results = await Promise.allSettled(due.map(async (bot: any) => {
    await sb.from('scheduled_bots').update({ status: 'running', fired_at: now.toISOString() })
      .eq('id', bot.id).eq('status', 'pending')
    try {
      const res = await fetch(`${botServiceUrl}/bot/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bot-secret': secret },
        body: JSON.stringify({
          room_url: bot.room_url, workspace_id: bot.workspace_id,
          bot_name: bot.bot_name || 'Atlantir',
          response_mode: bot.response_mode || 'addressed',
          instructions: bot.instructions || undefined,
        }),
      })
      if (!res.ok) throw new Error(`Bot service ${res.status}: ${await res.text()}`)
      const result = await res.json()
      await sb.from('scheduled_bots').update({ status: 'done', session_id: result.session_id }).eq('id', bot.id)
      return { id: bot.id, session_id: result.session_id }
    } catch (e: any) {
      await sb.from('scheduled_bots').update({ status: 'failed', error_message: e.message }).eq('id', bot.id)
      throw e
    }
  }))

  return NextResponse.json({
    checked: due.length,
    fired: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
    at: now.toISOString(),
  })
}
