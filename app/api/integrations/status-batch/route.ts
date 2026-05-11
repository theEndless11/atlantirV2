/**
 * POST /api/integrations/status-batch
 * Body: { entityId: string, apps: string[] }
 * Returns: { statuses: Record<string, 'connected' | 'expired' | 'none'> }
 *
 * Replaces 19 individual /api/integrations/status calls with one request.
 */
import { NextResponse } from 'next/server'
import { nangoExecutor } from '@/lib/tool-executor/nango-executor'

export async function POST(req: Request) {
  let body: { entityId: string; apps: string[] }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { entityId, apps } = body
  if (!entityId || !Array.isArray(apps))
    return NextResponse.json({ error: 'entityId and apps required' }, { status: 400 })

  const results = await Promise.allSettled(
    apps.map(async (app) => {
      const status = await nangoExecutor.getConnectionStatus(entityId, app)
      return [app, status] as const
    })
  )

  const statuses: Record<string, string> = {}
  for (const r of results) {
    if (r.status === 'fulfilled') statuses[r.value[0]] = r.value[1]
  }
  for (const app of apps) {
    if (!statuses[app]) statuses[app] = 'none'
  }

  return NextResponse.json({ statuses })
}
