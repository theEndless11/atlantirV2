import { NextResponse } from 'next/server'
import { useAnthropic, AGENT_MODEL } from '@/lib/anthropic'

export async function POST(req: Request) {
  const body = await req.json()
  const { question, data_sample, column_stats, total_rows } = body
  if (!question || !data_sample)
    return NextResponse.json({ error: 'question and data required' }, { status: 400 })

  const client = useAnthropic()
  const systemPrompt = `You are a data analyst AI. You receive a dataset sample and answer questions about it.

Always respond with valid JSON only, no markdown fences:
{
  "answer": "detailed markdown explanation with insights",
  "key_metrics": [{"label": "metric name", "value": "formatted value"}],
  "chart_type": "bar|line|pie|doughnut|scatter|null",
  "chart_data": { "type": "bar", "labels": [...], "datasets": [{"label": "...", "data": [...], "backgroundColor": ["#6366f1","#10b981","#f59e0b","#ef4444","#3b82f6"]}] }
}

Rules: answer must be substantive markdown with specific numbers. chart_data must be valid Chart.js format if a chart helps. Always reference specific values from the data. Identify trends, outliers, and actionable insights.`

  const response = await client.messages.create({
    model: AGENT_MODEL, max_tokens: 2000, system: systemPrompt,
    messages: [{ role: 'user', content: `Dataset: ${total_rows} rows, columns: ${column_stats}\n\nSample data:\n${JSON.stringify(data_sample, null, 2)}\n\nQuestion: ${question}` }]
  })

  const raw = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()

  try { return NextResponse.json(JSON.parse(raw)) }
  catch { return NextResponse.json({ answer: raw, key_metrics: [], chart_type: null, chart_data: null }) }
}
