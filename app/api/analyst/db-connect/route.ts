import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { workspace_id, name, type, host, port, database, username, password,
          connectionString, useConnStr, ssl, extra } = body

  if (!workspace_id || !name) {
    return NextResponse.json({ error: 'workspace_id and name required' }, { status: 400 })
  }

  const config: any = useConnStr
    ? { connectionString }
    : { host, port, database, username, password, ssl, datacenter: extra }

  const { data, error } = await sb
    .from('db_connections')
    .insert({ workspace_id, name, db_type: type, status: 'untested', config, updated_at: new Date().toISOString() })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id, name, type, status: 'untested' })
}
