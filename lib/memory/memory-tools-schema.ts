/**
 * AI SDK tool definitions for the 6 memory tools.
 * workspaceId and updatedBy are passed via closure — not exposed to the LLM.
 */
import { tool } from 'ai'
import { z } from 'zod'
import {
  memoryView,
  memoryCreate,
  memoryStrReplace,
  memoryInsert,
  memoryRename,
  memoryDelete,
} from '@/lib/memory/file-tools'

export function buildMemoryTools(workspaceId: string, updatedBy: string) {
  return {
    memory_view: tool({
      description:
        'View the memory file tree (no path) or read the content of a specific file (with path). ' +
        'Always call with no path first to discover available files.',
      parameters: z.object({
        path: z
          .string()
          .optional()
          .describe('File path to read, e.g. "company.md". Omit to list all files.'),
      }),
      execute: async ({ path }) => {
        return memoryView(workspaceId, path)
      },
    }),

    memory_create: tool({
      description:
        'Create a new memory file. Fails if a file already exists at that path. ' +
        'Use markdown format. Common files: company.md, preferences.md.',
      parameters: z.object({
        path: z.string().describe('File path, e.g. "company.md" or "projects/roadmap.md"'),
        content: z.string().describe('Full markdown content for the new file'),
      }),
      execute: async ({ path, content }) => {
        return memoryCreate(workspaceId, path, content, updatedBy)
      },
    }),

    memory_str_replace: tool({
      description:
        'Edit a memory file by replacing an exact string. ' +
        'The oldStr must appear EXACTLY ONCE in the file. ' +
        'Preferred method for targeted edits.',
      parameters: z.object({
        path: z.string().describe('File path to edit'),
        oldStr: z.string().describe('Exact string to find (must appear exactly once)'),
        newStr: z.string().describe('Replacement string'),
      }),
      execute: async ({ path, oldStr, newStr }) => {
        return memoryStrReplace(workspaceId, path, oldStr, newStr, updatedBy)
      },
    }),

    memory_insert: tool({
      description:
        'Insert a line of content into a memory file at a specific line number. ' +
        'Line 0 inserts before all content. Line N inserts after line N.',
      parameters: z.object({
        path: z.string().describe('File path to edit'),
        line: z.number().int().min(0).describe('Insert after this line number (0 = before all)'),
        content: z.string().describe('Content to insert'),
      }),
      execute: async ({ path, line, content }) => {
        return memoryInsert(workspaceId, path, line, content, updatedBy)
      },
    }),

    memory_rename: tool({
      description: 'Rename or move a memory file to a new path.',
      parameters: z.object({
        oldPath: z.string().describe('Current file path'),
        newPath: z.string().describe('New file path'),
      }),
      execute: async ({ oldPath, newPath }) => {
        return memoryRename(workspaceId, oldPath, newPath, updatedBy)
      },
    }),

    memory_delete: tool({
      description:
        'Soft-delete a memory file. The file is marked deleted but kept for audit purposes. ' +
        'Use with caution — prefer editing over deleting.',
      parameters: z.object({
        path: z.string().describe('File path to delete'),
      }),
      execute: async ({ path }) => {
        return memoryDelete(workspaceId, path, updatedBy)
      },
    }),
  }
}
