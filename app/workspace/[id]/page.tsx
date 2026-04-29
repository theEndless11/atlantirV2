'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useWorkspaceStore } from '@/store/workspace'

function supabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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

function renderMarkdown(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
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
  const [recentMeetings, setRecentMeetings] = useState<any[]>([])
  const [transcriptBanner, setTranscriptBanner] = useState<{ title: string; transcript: string } | null>(null)

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
  const [finalOutput, setFinalOutput] = useState('')
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
    store.setActiveTaskId(null)
    setFinalOutput(''); setActivePipeline([]); setLiveUpdates([])
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
    if (text.toLowerCase().includes('meeting')) {
      setCmdText(''); setShowMeetingInput(true); return
    }
    setCmdLoading(true); setCmdText('')
    if (cmdInputRef.current) cmdInputRef.current.style.height = 'auto'
    try {
      const prevCount = store.tasks.length
      await store.processMeetingTranscript(text)
      const newTask = store.tasks.find(t => !store.tasks.slice(0, prevCount).some(p => p.id === t.id))
      if (newTask) await selectTask(newTask.id)
      else if (store.tasks.length > 0) await selectTask(store.tasks[0].id)
    } catch (e: any) {
      showToast(e?.message || 'Failed to create task')
    } finally {
      setCmdLoading(false)
    }
  }

  async function selectTask(taskId: string) {
    setSelectedMeeting(null)
    store.setActiveTaskId(taskId)
    setFinalOutput(''); setLiveUpdates([])

    const sb = supabase()
    const [pipelineRes] = await Promise.all([
      sb.from('task_pipeline').select('*').eq('task_id', taskId).order('step_index'),
      store.loadArtifacts(workspaceId)
    ])
    setActivePipeline(pipelineRes.data || [])

    const artifact = store.artifacts.find(a => a.task_id === taskId)
    if (artifact) { setFinalOutput(artifact.content); return }

    const { data: directArtifact } = await sb
      .from('artifacts').select('content')
      .eq('task_id', taskId).order('created_at', { ascending: false })
      .limit(1).maybeSingle()
    if (directArtifact?.content) setFinalOutput(directArtifact.content)
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

  async function sendHumanMsg() {
    if (!humanMsg.trim() || !store.activeTaskId) return
    const text = humanMsg.trim(); setHumanMsg('')
    await store.sendMessage(text, store.activeTaskId)
    if (activeTask?.status === 'needs_clarification') store.runTask(store.activeTaskId)
  }

  async function handleDelete(taskId: string) {
    if (window.confirm('Delete this task?')) await store.deleteTask(taskId)
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

  useEffect(() => {
    const sb = supabase()

    let unsubscribeStore: (() => void) | null = null
    store.loadWorkspaces().then(async () => {
      await store.loadTasks(workspaceId)
      await store.loadArtifacts(workspaceId)
      unsubscribeStore = store.subscribeToWorkspace(workspaceId)
    })

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

    // Pipeline realtime
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
                await store.loadArtifacts(workspaceId)
                const artifact = store.artifacts.find(a => a.task_id === store.activeTaskId)
                if (artifact) setFinalOutput(artifact.content)
              }, 800)
            }
          }
        })
      .subscribe()

    return () => {
      pipelineChannel.unsubscribe()
      unsubscribeStore?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  // Watch task status for completion
  useEffect(() => {
    if (activeTask?.status === 'completed' && store.activeTaskId) {
      const tryLoad = async () => {
        for (let attempt = 0; attempt < 4; attempt++) {
          await new Promise(r => setTimeout(r, attempt * 600))
          await store.loadArtifacts(workspaceId)
          const artifact = store.artifacts.find(a => a.task_id === store.activeTaskId)
          if (artifact?.content) { setFinalOutput(artifact.content); break }
          const { data } = await supabase()
            .from('artifacts').select('content')
            .eq('task_id', store.activeTaskId!).order('created_at', { ascending: false })
            .limit(1).maybeSingle()
          if (data?.content) { setFinalOutput(data.content); break }
        }
      }
      tryLoad()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTask?.status])

  return (
    <div className="command-center">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-left">
          <h1 className="ws-name">{workspaceName}</h1>
          <span className="date-label">{today}</span>
        </div>
        <div className="topbar-right">
          <div className="stat-chip"><span className="stat-n">{pendingTasks.length}</span><span>awaiting</span></div>
          <div className="stat-chip accent"><span className="stat-n">{activeTasks.length}</span><span>running</span></div>
          <div className="stat-chip green"><span className="stat-n">{completedTasks.length}</span><span>done</span></div>
        </div>
      </div>

      {/* Command bar */}
      <div className="command-bar-wrap">
        <div className={`command-bar${cmdFocused ? ' focused' : ''}`}>
          <svg className="cmd-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <textarea
            ref={cmdInputRef}
            className="cmd-input"
            placeholder="What do you want to get done? Describe a goal, task, or question…"
            rows={1}
            value={cmdText}
            onFocus={() => setCmdFocused(true)}
            onBlur={() => setCmdFocused(false)}
            onChange={e => { setCmdText(e.target.value); autoResize(e) }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitCommand() } }}
          />
          <button className="cmd-send" disabled={!cmdText.trim() || cmdLoading} onClick={submitCommand}>
            {cmdLoading
              ? <span className="spinner" />
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            }
          </button>
        </div>
        <div className="cmd-hints">
          {cmdHints.map(hint => (
            <button key={hint} className="hint-pill" onClick={() => setCmdText(hint)}>{hint}</button>
          ))}
        </div>
      </div>

      {/* Transcript banner */}
      {transcriptBanner && (
        <div className="transcript-banner">
          <div className="tb-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.894L15 14"/><rect x="3" y="8" width="12" height="8" rx="2"/></svg>
          </div>
          <div className="tb-content">
            <span className="tb-label">Transcript from <strong>{transcriptBanner.title}</strong> is ready</span>
            <span className="tb-sub">Create tasks from this meeting or ask agents to analyze it</span>
          </div>
          <div className="tb-actions">
            <button className="btn btn-primary btn-sm" onClick={createTasksFromTranscript}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Create tasks
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setTranscriptBanner(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Body grid */}
      <div className="body-grid">
        {/* Left: meetings + tasks */}
        <aside className="tasks-col">
          {/* Recent meetings */}
          <div className="task-group">
            <div className="group-label"><span className="label-dot blue" />Recent Meetings</div>
            {recentMeetings.length ? recentMeetings.map(m => (
              <div key={m.id} className={`task-item${selectedMeeting?.id === m.id ? ' active' : ''}`} onClick={() => openMeeting(m)}>
                <div className="task-top">
                  <span className="task-title">{m.title || 'Untitled meeting'}</span>
                  {m.transcript && <span className="mri-badge">Transcript</span>}
                </div>
                <div className="task-row"><span className="task-date">{formatDate(m.created_at)}</span></div>
              </div>
            )) : <div className="empty-section"><span>No recent meetings</span></div>}
          </div>

          {/* Needs approval */}
          <div className="task-group">
            <div className="group-label"><span className="label-dot amber" />Needs approval</div>
            {pendingTasks.length ? pendingTasks.map(task => (
              <div key={task.id} className={`task-item${store.activeTaskId === task.id ? ' active' : ''}`} onClick={() => selectTask(task.id)}>
                <div className="task-top">
                  <span className="task-title">{task.title}</span>
                  <span className={`priority-dot ${task.priority}`} />
                </div>
                <div className="task-row">
                  <span className={`badge agent-${task.assigned_agent}`}>{task.assigned_agent}</span>
                </div>
                <div className="approval-row" onClick={e => e.stopPropagation()}>
                  <button className="btn btn-primary btn-xs" onClick={() => handleApprove(task.id)}>✓ Approve</button>
                  <button className="btn btn-danger btn-xs" onClick={() => handleReject(task.id)}>✕</button>
                </div>
              </div>
            )) : <div className="empty-section"><span>No tasks awaiting approval</span></div>}
          </div>

          {/* In progress */}
          <div className="task-group">
            <div className="group-label"><span className="label-dot blue" />In progress</div>
            {activeTasks.length ? activeTasks.map(task => (
              <div key={task.id} className={`task-item${store.activeTaskId === task.id ? ' active' : ''}`} onClick={() => selectTask(task.id)}>
                <div className="task-top">
                  <span className="task-title">{task.title}</span>
                  <span className={`priority-dot ${task.priority}`} />
                </div>
                <div className="task-row">
                  <span className="badge status-in_progress">Running</span>
                  {task.assigned_agent && <span className={`badge agent-${task.assigned_agent}`}>{task.assigned_agent}</span>}
                </div>
                {taskPipelines[task.id]?.length > 0 && (
                  <div className="mini-pipe">
                    {taskPipelines[task.id].map(step => (
                      <div key={step.id} className={`mini-step ${step.status}`} title={step.pet_name}>{petInitial(step.pet_name)}</div>
                    ))}
                  </div>
                )}
              </div>
            )) : <div className="empty-section"><span>No tasks in progress</span></div>}
          </div>
        </aside>

        {/* Center: pipeline / meeting */}
        <section className="pipeline-col">
          {selectedMeeting ? (
            <>
              <div className="task-header-bar">
                <div className="task-header-info">
                  <h2>{selectedMeeting.title || 'Untitled meeting'}</h2>
                  <p>{formatDate(selectedMeeting.created_at)}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn btn-primary btn-sm" disabled={creatingTasksFromMeeting || !selectedMeeting.transcript} onClick={createTasksFromMeeting}>
                    {creatingTasksFromMeeting ? <span className="spinner" /> : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                    {creatingTasksFromMeeting ? 'Creating…' : 'Create Tasks'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedMeeting(null)}>✕ Close</button>
                </div>
              </div>
              <div className="output-body">
                {selectedMeeting.transcript ? (
                  <div className="meeting-transcript">
                    <div className="output-label">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.894L15 14"/><rect x="3" y="8" width="12" height="8" rx="2"/></svg>
                      Transcript
                    </div>
                    <div className="transcript-body">{selectedMeeting.transcript}</div>
                  </div>
                ) : (
                  <div className="output-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.894L15 14"/><rect x="3" y="8" width="12" height="8" rx="2"/></svg>
                    <p>No transcript available for this meeting</p>
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => setShowMeetingInput(true)}>Add transcript manually</button>
                  </div>
                )}
              </div>
            </>
          ) : activeTask ? (
            <>
              <div className="task-header-bar">
                <div className="task-header-info">
                  <h2>{activeTask.title}</h2>
                  {activeTask.description && <p>{activeTask.description}</p>}
                </div>
                <span className={`badge status-${activeTask.status}`}>{statusLabels[activeTask.status] || activeTask.status}</span>
              </div>

              {activePipeline.length > 0 && (
                <div className="pipeline-track">
                  {activePipeline.map((step, i) => (
                    <div key={step.id} style={{ display: 'contents' }}>
                      {i > 0 && <div className={`pipe-connector${activePipeline[i-1].status === 'completed' ? ' lit' : ''}`} />}
                      <div className={`pipe-step ${step.status}`}>
                        <div className="pipe-bubble">
                          <span>{petInitial(step.pet_name)}</span>
                          {step.status === 'running' && <div className="pipe-ring" />}
                        </div>
                        <div className="pipe-label">{step.pet_name}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="output-body">
                {activeTask.status === 'pending_approval' ? (
                  <div className="output-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <p>Approve this task to start the agent pipeline</p>
                  </div>
                ) : finalOutput ? (
                  <div className="final-output">
                    <div className="output-label">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
                      Output
                    </div>
                    <div className="output-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(finalOutput) }} />
                    <details className="thinking-details">
                      <summary>Agent thinking</summary>
                      <div className="thinking-stream">
                        {liveUpdates.filter(u => u.update_type === 'progress').map(u => (
                          <div key={u.id} className="think-item">
                            <span className="think-pet">{u.pet_name}</span>
                            <p>{u.content}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                ) : activeTask.status === 'in_progress' ? (
                  <div className="live-feed">
                    {liveUpdates.map(u => (
                      <div key={u.id} className="live-update">
                        {u.update_type === 'started' && <span className="live-started">{u.pet_name} working…</span>}
                        {u.update_type === 'progress' && (
                          <div className="live-progress">
                            <span className="live-pet">{u.pet_name}</span>
                            <p>{u.content}</p>
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="typing-dots"><span /><span /><span /></div>
                  </div>
                ) : (
                  <div className="output-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <p>No output yet</p>
                  </div>
                )}
              </div>

              <div className="followup-bar">
                <textarea
                  className="followup-input"
                  placeholder="Add a note, ask a follow-up, or request changes…"
                  rows={1}
                  value={humanMsg}
                  onChange={e => setHumanMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendHumanMsg() } }}
                />
                <button className="btn btn-primary" disabled={!humanMsg.trim()} onClick={sendHumanMsg}>Send</button>
              </div>
            </>
          ) : (
            <div className="select-prompt">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M4 6h16M4 12h10M4 18h7"/></svg>
              <p>Select a meeting or task to get started</p>
            </div>
          )}
        </section>

        {/* Right: completed */}
        <aside className="completed-col">
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
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className={`app-toast toast-${toastType}`}>
          {toastMsg}
          <button className="toast-close" onClick={() => setToastMsg('')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Meeting input modal */}
      {showMeetingInput && (
        <div className="modal-backdrop" onClick={() => setShowMeetingInput(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span>Add meeting transcript</span>
              <button className="btn-icon" onClick={() => setShowMeetingInput(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <textarea
                className="modal-textarea"
                placeholder="Paste meeting transcript or notes here…"
                rows={8}
                value={meetingInputText}
                onChange={e => setMeetingInputText(e.target.value)}
              />
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setShowMeetingInput(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!meetingInputText.trim() || processingMeeting} onClick={handleMeetingSubmit}>
                {processingMeeting ? <span className="spinner" /> : 'Process transcript'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .command-center { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--bg, #0f1117); }
        .topbar { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px 0; flex-shrink: 0; }
        .topbar-left { display: flex; align-items: baseline; gap: 12px; }
        .ws-name { font-size: 18px; font-weight: 600; color: var(--text-1, #f1f5f9); margin: 0; }
        .date-label { font-size: 13px; color: var(--text-3, #64748b); }
        .topbar-right { display: flex; gap: 8px; }
        .stat-chip { display: flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; background: var(--surface, rgba(255,255,255,0.05)); border: 1px solid var(--border, rgba(255,255,255,0.08)); font-size: 12px; color: var(--text-2, #94a3b8); }
        .stat-chip.accent { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.2); color: #818cf8; }
        .stat-chip.green { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.2); color: #34d399; }
        .stat-n { font-weight: 700; font-size: 14px; }

        .command-bar-wrap { padding: 14px 24px 10px; flex-shrink: 0; }
        .command-bar { display: flex; align-items: flex-start; gap: 10px; background: var(--surface, rgba(255,255,255,0.05)); border: 1.5px solid var(--border, rgba(255,255,255,0.08)); border-radius: 12px; padding: 10px 12px; transition: border-color .15s; }
        .command-bar.focused { border-color: #6366f1; }
        .cmd-icon { color: var(--text-3, #64748b); margin-top: 2px; flex-shrink: 0; }
        .cmd-input { flex: 1; border: none; background: none; outline: none; font-size: 14px; color: var(--text-1, #f1f5f9); resize: none; line-height: 1.5; min-height: 22px; max-height: 140px; overflow-y: auto; font-family: inherit; }
        .cmd-input::placeholder { color: var(--text-3, #64748b); }
        .cmd-send { width: 30px; height: 30px; border-radius: 7px; background: #6366f1; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; margin-top: -2px; }
        .cmd-send:not(:disabled):hover { background: #4f46e5; }
        .cmd-send:disabled { opacity: 0.4; cursor: not-allowed; }
        .cmd-hints { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
        .hint-pill { font-size: 12px; padding: 4px 10px; background: var(--surface, rgba(255,255,255,0.04)); border: 1px solid var(--border, rgba(255,255,255,0.08)); border-radius: 20px; color: var(--text-2, #94a3b8); cursor: pointer; }
        .hint-pill:hover { border-color: #6366f1; color: #818cf8; }

        .body-grid { display: grid; grid-template-columns: 220px 1fr 200px; flex: 1; overflow: hidden; border-top: 1px solid var(--border, rgba(255,255,255,0.08)); margin-top: 4px; }
        .tasks-col { border-right: 1px solid var(--border, rgba(255,255,255,0.08)); overflow-y: auto; display: flex; flex-direction: column; gap: 4px; padding: 12px 10px; background: var(--surface, rgba(255,255,255,0.02)); }
        .task-group { display: flex; flex-direction: column; gap: 2px; margin-bottom: 6px; }
        .group-label { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .07em; color: var(--text-3, #64748b); padding: 6px 6px 4px; }
        .label-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .label-dot.amber { background: #f59e0b; }
        .label-dot.blue { background: #6366f1; }
        .label-dot.green { background: #10b981; }
        .task-item { padding: 9px 10px; border-radius: 8px; cursor: pointer; border: 1px solid transparent; transition: all .15s; }
        .task-item:hover { background: rgba(255,255,255,0.04); }
        .task-item.active { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.2); }
        .task-item.completed { opacity: .7; }
        .task-top { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 5px; }
        .task-title { font-size: 12px; font-weight: 500; flex: 1; color: var(--text-1, #f1f5f9); line-height: 1.4; }
        .task-date { font-size: 11px; color: var(--text-3, #64748b); }
        .task-row { display: flex; align-items: center; gap: 5px; }
        .approval-row { display: flex; gap: 5px; margin-top: 7px; }
        .badge { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 20px; background: rgba(255,255,255,0.06); color: var(--text-2, #94a3b8); }
        .badge-green { background: rgba(16,185,129,0.1); color: #34d399; }
        .status-in_progress { background: rgba(99,102,241,0.1); color: #818cf8; }
        .mri-badge { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #818cf8; background: rgba(99,102,241,0.1); padding: 2px 5px; border-radius: 4px; flex-shrink: 0; }
        .mini-pipe { display: flex; gap: 3px; margin-top: 6px; }
        .mini-step { width: 18px; height: 18px; border-radius: 50%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 9px; color: #94a3b8; }
        .mini-step.running { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.3); animation: pulse 1.5s infinite; }
        .mini-step.completed { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.3); }
        .empty-section { padding: 6px 8px 4px; }
        .empty-section span { font-size: 11px; color: var(--text-3, #64748b); font-style: italic; }
        .del-btn { background: none; border: none; cursor: pointer; color: var(--text-3, #64748b); font-size: 11px; padding: 2px 4px; border-radius: 3px; flex-shrink: 0; }
        .del-btn:hover { background: rgba(239,68,68,0.1); color: #f87171; }

        .pipeline-col { display: flex; flex-direction: column; overflow: hidden; }
        .task-header-bar { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 16px 22px 14px; background: var(--surface, rgba(255,255,255,0.02)); border-bottom: 1px solid var(--border, rgba(255,255,255,0.08)); flex-shrink: 0; }
        .task-header-info h2 { font-size: 15px; font-weight: 600; color: var(--text-1, #f1f5f9); margin: 0 0 3px; }
        .task-header-info p { font-size: 13px; color: var(--text-2, #94a3b8); margin: 0; }
        .pipeline-track { display: flex; align-items: center; padding: 14px 22px; background: var(--surface, rgba(255,255,255,0.02)); border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; gap: 0; }
        .pipe-step { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .pipe-connector { width: 36px; height: 2px; background: rgba(255,255,255,0.1); margin-bottom: 20px; }
        .pipe-connector.lit { background: #10b981; }
        .pipe-bubble { width: 36px; height: 36px; border-radius: 10px; border: 1.5px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: var(--text-2, #94a3b8); position: relative; }
        .pipe-step.waiting .pipe-bubble { opacity: .4; }
        .pipe-step.running .pipe-bubble { border-color: #6366f1; background: rgba(99,102,241,0.1); color: #818cf8; }
        .pipe-step.completed .pipe-bubble { border-color: #10b981; background: rgba(16,185,129,0.1); color: #34d399; }
        .pipe-step.failed .pipe-bubble { border-color: #ef4444; background: rgba(239,68,68,0.1); }
        .pipe-ring { position: absolute; inset: -4px; border-radius: 13px; border: 2px solid transparent; border-top-color: #6366f1; animation: spin .8s linear infinite; }
        .pipe-label { font-size: 10px; color: var(--text-3, #64748b); }
        .pipe-step.running .pipe-label { color: #818cf8; font-weight: 500; }
        .pipe-step.completed .pipe-label { color: #34d399; }
        .output-body { flex: 1; overflow-y: auto; padding: 18px 22px; }
        .output-placeholder { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 24px; text-align: center; color: var(--text-3, #64748b); }
        .output-placeholder p { font-size: 13px; margin: 0; }
        .meeting-transcript { display: flex; flex-direction: column; gap: 12px; }
        .transcript-body { font-size: 13px; line-height: 1.8; color: var(--text-1, #f1f5f9); white-space: pre-wrap; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 14px 16px; }
        .output-label { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #34d399; margin-bottom: 12px; }
        .output-content { font-size: 14px; line-height: 1.8; color: var(--text-1, #f1f5f9); }
        .thinking-details { margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px; }
        .thinking-details summary { font-size: 12px; color: var(--text-3, #64748b); cursor: pointer; }
        .thinking-stream { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
        .think-item { background: rgba(255,255,255,0.03); border-radius: 6px; padding: 10px 12px; }
        .think-pet { font-size: 11px; font-weight: 600; color: var(--text-2, #94a3b8); display: block; margin-bottom: 4px; }
        .think-item p { font-size: 12px; color: var(--text-2, #94a3b8); line-height: 1.6; white-space: pre-wrap; max-height: 100px; overflow-y: auto; margin: 0; }
        .live-feed { display: flex; flex-direction: column; gap: 12px; }
        .live-started { font-size: 12px; color: var(--text-3, #64748b); font-style: italic; }
        .live-pet { font-size: 11px; font-weight: 600; color: var(--text-2, #94a3b8); display: block; margin-bottom: 4px; }
        .live-progress p { font-size: 13px; color: var(--text-1, #f1f5f9); background: rgba(255,255,255,0.03); border-left: 2px solid rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 0 6px 6px 0; white-space: pre-wrap; max-height: 110px; overflow-y: auto; margin: 0; }
        .typing-dots { display: flex; gap: 4px; padding: 6px 0; }
        .typing-dots span { width: 5px; height: 5px; background: #6366f1; border-radius: 50%; animation: bounce 1.2s infinite; }
        .typing-dots span:nth-child(2) { animation-delay: .2s; }
        .typing-dots span:nth-child(3) { animation-delay: .4s; }
        .followup-bar { border-top: 1px solid rgba(255,255,255,0.08); padding: 10px 14px; display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0; background: var(--surface, rgba(255,255,255,0.02)); }
        .followup-input { flex: 1; border: 1.5px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 10px; font-size: 13px; resize: none; background: rgba(255,255,255,0.04); color: var(--text-1, #f1f5f9); outline: none; font-family: inherit; }
        .followup-input:focus { border-color: #6366f1; }
        .select-prompt { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--text-3, #64748b); text-align: center; }
        .select-prompt p { font-size: 13px; margin: 0; }
        .completed-col { border-left: 1px solid rgba(255,255,255,0.08); overflow-y: auto; background: rgba(255,255,255,0.02); padding: 12px 10px; display: flex; flex-direction: column; gap: 4px; }

        .transcript-banner { display: flex; align-items: center; gap: 12px; padding: 14px 18px; margin: 0 0 14px; background: rgba(99,102,241,0.06); border: 1px solid rgba(99,102,241,0.2); border-radius: 10px; flex-shrink: 0; }
        .tb-icon { width: 34px; height: 34px; border-radius: 8px; background: #6366f1; color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .tb-content { flex: 1; }
        .tb-label { font-size: 13px; color: var(--text-1, #f1f5f9); display: block; margin-bottom: 2px; }
        .tb-sub { font-size: 11px; color: var(--text-3, #64748b); }
        .tb-actions { display: flex; gap: 8px; flex-shrink: 0; }

        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; }
        .btn-primary { background: #6366f1; color: #fff; }
        .btn-primary:hover:not(:disabled) { background: #4f46e5; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: var(--text-2, #94a3b8); border: 1px solid rgba(255,255,255,0.1); }
        .btn-ghost:hover { background: rgba(255,255,255,0.05); }
        .btn-danger { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
        .btn-sm { font-size: 12px; padding: 5px 12px; }
        .btn-xs { padding: 3px 8px; font-size: 11px; }
        .btn-icon { background: none; border: none; cursor: pointer; color: var(--text-3, #64748b); display: flex; padding: 4px; }
        .spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; animation: spin 0.7s linear infinite; display: inline-block; }
        .priority-dot { width: 7px; height: 7px; border-radius: 50%; background: #6366f1; flex-shrink: 0; }
        .priority-dot.high { background: #ef4444; }
        .priority-dot.medium { background: #f59e0b; }
        .priority-dot.low { background: #10b981; }

        .app-toast { position: fixed; bottom: 88px; right: 24px; z-index: 900; display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 12px; max-width: 380px; font-size: 13px; font-weight: 500; line-height: 1.4; box-shadow: 0 8px 32px rgba(0,0,0,.25); }
        .toast-error { background: rgba(239,68,68,.95); color: #fff; }
        .toast-success { background: rgba(16,185,129,.95); color: #fff; }
        .toast-info { background: rgba(79,70,229,.95); color: #fff; }
        .toast-close { background: none; border: none; color: rgba(255,255,255,.7); cursor: pointer; padding: 0; display: flex; flex-shrink: 0; margin-left: 4px; }

        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 800; }
        .modal { background: #1a1d27; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; width: 480px; max-width: 95vw; }
        .modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 14px; font-weight: 600; color: #f1f5f9; }
        .modal-body { padding: 16px 20px; }
        .modal-textarea { width: 100%; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #f1f5f9; font-size: 13px; resize: vertical; box-sizing: border-box; outline: none; font-family: inherit; }
        .modal-textarea:focus { border-color: #6366f1; }
        .modal-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid rgba(255,255,255,0.08); }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }
      `}</style>
    </div>
  )
}
