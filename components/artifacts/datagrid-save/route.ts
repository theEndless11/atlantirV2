/**
 * app/api/artifacts/datagrid-save/route.ts
 *
 * PATCH { artifactId, workspaceId, content: DataGridContent }
 *   → updates the artifact's content in Supabase and bumps updated_at
 *
 * Called automatically (fire-and-forget) whenever the user edits a cell,
 * resizes a column, or triggers an AI transformation in DataGridRenderer.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { DataGridContent } from '@/types'

export async function PATCH(req: Request) {
  try {
    const { artifactId, workspaceId, content } = await req.json() as {
      artifactId: string
      workspaceId: string
      content: DataGridContent
    }

    if (!artifactId || !workspaceId || !content) {
      return NextResponse.json(
        { error: 'artifactId, workspaceId, and content are required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin()
      .from('artifacts')
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', artifactId)
      .eq('workspace_id', workspaceId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}