import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, supabaseServer } from '@/lib/supabase'

// ─── GET ?workspaceId= ────────────────────────────────────────────────────────
// List pending (and recent) approval requests for a workspace dashboard.

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get('workspaceId')
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId query param is required' }, { status: 400 })
  }

  // Auth: require authenticated workspace member
  const sbUser = await supabaseServer()
  const { data: { user } } = await sbUser.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = supabaseAdmin()

  // Verify user is a member of this workspace
  const { data: membership } = await sb
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await sb
    .from('approval_requests')
    .select('*')
    .eq('workspace_id', workspaceId)
    .in('state', ['pending', 'approved', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error('[approvals GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// ─── POST { approvalId, decision, editedParams? } ─────────────────────────────
// Approve or reject a pending approval request.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { approvalId, decision, editedParams } = body as {
    approvalId?: string
    decision?: 'approve' | 'reject'
    editedParams?: Record<string, unknown>
  }

  if (!approvalId || !decision) {
    return NextResponse.json(
      { error: 'approvalId and decision are required' },
      { status: 400 }
    )
  }
  if (decision !== 'approve' && decision !== 'reject') {
    return NextResponse.json(
      { error: 'decision must be "approve" or "reject"' },
      { status: 400 }
    )
  }

  // Auth: require authenticated user
  const sbUser = await supabaseServer()
  const { data: { user } } = await sbUser.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = supabaseAdmin()

  // Look up the approval request
  const { data: approval, error: fetchErr } = await sb
    .from('approval_requests')
    .select('*')
    .eq('id', approvalId)
    .single()

  if (fetchErr || !approval) {
    return NextResponse.json({ error: 'Approval request not found' }, { status: 404 })
  }

  // Verify user is a member of the approval's workspace
  const { data: membership } = await sb
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', approval.workspace_id)
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (approval.state !== 'pending') {
    return NextResponse.json(
      { error: `Approval is already in state "${approval.state}"` },
      { status: 409 }
    )
  }

  // Update the approval state
  const updatePayload: Record<string, unknown> = {
    state: decision === 'approve' ? 'approved' : 'rejected',
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  }

  if (decision === 'approve' && editedParams) {
    updatePayload.edited_params = editedParams
  }

  const { error: updateErr } = await sb
    .from('approval_requests')
    .update(updatePayload)
    .eq('id', approvalId)

  if (updateErr) {
    console.error('[approvals POST] update error:', updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // ── Notify waiting Workflow SDK task to resume ──────────────────────────────
  // TODO: Replace this stub with your Workflow SDK's actual event emit mechanism
  // once the Workflow SDK package is installed.
  //
  // Option A — Supabase Realtime broadcast (works without any extra infra):
  await sb.channel(`approval:${approvalId}`).send({
    type: 'broadcast',
    event: 'decision',
    payload: {
      approvalId,
      decision,
      reviewedBy: user.id,
      editedParams: editedParams ?? null,
    },
  })

  // Option B — Workflow SDK webhook (when SDK is available):
  // const workflowWebhookUrl = process.env.WORKFLOW_SDK_WEBHOOK_URL
  // if (workflowWebhookUrl && approval.workflow_run_id) {
  //   await fetch(`${workflowWebhookUrl}/events`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.WORKFLOW_SDK_SECRET}` },
  //     body: JSON.stringify({
  //       runId: approval.workflow_run_id,
  //       event: 'approval_decision',
  //       data: { approvalId, decision, editedParams }
  //     })
  //   })
  // }

  return NextResponse.json({
    ok: true,
    approvalId,
    state: updatePayload.state,
    reviewedBy: user.id,
  })
}
