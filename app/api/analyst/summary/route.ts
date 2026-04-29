import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()
const AGENT_MODEL = 'claude-opus-4-5'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data_sample, column_stats, name, total_rows, db_tables } = body

  const dbTablesStr = db_tables?.length ? 'Database tables: ' + db_tables.join(', ') + '. ' : ''
  const statsStr = Array.isArray(column_stats)
    ? column_stats.map((c: any) => c.type === 'number' ? `${c.name}(${c.min}–${c.max})` : `${c.name}(${c.uniques}unique)`).join(', ')
    : column_stats

  const response = await client.messages.create({
    model: AGENT_MODEL,
    max_tokens: 2000,
    system: `You are a senior data analyst. Generate a comprehensive analysis report in markdown.
Include: ## Executive Summary, ## Key Metrics, ## Trends & Patterns, ## Anomalies & Outliers, ## Recommendations
Be specific with numbers. Format as clean markdown.`,
    messages: [{
      role: 'user',
      content: `${dbTablesStr}Dataset: ${name}, ${total_rows} rows\nColumns: ${statsStr}\nSample data: ${JSON.stringify(data_sample?.slice(0, 40))}\n\nGenerate a full analysis report with specific insights from the actual data provided.`
    }]
  })

  const content = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
  return NextResponse.json({ title: `Analysis Report — ${name}`, content })
}
