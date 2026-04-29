/**
 * Layer 3: Recency window.
 * Returns the last N messages from the current thread in chronological order.
 */
import { supabaseAdmin } from '@/lib/supabase'
import type { Message } from '@/types'

export async function recencyWindow(opts: {
  threadId: string
  taskId?: string
  meetingId?: string
  limit?: number
}): Promise<Message[]> {
  const { threadId, taskId, meetingId, limit } = opts
  const db = supabaseAdmin()

  // Default: 40 for meetings, 10 for tasks
  const effectiveLimit = limit ?? (meetingId ? 40 : 10)

  let query = db
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(effectiveLimit)

  if (taskId) {
    query = query.eq('task_id', taskId)
  } else if (meetingId) {
    query = query.eq('meeting_id', meetingId)
  } else {
    // Fall back to threadId as task_id
    query = query.eq('task_id', threadId)
  }

  const { data, error } = await query

  if (error) throw new Error(`recencyWindow query failed: ${error.message}`)
  if (!data) return []

  // Reverse to chronological order
  return (data as Message[]).reverse()
}
