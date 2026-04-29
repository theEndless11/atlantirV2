import { NextRequest, NextResponse } from 'next/server'
import { parseCassandraUrl } from '@/lib/cassandra-parse'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { type, host, port, database, username, password, connectionString, useConnStr, ssl, extra, name } = body

  if (!name) return NextResponse.json({ error: 'Connection name is required' }, { status: 400 })

  try {
    if (type === 'postgres' || type === 'supabase') {
      const { Client } = await import('pg')
      const client = new Client(useConnStr && connectionString ? connectionString : {
        host: host || 'localhost', port: parseInt(port || '5432'),
        database: database || undefined, user: username || undefined,
        password: password || undefined, connectionTimeoutMillis: 8000,
        ssl: ssl ? { rejectUnauthorized: false } : undefined
      })
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
    } else if (type === 'mysql' || type === 'mariadb' || type === 'planetscale') {
      const mysql = await import('mysql2/promise')
      const conn = await mysql.createConnection(useConnStr && connectionString ? connectionString : {
        host: host || 'localhost', port: parseInt(port || '3306'),
        database: database || undefined, user: username || undefined,
        password: password || undefined, connectTimeout: 8000,
        ssl: ssl ? { rejectUnauthorized: false } : undefined
      })
      await conn.query('SELECT 1')
      await conn.end()
    } else if (type === 'cassandra' || type === 'scylla') {
      const cassandra = await import('cassandra-driver')
      let opts: any
      if (useConnStr && connectionString) {
        opts = parseCassandraUrl(connectionString)
      } else {
        const contactPoints = (host || 'localhost').split(',').map((s: string) => s.trim())
        opts = { contactPoints, localDataCenter: extra || 'datacenter1', socketOptions: { connectTimeout: 8000 } }
        if (database) opts.keyspace = database
        if (username) opts.credentials = { username, password: password || '' }
        if (port) opts.protocolOptions = { port: parseInt(port) }
      }
      const client = new cassandra.Client(opts)
      await client.connect()
      await client.execute('SELECT now() FROM system.local')
      await client.shutdown()
    } else {
      if (!host && !connectionString && type !== 'sqlite' && type !== 'duckdb') {
        throw new Error('Host or connection string required')
      }
    }
    return NextResponse.json({ success: true, message: 'Connected successfully' })
  } catch (err: any) {
    const msg = err.message || 'Connection failed'
    const friendly = msg.includes('ECONNREFUSED')
      ? `Cannot reach ${host || 'host'}:${port || '?'} - is the database running?`
      : msg.includes('password') || msg.includes('auth') || msg.includes('Unauthorized')
      ? 'Authentication failed - check username and password'
      : msg.includes('does not exist') || msg.includes('keyspace')
      ? `Keyspace/database not found: ${database || ''}`
      : msg.includes('datacenter') ? 'Datacenter not found - check localDataCenter setting' : msg
    return NextResponse.json({ error: friendly }, { status: 400 })
  }
}
