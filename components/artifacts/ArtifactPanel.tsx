'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, Send, Eye, RotateCcw, FileText, Mail, BarChart2, Code2, Presentation, Video, Table2, TrendingUp, AlignLeft, Maximize2, Minimize2, X, LayoutTemplate } from 'lucide-react'
import type { Artifact, DataGridContent } from '@/types'
import { DataGridRenderer } from './DataGridRenderer'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'

const STATE_BADGE: Record<Artifact['state'], { label: string; variant: 'secondary' | 'outline' | 'default' | 'destructive' }> = {
  draft:    { label: 'Draft',    variant: 'secondary' },
  reviewed: { label: 'Reviewed', variant: 'outline' },
  approved: { label: 'Approved', variant: 'default' },
  executed: { label: 'Executed', variant: 'default' },
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  document: <FileText className="h-4 w-4" />,
  email:    <Mail className="h-4 w-4" />,
  chart:    <BarChart2 className="h-4 w-4" />,
  code:     <Code2 className="h-4 w-4" />,
  slides:   <Presentation className="h-4 w-4" />,
  video:    <Video className="h-4 w-4" />,
  datagrid: <Table2 className="h-4 w-4" />,
  table:    <Table2 className="h-4 w-4" />,
  graph:    <TrendingUp className="h-4 w-4" />,
  richtext: <AlignLeft className="h-4 w-4" />,
  composite: <LayoutTemplate className="h-4 w-4" />,
  other:    <FileText className="h-4 w-4" />,
  research: <FileText className="h-4 w-4" />,
}

// ── Fullscreen wrapper ────────────────────────────────────────────────────────
function FullscreenModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', flexDirection: 'column',
      animation: 'fadeIn .18s ease'
    }}>
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '12px 20px', gap: 12, flexShrink: 0
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', flex: 1 }}>{title}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 6, borderRadius: 6 }}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 32, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}

// ── Renderers ─────────────────────────────────────────────────────────────────

function DocumentRenderer({ content, fullscreen }: { content: any; fullscreen?: boolean }) {
  const md = content.markdown || content.body || ''
  return <div style={{ maxWidth: fullscreen ? 860 : 'none', margin: fullscreen ? '0 auto' : undefined }}><MarkdownRenderer content={md} size={fullscreen ? 'lg' : 'sm'} /></div>
}

function EmailRenderer({ content, fullscreen }: { content: any; fullscreen?: boolean }) {
  return (
    <div className="space-y-3 text-sm">
      <div><span className="text-muted-foreground">To: </span>{(content.to || []).join(', ')}</div>
      {content.cc?.length ? <div><span className="text-muted-foreground">Cc: </span>{content.cc.join(', ')}</div> : null}
      <div><span className="text-muted-foreground">Subject: </span><strong>{content.subject}</strong></div>
      <Separator />
      <pre className="whitespace-pre-wrap font-sans leading-relaxed">{content.body_mjml || content.body}</pre>
    </div>
  )
}

function CodeRenderer({ content }: { content: any }) {
  const files = content.files || (content.code ? { [content.filename || 'main']: content.code } : {})
  const [activeFile, setActiveFile] = useState(Object.keys(files)[0] ?? '')
  return (
    <div className="space-y-2">
      <div className="flex gap-1 flex-wrap">
        {Object.keys(files).map(f => (
          <button key={f} onClick={() => setActiveFile(f)}
            className={`text-xs px-2 py-0.5 rounded border ${activeFile === f ? 'bg-muted font-medium' : 'text-muted-foreground'}`}
          >{f}</button>
        ))}
      </div>
      {content.explanation && <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '4px 0 8px' }}>{content.explanation}</p>}
      <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-80 whitespace-pre">{files[activeFile] ?? ''}</pre>
    </div>
  )
}

