'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { useWorkspaceStore } from '@/store/workspace'
import { ArtifactPanel } from '@/components/artifacts/ArtifactPanel'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { WorkspaceBootstrap } from '@/components/WorkspaceBootstrap'
import type { Artifact } from '@/types'


// ── Inline graph renderer ─────────────────────────────────────────────────────
const CHART_PALETTE = ['#60a5fa','#34d399','#f59e0b','#f87171','#a78bfa','#38bdf8','#4ade80','#fb923c']

function InlineGraph({ content, onFullscreen }: { content: any, onFullscreen?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if ((window as any).Chart) { setReady(true); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js'
    s.onload = () => setReady(true)
    document.head.appendChild(s)
  }, [])

  useEffect(() => {
    if (!ready || !canvasRef.current) return
    const Chart = (window as any).Chart
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }

    // Read actual computed CSS var values — works for both light and dark mode
    const cs = getComputedStyle(document.documentElement)
    const cText1  = cs.getPropertyValue('--text-1').trim()  || '#1a1714'
    const cText2  = cs.getPropertyValue('--text-2').trim()  || '#5c5549'
    const cText3  = cs.getPropertyValue('--text-3').trim()  || '#9c9289'
    const cSurf   = cs.getPropertyValue('--surface').trim() || '#ffffff'
    const cSurf2  = cs.getPropertyValue('--surface-2').trim()|| '#f5f3ef'
    const cBorder = cs.getPropertyValue('--border').trim()  || '#e8e4dc'

    const isPie = ['pie','doughnut'].includes(content.chartType)
    const chartType = isPie ? content.chartType : (content.chartType === 'bar' ? 'bar' : 'line')
    const isLine = chartType === 'line'

    const datasets = (content.datasets || []).map((ds: any, i: number) => {
      const color = ds.color || CHART_PALETTE[i % CHART_PALETTE.length]
      if (isPie) return { label: ds.label, data: ds.data, backgroundColor: CHART_PALETTE.map(c => c + 'dd'), borderColor: cSurf, borderWidth: 2 }
      if (isLine) return { label: ds.label, data: ds.data, borderColor: color, backgroundColor: color + '18', borderWidth: 2.5, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: color, tension: 0.4, fill: false }
      return { label: ds.label, data: ds.data, backgroundColor: color + 'cc', borderColor: color, borderWidth: 1.5, borderRadius: 4 }
    })

    chartRef.current = new Chart(canvasRef.current, {
      type: chartType,
      data: { labels: content.labels || [], datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
        plugins: {
          legend: { position: 'bottom', labels: { color: cText1, font: { size: 11 }, padding: 16, boxWidth: isLine ? 24 : 14, usePointStyle: isLine } },
          title: content.title ? { display: true, text: content.title, color: cText1, font: { size: 13, weight: '600' }, padding: { bottom: 14 } } : { display: false },
          tooltip: { backgroundColor: cSurf2, titleColor: cText1, bodyColor: cText2, borderColor: cBorder, borderWidth: 1 },
        },
        scales: !isPie ? {
          x: { grid: { color: cBorder }, border: { color: cBorder }, ticks: { color: cText3, font: { size: 10 } } },
          y: { grid: { color: cBorder }, border: { color: cBorder }, ticks: { color: cText3, font: { size: 10 } }, beginAtZero: true },
        } : undefined,
      }
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [ready, content])

  return (
    <div style={{ position: onFullscreen ? 'absolute' : 'relative', inset: onFullscreen ? 0 : undefined, height: onFullscreen ? undefined : 300, minHeight: onFullscreen ? 0 : 300 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--surface)', borderRadius: onFullscreen ? 0 : 8, border: onFullscreen ? 'none' : '1px solid var(--border)', padding: '10px 8px 8px' }}>
        {!ready && <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', margin: '20px 0' }}>Loading chart…</p>}
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      </div>
      {onFullscreen && (
        <button onClick={onFullscreen} title="Full view" style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-3)', zIndex: 2 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
        </button>
      )}
    </div>
  )
}

// ── Inline table renderer ─────────────────────────────────────────────────────
function InlineTable({ content }: { content: any }) {
  const [filter, setFilter] = useState('')
  const columns: string[] = content.columns || (content.rows?.[0] ? Object.keys(content.rows[0]) : [])
  let rows: Record<string, any>[] = content.rows || []
  if (filter) {
    const q = filter.toLowerCase()
    rows = rows.filter((r: any) => columns.some(c => String(r[c] ?? '').toLowerCase().includes(q)))
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {content.filterable !== false && (
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter rows…"
          style={{ padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--surface-2)', color: 'var(--text-1)', outline: 'none' }} />
      )}
      <div style={{ overflow: 'auto', borderRadius: 8, border: '1px solid var(--border)', maxHeight: 260 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>{columns.map(col => (
              <th key={col} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--text-2)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', background: 'var(--surface-2)', position: 'sticky', top: 0, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{col}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--surface-2)' }}>
                {columns.map(col => (
                  <td key={col} style={{ padding: '5px 10px', borderBottom: '1px solid var(--border-soft)', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{String(row[col] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>No results</div>}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{rows.length} of {content.rows?.length ?? 0} rows</div>
    </div>
  )
}

// ── Graph fullscreen modal — mirrors ArtifactPanel's FullscreenModal ─────────
function GraphFullscreenModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
      display: 'flex', flexDirection: 'column',
      animation: 'fadeIn .18s ease'
    }}>
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', padding: '12px 20px', gap: 12, flexShrink: 0
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)', flex: 1 }}>{title}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 6, borderRadius: 6, display: 'flex' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  )
}

// ── LiveAgentFeed: Claude-style streaming progress display ────────────────────
function getThinkingPhrase(agentType: string, text: string, charCount: number): string {
  const t = text.toLowerCase()
  const agent = (agentType || '').toLowerCase()

  // Phase based on how much text has accumulated
  if (charCount < 80) {
    if (agent.includes('research') || agent.includes('scout')) return 'Reading the task…'
    if (agent.includes('writer')) return 'Understanding the brief…'
    if (agent.includes('analyst')) return 'Analysing the problem…'
    return 'Getting started…'
  }

  // Content-based phrases — what's the agent actually doing right now?
  if (t.includes('# ') || t.includes('## ')) return 'Structuring the output…'
  if (t.includes('| ---') || t.includes('|---|')) return 'Building the table…'
  if (t.includes('| ')) return 'Filling in the data…'
  if (t.includes('```')) return 'Writing code…'
  if (t.includes('http') || t.includes('source') || t.includes('according to')) return 'Citing sources…'
  if (t.includes('recommend') || t.includes('suggest') || t.includes('conclusion')) return 'Drawing conclusions…'
  if (t.includes('salary') || t.includes('$') || t.includes('revenue')) return 'Looking up figures…'
  if (t.includes('1.') || t.includes('2.') || t.includes('- ')) return 'Listing findings…'
  if (t.match(/\d{4}/)) return 'Checking the data…'

  // Agent-type fallbacks
  if (agent.includes('research') || agent.includes('scout')) {
    const phases = ['Scanning sources…', 'Reading articles…', 'Gathering data…', 'Cross-referencing…', 'Synthesising findings…']
    return phases[Math.min(Math.floor(charCount / 300), phases.length - 1)]
  }
  if (agent.includes('writer') || agent.includes('link')) {
    const phases = ['Drafting content…', 'Expanding sections…', 'Polishing the copy…']
    return phases[Math.min(Math.floor(charCount / 400), phases.length - 1)]
  }
  if (agent.includes('analyst')) {
    const phases = ['Framing the analysis…', 'Comparing options…', 'Building the case…']
    return phases[Math.min(Math.floor(charCount / 350), phases.length - 1)]
  }
  return 'Working on it…'
}

function LiveAgentFeed({ liveUpdates, task }: { liveUpdates: any[], task: any }) {
  const startedUpdate = liveUpdates.find(u => u.update_type === 'started')
  const progressUpdates = liveUpdates.filter(u => u.update_type === 'progress')
  const latestProgress = progressUpdates[progressUpdates.length - 1]
  const petName = startedUpdate?.pet_name || latestProgress?.pet_name || task?.assigned_agent || 'Agent'
  const agentType = startedUpdate?.agent_type || latestProgress?.agent_type || petName
  const accText = latestProgress?.content || ''
  const phrase = getThinkingPhrase(agentType, accText, accText.length)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      {/* Claude-style thinking header */}
      <div className="live-thinking-header">
        <div className="live-thinking-orb">
          <span className="live-orb-inner" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="live-pet-name">{petName}</div>
          <div className="live-phrase">{phrase}</div>
        </div>
        <div className="live-token-count">{accText.length > 0 ? `${accText.length} chars` : ''}</div>
      </div>

      {/* Streaming text — shows the actual content being written */}
      <div className="live-stream-area">
        {!accText ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '24px 0', color: 'var(--text-3)' }}>
            <div className="typing-dots"><span /><span /><span /></div>
            <span style={{ fontSize: 13 }}>Preparing…</span>
          </div>
        ) : (
          <div className="live-stream-text">
            <MarkdownRenderer content={accText} size="md" />
            <span className="live-cursor" />
          </div>
        )}
      </div>
    </div>
  )
}

function petInitial(name: string): string {
  const map: Record<string, string> = { Scout: 'S', Bolt: 'B', Sage: 'A', Quill: 'W', Link: 'L' }
  return map[name] || (name?.[0]?.toUpperCase() || '?')
}

const statusLabels: Record<string, string> = {
  pending_approval: 'Pending', approved: 'Approved', in_progress: 'Running',
  needs_clarification: 'Question', completed: 'Done', cancelled: 'Cancelled'
}

const cmdHints = [
  'Research competitor pricing trends',
  'Draft a weekly team update email',
  'Analyze our top customer churn reasons',
  'Create GitHub issues from last meeting',
]

export default function WorkspaceDashboard() {
  const { id: workspaceId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const store = useWorkspaceStore()
  const pendingTasks = store.pendingTasks()
  const activeTasks = store.activeTasks()
  const completedTasks = store.completedTasks()
  const activeTask = store.activeTask()

  const [today, setToday] = useState('')
  useEffect(() => {
    setToday(new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }))
  }, [])

  const [workspaceName, setWorkspaceName] = useState('Workspace')
  const [copied, setCopied] = useState(false)
  const [recentMeetings, setRecentMeetings] = useState<any[]>([])
  const [transcriptBanner, setTranscriptBanner] = useState<{ title: string; transcript: string } | null>(null)

  // Focus / fullscreen mode
  const [focusMode, setFocusMode] = useState(false)

  // Chat panel
  const [showChat, setShowChat] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{id: string, role: 'user'|'assistant', content: string, loading?: boolean}>>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // Drag-resize state
  const [leftW, setLeftW] = useState(220)
  const [rightW, setRightW] = useState(200)
  const [topH, setTopH] = useState(88) // px height of topbar area
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [topCollapsed, setTopCollapsed] = useState(false)

  const bodyRef = useRef<HTMLDivElement>(null)
  const draggingLeft = useRef(false)
  const draggingRight = useRef(false)
  const draggingTop = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

  const startDragLeft = (e: React.MouseEvent) => {
    e.preventDefault()
    draggingLeft.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, w: leftW, h: topH }
  }
  const startDragRight = (e: React.MouseEvent) => {
    e.preventDefault()
    draggingRight.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, w: rightW, h: topH }
  }
  const startDragTop = (e: React.MouseEvent) => {
    e.preventDefault()
    draggingTop.current = true
    dragStart.current = { x: e.clientX, y: e.clientY, w: leftW, h: topH }
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (draggingLeft.current) {
        const delta = e.clientX - dragStart.current.x
        const next = Math.max(140, Math.min(380, dragStart.current.w + delta))
        setLeftW(next)
        if (next < 150) setLeftCollapsed(true)
        else setLeftCollapsed(false)
      }
      if (draggingRight.current) {
        const delta = dragStart.current.x - e.clientX
        const next = Math.max(140, Math.min(340, dragStart.current.w + delta))
        setRightW(next)
        if (next < 150) setRightCollapsed(true)
        else setRightCollapsed(false)
      }
      if (draggingTop.current) {
        const delta = e.clientY - dragStart.current.y
        const next = Math.max(44, Math.min(160, dragStart.current.h + delta))
        setTopH(next)
        if (next < 50) setTopCollapsed(true)
        else setTopCollapsed(false)
      }
    }
    const onUp = () => {
      draggingLeft.current = false
      draggingRight.current = false
      draggingTop.current = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const [cmdText, setCmdText] = useState('')
  const [cmdFocused, setCmdFocused] = useState(false)
  const [cmdLoading, setCmdLoading] = useState(false)
  const cmdInputRef = useRef<HTMLTextAreaElement>(null)

  const [selectedMeeting, setSelectedMeeting] = useState<any>(null)
  const [creatingTasksFromMeeting, setCreatingTasksFromMeeting] = useState(false)
  const [showMeetingInput, setShowMeetingInput] = useState(false)
  const [processingMeeting, setProcessingMeeting] = useState(false)
  const [activePipeline, setActivePipeline] = useState<any[]>([])
  const [taskPipelines, setTaskPipelines] = useState<Record<string, any[]>>({})
  const [finalOutput, setFinalOutput] = useState<string | Artifact>('')
  const [liveUpdates, setLiveUpdates] = useState<any[]>([])
  const [humanMsg, setHumanMsg] = useState('')
  const [meetingInputText, setMeetingInputText] = useState('')

  const [toastMsg, setToastMsg] = useState('')
  const [toastType, setToastType] = useState<'error' | 'success' | 'info'>('error')
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  function showToast(msg: string, type: 'error' | 'success' | 'info' = 'error') {
    setToastMsg(msg); setToastType(type)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastMsg(''), 5000)
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }

  function formatDate(ts: string) {
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function openMeeting(meeting: any) {
    setSelectedMeeting(meeting)
    setShowChat(false)
    store.setActiveTaskId(null)
    setFinalOutput(''); setActivePipeline([]); setLiveUpdates([])
    router.replace(`/workspace/${workspaceId}?meeting=${meeting.id}`, { scroll: false })
  }

  async function createTasksFromMeeting() {
    if (!selectedMeeting) return
    setCreatingTasksFromMeeting(true)
    try {
      await store.processMeetingTranscript(selectedMeeting.transcript || selectedMeeting.title || '')
      setSelectedMeeting(null)
    } catch (e: any) {
      showToast(e?.message || 'Failed to create tasks')
    } finally {
      setCreatingTasksFromMeeting(false)
    }
  }

  async function submitCommand() {
    const text = cmdText.trim()
    if (!text || cmdLoading) return
    if (text.toLowerCase().includes('meeting')) { setCmdText(''); setShowMeetingInput(true); return }
    setCmdLoading(true); setCmdText('')
    if (cmdInputRef.current) cmdInputRef.current.style.height = 'auto'
    try {
      const lower = text.toLowerCase()
      let assigned_agent = 'research'
      if (['write','draft','report','email','blog','article','summary','document'].some(k => lower.includes(k))) assigned_agent = 'writer'
      else if (['analyze','analyse','chart','graph','table','compare','data','trend','metric'].some(k => lower.includes(k))) assigned_agent = 'analyst'
      else if (['code','build','implement','fix','debug','function','script','api'].some(k => lower.includes(k))) assigned_agent = 'executor'
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, title: text.slice(0, 80), description: text, assigned_agent, status: 'pending_approval', priority: 'medium' }),
      })
      const data = await res.json()
      if (data?.id) await selectTask(data.id)
      else await store.loadTasks(workspaceId)
    } catch (e: any) { showToast(e?.message || 'Failed to create task') }
    finally { setCmdLoading(false) }
  }

  async function selectTask(taskId: string) {
    setSelectedMeeting(null)
    setShowChat(false)
    store.setActiveTaskId(taskId)
    setFinalOutput(''); setLiveUpdates([]); setTaskThread([])
    router.replace(`/workspace/${workspaceId}?task=${taskId}`, { scroll: false })
    const sb = supabaseBrowser()
    const [pipelineRes, artifactRes] = await Promise.all([
      sb.from('task_pipeline').select('*').eq('task_id', taskId).order('step_index'),
      sb.from('artifacts').select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ])
    setActivePipeline(pipelineRes.data || [])
    if (artifactRes.data) setFinalOutput(artifactRes.data as Artifact)
    loadTaskThread(taskId)
    scrollAfterLoadRef.current = true // scroll once taskThread useEffect fires

    // Tear down previous task message subscription
    if (taskMsgChannelRef.current) {
      taskMsgChannelRef.current.unsubscribe()
      taskMsgChannelRef.current = null
    }

    // Subscribe to new agent messages for this task (handles alsoChat analysis + any new replies)
    const sb2 = supabaseBrowser()
    taskMsgChannelRef.current = sb2
      .channel(`task-msgs:${taskId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `task_id=eq.${taskId}`,
      }, (p) => {
        const m = p.new as any
        if (m.sender_type !== 'agent') return
        setTaskThread(prev => {
          // Skip exact id match
          if (prev.find(x => x.id === m.id)) return prev
          // Skip if content matches a recent optimistic assistant message (prevents duplicates after stream)
          const contentMatch = prev.findIndex(x => x.role === 'assistant' && x.content === m.content && x.id.startsWith('a-'))
          if (contentMatch !== -1) {
            // Just update the id to the real DB id
            return prev.map((x, i) => i === contentMatch ? { ...x, id: m.id, loading: false } : x)
          }
          // Replace a loading/empty optimistic bubble
          const loadingIdx = prev.findIndex(x => x.role === 'assistant' && x.loading && x.id.startsWith('a-'))
          if (loadingIdx !== -1) {
            const updated = [...prev]
            updated[loadingIdx] = { ...updated[loadingIdx], id: m.id, content: m.content, loading: false }
            return updated
          }
          // New message (e.g. analysis from combined intent) — append
          return [...prev, { id: m.id, role: 'assistant' as const, content: m.content, loading: false }]
        })
        setTimeout(() => {
          if (!showScrollBtn) scrollToBottom()
          else setShowScrollBtn(true) // pulse button to notify new message
        }, 100)
      })
      .subscribe()
  }

  async function handleApprove(taskId: string) {
    const task = store.tasks.find(t => t.id === taskId)
    const agent = task?.assigned_agent || 'research'
    await store.approveTask(taskId, agent)
    store.setActiveTaskId(taskId)
    setSelectedMeeting(null); setLiveUpdates([]); setActivePipeline([]); setFinalOutput('')
    store.runTask(taskId)
  }

  async function handleReject(taskId: string) { await store.rejectTask(taskId) }


  const [sendingMsg, setSendingMsg] = useState(false)
  const [taskThread, setTaskThread] = useState<Array<{id:string, role:'user'|'assistant', content:string, loading?:boolean, rendered?: {type:'graph'|'table', content:any}, download?: {filename:string, mimeType:string, content:string}}>>([])
  const [graphModal, setGraphModal] = useState<any>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const taskThreadBottomRef = useRef<HTMLDivElement>(null)
  const outputBodyRef = useRef<HTMLDivElement>(null)
  const taskMsgChannelRef = useRef<any>(null)
  const scrollAfterLoadRef = useRef(false) // set true when selectTask fires, triggers scroll after thread renders

  // Scroll output-body to bottom imperatively — works regardless of overflow context
  const scrollToBottom = useCallback((instant = false) => {
    const el = outputBodyRef.current
    if (!el) return
    const doScroll = () => { el.scrollTop = el.scrollHeight; setShowScrollBtn(false) }
    if (instant) { doScroll(); return }
    requestAnimationFrame(doScroll)
  }, [])

  async function sendHumanMsg() {
    if (!humanMsg.trim() || !store.activeTaskId || sendingMsg) return
    const text = humanMsg.trim()
    setHumanMsg('')
    setSendingMsg(true)

    // Build clean human-readable context — never dump raw JSON
    const artifactContext = (() => {
      if (!finalOutput) return ''
      if (typeof finalOutput === 'string') return finalOutput.slice(0, 1500)
      const c = (finalOutput as Artifact).content as any
      if (!c) return ''
      const parts: string[] = []
      if (c.summary) parts.push(c.summary)
      if (c.markdown) parts.push(c.markdown.slice(0, 1200))
      if (c.body) parts.push(c.body.slice(0, 1200))
      // For blocks: extract text content only, not raw JSON
      if (c.blocks?.length) {
        for (const block of c.blocks) {
          if (block.type === 'table' && block.rows?.length) {
            const cols = block.columns || Object.keys(block.rows[0] || {})
            parts.push(cols.join(' | '))
            parts.push(...block.rows.slice(0, 10).map((r: any) => cols.map((col: string) => r[col] ?? '').join(' | ')))
          }
          if (block.type === 'graph') {
            parts.push(`Chart: ${block.title || ''} — ${block.chartType} — labels: ${(block.labels || []).join(', ')}`)
          }
          if (block.type === 'text') parts.push(block.content || '')
        }
      }
      return parts.join('\n\n').slice(0, 1800)
    })()

    const assistantId = `a-${Date.now()}`
    setTaskThread(prev => [...prev,
      { id: `u-${Date.now()}`, role: 'user', content: text },
      { id: assistantId, role: 'assistant', content: '', loading: true },
    ])
    scrollToBottom()

    try {
      const res = await fetch('/api/task-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          task_id: store.activeTaskId,
          task_title: activeTask?.title,
          assigned_agent: activeTask?.assigned_agent,
          message: text,
          artifact_context: artifactContext,
          history: taskThread.filter(m => !m.loading).slice(-10),
        }),
      })

      const contentType = res.headers.get('content-type') || ''

      // JSON response = task creation OR inline graph/table render
      if (contentType.includes('application/json')) {
        const data = await res.json()
        if (data.intent === 'task' && data.new_task_id) {
          setTaskThread(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: data.reply || 'Done.', loading: false } : m
          ))
          await store.loadTasks(workspaceId)
          showToast('Task created — check sidebar', 'success')
          return
        }
        if ((data.intent === 'render_graph' || data.intent === 'render_table') && data.rendered) {
          if (data.append) {
            // Combined request: analysis text arrives via realtime, graph appended as new message
            setTaskThread(prev => [
              ...prev.filter(m => m.id !== assistantId || !m.loading), // remove the loading bubble
              { id: `g-${Date.now()}`, role: 'assistant' as const, content: data.reply || '', loading: false, rendered: data.rendered }
            ])
          } else {
            setTaskThread(prev => prev.map(m =>
              m.id === assistantId ? { ...m, content: data.reply || '', loading: false, rendered: data.rendered } : m
            ))
          }
          setTimeout(() => scrollToBottom(), 100)
          return
        }
        if (data.intent === 'download' && data.download) {
          setTaskThread(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: data.reply || '', loading: false, download: data.download } : m
          ))
          scrollToBottom()
          return
        }
        // Generic JSON reply
        setTaskThread(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: data.reply || 'Done.', loading: false } : m
        ))
        return
      }

      // All other responses stream — chat, update, etc.
      setTaskThread(prev => prev.map(m =>
        m.id === assistantId ? { ...m, loading: false } : m
      ))
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return

      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (line.startsWith('0:')) {
            try {
              accumulated += JSON.parse(line.slice(2))
              setTaskThread(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: accumulated } : m
              ))
              if (!showScrollBtn) scrollToBottom()
            } catch { /* skip malformed */ }
          }
        }
      }
      setTimeout(() => scrollToBottom(), 50)
    } catch (e: any) {
      setTaskThread(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: 'Something went wrong. Please try again.', loading: false } : m
      ))
    } finally {
      setSendingMsg(false)
    }
  }

  // Parse render_graph / render_table sentinels embedded in persisted message content
  function parseRenderedMsg(raw: string): { display: string, rendered?: { type: 'graph'|'table', content: any } } {
    const graphMatch = raw.match(/<!--render_graph:([\s\S]+?)-->/)
    if (graphMatch) {
      try { return { display: raw.replace(/\n\n<!--render_graph:[\s\S]+?-->/, '').trim(), rendered: { type: 'graph', content: JSON.parse(graphMatch[1]) } } } catch {}
    }
    const tableMatch = raw.match(/<!--render_table:([\s\S]+?)-->/)
    if (tableMatch) {
      try { return { display: raw.replace(/\n\n<!--render_table:[\s\S]+?-->/, '').trim(), rendered: { type: 'table', content: JSON.parse(tableMatch[1]) } } } catch {}
    }
    return { display: raw }
  }

  async function loadTaskThread(taskId: string) {
    try {
      const res = await fetch(`/api/task-chat?task_id=${taskId}`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setTaskThread(data.map((m: any) => {
          const { display, rendered } = parseRenderedMsg(m.content || '')
          return {
            id: m.id,
            role: m.sender_type === 'human' ? 'user' : 'assistant',
            content: display,
            ...(rendered ? { rendered } : {}),
          }
        }))
      }
    } catch { setTaskThread([]) }
  }

  async function handleDelete(taskId: string) {
    if (window.confirm('Delete this task?')) await store.deleteTask(taskId)
  }

  function copyOutput() {
    if (!finalOutput) return
    const c = (finalOutput as Artifact).content as any
    const text = c?.markdown || c?.body || (typeof finalOutput === 'string' ? finalOutput : JSON.stringify(c, null, 2))
    navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000)
    showToast('Copied!', 'success')
  }

  function downloadOutput() {
    if (!finalOutput) return
    const artifact = finalOutput as Artifact
    const c = artifact.content as any
    const text = c?.markdown || c?.body || JSON.stringify(c, null, 2)
    const blob = new Blob([text], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url
    a.download = `${(artifact.title || 'output').replace(/\s+/g, '-').toLowerCase()}.md`
    a.click(); URL.revokeObjectURL(url)
  }

  async function handleMeetingSubmit() {
    if (!meetingInputText.trim()) return
    setProcessingMeeting(true)
    try {
      await store.processMeetingTranscript(meetingInputText.trim())
      setShowMeetingInput(false); setMeetingInputText('')
    } catch (e: any) {
      showToast(e?.message || 'Failed to process')
    } finally {
      setProcessingMeeting(false)
    }
  }

  async function createTasksFromTranscript() {
    if (!transcriptBanner) return
    setCmdLoading(true)
    try {
      await store.processMeetingTranscript(transcriptBanner.transcript)
      setTranscriptBanner(null)
    } catch (e: any) {
      showToast(e?.message || 'Failed to create tasks')
    } finally {
      setCmdLoading(false)
    }
  }

  async function sendChat() {
    const text = chatInput.trim()
    if (!text || chatLoading) return
    setChatInput('')
    setChatLoading(true)
    const assistantId = `a-${Date.now()}`
    setChatMessages(prev => [...prev,
      { id: `u-${Date.now()}`, role: 'user', content: text },
      { id: assistantId, role: 'assistant', content: '', loading: true },
    ])
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, message: text, history: chatMessages.filter(m => !m.loading).slice(-10) }),
      })

      const contentType = res.headers.get('content-type') || ''

      if (contentType.includes('application/json')) {
        const data = await res.json()
        setChatMessages(prev => prev.map(m =>
          m.id === assistantId ? { ...m, content: data.reply || 'Done.', loading: false } : m
        ))
        if (data.task_id) {
          await store.loadTasks(workspaceId)
          showToast('Task created — check the sidebar', 'success')
        }
        return
      }

      // Clear loading state before streaming starts so content renders immediately
      setChatMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, loading: false, content: '' } : m
      ))
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (line.startsWith('0:')) {
            try {
              accumulated += JSON.parse(line.slice(2))
              setChatMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: accumulated } : m
              ))
            } catch { /* skip malformed */ }
          }
        }
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 10)
      }
      // Guarantee the assistant message is in DB (guard against onFinish edge failures)
      if (accumulated) {
        fetch('/api/chat', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: workspaceId, content: accumulated }),
        }).catch(() => {})
      }
    } catch {
      setChatMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: 'Something went wrong.', loading: false } : m
      ))
    } finally {
      setChatLoading(false)
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  useEffect(() => {
    const sb = supabaseBrowser()
    let unsubscribeStore: (() => void) | null = null
    store.loadWorkspaces().then(async () => {
      await Promise.all([store.loadTasks(workspaceId), store.loadArtifacts(workspaceId)])
      unsubscribeStore = store.subscribeToWorkspace(workspaceId)
      const taskParam = searchParams.get('task')
      const meetingParam = searchParams.get('meeting')
      if (taskParam) {
        await selectTask(taskParam)
      } else if (meetingParam) {
        const meetRes = await fetch(`/api/meetings?workspace_id=${workspaceId}`)
        const meetings = await meetRes.json().catch(() => [])
        const m = (meetings || []).find((x: any) => x.id === meetingParam)
        if (m) { setSelectedMeeting(m); store.setActiveTaskId(null) }
      }
    })

    // Load general chat history (messages with no task_id)
    fetch(`/api/chat?workspace_id=${workspaceId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length) {
          setChatMessages(data.map((m: any) => ({
            id: m.id,
            role: m.sender_type === 'human' ? 'user' : 'assistant',
            content: m.content,
          })))
        }
      }).catch(() => {})

    // Realtime subscription for general chat — deduplicates against optimistic messages
    const chatChannel = sb
      .channel(`general-chat:${workspaceId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `workspace_id=eq.${workspaceId}`,
      }, (p) => {
        const m = p.new as any
        if (m.task_id || m.meeting_id) return // only general chat
        if (!['human', 'assistant'].includes(m.sender_type)) return
        const role = m.sender_type === 'human' ? 'user' : 'assistant'
        setChatMessages(prev => {
          // Already in state by exact id
          if (prev.find(x => x.id === m.id)) return prev
          // Optimistic assistant message with same content — replace id only
          if (role === 'assistant') {
            const match = prev.find(x => x.role === 'assistant' && x.content === m.content && x.id.startsWith('a-'))
            if (match) return prev.map(x => x.id === match.id ? { ...x, id: m.id } : x)
          }
          // Optimistic human message already visible — just replace id
          if (role === 'user') {
            const match = prev.find(x => x.role === 'user' && x.content === m.content && x.id.startsWith('u-'))
            if (match) return prev.map(x => x.id === match.id ? { ...x, id: m.id } : x)
          }
          return [...prev, { id: m.id, role, content: m.content }]
        })
      })
      .subscribe()

    sb.from('workspaces').select('name').eq('id', workspaceId).single()
      .then(({ data: ws }) => { if (ws) setWorkspaceName(ws.name) })
    fetch(`/api/meetings?workspace_id=${workspaceId}`)
      .then(r => r.json()).then(data => setRecentMeetings((data || []).slice(0, 5))).catch(() => {})
    const transcriptParam = searchParams.get('transcript')
    const mtitleParam = searchParams.get('mtitle')
    if (transcriptParam) {
      setTranscriptBanner({ title: mtitleParam || 'Meeting', transcript: transcriptParam })
      router.replace(`/workspace/${workspaceId}`)
    }
    const pipelineChannel = sb.channel(`workspace-pipeline:${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_pipeline', filter: `workspace_id=eq.${workspaceId}` },
        (p) => {
          const step = p.new as any
          setTaskPipelines(prev => {
            const taskSteps = [...(prev[step.task_id] || [])]
            const idx = taskSteps.findIndex(s => s.id === step.id)
            if (idx !== -1) taskSteps[idx] = step; else taskSteps.push(step)
            return { ...prev, [step.task_id]: taskSteps }
          })
          if (store.activeTaskId === step.task_id) {
            setActivePipeline(prev => {
              const ai = prev.findIndex(s => s.id === step.id)
              if (ai !== -1) { const n = [...prev]; n[ai] = step; return n }
              return [...prev, step]
            })
          }
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_updates', filter: `workspace_id=eq.${workspaceId}` },
        async (p) => {
          const update = p.new as any
          if (store.activeTaskId === update.task_id) {
            setLiveUpdates(prev => [...prev, update])
            if (update.update_type === 'progress') {
              setTimeout(async () => {
                const { data } = await supabaseBrowser()
                  .from('artifacts').select('*')
                  .eq('task_id', store.activeTaskId!).order('created_at', { ascending: false })
                  .limit(1).maybeSingle()
                if (data) setFinalOutput(data as Artifact)
              }, 800)
            }
          }
        })
      .subscribe()
    return () => {
      chatChannel.unsubscribe()
      pipelineChannel.unsubscribe()
      if (taskMsgChannelRef.current) taskMsgChannelRef.current.unsubscribe()
      unsubscribeStore?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  useEffect(() => {
    if (activeTask?.status === 'in_progress') {
      // Clear live updates so rerun shows fresh progress
      setLiveUpdates([])
    }
    if (activeTask?.status === 'completed' && store.activeTaskId) {
      const tryLoad = async () => {
        for (let attempt = 0; attempt < 4; attempt++) {
          await new Promise(r => setTimeout(r, attempt * 600))
          const { data } = await supabaseBrowser()
            .from('artifacts').select('*')
            .eq('task_id', store.activeTaskId!).order('created_at', { ascending: false })
            .limit(1).maybeSingle()
          if (data) { setFinalOutput(data as Artifact); break }
        }
      }
      tryLoad()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTask?.status])

  // ESC exits focus mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && focusMode) setFocusMode(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusMode])

  // Sync focus mode to body so sidebar layout can be hidden
  useEffect(() => {
    document.body.setAttribute('data-focus', focusMode ? '1' : '0')
    return () => document.body.removeAttribute('data-focus')
  }, [focusMode])

  // Scroll to bottom after taskThread state settles in the DOM
  useEffect(() => {
    if (!scrollAfterLoadRef.current) return
    scrollAfterLoadRef.current = false
    // Two rAFs: first lets React commit the DOM, second waits for layout/paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToBottom(true)
      })
    })
  }, [taskThread, scrollToBottom])

  const isStructuredArtifact = finalOutput && typeof finalOutput === 'object' &&
    ['datagrid', 'table', 'graph', 'chart', 'composite', 'richtext', 'email', 'code'].includes((finalOutput as Artifact).type)

  const leftWidth = leftCollapsed ? 0 : leftW
  const rightWidth = rightCollapsed ? 0 : rightW

  return (
    <div className={`cc${focusMode ? ' focus-mode' : ''}`}>
      <WorkspaceBootstrap workspaceId={workspaceId} />

      {/* ── Top bar (drag-resizable height) ── */}
      {!topCollapsed && (
        <div className="topbar" style={{ height: topH }}>
          <div className="topbar-left">
            <h1 className="ws-name">{workspaceName}</h1>
            <span className="date-label">{today}</span>
          </div>
          <div className="topbar-center">
            <div className={`command-bar${cmdFocused ? ' focused' : ''}`}>
              <svg className="cmd-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <textarea ref={cmdInputRef} className="cmd-input" placeholder="What do you want to get done? Describe a goal, task, or question…"
                rows={1} value={cmdText} onFocus={() => setCmdFocused(true)} onBlur={() => setCmdFocused(false)}
                onChange={e => { setCmdText(e.target.value); autoResize(e) }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitCommand() } }} />
              <button className="cmd-send" disabled={!cmdText.trim() || cmdLoading} onClick={submitCommand}>
                {cmdLoading ? <span className="spinner" /> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>}
              </button>
            </div>
            <div className="cmd-hints">
              {cmdHints.map(h => <button key={h} className="hint-pill" onClick={() => setCmdText(h)}>{h}</button>)}
            </div>
          </div>
          <div className="topbar-right">
            <div className="stat-chip"><span className="stat-n">{pendingTasks.length}</span><span>awaiting</span></div>
            <div className="stat-chip accent"><span className="stat-n">{activeTasks.length}</span><span>running</span></div>
            <div className="stat-chip green"><span className="stat-n">{completedTasks.length}</span><span>done</span></div>
          </div>
          {/* bottom drag handle for top bar */}
          <div className="drag-handle drag-handle-h" onMouseDown={startDragTop} title="Drag to resize" />
        </div>
      )}

      {/* ── Transcript banner ── */}
      {transcriptBanner && (
        <div className="transcript-banner">
          <div className="tb-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.894L15 14"/><rect x="3" y="8" width="12" height="8" rx="2"/></svg></div>
          <div className="tb-content">
            <span className="tb-label">Transcript from <strong>{transcriptBanner.title}</strong> is ready</span>
            <span className="tb-sub">Create tasks from this meeting or ask agents to analyze it</span>
          </div>
          <div className="tb-actions">
            <button className="btn btn-primary btn-sm" onClick={createTasksFromTranscript}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Create tasks</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setTranscriptBanner(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* ── Body grid ── */}
      <div
        ref={bodyRef}
        className="body-grid"
        style={{ gridTemplateColumns: [!leftCollapsed && `${leftW}px`, '1fr', !rightCollapsed && `${rightW}px`].filter(Boolean).join(' ') }}
      >
        {/* Left: tasks (drag handle on right edge) */}
        {!leftCollapsed && (
          <aside className="tasks-col">
            {/* ── Chat nav item ── */}
            <div className="task-group">
              <div className="group-label">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                General
              </div>
              <div
                className={`task-item${showChat ? ' active' : ''}`}
                onClick={() => {
                  setShowChat(true)
                  setSelectedMeeting(null)
                  store.setActiveTaskId(null)
                  setFinalOutput(''); setActivePipeline([]); setLiveUpdates([])
                }}
              >
                <div className="task-top">
                  <span className="task-title">Chat</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{color:'var(--text-3,#64748b)',flexShrink:0,marginTop:1}}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </div>
                <div className="task-row">
                  <span style={{fontSize:10,color:'var(--text-3,#64748b)',fontStyle:'italic'}}>Ask anything, create tasks</span>
                </div>
                {chatMessages.filter(m => m.role === 'user').length > 0 && (
                  <div className="task-row" style={{marginTop:2}}>
                    <span className="chat-count">{chatMessages.filter(m => m.role === 'user').length} messages</span>
                  </div>
                )}
              </div>
            </div>
            <div className="task-group">
              <div className="group-label"><span className="label-dot blue" />Recent Meetings</div>
              {recentMeetings.length ? recentMeetings.map(m => (
                <div key={m.id} className={`task-item${selectedMeeting?.id === m.id ? ' active' : ''}`} onClick={() => openMeeting(m)}>
                  <div className="task-top"><span className="task-title">{m.title || 'Untitled meeting'}</span>{m.transcript && <span className="mri-badge">T</span>}</div>
                  <div className="task-row"><span className="task-date">{formatDate(m.created_at)}</span></div>
                </div>
              )) : <div className="empty-section"><span>No recent meetings</span></div>}
            </div>
            <div className="task-group">
              <div className="group-label"><span className="label-dot amber" />Needs approval</div>
              {pendingTasks.length ? pendingTasks.map(task => (
                <div key={task.id} className={`task-item${store.activeTaskId === task.id ? ' active' : ''}`} onClick={() => selectTask(task.id)}>
                  <div className="task-top"><span className="task-title">{task.title}</span><span className={`priority-dot ${task.priority}`} /></div>
                  <div className="task-row"><span className={`badge agent-${task.assigned_agent}`}>{task.assigned_agent}</span></div>
                  <div className="approval-row" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-primary btn-xs" onClick={() => handleApprove(task.id)}>✓ Approve</button>
                    <button className="btn btn-danger btn-xs" onClick={() => handleReject(task.id)}>✕</button>
                  </div>
                </div>
              )) : <div className="empty-section"><span>No tasks awaiting approval</span></div>}
            </div>
            <div className="task-group">
              <div className="group-label"><span className="label-dot blue" />In progress</div>
              {activeTasks.length ? activeTasks.map(task => (
                <div key={task.id} className={`task-item${store.activeTaskId === task.id ? ' active' : ''}`} onClick={() => selectTask(task.id)}>
                  <div className="task-top"><span className="task-title">{task.title}</span><span className={`priority-dot ${task.priority}`} /></div>
                  <div className="task-row">
                    <span className="badge status-in_progress">Running</span>
                    {task.assigned_agent && <span className={`badge agent-${task.assigned_agent}`}>{task.assigned_agent}</span>}
                  </div>
                  {taskPipelines[task.id]?.length > 0 && (
                    <div className="mini-pipe">{taskPipelines[task.id].map(step => (
                      <div key={step.id} className={`mini-step ${step.status}`} title={step.pet_name}>{petInitial(step.pet_name)}</div>
                    ))}</div>
                  )}
                </div>
              )) : <div className="empty-section"><span>No tasks in progress</span></div>}
            </div>
            {/* right drag handle */}
            <div className="drag-handle drag-handle-v drag-handle-left" onMouseDown={startDragLeft} title="Drag to resize" />
          </aside>
        )}

        {/* Center: pipeline / output */}
        <section className="pipeline-col" style={{ position: 'relative' }}>
          {showChat ? (
            <>
              <div className="task-header-bar">
                <div className="task-header-info">
                  <h2 style={{display:'flex',alignItems:'center',gap:7}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Chat
                  </h2>
                  <p>Ask anything, get help, or describe a task to create one</p>
                </div>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  {chatMessages.length > 0 && (
                    <button className="icon-btn" onClick={async () => {
                      setChatMessages([])
                      await fetch(`/api/chat?workspace_id=${workspaceId}`, { method: 'DELETE' })
                    }} title="Clear history">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                      Clear
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowChat(false)}>✕</button>
                </div>
              </div>
              <div className="output-body chat-center-body">
                {chatMessages.length === 0 && (
                  <div className="chat-center-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <p>Ask anything — questions, get help thinking through a problem, or describe work for an agent to do.</p>
                    <div className="chat-center-hints">
                      {['What can you help me with?', 'Research the latest AI models', 'Draft a project status update', 'Hi!'].map(h => (
                        <button key={h} className="hint-pill" onClick={() => { setChatInput(h) }}>{h}</button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="chat-center-messages">
                  {chatMessages.map(m => (
                    <div key={m.id} className={`chat-center-msg chat-center-msg-${m.role}`}>
                      <div className="chat-center-bubble">
                        {(m.loading || (m.role === 'assistant' && !m.content))
                          ? <div className="typing-dots"><span /><span /><span /></div>
                          : m.role === 'assistant'
                            ? <MarkdownRenderer content={m.content} size="sm" />
                            : <p>{m.content}</p>
                        }
                      </div>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>
              </div>
              {showScrollBtn && (
                <button
                  onClick={() => scrollToBottom()}
                  style={{
                    position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 10, display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 14px', background: 'var(--surface-3)', border: '1px solid var(--border)',
                    borderRadius: 20, fontSize: 12, color: 'var(--text-1)', cursor: 'pointer',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  Scroll to latest
                </button>
              )}
              <div className="followup-bar">
                <textarea
                  className="followup-input"
                  placeholder="Message… (Enter to send, Shift+Enter for newline)"
                  rows={1}
                  value={chatInput}
                  onChange={e => { setChatInput(e.target.value); autoResize(e) }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                />
                <button className="send-btn" disabled={!chatInput.trim() || chatLoading} onClick={sendChat} title="Send">
                  {chatLoading
                    ? <span className="spinner" />
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  }
                </button>
              </div>
            </>
          ) : selectedMeeting ? (
            <>
              <div className="task-header-bar">
                <div className="task-header-info"><h2>{selectedMeeting.title || 'Untitled meeting'}</h2><p>{formatDate(selectedMeeting.created_at)}</p></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" disabled={creatingTasksFromMeeting || !selectedMeeting.transcript} onClick={createTasksFromMeeting}>
                    {creatingTasksFromMeeting ? <span className="spinner" /> : null}{creatingTasksFromMeeting ? 'Creating…' : 'Create Tasks'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedMeeting(null)}>✕</button>
                </div>
              </div>
              <div className="output-body">
                {selectedMeeting.transcript
                  ? <div className="transcript-body">{selectedMeeting.transcript}</div>
                  : <div className="output-placeholder"><p>No transcript available</p></div>}
              </div>
            </>
          ) : activeTask ? (
            <>
              <div className="task-header-bar">
                <div className="task-header-info">
                  <h2>{activeTask.title}</h2>
                  {activeTask.description && (
                    <p>{activeTask.description.length > 120
                      ? activeTask.description.slice(0, 120) + '…'
                      : activeTask.description}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {finalOutput && (
                    <>
                      <button className="icon-btn" onClick={copyOutput} title={copied ? 'Copied!' : 'Copy'}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                      <button className="icon-btn" onClick={downloadOutput} title="Download .md">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Download
                      </button>

                    </>
                  )}
                  <button className="icon-btn" title="Share task link" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/workspace/${workspaceId}?task=${activeTask.id}`); showToast('Link copied!','success') }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    Share
                  </button>
                  <span className={`badge status-${activeTask.status}`}>{statusLabels[activeTask.status] || activeTask.status}</span>
                </div>
              </div>

              {activePipeline.length > 0 && (
                <div className="pipeline-track">
                  {activePipeline.map((step, i) => (
                    <div key={step.id} style={{ display: 'contents' }}>
                      {i > 0 && <div className={`pipe-connector${activePipeline[i-1].status === 'completed' ? ' lit' : ''}`} />}
                      <div className={`pipe-step ${step.status}`}>
                        <div className="pipe-bubble"><span>{petInitial(step.pet_name)}</span>{step.status === 'running' && <div className="pipe-ring" />}</div>
                        <div className="pipe-label">{step.pet_name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Single unified scroll area — artifact output + thread messages */}
              <div className="output-body" ref={outputBodyRef}
                onScroll={e => {
                  const el = e.currentTarget
                  setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120)
                }}
              >
                {activeTask.status === 'pending_approval' ? (
                  <div className="output-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <p>Approve this task to start the agent pipeline</p>
                  </div>
                ) : finalOutput ? (
                  isStructuredArtifact ? (
                    <ArtifactPanel artifact={finalOutput as Artifact} workspaceId={workspaceId} onUpdate={u => setFinalOutput(u)} />
                  ) : (
                    <div className="output-content">
                      <MarkdownRenderer
                        content={typeof finalOutput === 'object'
                          ? ((finalOutput as Artifact).content as any)?.markdown || ((finalOutput as Artifact).content as any)?.body || JSON.stringify((finalOutput as Artifact).content, null, 2)
                          : finalOutput}
                        size="md"
                      />
                    </div>
                  )
                ) : activeTask.status === 'in_progress' ? (
                  <div className="live-feed">
                    <LiveAgentFeed liveUpdates={liveUpdates} task={activeTask} />
                  </div>
                ) : liveUpdates.length > 0 ? (
                  <div className="live-feed">
                    {(() => {
                      const last = liveUpdates.filter(u => u.update_type === 'progress').slice(-1)[0]
                      return last ? <div className="live-stream-text"><MarkdownRenderer content={last.content} size="md" /></div> : null
                    })()}
                  </div>
                ) : (
                  <div className="output-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <p>No output yet</p>
                  </div>
                )}

                {/* Thread messages — inline below output, same scroll + same bg */}
                {taskThread.length > 0 && (
                  <div className="thread-inline">
                    <div className="thread-divider" />
                    {taskThread.map(m => (
                      <div key={m.id} className={`thread-msg thread-msg-${m.role}`}>
                        {(m.loading || (m.role === 'assistant' && !m.content && !m.rendered))
                          ? <div className="typing-dots" style={{ padding: '6px 0' }}><span /><span /><span /></div>
                          : m.download
                            ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {m.content && <div className="thread-assistant-text"><MarkdownRenderer content={m.content} size="md" /></div>}
                                <button
                                  onClick={() => {
                                    const blob = new Blob([m.download!.content], { type: m.download!.mimeType })
                                    const url = URL.createObjectURL(blob)
                                    const a = document.createElement('a'); a.href = url; a.download = m.download!.filename; a.click()
                                    URL.revokeObjectURL(url)
                                  }}
                                  style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-1)', cursor: 'pointer', fontFamily: 'inherit' }}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                  Download {m.download!.filename}
                                </button>
                              </div>
                            )
                            : m.rendered
                            ? (
                              <div className="thread-rendered">
                                {m.content && <p className="thread-rendered-label">{m.content}</p>}
                                <div className="thread-graph-wrap">
                                  {m.rendered.type === 'graph'
                                    ? <InlineGraph content={m.rendered.content} onFullscreen={() => setGraphModal(m.rendered!.content)} />
                                    : <InlineTable content={m.rendered.content} />}
                                </div>
                              </div>
                            )
                            : m.role === 'assistant'
                              ? <div className="thread-assistant-text"><MarkdownRenderer content={m.content} size="md" /></div>
                              : <div className="thread-user-bubble">{m.content}</div>
                        }
                      </div>
                    ))}
                  </div>
                )}

              </div>

              {showScrollBtn && (
                <button
                  onClick={() => scrollToBottom()}
                  style={{
                    position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)',
                    zIndex: 10, display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 14px', background: 'var(--surface-3)', border: '1px solid var(--border)',
                    borderRadius: 20, fontSize: 12, color: 'var(--text-1)', cursor: 'pointer',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  Scroll to latest
                </button>
              )}

              <div className="followup-bar">
                <textarea className="followup-input" placeholder="Ask about this output, request changes, or just chat…" rows={1}
                  value={humanMsg} onChange={e => setHumanMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendHumanMsg() } }} />
                <button className="send-btn" disabled={!humanMsg.trim() || sendingMsg} onClick={sendHumanMsg} title="Send (Enter)">
                  {sendingMsg
                    ? <span className="spinner" />
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  }
                </button>
              </div>
            </>
          ) : (
            <div className="select-prompt">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M4 6h16M4 12h10M4 18h7"/></svg>
              <p>Select a meeting or task to get started</p>
            </div>
          )}

          {/* Graph fullscreen modal — same style as ArtifactPanel FullscreenModal */}
          {graphModal && (
            <GraphFullscreenModal title={graphModal.title || 'Chart'} onClose={() => setGraphModal(null)}>
              <InlineGraph content={graphModal} fullscreen />
            </GraphFullscreenModal>
          )}
        </section>

        {/* Right: completed (drag handle on left edge) */}
        {!rightCollapsed && (
          <aside className="completed-col" style={{ position: 'relative' }}>
            {/* left drag handle */}
            <div className="drag-handle drag-handle-v drag-handle-right" onMouseDown={startDragRight} title="Drag to resize" />
            <div className="task-group">
              <div className="group-label"><span className="label-dot green" />Completed</div>
              {completedTasks.length ? completedTasks.map(task => (
                <div key={task.id} className={`task-item completed${store.activeTaskId === task.id ? ' active' : ''}`} onClick={() => selectTask(task.id)}>
                  <div className="task-top">
                    <span className="task-title">{task.title}</span>
                    <button className="del-btn" onClick={e => { e.stopPropagation(); handleDelete(task.id) }}>✕</button>
                  </div>
                  <div className="task-row">
                    <span className="badge badge-green">Done</span>
                    {task.assigned_agent && <span className={`badge agent-${task.assigned_agent}`}>{task.assigned_agent}</span>}
                  </div>
                </div>
              )) : <div className="empty-section"><span>No completed tasks</span></div>}
            </div>
          </aside>
        )}
      </div>

      {/* ── Focus mode: fixed full-viewport overlay covering sidebar + everything ── */}
      {focusMode && activeTask && (
        <div className="focus-overlay">
          <div className="focus-overlay-header">
            <div className="focus-overlay-title">
              <h2>{activeTask.title}</h2>
              {activeTask.description && (
                <p>{activeTask.description.length > 120 ? activeTask.description.slice(0, 120) + '…' : activeTask.description}</p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {finalOutput && (
                <>
                  <button className="icon-btn" onClick={copyOutput} title={copied ? 'Copied!' : 'Copy'}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button className="icon-btn" onClick={downloadOutput} title="Download .md">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download
                  </button>
                </>
              )}
              <button className="icon-btn focus-btn active" onClick={() => setFocusMode(false)} title="Exit focus (Esc)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
                Exit focus
              </button>
              <span className={`badge status-${activeTask.status}`}>{statusLabels[activeTask.status] || activeTask.status}</span>
            </div>
          </div>

          {activePipeline.length > 0 && (
            <div className="pipeline-track" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
              {activePipeline.map((step, i) => (
                <div key={step.id} style={{ display: 'contents' }}>
                  {i > 0 && <div className={`pipe-connector${activePipeline[i-1].status === 'completed' ? ' lit' : ''}`} />}
                  <div className={`pipe-step ${step.status}`}>
                    <div className="pipe-bubble"><span>{petInitial(step.pet_name)}</span>{step.status === 'running' && <div className="pipe-ring" />}</div>
                    <div className="pipe-label">{step.pet_name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="focus-overlay-body">
            {finalOutput ? (
              isStructuredArtifact ? (
                <ArtifactPanel artifact={finalOutput as Artifact} workspaceId={workspaceId} onUpdate={u => setFinalOutput(u)} />
              ) : (
                <div className="output-content">
                  <MarkdownRenderer
                    content={typeof finalOutput === 'object'
                      ? ((finalOutput as Artifact).content as any)?.markdown || ((finalOutput as Artifact).content as any)?.body || JSON.stringify((finalOutput as Artifact).content, null, 2)
                      : finalOutput}
                    size="md"
                  />
                </div>
              )
            ) : (
              <div className="output-placeholder">
                <p>No output yet</p>
              </div>
            )}
          </div>

          {/* Thread in focus mode — inline below output, same scroll */}
          {taskThread.length > 0 && (
            <div className="thread-inline" style={{ padding: '0 24px 16px' }}>
              <div className="thread-divider" />
              {taskThread.map(m => (
                <div key={m.id} className={`thread-msg thread-msg-${m.role}`}>
                  {(m.loading || (m.role === 'assistant' && !m.content && !m.rendered))
                    ? <div className="typing-dots" style={{ padding: '6px 0' }}><span /><span /><span /></div>
                    : m.rendered
                      ? (
                        <div className="thread-rendered">
                          {m.content && <p className="thread-rendered-label">{m.content}</p>}
                          <div className="thread-graph-wrap">
                            {m.rendered.type === 'graph'
                              ? <InlineGraph content={m.rendered.content} onFullscreen={() => setGraphModal(m.rendered!.content)} />
                              : <InlineTable content={m.rendered.content} />}
                          </div>
                        </div>
                      )
                      : m.role === 'assistant'
                        ? <div className="thread-assistant-text"><MarkdownRenderer content={m.content} size="sm" /></div>
                        : <div className="thread-user-bubble">{m.content}</div>
                  }
                </div>
              ))}
            </div>
          )}

          <div className="focus-overlay-footer">
            <textarea className="followup-input" placeholder="Ask about this output, request changes, or just chat…" rows={1}
              value={humanMsg} onChange={e => setHumanMsg(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendHumanMsg() } }} />
            <button className="send-btn" disabled={!humanMsg.trim() || sendingMsg} onClick={sendHumanMsg} title="Send (Enter)">
              {sendingMsg
                ? <span className="spinner" />
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              }
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className={`app-toast toast-${toastType}`}>
          {toastMsg}
          <button className="toast-close" onClick={() => setToastMsg('')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Meeting modal */}
      {showMeetingInput && (
        <div className="modal-backdrop" onClick={() => setShowMeetingInput(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><span>Add meeting transcript</span>
              <button className="btn-icon" onClick={() => setShowMeetingInput(false)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </div>
            <div className="modal-body"><textarea className="modal-textarea" placeholder="Paste meeting transcript or notes here…" rows={8} value={meetingInputText} onChange={e => setMeetingInputText(e.target.value)} /></div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setShowMeetingInput(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!meetingInputText.trim() || processingMeeting} onClick={handleMeetingSubmit}>{processingMeeting ? <span className="spinner" /> : 'Process transcript'}</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .cc { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg); }

        /* ── Focus overlay (covers sidebar + everything, fixed full viewport) ── */
        body[data-focus='1'] .sidebar,
        body[data-focus='1'] nav { display: none !important; }
        body[data-focus='1'] .page-content { margin-left: 0 !important; width: 100% !important; }

        .focus-overlay { position: fixed; inset: 0; z-index: 999; background: #080a0f; display: flex; flex-direction: column; animation: focusIn .18s ease; }
        .focus-overlay-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 14px 24px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
        .focus-overlay-title h2 { font-size: 14px; font-weight: 600; color: var(--text-1,#f1f5f9); margin: 0 0 2px; }
        .focus-overlay-title p { font-size: 12px; color: var(--text-3,#64748b); margin: 0; }
        .focus-overlay-body { flex: 1; overflow-y: auto; padding: 24px 32px; width: 100%; box-sizing: border-box; }
        .focus-overlay-footer { border-top: 1px solid rgba(255,255,255,0.06); padding: 10px 32px; display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0; width: 100%; box-sizing: border-box; }
        @keyframes focusIn { from { opacity: 0; } to { opacity: 1; } }

        /* Focus button active state */
        .focus-btn.active { background: rgba(99,102,241,0.12); border-color: rgba(99,102,241,0.3); color: #818cf8; }

        /* ── Drag handles ── */
        .drag-handle { position: absolute; z-index: 10; transition: background .15s; }
        .drag-handle:hover, .drag-handle:active { background: rgba(255,255,255,0.12) !important; }
        .drag-handle-v { top: 0; bottom: 0; width: 4px; cursor: col-resize; }
        .drag-handle-h { left: 0; right: 0; height: 4px; bottom: 0; cursor: row-resize; }
        .drag-handle-left { right: 0; left: auto; border-radius: 0 2px 2px 0; }
        .drag-handle-right { left: 0; right: auto; border-radius: 2px 0 0 2px; }

        /* ── Top bar ── */
        .topbar { position: relative; display: grid; grid-template-columns: auto 1fr auto; align-items: start; gap: 16px; padding: 10px 16px 12px; flex-shrink: 0; border-bottom: 1px solid rgba(255,255,255,0.06); overflow: hidden; }
        .topbar-left { display: flex; align-items: baseline; gap: 10px; padding-top: 3px; }
        .ws-name { font-size: 15px; font-weight: 600; color: var(--text-1,#f1f5f9); margin: 0; white-space: nowrap; }
        .date-label { font-size: 12px; color: var(--text-3,#64748b); white-space: nowrap; }
        .topbar-center { display: flex; flex-direction: column; gap: 5px; overflow: hidden; }
        .topbar-right { display: flex; gap: 5px; padding-top: 3px; }
        .stat-chip { display: flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 20px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); font-size: 11px; color: var(--text-3,#64748b); }
        .stat-chip.accent { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.15); color: #818cf8; }
        .stat-chip.green { background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.15); color: #34d399; }
        .stat-n { font-weight: 700; font-size: 12px; }

        .command-bar { display: flex; align-items: flex-start; gap: 8px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 9px; padding: 7px 9px; transition: border-color .15s; }
        .command-bar.focused { border-color: rgba(255,255,255,0.18); }
        .cmd-icon { color: var(--text-3,#64748b); margin-top: 2px; flex-shrink: 0; }
        .cmd-input { flex: 1; border: none; background: none; outline: none; font-size: 13px; color: var(--text-1,#f1f5f9); resize: none; line-height: 1.5; min-height: 20px; max-height: 140px; overflow-y: auto; font-family: inherit; }
        .cmd-input::placeholder { color: var(--text-3,#64748b); }
        .cmd-send { width: 26px; height: 26px; border-radius: 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-1,#f1f5f9); flex-shrink: 0; }
        .cmd-send:not(:disabled):hover { background: rgba(255,255,255,0.13); }
        .cmd-send:disabled { opacity: 0.3; cursor: not-allowed; }
        .cmd-hints { display: flex; gap: 4px; flex-wrap: wrap; }
        .hint-pill { font-size: 11px; padding: 2px 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; color: var(--text-3,#64748b); cursor: pointer; }
        .hint-pill:hover { border-color: rgba(255,255,255,0.12); color: var(--text-2,#94a3b8); }

        /* ── Body grid ── */
        .body-grid { display: grid; flex: 1; overflow: hidden; }
        .tasks-col { position: relative; border-right: 1px solid var(--border); overflow-y: auto; display: flex; flex-direction: column; padding: 8px 6px; background: var(--surface); min-width: 0; overflow-x: hidden; }
        .completed-col { border-left: 1px solid var(--border); overflow-y: auto; padding: 8px 6px 8px 12px; background: var(--surface); min-width: 0; overflow-x: hidden; }
        .task-group { display: flex; flex-direction: column; gap: 1px; margin-bottom: 6px; }
        .group-label { display: flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: var(--text-3,#64748b); padding: 5px 5px 2px; }
        .label-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
        .label-dot.amber { background: #f59e0b; } .label-dot.blue { background: rgba(255,255,255,0.25); } .label-dot.green { background: #10b981; }
        .task-item { padding: 7px 7px; border-radius: 5px; cursor: pointer; border: 1px solid transparent; transition: all .1s; }
        .task-item:hover { background: rgba(255,255,255,0.04); }
        .task-item.active { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.09); }
        .task-item.completed { opacity: .6; }
        .task-top { display: flex; align-items: flex-start; gap: 4px; margin-bottom: 3px; }
        .task-title { font-size: 11.5px; font-weight: 500; flex: 1; color: var(--text-1,#f1f5f9); line-height: 1.35; }
        .task-date { font-size: 10px; color: var(--text-3,#64748b); }
        .task-row { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
        .approval-row { display: flex; gap: 4px; margin-top: 5px; }
        .badge { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 20px; background: rgba(255,255,255,0.05); color: var(--text-3,#64748b); }
        .badge-green { background: rgba(16,185,129,0.1); color: #34d399; }
        .status-in_progress { background: rgba(255,255,255,0.06); color: var(--text-2,#94a3b8); }
        .mri-badge { font-size: 9px; font-weight: 700; color: var(--text-3,#64748b); background: rgba(255,255,255,0.05); padding: 1px 4px; border-radius: 3px; flex-shrink: 0; }
        .mini-pipe { display: flex; gap: 2px; margin-top: 4px; }
        .mini-step { width: 15px; height: 15px; border-radius: 50%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); display: flex; align-items: center; justify-content: center; font-size: 7px; color: #94a3b8; }
        .mini-step.running { animation: pulse 1.5s infinite; } .mini-step.completed { border-color: rgba(16,185,129,0.2); color: #34d399; }
        .empty-section { padding: 3px 5px; } .empty-section span { font-size: 10px; color: var(--text-3,#64748b); font-style: italic; }
        .del-btn { background: none; border: none; cursor: pointer; color: var(--text-3,#64748b); font-size: 10px; padding: 1px 3px; border-radius: 3px; flex-shrink: 0; }
        .del-btn:hover { background: rgba(239,68,68,0.1); color: #f87171; }

        /* ── Chat count badge (sidebar) ── */
        .chat-count { background: rgba(99,102,241,0.18); color: #818cf8; border-radius: 10px; padding: 0 5px; font-size: 9px; font-weight: 700; }

        /* ── Chat center panel ── */
        .chat-center-body { display: flex; flex-direction: column; }
        .chat-center-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 32px 24px; text-align: center; color: var(--text-3,#64748b); }
        .chat-center-empty p { font-size: 13px; margin: 0; max-width: 340px; line-height: 1.6; }
        .chat-center-hints { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 4px; }
        .chat-center-messages { display: flex; flex-direction: column; gap: 10px; padding: 14px 18px; background: var(--surface); }
        .chat-center-msg { display: flex; margin-bottom: 2px; }
        .chat-center-msg-user { justify-content: flex-end; }
        .chat-center-msg-assistant { justify-content: flex-start; }
        .chat-center-bubble { max-width: 82%; }
        .chat-center-msg-user .chat-center-bubble p { font-size: 13px; line-height: 1.65; margin: 0; white-space: pre-wrap; word-break: break-word; background: var(--surface-3); color: var(--text-1); border: 1px solid var(--border); padding: 8px 13px; border-radius: 16px 16px 3px 16px; }
        .chat-center-msg-assistant .chat-center-bubble { padding: 2px 0; color: rgba(241,235,228,0.92); font-size: 13px; line-height: 1.75; word-break: break-word; }
        .chat-center-msg-assistant .chat-center-bubble p { margin: 0 0 6px; }
        .chat-center-msg-assistant .chat-center-bubble p:last-child { margin-bottom: 0; }

        /* ── Center column ── */
        
        .task-header-bar { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; padding: 10px 14px 9px; border-bottom: 1px solid var(--border); flex-shrink: 0; background: var(--surface); }
        .task-header-info h2 { font-size: 13.5px; font-weight: 600; color: var(--text-1,#f1f5f9); margin: 0 0 2px; }
        .task-header-info p { font-size: 12px; color: var(--text-3,#64748b); margin: 0; line-height: 1.4; }
        .icon-btn { display: flex; align-items: center; gap: 4px; padding: 3px 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 5px; font-size: 11px; color: var(--text-2,#94a3b8); cursor: pointer; font-family: inherit; white-space: nowrap; outline: none; }
        .icon-btn:hover { background: rgba(255,255,255,0.08); color: var(--text-1,#f1f5f9); }
        .pipeline-track { display: flex; align-items: center; padding: 9px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0; background: var(--surface); }
        .pipe-step { display: flex; flex-direction: column; align-items: center; gap: 3px; }
        .pipe-connector { width: 28px; height: 1.5px; background: var(--border); margin-bottom: 17px; }
        .pipe-connector.lit { background: rgba(16,185,129,0.4); }
        .pipe-bubble { width: 30px; height: 30px; border-radius: 7px; border: 1px solid var(--border); background: var(--surface-3); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--text-2); position: relative; }
        .pipe-step.waiting .pipe-bubble { opacity: .3; }
        .pipe-step.running .pipe-bubble { border-color: var(--text-3); background: var(--surface-3); color: var(--text-1); }
        .pipe-step.completed .pipe-bubble { border-color: rgba(16,185,129,0.25); background: rgba(16,185,129,0.07); color: #34d399; }
        .pipe-step.failed .pipe-bubble { border-color: rgba(239,68,68,0.25); background: rgba(239,68,68,0.07); }
        .pipe-ring { position: absolute; inset: -3px; border-radius: 10px; border: 1.5px solid transparent; border-top-color: rgba(255,255,255,0.35); animation: spin .8s linear infinite; }
        .pipe-label { font-size: 9px; color: var(--text-3,#64748b); }
        .pipe-step.running .pipe-label { color: var(--text-2,#94a3b8); } .pipe-step.completed .pipe-label { color: #34d399; }

        .output-body { flex: 1; overflow-y: auto; padding: 0; background: var(--surface); }
        .output-content { font-size: 13.5px; line-height: 1.75; color: var(--text-1); padding: 16px 20px; background: var(--surface); }
        .output-placeholder { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 56px 24px; text-align: center; color: var(--text-3); }
        .output-placeholder p { font-size: 13px; margin: 0; }
        .transcript-body { font-size: 13px; line-height: 1.7; color: var(--text-1,#f1f5f9); white-space: pre-wrap; }
        .typing-dots { display: flex; gap: 4px; padding: 4px 0; }
        .typing-dots span { width: 4px; height: 4px; background: rgba(255,255,255,0.25); border-radius: 50%; animation: bounce 1.2s infinite; }
        .typing-dots span:nth-child(2) { animation-delay: .2s; } .typing-dots span:nth-child(3) { animation-delay: .4s; }
        .followup-bar { border-top: 1px solid var(--border); padding: 8px 12px; display: flex; gap: 7px; align-items: flex-end; flex-shrink: 0; background: var(--surface); }
        .followup-input { flex: 1; border: 1px solid var(--border); border-radius: 20px; padding: 6px 14px; font-size: 13px; resize: none; background: var(--surface-3); color: var(--text-1); outline: none; font-family: inherit; }
        .followup-input:focus { border-color: var(--text-3); }
        .send-btn { width: 32px; height: 32px; border-radius: 7px; background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.13); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-1,#f1f5f9); flex-shrink: 0; transition: background .13s; }
        .send-btn:hover:not(:disabled) { background: rgba(255,255,255,0.15); }
        .send-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        /* ── Task thread — sits below output, above followup bar ── */
        .pipeline-col { display: flex; flex-direction: column; overflow: hidden; min-width: 0; background: var(--surface); position: relative; }
        /* single scroll area */
        .thread-inline { padding: 0 16px 24px; }
        .thread-divider { height: 1px; background: var(--border); margin: 16px 0; }
        .thread-msg { display: flex; flex-direction: column; margin-bottom: 14px; }
        .thread-msg-user { align-items: flex-end; }
        .thread-msg-assistant { align-items: flex-start; }
        .thread-user-bubble { max-width: 78%; padding: 8px 13px; border-radius: 16px 16px 4px 16px; background: var(--surface-3); color: var(--text-1); font-size: 13px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; border: 1px solid var(--border); }
        .thread-assistant-text { color: var(--text-1); word-break: break-word; max-width: 94%; padding: 2px 0; }
        .thread-rendered { width: 100%; } .thread-rendered-label { font-size: 12.5px; color: var(--text-2); margin: 0 0 8px; } .thread-graph-wrap { width: 100%; height: 300px; position: relative; }
        /* ── Graph fullscreen modal ── */

        /* ── Live streaming feed ── */
        .live-feed { display: flex; flex-direction: column; gap: 12px; padding: 16px; background: var(--surface); flex: 1; }
        .live-agent-header { display: flex; align-items: center; gap: 7px; margin-bottom: 4px; }
        .live-agent-dot { width: 6px; height: 6px; border-radius: 50%; background: #10b981; animation: pulse 1.5s infinite; flex-shrink: 0; }
        .live-agent-name { font-size: 11px; font-weight: 600; color: #34d399; text-transform: capitalize; }
        .live-thinking { padding: 8px 0; }
        .live-stream-text { font-size: 13.5px; line-height: 1.8; color: var(--text-1,#f1f5f9); word-break: break-word; }
        .live-stream-text p { margin: 0 0 10px; }
        .live-stream-text p:last-child { margin-bottom: 0; }
        .live-cursor { display: inline-block; width: 2px; height: 15px; background: #6366f1; margin-left: 2px; vertical-align: text-bottom; animation: live-blink .6s step-end infinite; border-radius: 1px; }
        @keyframes live-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .live-stream-area { flex: 1; overflow-y: auto; padding: 12px 0 24px; }

        /* Claude-style thinking header */
        .live-thinking-header { display: flex; align-items: center; gap: 12px; padding: 16px 0 12px; border-bottom: 1px solid var(--border-soft, rgba(255,255,255,0.06)); margin-bottom: 14px; flex-shrink: 0; }
        .live-thinking-orb { width: 32px; height: 32px; border-radius: 50%; background: radial-gradient(circle at 35% 35%, #818cf8, #6366f1 60%, #4338ca); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 0 12px rgba(99,102,241,.35); animation: orb-pulse 2s ease-in-out infinite; }
        .live-orb-inner { width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,0.85); animation: orb-inner-pulse 2s ease-in-out infinite; }
        @keyframes orb-pulse { 0%,100%{box-shadow:0 0 12px rgba(99,102,241,.35)} 50%{box-shadow:0 0 22px rgba(99,102,241,.6)} }
        @keyframes orb-inner-pulse { 0%,100%{transform:scale(1);opacity:.85} 50%{transform:scale(1.2);opacity:1} }
        .live-pet-name { font-size: 11px; font-weight: 700; color: #818cf8; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 2px; }
        .live-phrase { font-size: 14px; font-weight: 500; color: var(--text-1, #f1f5f9); font-style: italic; animation: phrase-fade .4s ease; }
        @keyframes phrase-fade { from{opacity:0;transform:translateY(3px)} to{opacity:1;transform:translateY(0)} }
        .live-token-count { font-size: 10px; color: var(--text-3); font-variant-numeric: tabular-nums; flex-shrink: 0; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .select-prompt { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-3,#64748b); text-align: center; }
        .select-prompt p { font-size: 13px; margin: 0; }

        .transcript-banner { display: flex; align-items: center; gap: 10px; padding: 10px 14px; margin: 0; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
        .tb-icon { width: 30px; height: 30px; border-radius: 7px; background: rgba(255,255,255,0.08); color: var(--text-2,#94a3b8); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .tb-content { flex: 1; } .tb-label { font-size: 12px; color: var(--text-1,#f1f5f9); display: block; } .tb-sub { font-size: 11px; color: var(--text-3,#64748b); }
        .tb-actions { display: flex; gap: 6px; flex-shrink: 0; }

        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 5px; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; }
        .btn-primary { background: rgba(255,255,255,0.09); color: var(--text-1,#f1f5f9); border: 1px solid rgba(255,255,255,0.13); }
        .btn-primary:hover:not(:disabled) { background: rgba(255,255,255,0.13); }
        .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: var(--text-2,#94a3b8); border: 1px solid rgba(255,255,255,0.08); }
        .btn-ghost:hover { background: rgba(255,255,255,0.04); }
        .btn-danger { background: rgba(239,68,68,0.08); color: #f87171; border: 1px solid rgba(239,68,68,0.14); }
        .btn-sm { font-size: 11px; padding: 3px 9px; } .btn-xs { padding: 2px 6px; font-size: 10px; }
        .btn-icon { background: none; border: none; cursor: pointer; color: var(--text-3,#64748b); display: flex; padding: 3px; }
        .spinner { width: 12px; height: 12px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.15); border-top-color: rgba(255,255,255,0.6); animation: spin 0.7s linear infinite; display: inline-block; }
        .priority-dot { width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,0.18); flex-shrink: 0; }
        .priority-dot.high { background: rgba(239,68,68,0.6); } .priority-dot.medium { background: rgba(245,158,11,0.6); } .priority-dot.low { background: rgba(16,185,129,0.6); }

        .app-toast { position: fixed; bottom: 76px; right: 18px; z-index: 900; display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 9px; max-width: 340px; font-size: 12px; font-weight: 500; box-shadow: 0 8px 32px rgba(0,0,0,.3); }
        .toast-error { background: rgba(25,8,8,0.97); border: 1px solid rgba(239,68,68,.25); color: #fca5a5; }
        .toast-success { background: rgba(8,25,16,0.97); border: 1px solid rgba(16,185,129,.25); color: #6ee7b7; }
        .toast-info { background: rgba(10,10,25,0.97); border: 1px solid rgba(99,102,241,.25); color: #a5b4fc; }
        .toast-close { background: none; border: none; color: rgba(255,255,255,.35); cursor: pointer; padding: 0; display: flex; flex-shrink: 0; margin-left: 4px; }

        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.65); display: flex; align-items: center; justify-content: center; z-index: 800; }
        .modal { background: #131620; border: 1px solid rgba(255,255,255,0.09); border-radius: 11px; width: 480px; max-width: 95vw; }
        .modal-head { display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); font-size: 13px; font-weight: 600; color: #f1f5f9; }
        .modal-body { padding: 13px 16px; }
        .modal-textarea { width: 100%; padding: 8px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #f1f5f9; font-size: 12px; resize: vertical; box-sizing: border-box; outline: none; font-family: inherit; }
        .modal-textarea:focus { border-color: rgba(255,255,255,0.18); }
        .modal-foot { display: flex; justify-content: flex-end; gap: 6px; padding: 10px 16px; border-top: 1px solid rgba(255,255,255,0.07); }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-4px)} }
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes graphFadeIn { from{opacity:0} to{opacity:1} }
      `}</style>
    </div>
  )
}