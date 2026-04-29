'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

function extractToken(input: string): string {
  const match = input.match(/\/join\/([a-f0-9]{32})/i)
  if (match) return match[1]
  if (/^[a-f0-9]{32}$/i.test(input.trim())) return input.trim()
  return ''
}

export default function OnboardingPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [inviteInput, setInviteInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [joinError, setJoinError] = useState('')

  // Skip onboarding if user already belongs to a workspace
  useEffect(() => {
    async function checkExisting() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        const { data: membership } = await supabase
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user.id)
          .limit(1)
          .single()

        if (membership?.workspace_id) {
          router.replace(`/workspace/${membership.workspace_id}`)
          return
        }
      } catch {
        // .single() throws when no row — expected, just show the form
      } finally {
        setChecking(false)
      }
    }
    checkExisting()
  }, [router])

  async function create() {
    const trimmed = name.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const res = await fetch('/api/workspace/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          user_id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name ?? null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || `Error ${res.status}`)
      }

      const ws = await res.json()
      router.push(`/workspace/${ws.id}`)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function joinWithLink() {
    setJoinError('')
    const token = extractToken(inviteInput)
    if (!token) { setJoinError('Invalid invite link — paste the full URL or token'); return }
    router.push(`/join/${token}`)
  }

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700&family=DM+Sans:wght@300;400;500&display=swap"
        rel="stylesheet"
      />

      <div className="auth-root">
        <div className="bg-grid" />
        <div className="bg-glow" />

        <div className="auth-wrap">
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
            {checking ? (
              <div className="state-center">
                <div className="spinner" />
                <p>Loading your account…</p>
              </div>
            ) : (
              <>
                <div className="card-head">
                  <h1>Set up your workspace</h1>
                  <p>Create a new workspace or join one with an invite link</p>
                </div>

                <div className="form">
                  <div className="field">
                    <label htmlFor="ws-name">Workspace name</label>
                    <input
                      id="ws-name"
                      type="text"
                      value={name}
                      placeholder="e.g. Acme Co, My Projects…"
                      className={error ? 'input-error' : ''}
                      autoFocus
                      autoComplete="organization"
                      onChange={e => { setName(e.target.value); setError('') }}
                      onKeyDown={e => e.key === 'Enter' && create()}
                    />
                    {error && <span className="field-error">{error}</span>}
                  </div>

                  <button
                    className="btn-primary"
                    disabled={!name.trim() || loading}
                    onClick={create}
                  >
                    {loading ? <span className="spinner-btn" /> : 'Create workspace →'}
                  </button>
                </div>

                <div className="divider"><span>or join an existing one</span></div>

                <div className="join-section">
                  <label>Invite link or token</label>
                  <div className="join-row">
                    <input
                      type="text"
                      value={inviteInput}
                      placeholder="Paste invite link or token…"
                      onChange={e => { setInviteInput(e.target.value); setJoinError('') }}
                      onKeyDown={e => e.key === 'Enter' && joinWithLink()}
                    />
                    <button
                      className="btn-join"
                      disabled={!inviteInput.trim()}
                      onClick={joinWithLink}
                    >
                      Join
                    </button>
                  </div>
                  {joinError && <span className="field-error">{joinError}</span>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`body { margin: 0; padding: 0; }`}</style>

      <style>{`
        .auth-root {
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
        .auth-wrap {
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
        .state-center { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; padding: 12px 0; }
        .state-center p { font-size: 14px; color: #64748b; margin: 0; }
        .spinner {
          width: 28px; height: 28px; border-radius: 50%;
          border: 2px solid rgba(129,140,248,0.2); border-top-color: #818cf8;
          animation: spin 0.7s linear infinite;
        }
        .card-head { margin-bottom: 24px; }
        .card-head h1 { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 600; color: #f1f5f9; margin: 0 0 6px; letter-spacing: -0.02em; }
        .card-head p { font-size: 14px; color: #64748b; margin: 0; }
        .form { display: flex; flex-direction: column; gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        label { font-size: 13px; font-weight: 500; color: #94a3b8; }
        input {
          width: 100%; padding: 10px 14px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px; color: #f1f5f9; font-size: 14px;
          font-family: 'DM Sans', sans-serif; transition: border-color 0.15s;
          box-sizing: border-box; outline: none;
        }
        input:focus { border-color: #6366f1; }
        input.input-error { border-color: #f87171; }
        input::placeholder { color: #334155; }
        .field-error { font-size: 12px; color: #f87171; }
        .btn-primary {
          width: 100%; padding: 11px; background: #6366f1; color: white;
          border: none; border-radius: 10px; font-size: 14px; font-weight: 500;
          cursor: pointer; font-family: 'DM Sans', sans-serif; transition: background 0.15s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .btn-primary:hover:not(:disabled) { background: #4f46e5; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .spinner-btn {
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
          animation: spin 0.7s linear infinite; flex-shrink: 0;
        }
        .divider {
          display: flex; align-items: center; gap: 10px;
          margin: 22px 0 18px;
        }
        .divider::before, .divider::after {
          content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.07);
        }
        .divider span { font-size: 12px; color: #475569; white-space: nowrap; }
        .join-section { display: flex; flex-direction: column; gap: 8px; }
        .join-section label { font-size: 13px; font-weight: 500; color: #94a3b8; }
        .join-row { display: flex; gap: 8px; }
        .join-row input { flex: 1; }
        .btn-join {
          padding: 10px 16px; background: rgba(99,102,241,0.15);
          color: #818cf8; border: 1px solid rgba(99,102,241,0.3);
          border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500;
          white-space: nowrap; transition: all 0.15s; font-family: 'DM Sans', sans-serif;
        }
        .btn-join:hover:not(:disabled) { background: rgba(99,102,241,0.25); border-color: rgba(99,102,241,0.5); }
        .btn-join:disabled { opacity: 0.4; cursor: not-allowed; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
