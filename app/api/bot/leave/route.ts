import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const body = await req.json()
  const botServiceUrl = process.env.BOT_SERVICE_URL || 'https://agent.endless.sbs'
  const secret = process.env.BOT_SECRET || 'changeme'
  const res = await fetch(`${botServiceUrl}/bot/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bot-secret': secret },
    body: JSON.stringify(body),
  })
  if (res.status === 404) return NextResponse.json({ status: 'already_stopped' })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status })
  return NextResponse.json(await res.json())
}
