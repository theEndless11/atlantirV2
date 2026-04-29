'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

interface Session {
  id: string; status: string; platform: string; bot_name: string
  started_at: string; transcript?: { role: string; text: string; ts: number }[]
  logs?: { level: string; msg: string; ts: number }[]; speaking?: boolean; error?: string
}
interface Schedule {
  id: string; platform: string; bot_name: string; room_url: string
  scheduled_at: string; status: string
}

const COMMON_TIMEZONES = [
  { value: 'UTC', label: 'UTC' }, { value: 'America/New_York', label: 'New York (ET)' },
  { value: 'America/Chicago', label: 'Chicago (CT)' }, { value: 'America/Denver', label: 'Denver (MT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PT)' }, { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' }, { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' }, { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
]

function platformLabel(p: string) { return p === 'meet' ? 'Google Meet' : p === 'zoom' ? 'Zoom' : p }
function statusLabel(s: string) {
  return s === 'joining' ? 'Joining…' : s === 'listening' ? 'Listening' : s === 'speaking' ? 'Speaking' : s === 'error' ? 'Error' : s
}
function detectPlatform(url: string) {
  if (url.includes('meet.google.com')) return 'meet'
  if (url.includes('zoom.us')) return 'zoom'
  return null
}
function formatLogTs(ts: number) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }
function formatScheduleTime(ts: string) { return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }

