import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { useAnthropic, AGENT_MODEL } from '@/lib/anthropic'
import { parseCassandraUrl } from '@/lib/cassandra-parse'

async function getConn(connectionId: string) {
  const { data } = await supabaseAdmin().from('db_connections').select('*').eq('id', connectionId).single()
  return data
}

async function execQuery(cfg: any, type: string, sql: string, fetchSize = 100): Promise<{ columns: string[]; rows: any[]; affected?: number; ddl?: boolean }> {
  if (type === 'postgres' || type === 'supabase') {
    const { Client } = await import('pg')
    const client = new Client(cfg.connectionString ? cfg.connectionString : {
      host: cfg.host || 'localhost', port: parseInt(cfg.port || '5432'),
      database: cfg.database || undefined, user: cfg.username || undefined,
      password: cfg.password || undefined, connectionTimeoutMillis: 12000,
      ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
    })
    await client.connect()
    const res = await client.query(sql)
    await client.end()
    if (res.fields?.length) return { columns: res.fields.map((f: any) => f.name), rows: res.rows.slice(0, fetchSize) }
    return { columns: ['result'], rows: [{ result: 'ok' }], affected: res.rowCount || 0, ddl: true }
  }
  if (type === 'mysql' || type === 'mariadb' || type === 'planetscale') {
    const mysql = await import('mysql2/promise')
    const c = await mysql.createConnection(cfg.connectionString ? cfg.connectionString : {
      host: cfg.host || 'localhost', port: parseInt(cfg.port || '3306'),
      database: cfg.database, user: cfg.username, password: cfg.password, connectTimeout: 12000,
    })
    const [rows, fields]: any = await c.query(sql)
    await c.end()
    if (Array.isArray(rows) && fields?.length) return { columns: (fields as any[]).map((f: any) => f.name), rows: (rows as any[]).slice(0, fetchSize) }
    return { columns: ['affected_rows'], rows: [{ affected_rows: (rows as any).affectedRows ?? 0 }], affected: (rows as any).affectedRows ?? 0, ddl: true }
  }
  if (type === 'cassandra' || type === 'scylla') {
    const cassandra = await import('cassandra-driver')
    const opts = cfg.connectionString ? parseCassandraUrl(cfg.connectionString) : (() => {
      const o: any = { contactPoints: (cfg.host || 'localhost').split(',').map((s: string) => s.trim()), localDataCenter: cfg.datacenter || 'datacenter1', socketOptions: { connectTimeout: 12000 } }
      if (cfg.database) o.keyspace = cfg.database
      if (cfg.username) o.credentials = { username: cfg.username, password: cfg.password || '' }
      if (cfg.port) o.protocolOptions = { port: parseInt(cfg.port) }
      return o
    })()
    const client = new cassandra.Client(opts)
    await client.connect()
    const res = await client.execute(sql, [], { prepare: false, fetchSize })
    const columns = res.columns?.map((c: any) => c.name) || []
    if (!columns.length) { await client.shutdown(); return { columns: ['result'], rows: [{ result: 'ok' }], ddl: true } }
    const rows = res.rows.map((r: any) => { const obj: any = {}; columns.forEach(c => { obj[c] = r[c] }); return obj })
    await client.shutdown()
    return { columns, rows }
  }
  throw new Error('Unsupported database type: ' + type)
}

function dialectGuide(type: string): string {
  switch (type) {
    case 'cassandra': case 'scylla':
      return `CRITICAL - You are connected to a CASSANDRA / CQL database. Use CQL syntax.\n- ALTER TABLE: ALTER TABLE tbl ADD colname datatype (NO "COLUMN" keyword)\n- No JOINs, no subqueries. Always include LIMIT on SELECT.\n- Types: text, int, bigint, boolean, float, uuid, timestamp, list<text>, map<text,text>`
    case 'mysql': case 'mariadb': case 'planetscale':
      return `You are connected to a MYSQL database. Use MySQL syntax.`
    default:
      return `You are connected to a POSTGRESQL database. Use PostgreSQL syntax.`
  }
}

function fmtTable(result: { columns: string[]; rows: any[] }): string {
  if (!result.rows.length) return '_(0 rows)_'
  const header = '| ' + result.columns.join(' | ') + ' |'
  const sep = '| ' + result.columns.map(() => '---').join(' | ') + ' |'
  const rows = result.rows.slice(0, 40).map(r => '| ' + result.columns.map(c => String(r[c] ?? '')).join(' | ') + ' |')
  return [header, sep, ...rows].join('\n') + (result.rows.length > 40 ? `\n_(showing 40 of ${result.rows.length} rows)_` : '')
}

