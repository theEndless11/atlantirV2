import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json()
  const botServiceUrl = process.env.BOT_SERVICE_URL || 'http://localhost:3021'
  const secret = process.env.BOT_SECRET || 'changeme'
  const res = await fetch(`${botServiceUrl}/bot/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bot-secret': secret },
    body: JSON.stringify(body),
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return NextResponse.json(await res.json())
}
