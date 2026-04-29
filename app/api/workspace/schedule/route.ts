import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const body = await req.json()
  if (body.secret !== process.env.CRON_SECRET)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cadence: string = body.cadence || 'daily'
  const sb = supabaseAdmin()

  const { data: workflows } = await sb.from('workflows').select('id, workspace_id, name')
    .eq('trigger', 'schedule').eq('schedule_cadence', cadence).eq('enabled', true)

  if (!workflows?.length) return NextResponse.json({ fired: 0 })

  const base = process.env.APP_URL || 'http://localhost:3000'
  const results = await Promise.allSettled(
    workflows.map(wf =>
      fetch(`${base}/api/workflows/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: wf.id,
          triggered_by: `schedule:${cadence}`,
          variables: { date: new Date().toLocaleDateString(), cadence },
        }),
      })
    )
  )

  const fired = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length
  return NextResponse.json({ fired, failed, cadence })
}
