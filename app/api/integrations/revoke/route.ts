import { NextRequest, NextResponse } from 'next/server'
import { nangoExecutor } from '@/lib/tool-executor/nango-executor'
import { supabaseServer, supabaseAdmin } from '@/lib/supabase'

// POST { entityId, app }
// Revokes a Nango OAuth connection for the given entity + app
export async function POST(req: NextRequest) {
  let body: { entityId?: string; app?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { entityId, app } = body
  if (!entityId || !app) {
    return NextResponse.json({ error: 'entityId and app are required' }, { status: 400 })
  }

  // Auth check
  const db = await supabaseServer()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await nangoExecutor.revokeConnection(entityId, app)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
