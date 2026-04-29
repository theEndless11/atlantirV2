import { NextResponse } from 'next/server'
import { useAnthropic, AGENT_MODEL } from '@/lib/anthropic'

const DIALECT_HINTS: Record<string, string> = {
  cassandra: `CQL rules: ALTER TABLE tbl ADD colname datatype (NO "COLUMN"). No JOINs. LIMIT on all SELECTs. Types: text, int, bigint, boolean, uuid, timestamp, list<text>, map<text,text>`,
  scylla: `CQL (ScyllaDB) — same rules as Cassandra`,
  mysql: `MySQL syntax — VARCHAR/TEXT, backticks for identifiers, LIMIT for pagination`,
  mariadb: `MariaDB — same as MySQL`,
  postgres: `PostgreSQL — TEXT/JSONB, gen_random_uuid(), RETURNING clause`,
  supabase: `PostgreSQL — same as postgres`,
}

export async function POST(req: Request) {
  const { prompt, tables, db_type } = await req.json()
  const dialectHint = DIALECT_HINTS[db_type] || DIALECT_HINTS['postgres']

  const client = useAnthropic()
  const response = await client.messages.create({
    model: AGENT_MODEL, max_tokens: 400,
    system: `Generate a valid query for this database.\n\nDatabase engine: ${db_type || 'postgres'}\n${dialectHint}\n\nAvailable tables: ${(tables || []).join(', ')}\n\nReturn ONLY the raw SQL/CQL query, no explanation, no markdown fences, no comments.`,
    messages: [{ role: 'user', content: prompt }]
  })

  const sql = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
    .replace(/^```sql\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

  return NextResponse.json({ sql })
}
