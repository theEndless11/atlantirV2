'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface WorkspaceFile {
  id: string; filename: string; size_bytes: number; mime_type: string
  created_at: string; embedding_meta?: any
}

const SUGGESTIONS = [
  { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>, title: 'Company overview', desc: 'Mission, values, team structure, product description' },
  { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>, title: 'Product docs', desc: 'Features, pricing, FAQs, release notes' },
  { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, title: 'Email templates', desc: 'Sales outreach, onboarding, support responses' },
  { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, title: 'Strategy docs', desc: 'OKRs, roadmaps, competitive analysis' },
  { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>, title: 'SOPs & playbooks', desc: 'How processes work, who owns what' },
  { icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="12" y1="17" x2="8" y2="17"/></svg>, title: 'Meeting notes', desc: 'Past decisions, action items, context' },
]

function formatSize(bytes?: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}
function formatDate(ts: string) { return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) }
function fileType(f: WorkspaceFile) {
  if (f.mime_type === 'application/pdf') return 'pdf'
  if (f.mime_type?.includes('wordprocessingml')) return 'doc'
  return 'txt'
}
function indexStatus(f: WorkspaceFile) {
  const s = f.embedding_meta?.status
  if (s === 'indexed') return 'indexed'
  if (s === 'index_failed') return 'failed'
  return 'pending'
}
function indexLabel(f: WorkspaceFile) {
  const s = indexStatus(f)
  if (s === 'indexed') return `${f.embedding_meta?.chunks || 0} chunks`
  if (s === 'failed') return 'Index failed'
  return 'Indexing…'
}


