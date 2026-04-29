'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444']

function avatarColor(email?: string) {
  if (!email) return AVATAR_COLORS[0]
  return AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length]
}

function initials(u: any) {
  if (!u) return '?'
  const name = u.full_name || u.email || ''
  return name.split(/[\s@]/).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function SettingsPage() {
  const { id: workspaceId } = useParams<{ id: string }>()
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [workspaceName, setWorkspaceName] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [inviteEnabled, setInviteEnabled] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState('')
  const [inviteError, setInviteError] = useState(false)
  const [userId, setUserId] = useState<string>()

  const inviteUrl = useMemo(() =>
    inviteToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${inviteToken}` : '',
    [inviteToken]
  )

  const isOwner = useMemo(() =>
    members.find(m => m.user_id === userId)?.role === 'owner',
    [members, userId]
  )

  async function loadData() {
    setLoading(true)
    const sb = supabaseBrowser()
    const { data: { session } } = await sb.auth.getSession()
    setUserId(session?.user.id)

    const { data: ws } = await sb
      .from('workspaces')
      .select('name, invite_token, invite_enabled')
      .eq('id', workspaceId).single()

    if (ws) {
      setWorkspaceName(ws.name)
      setInviteToken(ws.invite_token || '')
      setInviteEnabled(ws.invite_enabled ?? true)
      if (!ws.invite_token) await regenLink(true)
    }

    const res = await fetch(`/api/workspace/members?workspace_id=${workspaceId}`)
    if (res.ok) setMembers(await res.json())
    setLoading(false)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function regenLink(silent = false) {
    if (!silent && !confirm('Regenerate invite link? The old link will stop working.')) return
    const res = await fetch('/api/workspace/invite-manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, action: 'regenerate' })
    })
    if (res.ok) {
      const data = await res.json()
      setInviteToken(data.invite_token)
      setInviteEnabled(true)
    }
  }

  async function toggleInvite() {
    const action = inviteEnabled ? 'disable' : 'enable'
    await fetch('/api/workspace/invite-manage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, action })
    })
    setInviteEnabled(v => !v)
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) return
    setInviting(true); setInviteResult(''); setInviteError(false)
    const res = await fetch('/api/workspace/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, email: inviteEmail.trim(), role: inviteRole, invited_by: userId })
    })
    const data = await res.json()
    if (res.ok) {
      setInviteResult(data.message)
      setInviteEmail('')
      await loadData()
    } else {
      setInviteResult(data.message || 'Failed to invite')
      setInviteError(true)
    }
    setInviting(false)
  }

  async function removeMember(memberId: string) {
    if (!confirm('Remove this member from the workspace?')) return
    const res = await fetch('/api/workspace/remove-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, user_id: memberId, requester_id: userId })
    })
    if (res.ok) setMembers(m => m.filter(x => x.user_id !== memberId))
    else alert((await res.json()).message || 'Failed to remove')
  }

  useEffect(() => { loadData() }, [workspaceId])

  return (
    <div className="settings-shell">
      <div className="settings-wrap">
        <div className="settings-header">
          <div className="ws-name-block">
            <div className="ws-avatar">{workspaceName.slice(0, 2).toUpperCase()}</div>
            <div>
              <h1>{workspaceName}</h1>
              <code className="ws-id">{workspaceId}</code>
            </div>
          </div>
        </div>

        {/* Invite link */}
        <div className="settings-card">
          <div className="card-header">
            <div>
              <div className="card-title">Invite link</div>
              <div className="card-sub">Anyone with this link can join as a member</div>
            </div>
            <div className="toggle-wrap">
              <span className="toggle-label">{inviteEnabled ? 'Active' : 'Disabled'}</span>
              <button className={`toggle${inviteEnabled ? ' on' : ''}`} onClick={toggleInvite}>
                <span className="toggle-knob" />
              </button>
            </div>
          </div>

          {inviteEnabled && inviteToken ? (
            <div className="link-box">
              <div className="link-url">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                <span>{inviteUrl}</span>
              </div>
              <div className="link-actions">
                <button className="btn btn-primary" onClick={copyLink}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
                <button className="btn btn-ghost" onClick={() => regenLink(false)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                  Regenerate
                </button>
              </div>
            </div>
          ) : inviteEnabled ? (
            <div className="link-generating">
              <div className="spinner" /> Generating link…
            </div>
          ) : (
            <p className="link-disabled">Invite link is disabled. Toggle on to allow link-based joining.</p>
          )}
        </div>

        {/* Members */}
        <div className="settings-card">
          <div className="card-header">
            <div>
              <div className="card-title">Members</div>
              <div className="card-sub">{members.length} member{members.length !== 1 ? 's' : ''} in this workspace</div>
            </div>
            <button className="btn btn-primary" onClick={() => setShowInvite(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Invite by email
            </button>
          </div>

          <div className="members-list">
            {loading ? (
              <div className="members-loading"><div className="spinner" /> Loading members…</div>
            ) : members.length === 0 ? (
              <div className="members-empty">No members found</div>
            ) : members.map(member => (
              <div key={member.id} className="member-row">
                <div className="member-avatar" style={{ background: avatarColor(member.user?.email) }}>
                  {initials(member.user)}
                </div>
                <div className="member-info">
                  <span className="member-name">{member.user?.full_name || member.user?.email || 'Unknown'}</span>
                  <span className="member-email">{member.user?.email}</span>
                </div>
                <span className={`role-badge role-${member.role}`}>{member.role}</span>
                {member.role !== 'owner' && isOwner && (
                  <button className="btn btn-ghost remove-btn" onClick={() => removeMember(member.user_id)}>Remove</button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="modal-backdrop" onClick={() => setShowInvite(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <span>Invite by email</span>
              <button className="btn-icon" onClick={() => setShowInvite(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>Email address</label>
                <input
                  className="input" type="email" placeholder="colleague@company.com"
                  value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendInvite()}
                />
              </div>
              <div className="field">
                <label>Role</label>
                <select className="input select" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  <option value="member">Member — can view and run tasks</option>
                  <option value="viewer">Viewer — read only</option>
                </select>
              </div>
              {inviteResult && (
                <div className={`invite-result${inviteError ? ' error' : ''}`}>{inviteResult}</div>
              )}
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={() => setShowInvite(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={!inviteEmail.trim() || inviting} onClick={sendInvite}>
                {inviting ? <span className="spinner" /> : 'Send invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .settings-shell { background: var(--bg, #0f1117); min-height: 100%; padding: 24px; }
        .settings-wrap { max-width: 660px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
        .settings-header { padding-bottom: 4px; }
        .ws-name-block { display: flex; align-items: center; gap: 14px; }
        .ws-avatar { width: 48px; height: 48px; border-radius: 12px; background: #6366f1; color: #fff; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .settings-header h1 { font-size: 20px; font-weight: 600; color: var(--text-1, #f1f5f9); margin: 0 0 3px; }
        .ws-id { font-size: 11px; color: var(--text-3, #64748b); font-family: monospace; background: rgba(255,255,255,0.06); padding: 2px 7px; border-radius: 4px; }

        .settings-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; overflow: hidden; }
        .card-header { display: flex; align-items: flex-start; justify-content: space-between; padding: 18px 20px; gap: 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .card-title { font-size: 14px; font-weight: 600; color: var(--text-1, #f1f5f9); margin-bottom: 3px; }
        .card-sub { font-size: 13px; color: var(--text-2, #94a3b8); }

        .toggle-wrap { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .toggle-label { font-size: 12px; color: var(--text-3, #64748b); }
        .toggle { width: 40px; height: 22px; border-radius: 11px; background: rgba(255,255,255,0.1); border: none; cursor: pointer; position: relative; transition: background .2s; padding: 0; }
        .toggle.on { background: #6366f1; }
        .toggle-knob { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .2s; display: block; }
        .toggle.on .toggle-knob { transform: translateX(18px); }

        .link-box { padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
        .link-url { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; }
        .link-url span { font-size: 12px; color: var(--text-2, #94a3b8); font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .link-url svg { color: var(--text-3, #64748b); flex-shrink: 0; }
        .link-actions { display: flex; gap: 8px; }
        .link-generating { display: flex; align-items: center; gap: 10px; padding: 16px 20px; font-size: 13px; color: var(--text-3, #64748b); }
        .link-disabled { padding: 16px 20px; font-size: 13px; color: var(--text-3, #64748b); font-style: italic; margin: 0; }

        .members-list { display: flex; flex-direction: column; }
        .members-loading, .members-empty { display: flex; align-items: center; gap: 10px; padding: 20px; font-size: 13px; color: var(--text-3, #64748b); }
        .member-row { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-top: 1px solid rgba(255,255,255,0.06); }
        .member-avatar { width: 36px; height: 36px; border-radius: 50%; color: #fff; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .member-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .member-name { font-size: 13px; font-weight: 500; color: var(--text-1, #f1f5f9); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .member-email { font-size: 11px; color: var(--text-3, #64748b); }
        .role-badge { font-size: 11px; font-weight: 500; padding: 2px 9px; border-radius: 20px; }
        .role-owner { background: rgba(245,158,11,0.1); color: #f59e0b; }
        .role-member { background: rgba(99,102,241,0.1); color: #818cf8; }
        .role-viewer { background: rgba(255,255,255,0.06); color: var(--text-3, #64748b); }
        .remove-btn { font-size: 12px; padding: 4px 10px; }

        .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; }
        .btn-primary { background: #6366f1; color: #fff; }
        .btn-primary:hover:not(:disabled) { background: #4f46e5; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: var(--text-2, #94a3b8); border: 1px solid rgba(255,255,255,0.1); }
        .btn-ghost:hover { background: rgba(255,255,255,0.05); }
        .btn-icon { background: none; border: none; cursor: pointer; color: var(--text-3, #64748b); display: flex; padding: 4px; }
        .spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); border-top-color: currentColor; animation: spin 0.7s linear infinite; display: inline-block; }

        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 800; }
        .modal { background: #1a1d27; border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; width: 440px; max-width: 95vw; }
        .modal-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 14px; font-weight: 600; color: #f1f5f9; }
        .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .modal-foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid rgba(255,255,255,0.08); }
        .field { display: flex; flex-direction: column; gap: 6px; }
        label { font-size: 13px; font-weight: 500; color: #94a3b8; }
        .input { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #f1f5f9; font-size: 14px; box-sizing: border-box; outline: none; font-family: inherit; }
        .input:focus { border-color: #6366f1; }
        .select { appearance: auto; }
        .invite-result { padding: 10px 12px; border-radius: 8px; font-size: 13px; background: rgba(16,185,129,0.1); color: #34d399; }
        .invite-result.error { background: rgba(239,68,68,0.1); color: #f87171; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}