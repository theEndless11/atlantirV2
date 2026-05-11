'use client'

import { useState, useEffect, useRef } from 'react'
import type { Message } from '@/types'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'

interface Props {
  taskId: string
  messages: Message[]
  running: boolean
  taskStatus?: string
  onSend: (text: string) => void
  onRunAgent: () => void
}

export default function ChatPanel({ taskId, messages, running, taskStatus, onSend, onRunAgent }: Props) {
  const [draft, setDraft] = useState('')
  const scrollEl = useRef<HTMLDivElement>(null)
  const canRun = taskStatus === 'approved'

  function send() {
    if (!draft.trim()) return
    onSend(draft.trim())
    setDraft('')
  }

  function formatTime(ts: string) {
    try { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    catch { return '' }
  }

  useEffect(() => {
    if (scrollEl.current) scrollEl.current.scrollTop = scrollEl.current.scrollHeight
  }, [messages, running])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: 'var(--surface)' }}>
      <div ref={scrollEl} style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, marginTop: 24 }}>
            Start the conversation or run the agent
          </div>
        )}

        {messages.map(msg => {
          const isHuman = msg.sender_type === 'human'
          const agentLabel = msg.agent_type
            ? msg.agent_type.charAt(0).toUpperCase() + msg.agent_type.slice(1)
            : 'Agent'

          return (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isHuman ? 'flex-end' : 'flex-start', gap: 3 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', paddingLeft: isHuman ? 0 : 2, paddingRight: isHuman ? 2 : 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: isHuman ? 'var(--accent)' : 'var(--text-3)' }}>
                  {isHuman ? 'You' : agentLabel}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{formatTime(msg.created_at)}</span>
              </div>

              <div style={{
                maxWidth: '86%', padding: '9px 13px',
                borderRadius: isHuman ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                ...(isHuman
                  ? { background: 'linear-gradient(135deg,#4f46e5,#6d28d9)', color: '#fff' }
                  : { background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border-soft)' })
              }}>
                <MarkdownRenderer content={msg.content} bubble={isHuman} size="sm" />
              </div>
            </div>
          )
        })}

        {running && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-3)', paddingLeft: 2 }}>Agent</span>
            <div style={{ padding: '10px 14px', borderRadius: '14px 14px 14px 3px', background: 'var(--surface-2)', border: '1px solid var(--border-soft)', display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0, 180, 360].map(delay => (
                <span key={delay} style={{ width: 6, height: 6, background: 'var(--text-3)', borderRadius: '50%', display: 'inline-block', animation: `cp-bounce 1.2s ${delay}ms infinite` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface)', flexShrink: 0 }}>
        {canRun && !running && (
          <button onClick={onRunAgent} style={{ alignSelf: 'center', padding: '6px 22px', background: '#059669', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            ▶ Run agent
          </button>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Message or answer agent's question…"
            rows={2}
            style={{ flex: 1, resize: 'none', fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 9, padding: '8px 11px', fontFamily: 'inherit', lineHeight: 1.55, outline: 'none', background: 'var(--surface)', color: 'var(--text-1)', boxSizing: 'border-box' }}
          />
          <button
            disabled={!draft.trim()} onClick={send}
            style={{ padding: '9px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 9, cursor: draft.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600, opacity: draft.trim() ? 1 : 0.4, flexShrink: 0 }}
          >
            Send
          </button>
        </div>
      </div>

      <style>{`@keyframes cp-bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-5px)} }`}</style>
    </div>
  )
}
