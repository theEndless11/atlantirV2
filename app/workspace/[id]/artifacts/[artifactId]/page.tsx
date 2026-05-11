'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import type { Artifact } from '@/types'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'

function supabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function cellVal(v: any): string {
  if (v === null || v === undefined) return '—'
  return String(v)
}

function TableView({ content: rawContent }: { content: any }) {
  const [filter, setFilter] = useState('')
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  let content = rawContent
  if (typeof content === 'string') { try { content = JSON.parse(content) } catch { content = {} } }

  const columns: string[] = content.columns || (content.rows?.[0] ? Object.keys(content.rows[0]) : [])
  let rows: Record<string, any>[] = content.rows || []

  if (filter) {
    const q = filter.toLowerCase()
    rows = rows.filter(r => columns.some(c => String(r[c] ?? '').toLowerCase().includes(q)))
  }
  if (sortCol) {
    rows = [...rows].sort((a, b) => {
      const [av, bv] = [a[sortCol], b[sortCol]]
      const [an, bn] = [parseFloat(av), parseFloat(bv)]
      if (!isNaN(an) && !isNaN(bn)) return sortDir === 'asc' ? an - bn : bn - an
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input
        value={filter} onChange={e => setFilter(e.target.value)}
        placeholder="Filter rows..."
        style={{ padding: '8px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--surface)', color: 'var(--text-1)', outline: 'none', width: 320 }}
      />
      <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col}
                  onClick={() => { if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortCol(col); setSortDir('asc') } }}
                  style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-2)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', background: 'var(--surface-2)', position: 'sticky', top: 0, borderBottom: '1px solid var(--border)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  {col}{sortCol === col ? sortDir === 'asc' ? ' ↑' : ' ↓' : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)' }}>
                {columns.map(col => (
                  <td key={col} style={{ padding: '9px 16px', borderBottom: '1px solid var(--border-soft)', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
                    {cellVal(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>No results</div>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{rows.length} of {(content.rows || []).length} rows</div>
    </div>
  )
}

function GraphView({ content: rawContent }: { content: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)
  const [ready, setReady] = useState(false)

  let content = rawContent
  if (typeof content === 'string') { try { content = JSON.parse(content) } catch { content = {} } }

  useEffect(() => {
    if (!(window as any).Chart) {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js'
      s.onload = () => setReady(true)
      document.head.appendChild(s)
    } else setReady(true)
  }, [])

  useEffect(() => {
    if (!ready || !canvasRef.current) return
    const Chart = (window as any).Chart
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

    const colors = ['#3d2c2c', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']
    const datasets = (content.datasets || []).map((ds: any, i: number) => ({
      label: ds.label,
      data: ds.data,
      backgroundColor: ds.color || (content.chartType === 'line' ? 'transparent' : colors[i % colors.length] + '99'),
      borderColor: ds.color || colors[i % colors.length],
      borderWidth: 2,
      fill: content.chartType === 'area',
      tension: 0.4,
    }))

    chartRef.current = new Chart(canvasRef.current, {
      type: content.chartType === 'area' ? 'line' : (content.chartType || 'bar'),
      data: { labels: content.labels || [], datasets },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 13 } } },
          title: content.title ? { display: true, text: content.title, font: { size: 16, weight: '600' } } : undefined,
        },
      }
    })

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [ready, content])

  return <canvas ref={canvasRef} style={{ maxHeight: 480, width: '100%' }} />
}

function CompositeView({ content }: { content: any }) {
  // Render multiple blocks in order
  const blocks: any[] = content.blocks || []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {blocks.map((block: any, i: number) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {block.title && <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>{block.title}</h3>}
          {block.type === 'text' && (
            <MarkdownRenderer content={block.content || ''} size="lg" />
          )}
          {block.type === 'table' && <TableView content={block} />}
          {block.type === 'graph' && <GraphView content={block} />}
          {block.type === 'code' && (
            <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 18px', fontSize: 13, fontFamily: 'monospace', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {block.content || ''}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}

function ArtifactBody({ artifact }: { artifact: Artifact }) {
  // Supabase can return JSONB as a raw string — parse it defensively
  let c = artifact.content as any
  if (typeof c === 'string') {
    try { c = JSON.parse(c) } catch { /* leave as string */ }
  }
  // If still a plain string after parse attempt, wrap it so renderers can use .markdown
  if (typeof c === 'string') c = { markdown: c }

  switch (artifact.type) {
    case 'table':
      return <TableView content={c} />
    case 'graph':
      return <GraphView content={c} />
    case 'richtext':
    case 'document':
      return (
        <div>
          <MarkdownRenderer content={c.markdown || c.body || ''} size="md" />
        </div>
      )
    case 'code':
      return (
        <pre style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '20px 24px', fontSize: 14, fontFamily: 'monospace', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {c.code || Object.values(c.files || {}).join('\n')}
        </pre>
      )
    case 'email':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 15 }}>
          <div><span style={{ color: 'var(--text-3)' }}>To: </span>{(c.to || []).join(', ')}</div>
          {c.cc?.length ? <div><span style={{ color: 'var(--text-3)' }}>Cc: </span>{c.cc.join(', ')}</div> : null}
          <div><span style={{ color: 'var(--text-3)' }}>Subject: </span><strong>{c.subject}</strong></div>
          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />
          <pre style={{ fontFamily: 'inherit', whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.8 }}>{c.body_mjml || c.body}</pre>
        </div>
      )
    case 'datagrid':
      return (
        <TableView content={{ columns: c.headers, rows: (c.rows || []).map((r: string[]) => Object.fromEntries((c.headers || []).map((h: string, i: number) => [h, r[i]]))) }} />
      )
    default:
      // Try composite blocks
      if (c.blocks) return <CompositeView content={c} />
      // Content has markdown — render it regardless of type label
      if (c.markdown || c.body)
        return <div><MarkdownRenderer content={c.markdown || c.body || ''} size="md" /></div>
      // Plain string stored at root
      if (typeof c === 'string')
        return <div><MarkdownRenderer content={c} size="md" /></div>
      // Last resort: raw JSON
      return <pre style={{ fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(c, null, 2)}</pre>
  }
}

const TYPE_LABELS: Record<string, string> = {
  table: 'Table', graph: 'Graph', richtext: 'Document', document: 'Document',
  code: 'Code', email: 'Email', datagrid: 'Data Grid', chart: 'Chart',
  slides: 'Slides', other: 'Artifact',
}

const STATE_COLORS: Record<string, string> = {
  draft: '#94a3b8', reviewed: '#60a5fa', approved: '#34d399', executed: '#a78bfa',
}

// ── Chat message shape ───────────────────────────────────────────────────────
interface ChatMsg {
  id: string
  role: 'human' | 'agent' | 'thinking'
  text: string
  agentType?: string
  petName?: string
  updateType?: string
  rendered?: { type: 'graph' | 'table'; content: any }
}


// Parse render_graph/render_table sentinels from persisted message content
function parseRenderedMsg(raw: string): { display: string, rendered?: { type: 'graph'|'table', content: any } } {
  const gm = raw.match(/<!--render_graph:([\s\S]+?)-->/)
  if (gm) { try { return { display: raw.replace(/\n\n<!--render_graph:[\s\S]+?-->/, '').trim(), rendered: { type: 'graph', content: JSON.parse(gm[1]) } } } catch {} }
  const tm = raw.match(/<!--render_table:([\s\S]+?)-->/)
  if (tm) { try { return { display: raw.replace(/\n\n<!--render_table:[\s\S]+?-->/, '').trim(), rendered: { type: 'table', content: JSON.parse(tm[1]) } } } catch {} }
  return { display: raw }
}

// Thinking phrase — reflects what the agent is actually doing
function ArtThinkingPhrase(agentType: string, text: string): string {
  const t = text.toLowerCase()
  const agent = agentType.toLowerCase()
  const len = text.length
  if (len < 80) return agent.includes('research') ? 'Reading the task…' : agent.includes('writer') ? 'Understanding the brief…' : 'Getting started…'
  if (t.includes('| ---') || t.includes('|---|')) return 'Building the table…'
  if (t.includes('| ')) return 'Filling in the data…'
  if (t.includes('## ') || t.includes('# ')) return 'Structuring the output…'
  if (t.includes('```')) return 'Writing code…'
  if (t.includes('http') || t.includes('source') || t.includes('according to')) return 'Citing sources…'
  if (t.includes('recommend') || t.includes('conclusion')) return 'Drawing conclusions…'
  if (t.includes('salary') || t.includes('$')) return 'Looking up figures…'
  if (agent.includes('research')) {
    const p = ['Scanning sources…', 'Reading articles…', 'Gathering data…', 'Synthesising findings…']
    return p[Math.min(Math.floor(len / 400), p.length - 1)]
  }
  if (agent.includes('writer')) {
    const p = ['Drafting content…', 'Expanding sections…', 'Polishing the copy…']
    return p[Math.min(Math.floor(len / 500), p.length - 1)]
  }
  return 'Working on it…'
}

// ── Inline graph/table renderers (used in follow-up thread) ──────────────────
function ArtifactInlineGraph({ content }: { content: any }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!(window as any).Chart) {
      const s = document.createElement('script')
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js'
      s.onload = () => setReady(true)
      document.head.appendChild(s)
    } else setReady(true)
  }, [])
  useEffect(() => {
    if (!ready || !canvasRef.current) return
    const Chart = (window as any).Chart
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    const palette = ['#93c5fd','#6ee7b7','#fcd34d','#c4b5fd','#fca5a5','#86efac']
    const isPie = ['pie','doughnut'].includes(content.chartType)
    const chartType = content.chartType === 'area' ? 'line' : (content.chartType || 'bar')
    const datasets = (content.datasets || []).map((ds: any, i: number) => {
      const color = ds.color || palette[i % palette.length]
      return { label: ds.label, data: ds.data, backgroundColor: isPie ? palette.map(c => c + 'cc') : color + 'cc', borderColor: isPie ? palette : color, borderWidth: 2, fill: content.chartType === 'area', tension: 0.4 }
    })
    const cs = getComputedStyle(document.documentElement)
    const cText1 = cs.getPropertyValue('--text-1').trim() || '#1a1714'
    const cText3 = cs.getPropertyValue('--text-3').trim() || '#9c9289'
    const cSurf2 = cs.getPropertyValue('--surface-2').trim() || '#f5f3ef'
    const cBorder = cs.getPropertyValue('--border').trim() || '#e8e4dc'

    chartRef.current = new Chart(canvasRef.current, {
      type: chartType, data: { labels: content.labels || [], datasets },
      options: { responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: cText1, font: { size: 11 }, padding: 12 } },
          title: content.title ? { display: true, text: content.title, color: cText1, font: { size: 13, weight: '600' }, padding: { bottom: 10 } } : { display: false },
          tooltip: { backgroundColor: cSurf2, titleColor: cText1, bodyColor: cText3, borderColor: cBorder, borderWidth: 1 },
        },
        scales: !isPie ? { x: { grid: { color: cBorder }, border: { color: cBorder }, ticks: { color: cText3, font: { size: 10 } } }, y: { grid: { color: cBorder }, border: { color: cBorder }, ticks: { color: cText3, font: { size: 10 } }, beginAtZero: true } } : undefined }
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [ready, content])
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', padding: '10px 6px', height: 260 }}>
      {!ready && <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', margin: 0 }}>Loading…</p>}
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

function ArtifactInlineTable({ content }: { content: any }) {
  const [filter, setFilter] = useState('')
  const columns: string[] = content.columns || (content.rows?.[0] ? Object.keys(content.rows[0]) : [])
  let rows: Record<string, any>[] = content.rows || []
  if (filter) { const q = filter.toLowerCase(); rows = rows.filter((r: any) => columns.some((c: string) => String(r[c] ?? '').toLowerCase().includes(q))) }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {content.filterable !== false && (
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter rows…"
          style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, background: 'var(--surface-3)', color: 'var(--text-1)', outline: 'none' }} />
      )}
      <div style={{ overflow: 'auto', borderRadius: 6, border: '1px solid var(--border)', maxHeight: 220 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr>{columns.map((col: string) => (
            <th key={col} style={{ padding: '5px 9px', textAlign: 'left', fontWeight: 600, color: 'var(--text-2)', fontSize: 10, textTransform: 'uppercase', background: 'var(--surface-2)', position: 'sticky', top: 0, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{col}</th>
          ))}</tr></thead>
          <tbody>{rows.map((row: any, i: number) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--surface-2)' }}>
              {columns.map((col: string) => (
                <td key={col} style={{ padding: '4px 9px', borderBottom: '1px solid var(--border-soft)', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{String(row[col] ?? '')}</td>
              ))}
            </tr>
          ))}</tbody>
        </table>
        {rows.length === 0 && <div style={{ padding: 12, textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>No results</div>}
      </div>
    </div>
  )
}

export default function ArtifactPage() {
  const { id: workspaceId, artifactId } = useParams<{ id: string; artifactId: string }>()
  const router = useRouter()

  // ── All hooks first ──────────────────────────────────────────────────────
  const [artifact, setArtifact] = useState<Artifact | null>(null)
  const [task, setTask] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const msgsEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Load artifact + task + seed with existing messages ───────────────────
  useEffect(() => {
    const sb = supabase()
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }

      const { data: art, error: err } = await sb
        .from('artifacts').select('*').eq('id', artifactId).eq('workspace_id', workspaceId).single()

      if (err || !art) { setError("Artifact not found or you don't have access."); setLoading(false); return }
      setArtifact(art as Artifact)

      // Load the parent task so we can fetch its messages + live updates
      if (art.task_id) {
        const [{ data: taskData }, { data: existingMsgs }, { data: updates }] = await Promise.all([
          sb.from('tasks').select('*').eq('id', art.task_id).single(),
          sb.from('messages').select('*').eq('task_id', art.task_id).order('created_at'),
          sb.from('task_updates').select('*').eq('task_id', art.task_id).order('created_at'),
        ])

        if (taskData) setTask(taskData)

        // Seed — collapse to last progress update per pet
        const seeded: ChatMsg[] = []
        const lastPerPet: Record<string, any> = {}
        ;(updates || []).forEach((u: any) => {
          if (u.update_type === 'progress' && u.content) lastPerPet[u.pet_name || 'agent'] = u
        })
        Object.values(lastPerPet).forEach((u: any) => {
          seeded.push({ id: `upd-${u.id}`, role: 'thinking', text: u.content, petName: u.pet_name, agentType: u.agent_type })
        })
        ;(existingMsgs || []).forEach((m: any) => {
          const { display, rendered } = parseRenderedMsg(m.content || '')
          seeded.push({ id: m.id, role: m.sender_type === 'human' ? 'human' : 'agent', text: display, agentType: m.agent_type, ...(rendered ? { rendered } : {}) })
        })
        setMsgs(seeded)
      }
      setLoading(false)
    })
  }, [artifactId, workspaceId])

  // ── Subscribe to live messages + task_updates ────────────────────────────
  useEffect(() => {
    if (!task?.id) return
    const sb = supabase()
    const channel = sb.channel(`artifact-chat:${task.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `task_id=eq.${task.id}` },
        (p) => {
          const m = p.new as any
          setMsgs(prev => {
            if (prev.find(x => x.id === m.id)) return prev
            const role = m.sender_type === 'human' ? 'human' : 'agent'
            if (role === 'agent') {
              const { display, rendered } = parseRenderedMsg(m.content || '')
              const match = prev.find(x => x.role === 'agent' && x.text === display && x.id.startsWith('a-'))
              if (match) return prev.map(x => x.id === match.id ? { ...x, id: m.id, ...(rendered ? { rendered } : {}) } : x)
              return [...prev, { id: m.id, role, text: display, agentType: m.agent_type, ...(rendered ? { rendered } : {}) }]
            }
            return [...prev, { id: m.id, role, text: m.content, agentType: m.agent_type }]
          })
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_updates', filter: `task_id=eq.${task.id}` },
        (p) => {
          const u = p.new as any
          if (u.update_type === 'progress' && u.content) {
            const petKey = u.pet_name || 'agent'
            setMsgs(prev => {
              const existingIdx = prev.findIndex(x => x.role === 'thinking' && x.petName === petKey)
              if (existingIdx !== -1) {
                const updated = [...prev]
                updated[existingIdx] = { ...updated[existingIdx], id: `upd-${u.id}`, text: u.content }
                return updated
              }
              return [...prev, { id: `upd-${u.id}`, role: 'thinking', text: u.content, petName: petKey, agentType: u.agent_type }]
            })
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'artifacts', filter: `id=eq.${artifactId}` },
        (p) => { if (p.new) setArtifact(p.new as Artifact) })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [task?.id, artifactId])

  // ── Scroll to bottom on new messages ─────────────────────────────────────
  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  async function sendMsg() {
    const text = input.trim()
    if (!text || sending) return
    setInput(''); setSending(true)
    if (inputRef.current) inputRef.current.style.height = 'auto'

    const humanId = `h-${Date.now()}`
    const assistantId = `a-${Date.now()}`
    setMsgs(prev => [
      ...prev,
      { id: humanId, role: 'human', text },
      { id: assistantId, role: 'agent', text: '', agentType: 'assistant' },
    ])
    setTimeout(() => msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    let artifactCtx = ''
    if (artifact) {
      const c = artifact.content as any
      artifactCtx = (c?.markdown || c?.body || JSON.stringify(c)).slice(0, 2000)
    }

    try {
      const res = await fetch('/api/task-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          task_id: task?.id ?? null,
          task_title: task?.title ?? artifact?.title ?? '',
          message: text,
          artifact_context: artifactCtx,
          history: msgs.filter(m => m.role !== 'thinking').slice(-10).map(m => ({
            role: m.role === 'human' ? 'user' : 'assistant',
            content: m.text,
          })),
        }),
      })

      const contentType = res.headers.get('content-type') || ''

      if (contentType.includes('application/json')) {
        const data = await res.json()
        if (data.rendered) {
          setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, text: data.reply || '', rendered: data.rendered } : m))
        } else {
          setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, text: data.reply || 'Done.' } : m))
        }
        return
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return

      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (line.startsWith('0:')) {
            try {
              accumulated += JSON.parse(line.slice(2))
              setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, text: accumulated } : m))
            } catch { }
          }
        }
      }
      setTimeout(() => msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch {
      setMsgs(prev => prev.map(m => m.id === assistantId ? { ...m, text: 'Something went wrong. Please try again.' } : m))
    } finally {
      setSending(false)
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() }
  }

  const [splitPct, setSplitPct] = useState(40)          // 0–100, default 40/60
  const [chatCollapsed, setChatCollapsed] = useState(false)
  const [artCollapsed, setArtCollapsed] = useState(false)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Drag-to-resize divider ────────────────────────────────────────────────
  function onDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    isDragging.current = true
    function onMove(ev: MouseEvent) {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = Math.min(90, Math.max(10, ((ev.clientX - rect.left) / rect.width) * 100))
      setSplitPct(pct)
      setChatCollapsed(false); setArtCollapsed(false)
    }
    function onUp() { isDragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Early returns after all hooks ─────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-3)', fontSize: 14 }}>
      Loading…
    </div>
  )

  if (error || !artifact) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12, color: 'var(--text-2)', textAlign: 'center' }}>
      <p style={{ fontSize: 15, fontWeight: 500 }}>{error || 'Artifact not found'}</p>
      <Link href={`/workspace/${workspaceId}`} style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}>← Back</Link>
    </div>
  )

  // Derived widths
  const leftW  = chatCollapsed ? 0   : artCollapsed ? 100 : splitPct
  const rightW = artCollapsed  ? 0   : chatCollapsed ? 100 : 100 - splitPct

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Top bar ── */}
      <header style={{ height: 46, flexShrink: 0, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
        <Link href={`/workspace/${workspaceId}`} style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Workspace
        </Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{TYPE_LABELS[artifact.type] || 'Artifact'}</span>
        <span style={{ color: 'var(--border)' }}>/</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artifact.title}</span>

        {/* Panel toggle buttons */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
          <button title="Toggle chat" onClick={() => { setChatCollapsed(v => !v); setArtCollapsed(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', background: chatCollapsed ? 'var(--surface-3)' : 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: chatCollapsed ? 'var(--text-1)' : 'var(--text-2)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Chat
          </button>
          <button title="50 / 50" onClick={() => { setSplitPct(40); setChatCollapsed(false); setArtCollapsed(false) }}
            style={{ padding: '3px 9px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-2)' }}>
            50/50
          </button>
          <button title="Toggle artifact" onClick={() => { setArtCollapsed(v => !v); setChatCollapsed(false) }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', background: artCollapsed ? 'var(--surface-3)' : 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: artCollapsed ? 'var(--text-1)' : 'var(--text-2)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
            Artifact
          </button>
        </div>

        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, color: '#fff', background: STATE_COLORS[artifact.state] || '#94a3b8', flexShrink: 0 }}>{artifact.state}</span>
        <button onClick={copyLink} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: copied ? 'rgba(16,185,129,.15)' : 'var(--surface-2)', border: `1px solid ${copied ? '#10b981' : 'var(--border)'}`, borderRadius: 6, fontSize: 11, cursor: 'pointer', color: copied ? '#10b981' : 'var(--text-2)', transition: 'all .15s', flexShrink: 0 }}>
          {copied ? 'Copied!' : 'Share'}
        </button>
      </header>

      {/* ── Main resizable split ── */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* ── LEFT: chat ── */}
        {!chatCollapsed && (
          <div style={{ width: `${leftW}%`, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: isDragging.current ? 'none' : 'width .15s' }}>

            {/* Task header */}
            {task && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>Task</p>
                <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--text-1)', lineHeight: 1.35 }}>{task.title}</p>
                {task.description && <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>{task.description}</p>}
              </div>
            )}

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--surface)' }}>
              {msgs.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--text-3)', textAlign: 'center', padding: '0 20px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <p style={{ fontSize: 12, margin: 0 }}>Ask about this output or request changes</p>
                </div>
              )}
              {msgs.map((m) => {
                if (m.role === 'thinking') return (
                  <div key={m.id} style={{ borderRadius: 10, border: '1px solid var(--accent-border)', background: 'var(--accent-soft)', padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #818cf8, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 8px rgba(99,102,241,.4)', animation: 'art-orb-pulse 2s ease-in-out infinite' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', display: 'block' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 1 }}>{m.petName || 'Agent'}</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(241,235,228,0.75)', fontStyle: 'italic' }}>{ArtThinkingPhrase(m.agentType || '', m.text)}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-2)', wordBreak: 'break-word', maxHeight: 200, overflowY: 'auto' }}>
                      <MarkdownRenderer content={m.text} size="sm" />
                    </div>
                  </div>
                )
                if (m.role === 'human') return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ maxWidth: '78%', padding: '8px 13px', borderRadius: '16px 16px 4px 16px', background: 'var(--surface-3)', color: 'var(--text-1)', fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: '1px solid var(--border)' }}>{m.text}</div>
                  </div>
                )
                return (
                  <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--surface-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(255,220,180,0.9)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                      {m.rendered ? (
                        <div>
                          {m.text && <p style={{ fontSize: 13, color: 'rgba(241,235,228,0.8)', margin: '0 0 10px', lineHeight: 1.6 }}>{m.text}</p>}
                          {m.rendered.type === 'graph' ? <ArtifactInlineGraph content={m.rendered.content} /> : <ArtifactInlineTable content={m.rendered.content} />}
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-1)', wordBreak: 'break-word' }}>
                          <MarkdownRenderer content={m.text} size="sm" />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {sending && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--surface-3)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="rgba(255,220,180,0.9)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                  </div>
                  <div style={{ paddingTop: 7, display: 'flex', gap: 4 }}>
                    {[0,1,2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-3)', display: 'inline-block', animation: 'art-bounce 1.2s infinite', animationDelay: `${i * 0.18}s` }} />)}
                  </div>
                </div>
              )}
              <div ref={msgsEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '8px 10px 12px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface-2)' }}>
              <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end', background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '7px 7px 7px 12px', transition: 'border-color .15s' }}>
                <textarea ref={inputRef} value={input}
                  onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
                  onKeyDown={onKey}
                  placeholder={task ? `Ask about "${task.title}"…` : 'Send a message…'}
                  rows={1}
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontSize: 13, color: 'var(--text-1)', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}
                />
                <button onClick={sendMsg} disabled={!input.trim() || sending}
                  style={{ width: 30, height: 30, borderRadius: 9, background: input.trim() && !sending ? 'var(--surface-3)' : 'var(--surface-2)', border: 'none', cursor: input.trim() && !sending ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .15s' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !sending ? 'var(--text-1)' : 'var(--text-3)'} strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--text-3)', textAlign: 'center' }}>Enter · Shift+Enter for newline</p>
            </div>
          </div>
        )}

        {/* ── Drag divider ── */}
        {!chatCollapsed && !artCollapsed && (
          <div onMouseDown={onDividerMouseDown}
            style={{ width: 4, flexShrink: 0, cursor: 'col-resize', background: 'var(--border)', position: 'relative', transition: 'background .15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-3)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--border)')}
          />
        )}

        {/* ── RIGHT: artifact ── */}
        {!artCollapsed && (
          <div style={{ width: `${rightW}%`, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', transition: isDragging.current ? 'none' : 'width .15s' }}>
            {/* Artifact toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, background: 'var(--surface)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{artifact.title}</span>
              <button
                title="Copy content"
                onClick={() => {
                  const c = artifact.content as any
                  const text = c?.markdown || c?.body || JSON.stringify(c, null, 2)
                  navigator.clipboard.writeText(text)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-2)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy
              </button>
              <button
                title="Download as .md"
                onClick={() => {
                  const c = artifact.content as any
                  const text = c?.markdown || c?.body || JSON.stringify(c, null, 2)
                  const blob = new Blob([text], { type: 'text/markdown' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url
                  a.download = `${artifact.title.replace(/\s+/g, '-').toLowerCase()}.md`
                  a.click(); URL.revokeObjectURL(url)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--text-2)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </button>
            </div>
            <div style={{ padding: '28px 32px 72px', boxSizing: 'border-box', width: '100%' }}>
              <ArtifactBody artifact={artifact} />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-4px)}}
        @keyframes art-bounce{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-4px);opacity:1}}
        @keyframes art-orb-pulse{0%,100%{box-shadow:0 0 8px rgba(99,102,241,.4)}50%{box-shadow:0 0 18px rgba(99,102,241,.7)}}
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}