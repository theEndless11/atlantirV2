'use client'

/**
 * Memory tab UI — /workspace/[id]/memory
 * FIXED: Removed duplicate parallel fetch (was calling /api/memory twice on mount).
 * Now uses a single fetch for the file list.
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface MemoryFileMeta {
  id: string
  path: string
  updated_by: string
  updated_at: string
}

interface TreeNode {
  name: string
  fullPath: string
  isFile: boolean
  children: TreeNode[]
  meta?: MemoryFileMeta
}

function buildTree(files: MemoryFileMeta[]): TreeNode[] {
  const root: TreeNode[] = []
  for (const file of files) {
    const parts = file.path.split('/')
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isFile = i === parts.length - 1
      const fullPath = parts.slice(0, i + 1).join('/')
      let node = current.find((n) => n.name === part)
      if (!node) {
        node = { name: part, fullPath, isFile, children: [], meta: isFile ? file : undefined }
        current.push(node)
      }
      current = node.children
    }
  }
  return root
}

function isAgentWritten(updatedBy: string) { return !updatedBy.startsWith('user:') }

function formatRelTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function TreeItem({ node, selectedPath, onSelect, depth = 0 }: {
  node: TreeNode; selectedPath: string | null; onSelect: (path: string) => void; depth?: number
}) {
  const [open, setOpen] = useState(depth === 0)

  if (node.isFile) {
    const agent = node.meta ? isAgentWritten(node.meta.updated_by) : false
    return (
      <button
        onClick={() => onSelect(node.fullPath)}
        style={{ paddingLeft: `${12 + depth * 14}px` }}
        className={`tree-file${selectedPath === node.fullPath ? ' selected' : ''}`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.5 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <span className="tree-file-name">{node.name}</span>
        {agent && <span className="badge-agent">AI</span>}
        {node.meta && <span className="tree-meta">{formatRelTime(node.meta.updated_at)}</span>}
      </button>
    )
  }

  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} style={{ paddingLeft: `${12 + depth * 14}px` }} className="tree-folder">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, opacity: 0.6 }}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span className="tree-folder-name">{node.name}</span>
      </button>
      {open && (
        <div>
          {node.children.map((child) => (
            <TreeItem key={child.fullPath} node={child} selectedPath={selectedPath} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function MemoryPage() {
  const params = useParams()
  const workspaceId = Array.isArray(params.id) ? params.id[0] : (params.id as string)

  const [files, setFiles] = useState<MemoryFileMeta[]>([])
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [editorContent, setEditorContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [editorLoading, setEditorLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [newFilePath, setNewFilePath] = useState('')
  const [showNewFile, setShowNewFile] = useState(false)

  // Single fetch — no duplicate parallel call
  const loadTree = useCallback(async () => {
    try {
      const res = await fetch(`/api/memory?workspaceId=${workspaceId}`)
      if (!res.ok) throw new Error('Failed to load memory files')
      const json = await res.json()
      if (Array.isArray(json.files)) {
        setFiles(json.files)
      }
    } catch {
      setError('Could not load memory files')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => { loadTree() }, [loadTree])

  const loadFile = useCallback(async (path: string) => {
    setEditorLoading(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/memory?workspaceId=${workspaceId}&path=${encodeURIComponent(path)}`)
      if (!res.ok) throw new Error('Failed to load file')
      const json = await res.json()
      setEditorContent(json.content ?? '')
      setSavedContent(json.content ?? '')
    } catch {
      setSaveError('Failed to load file content')
    } finally {
      setEditorLoading(false)
    }
  }, [workspaceId])

  const handleSelect = (path: string) => {
    setSelectedPath(path)
    loadFile(path)
    setShowNewFile(false)
  }

  const handleSave = async () => {
    if (!selectedPath) return
    setSaving(true); setSaveError(null)
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, path: selectedPath, content: editorContent, action: 'update' }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Save failed')
      setSavedContent(editorContent)
      loadTree()
    } catch (err: any) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    const path = newFilePath.trim()
    if (!path) return
    setSaving(true); setSaveError(null)
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, path, content: `# ${path}\n\n`, action: 'create' }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Create failed')
      setShowNewFile(false); setNewFilePath('')
      await loadTree()
      setSelectedPath(path)
      setEditorContent(`# ${path}\n\n`)
      setSavedContent(`# ${path}\n\n`)
    } catch (err: any) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedPath) return
    if (!confirm(`Delete ${selectedPath}? This cannot be undone.`)) return
    try {
      const res = await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, path: selectedPath, action: 'delete' }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Delete failed')
      setSelectedPath(null); setEditorContent(''); setSavedContent('')
      loadTree()
    } catch (err: any) {
      setSaveError(err.message)
    }
  }

  const tree = buildTree(files)
  const isDirty = editorContent !== savedContent
  const selectedMeta = files.find((f) => f.path === selectedPath)

  return (
    <div className="mem-shell">
      <aside className="mem-sidebar">
        <div className="mem-sidebar-header">
          <span className="mem-sidebar-title">Memory Files</span>
          <button className="mem-new-btn" onClick={() => { setShowNewFile(true); setSelectedPath(null) }} title="New file">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </button>
        </div>
        <div className="mem-tree">
          {loading ? (
            <div className="mem-loading">
              <div className="mem-skeleton" /><div className="mem-skeleton short" /><div className="mem-skeleton" />
            </div>
          ) : error ? (
            <div className="mem-error">{error}</div>
          ) : tree.length === 0 ? (
            <div className="mem-empty">No memory files yet.<br />Click <strong>New</strong> to create one.</div>
          ) : (
            tree.map((node) => (
              <TreeItem key={node.fullPath} node={node} selectedPath={selectedPath} onSelect={handleSelect} />
            ))
          )}
        </div>
      </aside>

      <main className="mem-editor-area">
        {showNewFile ? (
          <div className="mem-new-panel">
            <div className="mem-editor-topbar">
              <span className="mem-filepath">New file</span>
            </div>
            <div className="mem-new-form">
              <label className="mem-new-label">File path</label>
              <input
                className="mem-new-input"
                placeholder="e.g. company.md or projects/roadmap.md"
                value={newFilePath}
                onChange={(e) => setNewFilePath(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                autoFocus
              />
              {saveError && <div className="mem-save-error">{saveError}</div>}
              <div className="mem-new-actions">
                <button className="mem-btn-secondary" onClick={() => { setShowNewFile(false); setSaveError(null) }}>Cancel</button>
                <button className="mem-btn-primary" onClick={handleCreate} disabled={saving || !newFilePath.trim()}>
                  {saving ? 'Creating…' : 'Create file'}
                </button>
              </div>
            </div>
          </div>
        ) : selectedPath ? (
          <>
            <div className="mem-editor-topbar">
              <div className="mem-filepath-row">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.4 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="mem-filepath">{selectedPath}</span>
                {selectedMeta && isAgentWritten(selectedMeta.updated_by) && <span className="badge-agent">AI-written</span>}
                {selectedMeta && !isAgentWritten(selectedMeta.updated_by) && <span className="badge-user">User-edited</span>}
                {isDirty && <span className="badge-unsaved">Unsaved</span>}
              </div>
              <div className="mem-topbar-actions">
                {selectedMeta && (
                  <span className="mem-meta-text">
                    Last saved {formatRelTime(selectedMeta.updated_at)}
                    {selectedMeta.updated_by !== 'unknown' && ` by ${selectedMeta.updated_by}`}
                  </span>
                )}
                <button className="mem-btn-danger" onClick={handleDelete} title="Delete file">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                  </svg>
                </button>
                <button className="mem-btn-primary" onClick={handleSave} disabled={saving || !isDirty}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
            {saveError && <div className="mem-save-error-bar">{saveError}</div>}
            {editorLoading ? (
              <div className="mem-editor-skeleton">
                <div className="mem-sk-line w80" /><div className="mem-sk-line w60" />
                <div className="mem-sk-line w90" /><div className="mem-sk-line w50" />
                <div className="mem-sk-line w70" />
              </div>
            ) : (
              <textarea
                className="mem-textarea"
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                spellCheck={false}
                placeholder="File content (markdown)…"
              />
            )}
          </>
        ) : (
          <div className="mem-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.2 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <p>Select a file to view or edit it</p>
          </div>
        )}
      </main>

      <style>{`
        .mem-shell { display:flex; height:100%; overflow:hidden; background:var(--bg); color:var(--text-1); font-family:inherit; }
        .mem-sidebar { width:240px; flex-shrink:0; border-right:1px solid var(--border); display:flex; flex-direction:column; overflow:hidden; background:var(--surface); }
        .mem-sidebar-header { display:flex; align-items:center; justify-content:space-between; padding:14px 14px 10px; border-bottom:1px solid var(--border); }
        .mem-sidebar-title { font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; color:var(--text-3); }
        .mem-new-btn { display:flex; align-items:center; gap:4px; font-size:12px; font-weight:500; color:var(--accent); background:none; border:none; cursor:pointer; padding:3px 6px; border-radius:5px; transition:background .15s; }
        .mem-new-btn:hover { background:var(--accent-soft); }
        .mem-tree { flex:1; overflow-y:auto; padding:6px 0; }
        .tree-folder { display:flex; align-items:center; gap:6px; width:100%; background:none; border:none; cursor:pointer; padding:5px 0; color:var(--text-2); font-size:13px; font-weight:500; text-align:left; transition:background .1s; }
        .tree-folder:hover { background:var(--surface-2); }
        .tree-folder-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .tree-file { display:flex; align-items:center; gap:6px; width:100%; background:none; border:none; cursor:pointer; padding:4px 0; color:var(--text-2); font-size:12.5px; text-align:left; border-radius:0; transition:background .1s; }
        .tree-file:hover { background:var(--surface-2); }
        .tree-file.selected { background:var(--accent-soft); color:var(--accent); }
        .tree-file-name { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .tree-meta { font-size:10px; color:var(--text-3); flex-shrink:0; }
        .badge-agent { font-size:9px; font-weight:700; letter-spacing:.04em; padding:1px 5px; border-radius:10px; background:rgba(139,92,246,.15); color:#8b5cf6; flex-shrink:0; text-transform:uppercase; }
        .badge-user  { font-size:9px; font-weight:700; letter-spacing:.04em; padding:1px 5px; border-radius:10px; background:rgba(34,197,94,.12); color:#16a34a; flex-shrink:0; text-transform:uppercase; }
        .badge-unsaved { font-size:9px; font-weight:700; padding:1px 5px; border-radius:10px; background:rgba(234,179,8,.15); color:#ca8a04; flex-shrink:0; text-transform:uppercase; }
        .mem-editor-area { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; background:var(--bg); color:var(--text-1); }
        .mem-editor-topbar { display:flex; align-items:center; justify-content:space-between; padding:10px 16px; border-bottom:1px solid var(--border); background:var(--surface); gap:12px; flex-shrink:0; flex-wrap:wrap; }
        .mem-filepath-row { display:flex; align-items:center; gap:7px; min-width:0; }
        .mem-filepath { font-size:13px; font-weight:500; color:var(--text-1); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .mem-topbar-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
        .mem-meta-text { font-size:11px; color:var(--text-3); white-space:nowrap; }
        .mem-textarea { flex:1; resize:none; padding:20px 24px; font-family:'ui-monospace','SFMono-Regular','Menlo',monospace; font-size:13.5px; line-height:1.65; background:var(--bg); color:var(--text-1); border:none; outline:none; width:100%; box-sizing:border-box; }
        .mem-btn-primary { height:30px; padding:0 14px; border-radius:7px; background:var(--accent); color:#fff; font-size:12.5px; font-weight:600; border:none; cursor:pointer; transition:opacity .15s; }
        .mem-btn-primary:disabled { opacity:0.45; cursor:not-allowed; }
        .mem-btn-primary:not(:disabled):hover { opacity:.88; }
        .mem-btn-secondary { height:30px; padding:0 14px; border-radius:7px; background:var(--surface-2); color:var(--text-1); font-size:12.5px; font-weight:500; border:1px solid var(--border); cursor:pointer; transition:background .15s; }
        .mem-btn-secondary:hover { background:var(--surface-3,var(--surface)); }
        .mem-btn-danger { height:30px; width:30px; border-radius:7px; background:none; color:var(--text-3); border:1px solid var(--border); cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .15s; }
        .mem-btn-danger:hover { background:var(--red-soft); color:var(--red-text); border-color:var(--red-text); }
        .mem-new-panel { display:flex; flex-direction:column; overflow:hidden; }
        .mem-new-form { padding:24px; display:flex; flex-direction:column; gap:12px; max-width:480px; background:var(--bg); flex:1; }
        .mem-new-label { font-size:12px; font-weight:600; color:var(--text-2); }
        .mem-new-input { height:36px; padding:0 12px; border-radius:8px; border:1px solid var(--border); background:var(--bg); color:var(--text-1); font-size:13px; outline:none; font-family:monospace; }
        .mem-new-input:focus { border-color:var(--accent); }
        .mem-new-actions { display:flex; gap:8px; }
        .mem-save-error { font-size:12px; color:var(--red-text,#ef4444); }
        .mem-save-error-bar { padding:8px 16px; background:var(--red-soft,rgba(239,68,68,.1)); color:var(--red-text,#ef4444); font-size:12px; flex-shrink:0; }
        .mem-loading { padding:16px; display:flex; flex-direction:column; gap:8px; }
        .mem-skeleton { height:12px; border-radius:6px; background:var(--surface-2); animation:shimmer 1.4s infinite; }
        .mem-skeleton.short { width:60%; }
        @keyframes shimmer { 0%,100%{opacity:.5} 50%{opacity:1} }
        .mem-editor-skeleton { padding:20px 24px; display:flex; flex-direction:column; gap:10px; }
        .mem-sk-line { height:13px; border-radius:5px; background:var(--surface-2); animation:shimmer 1.4s infinite; }
        .mem-sk-line.w80 { width:80%; } .mem-sk-line.w60 { width:60%; } .mem-sk-line.w90 { width:90%; } .mem-sk-line.w50 { width:50%; } .mem-sk-line.w70 { width:70%; }
        .mem-empty, .mem-error { padding:16px; font-size:12.5px; color:var(--text-3); line-height:1.5; }
        .mem-error { color:var(--red-text,#ef4444); }
        .mem-placeholder { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; background:var(--bg); color:var(--text-3); }
        .mem-placeholder p { font-size:13px; margin:0; }
        @media (max-width:640px) {
          .mem-sidebar { width:100%; height:200px; flex-shrink:0; border-right:none; border-bottom:1px solid var(--border); }
          .mem-shell { flex-direction:column; }
          .mem-editor-topbar { flex-direction:column; align-items:flex-start; gap:8px; }
          .mem-topbar-actions { width:100%; justify-content:flex-end; }
          .mem-meta-text { display:none; }
        }
      `}</style>
    </div>
  )
}
