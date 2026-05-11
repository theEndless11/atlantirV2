'use client'
/**
 * TabShell — renders all tab panels simultaneously using CSS display:none.
 * Tab components are NEVER unmounted, so their state (fetched data, scroll position)
 * is preserved across navigation. Switching tabs is instant — zero network, zero JS.
 *
 * Tabs that are real Next.js routes (meeting, analyst, artifacts) are excluded and
 * handled by the layout's <main> / children as before.
 */
import dynamic from 'next/dynamic'
import type { QueryTab } from '@/app/workspace/[id]/layout'
import { WorkspaceBootstrap } from '@/components/WorkspaceBootstrap'

// ── Skeletons ─────────────────────────────────────────────────────────────────

function SkRows({ n = 5, h = 48, gap = 10 }: { n?: number; h?: number; gap?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="sk-block" style={{ height: h, opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  )
}

function SkCards({ n = 4 }: { n?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="sk-block" style={{ height: 90 }} />
      ))}
    </div>
  )
}

function SkHeader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="sk-block" style={{ width: 160, height: 24 }} />
        <div className="sk-block" style={{ width: 260, height: 14 }} />
      </div>
      <div className="sk-block" style={{ width: 110, height: 36, borderRadius: 8 }} />
    </div>
  )
}

function SkeletonEmployees() {
  return (
    <div className="page-shell" style={{ maxWidth: 760, margin: '0 auto' }}>
      <SkHeader />
      <SkRows n={4} h={72} gap={10} />
    </div>
  )
}
function SkeletonWorkflows() {
  return (
    <div className="page-shell">
      <SkHeader />
      <SkRows n={3} h={88} gap={12} />
    </div>
  )
}
function SkeletonMemory() {
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ width: 220, borderRight: '1px solid var(--border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="sk-block" style={{ height: 16, width: '70%' }} />
        <SkRows n={6} h={20} gap={8} />
      </div>
      <div style={{ flex: 1, padding: 24 }}>
        <div className="sk-block" style={{ height: 20, width: '40%', marginBottom: 16 }} />
        <SkRows n={8} h={14} gap={10} />
      </div>
    </div>
  )
}
function SkeletonFiles() {
  return (
    <div className="page-shell">
      <SkHeader />
      <SkRows n={5} h={52} gap={8} />
    </div>
  )
}
function SkeletonIntegrations() {
  return (
    <div className="page-shell">
      <SkHeader />
      <SkCards n={6} />
      <div style={{ marginTop: 24 }}><SkCards n={6} /></div>
    </div>
  )
}
function SkeletonAnalytics() {
  return (
    <div className="page-shell">
      <SkHeader />
      <SkCards n={6} />
      <div style={{ marginTop: 24 }}>
        <div className="sk-block" style={{ height: 180 }} />
      </div>
    </div>
  )
}
function SkeletonSettings() {
  return (
    <div className="page-shell" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div className="sk-block" style={{ width: 180, height: 28, marginBottom: 8 }} />
        <div className="sk-block" style={{ width: 120, height: 14 }} />
      </div>
      <div className="sk-block" style={{ height: 90, marginBottom: 16 }} />
      <div className="sk-block" style={{ height: 90, marginBottom: 16 }} />
      <SkRows n={4} h={56} gap={10} />
    </div>
  )
}

// ── Lazy-load each tab (code-split, loaded once then kept alive) ───────────────

const EmployeesTab    = dynamic(() => import('@/app/workspace/[id]/employees/page'),    { ssr: false, loading: SkeletonEmployees })
const WorkflowsTab    = dynamic(() => import('@/app/workspace/[id]/workflows/page'),    { ssr: false, loading: SkeletonWorkflows })
const MemoryTab       = dynamic(() => import('@/app/workspace/[id]/memory/page'),       { ssr: false, loading: SkeletonMemory })
const FilesTab        = dynamic(() => import('@/app/workspace/[id]/files/page'),        { ssr: false, loading: SkeletonFiles })
const IntegrationsTab = dynamic(() => import('@/app/workspace/[id]/integrations/page'),{ ssr: false, loading: SkeletonIntegrations })
const AnalyticsTab    = dynamic(() => import('@/app/workspace/[id]/analytics/page'),   { ssr: false, loading: SkeletonAnalytics })
const SettingsTab     = dynamic(() => import('@/app/workspace/[id]/settings/page'),    { ssr: false, loading: SkeletonSettings })

// ── Tab panel — stays mounted, hidden via CSS only ────────────────────────────

function TabPanel({ id, active, children }: { id: string; active: boolean; children: React.ReactNode }) {
  return (
    <div className="tab-panel" id={`tab-${id}`} hidden={!active} aria-hidden={!active}>
      {children}
    </div>
  )
}

// ── Main shell ────────────────────────────────────────────────────────────────

interface TabShellProps {
  workspaceId: string
  activeTab: QueryTab
  homeContent: React.ReactNode
}

export function TabShell({ workspaceId, activeTab, homeContent }: TabShellProps) {
  return (
    <>
      <WorkspaceBootstrap workspaceId={workspaceId} />

      <TabPanel id="home"         active={activeTab === 'home'}>
        {homeContent}
      </TabPanel>

      <TabPanel id="employees"    active={activeTab === 'employees'}>
        <EmployeesTab />
      </TabPanel>

      <TabPanel id="workflows"    active={activeTab === 'workflows'}>
        <WorkflowsTab />
      </TabPanel>

      <TabPanel id="memory"       active={activeTab === 'memory'}>
        <MemoryTab />
      </TabPanel>

      <TabPanel id="files"        active={activeTab === 'files'}>
        <FilesTab />
      </TabPanel>

      <TabPanel id="integrations" active={activeTab === 'integrations'}>
        <IntegrationsTab />
      </TabPanel>

      <TabPanel id="analytics"    active={activeTab === 'analytics'}>
        <AnalyticsTab />
      </TabPanel>

      <TabPanel id="settings"     active={activeTab === 'settings'}>
        <SettingsTab />
      </TabPanel>
    </>
  )
}
