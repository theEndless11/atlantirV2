/**
 * app/api/artifacts/datagrid-ai/route.ts
 *
 * POST  { headers: string[], rows: string[][], prompt: string }
 *   → calls Claude to transform the grid data
 *   → returns { headers: string[], rows: string[][] }
 *
 * Claude is instructed to always return valid JSON with exactly these two
 * keys so parsing is safe and deterministic.
 */

import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(req: Request) {
  try {
    const { headers, rows, prompt } = await req.json() as {
      headers: string[]
      rows: string[][]
      prompt: string
    }

    if (!headers || !rows || !prompt) {
      return NextResponse.json({ error: 'headers, rows, and prompt are required' }, { status: 400 })
    }

    // Represent data as a compact CSV string so we stay well within context
    const MAX_ROWS = 500
    const csvLines = [
      headers.join(','),
      ...rows.slice(0, MAX_ROWS).map(r =>
        r.map(v => (String(v).includes(',') ? `"${v.replace(/"/g, '""')}"` : v)).join(',')
      ),
    ]
    const csvStr = csvLines.join('\n')
    const truncated = rows.length > MAX_ROWS
      ? `\n(showing first ${MAX_ROWS} of ${rows.length} rows)` : ''

    const systemPrompt = `You are a data transformation assistant embedded in a spreadsheet application.
The user will give you a CSV dataset and a plain-English instruction.
You MUST return ONLY a valid JSON object with exactly two keys:
  - "headers": string[] — the (possibly modified) column headers
  - "rows": string[][] — the (possibly modified) 2-D array of cell values (all values as strings)

Rules:
1. Preserve all rows unless the user explicitly asks to filter or remove rows.
2. When adding a computed column (e.g. Bonus), calculate the actual numeric values.
3. When sorting, reorder the rows array — do NOT change headers order.
4. Numbers must be stored as strings (e.g. "95000", "4.2").
5. Dates must remain in their original format unless the user asks to change them.
6. Return ONLY the JSON object. No markdown, no explanation, no code fences.
7. If the dataset was truncated, apply the transformation consistently across all rows you received.`

    const userMessage = `Here is the spreadsheet data:\n\`\`\`csv\n${csvStr}${truncated}\n\`\`\`\n\nInstruction: ${prompt}`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    // Strip accidental markdown fences
    const clean = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    const result = JSON.parse(clean) as { headers: string[]; rows: string[][] }

    // Basic shape validation
    if (!Array.isArray(result.headers) || !Array.isArray(result.rows)) {
      throw new Error('Invalid shape returned by model')
    }

    return NextResponse.json(result)

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[datagrid-ai] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}