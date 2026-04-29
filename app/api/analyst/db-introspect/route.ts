import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { parseCassandraUrl } from '@/lib/cassandra-parse'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)

export async function GET(req: NextRequest) {
  const connection_id = req.nextUrl.searchParams.get('connection_id')
  const workspace_id = req.nextUrl.searchParams.get('workspace_id')
  return handle(connection_id, workspace_id)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  return handle(body.connection_id, body.workspace_id)
}

async function handle(connection_id: string | null | undefined, workspace_id: string | null | undefined) {
  if (!connection_id) return NextResponse.json({ error: 'connection_id required' }, { status: 400 })

  const { data: conn } = await sb.from('db_connections').select('*').eq('id', connection_id).single()
  if (!conn) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })

  const cfg = conn.config as any
  const type = conn.db_type

  try {
    let tables: string[] = []
    let preview: Record<string, any>[] = []
    let columns: string[] = []
    let rowCounts: Record<string, number> = {}

    if (type === 'postgres' || type === 'supabase') {
      const { Client } = await import('pg')
      const client = new Client(cfg.connectionString ? cfg.connectionString : {
        host: cfg.host || 'localhost', port: parseInt(cfg.port || '5432'),
        database: cfg.database || undefined, user: cfg.username || undefined,
        password: cfg.password || undefined, connectionTimeoutMillis: 8000,
        ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined
      })
      await client.connect()
      const tRes = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name LIMIT 50`)
      tables = tRes.rows.map((r: any) => r.table_name)
      for (const t of tables.slice(0, 10)) {
        try { const r = await client.query(`SELECT COUNT(*) FROM "${t}"`); rowCounts[t] = parseInt(r.rows[0].count) } catch {}
      }
      if (tables.length) {
        const pRes = await client.query(`SELECT * FROM "${tables[0]}" LIMIT 10`)
        preview = pRes.rows; columns = pRes.fields.map((f: any) => f.name)
      }
      await client.end()
    } else if (type === 'mysql' || type === 'mariadb' || type === 'planetscale') {
      const mysql = await import('mysql2/promise')
      const conn2 = await mysql.createConnection(cfg.connectionString ? cfg.connectionString : {
        host: cfg.host || 'localhost', port: parseInt(cfg.port || '3306'),
        database: cfg.database, user: cfg.username, password: cfg.password, connectTimeout: 8000,
        ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined
      })
      const [tRows]: any = await conn2.query('SHOW TABLES')
      tables = tRows.map((r: any) => Object.values(r)[0] as string)
      for (const t of tables.slice(0, 10)) {
        try { const [r]: any = await conn2.query('SELECT COUNT(*) as cnt FROM `' + t + '`'); rowCounts[t] = r[0].cnt } catch {}
      }
      if (tables.length) {
        const [pRows, pFields]: any = await conn2.query('SELECT * FROM `' + tables[0] + '` LIMIT 10')
        preview = pRows; columns = (pFields as any[]).map((f: any) => f.name)
      }
      await conn2.end()
    } else if (type === 'cassandra' || type === 'scylla') {
      const cassandra = await import('cassandra-driver')
      let opts: any = cfg.connectionString ? parseCassandraUrl(cfg.connectionString) : (() => {
        const o: any = { contactPoints: (cfg.host || 'localhost').split(',').map((s: string) => s.trim()), localDataCenter: cfg.datacenter || 'datacenter1', socketOptions: { connectTimeout: 8000 } }
        if (cfg.database) o.keyspace = cfg.database
        if (cfg.username) o.credentials = { username: cfg.username, password: cfg.password || '' }
        if (cfg.port) o.protocolOptions = { port: parseInt(cfg.port) }
        return o
      })()
      const client = new cassandra.Client(opts)
      await client.connect()
      const keyspace = opts.keyspace || client.keyspace
      if (keyspace) {
        const tRes = await client.execute('SELECT table_name FROM system_schema.tables WHERE keyspace_name = ?', [keyspace])
        tables = tRes.rows.map((r: any) => r.table_name)
        if (tables.length) {
          try {
            const pRes = await client.execute('SELECT * FROM ' + keyspace + '.' + tables[0] + ' LIMIT 10')
            preview = pRes.rows.map((r: any) => { const obj: any = {}; pRes.columns?.forEach((c: any) => { obj[c.name] = r[c.name] }); return obj })
            columns = pRes.columns?.map((c: any) => c.name) || []
          } catch {}
        }
      } else {
        const ksRes = await client.execute('SELECT keyspace_name FROM system_schema.keyspaces')
        tables = ksRes.rows.map((r: any) => r.keyspace_name).filter((k: string) => !['system', 'system_auth', 'system_distributed', 'system_schema', 'system_traces'].includes(k))
      }
      await client.shutdown()
    } else {
      throw new Error('Introspection not yet supported for ' + type)
    }

    await sb.from('db_connections').update({ status: 'connected', config: { ...cfg, tables }, updated_at: new Date().toISOString() }).eq('id', connection_id)
    return NextResponse.json({ tables, preview, columns, rowCounts, status: 'connected' })
  } catch (err: any) {
    await sb.from('db_connections').update({ status: 'error' }).eq('id', connection_id)
    return NextResponse.json({ error: err.message || 'Failed to connect' }, { status: 400 })
  }
}
