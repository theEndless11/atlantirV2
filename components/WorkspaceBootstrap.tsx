'use client'
import { useEffect, useRef } from 'react'
import { cacheSet, cacheGet } from '@/lib/tab-cache'

const _primed = new Set<string>()

export function WorkspaceBootstrap({ workspaceId }: { workspaceId: string }) {
  const done = useRef(false)

  useEffect(() => {
    if (done.current || _primed.has(workspaceId)) return
    done.current = true
    _primed.add(workspaceId)

    // Fire all tab data fetches in parallel — results go straight into the tab cache
    // so the first click on any sidebar tab is instant (cache hit, no spinner)
    const prime = async (key: string, url: string) => {
      if (cacheGet(key) !== null) return // already cached from a previous load
      try {
        const data = await fetch(url).then(r => r.ok ? r.json() : null)
        if (data !== null) cacheSet(key, data)
      } catch {}
    }

    Promise.all([
      prime(`employees:list:${workspaceId}`,    `/api/employees?workspaceId=${workspaceId}`),
      prime(`employees:skills:${workspaceId}`,   `/api/skills?workspaceId=${workspaceId}`),
      prime(`integrations:data:${workspaceId}`,  `/api/integrations?workspace_id=${workspaceId}`),
      prime(`integrations:employees:${workspaceId}`, `/api/employees?workspaceId=${workspaceId}`),
      prime(`memory:tree:${workspaceId}`,        `/api/memory?workspaceId=${workspaceId}`),
      prime(`files:kb:${workspaceId}`,           `/api/files?workspace_id=${workspaceId}`),
      prime(`analytics:${workspaceId}:30`,       `/api/analytics?workspace_id=${workspaceId}&days=30`),
      prime(`workflows:${workspaceId}`,          `/api/workflows?workspace_id=${workspaceId}`),
      prime(`settings:members:${workspaceId}`,   `/api/workspace/members?workspace_id=${workspaceId}`),
      prime(`analyst:dbs:${workspaceId}`,        `/api/analyst/db-list?workspace_id=${workspaceId}`),
    ])
  }, [workspaceId])

  return null
}