export async function POST(req: Request) {
  const body = await req.json()
  const { message, history, data_context, connection_id, db_tables, db_name, db_type, insights_context, workspace_id, confirm_write, pending_sql } = body

  const aiClient = useAnthropic()
  let conn: any = null, connCfg: any = null, connType = db_type

  if (connection_id) {
    conn = await getConn(connection_id)
    if (conn) { connCfg = conn.config; connType = conn.db_type }
  }

  if (confirm_write && pending_sql && connCfg) {
    try {
      const result = await execQuery(connCfg, connType, pending_sql)
      const reply = result.ddl
        ? `Done. The operation completed successfully.\n\nIf this was a schema change, you may need to refresh the table list to see it.`
        : result.affected !== undefined ? `Done. **${result.affected} row(s) affected.**`
        : `Done.\n\n${fmtTable(result)}`
      return NextResponse.json({ reply, executed_sql: pending_sql })
    } catch (err: any) {
      return NextResponse.json({ reply: `The operation failed:\n\n\`\`\`\n${err.message}\n\`\`\``, error: true })
    }
  }

  const tableList = (db_tables || []).join(', ')
  const dialect = connType ? dialectGuide(connType) : ''

  const systemPrompt = `You are an expert data analyst with direct access to the connected database.

${connection_id ? `DATABASE: "${db_name}" (${connType})\nALL TABLES: ${tableList || 'none discovered yet'}\n\n${dialect}\n\nYou can run read queries: [QUERY: SELECT * FROM users LIMIT 10]\nYou can propose write/DDL: [WRITE: INSERT INTO users (name) VALUES ('Alice')]\n\nIMPORTANT RULES:\n- Use correct syntax for ${connType}\n- If a query fails, report the actual error\n- After a write is confirmed, tell the user to refresh to see the change` : 'No database connected. Tell the user to select a database from the left panel.'}

${data_context ? 'Data context:\n' + data_context : ''}
${insights_context ? 'Recent analysis:\n' + insights_context : ''}

Respond with markdown. Be direct, accurate, and honest about errors or limitations.`

  let preData = ''
  const isDataRequest = /\b(show|list|rows|data|records|count|how many|what|fetch|get)\b/i.test(message)
  if (connCfg && tableList && isDataRequest) {
    try {
      const genRes = await aiClient.messages.create({
        model: AGENT_MODEL, max_tokens: 300,
        system: `Generate a SELECT query for this request. Database engine: ${connType}. Tables: ${tableList}. ${dialect} Return ONLY the SELECT SQL, nothing else.`,
        messages: [{ role: 'user', content: message }]
      })
      const autoSql = genRes.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
        .replace(/^```sql\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
      if (autoSql && autoSql.toUpperCase().startsWith('SELECT')) {
        const result = await execQuery(connCfg, connType, autoSql, 50)
        if (result.rows.length > 0) preData = `\n\n[Live query result for: ${autoSql}]\n${fmtTable(result)}`
      }
    } catch (e: any) { preData = `\n\n[Pre-emptive query failed: ${e.message}]` }
  }

  const response = await aiClient.messages.create({
    model: AGENT_MODEL, max_tokens: 2000,
    system: systemPrompt,
    messages: [...(history || []).map((m: any) => ({ role: m.role, content: m.content })), { role: 'user', content: message + preData }]
  })

  let reply = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()

  const readRegex = /\[QUERY:\s*([\s\S]*?)\]/g
  let match; const queryParts: string[] = []
  while ((match = readRegex.exec(reply)) !== null) {
    if (connCfg) {
      try { queryParts.push('\n**Results:**\n' + fmtTable(await execQuery(connCfg, connType, match[1].trim(), 100))) }
      catch (e: any) { queryParts.push(`\n**Query error:** \`${e.message}\``) }
    }
  }
  reply = reply.replace(/\[QUERY:\s*[\s\S]*?\]/g, '').trim()
  if (queryParts.length) reply += queryParts.join('\n')

  const writeMatch = reply.match(/\[WRITE:\s*([\s\S]*?)\]/)
  if (writeMatch) {
    const writeSql = writeMatch[1].trim()
    reply = reply.replace(/\[WRITE:\s*[\s\S]*?\]/g, '').trim()
    reply += `\n\n**Proposed operation:**\n\`\`\`sql\n${writeSql}\n\`\`\`\n_Confirm below to execute this against the database._`
    return NextResponse.json({ reply, pending_write: writeSql })
  }

  return NextResponse.json({ reply })
}
