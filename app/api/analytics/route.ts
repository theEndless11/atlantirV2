import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const workspaceId = searchParams.get('workspace_id')
  const days = parseInt(searchParams.get('days') || '30')
  if (!workspaceId) return NextResponse.json({ error: 'workspace_id required' }, { status: 400 })

  const sb = supabaseAdmin()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // All queries fire in parallel — no sequential waterfall.
  // file_chunks: count-only queries, never fetches vector data.
  // meetings: drops `transcript` field (unused, potentially large).
  const [tasks, meetings, agentRuns, integrations, databases, embeddedCount, totalCount] =
    await Promise.all([
      sb.from('tasks')
        .select('id,status,assigned_agent,created_at,updated_at')
        .eq('workspace_id', workspaceId)
        .gte('created_at', since),

      sb.from('meetings')
        .select('id,source,bot_platform,created_at')
        .eq('workspace_id', workspaceId)
        .gte('created_at', since),

      // Try querying agent_runs directly by workspace_id.
      // If that column doesn't exist yet, returns empty gracefully.
      sb.from('agent_runs')
        .select('id,agent_type,status,started_at,ended_at')
        .eq('workspace_id', workspaceId)
        .gte('started_at', since)
        .then(res => (res.error ? { data: [] } : res)),

      sb.from('integrations')
        .select('type,status')
        .eq('workspace_id', workspaceId),

      sb.from('db_connections')
        .select('name,db_type,status')
        .eq('workspace_id', workspaceId),

      // Count embedded chunks — never fetch vector data
      sb.from('file_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .not('embedding', 'is', null),

      // Count total chunks
      sb.from('file_chunks')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId),
    ])

  const allTasks    = tasks.data    || []
  const allMeetings = meetings.data || []
  const allRuns     = agentRuns.data || []
  const allIntegrations = (integrations.data || []).map((i: any) => ({
    type: i.type,
    status: i.status || 'connected',
  }))

  const embeddedChunks = embeddedCount.count ?? 0
  const totalChunks    = totalCount.count    ?? 0
  const totalFiles     = Math.ceil(totalChunks / 10) || 0

  const tasksByStatus = allTasks.reduce((acc: any, t: any) => {
    acc[t.status] = (acc[t.status] || 0) + 1; return acc
  }, {})
  const tasksByAgent = allTasks.reduce((acc: any, t: any) => {
    if (t.assigned_agent) acc[t.assigned_agent] = (acc[t.assigned_agent] || 0) + 1; return acc
  }, {})

  const completed      = allTasks.filter((t: any) => t.status === 'completed').length
  const total          = allTasks.length
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  const completedRuns = allRuns.filter((r: any) => r.status === 'completed' && r.ended_at)
  const avgRunMs =
    completedRuns.length > 0
      ? completedRuns.reduce(
          (sum: number, r: any) =>
            sum + (new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()),
          0,
        ) / completedRuns.length
      : 0

  const tasksByDay: Record<string, number> = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    tasksByDay[d] = 0
  }
  allTasks.forEach((t: any) => {
    const d = t.created_at.slice(0, 10)
    if (tasksByDay[d] !== undefined) tasksByDay[d]++
  })

  const agentPerf: Record<string, { runs: number; completed: number; avgMs: number }> = {}
  allRuns.forEach((r: any) => {
    if (!agentPerf[r.agent_type]) agentPerf[r.agent_type] = { runs: 0, completed: 0, avgMs: 0 }
    agentPerf[r.agent_type].runs++
    if (r.status === 'completed') {
      agentPerf[r.agent_type].completed++
      if (r.ended_at)
        agentPerf[r.agent_type].avgMs +=
          new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()
    }
  })
  Object.values(agentPerf).forEach((p: any) => {
    if (p.completed > 0) p.avgMs = Math.round(p.avgMs / p.completed)
  })

  const payload = {
    summary: {
      totalTasks: total, completedTasks: completed, completionRate,
      totalMeetings: allMeetings.length, totalAgentRuns: allRuns.length,
      avgRunMs: Math.round(avgRunMs),
      totalVoiceSessions: allMeetings.filter((m: any) => m.source === 'voice' || m.bot_platform).length,
      totalEmbeddings: embeddedChunks,
      connectedIntegrations: allIntegrations.filter((i: any) => i.status === 'connected').length,
    },
    tasksByStatus, tasksByAgent, tasksByDay, agentPerf,
    integrations: allIntegrations,
    databases: databases.data || [],
    rag: { totalFiles, totalChunks, embeddedChunks },
  }

  return NextResponse.json(payload, {
    headers: {
      // Serve fresh for 60s, allow stale for another 30s while revalidating
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=30',
    },
  })
}
