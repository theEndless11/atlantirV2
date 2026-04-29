'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useDeepgram } from '@/hooks/useDeepgram'

interface Message { id: string; role?: string; sender_type: string; agent_type?: string; content: string; created_at: string }
interface Task { id: string; title: string; status: string }

function formatTime(ts: string) {
  try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}
function statusLabel(s: string) {
  const m: Record<string, string> = { pending_approval: 'Pending', in_progress: 'Running', completed: 'Done', cancelled: 'Cancelled' }
  return m[s] || s
}
function senderName(msg: Message) {
  if (msg.sender_type === 'user') return 'You'
  return msg.agent_type ? msg.agent_type.charAt(0).toUpperCase() + msg.agent_type.slice(1) + ' agent' : 'Agent'
}

export default function MeetingRoomPage() {
  const params = useParams()
  const router = useRouter()
  const workspaceId = Array.isArray(params.id) ? params.id[0] : params.id as string

  const { transcript, interimText, isRecording, isPaused, error: deepgramError, start, pause, resume, stop, setTranscript } = useDeepgram()

  const [meetingId, setMeetingId] = useState<string | null>(null)
  const [meetingTitle, setMeetingTitle] = useState('Untitled meeting')
  const [editingTitle, setEditingTitle] = useState(false)
  const [activeTab, setActiveTab] = useState('live')
  const [messages, setMessages] = useState<Message[]>([])
  const [meetingTasks, setMeetingTasks] = useState<Task[]>([])
  const [agentThinking, setAgentThinking] = useState(false)
  const [thinkingAgent, setThinkingAgent] = useState('')
  const [ended, setEnded] = useState(false)
  const [duration, setDuration] = useState('0:00')
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadError, setUploadError] = useState(false)

  const transcriptEl = useRef<HTMLDivElement>(null)
  const chatEl = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const analyzeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<Date | null>(null)
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastAnalyzedLengthRef = useRef(0)
  const botPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Bot join state
  const [botTab, setBotTab] = useState<'now' | 'schedule'>('now')
  const [selectedPlatform, setSelectedPlatform] = useState('googlemeet')
  const [botMeetingUrl, setBotMeetingUrl] = useState('')
  const [botZoomId, setBotZoomId] = useState('')
  const [botZoomPwd, setBotZoomPwd] = useState('')
  const [botJoinMethod, setBotJoinMethod] = useState<'url' | 'id'>('url')
  const [botName, setBotName] = useState('Atlantir')
  const [botNameTouched, setBotNameTouched] = useState(false)
  const [botResponseMode, setBotResponseMode] = useState('addressed')
  const [botInstructions, setBotInstructions] = useState('')
  const [botJoining, setBotJoining] = useState(false)
  const [botSession, setBotSession] = useState<any>(null)
  // Schedule state
  const [schedPlatform, setSchedPlatform] = useState('googlemeet')
  const [schedJoinMethod, setSchedJoinMethod] = useState<'url' | 'id'>('url')
  const [scheduling, setScheduling] = useState(false)
  const [scheduledBots, setScheduledBots] = useState<any[]>([])
  const [sched, setSched] = useState({ room_url: '', zoom_id: '', zoom_pwd: '', date: '', time: '', timezone: '', bot_name: 'Atlantir', response_mode: 'addressed', instructions: '' })

  const PLATFORMS = [
    { id: 'googlemeet', name: 'Google Meet', bg: '#1a73e8', placeholder: 'https://meet.google.com/abc-defg-hij' },
    { id: 'zoom',       name: 'Zoom',        bg: '#2D8CFF', placeholder: 'https://zoom.us/j/123456789' },
    { id: 'teams',      name: 'MS Teams',    bg: '#5b5ea6', placeholder: 'https://teams.microsoft.com/l/meetup-join/…' },
  ]
  const TIMEZONES = [
    { value: 'UTC', label: 'UTC' }, { value: 'America/New_York', label: 'Eastern (ET)' },
    { value: 'America/Chicago', label: 'Central (CT)' }, { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' }, { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Asia/Kolkata', label: 'India (IST)' }, { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' }, { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
  ]
  const selectedPlatformMeta = PLATFORMS.find(p => p.id === selectedPlatform)

  const canBotJoin = (() => {
    if (!botName.trim()) return false
    if (selectedPlatform === 'zoom' && botJoinMethod === 'id') return botZoomId.replace(/\D/g, '').length >= 9
    return botMeetingUrl.trim().length > 0
  })()

  const canSchedule = (() => {
    const hasUrl = schedPlatform !== 'zoom' || schedJoinMethod === 'url'
      ? sched.room_url.trim().length > 0
      : sched.zoom_id.replace(/\D/g, '').length >= 9
    return hasUrl && sched.date && sched.time && sched.bot_name.trim()
  })()

  function buildBotRoomUrl() {
    if (selectedPlatform === 'zoom' && botJoinMethod === 'id') {
      const id = botZoomId.replace(/\s+/g, '').replace(/-/g, '')
      return `https://zoom.us/j/${id}${botZoomPwd ? `?pwd=${encodeURIComponent(botZoomPwd)}` : ''}`
    }
    return botMeetingUrl.trim()
  }

  function buildSchedUrl() {
    if (schedPlatform === 'zoom' && schedJoinMethod === 'id') {
      const id = sched.zoom_id.replace(/\s+/g, '').replace(/-/g, '')
      return `https://zoom.us/j/${id}${sched.zoom_pwd ? `?pwd=${encodeURIComponent(sched.zoom_pwd)}` : ''}`
    }
    return sched.room_url.trim()
  }

  function getTzOffset(tz: string, date: Date) {
    try {
      const utc = date.toLocaleString('en-US', { timeZone: 'UTC' })
      const tzs = date.toLocaleString('en-US', { timeZone: tz })
      return new Date(tzs).getTime() - new Date(utc).getTime()
    } catch { return 0 }
  }

  function startBotPolling(sessionId: string) {
    if (botPollRef.current) clearInterval(botPollRef.current)
    botPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/bot/status?id=${sessionId}`)
        const status = await res.json()
        setBotSession((prev: any) => prev ? { ...prev, status: status.status, transcript: status.transcript || [], speaking: status.speaking } : null)
        if (status.status === 'stopped' || status.status === 'error') {
          clearInterval(botPollRef.current!)
        }
      } catch {}
    }, 2000)
  }

  async function joinWithBot() {
    setBotNameTouched(true)
    const roomUrl = buildBotRoomUrl()
    if (!roomUrl || !botName.trim()) return
    setBotJoining(true)
    try {
      const res = await fetch('/api/bot/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room_url: roomUrl, workspace_id: workspaceId, meeting_id: meetingId, bot_name: botName.trim(), response_mode: botResponseMode, instructions: botInstructions.trim() || undefined }) })
      const result = await res.json()
      setBotSession({ session_id: result.session_id, platform: selectedPlatformMeta?.name, botName: botName.trim(), status: 'starting', transcript: [], speaking: false })
      startBotPolling(result.session_id)
    } catch (e: any) {
      alert(e?.message || 'Failed to join. Make sure the bot server is running.')
    } finally {
      setBotJoining(false)
    }
  }

  async function leaveBotCall() {
    if (botPollRef.current) clearInterval(botPollRef.current)
    const sessionId = botSession?.session_id
    if (sessionId) {
      await fetch('/api/bot/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionId }) }).catch(() => {})
    }
    setBotSession(null)
  }

  async function loadScheduledBots() {
    try {
      const res = await fetch(`/api/bot/schedules?workspace_id=${workspaceId}`)
      const data = await res.json()
      setScheduledBots((data || []).filter((s: any) => s.status === 'pending' || s.status === 'running'))
    } catch {}
  }

  async function scheduleBot() {
    if (!canSchedule) return
    setScheduling(true)
    try {
      const localIso = `${sched.date}T${sched.time}:00`
      const target = new Date(localIso)
      const utcMs = target.getTime() - getTzOffset(sched.timezone, target)
      const scheduledAt = new Date(utcMs).toISOString()
      await fetch('/api/bot/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspaceId, room_url: buildSchedUrl(), bot_name: sched.bot_name || 'Atlantir', response_mode: sched.response_mode, instructions: sched.instructions.trim() || null, scheduled_at: scheduledAt, timezone: sched.timezone, platform: schedPlatform }) })
      setSched(s => ({ ...s, room_url: '', zoom_id: '', zoom_pwd: '', time: '', instructions: '' }))
      await loadScheduledBots()
      setBotTab('now')
    } catch (e: any) {
      alert(e?.message || 'Failed to schedule bot')
    } finally {
      setScheduling(false)
    }
  }

  async function deleteScheduled(id: string) {
    if (!confirm('Cancel this scheduled bot?')) return
    await fetch('/api/bot/schedule-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {})
    setScheduledBots(prev => prev.filter(s => s.id !== id))
  }

  function formatScheduledTime(s: any) {
    try { return new Intl.DateTimeFormat('en', { timeZone: s.timezone || 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(s.scheduled_at)) }
    catch { return s.scheduled_at }
  }
  function truncateUrl(url: string) {
    try { return new URL(url).hostname + new URL(url).pathname.slice(0, 20) } catch { return url }
  }

  useEffect(() => {
    createMeeting()
    const todayStr = new Date().toISOString().slice(0, 10)
    setSched(s => ({ ...s, date: todayStr, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }))
    return () => {
      if (analyzeTimerRef.current) clearInterval(analyzeTimerRef.current)
      if (durationTimerRef.current) clearInterval(durationTimerRef.current)
      if (botPollRef.current) clearInterval(botPollRef.current)
    }
  }, [])

  useEffect(() => {
    if (transcriptEl.current) transcriptEl.current.scrollTop = transcriptEl.current.scrollHeight
  }, [transcript, interimText])

  useEffect(() => {
    if (chatEl.current) chatEl.current.scrollTop = chatEl.current.scrollHeight
  }, [messages])

  async function createMeeting() {
    try {
      const res = await fetch('/api/meetings/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspaceId, title: meetingTitle }) })
      const data = await res.json()
      setMeetingId(data.id)
    } catch {}
  }

  async function openShareModal() {
    await start()
    startTimeRef.current = new Date()
    startDurationTimer()
    analyzeTimerRef.current = setInterval(analyzeChunk, 15000)
  }

  function startDurationTimer() {
    durationTimerRef.current = setInterval(() => {
      if (!startTimeRef.current) return
      const secs = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000)
      const m = Math.floor(secs / 60), s = secs % 60
      setDuration(`${m}:${s.toString().padStart(2, '0')}`)
    }, 1000)
  }

  async function analyzeChunk() {
    if (!meetingId || !transcript) return
    const newText = transcript.slice(lastAnalyzedLengthRef.current)
    if (!newText.trim() || newText.length < 50) return
    lastAnalyzedLengthRef.current = transcript.length
    setAgentThinking(true); setThinkingAgent('Analysis')
    try {
      const res = await fetch('/api/meetings/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meetingId, chunk: newText, workspace_id: workspaceId })
      })
      const data = await res.json()
      if (data.messages?.length) setMessages(prev => [...prev, ...data.messages])
      if (data.tasks?.length) setMeetingTasks(prev => [...prev, ...data.tasks])
    } catch {}
    finally { setAgentThinking(false) }
  }

  function pauseRecording() { pause() }
  function resumeRecording() { resume() }

  async function endMeeting() {
    if (analyzeTimerRef.current) clearInterval(analyzeTimerRef.current)
    if (durationTimerRef.current) clearInterval(durationTimerRef.current)
    const finalTranscript = stop()
    setEnded(true)
    if (!meetingId) return
    try {
      await fetch('/api/meetings/end', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: meetingId, transcript: transcript || finalTranscript, workspace_id: workspaceId })
      })
    } catch {}
  }

  async function deleteMeeting() {
    if (!meetingId) return
    await fetch('/api/meetings/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meeting_id: meetingId }) })
    router.push(`/workspace/${workspaceId}`)
  }

  async function saveTitle() {
    setEditingTitle(false)
    if (!meetingId) return
    try {
      await fetch('/api/meetings/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meeting_id: meetingId, title: meetingTitle }) })
    } catch {}
  }

  function startEditTitle() {
    setEditingTitle(true)
    setTimeout(() => titleInputRef.current?.focus(), 50)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !meetingId) return
    setUploadStatus(`Uploading ${file.name}…`); setUploadError(false)
    const form = new FormData()
    form.append('file', file); form.append('meeting_id', meetingId); form.append('workspace_id', workspaceId)
    try {
      const res = await fetch('/api/meetings/transcribe', { method: 'POST', body: form })
      const data = await res.json()
      if (data.transcript) setTranscript(data.transcript)
      setUploadStatus('Transcription complete!')
    } catch { setUploadStatus('Upload failed'); setUploadError(true) }
    e.target.value = ''
  }

  return (
    <div className="meeting-room">
      {/* Header */}
      <div className="meeting-header">
        <div className="header-left">
          <a href={`/workspace/${workspaceId}`} className="back-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </a>
          <div className="title-wrap">
            {editingTitle ? (
              <input ref={titleInputRef} className="title-edit-input" value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)}
                onBlur={saveTitle} onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }} />
            ) : (
              <button className="title-btn" onClick={startEditTitle}>{meetingTitle}</button>
            )}
          </div>
          {isRecording && <span className="live-badge">● LIVE {duration}</span>}
          {isPaused && <span className="paused-badge">⏸ Paused</span>}
        </div>
        <div className="header-right">
          {!isRecording && !isPaused && !ended && (
            <button className="btn-record" onClick={openShareModal}><span className="rec-dot" /> Start recording</button>
          )}
          {isPaused && !ended && (
            <>
              <button className="btn-secondary" onClick={resumeRecording}>▶ Resume</button>
              <button className="btn-danger" onClick={endMeeting}>End meeting</button>
            </>
          )}
          {isRecording && (
            <>
              <button className="btn-secondary" onClick={pauseRecording}>⏸ Pause</button>
              <button className="btn-danger" onClick={endMeeting}>End meeting</button>
            </>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        {[{ id: 'live', label: 'Live transcript' }, { id: 'bot', label: 'Bot join' }, { id: 'history', label: 'Past meetings' }].map(t => (
          <button key={t.id} className={`tab-btn${activeTab === t.id ? ' active' : ''}`} onClick={() => { setActiveTab(t.id); if (t.id === 'bot') loadScheduledBots() }}>{t.label}</button>
        ))}
      </div>

      {/* Live tab */}
      {activeTab === 'live' && (
        <div className="meeting-body">
          <div className="live-grid">
            <div className="panel transcript-panel">
              <div className="panel-label">
                Transcript
                <div className="panel-actions">
                  <label className="upload-link">
                    <input type="file" accept="audio/*,video/*" onChange={handleFileUpload} style={{ display: 'none' }} />
                    Upload recording
                  </label>
                </div>
              </div>
              {uploadStatus && <div className={`upload-bar${uploadError ? ' error' : ''}`}>{uploadStatus}</div>}
              <div ref={transcriptEl} className="panel-scroll">
                {!transcript && !interimText ? (
                  <div className="empty-hint">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /></svg>
                    <span>{isRecording ? 'Listening…' : 'Press Start recording to begin.'}</span>
                  </div>
                ) : (
                  <p className="transcript-text">{transcript}<span className="interim">{interimText ? ` ${interimText}` : ''}</span></p>
                )}
              </div>
              {deepgramError && <p className="error-banner">{deepgramError}</p>}
            </div>

            <div className="panel response-panel">
              <div className="panel-label">Agent responses</div>
              <div ref={chatEl} className="panel-scroll chat-scroll">
                {!messages.length ? (
                  <div className="empty-hint">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                    <span>Agents respond automatically as the meeting progresses.</span>
                  </div>
                ) : messages.map(msg => (
                  <div key={msg.id} className={`msg ${msg.sender_type}`}>
                    <div className="msg-meta">
                      <span className={`msg-sender ${msg.agent_type || 'human'}`}>{senderName(msg)}</span>
                      <span className="msg-time">{formatTime(msg.created_at)}</span>
                    </div>
                    <div className="msg-body">{msg.content}</div>
                  </div>
                ))}
                {agentThinking && (
                  <div className="msg agent">
                    <div className="msg-meta"><span className="msg-sender">{thinkingAgent} is thinking…</span></div>
                  </div>
                )}
              </div>
              {meetingTasks.length > 0 && (
                <div className="tasks-section">
                  <div className="tasks-label">{meetingTasks.length} task{meetingTasks.length !== 1 ? 's' : ''} created</div>
                  <div className="tasks-grid">
                    {meetingTasks.map(task => (
                      <div key={task.id} className="task-chip">
                        <span className="task-chip-title">{task.title}</span>
                        <span className={`task-chip-status ${task.status}`}>{statusLabel(task.status)}</span>
                      </div>
                    ))}
                  </div>
                  <a href={`/workspace/${workspaceId}`} className="go-to-workspace-link">View in workspace →</a>
                </div>
              )}
            </div>
          </div>

          {ended && (
            <div className="ended-overlay">
              <div className="ended-card">
                <div className="ended-icon">✓</div>
                <h3>Meeting ended</h3>
                <p>{meetingTasks.length} task{meetingTasks.length !== 1 ? 's' : ''} created from this meeting</p>
                <a href={`/workspace/${workspaceId}`} className="btn btn-primary">Go to workspace →</a>
                <button className="btn btn-ghost" onClick={deleteMeeting}>Delete meeting</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bot join tab */}
      {activeTab === 'bot' && (
        <div className="bot-tab">
          <div className="bot-card">
          {/* Tab switcher */}
          <div className="bot-tabs-row">
            {(['now', 'schedule'] as const).map(t => (
              <button key={t} className={`bot-mode-tab${botTab === t ? ' active' : ''}`} onClick={() => setBotTab(t)}>
                {t === 'now' ? <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.894L15 14"/><rect x="3" y="8" width="12" height="8" rx="2"/></svg>
                  Join now
                </> : <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  Schedule
                </>}
              </button>
            ))}
          </div>

          {botTab === 'now' && (
            <>
              {/* Platform picker */}
              <div className="bot-section-label">Platform</div>
              <div className="platform-grid">
                {PLATFORMS.map(p => (
                  <button key={p.id} className={`platform-btn${selectedPlatform === p.id ? ' selected' : ''}`} onClick={() => setSelectedPlatform(p.id)}>
                    <div className="plat-logo" style={{ background: p.bg }} />
                    <span>{p.name}</span>
                    {selectedPlatform === p.id && <svg className="plat-check" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                ))}
              </div>
              <div className="bot-form">
                {selectedPlatform === 'zoom' && (
                  <div className="join-method-toggle">
                    {(['url', 'id'] as const).map(m => (
                      <button key={m} className={botJoinMethod === m ? 'active' : ''} onClick={() => setBotJoinMethod(m)}>{m === 'url' ? 'Paste URL' : 'Meeting ID'}</button>
                    ))}
                  </div>
                )}
                {(selectedPlatform !== 'zoom' || botJoinMethod === 'url') && (
                  <div className="bot-form-field">
                    <label>Meeting link</label>
                    <input value={botMeetingUrl} onChange={e => setBotMeetingUrl(e.target.value)} className="bot-input" placeholder={selectedPlatformMeta?.placeholder || 'Paste meeting URL…'} type="url" />
                  </div>
                )}
                {selectedPlatform === 'zoom' && botJoinMethod === 'id' && <>
                  <div className="bot-form-field">
                    <label>Meeting ID</label>
                    <input value={botZoomId} onChange={e => setBotZoomId(e.target.value)} className="bot-input" placeholder="812 3456 7890" />
                  </div>
                  <div className="bot-form-field">
                    <label>Passcode</label>
                    <input value={botZoomPwd} onChange={e => setBotZoomPwd(e.target.value)} className="bot-input" placeholder="abc123" type="password" />
                  </div>
                </>}
                <div className="bot-form-field">
                  <label>Bot name <span className="field-required">*</span></label>
                  <input value={botName} onChange={e => setBotName(e.target.value)} onBlur={() => setBotNameTouched(true)} className={`bot-input${botNameTouched && !botName.trim() ? ' input-error' : ''}`} placeholder="e.g. Atlantir" />
                  {botNameTouched && !botName.trim() && <span className="field-error-msg">Bot name is required</span>}
                </div>
                <div className="bot-form-field">
                  <label>Response mode</label>
                  <select value={botResponseMode} onChange={e => setBotResponseMode(e.target.value)} className="bot-input">
                    <option value="addressed">Only respond when addressed by name</option>
                    <option value="questions">Respond to all questions</option>
                    <option value="always">Respond to everything relevant</option>
                  </select>
                </div>
                <div className="bot-form-field">
                  <label>Instructions / notes</label>
                  <textarea value={botInstructions} onChange={e => setBotInstructions(e.target.value)} className="bot-input instructions-textarea" placeholder="Tell the bot its purpose, e.g. You are joining a sales call…" rows={3} />
                </div>
                <button className="bot-join-btn" disabled={!canBotJoin || botJoining} onClick={joinWithBot}>
                  {botJoining ? <span className="spinner" /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.894L15 14"/><rect x="3" y="8" width="12" height="8" rx="2"/></svg>}
                  {botJoining ? 'Joining…' : `Send bot to ${selectedPlatformMeta?.name || 'meeting'}`}
                </button>
              </div>

              {botSession && (
                <div className="bot-session">
                  <div className="bot-session-bar">
                    <div className={`bot-live-dot ${botSession.status}`} />
                    <span className="bot-session-name">{botSession.platform} · {botSession.botName}</span>
                    <span className="bot-session-status">{botSession.status}</span>
                    <button className="btn-ghost-sm" onClick={leaveBotCall}>Leave call</button>
                  </div>
                  {botSession.transcript?.length ? (
                    <div className="bot-transcript">
                      {botSession.transcript.map((entry: any, i: number) => (
                        <div key={i} className={`bot-entry ${entry.role}`}>
                          <div className="bot-entry-meta">
                            <span className="bot-entry-role">{entry.role === 'bot' ? 'Bot' : 'Meeting'}</span>
                            <span className="bot-entry-time">{formatTime(new Date(entry.ts).toISOString())}</span>
                          </div>
                          <span className="bot-entry-text">{entry.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-hint" style={{ padding: '20px 16px' }}>
                      <span>Bot is in the meeting. Conversation will appear here as people speak.</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {botTab === 'schedule' && (
            <div className="bot-form">
              <div className="platform-grid">
                {PLATFORMS.map(p => (
                  <button key={p.id} className={`platform-btn${schedPlatform === p.id ? ' selected' : ''}`} onClick={() => setSchedPlatform(p.id)}>
                    <div className="plat-logo" style={{ background: p.bg }} />
                    <span>{p.name}</span>
                    {schedPlatform === p.id && <svg className="plat-check" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                ))}
              </div>
              {schedPlatform === 'zoom' && (
                <div className="join-method-toggle">
                  {(['url', 'id'] as const).map(m => (
                    <button key={m} className={schedJoinMethod === m ? 'active' : ''} onClick={() => setSchedJoinMethod(m)}>{m === 'url' ? 'Paste URL' : 'Meeting ID'}</button>
                  ))}
                </div>
              )}
              {(schedPlatform !== 'zoom' || schedJoinMethod === 'url') && (
                <div className="bot-form-field">
                  <label>Meeting link</label>
                  <input value={sched.room_url} onChange={e => setSched(s => ({ ...s, room_url: e.target.value }))} className="bot-input" placeholder="https://zoom.us/j/… or meet.google.com/…" type="url" />
                </div>
              )}
              {schedPlatform === 'zoom' && schedJoinMethod === 'id' && <>
                <div className="bot-form-field">
                  <label>Meeting ID</label>
                  <input value={sched.zoom_id} onChange={e => setSched(s => ({ ...s, zoom_id: e.target.value }))} className="bot-input" placeholder="812 3456 7890" />
                </div>
                <div className="bot-form-field">
                  <label>Passcode</label>
                  <input value={sched.zoom_pwd} onChange={e => setSched(s => ({ ...s, zoom_pwd: e.target.value }))} className="bot-input" placeholder="abc123" type="password" />
                </div>
              </>}
              <div className="sched-time-row">
                <div className="bot-form-field">
                  <label>Date</label>
                  <input value={sched.date} onChange={e => setSched(s => ({ ...s, date: e.target.value }))} type="date" min={new Date().toISOString().slice(0,10)} className="bot-input" />
                </div>
                <div className="bot-form-field">
                  <label>Time</label>
                  <input value={sched.time} onChange={e => setSched(s => ({ ...s, time: e.target.value }))} type="time" className="bot-input" />
                </div>
                <div className="bot-form-field">
                  <label>Timezone</label>
                  <select value={sched.timezone} onChange={e => setSched(s => ({ ...s, timezone: e.target.value }))} className="bot-input">
                    {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="bot-form-field">
                <label>Bot name <span className="field-required">*</span></label>
                <input value={sched.bot_name} onChange={e => setSched(s => ({ ...s, bot_name: e.target.value }))} className="bot-input" placeholder="e.g. Atlantir" />
              </div>
              <div className="bot-form-field">
                <label>Response mode</label>
                <select value={sched.response_mode} onChange={e => setSched(s => ({ ...s, response_mode: e.target.value }))} className="bot-input">
                  <option value="addressed">Only respond when addressed by name</option>
                  <option value="questions">Respond to all questions</option>
                  <option value="always">Respond to everything relevant</option>
                </select>
              </div>
              <div className="bot-form-field">
                <label>Instructions / notes</label>
                <textarea value={sched.instructions} onChange={e => setSched(s => ({ ...s, instructions: e.target.value }))} className="bot-input instructions-textarea" placeholder="Tell the bot its purpose for this scheduled call…" rows={3} />
              </div>
              <div className="join-notice">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Bot joins automatically at the scheduled time. Your browser doesn't need to be open.
              </div>
              <button className="bot-join-btn" disabled={!canSchedule || scheduling} onClick={scheduleBot}>
                {scheduling ? <span className="spinner" /> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
                {scheduling ? 'Scheduling…' : 'Schedule bot'}
              </button>

              {scheduledBots.length > 0 && (
                <div className="sched-list">
                  <div className="sched-list-label">Upcoming scheduled bots</div>
                  {scheduledBots.map(s => (
                    <div key={s.id} className="sched-row">
                      <div className="sched-row-main">
                        <span className="sched-row-time">{formatScheduledTime(s)}</span>
                        <span className="sched-row-url">{truncateUrl(s.room_url)}</span>
                        <span className={`sched-status-badge ${s.status}`}>{s.status}</span>
                      </div>
                      {s.status === 'pending' && <button className="sched-cancel-btn" onClick={() => deleteScheduled(s.id)}>Cancel</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <HistoryTab workspaceId={workspaceId} />
      )}

      <style>{`
        /* ── Base layout ─────────────────────────── */
        .meeting-room { display:flex; flex-direction:column; height:100%; overflow:hidden; background:var(--bg); }
        .meeting-header { display:flex; align-items:center; justify-content:space-between; padding:10px 20px; border-bottom:1px solid var(--border,#e8e4dc); background:var(--surface,#fff); flex-shrink:0; color:#1a1714; }
        .header-left { display:flex; align-items:center; gap:12px; }
        .back-link { display:flex; align-items:center; gap:5px; font-size:13px; color:var(--text-2); text-decoration:none; }
        .back-link:hover { color:var(--text-1); }
        .title-wrap { max-width:280px; }
        .title-btn { background:none; border:none; font-size:14px; font-weight:500; color:var(--text-1); cursor:pointer; padding:2px 6px; border-radius:4px; }
        .title-btn:hover { background:var(--surface-2); }
        .title-edit-input { font-size:14px; font-weight:500; border:1.5px solid var(--accent); border-radius:6px; padding:3px 8px; outline:none; font-family:inherit; background:var(--surface); color:var(--text-1); }
        .live-badge { font-size:11px; font-weight:600; color:#dc2626; background:#fef2f2; padding:3px 9px; border-radius:10px; animation:pulse 2s infinite; }
        .paused-badge { font-size:11px; font-weight:600; color:#d97706; background:#fffbeb; padding:3px 9px; border-radius:10px; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.6} }
        .header-right { display:flex; align-items:center; gap:8px; }
        .btn-record { display:flex; align-items:center; gap:7px; padding:8px 16px; background:var(--accent); color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; }
        .rec-dot { width:8px; height:8px; background:#fff; border-radius:50%; animation:pulse 2s infinite; }
        .btn-secondary { padding:7px 14px; background:var(--surface-2); border:1px solid var(--border); border-radius:8px; font-size:13px; cursor:pointer; color:var(--text-1); }
        .btn-danger { padding:7px 14px; background:#ef4444; color:#fff; border:none; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; }
        /* ── Tabs ───────────────────────────────── */
        .tab-bar { display:flex; gap:0; padding:0 20px; background:var(--surface,#fff); flex-shrink:0; color:#1a1714; border-bottom:1px solid var(--border,#e8e4dc); }
        .tab-btn { display:flex; align-items:center; gap:6px; padding:10px 16px; font-size:13px; color:var(--text-2,#a09890); background:transparent; border:none; border-bottom:2px solid transparent; cursor:pointer; margin-bottom:-1px; transition:color .13s, border-color .13s; font-family:inherit; }
        .tab-btn:hover { color:var(--text-1,#1a1714); background:transparent; }
        .tab-btn.active { color:var(--text-1,#1a1714); border-bottom-color:var(--accent,#6366f1); font-weight:500; background:transparent; }
        .meeting-body { flex:1; overflow:hidden; position:relative; background:var(--surface,#fff); }
        /* ── Live panels ────────────────────────── */
        .live-grid { display:grid; grid-template-columns:1fr 1fr; height:100%; }
        .panel { display:flex; flex-direction:column; overflow:hidden; border-right:1px solid var(--border,#e8e4dc); background:var(--surface,#fff); }
        .panel:last-child { border-right:none; }
        .panel-label { display:flex; align-items:center; justify-content:space-between; padding:10px 16px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-1,#1a1714); border-bottom:1px solid var(--border,#e8e4dc); flex-shrink:0; background:var(--surface,#fff); gap:8px; }
        .panel-actions { display:flex; gap:8px; }
        .upload-link { font-size:11px; cursor:pointer; font-weight:500; text-transform:none !important; letter-spacing:0 !important; display:inline-flex; align-items:center; padding:2px 7px; border-radius:4px; border:1px solid var(--accent-border,rgba(99, 241, 184, 0.5)); } .upload-link:hover { background:var(--accent-soft); }
        .upload-bar { padding:8px 16px; font-size:12px; background:var(--green-soft); color:var(--green-text); border-bottom:1px solid var(--border); flex-shrink:0; }
        .upload-bar.error { background:var(--red-soft); color:var(--red-text); }
        .panel-scroll { flex:1; overflow-y:auto; padding:16px; background:var(--surface); color:var(--text-1,#1a1714); }
        .empty-hint { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:12px; color:var(--text-3); font-size:13px; text-align:center; }
        .transcript-text { font-size:14px; line-height:1.8; color:var(--text-1); margin:0; white-space:pre-wrap; }
        .interim { color:var(--text-3); }
        .error-banner { padding:8px 16px; font-size:12px; color:var(--red-text); background:var(--red-soft); margin:8px; border-radius:6px; flex-shrink:0; }
        .chat-scroll { display:flex; flex-direction:column; gap:14px; }
        .msg { display:flex; flex-direction:column; gap:4px; }
        .msg-meta { display:flex; align-items:center; gap:8px; }
        .msg-sender { font-size:11px; font-weight:600; }
        .msg-sender.research { color:#7c3aed; } .msg-sender.analyst { color:#0891b2; }
        .msg-sender.writer   { color:#059669; } .msg-sender.executor { color:#d97706; }
        .msg-sender.human    { color:var(--text-2); }
        .msg-time { font-size:10px; color:var(--text-3); }
        .msg-body { font-size:13px; line-height:1.6; color:var(--text-1); background:var(--surface); border-radius:8px; padding:10px 12px; border:1px solid var(--border); }
        .tasks-section { border-top:1px solid var(--border); padding:12px 16px; background:var(--surface); flex-shrink:0; }
        .tasks-label { font-size:11px; font-weight:600; color:var(--text-2); margin-bottom:8px; }
        .tasks-grid { display:flex; flex-direction:column; gap:4px; margin-bottom:8px; }
        .task-chip { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:6px 10px; background:var(--surface-2); border:1px solid var(--border); border-radius:6px; }
        .task-chip-title { font-size:12px; color:var(--text-1); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }
        .task-chip-status { font-size:10px; font-weight:600; color:var(--text-3); flex-shrink:0; }
        .task-chip-status.completed { color:var(--green); }
        .go-to-workspace-link { font-size:12px; color:var(--accent); text-decoration:none; }
        .ended-overlay { position:absolute; inset:0; background:rgba(26,23,20,.5); display:flex; align-items:center; justify-content:center; z-index:10; }
        .ended-card { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:40px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:14px; box-shadow:0 8px 32px rgba(0,0,0,.1); }
        .ended-icon { width:56px; height:56px; background:var(--green-soft); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:22px; color:var(--green); }
        .ended-card h3 { font-size:20px; font-weight:600; color:var(--text-1); margin:0; }
        .ended-card p { font-size:14px; color:var(--text-2); margin:0; }
        /* ── Bot join tab ────────────────────────── */
        .bot-tab { flex:1; overflow-y:auto; padding:32px 20px; display:flex; flex-direction:column; align-items:center; background:var(--bg,#f9f7f4); }
        .bot-card { width:100%; max-width:560px; background:var(--surface); border:1px solid var(--border); border-radius:16px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.05); }
        .bot-tabs-row { display:flex; border-bottom:1px solid var(--border); }
        .bot-mode-tab { flex:1; display:flex; align-items:center; justify-content:center; gap:7px; padding:12px 16px; border:none; background:none; color:var(--text-2); font-size:13px; cursor:pointer; transition:all .15s; border-bottom:2px solid transparent; margin-bottom:-1px; font-family:inherit; }
        .bot-mode-tab.active { color:var(--accent); border-bottom-color:var(--accent); font-weight:500; background:var(--accent-soft); }
        .bot-mode-tab:hover:not(.active) { background:var(--surface-2); color:var(--text-1); }
        .bot-section-label { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-3); padding:16px 20px 8px; }
        .platform-grid { display:flex; gap:8px; padding:0 20px 16px; }
        .platform-btn { flex:1; display:flex; align-items:center; justify-content:center; gap:8px; padding:10px 12px; border:1.5px solid var(--border); border-radius:10px; background:var(--surface-2); color:var(--text-1); font-size:13px; font-weight:500; cursor:pointer; transition:all .15s; }
        .platform-btn.selected { border-color:var(--accent-border); background:var(--accent-soft); color:var(--accent); }
        .plat-logo { width:14px; height:14px; border-radius:3px; flex-shrink:0; }
        .plat-check { color:var(--accent); }
        .bot-form { display:flex; flex-direction:column; gap:0; padding:0 20px 20px; }
        .bot-form-field { display:flex; flex-direction:column; gap:5px; margin-bottom:12px; }
        .bot-form-field label { font-size:12px; font-weight:500; color:var(--text-2); }
        .field-required { color:#ef4444; }
        .bot-input { padding:9px 12px; border:1.5px solid var(--border); border-radius:9px; font-size:13px; font-family:inherit; background:var(--surface-2); color:var(--text-1); outline:none; width:100%; box-sizing:border-box; transition:border-color .15s; }
        .bot-input:focus { border-color:var(--accent); background:var(--surface); }
        .bot-input.input-error { border-color:#ef4444; }
        .field-error-msg { font-size:11px; color:#ef4444; }
        .instructions-textarea { resize:vertical; min-height:70px; }
        .join-method-toggle { display:flex; border:1.5px solid var(--border); border-radius:9px; overflow:hidden; margin-bottom:12px; }
        .join-method-toggle button { flex:1; padding:7px; font-size:12px; border:none; background:var(--surface-2); cursor:pointer; color:var(--text-2); transition:all .15s; font-family:inherit; }
        .join-method-toggle button.active { background:var(--accent-soft); color:var(--accent); font-weight:500; }
        .bot-join-btn { display:flex; align-items:center; justify-content:center; gap:7px; padding:11px 18px; background:var(--accent); color:#fff; border:none; border-radius:10px; font-size:13px; font-weight:500; cursor:pointer; transition:background .15s; width:100%; margin-top:4px; }
        .bot-join-btn:disabled { opacity:0.45; cursor:not-allowed; }
        .bot-join-btn:hover:not(:disabled) { background:var(--accent-hover); }
        .spinner { width:14px; height:14px; border-radius:50%; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; animation:spin .7s linear infinite; display:inline-block; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .bot-session { border-top:1px solid var(--border); margin:0 -0px; }
        .bot-session-bar { display:flex; align-items:center; gap:8px; padding:10px 20px; background:var(--surface-2); border-bottom:1px solid var(--border); }
        .bot-live-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; background:var(--border); }
        .bot-live-dot.starting { background:#f59e0b; animation:pulse 1.5s infinite; }
        .bot-live-dot.active { background:var(--green); animation:pulse 1.5s infinite; }
        .bot-live-dot.stopped,.bot-live-dot.error { background:#ef4444; }
        .bot-session-name { font-size:13px; font-weight:500; color:var(--text-1); flex:1; }
        .bot-session-status { font-size:11px; color:var(--text-3); text-transform:capitalize; }
        .btn-ghost-sm { padding:5px 12px; background:none; border:1px solid var(--border); border-radius:6px; font-size:12px; cursor:pointer; color:var(--text-2); }
        .btn-ghost-sm:hover { background:var(--surface-2); }
        .bot-transcript { padding:12px 20px; display:flex; flex-direction:column; gap:8px; max-height:220px; overflow-y:auto; }
        .bot-entry { display:flex; flex-direction:column; gap:2px; }
        .bot-entry-meta { display:flex; gap:8px; align-items:center; }
        .bot-entry-role { font-size:10px; font-weight:700; text-transform:uppercase; color:var(--text-3); }
        .bot-entry.bot .bot-entry-role { color:var(--accent); }
        .bot-entry-time { font-size:10px; color:var(--text-3); }
        .bot-entry-text { font-size:13px; color:var(--text-1); line-height:1.5; }
        .sched-time-row { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
        .join-notice { display:flex; align-items:flex-start; gap:7px; font-size:12px; color:var(--text-3); background:var(--surface-2); border:1px solid var(--border); border-radius:8px; padding:10px 12px; line-height:1.5; margin-bottom:12px; }
        .sched-list { border:1px solid var(--border); border-radius:10px; overflow:hidden; margin-top:16px; }
        .sched-list-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; color:var(--text-3); padding:8px 14px; background:var(--surface-2); border-bottom:1px solid var(--border); }
        .sched-row { display:flex; align-items:center; justify-content:space-between; padding:9px 14px; border-bottom:1px solid var(--border); }
        .sched-row:last-child { border-bottom:none; }
        .sched-row-main { display:flex; align-items:center; gap:10px; flex:1; min-width:0; }
        .sched-row-time { font-size:12px; font-weight:500; color:var(--text-1); white-space:nowrap; }
        .sched-row-url { font-size:11px; color:var(--text-3); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }
        .sched-status-badge { font-size:10px; font-weight:600; padding:2px 7px; border-radius:10px; flex-shrink:0; background:var(--surface-2); color:var(--text-3); }
        .sched-status-badge.pending { background:var(--amber-soft); color:var(--amber-text); }
        .sched-status-badge.running { background:var(--green-soft); color:var(--green-text); }
        .sched-cancel-btn { font-size:11px; color:#ef4444; background:none; border:1px solid #fca5a5; border-radius:5px; padding:3px 9px; cursor:pointer; flex-shrink:0; }
        /* ── History tab ─────────────────────────── */
        .history-tab { flex:1; overflow-y:auto; background:var(--bg,#f9f7f4); color:var(--text-1,#1a1714); }
        .history-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; height:200px; gap:10px; color:var(--text-3); font-size:13px; }
        .history-list { display:flex; flex-direction:column; }
        .history-list-header { display:grid; grid-template-columns:1fr 120px 80px 160px; padding:8px 16px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--text-3); border-bottom:1px solid var(--border); background:var(--surface); }
        .history-row-main { display:grid; grid-template-columns:1fr 120px 80px 160px; padding:10px 16px; cursor:pointer; border-bottom:1px solid var(--border); align-items:center; background:var(--surface); color:var(--text-1); }
        .history-row-main:hover { background:var(--surface-2); }
        .hcol-title { display:flex; align-items:center; gap:6px; min-width:0; overflow:hidden; }
        .history-row-open { background:none; border:none; font-size:13px; color:var(--text-1); cursor:pointer; text-align:left; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .history-edit-btn { display:none; align-items:center; gap:4px; background:none; border:1px solid var(--border); border-radius:5px; padding:2px 7px; font-size:11px; color:var(--text-3); cursor:pointer; flex-shrink:0; }
        .history-row-main:hover .history-edit-btn { display:flex; }
        .history-title-input { font-size:13px; border:1.5px solid var(--accent); border-radius:5px; padding:2px 7px; outline:none; font-family:inherit; background:var(--surface); color:var(--text-1); width:100%; }
        .hcol-date { font-size:12px; color:var(--text-2); }
        .hcol-tasks,.hcol-actions { display:flex; align-items:center; gap:4px; }
        .task-pill { font-size:10px; font-weight:600; padding:2px 8px; border-radius:10px; background:var(--accent-soft); color:var(--accent); border:1px solid var(--accent-border); }
        .task-pill-empty { font-size:12px; color:var(--text-3); }
        .hrow-btn { display:flex; align-items:center; gap:5px; padding:4px 9px; background:var(--surface-2); border:1px solid var(--border); border-radius:5px; font-size:11px; color:var(--text-2); cursor:pointer; transition:all .15s; white-space:nowrap; }
        .hrow-btn:hover { background:var(--surface-3); }
        .hrow-btn.delete:hover { background:var(--red-soft); color:var(--red-text); border-color:#fca5a5; }
      `}</style>
    </div>
  )
}

function HistoryTab({ workspaceId }: { workspaceId: string }) {
  const [pastMeetings, setPastMeetings] = useState<any[]>([])
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/meetings?workspace_id=${workspaceId}`).then(r => r.json()).then(data => setPastMeetings(data || [])).catch(() => {})
  }, [workspaceId])

  function formatDate(ts: string) {
    try { return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
    catch { return '' }
  }

  async function commitTitle(m: any) {
    const trimmed = editingTitle.trim()
    if (trimmed && trimmed !== m.title) {
      setPastMeetings(prev => prev.map(x => x.id === m.id ? { ...x, title: trimmed } : x))
      await fetch('/api/meetings/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meeting_id: m.id, title: trimmed }) }).catch(() => {})
    }
    setEditingId(null)
  }

  async function deleteMeeting(id: string) {
    setPastMeetings(prev => prev.filter(m => m.id !== id))
    await fetch('/api/meetings/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meeting_id: id }) }).catch(() => {})
  }

  if (!pastMeetings.length) return (
    <div className="history-tab">
      <div className="history-empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5-4v-4h4"/></svg>
        <span>No past meetings yet.</span>
      </div>
    </div>
  )

  return (
    <div className="history-tab">
      <div className="history-list">
        <div className="history-list-header">
          <span>Title</span><span>Date</span><span>Tasks</span><span />
        </div>
        {pastMeetings.map((m, idx) => (
          <div key={m.id}>
            <div className="history-row-main">
              <div className="hcol-title">
                {editingId === m.id ? (
                  <input ref={editInputRef} className="history-title-input" value={editingTitle}
                    onChange={e => setEditingTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitTitle(m); if (e.key === 'Escape') setEditingId(null) }}
                    onBlur={() => commitTitle(m)} maxLength={100} />
                ) : (
                  <>
                    <button className="history-row-open">{m.title || 'Untitled meeting'}</button>
                    <button className="history-edit-btn" onClick={e => { e.stopPropagation(); setEditingId(m.id); setEditingTitle(m.title || 'Untitled meeting'); setTimeout(() => editInputRef.current?.focus(), 0) }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                  </>
                )}
              </div>
              <span className="hcol-date">{formatDate(m.created_at)}</span>
              <div className="hcol-tasks">
                {m.task_count > 0 ? <span className="task-pill">{m.task_count} task{m.task_count !== 1 ? 's' : ''}</span> : <span className="task-pill-empty">—</span>}
              </div>
              <div className="hcol-actions" onClick={e => e.stopPropagation()}>
                {m.transcript && (
                  <button className={`hrow-btn${expandedMeeting === m.id ? ' active' : ''}`} onClick={() => setExpandedMeeting(expandedMeeting === m.id ? null : m.id)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    {expandedMeeting === m.id ? 'Hide' : 'Transcript'}
                  </button>
                )}
                <button className="hrow-icon-btn" onClick={() => deleteMeeting(m.id)} title="Delete">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </button>
              </div>
            </div>
            {expandedMeeting === m.id && m.transcript && (
              <div className="history-transcript">{m.transcript}</div>
            )}
            {idx < pastMeetings.length - 1 && <div className="history-divider" />}
          </div>
        ))}
      </div>
    </div>
  )
}