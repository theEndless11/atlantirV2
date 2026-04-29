'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import type { Employee, Skill } from '@/types'

// ─── Default personas ─────────────────────────────────────────

const DEFAULT_EMPLOYEES = [
  { name: 'Alex',   role: 'Research Analyst', color: '#7C3AED', system_prompt: 'You are Alex, a sharp research analyst. You find accurate, well-sourced information quickly, summarise complex topics clearly, and flag uncertainty honestly. Always cite where information came from.', skill_names: ['Research', 'Writing'] },
  { name: 'Jordan', role: 'Operations Lead',   color: '#0891B2', system_prompt: 'You are Jordan, an operations specialist. You think in systems, handle task execution methodically, and escalate blockers clearly. Prefer concise outputs: bullet lists, checklists, and structured summaries.', skill_names: ['Operations', 'Task Execution'] },
  { name: 'Sam',    role: 'Copywriter',        color: '#059669', system_prompt: 'You are Sam, a skilled copywriter. You write clearly, warmly, and on-brand. You adapt tone for different audiences — from formal client emails to casual Slack messages.', skill_names: ['Writing', 'Communications'] },
  { name: 'Dana',   role: 'Data Analyst',      color: '#D97706', system_prompt: 'You are Dana, a data analyst. You interpret numbers carefully, build clear summaries from raw data, and highlight what actually matters.', skill_names: ['Data Analysis'] },
]

const DEFAULT_SKILLS = [
  { name: 'Research',       description: 'Web search, fact-checking, source evaluation',   prompt_guidance: 'Prioritise primary sources. Flag uncertainty. Cite sources inline.' },
  { name: 'Writing',        description: 'Copywriting, emails, summaries, documentation',  prompt_guidance: 'Write clearly and concisely. Match tone to audience. Avoid jargon.' },
  { name: 'Data Analysis',  description: 'SQL, data interpretation, chart generation',     prompt_guidance: 'Interpret data carefully. Highlight significant findings only.' },
  { name: 'Operations',     description: 'Task management, scheduling, process execution', prompt_guidance: 'Think in systems. Break tasks into clear steps. Escalate blockers.' },
  { name: 'Communications', description: 'Client emails, Slack, meeting prep, outreach',  prompt_guidance: 'Adapt tone to audience. Be warm but professional.' },
  { name: 'Task Execution', description: 'API calls, tool use, workflow automation',       prompt_guidance: 'Execute precisely. Confirm before irreversible actions.' },
]

interface EmployeeWithSkills extends Employee { skills: Array<{ skill: Skill }> }
type ModalState = null | { mode: 'new'; template?: typeof DEFAULT_EMPLOYEES[0] } | { mode: 'edit'; employee: EmployeeWithSkills }

async function apiGet<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}
async function apiMut(url: string, method: string, body: unknown) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

// ─── Avatar ───────────────────────────────────────────────────

function Avatar({ name, url, size = 40, color }: { name: string; url?: string | null; size?: number; color?: string }) {
  const COLORS = ['#7C3AED','#0891B2','#059669','#D97706','#DC2626','#0EA5E9']
  const bg = color ?? COLORS[name.charCodeAt(0) % COLORS.length]
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  if (url) return <img src={url} alt={name} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: Math.round(size * 0.34), fontWeight: 600, color: '#fff', letterSpacing: '-0.3px', userSelect: 'none' }}>
      {initials}
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────

const Icons = {
  Plus:   () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Edit:   () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Delete: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6m4-6v6"/><path d="M9 6V4h6v2"/></svg>,
  Close:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Check:  () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>,
  Spin:   () => <svg style={{ animation: 'spin .7s linear infinite' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
  Caret:  ({ open }: { open: boolean }) => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><polyline points="9 18 15 12 9 6"/></svg>,
  User:   () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.25 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
}

// ─── Skill pill ───────────────────────────────────────────────

function SkillPill({ name, selected, onClick }: { name: string; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all .12s',
      border: `1.5px solid ${selected ? 'var(--accent-border)' : 'var(--border)'}`,
      background: selected ? 'var(--accent-soft)' : 'transparent',
      color: selected ? 'var(--accent)' : 'var(--text-2)',
    }}>
      {selected && <Icons.Check />}
      {name}
    </button>
  )
}

