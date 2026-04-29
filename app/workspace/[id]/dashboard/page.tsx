'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

// Simple in-memory cache shared across navigations within the same session
const _cache: Record<string, { stats: any; tasks: any[]; ts: number }> = {}

const statusLabels: Record<string, string> = {
  pending_approval: 'Pending', approved: 'Approved', in_progress: 'Running',
  needs_clarification: 'Question', completed: 'Done', cancelled: 'Cancelled'
}

export default function DashboardPage() {
  const params = useParams()
  const workspaceId = Array.isArray(params.id) ? params.id[0] : params.id as string
  const [stats, setStats] = useState<any>(null)
  const [recentTasks, setRecentTasks] = useState<any[]>([])
  const [workspaceName, setWorkspaceName] = useState('')
  const [today, setToday] = useState('')
  useEffect(() => {
    setToday(new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }))
  }, [])

  const avgRunTime = useMemo(() => {
    const ms = stats?.summary?.avgRunMs || 0
    if (!ms) return '—'
    return ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60000)}m`
  }, [stats])

  const tasksByDaySlice = useMemo(() => {
    const days = stats?.tasksByDay || {}
    const keys = Object.keys(days).slice(-14)
    return Object.fromEntries(keys.map((k: string) => [k, days[k]]))
  }, [stats])

  const maxBar = useMemo(() => Math.max(1, ...Object.values(tasksByDaySlice as Record<string, number>)), [tasksByDaySlice])
  function barHeight(v: number) { return Math.max(4, Math.round((v / maxBar) * 100)) }
  function shortDay(d: string) { return new Date(d).toLocaleDateString([], { weekday: 'short' }).slice(0, 2) }

  const agentEntries = useMemo(() =>
    Object.entries(stats?.agentPerf || {}).sort((a: any, b: any) => b[1].runs - a[1].runs), [stats])
  const maxAgentRuns = useMemo(() => Math.max(1, ...agentEntries.map((e: any) => e[1].runs)), [agentEntries])
  function agentBarW(runs: number) { return Math.round((runs / maxAgentRuns) * 100) }

  function formatDate(ts: string) { return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' }) }

  useEffect(() => {
    const CACHE_TTL = 60_000 // 60s stale-while-revalidate
    const cached = _cache[workspaceId]
    // Show cached data instantly if fresh enough
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setStats(cached.stats)
      setRecentTasks(cached.tasks)
      return // skip refetch if data is very fresh
    }
    if (cached) {
      // Paint stale data immediately, then silently revalidate
      setStats(cached.stats)
      setRecentTasks(cached.tasks)
    }
    async function load() {
      const sb = supabaseBrowser()
      const [statsRes, tasksRes] = await Promise.all([
        fetch(`/api/analytics?workspace_id=${workspaceId}&days=30`).then(r => r.json()),
        sb.from('tasks').select('*').eq('workspace_id', workspaceId)
          .in('status', ['pending_approval', 'approved', 'in_progress', 'needs_clarification'])
          .order('created_at', { ascending: false }).limit(8)
      ])
      _cache[workspaceId] = { stats: statsRes, tasks: tasksRes.data || [], ts: Date.now() }
      setStats(statsRes)
      setRecentTasks(tasksRes.data || [])
    }
    load()
  }, [workspaceId])

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h1>{workspaceName}</h1>
          <p>{today}</p>
        </div>
        <Link href={`/workspace/${workspaceId}/meeting/room`} className="btn btn-danger">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
          Start meeting
        </Link>
      </div>

      <div className="summary-cards">
        {[
          { val: stats?.summary?.totalTasks || 0, name: 'Tasks this month', sub: `${stats?.summary?.completionRate || 0}% completion` },
          { val: stats?.summary?.completedTasks || 0, name: 'Completed', sub: `${stats?.summary?.totalAgentRuns || 0} agent runs`, accent: true },
          { val: stats?.summary?.totalMeetings || 0, name: 'Meetings', sub: 'Last 30 days' },
          { val: avgRunTime, name: 'Avg agent run', sub: 'per task' },
        ].map((c, i) => (
          <div key={i} className={`card stat-card${c.accent ? ' accent' : ''}`}>
            <div className="stat-val">{c.val}</div>
            <div className="stat-name">{c.name}</div>
            <div className="stat-sub">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <div className="card section-card">
          <div className="card-head">
            Active tasks
            <Link href={`/workspace/${workspaceId}`} className="see-all">View all →</Link>
          </div>
          {!recentTasks.length
            ? <div className="empty-small">No active tasks</div>
            : recentTasks.map(task => (
              <div key={task.id} className="task-row">
                <span className="task-name">{task.title}</span>
                <span className={`badge agent-${task.assigned_agent}`}>{task.assigned_agent || '—'}</span>
                <span className={`badge status-${task.status}`}>{statusLabels[task.status] || task.status}</span>
                <span className={`priority-dot ${task.priority}`} />
              </div>
            ))
          }
        </div>

        <div className="card section-card">
          <div className="card-head">Task activity</div>
          <div className="bar-chart">
            {Object.entries(tasksByDaySlice).map(([day, count]) => (
              <div key={day} className="bar-col">
                <div className="bar-fill" style={{ height: barHeight(count as number) + '%' }} title={`${day}: ${count}`} />
                <div className="bar-lbl">{shortDay(String(day))}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card section-card">
          <div className="card-head">Agent usage</div>
          {!agentEntries.length
            ? <div className="empty-small">No agent data yet</div>
            : agentEntries.map(([agent, data]: any) => (
              <div key={String(agent)} className="agent-row">
                <span className={`badge agent-${agent}`}>{String(agent)}</span>
                <div className="agent-bar-wrap">
                  <div className={`agent-bar-fill agent-${agent}`} style={{ width: agentBarW(data.runs) + '%' }} />
                </div>
                <span className="agent-runs">{data.runs} runs</span>
              </div>
            ))
          }
        </div>

        <div className="card section-card">
          <div className="card-head">
            Recent meetings
            <Link href={`/workspace/${workspaceId}/meeting/room`} className="see-all">New →</Link>
          </div>
          {!stats?.recentMeetings?.length
            ? <div className="empty-small">No meetings yet</div>
            : stats.recentMeetings.map((m: any) => (
              <div key={m.id} className="meeting-row">
                <span className={`meeting-dot ${m.status}`} />
                <span className="meeting-title">{m.title || 'Meeting'}</span>
                {m.source === 'bot' && <span className="meeting-badge">bot</span>}
                <span className="meeting-date">{formatDate(m.created_at)}</span>
              </div>
            ))
          }
        </div>
      </div>

      <style>{`
        .summary-cards { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 20px; }
        .stat-card { padding: 18px 20px; }
        .stat-card.accent { border-color: var(--accent-border); background: var(--accent-soft); }
        .stat-val { font-size: 28px; font-weight: 700; color: var(--text-1); line-height: 1; }
        .stat-name { font-size: 13px; font-weight: 500; color: var(--text-1); margin: 6px 0 2px; }
        .stat-sub { font-size: 12px; color: var(--text-3); }
        .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .section-card { padding: 0; overflow: hidden; }
        .card-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; font-size: 13px; font-weight: 600; color: var(--text-1); border-bottom: 1px solid var(--border-soft); }
        .see-all { font-size: 12px; color: var(--accent); font-weight: 400; text-decoration: none; }
        .see-all:hover { text-decoration: underline; }
        .empty-small { padding: 20px 18px; font-size: 13px; color: var(--text-3); font-style: italic; }
        .task-row { display: flex; align-items: center; gap: 8px; padding: 9px 18px; border-bottom: 1px solid var(--border-soft); }
        .task-row:last-child { border-bottom: none; }
        .task-name { flex: 1; font-size: 13px; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bar-chart { display: flex; align-items: flex-end; gap: 3px; height: 90px; padding: 12px 18px 28px; position: relative; }
        .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
        .bar-fill { width: 100%; background: var(--accent); border-radius: 3px 3px 0 0; min-height: 2px; transition: height .3s; opacity: .8; }
        .bar-lbl { font-size: 9px; color: var(--text-3); margin-top: 4px; position: absolute; bottom: 10px; }
        .agent-row { display: flex; align-items: center; gap: 10px; padding: 9px 18px; border-bottom: 1px solid var(--border-soft); }
        .agent-row:last-child { border-bottom: none; }
        .agent-bar-wrap { flex: 1; height: 5px; background: var(--surface-2); border-radius: 3px; overflow: hidden; }
        .agent-bar-fill { height: 100%; border-radius: 3px; }
        .agent-bar-fill.agent-research { background: var(--agent-research, #6366f1); }
        .agent-bar-fill.agent-writer { background: var(--agent-writer, #8b5cf6); }
        .agent-bar-fill.agent-analyst { background: var(--agent-analyst, #06b6d4); }
        .agent-bar-fill.agent-executor { background: var(--agent-executor, #10b981); }
        .agent-runs { font-size: 12px; color: var(--text-2); min-width: 52px; text-align: right; }
        .meeting-row { display: flex; align-items: center; gap: 8px; padding: 9px 18px; border-bottom: 1px solid var(--border-soft); }
        .meeting-row:last-child { border-bottom: none; }
        .meeting-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--border); flex-shrink: 0; }
        .meeting-dot.ended { background: #4ade80; }
        .meeting-dot.live { background: #f87171; animation: pulse-dot 1.5s infinite; }
        .meeting-dot.scheduled { background: var(--accent); }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.4} }
        .meeting-title { font-size: 13px; color: var(--text-1); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .meeting-badge { font-size: 10px; padding: 1px 6px; border-radius: 99px; background: var(--accent-soft); color: var(--accent); border: 1px solid var(--accent-border); flex-shrink: 0; font-weight: 600; }
        .meeting-date { font-size: 11px; color: var(--text-3); flex-shrink: 0; }
      `}</style>
    </div>
  )
}