// ============================================================
// Atlantir — Langfuse Observability (Foundation Layer)
// Self-hosted Langfuse on Fly.io + OpenTelemetry export
// All exports are named exports.
// ============================================================

import { Langfuse } from 'langfuse'
import { LangfuseExporter } from 'langfuse-vercel'

// ─── Singleton Langfuse Client ───────────────────────────────

/**
 * Singleton Langfuse SDK instance.
 * Reads credentials from environment variables at import time.
 *
 * Required env vars:
 *   LANGFUSE_PUBLIC_KEY  — project public key
 *   LANGFUSE_SECRET_KEY  — project secret key
 *   LANGFUSE_URL         — self-hosted base URL (e.g. https://langfuse.your-fly-app.internal)
 */
export const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY ?? '',
  secretKey: process.env.LANGFUSE_SECRET_KEY ?? '',
  baseUrl: process.env.LANGFUSE_URL ?? 'https://cloud.langfuse.com',
  // Flush immediately in serverless/edge environments
  flushAt: 1,
  flushInterval: 0,
})

// ─── OpenTelemetry Exporter ──────────────────────────────────

let _otelRegistered = false

/**
 * Initialises the OpenTelemetry NodeSDK with LangfuseExporter.
 * Call this once at app startup (e.g. in `instrumentation.ts`).
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function registerOtelExporter(): Promise<void> {
  if (_otelRegistered) return
  _otelRegistered = true

  // Dynamic import keeps this server-only; avoids bundling in edge runtime
  const { NodeSDK } = await import('@opentelemetry/sdk-node')
  const { Resource } = await import('@opentelemetry/resources')
  const { SEMRESATTRS_SERVICE_NAME } = await import(
    '@opentelemetry/semantic-conventions'
  )

  const exporter = new LangfuseExporter({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY ?? '',
    secretKey: process.env.LANGFUSE_SECRET_KEY ?? '',
    baseUrl: process.env.LANGFUSE_URL ?? 'https://cloud.langfuse.com',
  })

  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: 'atlantir',
    }),
    traceExporter: exporter,
  })

  sdk.start()

  // Flush on graceful shutdown
  process.on('SIGTERM', async () => {
    await sdk.shutdown()
  })
}

// ─── Prompt Management ───────────────────────────────────────

export interface GetPromptOpts {
  label?: string
  version?: number
  variables?: Record<string, string>
}

/**
 * Fetches a managed prompt from Langfuse and compiles variable substitutions.
 *
 * @param name      Prompt name as registered in Langfuse UI
 * @param opts      Optional label/version pin and variable map
 * @returns         Compiled prompt string ready to pass to the LLM
 */
export async function getPrompt(
  name: string,
  opts: GetPromptOpts = {},
): Promise<string> {
  const prompt = await langfuse.getPrompt(name, opts.version, {
    label: opts.label,
    // Cache for 60 s to avoid hammering Langfuse on every request
    cacheTtlSeconds: 60,
  })

  // `prompt.compile` substitutes {{variable}} placeholders
  const compiled = prompt.compile(opts.variables ?? {})

  // compiled may be string or ChatMessage[]; flatten to string
  if (typeof compiled === 'string') return compiled

  // If it's a chat-style prompt, join all assistant/user parts
  return (compiled as Array<{ content: string }>)
    .map((m) => m.content)
    .join('\n')
}

// ─── Score Helper ────────────────────────────────────────────

/**
 * Attaches a numeric score to an existing Langfuse trace.
 * Useful for post-hoc quality evaluation (e.g. thumbs up/down, eval harness).
 *
 * @param traceId   Langfuse trace ID (stored in AgentRun.langfuse_trace_id)
 * @param name      Score dimension name (e.g. 'relevance', 'faithfulness')
 * @param value     Numeric score value
 * @param comment   Optional human-readable comment
 */
export async function scoreTrace(
  traceId: string,
  name: string,
  value: number,
  comment?: string,
): Promise<void> {
  await langfuse.score({
    traceId,
    name,
    value,
    ...(comment && { comment }),
  })
}
