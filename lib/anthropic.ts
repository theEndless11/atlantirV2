/**
 * LLM client — OpenRouter via @ai-sdk/openai (OpenAI-compatible).
 *
 * The Anthropic SDK was previously pointed at OpenRouter's baseURL, but:
 *   - Anthropic SDK sends `x-api-key` header → OpenRouter wants `Authorization: Bearer`
 *   - Anthropic SDK calls `/v1/messages`    → OpenRouter serves `/v1/chat/completions`
 * Result: 401 "User not found" on every call.
 *
 * Fix: use @ai-sdk/openai with OpenRouter's baseURL — this is the correct client.
 */

import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import type { CoreMessage } from 'ai'

// ── OpenRouter provider ──────────────────────────────────────────────────────

function getProvider() {
  return createOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseURL: 'https://openrouter.ai/api/v1',
    headers: {
      'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
      'X-Title': 'Atlantir',
    },
  })
}

// ── Model IDs ────────────────────────────────────────────────────────────────

export const ORCHESTRATOR_MODEL = process.env.ORCHESTRATOR_MODEL || 'google/gemini-2.0-flash-lite-001'
export const AGENT_MODEL        = process.env.AGENT_MODEL        || 'google/gemini-2.0-flash-lite-001'
export const EXECUTOR_MODEL     = process.env.EXECUTOR_MODEL     || 'anthropic/claude-3-5-haiku'
export const MAX_TOKENS         = 4096

// ── Core helpers ─────────────────────────────────────────────────────────────

/** Get a model instance for use with Vercel AI SDK directly. */
export function getLLM(modelId: string) {
  return getProvider()(modelId)
}

/** Single-turn convenience call. Returns the text response. */
export async function callLLM(opts: {
  model?: string
  system: string
  prompt: string
  maxTokens?: number
}): Promise<string> {
  const { text } = await generateText({
    model: getLLM(opts.model ?? AGENT_MODEL),
    system: opts.system,
    prompt: opts.prompt,
    maxTokens: opts.maxTokens ?? MAX_TOKENS,
  })
  return text
}

// ── Legacy shim ──────────────────────────────────────────────────────────────
// All existing routes call useAnthropic().messages.create({ messages: [...] }).
// This shim maps that Anthropic-SDK shape → AI SDK generateText so nothing breaks.

type AnthropicMessage = { role: string; content: string | any[] }

function toAiMessages(msgs: AnthropicMessage[]): CoreMessage[] {
  return msgs.map(m => {
    const role = m.role === 'user' ? 'user' : 'assistant'
    const content = typeof m.content === 'string'
      ? m.content
      : Array.isArray(m.content)
        ? m.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
        : String(m.content)
    return { role, content } as CoreMessage
  })
}

export function useAnthropic() {
  return {
    messages: {
      async create(params: {
        model: string
        system: string
        max_tokens?: number
        messages: AnthropicMessage[]
        tools?: any[]
        tool_choice?: any
      }) {
        try {
          const { text } = await generateText({
            model: getLLM(params.model),
            system: params.system,
            messages: toAiMessages(params.messages),
            maxTokens: params.max_tokens ?? MAX_TOKENS,
          })

          return {
            content: [{ type: 'text' as const, text }],
            stop_reason: 'end_turn',
          }
        } catch (err: any) {
          // Surface a clean error instead of raw JSON 401
          const msg: string = err?.message || String(err)
          if (msg.includes('401') || msg.includes('User not found') || msg.includes('API key')) {
            throw new Error(
              'OpenRouter API key is invalid or missing. ' +
              'Add OPENROUTER_API_KEY to your .env.local and restart the server.'
            )
          }
          throw err
        }
      }
    }
  }
}