// ── Rich Text Renderer ────────────────────────────────────────────────────────
function RichTextRenderer({ content, fullscreen }: { content: any; fullscreen?: boolean }) {
  const md = content.markdown || content.body || ''
  return (
    <div style={{ maxWidth: fullscreen ? 860 : 'none', margin: fullscreen ? '0 auto' : undefined }}>
      {content.title && <h2 style={{ fontSize: fullscreen ? 22 : 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-1)' }}>{content.title}</h2>}
      <MarkdownRenderer content={md} size={fullscreen ? 'lg' : 'md'} />
    </div>
  )
}

// ── Table Renderer ────────────────────────────────────────────────────────────
function TableRenderer({ content, fullscreen }: { content: any; fullscreen?: boolean }) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [filter, setFilter] = useState('')

  const columns: string[] = content.columns || (content.rows?.[0] ? Object.keys(content.rows[0]) : [])
  let rows: Record<string, any>[] = content.rows || []

  if (filter) {
    const q = filter.toLowerCase()
    rows = rows.filter(r => columns.some(c => String(r[c] ?? '').toLowerCase().includes(q)))
  }

  if (sortCol) {
    rows = [...rows].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol]
      const an = parseFloat(av), bn = parseFloat(bv)
      if (!isNaN(an) && !isNaN(bn)) return sortDir === 'asc' ? an - bn : bn - an
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {(content.filterable !== false) && (
        <input
          placeholder="Filter rows..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ padding: '7px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', color: 'var(--text-1)', outline: 'none', width: fullscreen ? 320 : '100%', boxSizing: 'border-box' }}
        />
      )}
      <div style={{ flex: 1, overflow: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fullscreen ? 14 : 12 }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col}
                  onClick={() => content.sortable !== false && toggleSort(col)}
                  style={{
                    padding: fullscreen ? '10px 14px' : '7px 12px',
                    textAlign: 'left', fontWeight: 600,
                    color: 'var(--text-2)', fontSize: fullscreen ? 12 : 10,
                    textTransform: 'uppercase', letterSpacing: '.05em',
                    background: 'var(--surface-2)',
                    position: 'sticky', top: 0, borderBottom: '1px solid var(--border)',
                    whiteSpace: 'nowrap',
                    cursor: content.sortable !== false ? 'pointer' : 'default',
                    userSelect: 'none'
                  }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {col}
                    {sortCol === col && <span style={{ fontSize: 9 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                {columns.map(col => (
                  <td key={col} style={{ padding: fullscreen ? '9px 14px' : '6px 12px', borderBottom: '1px solid var(--border-soft)', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-3)', fontSize: 13 }}>No results</div>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{rows.length} of {content.rows?.length ?? 0} rows</div>
    </div>
  )
}

// ── Graph Renderer ────────────────────────────────────────────────────────────
function GraphRenderer({ content, fullscreen }: { content: any; fullscreen?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!(window as any).Chart) {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js'
      s.onload = () => setReady(true)
      document.head.appendChild(s)
    } else {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    if (!ready || !canvasRef.current) return
    const Chart = (window as any).Chart
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

    // Professional palette — works on dark and light backgrounds
    const palette = [
      '#6366f1', '#10b981', '#f59e0b', '#3b82f6',
      '#ec4899', '#8b5cf6', '#14b8a6', '#f97316',
    ]
    const isPie = ['pie', 'doughnut'].includes(content.chartType)
    const chartType = content.chartType === 'area' ? 'line' : content.chartType

    const datasets = (content.datasets || []).map((ds: any, i: number) => {
      const color = ds.color || palette[i % palette.length]
      const isLine = ['line', 'area'].includes(content.chartType)
      return {
        label: ds.label,
        data: ds.data,
        backgroundColor: isPie
          ? palette.map(c => c + 'cc')
          : isLine ? color + '22' : color + 'cc',
        borderColor: isPie ? palette.map(c => c) : color,
        borderWidth: isLine ? 2.5 : 1.5,
        fill: content.chartType === 'area',
        tension: 0.42,
        pointBackgroundColor: color,
        pointBorderColor: '#1a1d27',
        pointBorderWidth: 2,
        pointRadius: isLine ? 4 : 0,
        pointHoverRadius: 6,
      }
    })

    const gridColor = 'rgba(255,255,255,0.06)'
    const tickColor = 'rgba(255,255,255,0.35)'
    const fontFamily = "'Inter', 'system-ui', sans-serif"

    chartRef.current = new Chart(canvasRef.current, {
      type: chartType,
      data: { labels: content.labels || [], datasets },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 600, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: tickColor,
              font: { family: fontFamily, size: fullscreen ? 13 : 11 },
              padding: 18,
              usePointStyle: true,
              pointStyleWidth: 10,
            },
          },
          title: content.title ? {
            display: true,
            text: content.title,
            color: 'rgba(255,255,255,0.85)',
            font: { family: fontFamily, size: fullscreen ? 16 : 13, weight: '600' },
            padding: { bottom: 20 },
          } : { display: false },
          tooltip: {
            backgroundColor: 'rgba(15,17,23,0.95)',
            titleColor: 'rgba(255,255,255,0.9)',
            bodyColor: 'rgba(255,255,255,0.65)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            titleFont: { family: fontFamily, weight: '600', size: 12 },
            bodyFont: { family: fontFamily, size: 12 },
          },
        },
        scales: !isPie ? {
          x: {
            grid: { color: gridColor, drawBorder: false },
            ticks: { color: tickColor, font: { family: fontFamily, size: fullscreen ? 12 : 10 }, maxRotation: 45 },
            border: { color: 'transparent' },
          },
          y: {
            grid: { color: gridColor, drawBorder: false },
            ticks: { color: tickColor, font: { family: fontFamily, size: fullscreen ? 12 : 10 } },
            border: { color: 'transparent' },
          },
        } : undefined,
        ...content.options,
      }
    })

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [ready, content, fullscreen])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '8px 0' }}>
      {!ready && <div style={{ padding: 24, color: 'var(--text-3)', fontSize: 13 }}>Loading chart...</div>}
      <canvas ref={canvasRef} style={{ maxHeight: fullscreen ? 'calc(100vh - 200px)' : 360, width: '100%' }} />
    </div>
  )
}

// ── ChartRenderer (legacy) ────────────────────────────────────────────────────
function ChartRenderer({ content }: { content: any }) {
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">{content.title}</p>
      <p>Type: {content.chartType || content.chart_type} · {(content.data || []).length} data points</p>
    </div>
  )
}

