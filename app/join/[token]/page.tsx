'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

interface WorkspaceInfo {
  id: string
  name: string
  member_count: number
}

type State = 'loading' | 'error' | 'guest' | 'confirm' | 'joining' | 'success'

export default function JoinPage() {
  const params = useParams()
  const router = useRouter()
  const token = Array.isArray(params.token) ? params.token[0] : (params.token as string)

  const [state, setState] = useState<State>('loading')
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [error, setError] = useState('')

  // Email/password form for guests
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  useEffect(() => {
    async function init() {
      // 1. Fetch workspace info from the invite token
      let ws: WorkspaceInfo
      try {
        const res = await fetch(`/api/workspace/invite-info?token=${token}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.message || 'Invalid invite link')
        }
        ws = await res.json()
        setWorkspace(ws)
      } catch (e: any) {
        setError(e?.message || 'This invite link is invalid or has expired')
        setState('error')
        return
      }

      // 2. Check if a user session exists
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Not logged in — show sign-in / sign-up form
        setState('guest')
        return
      }

      setUserEmail(user.email ?? '')

      // 3. Logged in — attempt to join immediately (server handles already-member gracefully)
      await joinAsUser(user.id, user.email ?? '', user.user_metadata?.full_name ?? null, ws)
    }
    init()
  }, [token])

  // ── Core join call ──────────────────────────────────────────────────────────
  async function joinAsUser(
    userId: string,
    userEmailArg: string,
    fullName: string | null,
    ws: WorkspaceInfo
  ) {
    setState('joining')
    try {
      const res = await fetch('/api/workspace/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, user_id: userId, email: userEmailArg, full_name: fullName }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || 'Failed to join workspace')
      }
      // Success — either joined fresh or already_member: both land in workspace
      setState('success')
    } catch (e: any) {
      setAuthError(e?.message || 'Failed to join workspace')
      setState('confirm') // fall back to confirm view so user can retry
    }
  }

  // ── Guest: sign in with email+password then join ────────────────────────────
  async function signInAndJoin() {
    if (!email || !password || !workspace) return
    setAuthLoading(true)
    setAuthError('')
    const supabase = createClient()

    let userId: string
    let userFullName: string | null = null

    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })

    if (signInErr) {
      // Try sign up instead
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({ email, password })
      if (signUpErr || !signUpData.user) {
        setAuthError(signUpErr?.message ?? 'Sign-up failed')
        setAuthLoading(false)
        return
      }
      userId = signUpData.user.id
      userFullName = signUpData.user.user_metadata?.full_name ?? null
    } else {
      userId = signInData.user!.id
      userFullName = signInData.user!.user_metadata?.full_name ?? null
    }

    setUserEmail(email)
    setAuthLoading(false)
    await joinAsUser(userId, email, userFullName, workspace)
  }

  // ── Guest: Google OAuth — store token, redirect through callback ────────────
  async function signInWithGoogle() {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('pending_invite_token', token)
    }
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const wsInitials = workspace?.name.slice(0, 2).toUpperCase() ?? '??'

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700&family=DM+Sans:wght@300;400;500&display=swap"
        rel="stylesheet"
      />

      <div className="join-root">
        <div className="bg-grid" />
        <div className="bg-glow" />

        <div className="join-wrap">
          {/* Brand */}
          <div className="brand">
            <div className="brand-mark">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="2"  y="2"  width="11" height="11" rx="3" fill="currentColor" />
                <rect x="15" y="2"  width="11" height="11" rx="3" fill="currentColor" opacity="0.5" />
                <rect x="2"  y="15" width="11" height="11" rx="3" fill="currentColor" opacity="0.5" />
                <rect x="15" y="15" width="11" height="11" rx="3" fill="currentColor" opacity="0.25" />
              </svg>
            </div>
            <span className="brand-name">Atlantir</span>
          </div>

          <div className="card">

            {/* ── Loading ── */}
            {(state === 'loading' || state === 'joining') && (
              <div className="state-center">
                <div className="spinner" />
                <p>{state === 'joining' ? 'Joining workspace…' : 'Loading invite…'}</p>
              </div>
            )}

            {/* ── Error ── */}
            {state === 'error' && (
              <div className="state-center">
                <div className="state-icon error-icon">✕</div>
                <h2>Invalid invite</h2>
                <p>{error}</p>
                <Link href="/login" className="btn-primary">Go to login</Link>
              </div>
            )}

            {/* ── Guest: not logged in ── */}
            {state === 'guest' && workspace && (
              <div className="join-content">
                <div className="workspace-badge">
                  <div className="ws-avatar">{wsInitials}</div>
                  <div>
                    <div className="ws-name">{workspace.name}</div>
                    <div className="ws-meta">
                      {workspace.member_count} member{workspace.member_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                <h2>You've been invited</h2>
                <p>Sign in or create an account to join <strong>{workspace.name}</strong></p>

                <div className="auth-form">
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && signInAndJoin()}
                    autoComplete="current-password"
                  />
                  {authError && <p className="field-error">{authError}</p>}
                  <button
                    className="btn-primary"
                    disabled={!email || !password || authLoading}
                    onClick={signInAndJoin}
                  >
                    {authLoading ? <span className="spinner-btn" /> : 'Sign in & join workspace'}
                  </button>

                  <div className="divider"><span>or</span></div>

                  <button className="btn-google" onClick={signInWithGoogle}>
                    <svg width="16" height="16" viewBox="0 0 18 18">
                      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                  </button>
                </div>
              </div>
            )}

            {/* ── Confirm (logged in, not yet joined) ── */}
            {state === 'confirm' && workspace && (
              <div className="join-content">
                <div className="workspace-badge">
                  <div className="ws-avatar">{wsInitials}</div>
                  <div>
                    <div className="ws-name">{workspace.name}</div>
                    <div className="ws-meta">
                      {workspace.member_count} member{workspace.member_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                <h2>Join workspace?</h2>
                <p>You're joining as <strong>{userEmail}</strong></p>

                {authError && <p className="field-error" style={{ marginBottom: 12 }}>{authError}</p>}

                <button
                  className="btn-primary"
                  onClick={async () => {
                    const supabase = createClient()
                    const { data: { user } } = await supabase.auth.getUser()
                    if (user && workspace) {
                      await joinAsUser(user.id, user.email ?? '', user.user_metadata?.full_name ?? null, workspace)
                    }
                  }}
                >
                  Join {workspace.name}
                </button>
              </div>
            )}

            {/* ── Success ── */}
            {state === 'success' && workspace && (
              <div className="state-center">
                <div className="state-icon success-icon">✓</div>
                <h2>You're in!</h2>
                <p>Welcome to <strong style={{ color: '#94a3b8' }}>{workspace.name}</strong></p>
                <Link href={`/workspace/${workspace.id}`} className="btn-primary">
                  Open workspace
                </Link>
              </div>
            )}

          </div>
        </div>
      </div>

      <style>{`body { margin: 0; padding: 0; }`}</style>

      <style>{`
        .join-root {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          background: #080b12; font-family: 'DM Sans', sans-serif;
          position: relative; overflow: hidden;
        }
        .bg-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .bg-glow {
          position: absolute; width: 700px; height: 700px; border-radius: 50%;
          background: radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 65%);
          top: -200px; left: 50%; transform: translateX(-50%); pointer-events: none;
        }
        .join-wrap {
          position: relative; z-index: 1;
          display: flex; flex-direction: column; align-items: center; gap: 28px;
          width: 100%; padding: 24px; box-sizing: border-box;
        }
        .brand { display: flex; align-items: center; gap: 10px; color: white; }
        .brand-mark { color: #818cf8; }
        .brand-name { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }

        .card {
          background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px; padding: 36px; width: 100%; max-width: 420px;
          backdrop-filter: blur(16px); box-sizing: border-box;
        }

        /* Centered state layouts */
        .state-center {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; text-align: center;
        }
        .state-center p { font-size: 14px; color: #64748b; margin: 0; }
        .state-center h2 { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 600; color: #f1f5f9; margin: 0; }

        .state-icon {
          width: 52px; height: 52px; border-radius: 50%;
          font-size: 22px; display: flex; align-items: center; justify-content: center;
        }
        .error-icon   { background: rgba(239,68,68,0.15);  color: #f87171; }
        .success-icon { background: rgba(16,185,129,0.15); color: #34d399; }

        .spinner {
          width: 28px; height: 28px; border-radius: 50%;
          border: 2px solid rgba(129,140,248,0.2); border-top-color: #818cf8;
          animation: spin 0.7s linear infinite;
        }

        /* Join content */
        .join-content { display: flex; flex-direction: column; }
        .join-content h2 { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 600; color: #f1f5f9; margin: 0 0 6px; }
        .join-content > p { font-size: 14px; color: #64748b; margin: 0 0 20px; }
        .join-content strong { color: #94a3b8; }

        /* Workspace badge */
        .workspace-badge {
          display: flex; align-items: center; gap: 12px; padding: 14px;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px; margin-bottom: 20px;
        }
        .ws-avatar {
          width: 42px; height: 42px; border-radius: 10px; background: #6366f1;
          color: white; font-size: 16px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .ws-name { font-size: 15px; font-weight: 600; color: #f1f5f9; }
        .ws-meta { font-size: 12px; color: #64748b; margin-top: 2px; }

        /* Auth form */
        .auth-form { display: flex; flex-direction: column; gap: 10px; }

        input {
          width: 100%; padding: 10px 14px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; color: #f1f5f9; font-size: 14px;
          font-family: 'DM Sans', sans-serif; box-sizing: border-box; outline: none;
          transition: border-color 0.15s;
        }
        input:focus { border-color: #6366f1; }
        input::placeholder { color: #334155; }

        .field-error { font-size: 12px; color: #f87171; margin: 0; }

        .btn-primary {
          width: 100%; padding: 11px; background: #6366f1; color: white;
          border: none; border-radius: 10px; font-size: 14px; font-weight: 500;
          cursor: pointer; font-family: 'DM Sans', sans-serif; text-decoration: none;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: background 0.15s; box-sizing: border-box;
        }
        .btn-primary:hover:not(:disabled) { background: #4f46e5; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .divider { display: flex; align-items: center; gap: 10px; }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
        .divider span { font-size: 12px; color: #475569; }

        .btn-google {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 10px; border-radius: 10px;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
          color: #e2e8f0; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif;
          transition: background 0.15s;
        }
        .btn-google:hover { background: rgba(255,255,255,0.1); }

        .spinner-btn {
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
          animation: spin 0.7s linear infinite; flex-shrink: 0;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}