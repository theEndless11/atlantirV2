'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'

const _cache: Record<string, { data: any; ts: number }> = {}
const CACHE_TTL = 60_000

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending', approved: 'Approved', in_progress: 'Running',
  needs_clarification: 'Question', completed: 'Done', cancelled: 'Cancelled',
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
function agentModel(a: string) { return a === 'executor' ? 'Claude 3.5 Haiku' : 'Gemini 2.5 Flash Lite' }
function shortDay(d: string) { return new Date(d + 'T12:00:00').toLocaleDateString([], { weekday: 'short' }).slice(0, 1) }

export default function AnalyticsPage() {
  const params = useParams()
  const workspaceId = Array.isArray(params.id) ? params.id[0] : params.id as string
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const maxBar = useMemo(() => !stats ? 1 : Math.max(1, ...Object.values(stats.tasksByDay as Record<string, number>)), [stats])
  const maxUsage = useMemo(() => {
    if (!stats) return 1
    return Math.max(1, stats.summary.totalAgentRuns, stats.agentPerf['executor']?.runs || 0, stats.summary.totalMeetings, stats.summary.totalVoiceSessions, stats.summary.totalEmbeddings)
  }, [stats])

  const avgTime = useMemo(() => {
    const ms = stats?.summary.avgRunMs || 0
    if (!ms) return '—'
    return ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60000)}m`
  }, [stats])

  function barH(v: number) { return Math.max(2, Math.round((v / maxBar) * 100)) }
  function pct(v: number, total: number) { return total > 0 ? Math.round((v / total) * 100) : 0 }
  function usagePct(v: number, max: number) { return max > 0 ? Math.round((v / max) * 100) : 0 }

  async function load(silent = false) {
    if (!silent) setLoading(true)
    try {
      const key = `${workspaceId}:${days}`
      const res = await fetch(`/api/analytics?workspace_id=${workspaceId}&days=${days}`)
      const data = await res.json()
      _cache[key] = { data, ts: Date.now() }
      setStats(data)
    } finally { if (!silent) setLoading(false) }
  }

  useEffect(() => {
    const key = `${workspaceId}:${days}`
    const cached = _cache[key]
    if (cached) {
      setStats(cached.data)
      setLoading(false)
      if (Date.now() - cached.ts < CACHE_TTL) return // fresh — skip refetch
      load(true) // stale — revalidate silently
    } else {
      load()
    }
  }, [workspaceId, days])

  return (
    <div className="page-shell">
      <div className="a-inner">
        <div className="page-header">
          <div>
            <h1>Analytics</h1>
            <p>Resource usage across models, agents, and integrations</p>
          </div>
          <select className="select" value={days} onChange={e => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {loading ? (
          <div className="a-loading"><div className="spinner spinner-dark" /><span>Loading…</span></div>
        ) : stats ? (
          <>
            <div className="section-label a-label">Overview</div>
            <div className="a-group">
              {[
                ['LLM calls', stats.summary.totalAgentRuns],
                ['Meetings transcribed', stats.summary.totalMeetings],
                ['Chunks embedded', stats.summary.totalEmbeddings],
                ['Tasks created', stats.summary.totalTasks],
                ['Completion rate', `${stats.summary.completionRate}%`],
                ['Avg run time', avgTime],
              ].map(([k, v]) => (
                <div key={k as string} className="a-row">
                  <span className="a-key">{k}</span>
                  <span className="a-val">{v}</span>
                </div>
              ))}
            </div>

            <div className="section-label a-label">AI Models</div>
            <div className="a-group">
              {[
                { tag: 'LLM', cls: 'mtag-llm', name: 'Gemini 2.5 Flash Lite', meta: 'Google · OpenRouter', use: 'Agent tasks, voice, orchestration', count: stats.summary.totalAgentRuns, unit: 'calls', usage: stats.summary.totalAgentRuns },
                { tag: 'Exec', cls: 'mtag-exec', name: 'Claude 3.5 Haiku', meta: 'Anthropic · OpenRouter', use: 'Tool use, integrations, queries', count: stats.agentPerf['executor']?.runs || 0, unit: 'runs', usage: stats.agentPerf['executor']?.runs || 0 },
                { tag: 'STT', cls: 'mtag-stt', name: 'Nova-2', meta: 'Deepgram · WebSocket', use: 'Meeting transcription, Zoom bot', count: stats.summary.totalMeetings, unit: 'sessions', usage: stats.summary.totalMeetings },
                { tag: 'TTS', cls: 'mtag-tts', name: 'Turbo v2.5 · Rachel', meta: 'ElevenLabs', use: 'Voice replies, Zoom bot speech', count: stats.summary.totalVoiceSessions, unit: 'sessions', usage: stats.summary.totalVoiceSessions },
                { tag: 'Embed', cls: 'mtag-embed', name: 'text-embedding-ada-002', meta: 'OpenAI · OpenRouter', use: 'RAG indexing, semantic search', count: stats.summary.totalEmbeddings, unit: 'chunks', usage: stats.summary.totalEmbeddings },
              ].map(m => (
                <div key={m.name} className="a-row a-model-row">
                  <span className="a-key a-model-name"><span className={`mtag ${m.cls}`}>{m.tag}</span>{m.name}</span>
                  <span className="a-model-meta">{m.meta}</span>
                  <span className="a-model-use">{m.use}</span>
                  <span className="a-val">
                    <span className="a-usage-bar"><span className="a-usage-fill" style={{ width: usagePct(m.usage, maxUsage) + '%' }} /></span>
                    {m.count} {m.unit}
                  </span>
                </div>
              ))}
            </div>

            <div className="section-label a-label">
              Task activity <span className="a-label-sub">last {days} days</span>
            </div>
            <div className="a-barchart">
              <div className="a-bar-y">
                <span>{maxBar}</span>
                <span>{Math.round(maxBar / 2)}</span>
                <span>0</span>
              </div>
              <div className="a-bars">
                {Object.entries(stats.tasksByDay as Record<string, number>).map(([day, count]) => (
                  <div key={day} className="a-bar-col" title={`${day}: ${count} tasks`}>
                    <div className="a-bar-fill" style={{ height: barH(Number(count)) + '%' }} />
                    <div className="a-bar-lbl">{shortDay(day)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="section-label a-label">Task breakdown</div>
            <div className="a-breakdown-grid">
              <div className="a-breakdown-col">
                {!Object.keys(stats.tasksByStatus).length && <div className="a-empty">No tasks yet</div>}
                {Object.entries(stats.tasksByStatus as Record<string, number>).map(([status, count]) => (
                  <div key={status} className="a-breakdown-row">
                    <span className={`badge status-${status}`}>{STATUS_LABELS[status] || status}</span>
                    <div className="a-bd-right">
                      <div className="a-bd-track"><div className="a-bd-fill" style={{ width: pct(Number(count), stats.summary.totalTasks) + '%' }} /></div>
                      <span className="a-bd-count">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="a-breakdown-col">
                {!Object.keys(stats.tasksByAgent).length && <div className="a-empty">No agent runs yet</div>}
                {Object.entries(stats.tasksByAgent as Record<string, number>).map(([agent, count]) => (
                  <div key={agent} className="a-breakdown-row">
                    <span className="a-bd-name">{capitalize(agent)}<span className="a-bd-sub">{agentModel(agent)}</span></span>
                    <div className="a-bd-right">
                      <div className="a-bd-track"><div className="a-bd-fill" style={{ width: pct(Number(count), stats.summary.totalTasks) + '%' }} /></div>
                      <span className="a-bd-count">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      <style>{`
        .a-inner { max-width: 860px; margin: 0 auto; width: 100%; }
        .a-loading { display: flex; align-items: center; gap: 10px; color: var(--text-3); font-size: 13px; padding: 40px 0; }
        .a-empty { font-size: 13px; color: var(--text-3); padding: 8px 0; }
        .a-label { margin-top: 32px; margin-bottom: 14px; display: flex; align-items: center; gap: 10px; }
        .a-label-sub { font-size: 11px; font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--text-3); }
        .a-group { display: flex; flex-direction: column; gap: 0; }
        .a-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 7px 0; }
        .a-key { font-size: 15px; color: var(--text-2); flex: 1; }
        .a-val { font-size: 15px; font-weight: 500; color: var(--text-1); display: flex; align-items: center; gap: 10px; white-space: nowrap; flex-shrink: 0; }
        .a-model-row { display: grid; grid-template-columns: 220px 160px 1fr auto; gap: 16px; align-items: center; }
        .a-model-name { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 500; color: var(--text-1); white-space: nowrap; }
        .a-model-meta, .a-model-use { font-size: 13px; color: var(--text-3); }
        .a-usage-bar { display: inline-block; width: 60px; height: 3px; background: var(--surface-3); border-radius: 2px; overflow: hidden; flex-shrink: 0; }
        .a-usage-fill { height: 100%; background: var(--accent); opacity: .55; border-radius: 2px; }
        .mtag { font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; padding: 2px 5px; border-radius: 3px; flex-shrink: 0; }
        .mtag-llm   { background: rgba(124,58,237,.12); color: #a78bfa; }
        .mtag-exec  { background: rgba(59,130,246,.12);  color: #93c5fd; }
        .mtag-stt   { background: rgba(16,185,129,.12);  color: #34d399; }
        .mtag-tts   { background: rgba(245,158,11,.12);  color: #fbbf24; }
        .mtag-embed { background: rgba(107,114,128,.12); color: #9ca3af; }
        .a-barchart { display: flex; gap: 8px; height: 110px; margin-bottom: 0; }
        .a-bar-y { display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; padding-bottom: 18px; flex-shrink: 0; }
        .a-bar-y span { font-size: 10px; color: var(--text-3); }
        .a-bars { flex: 1; display: flex; align-items: flex-end; gap: 3px; padding-bottom: 18px; }
        .a-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; position: relative; cursor: default; }
        .a-bar-fill { width: 100%; background: var(--accent); border-radius: 2px 2px 0 0; min-height: 2px; opacity: .3; transition: opacity .15s; }
        .a-bar-col:hover .a-bar-fill { opacity: .65; }
        .a-bar-lbl { font-size: 8px; color: var(--text-3); position: absolute; bottom: -16px; }
        .a-breakdown-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 0; }
        .a-breakdown-col { display: flex; flex-direction: column; gap: 0; }
        .a-breakdown-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 0; }
        .a-bd-name { font-size: 15px; color: var(--text-1); display: flex; align-items: baseline; gap: 7px; }
        .a-bd-sub  { font-size: 12px; color: var(--text-3); font-weight: 400; }
        .a-bd-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .a-bd-track { width: 80px; height: 3px; background: var(--surface-3); border-radius: 2px; overflow: hidden; }
        .a-bd-fill  { height: 100%; background: var(--accent); opacity: .45; border-radius: 2px; }
        .a-bd-count { font-size: 14px; font-weight: 500; color: var(--text-1); min-width: 22px; text-align: right; }
        .select { padding: 6px 10px; border: 1.5px solid var(--border); border-radius: 7px; font-size: 13px; background: var(--surface); color: var(--text-1); cursor: pointer; }
        .spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--border); border-top-color: var(--accent); animation: spin .7s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
