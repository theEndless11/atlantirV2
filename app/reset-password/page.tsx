'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

type Step = 'request' | 'sent' | 'update' | 'done'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>('request')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [errors, setErrors] = useState({ email: '', newPassword: '', confirmPassword: '' })

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStep('update')
    })
  }, [])

  const strengthPct = useMemo(() => {
    let s = 0
    if (newPassword.length >= 8) s += 25
    if (/[A-Z]/.test(newPassword)) s += 25
    if (/[0-9]/.test(newPassword)) s += 25
    if (/[^A-Za-z0-9]/.test(newPassword)) s += 25
    return s
  }, [newPassword])

  const strengthColor = strengthPct <= 25 ? '#f87171' : strengthPct <= 50 ? '#fb923c' : strengthPct <= 75 ? '#facc15' : '#4ade80'

  async function requestReset() {
    if (!email.includes('@')) { setErrors(e => ({ ...e, email: 'Enter a valid email' })); return }
    setLoading(true); setAuthError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) setAuthError(error.message)
    else setStep('sent')
    setLoading(false)
  }

  async function updatePassword() {
    let ok = true
    const newErrors = { email: '', newPassword: '', confirmPassword: '' }
    if (newPassword.length < 8) { newErrors.newPassword = 'At least 8 characters'; ok = false }
    if (newPassword !== confirmPassword) { newErrors.confirmPassword = 'Passwords do not match'; ok = false }
    setErrors(newErrors)
    if (!ok) return
    setLoading(true); setAuthError('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setAuthError(error.message)
    else setStep('done')
    setLoading(false)
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
          {step === 'request' && (
            <>
              <div className="card-head">
                <h1>Reset password</h1>
                <p>Enter your email and we&apos;ll send a reset link</p>
              </div>
              <div className="form">
                <div className="field">
                  <label>Email</label>
                  <input value={email} onChange={e => { setEmail(e.target.value); setErrors(er => ({ ...er, email: '' })) }}
                    type="email" placeholder="you@company.com" className={errors.email ? 'input-error' : ''}
                    onKeyUp={e => e.key === 'Enter' && requestReset()} />
                  {errors.email && <span className="field-error">{errors.email}</span>}
                </div>
                {authError && <div className="alert-error">{authError}</div>}
                <button className="btn-primary" disabled={loading} onClick={requestReset}>
                  {loading ? <span className="spinner" /> : 'Send reset link'}
                </button>
              </div>
              <p className="switch-link"><Link href="/login">← Back to sign in</Link></p>
            </>
          )}

          {step === 'sent' && (
            <div className="sent-state">
              <div className="sent-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
                  <path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z"/>
                </svg>
              </div>
              <h2>Check your email</h2>
              <p>We sent a password reset link to <strong>{email}</strong>.</p>
              <p className="sub">Didn&apos;t receive it? Check your spam or <button className="link-btn" onClick={() => setStep('request')}>try again</button>.</p>
            </div>
          )}

          {step === 'update' && (
            <>
              <div className="card-head">
                <h1>Set new password</h1>
                <p>Choose a strong password for your account</p>
              </div>
              <div className="form">
                <div className="field">
                  <label>New password</label>
                  <div className="input-wrap">
                    <input value={newPassword} onChange={e => { setNewPassword(e.target.value); setErrors(er => ({ ...er, newPassword: '' })) }}
                      type={showPass ? 'text' : 'password'} placeholder="Min. 8 characters"
                      className={errors.newPassword ? 'input-error' : ''} />
                    <button className="eye-btn" tabIndex={-1} onClick={() => setShowPass(!showPass)}>
                      {!showPass
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      }
                    </button>
                  </div>
                  {newPassword && (
                    <div className="strength-bar">
                      <div className="strength-fill" style={{ width: strengthPct + '%', background: strengthColor }} />
                    </div>
                  )}
                  {errors.newPassword && <span className="field-error">{errors.newPassword}</span>}
                </div>
                <div className="field">
                  <label>Confirm password</label>
                  <input value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setErrors(er => ({ ...er, confirmPassword: '' })) }}
                    type={showPass ? 'text' : 'password'} placeholder="••••••••"
                    className={errors.confirmPassword ? 'input-error' : ''} />
                  {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
                </div>
                {authError && <div className="alert-error">{authError}</div>}
                <button className="btn-primary" disabled={loading} onClick={updatePassword}>
                  {loading ? <span className="spinner" /> : 'Update password'}
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="sent-state">
              <div className="sent-icon success">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.5">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <h2>Password updated</h2>
              <p>Your password has been changed successfully.</p>
              <Link href="/login" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block', padding: '11px 28px' }}>Sign in</Link>
            </div>
          )}
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
        .card { background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 36px; width: 100%; max-width: 400px; backdrop-filter: blur(16px); }
        .card-head { margin-bottom: 24px; }
        .card-head h1 { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 600; color: #f1f5f9; margin: 0 0 6px; letter-spacing: -0.02em; }
        .card-head p { font-size: 14px; color: #64748b; margin: 0; }
        .form { display: flex; flex-direction: column; gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        label { font-size: 13px; font-weight: 500; color: #94a3b8; }
        .input-wrap { position: relative; }
        input { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #f1f5f9; font-size: 14px; font-family: 'DM Sans', sans-serif; transition: border-color 0.15s; box-sizing: border-box; outline: none; }
        input:focus { border-color: #6366f1; }
        input.input-error { border-color: #f87171; }
        input::placeholder { color: #2d3748; }
        .input-wrap input { padding-right: 40px; }
        .eye-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #64748b; padding: 0; }
        .strength-bar { height: 3px; background: rgba(255,255,255,0.07); border-radius: 2px; margin-top: 6px; }
        .strength-fill { height: 100%; border-radius: 2px; transition: width 0.3s, background 0.3s; }
        .field-error { font-size: 12px; color: #f87171; }
        .alert-error { padding: 10px 14px; background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); border-radius: 8px; font-size: 13px; color: #fca5a5; }
        .btn-primary { width: 100%; padding: 11px; background: #6366f1; color: white; border: none; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: 'DM Sans', sans-serif; transition: background 0.15s; display: flex; align-items: center; justify-content: center; }
        .btn-primary:hover:not(:disabled) { background: #4f46e5; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; animation: spin 0.7s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .sent-state { text-align: center; padding: 12px 0; display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .sent-icon { width: 64px; height: 64px; background: rgba(99,102,241,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .sent-icon.success { background: rgba(74,222,128,0.1); }
        .sent-state h2 { font-family: 'Syne', sans-serif; font-size: 18px; color: #f1f5f9; margin: 0; }
        .sent-state p { font-size: 14px; color: #64748b; margin: 0; line-height: 1.6; }
        .sent-state strong { color: #94a3b8; }
        .sub { font-size: 13px !important; }
        .link-btn { background: none; border: none; color: #6366f1; cursor: pointer; font-size: 13px; padding: 0; font-family: 'DM Sans', sans-serif; }
        .link-btn:hover { color: #818cf8; }
        .switch-link { text-align: center; font-size: 13px; color: #64748b; margin: 20px 0 0; }
        .switch-link a { color: #6366f1; text-decoration: none; }
      `}</style>
    </div>
  )
}
