'use client'

import { useState, useTransition } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, Send, Eye, RotateCcw, FileText, Mail, BarChart2, Code2, Presentation, Video, Table2 } from 'lucide-react'
import type { Artifact, DataGridContent } from '@/types'
import { DataGridRenderer } from './DataGridRenderer'

const STATE_BADGE: Record<Artifact['state'], { label: string; variant: 'secondary' | 'outline' | 'default' | 'destructive' }> = {
  draft:    { label: 'Draft',    variant: 'secondary' },
  reviewed: { label: 'Reviewed', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  executed: { label: 'Executed', variant: 'default' },
}

const TYPE_ICON: Record<Artifact['type'], React.ReactNode> = {
  document: <FileText className="h-4 w-4" />,
  email:    <Mail className="h-4 w-4" />,
  chart:    <BarChart2 className="h-4 w-4" />,
  code:     <Code2 className="h-4 w-4" />,
  slides:   <Presentation className="h-4 w-4" />,
  video:    <Video className="h-4 w-4" />,
  datagrid: <Table2 className="h-4 w-4" />,
  other:    <FileText className="h-4 w-4" />,
  research: <FileText className="h-4 w-4" />,
}

function DocumentRenderer({ content }: { content: { markdown: string } }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{content.markdown}</pre>
    </div>
  )
}

function EmailRenderer({ content }: { content: { subject: string; to: string[]; body_mjml: string; cc?: string[] } }) {
  return (
    <div className="space-y-3 text-sm">
      <div><span className="text-muted-foreground">To: </span>{content.to.join(', ')}</div>
      {content.cc?.length ? <div><span className="text-muted-foreground">Cc: </span>{content.cc.join(', ')}</div> : null}
      <div><span className="text-muted-foreground">Subject: </span><strong>{content.subject}</strong></div>
      <Separator />
      <pre className="whitespace-pre-wrap font-sans leading-relaxed">{content.body_mjml}</pre>
    </div>
  )
}

function ChartRenderer({ content }: { content: { chartType: string; title: string; data: unknown[] } }) {
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{content.title}</p>
      <p>Type: {content.chartType} · {content.data.length} data points</p>
      <p className="text-xs">Full Tremor chart renderer loads in the task view.</p>
    </div>
  )
}

function CodeRenderer({ content }: { content: { language: string; files: Record<string, string> } }) {
  const [activeFile, setActiveFile] = useState(Object.keys(content.files)[0] ?? '')
  return (
    <div className="space-y-2">
      <div className="flex gap-1 flex-wrap">
        {Object.keys(content.files).map(f => (
          <button
            key={f}
            onClick={() => setActiveFile(f)}
            className={`text-xs px-2 py-0.5 rounded border ${activeFile === f ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
          >
            {f}
          </button>
        ))}
      </div>
      <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-80 whitespace-pre">
        {content.files[activeFile] ?? ''}
      </pre>
    </div>
  )
}

function GenericRenderer({ content }: { content: Record<string, unknown> }) {
  return (
    <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-80">
      {JSON.stringify(content, null, 2)}
    </pre>
  )
}

function ArtifactContent({
  artifact,
  onDataGridChange,
}: {
  artifact: Artifact
  onDataGridChange?: (content: DataGridContent) => void
}) {
  const c = artifact.content as any
  switch (artifact.type) {
    case 'document': return <DocumentRenderer content={c} />
    case 'email':    return <EmailRenderer content={c} />
    case 'chart':    return <ChartRenderer content={c} />
    case 'code':     return <CodeRenderer content={c} />
    case 'datagrid': return (
      <DataGridRenderer
        artifact={artifact as any}
        onDataChange={onDataGridChange}
      />
    )
    default: return <GenericRenderer content={c} />
  }
}

async function transitionArtifact(
  artifactId: string,
  workspaceId: string,
  action: 'review' | 'approve' | 'execute'
): Promise<Artifact> {
  const res = await fetch('/api/artifacts', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artifactId, workspaceId, action }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

interface ArtifactPanelProps {
  artifact: Artifact
  workspaceId: string
  onUpdate?: (updated: Artifact) => void
  onDataGridChange?: (content: DataGridContent) => void
}

export function ArtifactPanel({ artifact, workspaceId, onUpdate, onDataGridChange }: ArtifactPanelProps) {
  const [current, setCurrent] = useState(artifact)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const badge = STATE_BADGE[current.state] ?? { label: current.state, variant: 'secondary' as const }
  const icon = TYPE_ICON[current.type] ?? <FileText className="h-4 w-4" />

  function handleTransition(action: 'review' | 'approve' | 'execute') {
    setError(null)
    startTransition(async () => {
      try {
        const updated = await transitionArtifact(current.id, workspaceId, action)
        setCurrent(updated)
        onUpdate?.(updated)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed')
      }
    })
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-muted-foreground shrink-0">{icon}</span>
          <span className="font-medium text-sm truncate">{current.title}</span>
          {current.version > 1 && (
            <span className="text-xs text-muted-foreground shrink-0">v{current.version}</span>
          )}
        </div>
        <Badge variant={badge.variant} className="shrink-0 ml-2 text-xs">{badge.label}</Badge>
      </div>

      <div className="p-4 max-h-[420px] overflow-y-auto">
        <ArtifactContent artifact={current} onDataGridChange={onDataGridChange} />
      </div>

      {current.state !== 'executed' && (
        <>
          <Separator />
          <div className="flex items-center justify-between px-4 py-3 gap-2">
            {error && <p className="text-xs text-destructive flex-1">{error}</p>}

            <div className="flex gap-2 ml-auto">
              {current.state === 'draft' && (
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleTransition('review')}>
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  Mark Reviewed
                </Button>
              )}

              {current.state === 'reviewed' && (
                <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleTransition('approve')}>
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  Approve
                </Button>
              )}

              {current.state === 'approved' && (
                <>
                  <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleTransition('review')}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Request Changes
                  </Button>
                  <Button size="sm" disabled={isPending} onClick={() => handleTransition('execute')}>
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Execute
                  </Button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}