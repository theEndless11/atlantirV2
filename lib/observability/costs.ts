/**
 * lib/observability/costs.ts
 *
 * Workspace cost tracking — spec §15.6.
 * Rolls up LLM token usage into workspace_cost_daily.
 * Enforces per-workspace daily cost caps before agent execution.
 *
 * Called by the agent loop after each generateText() call.
 * The Langfuse trace captures per-call costs; this table powers
 * the billing dashboard and cap enforcement.
 */

import { supabaseAdmin } from '@/lib/supabase'

// Approximate cost per token in USD for GLM-4.7 Flash via DeepInfra
// Update when provider pricing changes
const COST_PER_INPUT_TOKEN = 0.06 / 1_000_000   // $0.06/M
const COST_PER_OUTPUT_TOKEN = 0.40 / 1_000_000  // $0.40/M
const COST_PER_CACHED_TOKEN = 0.01 / 1_000_000  // $0.01/M (DeepInfra cache)

export interface UsageMetrics {
  workspaceId: string
  tokensInput: number
  tokensOutput: number
  tokensCached?: number
  runId?: string
}

/**
 * Upsert daily cost roll-up for a workspace.
 * Called after every LLM step completes.
 */
export async function updateWorkflowCosts(metrics: UsageMetrics): Promise<void> {
  const { workspaceId, tokensInput, tokensOutput, tokensCached = 0 } = metrics

  const costUsd =
    tokensInput * COST_PER_INPUT_TOKEN +
    tokensOutput * COST_PER_OUTPUT_TOKEN +
    tokensCached * COST_PER_CACHED_TOKEN

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  const sb = supabaseAdmin()

  // Upsert — Postgres will add to existing row if date already exists
  await sb.rpc('increment_workspace_cost', {
    p_workspace_id: workspaceId,
    p_date: today,
    p_tokens_input: tokensInput,
    p_tokens_output: tokensOutput,
    p_tokens_cached: tokensCached,
    p_cost_usd: costUsd,
  }).throwOnError()
}

/**
 * Check if a workspace has exceeded its daily cost cap.
 * Call this at the START of runAgentLoop (before the LLM call).
 * Throws CostCapExceeded if the cap is hit — the Workflow SDK will
 * surface this as a task failure with a clear error message.
 */
export async function assertCostCapNotExceeded(workspaceId: string): Promise<void> {
  const sb = supabaseAdmin()

  const today = new Date().toISOString().slice(0, 10)

  const [{ data: costRow }, { data: workspace }] = await Promise.all([
    sb
      .from('workspace_cost_daily')
      .select('cost_usd')
      .eq('workspace_id', workspaceId)
      .eq('date', today)
      .single(),
    sb
      .from('workspaces')
      .select('daily_cost_cap_usd')
      .eq('id', workspaceId)
      .single(),
  ])

  const spent = costRow?.cost_usd ?? 0
  const cap = workspace?.daily_cost_cap_usd

  if (cap != null && spent >= cap) {
    // Notify workspace admin (fire and forget)
    notifyCostCapHit(workspaceId, spent, cap).catch(console.error)
    throw new CostCapExceeded(workspaceId, spent, cap)
  }
}

export class CostCapExceeded extends Error {
  constructor(
    public workspaceId: string,
    public spent: number,
    public cap: number
  ) {
    super(
      `Workspace ${workspaceId} has hit its daily cost cap ($${cap.toFixed(2)}). ` +
      `Spent today: $${spent.toFixed(4)}. Agent execution paused.`
    )
    this.name = 'CostCapExceeded'
  }
}

/**
 * Notify workspace admin via Supabase realtime when cost cap is hit.
 * Also inserts a system message into the workspace notification stream.
 */
async function notifyCostCapHit(workspaceId: string, spent: number, cap: number): Promise<void> {
  const sb = supabaseAdmin()
  await sb.from('messages').insert({
    workspace_id: workspaceId,
    sender_type: 'agent',
    content: `⚠️ Daily cost cap ($${cap.toFixed(2)}) reached. Spent today: $${spent.toFixed(4)}. Agent tasks are paused until tomorrow or until you raise the cap in workspace settings.`,
  })
}

/**
 * SQL function needed in Postgres (add to a migration):
 *
 * create or replace function increment_workspace_cost(
 *   p_workspace_id uuid, p_date date,
 *   p_tokens_input bigint, p_tokens_output bigint, p_tokens_cached bigint,
 *   p_cost_usd numeric
 * ) returns void language sql as $$
 *   insert into workspace_cost_daily
 *     (workspace_id, date, tokens_input, tokens_output, tokens_cached, cost_usd, traces)
 *   values
 *     (p_workspace_id, p_date, p_tokens_input, p_tokens_output, p_tokens_cached, p_cost_usd, 1)
 *   on conflict (workspace_id, date) do update set
 *     tokens_input  = workspace_cost_daily.tokens_input  + excluded.tokens_input,
 *     tokens_output = workspace_cost_daily.tokens_output + excluded.tokens_output,
 *     tokens_cached = workspace_cost_daily.tokens_cached + excluded.tokens_cached,
 *     cost_usd      = workspace_cost_daily.cost_usd      + excluded.cost_usd,
 *     traces        = workspace_cost_daily.traces        + 1;
 * $$;
 */
