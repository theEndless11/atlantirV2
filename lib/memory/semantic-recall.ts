/**
 * Layer 2: Semantic recall.
 * Embeds the query, calls match_messages RPC, then expands each hit
 * with ±neighborWindow messages by created_at order.
 */
import { embedText } from '@/lib/llm/client'
import { supabaseAdmin } from '@/lib/supabase'
import type { Message } from '@/types'

export async function semanticRecall(opts: {
  workspaceId: string
  query: string
  topK?: number
  neighborWindow?: number
  threadId?: string
}): Promise<Message[]> {
  const { workspaceId, query, topK = 5, neighborWindow = 2, threadId } = opts
  const db = supabaseAdmin()

  // 1. Embed the query
  const embedding = await embedText(query)

  // 2. Call match_messages RPC
  const rpcParams: Record<string, unknown> = {
    query_embedding: embedding,
    match_workspace_id: workspaceId,
    match_count: topK,
  }
  if (threadId) {
    rpcParams.match_thread_id = threadId
  }

  const { data: hits, error } = await db.rpc('match_messages', rpcParams)

  if (error) throw new Error(`match_messages RPC failed: ${error.message}`)
  if (!hits || hits.length === 0) return []

  // 3. Fetch ±neighborWindow messages around each hit
  const allMessageIds = new Set<string>()
  const neighborPromises = hits.map(async (hit: { id: string; created_at: string }) => {
    // Fetch neighbors by expanding the time window around this message
    let q = db
      .from('messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (threadId) q = q.eq('task_id', threadId)

    // Get messages immediately before this one
    const { data: before } = await db
      .from('messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .lte('created_at', hit.created_at)
      .order('created_at', { ascending: false })
      .limit(neighborWindow + 1)

    // Get messages immediately after this one
    const { data: after } = await db
      .from('messages')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gt('created_at', hit.created_at)
      .order('created_at', { ascending: true })
      .limit(neighborWindow)

    return [...(before ?? []), ...(after ?? [])] as Message[]
  })

  const neighborResults = await Promise.all(neighborPromises)

  // 4. Deduplicate and sort chronologically
  const deduped = new Map<string, Message>()
  for (const group of neighborResults) {
    for (const msg of group) {
      deduped.set(msg.id, msg)
    }
  }

  return Array.from(deduped.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
}
