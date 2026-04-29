/**
 * lib/agents/decision-loop.ts
 *
 * The meeting-time decision model — spec §5.3.
 * Runs at every VAD-detected pause in a live meeting.
 *
 * Decision: speak | act | silent
 *
 * This is the product's technical moat. It must be:
 * - Fast (GLM-4.7 Flash, ≤500ms TTFT target)
 * - Conservative (default to silent)
 * - Context-aware (last N utterances, was AI addressed, elapsed silence)
 *
 * The generation model (what to actually say) runs only when decision === "speak".
 * Side-agent tasks (decision === "act") are triggered async, non-blocking.
 */

import { generateText } from 'ai'
import { llm, buildTelemetry } from '@/lib/llm/client'
import { buildDecisionSystemPrompt } from '@/lib/agents/prompts'
import type { TranscriptSegment } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DecisionVerdict = 'speak' | 'act' | 'silent'

export interface DecisionInput {
  meetingId: string
  workspaceId: string
  employeeId: string
  employeeName: string
  /** The last N transcript segments (sliding window) */
  recentSegments: TranscriptSegment[]
  /** Speaker who just finished talking */
  currentSpeaker: string
  /** Milliseconds of silence since last utterance */
  elapsedSilenceMs: number
  /** Whether the AI's name was mentioned in the last utterance */
  aiWasAddressed: boolean
  /** Names of actions the AI took in the last 60s (to avoid repetition) */
  recentAiActions: string[]
}

export interface DecisionResult {
  verdict: DecisionVerdict
  /** Set when verdict === "speak" */
  response?: string
  /** Set when verdict === "act" */
  task?: string
  /** Raw model output for debugging/Langfuse */
  rawOutput: string
  latencyMs: number
}

// ---------------------------------------------------------------------------
// Decision thresholds
// ---------------------------------------------------------------------------

/** Minimum silence before AI considers speaking (ms) */
const MIN_SILENCE_MS = 800

/** If addressed directly, lower silence threshold (ms) */
const ADDRESSED_SILENCE_MS = 400

/** Maximum recent context window (segments) */
const CONTEXT_WINDOW = 12

// ---------------------------------------------------------------------------
// Core decision function
// ---------------------------------------------------------------------------

export async function runDecisionLoop(input: DecisionInput): Promise<DecisionResult> {
  const {
    meetingId,
    workspaceId,
    employeeId,
    employeeName,
    recentSegments,
    currentSpeaker,
    elapsedSilenceMs,
    aiWasAddressed,
    recentAiActions,
  } = input

  const t0 = Date.now()

  // Fast-path: not enough silence yet and not directly addressed
  const threshold = aiWasAddressed ? ADDRESSED_SILENCE_MS : MIN_SILENCE_MS
  if (elapsedSilenceMs < threshold) {
    return { verdict: 'silent', rawOutput: 'fast-path: silence threshold not met', latencyMs: Date.now() - t0 }
  }

  // Build the context string from recent segments
  const contextLines = recentSegments
    .slice(-CONTEXT_WINDOW)
    .map(s => `[${s.speaker_name}]: ${s.text}`)
    .join('\n')

  const userMessage = [
    `Recent transcript:`,
    contextLines,
    ``,
    `Current speaker who just finished: ${currentSpeaker}`,
    `Elapsed silence: ${elapsedSilenceMs}ms`,
    `Were you (${employeeName}) directly addressed? ${aiWasAddressed ? 'YES' : 'no'}`,
    recentAiActions.length ? `Your recent actions (avoid repeating): ${recentAiActions.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const systemPrompt = buildDecisionSystemPrompt(employeeName)

  let rawOutput = ''

  try {
    const result = await generateText({
      model: llm(),
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxSteps: 1,
      experimental_telemetry: buildTelemetry({
        functionId: 'meeting-decision-loop',
        workspaceId,
        employeeId,
        taskId: meetingId,
      }),
    })

    rawOutput = result.text.trim()
  } catch {
    // Decision model failure → stay silent (safe default)
    return { verdict: 'silent', rawOutput: 'model-error', latencyMs: Date.now() - t0 }
  }

  // Parse the JSON decision
  const parsed = parseDecisionOutput(rawOutput)
  return { ...parsed, rawOutput, latencyMs: Date.now() - t0 }
}

// ---------------------------------------------------------------------------
// Output parser — robust to minor model deviations
// ---------------------------------------------------------------------------

function parseDecisionOutput(raw: string): Pick<DecisionResult, 'verdict' | 'response' | 'task'> {
  // Strip any accidental markdown fences
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()

  try {
    const obj = JSON.parse(clean)
    const verdict = obj.decision as DecisionVerdict

    if (verdict === 'speak' && typeof obj.response === 'string') {
      return { verdict: 'speak', response: obj.response.trim() }
    }
    if (verdict === 'act' && typeof obj.task === 'string') {
      return { verdict: 'act', task: obj.task.trim() }
    }
    if (verdict === 'silent') {
      return { verdict: 'silent' }
    }
  } catch {
    // JSON parse failed — default to silent
  }

  return { verdict: 'silent' }
}

// ---------------------------------------------------------------------------
// Helper: check if AI name was mentioned in the latest segment
// ---------------------------------------------------------------------------

export function wasAiAddressed(segment: TranscriptSegment, employeeName: string): boolean {
  const lower = segment.text.toLowerCase()
  const nameLower = employeeName.toLowerCase()
  return lower.includes(nameLower) || lower.includes('hey ai') || lower.includes('the ai')
}
