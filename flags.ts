/**
 * flags.ts
 *
 * Feature flags — spec §14.10.
 * Uses Vercel Flags SDK + Edge Config for gradual rollouts and A/B tests.
 *
 * Day-one flags as specified:
 *   memory-backend-om     — gate OM upgrade when eval harness validates
 *   meeting-live-mode     — invite-only real-time voice loop
 *   decision-prompt-v2    — A/B test prompt iterations
 *   artifact-types-enabled — gate experimental artifact types (video, slides)
 *   privacy-search-mode   — route SearXNG+Tor for specific customers
 *   kill-switch-all-agents — emergency stop for production issues
 *
 * Usage:
 *   import { enableLiveMeetingMode } from '@/flags'
 *   const isEnabled = await enableLiveMeetingMode()
 */

import { flag } from 'flags/next'

// ---------------------------------------------------------------------------
// Type for the flag context object passed to decide()
// In Next.js, this is populated via the Flags SDK middleware.
// ---------------------------------------------------------------------------

interface FlagUser {
  id?: string
  tier?: 'free' | 'pro' | 'beta' | 'enterprise'
  workspace?: {
    id?: string
    features?: string[]
    privacyTier?: boolean
  }
}

// ---------------------------------------------------------------------------
// Flag definitions
// ---------------------------------------------------------------------------

/**
 * Gates the upgrade from plain pgvector RAG (Layer 2) to Mastra Observational
 * Memory. Only enable after the memory eval harness (§13.8) shows OM wins.
 */
export const enableOMMemoryBackend = flag<boolean>({
  key: 'memory-backend-om',
  defaultValue: false,
  decide({ user }: { user?: FlagUser }) {
    // Beta users get early access; 10% rollout to everyone else
    if (user?.tier === 'beta') return true
    return Math.random() < 0.1
  },
})

/**
 * Gates live meeting mode (real-time voice loop, Vexa bot, decision model).
 * Invite-only until the decision model is validated in user testing.
 */
export const enableLiveMeetingMode = flag<boolean>({
  key: 'meeting-live-mode',
  defaultValue: false,
  decide({ user }: { user?: FlagUser }) {
    return user?.workspace?.features?.includes('meetings') ?? false
  },
})

/**
 * A/B test for the decision loop prompt (speak/act/silent).
 * 50/50 split. Langfuse captures which version ran and outcome scores.
 * Tie to Langfuse prompt label: 'production' vs 'staging'.
 */
export const useNewDecisionPrompt = flag<boolean>({
  key: 'decision-prompt-v2',
  defaultValue: false,
  decide() {
    return Math.random() < 0.5
  },
})

/**
 * Gate experimental artifact types (video via Remotion, slides via Spectacle).
 * Enable after renderers are fully tested.
 */
export const enableExperimentalArtifacts = flag<boolean>({
  key: 'artifact-types-enabled',
  defaultValue: false,
  decide({ user }: { user?: FlagUser }) {
    return user?.tier === 'beta' || user?.tier === 'enterprise'
  },
})

/**
 * Route web searches through SearXNG+Tor for privacy-tier workspaces.
 * Set on workspace creation for enterprise customers who need data sovereignty.
 */
export const enablePrivacySearchMode = flag<boolean>({
  key: 'privacy-search-mode',
  defaultValue: false,
  decide({ user }: { user?: FlagUser }) {
    return user?.workspace?.privacyTier ?? false
  },
})

/**
 * Emergency kill switch — disables all agent execution immediately.
 * Flip to true in Vercel Edge Config if a runaway loop or security issue
 * is detected. Zero-downtime, takes effect on next request.
 */
export const killSwitchAllAgents = flag<boolean>({
  key: 'kill-switch-all-agents',
  defaultValue: false,
  decide() {
    // Controlled entirely via Edge Config — never auto-enable via code logic
    return false
  },
})

/**
 * Gate the new task command-center UI (Suna-inspired, replaces old dashboard).
 * Roll out to beta users first.
 */
export const enableNewTaskUI = flag<boolean>({
  key: 'new-task-ui',
  defaultValue: false,
  decide({ user }: { user?: FlagUser }) {
    return user?.tier === 'beta'
  },
})

// ---------------------------------------------------------------------------
// Helper: check kill switch before any agent execution
// ---------------------------------------------------------------------------

export async function assertAgentsEnabled(): Promise<void> {
  const killed = await killSwitchAllAgents()
  if (killed) {
    throw new Error('Agent execution is temporarily disabled. Check system status.')
  }
}
