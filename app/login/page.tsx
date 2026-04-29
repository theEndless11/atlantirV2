'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [errors, setErrors] = useState({ email: '', password: '' })

  function validate() {
    const errs = { email: '', password: '' }
    let ok = true
    if (!email.includes('@')) { errs.email = 'Enter a valid email'; ok = false }
    if (password.length < 6) { errs.password = 'At least 6 characters'; ok = false }
    setErrors(errs)
    return ok
  }

  async function signIn() {
    if (!validate()) return
    setLoading(true); setAuthError('')
    const supabase = supabaseBrowser()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setAuthError(error.message); setLoading(false); return }
    router.replace('/')
  }

  async function signInGoogle() {
    setLoading(true)
    const supabase = supabaseBrowser()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }

  return (
    <div className="auth-page">
      <div className="bg-grid" />
      <div className="bg-glow" />
      <div className="auth-bg" />
      <div className="auth-card-wrap">
        <div className="brand">
          <div className="brand-icon">
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <rect x="2" y="2" width="11" height="11" rx="3" fill="#6366f1"/>
              <rect x="15" y="2" width="11" height="11" rx="3" fill="#6366f1" opacity="0.5"/>
              <rect x="2" y="15" width="11" height="11" rx="3" fill="#6366f1" opacity="0.5"/>
              <rect x="15" y="15" width="11" height="11" rx="3" fill="#6366f1" opacity="0.25"/>
            </svg>
          </div>
          <span>Atlantir</span>
        </div>

        <div className="auth-card">
          <h1>Welcome back</h1>
          <p>Sign in to your workspace</p>

          <button className="btn-google" disabled={loading} onClick={signInGoogle}>
            <svg width="17" height="17" viewBox="0 0 18 18">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="auth-divider"><span>or</span></div>

          <div className="field">
            <label>Email</label>
            <input
              className={`input${errors.email ? ' input-error' : ''}`}
              type="email" placeholder="you@company.com"
              value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })) }}
            />
            {errors.email && <span className="field-error-msg">{errors.email}</span>}
          </div>

          <div className="field">
            <div className="field-top-row">
              <label>Password</label>
              <Link href="/reset-password" className="forgot">Forgot?</Link>
            </div>
            <div className="input-wrap">
              <input
                className={`input${errors.password ? ' input-error' : ''}`}
                type={showPass ? 'text' : 'password'} placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })) }}
                onKeyDown={e => e.key === 'Enter' && signIn()}
              />
              <button className="eye-btn" tabIndex={-1} onClick={() => setShowPass(v => !v)}>
                {!showPass
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                }
              </button>
            </div>
            {errors.password && <span className="field-error-msg">{errors.password}</span>}
          </div>

          {authError && <div className="alert-error">{authError}</div>}

          <button className="btn btn-primary full-btn" disabled={loading} onClick={signIn}>
            {loading ? <span className="spinner" /> : 'Sign in'}
          </button>

          <p className="switch-link">No account? <Link href="/register">Create one free →</Link></p>
        </div>
      </div>

      <style>{`
        .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #080b12; position: relative; overflow: hidden; }
        .bg-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 48px 48px; pointer-events: none; }
        .bg-glow { position: absolute; width: 700px; height: 700px; border-radius: 50%; background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 65%); top: -200px; left: 50%; transform: translateX(-50%); pointer-events: none; }
        .auth-bg { position: absolute; inset: 0; background: radial-gradient(ellipse 60% 50% at 50% -20%, rgba(99,102,241,.12), transparent); pointer-events: none; }
        .auth-card-wrap { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 24px; width: 100%; max-width: 400px; padding: 24px 16px; }
        .brand { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; color: #f1f5f9; }
        .brand-icon { display: flex; }
        .auth-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 32px; width: 100%; display: flex; flex-direction: column; gap: 16px; }
        .auth-card h1 { font-size: 20px; font-weight: 600; color: #f1f5f9; margin: 0; }
        .auth-card > p { font-size: 14px; color: #64748b; margin: -8px 0 0; }
        .btn-google { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 9px 16px; border: 1.5px solid rgba(255,255,255,0.1); border-radius: 8px; background: rgba(255,255,255,0.05); color: #e2e8f0; font-size: 14px; font-weight: 500; cursor: pointer; }
        .btn-google:hover:not(:disabled) { background: rgba(255,255,255,0.09); }
        .btn-google:disabled { opacity: .5; cursor: not-allowed; }
        .auth-divider { display: flex; align-items: center; gap: 12px; }
        .auth-divider::before, .auth-divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
        .auth-divider span { font-size: 12px; color: #475569; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        .field-top-row { display: flex; justify-content: space-between; align-items: center; }
        label { font-size: 13px; font-weight: 500; color: #94a3b8; }
        .forgot { font-size: 12px; color: #6366f1; text-decoration: none; }
        .input-wrap { position: relative; }
        .input { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #f1f5f9; font-size: 14px; box-sizing: border-box; outline: none; }
        .input:focus { border-color: #6366f1; }
        .input-error { border-color: #f87171 !important; }
        .input::placeholder { color: #2d3748; }
        .input-wrap .input { padding-right: 40px; }
        .eye-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #64748b; display: flex; }
        .field-error-msg { font-size: 12px; color: #f87171; }
        .alert-error { padding: 10px 12px; background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); border-radius: 8px; font-size: 13px; color: #fca5a5; }
        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; }
        .btn-primary { background: #6366f1; color: #fff; }
        .btn-primary:hover:not(:disabled) { background: #4f46e5; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .full-btn { width: 100%; padding: 10px; }
        .spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; animation: spin 0.7s linear infinite; display: inline-block; }
        .switch-link { text-align: center; font-size: 13px; color: #64748b; margin: 0; }
        .switch-link :global(a) { color: #6366f1; font-weight: 500; text-decoration: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
