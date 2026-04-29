// ============================================================
// Atlantir — LLM Client
// Vercel AI SDK v4 + Google Gemini (chat + embeddings)
// All LLM and embedding calls go through this file.
// ============================================================

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { embed } from 'ai'

// ─── Google Gemini provider ───────────────────────────────────

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY!,
})

// ─── Chat model ───────────────────────────────────────────────

export const MODEL_ID = 'gemini-2.0-flash'

/**
 * Returns the Gemini 2.0 Flash model instance.
 * Usage: `await generateText({ model: llm(), prompt: '...' })`
 */
export function llm() {
  return google(MODEL_ID)
}

// ─── Telemetry ────────────────────────────────────────────────

export interface TelemetryOpts {
  functionId: string
  workspaceId?: string
  employeeId?: string
  taskId?: string
}

/**
 * Builds the `experimental_telemetry` object for Vercel AI SDK.
 * Pass directly into streamText / generateText / generateObject.
 */
export function buildTelemetry(opts: TelemetryOpts) {
  return {
    isEnabled: true,
    functionId: opts.functionId,
    metadata: {
      ...(opts.workspaceId && { workspaceId: opts.workspaceId }),
      ...(opts.employeeId && { employeeId: opts.employeeId }),
      ...(opts.taskId    && { taskId:    opts.taskId    }),
    },
  }
}

// ─── Embeddings ───────────────────────────────────────────────

export const EMBEDDING_MODEL = 'text-embedding-004'
export const EMBEDDING_DIMS  = 768 // Gemini text-embedding-004 native dims

/**
 * Embeds a string using Gemini text-embedding-004 (768 dims).
 * Falls back to a zero-vector and logs a warning rather than throwing,
 * so agent runs are never blocked by an embedding failure.
 */
export async function embedText(text: string): Promise<number[]> {
  try {
    const { embedding } = await embed({
      model: google.textEmbeddingModel(EMBEDDING_MODEL),
      value: text,
    })
    return embedding
  } catch (err) {
    console.warn('[embedText] Gemini embedding failed, returning zero-vector:', err)
    return new Array(EMBEDDING_DIMS).fill(0) as number[]
  }
}