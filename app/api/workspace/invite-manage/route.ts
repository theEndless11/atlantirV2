import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const body = await req.json()
  const { workspace_id, action } = body
  if (!workspace_id) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const sb = supabaseAdmin()
  if (action === 'disable') {
    await sb.from('workspaces').update({ invite_enabled: false }).eq('id', workspace_id)
    return NextResponse.json({ success: true, invite_enabled: false })
  }
  if (action === 'enable') {
    await sb.from('workspaces').update({ invite_enabled: true }).eq('id', workspace_id)
    return NextResponse.json({ success: true, invite_enabled: true })
  }
  // regenerate
  const newToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  await sb.from('workspaces').update({ invite_token: newToken, invite_enabled: true }).eq('id', workspace_id)
  return NextResponse.json({ success: true, invite_token: newToken })
}
