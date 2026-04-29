/**
 * app/workspace/[id]/tasks/[taskId]/page.tsx
 *
 * Task detail page — real-time status, message thread, artifacts, approvals.
 * Uses SWR polling for live updates (Supabase realtime is a future upgrade).
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ArtifactPanel } from '@/components/artifacts/ArtifactPanel'
import { ApprovalCard } from '@/components/approvals/ApprovalCard'
import { ArrowLeft, Clock, CheckCircle2, AlertCircle, Loader2, User, Bot } from 'lucide-react'
import Link from 'next/link'
import type { Task, Message, Artifact, ApprovalRequest } from '@/types'

// ---------------------------------------------------------------------------
// Status display helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<Task['status'], { label: string; icon: React.ReactNode; variant: 'secondary' | 'outline' | 'default' | 'destructive' }> = {
  pending_approval: { label: 'Pending Approval', icon: <Clock className="h-3.5 w-3.5" />, variant: 'outline' },
  approved:         { label: 'Approved',          icon: <CheckCircle2 className="h-3.5 w-3.5" />, variant: 'outline' },
  in_progress:      { label: 'In Progress',        icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, variant: 'secondary' },
  awaiting_human:   { label: 'Needs Approval',     icon: <AlertCircle className="h-3.5 w-3.5" />, variant: 'destructive' },
  needs_clarification: { label: 'Needs Clarification', icon: <AlertCircle className="h-3.5 w-3.5" />, variant: 'outline' },
  completed:        { label: 'Completed',          icon: <CheckCircle2 className="h-3.5 w-3.5" />, variant: 'default' },
  rejected:         { label: 'Rejected',           icon: <AlertCircle className="h-3.5 w-3.5" />, variant: 'destructive' },
}

const PRIORITY_BADGE: Record<string, string> = {
  low: 'text-muted-foreground',
  medium: 'text-blue-600 dark:text-blue-400',
  high: 'text-orange-600 dark:text-orange-400',
  urgent: 'text-red-600 dark:text-red-400',
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

interface TaskPageData {
  task: Task & { employee?: { id: string; name: string; avatar_url?: string } }
  messages: Message[]
  artifacts: Artifact[]
  pendingApprovals: ApprovalRequest[]
}

async function fetchTaskStatus(taskId: string, workspaceId: string): Promise<TaskPageData> {
  const res = await fetch(`/api/tasks/status?taskId=${taskId}&workspaceId=${workspaceId}`)
  if (!res.ok) throw new Error('Failed to fetch task')
  return res.json()
}

// ---------------------------------------------------------------------------
// Message thread
// ---------------------------------------------------------------------------

function MessageThread({ messages }: { messages: Message[] }) {
  if (!messages.length) return (
    <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
  )

  return (
    <div className="space-y-3">
      {messages.map(m => {
        const isAgent = m.sender_type === 'agent'
        return (
          <div key={m.id} className={`flex gap-2.5 ${isAgent ? '' : 'flex-row-reverse'}`}>
            <div className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center text-xs ${isAgent ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {isAgent ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${isAgent ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
              {m.content}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TaskDetailPage({
  params,
}: {
  params: { id: string; taskId: string }
}) {
  const { id: workspaceId, taskId } = params

  const [data, setData] = useState<TaskPageData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resolvedApprovals, setResolvedApprovals] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    try {
      const d = await fetchTaskStatus(taskId, workspaceId)
      setData(d)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task')
    }
  }, [taskId, workspaceId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Poll while task is active
  useEffect(() => {
    const active = data?.task.status === 'in_progress' || data?.task.status === 'awaiting_human'
    if (!active) return
    const interval = setInterval(refresh, 3000)
    return () => clearInterval(interval)
  }, [data?.task.status, refresh])

  if (error) return (
    <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">{error}</div>
  )
  if (!data) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )

  const { task, messages, artifacts, pendingApprovals } = data
  const status = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.in_progress
  const visibleApprovals = pendingApprovals.filter(a => !resolvedApprovals.has(a.id))

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Back link */}
      <Link
        href={`/workspace/${workspaceId}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to workspace
      </Link>

      {/* Task header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-semibold leading-tight">{task.title}</h1>
          <Badge variant={status.variant} className="shrink-0 flex items-center gap-1.5 text-xs">
            {status.icon}
            {status.label}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {task.employee && (
            <span className="flex items-center gap-1">
              <Bot className="h-3 w-3" />
              {task.employee.name}
            </span>
          )}
          <span className={`font-medium ${PRIORITY_BADGE[task.priority ?? 'medium']}`}>
            {(task.priority ?? 'medium').toUpperCase()}
          </span>
          <span>{new Date(task.created_at).toLocaleDateString()}</span>
        </div>

        {task.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: thread + approvals */}
        <div className="lg:col-span-2 space-y-5">
          {/* Pending approvals */}
          {visibleApprovals.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                Needs your approval
              </h2>
              {visibleApprovals.map(a => (
                <ApprovalCard
                  key={a.id}
                  approval={a}
                  onResolved={(id) => setResolvedApprovals(prev => new Set([...prev, id]))}
                />
              ))}
              <Separator />
            </div>
          )}

          {/* Message thread */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Activity</h2>
            <MessageThread messages={messages} />
          </div>
        </div>

        {/* Right: artifacts */}
        <div className="space-y-4">
          {artifacts.length > 0 && (
            <>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Artifacts</h2>
              <div className="space-y-3">
                {artifacts.map(a => (
                  <ArtifactPanel
                    key={a.id}
                    artifact={a}
                    workspaceId={workspaceId}
                    onUpdate={(updated) => {
                      setData(prev => prev ? {
                        ...prev,
                        artifacts: prev.artifacts.map(x => x.id === updated.id ? updated : x),
                      } : prev)
                    }}
                  />
                ))}
              </div>
            </>
          )}

          {artifacts.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No artifacts yet — the agent will create them as it works.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
