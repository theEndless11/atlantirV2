'use client'

/**
 * components/approvals/ApprovalCard.tsx
 *
 * Renders a single pending approval request.
 * Shows: action name, risk badge, params (editable), approve/reject buttons.
 * On approve: emits event via /api/approvals which resumes the paused workflow.
 */

import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AlertTriangle, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { ApprovalRequest } from '@/types'

interface ApprovalCardProps {
  approval: ApprovalRequest
  onResolved?: (id: string, decision: 'approve' | 'reject') => void
}

async function submitDecision(
  approvalId: string,
  decision: 'approve' | 'reject',
  editedParams?: Record<string, unknown>
) {
  const res = await fetch('/api/approvals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approvalId, decision, editedParams }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function ApprovalCard({ approval, onResolved }: ApprovalCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [paramsText, setParamsText] = useState(JSON.stringify(approval.action_params, null, 2))
  const [paramsError, setParamsError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDecision(decision: 'approve' | 'reject') {
    setError(null)
    let editedParams: Record<string, unknown> | undefined

    if (editMode && decision === 'approve') {
      try {
        editedParams = JSON.parse(paramsText)
        setParamsError(null)
      } catch {
        setParamsError('Invalid JSON — fix params before approving')
        return
      }
    }

    startTransition(async () => {
      try {
        await submitDecision(approval.id, decision, editedParams)
        onResolved?.(approval.id, decision)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Request failed')
      }
    })
  }

  const isDangerous = approval.risk_level === 'dangerous'
  const paramKeys = Object.keys(approval.action_params ?? {})

  return (
    <div className={`rounded-lg border bg-card shadow-sm overflow-hidden ${isDangerous ? 'border-orange-200 dark:border-orange-900' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        {isDangerous
          ? <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
          : <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate font-mono">{approval.action_name}</p>
          <p className="text-xs text-muted-foreground">{paramKeys.length} parameter{paramKeys.length !== 1 ? 's' : ''}</p>
        </div>
        <Badge variant={isDangerous ? 'destructive' : 'secondary'} className="text-xs shrink-0">
          {approval.risk_level}
        </Badge>
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors ml-1"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Params */}
      {expanded && (
        <div className="px-4 pb-3 border-t">
          <div className="flex items-center justify-between py-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Parameters</p>
            <button
              onClick={() => { setEditMode(v => !v); setParamsError(null) }}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              {editMode ? 'Cancel edit' : 'Edit params'}
            </button>
          </div>

          {editMode ? (
            <div className="space-y-1">
              <Textarea
                value={paramsText}
                onChange={e => setParamsText(e.target.value)}
                className="font-mono text-xs min-h-[120px] resize-y"
                spellCheck={false}
              />
              {paramsError && <p className="text-xs text-destructive">{paramsError}</p>}
            </div>
          ) : (
            <pre className="text-xs bg-muted rounded p-2.5 overflow-auto max-h-40 whitespace-pre">
              {JSON.stringify(approval.action_params, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end px-4 py-3 border-t bg-muted/30">
        {error && <p className="text-xs text-destructive flex-1">{error}</p>}
        <Button
          size="sm" variant="outline" disabled={isPending}
          onClick={() => handleDecision('reject')}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
        >
          <XCircle className="h-3.5 w-3.5 mr-1.5" />
          Reject
        </Button>
        <Button
          size="sm" disabled={isPending}
          onClick={() => handleDecision('approve')}
        >
          <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
          Approve
        </Button>
      </div>
    </div>
  )
}
