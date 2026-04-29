/**
 * instrumentation.ts
 *
 * Next.js 15 instrumentation hook — runs once at server startup.
 * Registers the OpenTelemetry NodeSDK with the LangfuseExporter.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 * The Vercel AI SDK picks up the registered OTel provider automatically and
 * emits traces for every generateText / streamText / generateObject call.
 */

export async function register() {
  // Only run on the server — instrumentation.ts is loaded in both Node and Edge runtimes
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerOtelExporter } = await import('@/lib/observability/langfuse')
    await registerOtelExporter()
  }
}
