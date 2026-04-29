'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────
interface WorkflowStep {
  agent: string
  task_title: string
  task_description: string
  priority?: number
}

interface WorkflowVariable {
  key: string
  label: string
  placeholder: string
  hint?: string
}

interface Workflow {
  id: string
  name: string
  description?: string
  trigger: string
  schedule_cadence?: string
  enabled: boolean
  steps: WorkflowStep[]
  variables?: WorkflowVariable[]
  run_count?: number
  last_run_at?: string
}

interface WorkflowRun {
  id: string
  status: string
  created_at: string
  ended_at?: string
  tasks_created?: number
  final_output?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────
const AGENT_TYPES = ['research', 'writer', 'analyst', 'executor']

const EMPTY_FORM = () => ({
  name: '',
  description: '',
  trigger: 'manual',
  schedule_cadence: 'weekly',
  steps: [] as WorkflowStep[],
  variables: [] as WorkflowVariable[],
})

const TEMPLATES: Record<string, Partial<typeof EMPTY_FORM extends () => infer R ? R : never>> = {
  competitor: {
    name: 'Competitor digest',
    trigger: 'manual',
    description: 'Research and summarize competitor updates',
    variables: [{ key: 'competitor', label: 'Competitor name', placeholder: 'e.g. Acme Inc.' }],
    steps: [
      { agent: 'research', task_title: 'Research {{competitor}} latest news', task_description: 'Find recent news, product launches, pricing changes, and blog posts from {{competitor}}.' },
      { agent: 'writer', task_title: 'Write {{competitor}} digest', task_description: 'Summarize the research into a concise digest for the team.' },
    ],
  },
  meeting: {
    name: 'Post-meeting report',
    trigger: 'meeting_end',
    description: 'Auto-generate a report after every meeting',
    steps: [
      { agent: 'analyst', task_title: 'Analyse meeting transcript', task_description: 'Extract key decisions, action items, and open questions from the meeting.' },
      { agent: 'writer', task_title: 'Write meeting report', task_description: 'Write a clear summary with decisions, action items, and next steps.' },
    ],
  },
  onboarding: {
    name: 'New hire brief',
    trigger: 'manual',
    variables: [
      { key: 'name', label: 'Employee name', placeholder: 'Jane Smith' },
      { key: 'role', label: 'Role', placeholder: 'Software Engineer' },
    ],
    steps: [
      { agent: 'research', task_title: 'Research role context for {{role}}', task_description: 'Find relevant team context, tools, and processes for the {{role}} position.' },
      { agent: 'writer', task_title: 'Write onboarding brief for {{name}}', task_description: 'Write a personalised first-week guide for {{name}} joining as {{role}}.' },
    ],
  },
  weekly: {
    name: 'Weekly Slack update',
    trigger: 'schedule',
    schedule_cadence: 'weekly',
    steps: [
      { agent: 'research', task_title: "Gather this week's highlights", task_description: 'Research key milestones, metrics, and news from the past week.' },
      { agent: 'writer', task_title: 'Write weekly Slack update', task_description: 'Write a concise weekly update for the #general Slack channel.' },
      { agent: 'executor', task_title: 'Post to Slack', task_description: 'Post the weekly update to the #general channel.' },
    ],
  },
  churn: {
    name: 'Churn risk report',
    trigger: 'schedule',
    schedule_cadence: 'weekly',
    steps: [
      { agent: 'analyst', task_title: 'Identify at-risk accounts', task_description: 'Analyse usage data and signals to identify accounts at risk of churn.' },
      { agent: 'writer', task_title: 'Write churn risk report', task_description: 'Summarise at-risk accounts with recommended actions for the CS team.' },
    ],
  },
  release: {
    name: 'Release notes',
    trigger: 'manual',
    variables: [{ key: 'version', label: 'Version', placeholder: 'v2.4.0' }],
    steps: [
      { agent: 'research', task_title: 'Gather changes for {{version}}', task_description: 'Pull together merged PRs, bug fixes, and features for {{version}} from GitHub.' },
      { agent: 'writer', task_title: 'Write release notes for {{version}}', task_description: 'Write user-friendly release notes for {{version}} with highlights and breaking changes.' },
    ],
  },
  sales: {
    name: 'Sales outreach draft',
    trigger: 'manual',
    variables: [{ key: 'prospect', label: 'Prospect company', placeholder: 'Acme Corp' }],
    steps: [
      { agent: 'research', task_title: 'Research {{prospect}}', task_description: 'Find {{prospect}} news, pain points, team size, and relevant context.' },
      { agent: 'writer', task_title: 'Draft outreach email for {{prospect}}', task_description: 'Write a personalised cold outreach email to {{prospect}} referencing their recent news.' },
    ],
  },
  standup: {
    name: 'Daily standup post',
    trigger: 'schedule',
    schedule_cadence: 'daily',
    steps: [
      { agent: 'research', task_title: "Gather yesterday's updates", task_description: 'Pull completed tasks and blockers from the past 24 hours.' },
      { agent: 'writer', task_title: 'Write standup post', task_description: 'Write a brief standup update: done, doing, blockers.' },
      { agent: 'executor', task_title: 'Post standup to Slack', task_description: 'Post the standup to the #standup channel.' },
    ],
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function triggerLabel(wf: Workflow) {
  if (wf.trigger === 'meeting_end') return 'After meetings'
  if (wf.trigger === 'schedule') return wf.schedule_cadence || 'Scheduled'
  return 'Manual'
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function WorkflowsPage() {
  const params = useParams()
  const workspaceId = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [lastRuns, setLastRuns] = useState<Record<string, WorkflowRun>>({})
  const [running, setRunning] = useState<string | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM())
  const [varPrompt, setVarPrompt] = useState<{
    open: boolean
    workflow: Workflow | null
    values: Record<string, string>
  }>({ open: false, workflow: null, values: {} })
  const [toast, setToast] = useState('')

  useEffect(() => {
    load()
  }, [workspaceId])

  async function load() {
    try {
      const res = await fetch(`/api/workflows?workspace_id=${workspaceId}`)
      const data: Workflow[] = await res.json()
      setWorkflows(data || [])
    } catch {}
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // ── Editor ────────────────────────────────────────────────────────────────
  function openNew() {
    setForm(EMPTY_FORM())
    setEditingId(null)
    setShowEditor(true)
  }

  function openEdit(wf: Workflow) {
    setForm({
      name: wf.name,
      description: wf.description || '',
      trigger: wf.trigger,
      schedule_cadence: wf.schedule_cadence || 'weekly',
      steps: wf.steps.map(s => ({ ...s })),
      variables: (wf.variables || []).map(v => ({ ...v })),
    })
    setEditingId(wf.id)
    setShowEditor(true)
  }

  function loadTemplate(key: string) {
    const tmpl = TEMPLATES[key]
    if (!tmpl) return
    setForm({
      ...EMPTY_FORM(),
      ...tmpl,
      steps: (tmpl.steps || []).map(s => ({ ...s })),
      variables: (tmpl.variables || []).map(v => ({ ...v })),
    } as ReturnType<typeof EMPTY_FORM>)
    setEditingId(null)
    setShowEditor(true)
  }

  // ── Steps ─────────────────────────────────────────────────────────────────
  function addStep() {
    setForm(f => ({
      ...f,
      steps: [...f.steps, { agent: 'research', task_title: '', task_description: '' }],
    }))
  }

  function removeStep(i: number) {
    setForm(f => ({ ...f, steps: f.steps.filter((_, j) => j !== i) }))
  }

  function updateStep(i: number, field: keyof WorkflowStep, value: string) {
    setForm(f => ({
      ...f,
      steps: f.steps.map((s, j) => (j === i ? { ...s, [field]: value } : s)),
    }))
  }

  // ── Variables ─────────────────────────────────────────────────────────────
  function addVar() {
    setForm(f => ({
      ...f,
      variables: [...f.variables, { key: '', label: '', placeholder: '' }],
    }))
  }

  function removeVar(i: number) {
    setForm(f => ({ ...f, variables: f.variables.filter((_, j) => j !== i) }))
  }

  function updateVar(i: number, field: keyof WorkflowVariable, value: string) {
    setForm(f => ({
      ...f,
      variables: f.variables.map((v, j) => (j === i ? { ...v, [field]: value } : v)),
    }))
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function saveWorkflow() {
    if (!form.name || !form.steps.length) return
    try {
      const body = { ...form, workspace_id: workspaceId, ...(editingId ? { id: editingId } : {}) }
      const res = await fetch('/api/workflows', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const saved: Workflow = await res.json()
      setWorkflows(prev =>
        editingId ? prev.map(w => (w.id === editingId ? saved : w)) : [saved, ...prev]
      )
      setShowEditor(false)
      showToast(editingId ? 'Workflow updated' : 'Workflow created')
    } catch {}
  }

  async function deleteWorkflow(id: string) {
    if (!confirm('Delete this workflow?')) return
    await fetch('/api/workflows', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, workspace_id: workspaceId }),
    })
    setWorkflows(prev => prev.filter(w => w.id !== id))
  }

  async function toggleEnabled(wf: Workflow) {
    const res = await fetch('/api/workflows', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: wf.id, workspace_id: workspaceId, enabled: !wf.enabled }),
    })
    const updated: Workflow = await res.json()
    setWorkflows(prev => prev.map(w => (w.id === wf.id ? updated : w)))
  }

