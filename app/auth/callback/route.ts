import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const response = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        }
      }
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const user = data.session.user
  const meta = user.user_metadata

  // Upsert user profile (mirrors the Nuxt callback)
  await supabase.from('users').upsert({
    id: user.id,
    email: user.email,
    full_name: meta?.full_name || null,
    avatar_url: meta?.avatar_url || null,
  })

  // If user was invited to a workspace via metadata (email invite flow)
  if (meta?.invited_to_workspace) {
    const { data: existing } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', meta.invited_to_workspace)
      .eq('user_id', user.id)
      .single()

    if (!existing) {
      await supabase.from('workspace_members').insert({
        workspace_id: meta.invited_to_workspace,
        user_id: user.id,
        role: meta.invited_role || 'member'
      })
    }

    return NextResponse.redirect(`${origin}/workspace/${meta.invited_to_workspace}`)
  }

  // Normal flow: find existing workspace or go to onboarding
  const { data: ws } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .order('created_at')
    .limit(1)
    .single()

  if (ws) {
    return NextResponse.redirect(`${origin}/workspace/${ws.workspace_id}`)
  }

  return NextResponse.redirect(`${origin}/onboarding`)
}
