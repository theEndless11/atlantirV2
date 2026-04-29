import { NextRequest, NextResponse } from 'next/server'
import { nangoExecutor } from '@/lib/tool-executor/nango-executor'

// GET /api/integrations/status?entityId=...&app=...
// Returns { status: 'connected' | 'expired' | 'none' }
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const entityId = searchParams.get('entityId')
  const app = searchParams.get('app')

  if (!entityId || !app) {
    return NextResponse.json({ error: 'entityId and app are required' }, { status: 400 })
  }

  try {
    const status = await nangoExecutor.getConnectionStatus(entityId, app)
    return NextResponse.json({ status })
  } catch {
    // If Nango isn't configured or integration doesn't exist, treat as 'none'
    return NextResponse.json({ status: 'none' })
  }
}