export default function VoiceBotPage() {
  const params = useParams()
  const workspaceId = Array.isArray(params.id) ? params.id[0] : params.id as string

  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [joinTab, setJoinTab] = useState<'now' | 'schedule'>('now')
  const [leaving, setLeaving] = useState(false)
  const [joining, setJoining] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [joinError, setJoinError] = useState('')
  const [schedError, setSchedError] = useState('')
  const [form, setForm] = useState({
    room_url: '', bot_name: 'Atlantir', response_mode: 'addressed',
    instructions: '', zoom_meeting_id: '', zoom_password: ''
  })
  const [sched, setSched] = useState({
    room_url: '', bot_name: 'Atlantir', response_mode: 'addressed',
    instructions: '', date: '', time: '', timezone: 'America/New_York', zoom_id: '', zoom_pwd: ''
  })

  const feedEl = useRef<HTMLDivElement>(null)
  const logsEl = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const detectedPlatform = detectPlatform(form.room_url)
  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadSchedules()
    checkExistingSession()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  useEffect(() => {
    if (feedEl.current) feedEl.current.scrollTop = feedEl.current.scrollHeight
  }, [activeSession?.transcript])

  async function checkExistingSession() {
    try {
      const res = await fetch(`/api/bot/status?workspace_id=${workspaceId}`)
      const data = await res.json()
      if (data?.active) setActiveSession(data.session)
    } catch {}
  }

  async function loadSchedules() {
    try {
      const res = await fetch(`/api/bot/schedules?workspace_id=${workspaceId}`)
      setSchedules(await res.json() || [])
    } catch {}
  }

  async function joinCall() {
    if (!form.room_url.trim() || !form.bot_name.trim()) return
    setJoining(true); setJoinError('')
    try {
      const res = await fetch('/api/bot/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, workspace_id: workspaceId, platform: detectedPlatform || 'zoom' })
      })
      const data = await res.json()
      setActiveSession(data)
      startPolling(data.id)
    } catch (e: any) { setJoinError(e?.message || 'Failed to join') }
    finally { setJoining(false) }
  }

  async function leaveCall() {
    if (!activeSession) return
    setLeaving(true)
    try {
      await fetch('/api/bot/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: activeSession.id, workspace_id: workspaceId }) })
      setActiveSession(null)
      if (pollRef.current) clearInterval(pollRef.current)
    } catch {} finally { setLeaving(false) }
  }

  async function scheduleBot() {
    if (!sched.room_url.trim() || !sched.bot_name.trim() || !sched.date || !sched.time) return
    setScheduling(true); setSchedError('')
    try {
      await fetch('/api/bot/schedules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sched, workspace_id: workspaceId, platform: detectPlatform(sched.room_url) || 'zoom', scheduled_at: `${sched.date}T${sched.time}` })
      })
      await loadSchedules()
      setSched(s => ({ ...s, room_url: '', date: '', time: '' }))
    } catch (e: any) { setSchedError(e?.message || 'Failed to schedule') }
    finally { setScheduling(false) }
  }

  async function deleteSchedule(id: string) {
    await fetch('/api/bot/schedules', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, workspace_id: workspaceId }) })
    setSchedules(prev => prev.filter(s => s.id !== id))
  }

  function startPolling(sessionId: string) {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/bot/status?workspace_id=${workspaceId}&session_id=${sessionId}`)
        const data = await res.json()
        if (data?.session) setActiveSession(data.session)
        if (data?.session?.status === 'ended') { clearInterval(pollRef.current!); setActiveSession(null) }
      } catch {}
    }, 3000)
  }

  return (
    <div className="page-shell vb-shell">
      <div className="page-header">
        <div>
          <h1>Voice Bot</h1>
          <p className="page-desc">Send an AI bot into a Google Meet or Zoom call. The bot listens, understands questions, and responds in real time using your knowledge base.</p>
        </div>
      </div>

      {activeSession ? (
        <div className="session-panel">
          <div className="session-bar">
            <div className="session-bar-left">
              <div className={`live-dot ${activeSession.status}`} />
              <span className="session-platform">{platformLabel(activeSession.platform)}</span>
              <span className="session-status-text">{statusLabel(activeSession.status)}</span>
              <span className="session-since">since {new Date(activeSession.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              {activeSession.speaking && <div className="wave-inline"><span /><span /><span /><span /><span /></div>}
            </div>
            <button className="btn-leave" onClick={leaveCall} disabled={leaving}>
              {leaving ? 'Leaving…' : 'Leave call'}
            </button>
          </div>
          {activeSession.error && <div className="session-error">{activeSession.error}</div>}
          <div className="session-body">
            <div className="transcript-panel">
              <div className="panel-label">Live transcript <span className="entry-count">{activeSession.transcript?.length || 0} entries</span></div>
              <div className="transcript-feed" ref={feedEl}>
                {!activeSession.transcript?.length ? (
                  <div className="transcript-empty">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                    <span>Waiting for conversation…</span>
                  </div>
                ) : activeSession.transcript.map((entry, i) => (
                  <div key={i} className={`transcript-entry ${entry.role}`}>
                    <div className="entry-meta">
                      <span className="entry-role">{entry.role === 'bot' ? 'Bot' : 'Meeting'}</span>
                      <span className="entry-time">{formatLogTs(entry.ts)}</span>
                    </div>
                    <div className="entry-text">{entry.text}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className={`logs-panel${showLogs ? '' : ' collapsed'}`}>
              <div className="panel-label logs-toggle" onClick={() => setShowLogs(v => !v)}>
                Debug logs <span className="entry-count">{activeSession.logs?.length || 0}</span>
                <span style={{ transform: showLogs ? 'none' : 'rotate(-90deg)', transition: 'transform .2s', display: 'inline-block', marginLeft: 4 }}>▾</span>
              </div>
              {showLogs && (
                <div className="logs-feed" ref={logsEl}>
                  {!activeSession.logs?.length ? <div className="logs-empty">No logs yet</div>
                    : activeSession.logs.map((line, i) => (
                      <div key={i} className={`log-line ${line.level}`}>
                        <span className="log-ts">{formatLogTs(line.ts)}</span>
                        <span className="log-msg">{line.msg}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="join-panel">
          <div className="how-section">
            {[
              { n: '1', title: 'Paste a meeting link', desc: 'Google Meet or Zoom. The bot joins as a separate participant.' },
              { n: '2', title: 'Bot listens to the call', desc: 'It transcribes the conversation in real time via Deepgram.' },
              { n: '3', title: 'Ask it anything', desc: 'Say its name or ask a question — it responds out loud using your knowledge base.' },
            ].map(item => (
              <div key={item.n} className="how-item">
                <div className="how-num">{item.n}</div>
                <div><strong>{item.title}</strong><span>{item.desc}</span></div>
              </div>
            ))}
          </div>

          <div className="join-form">
            <div className="join-tabs">
              <button className={`join-tab${joinTab === 'now' ? ' active' : ''}`} onClick={() => setJoinTab('now')}>Join now</button>
              <button className={`join-tab${joinTab === 'schedule' ? ' active' : ''}`} onClick={() => setJoinTab('schedule')}>Schedule</button>
            </div>

            {joinTab === 'now' ? (
              <>
                <div className="field">
                  <label>Meeting link</label>
                  <input className="url-input" value={form.room_url} onChange={e => setForm(f => ({ ...f, room_url: e.target.value }))} placeholder="https://meet.google.com/… or https://zoom.us/j/…" />
                  {detectedPlatform && <span className="platform-detected">✓ {detectedPlatform === 'meet' ? 'Google Meet' : 'Zoom'} detected</span>}
                </div>
                {detectedPlatform === 'zoom' && (
                  <div className="field-row">
                    <div className="field"><label>Meeting ID (if not in URL)</label><input value={form.zoom_meeting_id} onChange={e => setForm(f => ({ ...f, zoom_meeting_id: e.target.value }))} placeholder="812 3456 7890" /></div>
                    <div className="field"><label>Passcode</label><input type="password" value={form.zoom_password} onChange={e => setForm(f => ({ ...f, zoom_password: e.target.value }))} placeholder="abc123" /></div>
                  </div>
                )}
                <div className="field-row">
                  <div className="field">
                    <label>Bot name</label>
                    <input value={form.bot_name} onChange={e => setForm(f => ({ ...f, bot_name: e.target.value }))} placeholder="Atlantir" />
                  </div>
                  <div className="field">
                    <label>Response mode</label>
                    <select value={form.response_mode} onChange={e => setForm(f => ({ ...f, response_mode: e.target.value }))}>
                      <option value="addressed">Respond when addressed</option>
                      <option value="questions">Respond to all questions</option>
                      <option value="always">Respond to everything</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Instructions</label>
                  <textarea className="instructions-textarea" value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} placeholder="Tell the bot its purpose for this call…" rows={3} />
                </div>
                {joinError && <div className="field-error">{joinError}</div>}
                <button className="btn btn-primary join-btn" disabled={!form.room_url.trim() || !form.bot_name.trim() || joining} onClick={joinCall}>
                  {joining ? <span className="spinner" /> : null}{joining ? 'Joining…' : 'Send bot to meeting'}
                </button>
              </>
            ) : (
              <>
                <div className="field">
                  <label>Meeting link</label>
                  <input value={sched.room_url} onChange={e => setSched(s => ({ ...s, room_url: e.target.value }))} placeholder="https://meet.google.com/… or https://zoom.us/j/…" />
                </div>
                <div className="sched-time-row">
                  <div className="field"><label>Date</label><input type="date" min={todayStr} value={sched.date} onChange={e => setSched(s => ({ ...s, date: e.target.value }))} /></div>
                  <div className="field"><label>Time</label><input type="time" value={sched.time} onChange={e => setSched(s => ({ ...s, time: e.target.value }))} /></div>
                  <div className="field">
                    <label>Timezone</label>
                    <select value={sched.timezone} onChange={e => setSched(s => ({ ...s, timezone: e.target.value }))}>
                      {COMMON_TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field-row">
                  <div className="field"><label>Bot name</label><input value={sched.bot_name} onChange={e => setSched(s => ({ ...s, bot_name: e.target.value }))} placeholder="Atlantir" /></div>
                  <div className="field">
                    <label>Response mode</label>
                    <select value={sched.response_mode} onChange={e => setSched(s => ({ ...s, response_mode: e.target.value }))}>
                      <option value="addressed">Respond when addressed</option>
                      <option value="questions">Respond to all questions</option>
                      <option value="always">Respond to everything</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Instructions</label>
                  <textarea className="instructions-textarea" value={sched.instructions} onChange={e => setSched(s => ({ ...s, instructions: e.target.value }))} placeholder="Tell the bot its purpose for this scheduled call…" rows={3} />
                </div>
                <div className="join-notice">ℹ Bot joins automatically at the scheduled time. Your browser doesn't need to be open.</div>
                {schedError && <div className="field-error">{schedError}</div>}
                <button className="btn btn-primary join-btn" disabled={!sched.room_url.trim() || !sched.bot_name.trim() || !sched.date || !sched.time || scheduling} onClick={scheduleBot}>
                  {scheduling ? <><span className="spinner" /> Scheduling…</> : 'Schedule bot'}
                </button>

                {schedules.length > 0 && (
                  <div className="sched-list">
                    <div className="sched-list-label">Scheduled ({schedules.length})</div>
                    {schedules.map(s => (
                      <div key={s.id} className="sched-item">
                        <div className="sched-meta">
                          <span className="sched-platform">{platformLabel(s.platform)}</span>
                          <span className="sched-name">{s.bot_name}</span>
                          <span className="sched-time">{formatScheduleTime(s.scheduled_at)}</span>
                        </div>
                        <span className={`sched-status ${s.status}`}>{s.status}</span>
                        <button className="btn-icon sched-del" onClick={() => deleteSchedule(s.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        .vb-shell { padding-bottom: 40px; }
        .page-desc { font-size: 13px; color: var(--text-2); line-height: 1.6; max-width: 560px; }
        .session-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
        .session-bar { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--surface-2); border-bottom: 1px solid var(--border); }
        .session-bar-left { display: flex; align-items: center; gap: 10px; }
        .live-dot { width: 8px; height: 8px; border-radius: 50%; background: #d1d5db; flex-shrink: 0; }
        .live-dot.joining { background: #f59e0b; animation: pulse 1.5s infinite; }
        .live-dot.listening { background: #10b981; animation: pulse 2s infinite; }
        .live-dot.speaking { background: #6366f1; animation: pulse .8s infinite; }
        .live-dot.error { background: #ef4444; }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:.4} }
        .session-platform { font-size: 13px; font-weight: 500; color: var(--text-1); }
        .session-status-text { font-size: 12px; color: var(--text-2); }
        .session-since { font-size: 11px; color: var(--text-3); }
        .wave-inline { display: flex; align-items: center; gap: 2px; }
        .wave-inline span { width: 3px; height: 12px; background: var(--accent); border-radius: 2px; animation: wave .6s ease-in-out infinite; }
        .wave-inline span:nth-child(2){animation-delay:.1s}
        .wave-inline span:nth-child(3){animation-delay:.2s}
        .wave-inline span:nth-child(4){animation-delay:.3s}
        .wave-inline span:nth-child(5){animation-delay:.4s}
        @keyframes wave{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)}}
        .btn-leave { padding: 7px 16px; background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; border-radius: 7px; font-size: 13px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .btn-leave:disabled { opacity: 0.5; cursor: not-allowed; }
        .session-error { padding: 8px 16px; font-size: 12px; color: #ef4444; background: #fef2f2; border-bottom: 1px solid #fecaca; }
        .session-body { display: grid; grid-template-rows: 1fr auto; max-height: 500px; overflow: hidden; }
        .transcript-panel { display: flex; flex-direction: column; overflow: hidden; }
        .panel-label { display: flex; align-items: center; gap: 8px; padding: 10px 16px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text-2); border-bottom: 1px solid var(--border); flex-shrink: 0; background: var(--surface); }
        .entry-count { font-size: 11px; font-weight: 400; color: var(--text-3); text-transform: none; letter-spacing: 0; }
        .transcript-feed { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; max-height: 340px; }
        .transcript-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 40px; color: var(--text-3); font-size: 13px; text-align: center; }
        .transcript-entry { display: flex; flex-direction: column; gap: 4px; }
        .entry-meta { display: flex; align-items: center; gap: 8px; }
        .entry-role { font-size: 11px; font-weight: 600; color: var(--text-2); }
        .transcript-entry.bot .entry-role { color: var(--accent); }
        .entry-time { font-size: 10px; color: var(--text-3); }
        .entry-text { font-size: 13px; line-height: 1.6; color: var(--text-1); padding: 8px 12px; background: var(--surface-2); border-radius: 7px; border: 1px solid var(--border); }
        .transcript-entry.bot .entry-text { background: var(--accent-soft); border-color: var(--accent-border); }
        .logs-panel { border-top: 1px solid var(--border); }
        .logs-panel.collapsed { }
        .logs-toggle { cursor: pointer; user-select: none; }
        .logs-toggle:hover { color: var(--text-1); }
        .logs-feed { max-height: 120px; overflow-y: auto; padding: 8px 16px; display: flex; flex-direction: column; gap: 2px; }
        .logs-empty { font-size: 12px; color: var(--text-3); padding: 8px 0; }
        .log-line { display: flex; gap: 10px; font-size: 11px; font-family: monospace; }
        .log-ts  { color: var(--text-3); flex-shrink: 0; }
        .log-msg { color: var(--text-1); }
        .log-line.error .log-msg { color: #ef4444; }
        .log-line.warn  .log-msg { color: #d97706; }
        .join-panel { display: grid; grid-template-columns: 1fr 1.5fr; gap: 32px; align-items: start; }
        .how-section { display: flex; flex-direction: column; gap: 20px; padding: 24px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; }
        .how-item { display: flex; gap: 14px; align-items: flex-start; }
        .how-num { width: 28px; height: 28px; border-radius: 50%; background: var(--accent-soft); border: 1px solid var(--accent-border); color: var(--accent); font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .how-item strong { font-size: 14px; font-weight: 600; color: var(--text-1); display: block; margin-bottom: 3px; }
        .how-item span { font-size: 13px; color: var(--text-2); }
        .join-form { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
        .join-tabs { display: flex; border-bottom: 1px solid var(--border); }
        .join-tab { flex: 1; padding: 12px; font-size: 13px; border: none; background: var(--surface); cursor: pointer; color: var(--text-3); transition: all .15s; border-bottom: 2px solid transparent; }
        .join-tab.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 500; background: var(--surface); }
        .field { display: flex; flex-direction: column; gap: 5px; padding: 0 16px; margin-bottom: 12px; }
        .field:first-of-type { margin-top: 16px; }
        .field label { font-size: 12px; font-weight: 500; color: var(--text-2); }
        .field input, .field select, .url-input { padding: 8px 10px; border: 1.5px solid var(--border); border-radius: 7px; font-size: 13px; font-family: inherit; background: var(--surface); color: var(--text-1); outline: none; width: 100%; box-sizing: border-box; }
        .field input:focus, .field select:focus, .url-input:focus { border-color: var(--accent); }
        .url-input { padding: 10px 14px; font-size: 14px; margin: 16px 16px 0; width: calc(100% - 32px); }
        .platform-detected { font-size: 11px; color: #059669; display: flex; align-items: center; gap: 4px; padding: 0 16px; margin-bottom: 4px; }
        .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 16px; margin-bottom: 12px; }
        .field-row .field { padding: 0; margin: 0; }
        .instructions-textarea { resize: vertical; }
        .join-notice { margin: 0 16px 12px; padding: 8px 12px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 7px; font-size: 12px; color: var(--text-2); }
        .field-error { margin: 0 16px 10px; padding: 8px 10px; background: #fef2f2; color: #ef4444; border-radius: 6px; font-size: 12px; }
        .join-btn { margin: 4px 16px 16px; width: calc(100% - 32px); justify-content: center; display: flex; align-items: center; gap: 7px; padding: 11px; }
        .sched-time-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; padding: 0 16px; margin-bottom: 12px; }
        .sched-time-row .field { padding: 0; margin: 0; }
        .sched-list { border-top: 1px solid var(--border); margin-top: 4px; }
        .sched-list-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--text-3); padding: 10px 16px 6px; }
        .sched-item { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-bottom: 1px solid var(--border); }
        .sched-item:last-child { border-bottom: none; }
        .sched-meta { flex: 1; display: flex; align-items: center; gap: 8px; }
        .sched-platform { font-size: 12px; font-weight: 500; color: var(--text-1); }
        .sched-name  { font-size: 12px; color: var(--text-2); }
        .sched-time  { font-size: 11px; color: var(--text-3); }
        .sched-status { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: var(--surface-2); color: var(--text-2); }
        .sched-del { color: var(--text-3); font-size: 11px; }
        .sched-del:hover { color: #ef4444; }
        .spinner { width: 12px; height: 12px; border-radius: 50%; border: 2px solid rgba(255,255,255,.3); border-top-color: #fff; animation: spin .7s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
