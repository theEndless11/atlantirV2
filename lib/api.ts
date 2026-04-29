import { NextResponse } from 'next/server'

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export async function parseBody<T>(req: Request): Promise<T> {
  try { return await req.json() }
  catch { return {} as T }
}