  // ── Run ───────────────────────────────────────────────────────────────────
  function startRun(wf: Workflow) {
    if (wf.variables?.length) {
      setVarPrompt({
        open: true,
        workflow: wf,
        values: Object.fromEntries((wf.variables || []).map(v => [v.key, ''])),
      })
    } else {
      runWorkflow(wf.id, {})
    }
  }

  async function confirmRun() {
    if (!varPrompt.workflow) return
    const { id } = varPrompt.workflow
    const values = { ...varPrompt.values }
    setVarPrompt({ open: false, workflow: null, values: {} })
    await runWorkflow(id, values)
  }

  async function runWorkflow(id: string, variables: Record<string, string>) {
    setRunning(id)
    try {
      const res = await fetch('/api/workflows/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_id: id, workspace_id: workspaceId, variables }),
      })
      const data: WorkflowRun = await res.json()
      setLastRuns(prev => ({ ...prev, [id]: data }))
      showToast('Workflow started')
    } catch {}
    finally {
      setRunning(null)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="page-shell wf-shell">
      <div className="page-header">
        <div>
          <h1>Workflows</h1>
          <p className="page-desc">
            Automated agent pipelines you define once and run repeatedly. Each step passes its
            output to the next — research feeds analysis, analysis feeds writing.
          </p>
        </div>
        <button className="btn-new" onClick={openNew}>+ New workflow</button>
      </div>

      {/* Empty state with templates */}
      {!workflows.length && (
        <div className="empty-state">
          <div className="empty-hero">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" />
            </svg>
            <div className="empty-hero-text">
              <strong>No workflows yet</strong>
              <span>Start from a template below or build your own from scratch.</span>
            </div>
          </div>
          <div className="how-it-works">
            <div className="how-step">
              <div className="how-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
              </div>
              <div><strong>Define steps</strong> — assign each step to the right agent: research, analyst, writer, or executor.</div>
            </div>
            <div className="how-step">
              <div className="how-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
              </div>
              <div><strong>Add variables</strong> — use <code>{'{{variable}}'}</code> in step text, then fill it in at run time.</div>
            </div>
            <div className="how-step">
              <div className="how-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3l14 9-14 9V3z" /></svg>
              </div>
              <div><strong>Choose a trigger</strong> — run manually, fire after every meeting ends, or schedule it daily or weekly.</div>
            </div>
          </div>
          <div className="template-section-label">Start from a template</div>
          <div className="empty-examples">
            {[
              { key: 'competitor', label: 'Competitor digest' },
              { key: 'meeting',    label: 'Post-meeting report' },
              { key: 'onboarding',label: 'New hire brief' },
              { key: 'weekly',     label: 'Weekly Slack update' },
              { key: 'churn',      label: 'Churn risk report' },
              { key: 'release',    label: 'Release notes' },
              { key: 'sales',      label: 'Sales outreach draft' },
              { key: 'standup',    label: 'Daily standup post' },
            ].map(t => (
              <div key={t.key} className="example-chip" onClick={() => loadTemplate(t.key)}>
                {t.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Workflow list */}
      <div className="wf-list">
        {workflows.map(wf => (
          <div key={wf.id} className={`wf-card${!wf.enabled ? ' disabled' : ''}`}>
            <div className="wf-top">
              <div className="wf-info">
                <div className="wf-name-row">
                  <span className="wf-name">{wf.name}</span>
                  <span className={`enabled-dot${wf.enabled ? ' on' : ''}`} title={wf.enabled ? 'Enabled' : 'Disabled'} />
                </div>
                <div className="wf-meta">
                  <span className={`trigger-badge ${wf.trigger}`}>{triggerLabel(wf)}</span>
                  <span className="wf-steps">{wf.steps.length} step{wf.steps.length !== 1 ? 's' : ''}</span>
                  {!!wf.run_count && <span className="wf-runs">{wf.run_count}× run</span>}
                  {wf.last_run_at && <span className="wf-last">Last: {formatDate(wf.last_run_at)}</span>}
                </div>
                {wf.description && <div className="wf-desc">{wf.description}</div>}
                {!!wf.variables?.length && (
                  <div className="var-pills">
                    {wf.variables.map(v => (
                      <span key={v.key} className="var-pill">{v.key}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="wf-actions">
                <button
                  className="btn-run-wf"
                  disabled={running === wf.id}
                  onClick={() => startRun(wf)}
                >
                  {running === wf.id ? 'Running…' : '▶ Run'}
                </button>
                <button className="btn-edit" onClick={() => openEdit(wf)}>Edit</button>
                <button className="btn-toggle" onClick={() => toggleEnabled(wf)}>
                  {wf.enabled ? 'Disable' : 'Enable'}
                </button>
                <button className="btn-del" onClick={() => deleteWorkflow(wf.id)}>✕</button>
              </div>
            </div>

            {/* Steps preview */}
            <div className="steps-preview">
              {wf.steps.map((step, i) => (
                <div key={i} className="step-chip">
                  <span className="step-num">{i + 1}</span>
                  <span className={`step-agent ${step.agent}`}>{step.agent}</span>
                  <span className="step-title">{step.task_title}</span>
                </div>
              ))}
            </div>

            {/* Last run result */}
            {lastRuns[wf.id] && (
              <div className="last-run">
                <span className={`run-status ${lastRuns[wf.id].status}`}>{lastRuns[wf.id].status}</span>
                <span className="run-meta">
                  {formatDate(lastRuns[wf.id].ended_at || lastRuns[wf.id].created_at)} · {lastRuns[wf.id].tasks_created} tasks
                </span>
                {lastRuns[wf.id].final_output && (
                  <span className="run-preview">{lastRuns[wf.id].final_output!.slice(0, 120)}…</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Variable prompt modal */}
      {varPrompt.open && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setVarPrompt(v => ({ ...v, open: false })) }}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <span>Run: {varPrompt.workflow?.name}</span>
              <button className="close-btn" onClick={() => setVarPrompt(v => ({ ...v, open: false }))}>✕</button>
            </div>
            <div className="modal-body">
              <p className="var-hint">Fill in the variables for this run:</p>
              {varPrompt.workflow?.variables?.map(v => (
                <div key={v.key} className="field">
                  <label>{v.label || v.key}</label>
                  <input
                    value={varPrompt.values[v.key] || ''}
                    placeholder={v.placeholder || v.key}
                    onChange={e =>
                      setVarPrompt(prev => ({
                        ...prev,
                        values: { ...prev.values, [v.key]: e.target.value },
                      }))
                    }
                  />
                  {v.hint && <span className="hint">{v.hint}</span>}
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setVarPrompt(v => ({ ...v, open: false }))}>Cancel</button>
              <button className="btn-save" onClick={confirmRun}>Run now</button>
            </div>
          </div>
        </div>
      )}

      {/* Editor modal */}
      {showEditor && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowEditor(false) }}>
          <div className="modal">
            <div className="modal-header">
              <span>{editingId ? 'Edit workflow' : 'New workflow'}</span>
              <button className="close-btn" onClick={() => setShowEditor(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Basic info */}
              <div className="field">
                <label>Name</label>
                <input
                  value={form.name}
                  placeholder="e.g. Weekly competitor digest"
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>Description <span className="opt">(optional)</span></label>
                <input
                  value={form.description}
                  placeholder="What this workflow does"
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              {/* Trigger */}
              <div className="field-row">
                <div className="field">
                  <label>Trigger</label>
                  <select value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}>
                    <option value="manual">Manual — run on demand</option>
                    <option value="meeting_end">After every meeting ends</option>
                    <option value="schedule">Scheduled</option>
                  </select>
                </div>
                {form.trigger === 'schedule' && (
                  <div className="field">
                    <label>Cadence</label>
                    <select value={form.schedule_cadence} onChange={e => setForm(f => ({ ...f, schedule_cadence: e.target.value }))}>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly (Monday)</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Variables */}
              <div className="section-divider">
                <span>Variables</span>
                <span className="section-hint">Use <code>{'{{variable}}'}</code> in step titles and descriptions</span>
                <button className="btn-add-step" onClick={addVar}>+ Add variable</button>
              </div>
              {form.variables.map((v, i) => (
                <div key={i} className="var-row">
                  <input
                    className="var-key"
                    value={v.key}
                    placeholder="key"
                    onChange={e => updateVar(i, 'key', e.target.value)}
                  />
                  <input
                    className="var-label"
                    value={v.label}
                    placeholder="Label shown to user"
                    onChange={e => updateVar(i, 'label', e.target.value)}
                  />
                  <input
                    className="var-ph"
                    value={v.placeholder}
                    placeholder="Placeholder text"
                    onChange={e => updateVar(i, 'placeholder', e.target.value)}
                  />
                  <button className="step-del" onClick={() => removeVar(i)}>✕</button>
                </div>
              ))}
              {!form.variables.length && (
                <p className="no-steps">No variables. Steps run with static text.</p>
              )}

              {/* Steps */}
              <div className="section-divider">
                <span>Steps</span>
                <span className="section-hint">Each step's output is passed to the next as context</span>
                <button className="btn-add-step" onClick={addStep}>+ Add step</button>
              </div>
              {form.steps.map((step, i) => (
                <div key={i} className="step-row">
                  <span className="step-n">{i + 1}</span>
                  <select
                    className="step-agent-sel"
                    value={step.agent}
                    onChange={e => updateStep(i, 'agent', e.target.value)}
                  >
                    {AGENT_TYPES.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <div className="step-inputs">
                    <input
                      className="step-title-input"
                      value={step.task_title}
                      placeholder="Task title… use {{variable}}"
                      onChange={e => updateStep(i, 'task_title', e.target.value)}
                    />
                    <input
                      className="step-desc-input"
                      value={step.task_description}
                      placeholder="Description… use {{variable}}"
                      onChange={e => updateStep(i, 'task_description', e.target.value)}
                    />
                  </div>
                  <button className="step-del" onClick={() => removeStep(i)}>✕</button>
                </div>
              ))}
              {!form.steps.length && (
                <p className="no-steps">No steps yet. Add at least one.</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEditor(false)}>Cancel</button>
              <button
                className="btn-save"
                disabled={!form.name || !form.steps.length}
                onClick={saveWorkflow}
              >
                {editingId ? 'Save changes' : 'Create workflow'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      <style>{`
        .wf-shell { padding-bottom: 40px; }
        .page-desc { font-size: 13px; color: var(--text-2); line-height: 1.6; max-width: 560px; }

        .btn-new {
          padding: 8px 16px; background: var(--accent); color: #fff;
          border: none; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer;
          white-space: nowrap;
        }
        .btn-new:hover { filter: brightness(1.1); }

        /* Empty state */
        .empty-state { padding: 28px 0; }
        .empty-hero {
          display: flex; align-items: center; gap: 16px; padding: 20px;
          background: var(--surface); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 24px;
        }
        .empty-hero-text { display: flex; flex-direction: column; gap: 4px; }
        .empty-hero-text strong { font-size: 15px; font-weight: 600; color: var(--text-1); }
        .empty-hero-text span   { font-size: 13px; color: var(--text-2); }

        .how-it-works { display: flex; flex-direction: column; gap: 14px; margin-bottom: 28px; }
        .how-step { display: flex; gap: 12px; align-items: flex-start; font-size: 13px; color: var(--text-2); line-height: 1.55; }
        .how-step strong { color: var(--text-1); }
        .how-step code { font-family: monospace; background: var(--surface-2); padding: 1px 4px; border-radius: 3px; font-size: 12px; }
        .how-icon {
          width: 30px; height: 30px; border-radius: 8px; background: var(--surface-2);
          border: 1px solid var(--border); display: flex; align-items: center; justify-content: center;
          color: var(--text-2); flex-shrink: 0;
        }

        .template-section-label {
          font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
          color: var(--text-3); margin-bottom: 10px;
        }
        .empty-examples { display: flex; flex-wrap: wrap; gap: 8px; }
        .example-chip {
          padding: 7px 14px; background: var(--surface); border: 1px solid var(--border);
          border-radius: 20px; font-size: 12px; color: var(--text-1); cursor: pointer; transition: all .15s;
        }
        .example-chip:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-soft); }

        /* Workflow cards */
        .wf-list { display: flex; flex-direction: column; gap: 10px; }
        .wf-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
          padding: 16px; transition: border-color .15s;
        }
        .wf-card:hover { border-color: var(--text-3); }
        .wf-card.disabled { opacity: 0.6; }

        .wf-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
        .wf-info { flex: 1; }
        .wf-name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
        .wf-name { font-size: 14px; font-weight: 600; color: var(--text-1); }
        .enabled-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--border); flex-shrink: 0; }
        .enabled-dot.on { background: #10b981; }

        .wf-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
        .trigger-badge {
          font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px;
          text-transform: uppercase; letter-spacing: .04em;
        }
        .trigger-badge.manual      { background: var(--surface-2); color: var(--text-2); }
        .trigger-badge.meeting_end { background: #eff6ff; color: #3b82f6; }
        .trigger-badge.schedule    { background: #f5f3ff; color: #7c3aed; }
        .wf-steps, .wf-runs, .wf-last { font-size: 12px; color: var(--text-3); }
        .wf-desc { font-size: 12px; color: var(--text-2); margin-top: 3px; }

        .var-pills { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
        .var-pill {
          font-size: 10px; padding: 2px 8px; background: #eff6ff; color: #3b82f6;
          border-radius: 10px; font-family: monospace;
        }

        .wf-actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
        .btn-run-wf {
          padding: 6px 14px; background: var(--accent); color: #fff;
          border: none; border-radius: 7px; font-size: 12px; font-weight: 500; cursor: pointer;
        }
        .btn-run-wf:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-run-wf:not(:disabled):hover { filter: brightness(1.1); }
        .btn-edit, .btn-toggle {
          padding: 5px 10px; background: var(--surface-2); border: 1px solid var(--border);
          border-radius: 6px; font-size: 12px; cursor: pointer; color: var(--text-1);
        }
        .btn-edit:hover, .btn-toggle:hover { background: var(--surface-3); }
        .btn-del {
          padding: 5px 8px; background: none; border: none; cursor: pointer;
          color: var(--text-3); font-size: 13px; border-radius: 5px;
        }
        .btn-del:hover { color: #ef4444; background: #fef2f2; }

        /* Steps preview */
        .steps-preview { display: flex; flex-direction: column; gap: 4px; }
        .step-chip { display: flex; align-items: center; gap: 8px; padding: 5px 0; }
        .step-num {
          width: 18px; height: 18px; border-radius: 50%; background: var(--surface-2);
          border: 1px solid var(--border); font-size: 10px; font-weight: 600; color: var(--text-3);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .step-agent {
          font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px;
          text-transform: uppercase; letter-spacing: .04em; flex-shrink: 0;
        }
        .step-agent.research { background: #f5f3ff; color: #7c3aed; }
        .step-agent.writer   { background: #f0fdf4; color: #059669; }
        .step-agent.analyst  { background: #eff6ff; color: #3b82f6; }
        .step-agent.executor { background: #fffbeb; color: #d97706; }
        .step-title {
          font-size: 12px; color: var(--text-1);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        /* Last run */
        .last-run {
          display: flex; align-items: center; gap: 10px; margin-top: 8px;
          padding-top: 8px; border-top: 1px solid var(--border); flex-wrap: wrap;
        }
        .run-status {
          font-size: 10px; font-weight: 700; padding: 2px 8px;
          border-radius: 10px; text-transform: uppercase;
        }
        .run-status.completed { background: #f0fdf4; color: #059669; }
        .run-status.running   { background: #eff6ff; color: #3b82f6; }
        .run-status.failed    { background: #fef2f2; color: #ef4444; }
        .run-meta { font-size: 12px; color: var(--text-3); }
        .run-preview {
          font-size: 12px; color: var(--text-2); overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap; flex: 1;
        }

        /* Modal */
        .modal-backdrop {
          position: fixed; inset: 0; background: rgba(0,0,0,.45);
          display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px;
        }
        .modal {
          background: var(--surface); border: 1px solid var(--border); border-radius: 12px;
          width: 620px; max-width: 100%; max-height: 85vh; overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0,0,0,.3); display: flex; flex-direction: column;
        }
        .modal.modal-sm { width: 420px; }
        .modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 18px; border-bottom: 1px solid var(--border);
          font-weight: 500; font-size: 14px; color: var(--text-1); flex-shrink: 0;
        }
        .close-btn { background: none; border: none; cursor: pointer; color: var(--text-3); font-size: 14px; padding: 2px 5px; }
        .close-btn:hover { color: var(--text-1); }
        .modal-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
        .modal-footer {
          display: flex; justify-content: flex-end; gap: 8px;
          padding: 12px 18px; border-top: 1px solid var(--border); flex-shrink: 0;
        }

        /* Form fields */
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field label { font-size: 12px; font-weight: 500; color: var(--text-2); }
        .field input, .field select {
          padding: 8px 10px; border: 1.5px solid var(--border); border-radius: 7px;
          font-size: 13px; font-family: inherit; background: var(--surface); color: var(--text-1); outline: none;
        }
        .field input:focus, .field select:focus { border-color: var(--accent); }
        .field-row { display: flex; gap: 10px; }
        .field-row .field { flex: 1; }
        .opt { font-size: 10px; color: var(--text-3); font-weight: 400; }
        .hint { font-size: 11px; color: var(--text-3); }

        /* Section divider */
        .section-divider {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 0 4px; border-top: 1px solid var(--border); margin-top: 4px;
        }
        .section-divider > span:first-child { font-size: 12px; font-weight: 600; color: var(--text-1); }
        .section-hint { font-size: 11px; color: var(--text-3); flex: 1; }
        .section-hint code { font-family: monospace; background: var(--surface-2); padding: 1px 4px; border-radius: 3px; }
        .btn-add-step {
          padding: 4px 10px; background: var(--surface-2); border: 1px solid var(--border);
          border-radius: 6px; font-size: 11px; cursor: pointer; color: var(--text-2); flex-shrink: 0;
        }
        .btn-add-step:hover { border-color: var(--accent); color: var(--accent); }

        /* Variable rows */
        .var-row { display: flex; gap: 6px; align-items: center; }
        .var-key, .var-label, .var-ph {
          padding: 7px 9px; border: 1.5px solid var(--border); border-radius: 6px;
          font-size: 12px; font-family: inherit; background: var(--surface); color: var(--text-1); outline: none;
        }
        .var-key:focus, .var-label:focus, .var-ph:focus { border-color: var(--accent); }
        .var-key   { width: 100px; flex-shrink: 0; }
        .var-label { flex: 1; }
        .var-ph    { flex: 1; }

        /* Step rows */
        .step-row { display: flex; gap: 8px; align-items: flex-start; }
        .step-n {
          width: 22px; height: 22px; border-radius: 50%; background: var(--surface-2);
          border: 1px solid var(--border); font-size: 11px; font-weight: 600; color: var(--text-2);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 6px;
        }
        .step-agent-sel {
          padding: 7px 8px; border: 1.5px solid var(--border); border-radius: 6px;
          font-size: 12px; font-family: inherit; background: var(--surface); color: var(--text-1);
          outline: none; flex-shrink: 0; width: 100px;
        }
        .step-agent-sel:focus { border-color: var(--accent); }
        .step-inputs { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .step-title-input, .step-desc-input {
          padding: 7px 9px; border: 1.5px solid var(--border); border-radius: 6px;
          font-size: 12px; font-family: inherit; background: var(--surface); color: var(--text-1);
          outline: none; width: 100%; box-sizing: border-box;
        }
        .step-title-input:focus, .step-desc-input:focus { border-color: var(--accent); }
        .step-desc-input { color: var(--text-2); }
        .step-del {
          background: none; border: none; cursor: pointer; color: var(--text-3);
          font-size: 12px; padding: 4px 6px; border-radius: 4px; flex-shrink: 0; margin-top: 4px;
        }
        .step-del:hover { color: #ef4444; background: #fef2f2; }
        .no-steps { font-size: 12px; color: var(--text-3); padding: 4px 0; margin: 0; }
        .var-hint { font-size: 13px; color: var(--text-2); margin: 0 0 4px; }

        .btn-cancel {
          padding: 7px 14px; border: 1.5px solid var(--border); border-radius: 7px;
          background: var(--surface); color: var(--text-1); cursor: pointer; font-size: 13px;
        }
        .btn-save {
          padding: 7px 16px; background: var(--accent); color: #fff;
          border: none; border-radius: 7px; cursor: pointer; font-size: 13px; font-weight: 500;
        }
        .btn-save:disabled { opacity: 0.4; cursor: not-allowed; }
        .btn-save:not(:disabled):hover { filter: brightness(1.1); }

        /* Toast */
        .toast {
          position: fixed; bottom: 100px; right: 24px;
          background: var(--text-1); color: var(--surface);
          padding: 9px 18px; border-radius: 8px; font-size: 13px; z-index: 999;
          box-shadow: 0 8px 24px rgba(0,0,0,.2);
        }
      `}</style>
    </div>
  )
}
