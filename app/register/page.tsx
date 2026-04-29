'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'

function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [sent, setSent] = useState(false)
  const [errors, setErrors] = useState({ fullName: '', email: '', password: '' })

  const strengthPct = useMemo(() => {
    let s = 0
    if (password.length >= 8) s += 25
    if (/[A-Z]/.test(password)) s += 25
    if (/[0-9]/.test(password)) s += 25
    if (/[^A-Za-z0-9]/.test(password)) s += 25
    return s
  }, [password])

  const strengthColor = useMemo(() => {
    if (strengthPct <= 25) return '#f87171'
    if (strengthPct <= 50) return '#fb923c'
    if (strengthPct <= 75) return '#facc15'
    return '#4ade80'
  }, [strengthPct])

  function validate() {
    const errs = { fullName: '', email: '', password: '' }
    let ok = true
    if (!fullName.trim()) { errs.fullName = 'Name is required'; ok = false }
    if (!email.includes('@')) { errs.email = 'Enter a valid email'; ok = false }
    if (password.length < 8) { errs.password = 'At least 8 characters'; ok = false }
    setErrors(errs)
    return ok
  }

  async function signUp() {
    if (!validate()) return
    setLoading(true); setAuthError('')
    const supabase = supabaseBrowser()
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) setAuthError(error.message)
    else setSent(true)
    setLoading(false)
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
            <h1>Create your account</h1>
            <p>Start working with your AI team today</p>
          </div>

          <button className="btn-google" disabled={loading} onClick={signInGoogle}>
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            Sign up with Google
          </button>

          <div className="divider"><span>or</span></div>

          {!sent ? (
            <div className="form">
              <div className="field">
                <label>Full name</label>
                <input type="text" placeholder="Alex Johnson"
                  className={errors.fullName ? 'input-error' : ''}
                  value={fullName} onChange={e => { setFullName(e.target.value); setErrors(p => ({ ...p, fullName: '' })) }}
                />
                {errors.fullName && <span className="field-error">{errors.fullName}</span>}
              </div>

              <div className="field">
                <label>Work email</label>
                <input type="email" placeholder="you@company.com"
                  className={errors.email ? 'input-error' : ''}
                  value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })) }}
                />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>

              <div className="field">
                <label>Password</label>
                <div className="input-wrap">
                  <input type={showPass ? 'text' : 'password'} placeholder="Min. 8 characters"
                    className={errors.password ? 'input-error' : ''}
                    value={password} onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })) }}
                  />
                  <button className="eye-btn" tabIndex={-1} onClick={() => setShowPass(v => !v)}>
                    {!showPass
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    }
                  </button>
                </div>
                {password && (
                  <div className="strength-bar">
                    <div className="strength-fill" style={{ width: `${strengthPct}%`, background: strengthColor }} />
                  </div>
                )}
                {errors.password && <span className="field-error">{errors.password}</span>}
              </div>

              {authError && <div className="alert-error">{authError}</div>}

              <button className="btn-primary" disabled={loading} onClick={signUp}>
                {loading ? <span className="spinner" /> : 'Create account'}
              </button>

              <p className="terms">By signing up you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.</p>
            </div>
          ) : (
            <div className="sent-state">
              <div className="sent-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
                  <path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"/>
                </svg>
              </div>
              <h2>Check your inbox</h2>
              <p>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
              <button className="btn-outline" onClick={() => setSent(false)}>Use a different email</button>
            </div>
          )}

          {!sent && <p className="switch-link">Already have an account? <Link href="/login">Sign in</Link></p>}
        </div>
      </div>

      <style>{`
        .auth-root { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #080b12; position: relative; overflow: hidden; font-family: 'DM Sans', sans-serif; }
        .bg-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 48px 48px; }
        .bg-glow { position: absolute; width: 700px; height: 700px; border-radius: 50%; background: radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 65%); top: -200px; left: 50%; transform: translateX(-50%); pointer-events: none; }
        .auth-wrap { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 28px; width: 100%; padding: 24px; }
        .brand { display: flex; align-items: center; gap: 10px; color: white; }
        .brand-mark { color: #818cf8; }
        .brand-name { font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
        .card { background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 36px; width: 100%; max-width: 400px; backdrop-filter: blur(16px); }
        .card-head { margin-bottom: 24px; }
        .card-head h1 { font-size: 22px; font-weight: 600; color: #f1f5f9; margin: 0 0 6px; letter-spacing: -0.02em; }
        .card-head p { font-size: 14px; color: #64748b; margin: 0; }
        .btn-google { width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 11px; border-radius: 10px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0; font-size: 14px; font-weight: 500; cursor: pointer; }
        .btn-google:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
        .btn-google:disabled { opacity: 0.5; cursor: not-allowed; }
        .divider { display: flex; align-items: center; gap: 12px; margin: 20px 0; }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
        .divider span { font-size: 12px; color: #475569; }
        .form { display: flex; flex-direction: column; gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        label { font-size: 13px; font-weight: 500; color: #94a3b8; }
        .input-wrap { position: relative; }
        input { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #f1f5f9; font-size: 14px; box-sizing: border-box; outline: none; }
        input:focus { border-color: #6366f1; }
        input.input-error { border-color: #f87171; }
        input::placeholder { color: #2d3748; }
        .input-wrap input { padding-right: 40px; }
        .eye-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #64748b; padding: 0; }
        .strength-bar { height: 3px; background: rgba(255,255,255,0.07); border-radius: 2px; margin-top: 6px; }
        .strength-fill { height: 100%; border-radius: 2px; transition: width 0.3s, background 0.3s; }
        .field-error { font-size: 12px; color: #f87171; }
        .alert-error { padding: 10px 14px; background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); border-radius: 8px; font-size: 13px; color: #fca5a5; }
        .btn-primary { width: 100%; padding: 11px; background: #6366f1; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .btn-primary:hover:not(:disabled) { background: #4f46e5; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; animation: spin 0.7s linear infinite; }
        .terms { font-size: 11px; color: #475569; text-align: center; margin: 0; }
        .terms a { color: #6366f1; text-decoration: none; }
        .sent-state { text-align: center; padding: 12px 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .sent-icon { width: 64px; height: 64px; background: rgba(99,102,241,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .sent-state h2 { font-size: 18px; color: #f1f5f9; margin: 0; }
        .sent-state p { font-size: 14px; color: #64748b; margin: 0; line-height: 1.6; }
        .sent-state strong { color: #94a3b8; }
        .btn-outline { padding: 9px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #94a3b8; font-size: 13px; cursor: pointer; }
        .switch-link { text-align: center; font-size: 13px; color: #64748b; margin: 20px 0 0; }
        .switch-link :global(a) { color: #6366f1; text-decoration: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
