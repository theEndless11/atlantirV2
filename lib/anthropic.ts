import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function useAnthropic() {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api',
      defaultHeaders: {
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'Atlantir',
      },
    })
  }
  return _client
}

export const ORCHESTRATOR_MODEL = 'google/gemini-2.5-flash-lite'
export const AGENT_MODEL        = 'google/gemini-2.5-flash-lite'
export const EXECUTOR_MODEL     = process.env.EXECUTOR_MODEL || 'anthropic/claude-3.5-haiku'
export const MAX_TOKENS         = 4096