// ─── Modal ────────────────────────────────────────────────────

function EmployeeModal({ initial, allSkills, onSave, onClose, saving }: {
  initial?: any; allSkills: Skill[]
  onSave: (d: { name: string; avatar_url: string; system_prompt: string; skill_ids: string[] }) => void
  onClose: () => void; saving: boolean
}) {
  const tpl = initial?._template
  const [name, setName]             = useState<string>(initial?.name ?? tpl?.name ?? '')
  const [avatarUrl, setAvatarUrl]   = useState<string>(initial?.avatar_url ?? '')
  const [prompt, setPrompt]         = useState<string>(initial?.system_prompt ?? tpl?.system_prompt ?? '')
  const [ids, setIds]               = useState<string[]>(initial?.skills?.map((s: any) => s.skill.id) ?? [])
  const [showPrompt, setShowPrompt] = useState(false)
  const empColor = tpl?.color

  useEffect(() => {
    if (tpl && ids.length === 0 && allSkills.length > 0)
      setIds(allSkills.filter(s => tpl.skill_names.includes(s.name)).map(s => s.id))
  }, [allSkills])

  const toggle = (id: string) => setIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const inp = (val: string, set: (v: string) => void, ph: string, type = 'text') => (
    <input value={val} onChange={e => set(e.target.value)} placeholder={ph} type={type}
      style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)', fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color .15s' }}
      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
      onBlur={e => e.target.style.borderColor = 'var(--border)'} />
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,23,20,.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 500, padding: '1.5rem', boxShadow: '0 20px 60px rgba(0,0,0,.1)', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--text-1)' }}>
            {initial?.id ? 'Edit employee' : tpl ? `Add ${tpl.name}` : 'New employee'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, display: 'flex', borderRadius: 6 }}><Icons.Close /></button>
        </div>

        {/* Preview strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)' }}>
          <Avatar name={name || 'A'} url={avatarUrl} size={40} color={empColor} />
          <div>
            <p style={{ margin: 0, fontWeight: 500, fontSize: 14, color: 'var(--text-1)' }}>{name || 'Employee name'}</p>
            {tpl && <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>{tpl.role}</p>}
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Name <span style={{ color: '#ef4444' }}>*</span></label>
          {inp(name, setName, 'e.g. Alex')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Avatar URL <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>(optional)</span></label>
          {inp(avatarUrl, setAvatarUrl, 'https://…', 'url')}
        </div>

        {/* Skills */}
        {allSkills.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Skills</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allSkills.map(s => <SkillPill key={s.id} name={s.name} selected={ids.includes(s.id)} onClick={() => toggle(s.id)} />)}
            </div>
          </div>
        )}

        {/* System prompt */}
        <div>
          <button onClick={() => setShowPrompt(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Icons.Caret open={showPrompt} />
            System prompt
            {prompt ? <span style={{ color: 'var(--accent)', fontSize: 11, marginLeft: 2 }}>(set)</span>
                    : <span style={{ color: 'var(--text-3)', fontSize: 11, fontWeight: 400, marginLeft: 2 }}>(optional)</span>}
          </button>
          {showPrompt && (
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={5}
              placeholder="Additional identity or behavioural instructions for this employee…"
              style={{ marginTop: 8, width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)', fontSize: 13, fontFamily: 'monospace', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 2 }}>
          <button onClick={onClose} disabled={saving} style={{ padding: '8px 18px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
          <button onClick={() => onSave({ name, avatar_url: avatarUrl, system_prompt: prompt, skill_ids: ids })}
            disabled={saving || !name.trim()}
            style={{ padding: '8px 20px', borderRadius: 9, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, cursor: saving || !name.trim() ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: saving || !name.trim() ? 0.55 : 1, display: 'flex', alignItems: 'center', gap: 7 }}>
            {saving && <Icons.Spin />}
            {saving ? 'Saving…' : 'Save employee'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Employee card ────────────────────────────────────────────

function EmployeeCard({ emp, onEdit, onDelete }: { emp: EmployeeWithSkills; onEdit: () => void; onDelete: () => void }) {
  const skills = emp.skills?.map(s => s.skill).filter(Boolean) ?? []
  const [hov, setHov] = useState(false)
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: 'var(--surface)', border: `1px solid ${hov ? 'var(--accent-border)' : 'var(--border)'}`, borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start', transition: 'border-color .15s' }}>
      <Avatar name={emp.name} url={emp.avatar_url} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-1)' }}>{emp.name}</p>
            {emp.system_prompt && <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '2px 0 0', fontStyle: 'italic' }}>Custom prompt</p>}
          </div>
          <div style={{ display: 'flex', gap: 4, opacity: hov ? 1 : 0, transition: 'opacity .12s', flexShrink: 0, marginLeft: 8 }}>
            <button onClick={onEdit} title="Edit" style={{ padding: 6, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface-2)', cursor: 'pointer', color: 'var(--text-2)', display: 'flex' }}><Icons.Edit /></button>
            <button onClick={onDelete} title="Delete" style={{ padding: 6, borderRadius: 7, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#ef4444', display: 'flex' }}><Icons.Delete /></button>
          </div>
        </div>
        {skills.length > 0
          ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {skills.map(s => <span key={s.id} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 500, border: '1px solid var(--accent-border)' }}>{s.name}</span>)}
            </div>
          : <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>No skills assigned</p>}
      </div>
    </div>
  )
}

// ─── Skill form ───────────────────────────────────────────────

function SkillForm({ initial, onSave, onCancel, saving }: { initial?: Skill; onSave: (d: { name: string; description: string; prompt_guidance: string }) => void; onCancel: () => void; saving: boolean }) {
  const [name, setName]         = useState(initial?.name ?? '')
  const [desc, setDesc]         = useState(initial?.description ?? '')
  const [guidance, setGuidance] = useState(initial?.prompt_guidance ?? '')
  const inp = (val: string, set: (v: string) => void, ph: string, mono = false) => (
    <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
      style={{ padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-1)', fontSize: 13, fontFamily: mono ? 'monospace' : 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' as const }} />
  )
  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem', display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }}>Name *</label>
          {inp(name, setName, 'e.g. Research')}
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }}>Description</label>
          {inp(desc, setDesc, 'Shown in the UI')}
        </div>
      </div>
      <div>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 4 }}>Prompt guidance</label>
        {inp(guidance, setGuidance, 'Injected into agent system prompt when this skill is active', true)}
      </div>
      <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', fontSize: 12, cursor: 'pointer', color: 'var(--text-2)' }}>Cancel</button>
        <button onClick={() => onSave({ name, description: desc, prompt_guidance: guidance })} disabled={saving || !name.trim()}
          style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer', opacity: !name.trim() ? 0.5 : 1 }}>
          {saving ? 'Saving…' : 'Save skill'}
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { id: workspaceId } = useParams<{ id: string }>()
  const [employees, setEmployees] = useState<EmployeeWithSkills[]>([])
  const [skills, setSkills]       = useState<Skill[]>([])
  const [loading, setLoading]     = useState(true)
  const [seeding, setSeeding]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [modal, setModal]         = useState<ModalState>(null)
  const [empSaving, setEmpSaving] = useState(false)
  const [showSkillForm, setShowSkillForm] = useState(false)
  const [editingSkill, setEditingSkill]   = useState<Skill | null>(null)
  const [skillSaving, setSkillSaving]     = useState(false)

  const refresh = useCallback(async () => {
    try {
      const [emps, sks] = await Promise.all([
        apiGet<EmployeeWithSkills[]>(`/api/employees?workspaceId=${workspaceId}`),
        apiGet<Skill[]>(`/api/skills?workspaceId=${workspaceId}`),
      ])
      setEmployees(emps); setSkills(sks)
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [workspaceId])

  useEffect(() => { refresh() }, [refresh])

  async function seedDefaults() {
    setSeeding(true)
    try {
      const created: Skill[] = []
      for (const s of DEFAULT_SKILLS) {
        if (!skills.find(ex => ex.name === s.name)) created.push(await apiMut('/api/skills', 'POST', { workspaceId, ...s }))
      }
      const all = [...skills, ...created]
      for (const tpl of DEFAULT_EMPLOYEES) {
        if (!employees.find(e => e.name === tpl.name)) {
          await apiMut('/api/employees', 'POST', { workspaceId, name: tpl.name, system_prompt: tpl.system_prompt, skill_ids: all.filter(s => tpl.skill_names.includes(s.name)).map(s => s.id) })
        }
      }
      await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Seeding failed') }
    finally { setSeeding(false) }
  }

  async function handleSaveEmployee(data: { name: string; avatar_url: string; system_prompt: string; skill_ids: string[] }) {
    setEmpSaving(true)
    try {
      if (modal?.mode === 'edit') await apiMut('/api/employees', 'PATCH', { id: modal.employee.id, workspaceId, ...data })
      else await apiMut('/api/employees', 'POST', { workspaceId, ...data })
      setModal(null); await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed') }
    finally { setEmpSaving(false) }
  }

  async function handleDeleteEmployee(id: string) {
    if (!confirm('Delete this employee?')) return
    try { await fetch(`/api/employees?id=${id}&workspaceId=${workspaceId}`, { method: 'DELETE' }); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Delete failed') }
  }

  async function handleSaveSkill(data: { name: string; description: string; prompt_guidance: string }) {
    setSkillSaving(true)
    try {
      if (editingSkill) await apiMut('/api/skills', 'PATCH', { id: editingSkill.id, workspaceId, ...data })
      else await apiMut('/api/skills', 'POST', { workspaceId, ...data })
      setShowSkillForm(false); setEditingSkill(null); await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed') }
    finally { setSkillSaving(false) }
  }

  async function handleDeleteSkill(id: string) {
    if (!confirm('Delete this skill?')) return
    try { await fetch(`/api/skills?id=${id}&workspaceId=${workspaceId}`, { method: 'DELETE' }); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Delete failed') }
  }

  const missingDefaults = DEFAULT_EMPLOYEES.filter(d => !employees.find(e => e.name === d.name))

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--text-3)', gap: 10, fontSize: 13 }}>
      <Icons.Spin /> Loading…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div className="page-shell" style={{ maxWidth: 760, margin: '0 auto', paddingBottom: 60 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1>AI Employees</h1>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 3 }}>Each employee is a distinct AI persona with their own identity, skills, and behaviour.</p>
        </div>
        <button onClick={() => setModal({ mode: 'new' })} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, padding: '8px 16px' }}>
          <Icons.Plus /> New employee
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginTop: 16, background: '#fef2f2', color: '#dc2626', borderRadius: 9, padding: '10px 14px', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {error}
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 2, display: 'flex' }}><Icons.Close /></button>
        </div>
      )}

      {/* Empty state */}
      {employees.length === 0 && (
        <div style={{ marginTop: 24, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Top info strip */}
          <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Icons.User />
              <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>No employees yet</h2>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, maxWidth: 400, lineHeight: 1.6 }}>
              Start with the suggested team below, or create your own from scratch.
            </p>
          </div>

          {/* Persona grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)' }}>
            {DEFAULT_EMPLOYEES.map(tpl => (
              <button key={tpl.name} onClick={() => setModal({ mode: 'new', template: tpl })}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px', background: 'var(--surface)', cursor: 'pointer', border: 'none', textAlign: 'left', transition: 'background .12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--surface)'}>
                <Avatar name={tpl.name} size={38} color={tpl.color} />
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-1)' }}>{tpl.name}</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>{tpl.role}</p>
                </div>
                <div style={{ marginLeft: 'auto', color: 'var(--text-3)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </button>
            ))}
          </div>

          {/* Action row */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={seedDefaults} disabled={seeding}
              style={{ padding: '8px 18px', borderRadius: 9, background: 'var(--accent)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 500, cursor: seeding ? 'not-allowed' : 'pointer', opacity: seeding ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 7 }}>
              {seeding ? <><Icons.Spin /> Setting up…</> : 'Add all 4 defaults'}
            </button>
            <button onClick={() => setModal({ mode: 'new' })}
              style={{ padding: '8px 16px', borderRadius: 9, background: 'none', border: '1.5px solid var(--border)', fontSize: 13, cursor: 'pointer', color: 'var(--text-2)' }}>
              Start from scratch
            </button>
          </div>
        </div>
      )}

      {/* Employee list */}
      {employees.length > 0 && (
        <div style={{ marginTop: 24, display: 'grid', gap: 8 }}>
          {employees.map(emp => (
            <EmployeeCard key={emp.id} emp={emp}
              onEdit={() => setModal({ mode: 'edit', employee: emp })}
              onDelete={() => handleDeleteEmployee(emp.id)} />
          ))}
        </div>
      )}

      {/* Suggested additions */}
      {employees.length > 0 && missingDefaults.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>Suggested additions</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {missingDefaults.map(tpl => (
              <button key={tpl.name} onClick={() => setModal({ mode: 'new', template: tpl })}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', border: '1.5px dashed var(--border)', borderRadius: 9, background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text-2)' }}>
                <Avatar name={tpl.name} size={20} color={tpl.color} />
                {tpl.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Skills section ── */}
      <div style={{ marginTop: 40, paddingTop: 32, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)', margin: 0 }}>Skills</h2>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>Reusable guidance layers injected into the agent's system prompt.</p>
          </div>
          <button onClick={() => { setShowSkillForm(true); setEditingSkill(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', border: '1.5px solid var(--border)', borderRadius: 8, background: 'none', fontSize: 12, cursor: 'pointer', color: 'var(--text-2)', fontWeight: 500, whiteSpace: 'nowrap' }}>
            <Icons.Plus /> New skill
          </button>
        </div>

        {(showSkillForm || editingSkill) && (
          <div style={{ marginBottom: 12 }}>
            <SkillForm initial={editingSkill ?? undefined} onSave={handleSaveSkill}
              onCancel={() => { setShowSkillForm(false); setEditingSkill(null) }} saving={skillSaving} />
          </div>
        )}

        {skills.length === 0 && !showSkillForm
          ? <p style={{ fontSize: 13, color: 'var(--text-3)', padding: '12px 0' }}>No skills yet. Skills will be created automatically when you add default employees.</p>
          : skills.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: 14, color: 'var(--text-1)' }}>{s.name}</p>
                  {s.description && <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-2)' }}>{s.description}</p>}
                  {s.prompt_guidance && <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>{s.prompt_guidance.slice(0, 90)}{s.prompt_guidance.length > 90 ? '…' : ''}</p>}
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => { setEditingSkill(s); setShowSkillForm(false) }} style={{ padding: 5, borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex' }}><Icons.Edit /></button>
                  <button onClick={() => handleDeleteSkill(s.id)} style={{ padding: 5, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', color: '#ef4444', display: 'flex' }}><Icons.Delete /></button>
                </div>
              </div>
            ))
        }
      </div>

      {modal && (
        <EmployeeModal
          initial={modal.mode === 'edit' ? modal.employee : (modal as any).template ? { _template: (modal as any).template } : undefined}
          allSkills={skills} onSave={handleSaveEmployee} onClose={() => setModal(null)} saving={empSaving}
        />
      )}
    </div>
  )
}