function GenericRenderer({ content }: { content: Record<string, unknown> }) {
  return <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-80">{JSON.stringify(content, null, 2)}</pre>
}

// ── Composite Renderer ───────────────────────────────────────────────────────
// Renders multiple blocks (text + table + graph + code) in sequence
function CompositeRenderer({ content, fullscreen }: { content: any; fullscreen?: boolean }) {
  const blocks: any[] = content.blocks || []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: fullscreen ? 40 : 24 }}>
      {content.summary && (
        <p style={{ fontSize: 13.5, lineHeight: 1.75, color: 'var(--text-1, #f1f5f9)', margin: '0 0 16px 0', opacity: 0.9 }}>
          {content.summary}
        </p>
      )}
      {blocks.map((block: any, i: number) => (
        <div key={i}>
          {block.type === 'text' && (
            <MarkdownRenderer content={block.content || ''} size={fullscreen ? 'md' : 'sm'} />
          )}
          {block.type === 'table' && <TableRenderer content={block} fullscreen={fullscreen} />}
          {block.type === 'graph' && <GraphRenderer content={block} fullscreen={fullscreen} />}
          {block.type === 'code' && (
            <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px', fontSize: 12, fontFamily: 'monospace', overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0 }}>
              {block.content || ''}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Artifact Content Router ───────────────────────────────────────────────────
function ArtifactContent({
  artifact, onDataGridChange, fullscreen,
}: {
  artifact: Artifact
  onDataGridChange?: (content: DataGridContent) => void
  fullscreen?: boolean
}) {
  let c = artifact.content as any
  // Supabase can return JSONB as raw string — parse defensively
  if (typeof c === 'string') { try { c = JSON.parse(c) } catch { c = { markdown: c } } }
  switch (artifact.type) {
    case 'document': return <DocumentRenderer content={c} fullscreen={fullscreen} />
    case 'email':    return <EmailRenderer content={c} fullscreen={fullscreen} />
    case 'chart':    return <ChartRenderer content={c} />
    case 'code':     return <CodeRenderer content={c} />
    case 'datagrid': return <DataGridRenderer artifact={artifact as any} onDataChange={onDataGridChange} />
    case 'table':    return <TableRenderer content={c} fullscreen={fullscreen} />
    case 'graph':    return <GraphRenderer content={c} fullscreen={fullscreen} />
    case 'richtext': return <RichTextRenderer content={c} fullscreen={fullscreen} />
    case 'composite': return <CompositeRenderer content={c} fullscreen={fullscreen} />
    default:
      // 'other' type — render markdown if present, else generic
      if (c?.markdown || c?.body) return <RichTextRenderer content={c} fullscreen={fullscreen} />
      return <GenericRenderer content={c} />
  }
}

async function transitionArtifact(artifactId: string, workspaceId: string, action: 'review' | 'approve' | 'execute'): Promise<Artifact> {
  const res = await fetch('/api/artifacts', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artifactId, workspaceId, action }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

const FULLSCREEN_TYPES = new Set(['table', 'graph', 'richtext', 'datagrid', 'composite', 'document', 'email', 'chart', 'code', 'research', 'other'])

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
  const [isFullscreen, setIsFullscreen] = useState(false)

  const badge = STATE_BADGE[current.state] ?? { label: current.state, variant: 'secondary' as const }
  const icon = TYPE_ICON[current.type] ?? <FileText className="h-4 w-4" />
  const canFullscreen = FULLSCREEN_TYPES.has(current.type)

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
    <>
      {isFullscreen && (
        <FullscreenModal title={current.title} onClose={() => setIsFullscreen(false)}>
          <ArtifactContent artifact={current} onDataGridChange={onDataGridChange} fullscreen />
        </FullscreenModal>
      )}

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/40">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-muted-foreground shrink-0">{icon}</span>
            <span className="font-medium text-sm truncate">{current.title}</span>
            {current.version > 1 && (
              <span className="text-xs text-muted-foreground shrink-0">v{current.version}</span>
            )}
          </div>
          <div className="flex items-center gap-2 ml-2 shrink-0">
            <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
            {canFullscreen && (
              <button
                onClick={() => setIsFullscreen(true)}
                title="Fullscreen"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 4, borderRadius: 4 }}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
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
                    <Eye className="h-3.5 w-3.5 mr-1.5" />Mark Reviewed
                  </Button>
                )}
                {current.state === 'reviewed' && (
                  <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleTransition('approve')}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />Approve
                  </Button>
                )}
                {current.state === 'approved' && (
                  <>
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleTransition('review')}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Request Changes
                    </Button>
                    <Button size="sm" disabled={isPending} onClick={() => handleTransition('execute')}>
                      <Send className="h-3.5 w-3.5 mr-1.5" />Execute
                    </Button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </>
  )
}