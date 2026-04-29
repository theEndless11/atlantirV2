'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function NoWorkspacePage() {
  const router = useRouter()
  const supabase = createClient()
  const [inviteInput, setInviteInput] = useState('')
  const [joinError, setJoinError] = useState('')

  function extractToken(input: string): string {
    const match = input.match(/\/join\/([a-f0-9]{32})/i)
    if (match) return match[1]
    if (/^[a-f0-9]{32}$/i.test(input.trim())) return input.trim()
    return ''
  }

  function joinWithLink() {
    setJoinError('')
    const token = extractToken(inviteInput)
    if (!token) { setJoinError('Invalid invite link — paste the full URL'); return }
    router.push(`/join/${token}`)
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
    })
  }, [])

  return (
    <div className="auth-root">
      <div className="bg-grid" />
      <div className="bg-glow" />
      <div className="auth-wrap">
        <div className="brand">
          <div className="brand-mark">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="2" width="11" height="11" rx="3" fill="currentColor"/>
              <rect x="15" y="2" width="11" height="11" rx="3" fill="currentColor" opacity="0.5"/>
              <rect x="2" y="15" width="11" height="11" rx="3" fill="currentColor" opacity="0.5"/>
              <rect x="15" y="15" width="11" height="11" rx="3" fill="currentColor" opacity="0.25"/>
            </svg>
          </div>
          <span className="brand-name">Atlantir</span>
        </div>

        <div className="card">
          <div className="card-head">
            <h1>No workspace found</h1>
            <p>You don&apos;t have access to any workspace. Create one or join with an invite link.</p>
          </div>

          <div className="options">
            <Link href="/onboarding" className="option-card">
              <div className="option-icon">✦</div>
              <div className="option-info">
                <div className="option-title">Create a workspace</div>
                <div className="option-desc">Start fresh with your own workspace</div>
              </div>
              <div className="option-arrow">→</div>
            </Link>

            <div className="divider"><span>or</span></div>

            <div className="join-input">
              <label>Join with invite link</label>
              <div className="join-row">
                <input
                  value={inviteInput}
                  onChange={e => setInviteInput(e.target.value)}
                  type="text"
                  placeholder="Paste invite link or token..."
                  onKeyUp={e => e.key === 'Enter' && joinWithLink()}
                />
                <button className="btn-join" disabled={!inviteInput.trim()} onClick={joinWithLink}>
                  Join
                </button>
              </div>
              {joinError && <p className="join-error">{joinError}</p>}
            </div>
          </div>

          <button className="btn-signout" onClick={signOut}>Sign out</button>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700&family=DM+Sans:wght@300;400;500&display=swap');
        .auth-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #080b12; font-family: 'DM Sans', sans-serif; position: relative; overflow: hidden; }
        .bg-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 48px 48px; }
        .bg-glow { position: absolute; width: 700px; height: 700px; border-radius: 50%; background: radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 65%); top: -200px; left: 50%; transform: translateX(-50%); pointer-events: none; }
        .auth-wrap { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 28px; width: 100%; padding: 24px; }
        .brand { display: flex; align-items: center; gap: 10px; color: white; }
        .brand-mark { color: #818cf8; }
        .brand-name { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
        .card { background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 36px; width: 100%; max-width: 420px; backdrop-filter: blur(16px); }
        .card-head { margin-bottom: 28px; }
        .card-head h1 { font-family: 'Syne', sans-serif; font-size: 20px; font-weight: 600; color: #f1f5f9; margin: 0 0 6px; letter-spacing: -0.02em; }
        .card-head p { font-size: 14px; color: #64748b; margin: 0; line-height: 1.5; }
        .options { display: flex; flex-direction: column; gap: 16px; }
        .option-card { display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; text-decoration: none; transition: border-color 0.15s, background 0.15s; }
        .option-card:hover { border-color: rgba(99,102,241,0.4); background: rgba(99,102,241,0.08); }
        .option-icon { font-size: 20px; width: 36px; height: 36px; background: rgba(99,102,241,0.15); border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .option-info { flex: 1; }
        .option-title { font-size: 14px; font-weight: 500; color: #f1f5f9; }
        .option-desc { font-size: 12px; color: #64748b; margin-top: 2px; }
        .option-arrow { color: #64748b; font-size: 16px; }
        .divider { display: flex; align-items: center; gap: 10px; }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
        .divider span { font-size: 12px; color: #64748b; }
        .join-input { display: flex; flex-direction: column; gap: 8px; }
        .join-input label { font-size: 13px; font-weight: 500; color: #94a3b8; }
        .join-row { display: flex; gap: 8px; }
        .join-row input { flex: 1; padding: 9px 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #f1f5f9; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none; }
        .join-row input:focus { border-color: #6366f1; }
        .join-row input::placeholder { color: #2d3748; }
        .btn-join { padding: 9px 16px; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; white-space: nowrap; }
        .btn-join:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-join:hover:not(:disabled) { background: #4f46e5; }
        .join-error { font-size: 12px; color: #f87171; margin: 0; }
        .btn-signout { width: 100%; margin-top: 20px; padding: 9px; background: none; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #64748b; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; }
        .btn-signout:hover { border-color: rgba(255,255,255,0.15); color: #94a3b8; }
      `}</style>
    </div>
  )
}
