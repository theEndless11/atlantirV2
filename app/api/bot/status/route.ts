import { NextResponse } from 'next/server'

const BOT_URL = () => process.env.BOT_SERVICE_URL || 'http://localhost:3021'
const BOT_SECRET = () => process.env.BOT_SECRET || 'changeme'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const res = await fetch(`${BOT_URL()}/bot/status/${id}`, { headers: { 'x-bot-secret': BOT_SECRET() } })
  if (!res.ok) return NextResponse.json({ error: 'Session not found' }, { status: res.status })
  return NextResponse.json(await res.json())
}
