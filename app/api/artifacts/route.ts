/**
 * app/api/artifacts/route.ts
 *
 * GET  /api/artifacts?taskId=&workspaceId=        — list artifacts for a task
 * POST /api/artifacts                              — create / generate an artifact
 * PATCH /api/artifacts                             — state transition or versioning
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'
import {
  createArtifact,
  markArtifactReviewed,
  approveArtifact,
  markArtifactExecuted,
  versionArtifact,
  generateDocumentArtifact,
  generateEmailArtifact,
  generateChartArtifact,
  getTaskArtifacts,
  getArtifact,
} from '@/lib/artifacts'
import { buildAgentSystemPrompt } from '@/lib/agents/prompts'
import { composeMemoryContext, renderMemoryToPrompt } from '@/lib/memory/compose'
import type { Artifact } from '@/types'

async function getUser(req: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  return supabase.auth.getUser()
}

async function assertMember(workspaceId: string, userId: string) {
  const sb = supabaseAdmin()
  const { data } = await sb
    .from('workspace_members').select('id')
    .eq('workspace_id', workspaceId).eq('user_id', userId).single()
  return !!data
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const { data: { user } } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId')
  const artifactId = searchParams.get('artifactId')
  const workspaceId = searchParams.get('workspaceId')

  if (!workspaceId) return NextResponse.json({ error: 'workspaceId required' }, { status: 400 })
  if (!await assertMember(workspaceId, user.id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (artifactId) {
    const artifact = await getArtifact(artifactId)
    if (!artifact || artifact.workspace_id !== workspaceId)
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(artifact)
  }

  if (!taskId) return NextResponse.json({ error: 'taskId or artifactId required' }, { status: 400 })
  const artifacts = await getTaskArtifacts(taskId)
  return NextResponse.json(artifacts)
}

// ---------------------------------------------------------------------------
// POST — create or generate
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  const { data: { user } } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    workspaceId: string
    taskId?: string
    employeeId: string
    type: Artifact['type']
    title: string
    // Option A: pass raw content directly (caller built it)
    content?: Record<string, unknown>
    // Option B: let the agent generate it
    generate?: boolean
    prompt?: string
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { workspaceId, taskId, employeeId, type, title, content, generate, prompt } = body
  if (!workspaceId || !employeeId || !type || !title)
    return NextResponse.json({ error: 'workspaceId, employeeId, type, title required' }, { status: 400 })

  if (!await assertMember(workspaceId, user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Manual content path
  if (!generate && content) {
    const artifact = await createArtifact({
      workspaceId, taskId, employeeId, type, title, content,
      createdBy: `user:${user.id}`,
    })
    return NextResponse.json(artifact, { status: 201 })
  }

  // Generation path — build a system prompt with memory context
  if (!prompt) return NextResponse.json({ error: 'prompt required when generate=true' }, { status: 400 })

  const sb = supabaseAdmin()
  const [{ data: employee }, memCtx] = await Promise.all([
    sb.from('employees').select('*, skills:employee_skills(skill:skills(*))').eq('id', employeeId).single(),
    composeMemoryContext({ workspaceId, query: prompt, taskId }),
  ])

  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 })

  const systemPrompt = buildAgentSystemPrompt({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    employee: employee as any,
    memoryPrompt: renderMemoryToPrompt(memCtx),
  })

  let artifact: Artifact
  switch (type) {
    case 'document': {
      const result = await generateDocumentArtifact({ workspaceId, taskId, employeeId, title, prompt, systemPrompt })
      artifact = result.artifact
      break
    }
    case 'email':
      artifact = await generateEmailArtifact({ workspaceId, taskId, employeeId, title, prompt, systemPrompt })
      break
    case 'chart':
      artifact = await generateChartArtifact({ workspaceId, taskId, employeeId, title, prompt, systemPrompt })
      break
    default:
      return NextResponse.json({ error: `Generation not yet supported for type: ${type}` }, { status: 400 })
  }

  return NextResponse.json(artifact, { status: 201 })
}

// ---------------------------------------------------------------------------
// PATCH — state transitions and versioning
// ---------------------------------------------------------------------------

export async function PATCH(req: Request) {
  const { data: { user } } = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    artifactId: string
    workspaceId: string
    action: 'review' | 'approve' | 'execute' | 'version'
    content?: Record<string, unknown>
  }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { artifactId, workspaceId, action, content } = body
  if (!artifactId || !workspaceId || !action)
    return NextResponse.json({ error: 'artifactId, workspaceId, action required' }, { status: 400 })

  if (!await assertMember(workspaceId, user.id))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  switch (action) {
    case 'review':
      await markArtifactReviewed(artifactId)
      break
    case 'approve':
      await approveArtifact(artifactId)
      break
    case 'execute':
      await markArtifactExecuted(artifactId)
      break
    case 'version': {
      if (!content) return NextResponse.json({ error: 'content required for version action' }, { status: 400 })
      const newVersion = await versionArtifact({ parentId: artifactId, content, updatedBy: `user:${user.id}` })
      return NextResponse.json(newVersion)
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const updated = await getArtifact(artifactId)
  return NextResponse.json(updated)
}
