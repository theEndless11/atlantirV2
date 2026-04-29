import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
  const body = await req.json()
  const { meeting_id, transcript, bot_session_id, bot_platform, bot_transcript } = body
  if (!meeting_id) return NextResponse.json({ error: 'meeting_id required' }, { status: 400 })

  const sb = supabaseAdmin()
  const updatePayload: Record<string, any> = { status: 'ended', ended_at: new Date().toISOString() }
  if (transcript !== undefined) updatePayload.transcript = transcript
  if (bot_session_id) updatePayload.bot_session_id = bot_session_id
  if (bot_platform) updatePayload.bot_platform = bot_platform
  if (bot_transcript) updatePayload.bot_transcript = bot_transcript

  const { data: meeting, error } = await sb.from('meetings').update(updatePayload).eq('id', meeting_id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire meeting_end workflows in background
  if (meeting.workspace_id && transcript) {
    const workspaceId = meeting.workspace_id
    sb.from('workflows').select('id').eq('workspace_id', workspaceId)
      .eq('trigger', 'meeting_end').eq('enabled', true)
      .then(async ({ data: workflows }) => {
        if (!workflows?.length) return
        const base = process.env.APP_URL || 'http://localhost:3000'
        await Promise.all(workflows.map((wf: any) =>
          fetch(`${base}/api/workflows/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workflow_id: wf.id,
              triggered_by: 'meeting_end',
              context: transcript,
              variables: { transcript: transcript.slice(0, 2000), date: new Date().toLocaleDateString() },
            }),
          })
        ))
      })
  }

  return NextResponse.json(meeting)
}
