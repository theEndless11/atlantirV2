'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase-browser'

interface Props {
  show: boolean
  taskId: string | null
  taskTitle: string
  onClose: () => void
  onDone: () => void
}

const petEmojis: Record<string, string> = { Scout: '🔍', Bolt: '⚡', Sage: '🧠', Quill: '✍️', Link: '🔗' }
function petEmoji(name: string) { return petEmojis[name] || '🤖' }
function formatTime(ts: string) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
function renderMd(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^# (.*)/gm, '<h3>$1</h3>')
    .replace(/^## (.*)/gm, '<h4>$1</h4>')
    .replace(/^- (.*)/gm, '<li>$1</li>')
    .replace(/\n/g, '<br>')
}

export default function PipelineOverlay({ show, taskId, taskTitle, onClose, onDone }: Props) {
  const supabase = createClient()
  const [pipeline, setPipeline] = useState<any[]>([])
  const [allUpdates, setAllUpdates] = useState<any[]>([])
  const [showThinking, setShowThinking] = useState(false)
  const thinkingEl = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const thinkingUpdates = useMemo(() => allUpdates.filter(u => u.update_type === 'progress'), [allUpdates])
  const finalOutput = useMemo(() => {
    const linkUpdates = allUpdates.filter(u => u.pet_name === 'Link' && u.update_type === 'progress')
    return linkUpdates.length ? linkUpdates[linkUpdates.length - 1].content : ''
  }, [allUpdates])
  const allDone = useMemo(() => pipeline.length > 0 && pipeline.every(s => ['completed', 'failed', 'skipped'].includes(s.status)), [pipeline])
  const hasError = useMemo(() => pipeline.some(s => s.status === 'failed'), [pipeline])
  const currentPet = useMemo(() => { const r = pipeline.find(s => s.status === 'running'); return r ? `${petEmoji(r.pet_name)} ${r.pet_name}` : null }, [pipeline])
  const currentPetEmoji = useMemo(() => { const r = pipeline.find(s => s.status === 'running'); return r ? petEmoji(r.pet_name) : '' }, [pipeline])

  useEffect(() => {
    if (!taskId) return
    setPipeline([])
    setAllUpdates([])
    const channel = supabase.channel(`overlay:${taskId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_pipeline', filter: `task_id=eq.${taskId}` }, p => {
        const step = p.new as any
        setPipeline(prev => {
          const idx = prev.findIndex(s => s.id === step.id)
          const updated = idx !== -1 ? prev.map((s, i) => i === idx ? step : s) : [...prev, step]
          return updated.sort((a, b) => a.step_index - b.step_index)
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_updates', filter: `task_id=eq.${taskId}` }, p => {
        setAllUpdates(prev => [...prev, p.new])
        setTimeout(() => { if (thinkingEl.current) thinkingEl.current.scrollTop = thinkingEl.current.scrollHeight }, 0)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [taskId])

  useEffect(() => { if (allDone) onDone() }, [allDone])

  if (!mounted || !show) return null

  const overlay = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ width: 680, maxWidth: '100vw', maxHeight: '70vh', background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px 16px 0 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.12)', display: 'flex', flexDirection: 'column', pointerEvents: 'all' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: allDone ? '#10b981' : hasError ? '#ef4444' : '#6366f1', animation: allDone || hasError ? 'none' : 'pulse 1.5s infinite', display: 'inline-block' }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: '#111827', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{taskTitle}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setShowThinking(!showThinking)} style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
              {showThinking ? 'Hide thinking' : 'Show thinking'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        {/* Pipeline bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 18px', borderBottom: '1px solid #f9fafb', flexShrink: 0, overflowX: 'auto' }}>
          {!pipeline.length
            ? <span style={{ fontSize: 12, color: '#d1d5db', fontStyle: 'italic' }}>Initializing pipeline...</span>
            : pipeline.map((step, i) => (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, position: 'relative',
                    background: step.status === 'running' ? '#eef2ff' : step.status === 'completed' ? '#f0fdf4' : step.status === 'failed' ? '#fef2f2' : '#f9fafb',
                    border: `1.5px solid ${step.status === 'running' ? '#6366f1' : step.status === 'completed' ? '#10b981' : step.status === 'failed' ? '#ef4444' : '#e5e7eb'}`,
                    opacity: step.status === 'waiting' ? 0.4 : 1,
                  }}>
                    <span>{petEmoji(step.pet_name)}</span>
                    {step.status === 'running' && <span style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: '2px solid transparent', borderTopColor: '#6366f1', animation: 'spin 0.8s linear infinite' }} />}
                  </div>
                  <span style={{ fontSize: 10, color: step.status === 'running' ? '#6366f1' : step.status === 'completed' ? '#10b981' : '#9ca3af', fontWeight: step.status === 'running' ? 500 : 400 }}>{step.pet_name}</span>
                </div>
                {i < pipeline.length - 1 && <div style={{ flex: 1, maxWidth: 32, height: 1.5, background: step.status === 'completed' ? '#10b981' : '#e5e7eb', transition: 'background 0.3s' }} />}
              </div>
            ))
          }
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {showThinking && thinkingUpdates.length > 0 && (
            <div style={{ borderBottom: '1px solid #f3f4f6', flexShrink: 0, maxHeight: 180, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', padding: '8px 18px 4px' }}>Agent thinking</div>
              <div ref={thinkingEl} style={{ flex: 1, overflowY: 'auto', padding: '0 18px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {thinkingUpdates.map(u => (
                  <div key={u.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{petEmoji(u.pet_name)} {u.pet_name}</span>
                      <span style={{ fontSize: 10, color: '#d1d5db' }}>{formatTime(u.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6, background: '#f9fafb', padding: '8px 10px', borderRadius: 6, whiteSpace: 'pre-wrap', maxHeight: 80, overflowY: 'auto' }}>{u.content}</div>
                  </div>
                ))}
                {currentPet && !allDone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af' }}>
                    <span>{currentPet}</span>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {[0, 200, 400].map(d => <span key={d} style={{ width: 4, height: 4, background: '#9ca3af', borderRadius: '50%', animation: `bounce 1.2s ${d}ms infinite`, display: 'inline-block' }} />)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {finalOutput
            ? <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Final output
                </div>
                <div style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: renderMd(finalOutput) }} />
              </div>
            : !allDone && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div style={{ position: 'relative', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #6366f1', animation: 'ripple 1.5s infinite' }} />
                  <span style={{ fontSize: 24 }}>{currentPetEmoji}</span>
                </div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>{currentPet || 'Starting...'} is working</div>
              </div>
            )
          }
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderTop: '1px solid #f3f4f6', flexShrink: 0 }}>
          {allDone && !hasError
            ? <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#10b981' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Completed · saved to artifacts
              </div>
            : hasError
            ? <div style={{ fontSize: 13, color: '#ef4444' }}>⚠ One or more steps failed</div>
            : <div style={{ fontSize: 12, color: '#9ca3af' }}>Running in background · you can close this</div>
          }
          {allDone && (
            <button onClick={onClose} style={{ padding: '7px 18px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Close</button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes ripple { 0%{transform:scale(0.8);opacity:1} 100%{transform:scale(1.4);opacity:0} }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-4px)} }
      `}</style>
    </div>
  )

  return createPortal(overlay, document.body)
}
