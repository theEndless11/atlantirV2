/**
 * Memory composition layer.
 * Orchestrates all three memory layers and renders them into a prompt string.
 */
import { buildFileMemoryContext } from '@/lib/memory/file-tools'
import { semanticRecall } from '@/lib/memory/semantic-recall'
import { recencyWindow } from '@/lib/memory/recency'
import type { Message } from '@/types'

export interface MemoryContext {
  fileTree: string
  fileInlines: string
  semanticHits: Message[]
  recentMessages: Message[]
}

export async function composeMemoryContext(opts: {
  workspaceId: string
  query: string
  threadId?: string
  taskId?: string
  meetingId?: string
  isMeeting?: boolean
}): Promise<MemoryContext> {
  const { workspaceId, query, threadId, taskId, meetingId, isMeeting } = opts

  const [fileMemory, semanticHits, recentMessages] = await Promise.all([
    // Layer 1
    buildFileMemoryContext(workspaceId).catch((err) => {
      console.error('[memory/compose] Layer 1 (file) failed:', err)
      return ''
    }),
    // Layer 2
    semanticRecall({ workspaceId, query, threadId }).catch((err) => {
      console.error('[memory/compose] Layer 2 (semantic) failed:', err)
      return [] as Message[]
    }),
    // Layer 3
    threadId || taskId || meetingId
      ? recencyWindow({
          threadId: threadId ?? taskId ?? meetingId ?? '',
          taskId,
          meetingId,
          limit: isMeeting ? 40 : 10,
        }).catch((err) => {
          console.error('[memory/compose] Layer 3 (recency) failed:', err)
          return [] as Message[]
        })
      : Promise.resolve([] as Message[]),
  ])

  // Split Layer 1 result: tree is the first section, inlines is the rest
  const treeMarker = '## Memory File Tree\n'
  const inlineMarker = '\n\n## Key Memory Files\n'

  let fileTree = ''
  let fileInlines = ''

  if (fileMemory) {
    const inlineIdx = fileMemory.indexOf(inlineMarker)
    if (inlineIdx !== -1) {
      fileTree = fileMemory.slice(treeMarker.length, inlineIdx)
      fileInlines = fileMemory.slice(inlineIdx + inlineMarker.length)
    } else {
      fileTree = fileMemory.startsWith(treeMarker)
        ? fileMemory.slice(treeMarker.length)
        : fileMemory
    }
  }

  return { fileTree, fileInlines, semanticHits, recentMessages }
}

export function renderMemoryToPrompt(ctx: MemoryContext): string {
  const sections: string[] = []

  // ── Layer 1: File tree ──
  if (ctx.fileTree) {
    sections.push(`<memory_files_tree>\n${ctx.fileTree}\n</memory_files_tree>`)
  }

  // ── Layer 1: Inlined key files ──
  if (ctx.fileInlines) {
    sections.push(`<memory_files_content>\n${ctx.fileInlines}\n</memory_files_content>`)
  }

  // ── Layer 2: Semantic hits ──
  if (ctx.semanticHits.length > 0) {
    const formatted = ctx.semanticHits
      .map(
        (m) =>
          `[${m.created_at}] ${m.sender_type}${m.agent_type ? `(${m.agent_type})` : ''}: ${m.content}`,
      )
      .join('\n')
    sections.push(
      `<semantic_memory hits="${ctx.semanticHits.length}">\n${formatted}\n</semantic_memory>`,
    )
  }

  // ── Layer 3: Recent messages ──
  if (ctx.recentMessages.length > 0) {
    const formatted = ctx.recentMessages
      .map(
        (m) =>
          `[${m.created_at}] ${m.sender_type}${m.agent_type ? `(${m.agent_type})` : ''}: ${m.content}`,
      )
      .join('\n')
    sections.push(
      `<recent_messages count="${ctx.recentMessages.length}">\n${formatted}\n</recent_messages>`,
    )
  }

  if (sections.length === 0) return ''

  return `<!-- MEMORY CONTEXT -->\n${sections.join('\n\n')}\n<!-- END MEMORY CONTEXT -->`
}