function MemoryFilesPreview({ workspaceId }: { workspaceId: string }) {
  const [files, setFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/memory?workspaceId=${workspaceId}`, { credentials: 'include' })
      .then(async r => {
        if (!r.ok) {
          console.warn('[Memory] API error', r.status, await r.text().catch(() => ''))
          return { files: [] }
        }
        return r.json()
      })
      .then(data => { setFiles(data?.files ?? []); setLoading(false) })
      .catch(err => { console.warn('[Memory] fetch failed', err); setLoading(false) })
  }, [workspaceId])

  if (loading) return <div style={{ fontSize:12, color:'var(--text-3)', padding:'8px 0' }}>Loading memory…</div>

  if (files.length === 0) return (
    <div className="memory-empty">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity:0.3 }}><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>
      <p>No memory files yet. Agents will write here as they complete tasks — recording decisions, learnings, and company context for future use.</p>
    </div>
  )

  return (
    <div className="memory-file-list">
      {files.map((f: any) => (
        <div key={f.path} className="memory-file-row">
          <div className="memory-file-icon">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div className="memory-file-info">
            <span className="memory-file-path">{f.path}</span>
            {f.description && <span className="memory-file-desc">{f.description}</span>}
          </div>
          <span className="memory-file-updated">{f.updated_at ? new Date(f.updated_at).toLocaleDateString([], { month:'short', day:'numeric' }) : ''}</span>
        </div>
      ))}
      <a href={`/workspace/${workspaceId}/memory`} className="memory-view-all">
        View all memory files →
      </a>
    </div>
  )
}

export default function FilesPage() {
  const params = useParams()
  const workspaceId = Array.isArray(params.id) ? params.id[0] : params.id as string

  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const totalChunks = files.reduce((sum, f) => sum + (f.embedding_meta?.chunks || 0), 0)
  const totalBytes = files.reduce((sum, f) => sum + (f.size_bytes || 0), 0)

  async function loadFiles() {
    setLoading(true)
    try {
      const res = await fetch(`/api/files?workspace_id=${workspaceId}`)
      setFiles(await res.json() || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { loadFiles() }, [workspaceId])

  async function uploadFiles(fileList: FileList) {
    setUploading(true); setUploadProgress(0)
    const total = fileList.length
    for (let i = 0; i < total; i++) {
      const file = fileList[i]
      setUploadStatus(`Uploading ${file.name}…`)
      setUploadProgress(Math.round((i / total) * 80))
      const form = new FormData()
      form.append('file', file)
      form.append('workspace_id', workspaceId)
      try { await fetch('/api/files', { method: 'POST', body: form }) }
      catch (err: any) { alert(`Failed: ${err.message}`) }
    }
    setUploadProgress(100); setUploadStatus('Done!')
    await loadFiles()
    setTimeout(() => setUploading(false), 1200)
  }

  async function deleteFile(fileId: string) {
    if (!confirm('Delete this file and its indexed chunks?')) return
    await fetch(`/api/files?file_id=${fileId}`, { method: 'DELETE' })
    setFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
  }, [])

  return (
    <div className="page-shell kb-shell"
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {dragOver && <div className="drop-overlay"><div className="drop-message">Drop files to upload</div></div>}

      <div className="page-header">
        <div>
          <h1>Knowledge base</h1>
          <p>Everything agents know about your company — docs, guides, context</p>
        </div>
        <label className="btn btn-primary upload-label">
          <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.txt,.md" onChange={e => e.target.files && uploadFiles(e.target.files)} style={{ display: 'none' }} />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          <span>{uploading ? 'Uploading…' : 'Upload files'}</span>
        </label>
      </div>

      {uploading && (
        <div className="upload-progress">
          <div className="upload-fill" style={{ width: uploadProgress + '%' }} />
          <span>{uploadStatus}</span>
        </div>
      )}

      <div className="knowledge-banner">
        <div className="banner-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
        </div>
        <div className="banner-content">
          <div className="banner-title">How agents use this knowledge</div>
          <p className="banner-desc">Every file you upload is chunked and semantically indexed. When an agent runs a task, it searches this knowledge base and injects the most relevant passages into its context automatically.</p>
          <div className="banner-capabilities">
            {['Company-specific answers', 'Personalised writing & emails', 'Context-aware research', 'Accurate internal references'].map(c => (
              <div key={c} className="cap-chip">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                {c}
              </div>
            ))}
          </div>
        </div>
        {files.length > 0 && (
          <div className="banner-stats">
            <div className="stat-block"><span className="stat-big">{files.length}</span><span className="stat-label">Files</span></div>
            <div className="stat-divider" />
            <div className="stat-block"><span className="stat-big">{totalChunks}</span><span className="stat-label">Chunks indexed</span></div>
            <div className="stat-divider" />
            <div className="stat-block"><span className="stat-big">{formatSize(totalBytes)}</span><span className="stat-label">Total size</span></div>
          </div>
        )}
      </div>

      {!loading && !files.length && (
        <div className="empty-guide">
          <div className="empty-title">Your knowledge base is empty</div>
          <p className="empty-subtitle">Add files to give agents company-specific context. Here are the best things to upload:</p>
          <div className="suggestions-grid">
            {SUGGESTIONS.map(s => (
              <div key={s.title} className="suggestion-card">
                <div className="sug-icon">{s.icon}</div>
                <div className="sug-body"><div className="sug-title">{s.title}</div><div className="sug-desc">{s.desc}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-row"><div className="spinner spinner-dark" /> Loading files…</div>
      ) : files.length > 0 ? (
        <div className="files-section">
          <div className="section-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            All files
          </div>
          <div className="files-list">
            {files.map(file => (
              <div key={file.id} className="file-row">
                <div className={`file-icon ${fileType(file)}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                </div>
                <div className="file-info">
                  <span className="file-name">{file.filename}</span>
                  <span className="file-meta">{formatSize(file.size_bytes)} · {formatDate(file.created_at)}</span>
                </div>
                <div className={`file-badge ${indexStatus(file)}`}>
                  {indexStatus(file) === 'indexed' ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    : indexStatus(file) === 'failed' ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      : <div className="badge-spinner" />}
                  {indexLabel(file)}
                </div>
                <button className="btn-icon file-del" onClick={() => deleteFile(file.id)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6m4-6v6" /><path d="M9 6V4h6v2" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}


      <div className="memory-panel">
        <div className="memory-panel-header">
          <div className="memory-panel-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>
          </div>
          <div>
            <div className="memory-panel-title">What agents know about your workspace</div>
            <div className="memory-panel-sub">Structured memory files — written and updated by agents during tasks</div>
          </div>
        </div>
        <MemoryFilesPreview workspaceId={workspaceId} />
      </div>

      <div className="formats-note">Supported: PDF, Word (.docx), plain text (.txt), Markdown (.md) · Max 20MB per file</div>

      <style>{`
        .kb-shell { padding-bottom: 40px; }
        .drop-overlay { position: fixed; inset: 0; background: rgba(99,102,241,.08); border: 2px dashed var(--accent); z-index: 100; display: flex; align-items: center; justify-content: center; pointer-events: none; }
        .drop-message { font-size: 18px; font-weight: 600; color: var(--accent); }
        .upload-label { cursor: pointer; display: flex; align-items: center; gap: 7px; }
        .upload-progress { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; padding: 8px 0; border-bottom: 1px solid var(--border); }
        .upload-fill { height: 2px; background: var(--accent); border-radius: 2px; flex-shrink: 0; transition: width .3s; }
        .upload-progress span { font-size: 12px; color: var(--text-3); }

        /* ── Banner — flat, no card ── */
        .knowledge-banner { display: flex; gap: 18px; align-items: flex-start; padding: 16px 0 20px; border-bottom: 1px solid var(--border); margin-bottom: 0; }
        .banner-icon { width: 36px; height: 36px; border-radius: 8px; background: var(--surface-2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-2); flex-shrink: 0; }
        .banner-content { flex: 1; }
        .banner-title { font-size: 13px; font-weight: 600; color: var(--text-1); margin-bottom: 4px; }
        .banner-desc { font-size: 12px; color: var(--text-3); line-height: 1.6; margin-bottom: 10px; }
        .banner-capabilities { display: flex; flex-wrap: wrap; gap: 5px; }
        .cap-chip { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-2); background: var(--surface-2); padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border); }
        .banner-stats { display: flex; align-items: center; flex-shrink: 0; gap: 0; }
        .stat-block { display: flex; flex-direction: column; align-items: flex-end; padding: 4px 16px; border-left: 1px solid var(--border); }
        .stat-block:first-child { border-left: none; }
        .stat-big   { font-size: 18px; font-weight: 700; color: var(--text-1); line-height: 1; }
        .stat-label { font-size: 10px; color: var(--text-3); margin-top: 2px; white-space: nowrap; }
        .stat-divider { display: none; }

        /* ── Section labels ── */
        .section-label { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--text-3); padding: 16px 0 8px; }

        /* ── Empty guide ── */
        .empty-guide { padding: 20px 0; border-top: 1px solid var(--border); }
        .empty-title { font-size: 14px; font-weight: 600; color: var(--text-1); margin-bottom: 4px; }
        .empty-subtitle { font-size: 13px; color: var(--text-3); margin-bottom: 16px; }
        .suggestions-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1px; background: var(--border); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
        .suggestion-card { display: flex; gap: 12px; padding: 14px; background: var(--surface); }
        .sug-icon  { width: 28px; height: 28px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-2); flex-shrink: 0; }
        .sug-title { font-size: 13px; font-weight: 500; color: var(--text-1); margin-bottom: 2px; }
        .sug-desc  { font-size: 11px; color: var(--text-3); line-height: 1.5; }

        .loading-row { display: flex; align-items: center; gap: 10px; color: var(--text-3); font-size: 13px; padding: 24px 0; }

        /* ── File list — flat rows, no individual cards ── */
        .files-section { margin-bottom: 0; }
        .files-list { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
        .file-row { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: var(--surface); border-bottom: 1px solid var(--border); transition: background .1s; }
        .file-row:last-child { border-bottom: none; }
        .file-row:hover { background: var(--surface-2); }
        .file-icon { width: 28px; height: 28px; border-radius: 5px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .file-icon.pdf { background: var(--surface-2); color: var(--text-2); }
        .file-icon.doc { background: var(--surface-2); color: var(--text-2); }
        .file-icon.txt { background: var(--surface-2); color: var(--text-3); }
        .file-info  { flex: 1; min-width: 0; }
        .file-name  { font-size: 13px; font-weight: 500; color: var(--text-1); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .file-meta  { font-size: 11px; color: var(--text-3); }
        .file-badge { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 4px; white-space: nowrap; border: 1px solid var(--border); }
        .file-badge.indexed { background: var(--surface-2); color: var(--text-2); border-color: var(--border); }
        .file-badge.failed  { background: var(--surface-2); color: var(--text-2); }
        .file-badge.pending { background: var(--surface-2); color: var(--text-3); }
        .badge-spinner { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid currentColor; border-top-color: transparent; animation: spin .7s linear infinite; }
        .file-del { color: var(--text-3); }
        .file-del:hover { color: var(--text-1); background: var(--surface-3); }
        .formats-note { font-size: 11px; color: var(--text-3); margin-top: 10px; }
        .spinner { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--border); border-top-color: var(--accent); animation: spin .7s linear infinite; display: inline-block; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Memory panel — flat section, not a card ── */
        .memory-panel { margin-top: 32px; border-top: 1px solid var(--border); }
        .memory-panel-header { display: flex; align-items: flex-start; gap: 12px; padding: 16px 0 12px; }
        .memory-panel-icon { width: 28px; height: 28px; border-radius: 6px; background: var(--surface-2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: var(--text-2); flex-shrink: 0; }
        .memory-panel-title { font-size: 13px; font-weight: 600; color: var(--text-1); }
        .memory-panel-sub { font-size: 11px; color: var(--text-3); margin-top: 2px; }
        .memory-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 28px 0; text-align: center; color: var(--text-3); }
        .memory-empty p { font-size: 12px; max-width: 340px; line-height: 1.6; margin: 0; }
        .memory-file-list { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
        .memory-file-row { display: flex; align-items: center; gap: 10px; padding: 9px 14px; background: var(--surface); border-bottom: 1px solid var(--border); }
        .memory-file-row:last-of-type { border-bottom: none; }
        .memory-file-icon { width: 22px; height: 22px; border-radius: 4px; background: var(--surface-2); display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0; }
        .memory-file-info { flex: 1; min-width: 0; }
        .memory-file-path { font-size: 12px; font-weight: 500; color: var(--text-1); font-family: monospace; display: block; }
        .memory-file-desc { font-size: 11px; color: var(--text-3); display: block; margin-top: 1px; }
        .memory-file-updated { font-size: 11px; color: var(--text-3); flex-shrink: 0; }
        .memory-view-all { display: block; text-align: center; padding: 9px; font-size: 12px; color: var(--accent); text-decoration: none; border-top: 1px solid var(--border); }
        .memory-view-all:hover { background: var(--accent-soft); }

      `}</style>
    </div>
  )
}