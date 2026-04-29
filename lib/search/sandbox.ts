/**
 * lib/search/sandbox.ts
 *
 * Sandboxed code execution — spec §14.8.
 * Used by the executor agent ("Bolt") for running generated code.
 * NOT used in the LLM decision loop or memory reads — only for heavy compute.
 *
 * e2b is primary (fastest cold start ~1s, agent-first API).
 * Called from Workflow SDK steps only — never in the hot voice path.
 */

export interface SandboxResult {
  stdout: string
  stderr: string
  exitCode: number
  error?: string
}

export type SandboxLanguage = 'python' | 'nodejs' | 'shell'

/**
 * Execute code in an e2b sandbox.
 * Always creates a fresh sandbox per call and closes it when done.
 * Should be called inside a "use step" Workflow SDK function.
 */
export async function runInSandbox(opts: {
  code: string
  language?: SandboxLanguage
  timeoutMs?: number
}): Promise<SandboxResult> {
  const { code, language = 'python', timeoutMs = 30_000 } = opts

  if (!process.env.E2B_API_KEY) {
    return {
      stdout: '',
      stderr: 'E2B_API_KEY not configured',
      exitCode: 1,
      error: 'E2B_API_KEY not configured — set it in .env to enable code execution',
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- e2b types vary by version
    const { Sandbox } = await import('@e2b/code-interpreter') as any

    const sandbox = await Sandbox.create({ apiKey: process.env.E2B_API_KEY, timeoutMs })

    try {
      const execution = await sandbox.runCode(code, { language })

      return {
        stdout: execution.logs?.stdout?.join('\n') ?? execution.output ?? '',
        stderr: execution.logs?.stderr?.join('\n') ?? '',
        exitCode: execution.error ? 1 : 0,
        error: execution.error?.value,
      }
    } finally {
      await sandbox.kill().catch(() => { /* best-effort cleanup */ })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { stdout: '', stderr: message, exitCode: 1, error: message }
  }
}

/**
 * Install packages and run code. Convenience wrapper for the executor agent.
 */
export async function runWithPackages(opts: {
  code: string
  packages: string[]
  language?: SandboxLanguage
}): Promise<SandboxResult> {
  const { packages, code, language = 'python' } = opts

  let fullCode = code
  if (packages.length > 0 && language === 'python') {
    fullCode = `import subprocess\nsubprocess.run(["pip", "install", "-q", ${packages.map(p => JSON.stringify(p)).join(', ')}], check=True)\n\n${code}`
  } else if (packages.length > 0 && language === 'nodejs') {
    fullCode = `const { execSync } = require('child_process')\nexecSync('npm install --silent ${packages.join(' ')}')\n\n${code}`
  }

  return runInSandbox({ code: fullCode, language })
}
