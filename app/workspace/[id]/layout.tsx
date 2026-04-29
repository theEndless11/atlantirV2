'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'
import VoiceMode from '@/components/VoiceMode'
import './layout.css'

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { id: workspaceId } = useParams<{ id: string }>()
  const pathname = usePathname()
  const router = useRouter()
  const [isDark, setIsDark] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('Workspace')
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [userInitial, setUserInitial] = useState('?')
  const userMenuRef = useRef<HTMLDivElement>(null)

  const isHome         = pathname === `/workspace/${workspaceId}`
  const isMeeting      = pathname.includes('/meeting')
  const isWorkflows    = pathname.endsWith('/workflows')
  const isAnalyst      = pathname.endsWith('/analyst')
  const isFiles        = pathname.endsWith('/files')
  const isIntegrations = pathname.endsWith('/integrations')
  const isAnalytics    = pathname.endsWith('/analytics')
  const isSettings     = pathname.endsWith('/settings')
  const isEmployees    = pathname.endsWith('/employees')
  const isMemory       = pathname.endsWith('/memory')

  const workspaceInitial = workspaceName.slice(0, 2).toUpperCase()

  useEffect(() => {
    // Prefetch all tab routes immediately so navigations feel instant
    const tabs = ['', '/workflows', '/analyst', '/employees', '/memory', '/files', '/integrations', '/analytics', '/settings']
    tabs.forEach(t => router.prefetch(`/workspace/${workspaceId}${t}`))
  }, [workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sb = supabaseBrowser()
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      const u = session.user
      const email = u.email || ''
      const name = u.user_metadata?.full_name || email.split('@')[0]
      setUserEmail(email)
      setUserName(name)
      setUserInitial((u.user_metadata?.full_name || u.email || '?')[0].toUpperCase())

      // Only hit the DB on first load — workspaceName starts as 'Workspace'
      if (workspaceName === 'Workspace') {
        const [{ data: member }, { data: ws }] = await Promise.all([
          sb.from('workspace_members').select('id')
            .eq('workspace_id', workspaceId).eq('user_id', u.id).single(),
          sb.from('workspaces').select('name').eq('id', workspaceId).single(),
        ])
        if (!member) { router.replace('/no-workspace'); return }
        if (ws) setWorkspaceName(ws.name)
      }

      const channelName = `membership:${workspaceId}:${u.id}`
      sb.removeChannel(sb.channel(channelName))
      sb.channel(channelName)
        .on('postgres_changes', {
          event: 'DELETE', schema: 'public', table: 'workspace_members',
          filter: `workspace_id=eq.${workspaceId}`
        }, (payload) => {
          if ((payload.old as any)?.user_id === u.id) router.replace('/no-workspace')
        })
        .subscribe()
    })

    try { setIsDark(localStorage.getItem('agentspace-dark') !== '0') } catch {}

    function handleOutsideClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setShowUserMenu(false)
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [workspaceId, router])

  useEffect(() => {
    try { localStorage.setItem('agentspace-dark', isDark ? '1' : '0') } catch {}
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  async function signOut() {
    setShowUserMenu(false)
    await supabaseBrowser().auth.signOut()
    router.replace('/login')
  }

  return (
    <div className={`app-shell${isDark ? ' dark' : ''}`}>
      <nav className="sidebar">
        <div className="sidebar-brand">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <path d="M16 3L28 9.5V22.5L16 29L4 22.5V9.5L16 3Z" fill="url(#sb_logo)" opacity="0.9"/>
            <path d="M16 3L28 9.5V22.5L16 29" stroke="rgba(167,139,250,0.5)" strokeWidth="1.5" fill="none"/>
            <defs>
              <linearGradient id="sb_logo" x1="4" y1="3" x2="28" y2="29">
                <stop offset="0%" stopColor="#a78bfa"/>
                <stop offset="100%" stopColor="#6366f1"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        <button className="workspace-badge" title={workspaceName}>{workspaceInitial}</button>
        <div className="nav-sep" />

        <div className="nav-links">
          <Link href={`/workspace/${workspaceId}`} className={`nav-btn${isHome ? ' active' : ''}`} title="Command center">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </Link>
          <Link href={`/workspace/${workspaceId}/meeting/room`} className={`nav-btn meeting${isMeeting ? ' active' : ''}`} title="Meeting room">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.894L15 14"/><rect x="3" y="8" width="12" height="8" rx="2"/></svg>
          </Link>
          <Link href={`/workspace/${workspaceId}/workflows`} className={`nav-btn${isWorkflows ? ' active' : ''}`} title="Workflows">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          </Link>
          <Link href={`/workspace/${workspaceId}/analyst`} className={`nav-btn${isAnalyst ? ' active' : ''}`} title="Data analyst">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          </Link>
          <Link href={`/workspace/${workspaceId}/employees`} className={`nav-btn${isEmployees ? ' active' : ''}`} title="AI Employees">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M17 11l2 2 4-4" stroke="currentColor" strokeWidth="2"/></svg>
          </Link>
          <Link href={`/workspace/${workspaceId}/memory`} className={`nav-btn${isMemory ? ' active' : ''}`} title="Memory files">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </Link>
          <Link href={`/workspace/${workspaceId}/files`} className={`nav-btn${isFiles ? ' active' : ''}`} title="Knowledge base">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </Link>
          <Link href={`/workspace/${workspaceId}/integrations`} className={`nav-btn${isIntegrations ? ' active' : ''}`} title="Integrations">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </Link>
          <Link href={`/workspace/${workspaceId}/analytics`} className={`nav-btn${isAnalytics ? ' active' : ''}`} title="Analytics">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </Link>
          <Link href={`/workspace/${workspaceId}/settings`} className={`nav-btn${isSettings ? ' active' : ''}`} title="Settings & members">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </Link>
        </div>

        <div className="sidebar-foot">
          <button className="nav-btn dark-toggle" title={isDark ? 'Light mode' : 'Dark mode'} onClick={() => setIsDark(v => !v)}>
            {!isDark
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            }
          </button>

          <div className="user-menu-wrap" ref={userMenuRef}>
            <button className="user-btn" title={userEmail} onClick={e => { e.stopPropagation(); setShowUserMenu(v => !v) }}>
              {userInitial}
            </button>
            {showUserMenu && (
              <div className="user-menu">
                <div className="user-menu-info">
                  <div className="user-menu-name">{userName}</div>
                  <div className="user-menu-email">{userEmail}</div>
                </div>
                <div className="user-menu-sep" />
                <Link href={`/workspace/${workspaceId}/settings`} className="user-menu-item" onClick={() => setShowUserMenu(false)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Settings
                </Link>
                <div className="user-menu-sep" />
                <button className="user-menu-item signout" onClick={signOut}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="page-content">
        {children}
      </main>

      {/* Voice assistant — available on every workspace page */}
      <VoiceMode workspaceId={workspaceId} />
    </div>
  )
}