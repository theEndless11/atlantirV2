/**
 * Module-level cache for tab data.
 * Survives React unmount/remount during sidebar navigation.
 * Each entry expires after TTL — stale data shows instantly, revalidation runs in background.
 */

const TTL = 60_000 // 1 minute

interface CacheEntry<T> {
  data: T
  ts: number
}

const _store: Record<string, CacheEntry<unknown>> = {}

export function cacheGet<T>(key: string): T | null {
  const entry = _store[key] as CacheEntry<T> | undefined
  if (!entry) return null
  return entry.data
}

export function cacheSet<T>(key: string, data: T): void {
  _store[key] = { data, ts: Date.now() }
}

export function cacheIsStale(key: string): boolean {
  const entry = _store[key]
  if (!entry) return true
  return Date.now() - entry.ts > TTL
}

export function cacheInvalidate(prefix: string): void {
  for (const key of Object.keys(_store)) {
    if (key.startsWith(prefix)) delete _store[key]
  }
}

/**
 * Stale-while-revalidate: returns cached data immediately (if any),
 * calls setter with it, then fetches fresh data in the background if stale.
 */
export async function swr<T>(
  key: string,
  fetcher: () => Promise<T>,
  setter: (data: T) => void,
  setLoading?: (v: boolean) => void,
): Promise<void> {
  const cached = cacheGet<T>(key)
  if (cached !== null) {
    setter(cached)
    setLoading?.(false)
    if (!cacheIsStale(key)) return // fresh — skip network call
    // Stale: revalidate silently in background
    fetcher().then(fresh => { cacheSet(key, fresh); setter(fresh) }).catch(() => {})
    return
  }
  // No cache — fetch and show loading
  setLoading?.(true)
  try {
    const data = await fetcher()
    cacheSet(key, data)
    setter(data)
  } finally {
    setLoading?.(false)
  }
}
