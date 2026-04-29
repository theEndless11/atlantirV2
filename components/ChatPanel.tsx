'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import type { Message } from '@/types'

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
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  useEffect(() => {
    if (scrollEl.current) scrollEl.current.scrollTop = scrollEl.current.scrollHeight
  }, [messages])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div ref={scrollEl} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ maxWidth: '85%', alignSelf: msg.sender_type === 'human' ? 'flex-end' : 'flex-start' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>
                {msg.sender_type === 'agent' ? (msg.agent_type || 'Agent') : 'You'}
              </span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatTime(msg.created_at)}</span>
            </div>
            <div style={{
              fontSize: 13, lineHeight: 1.5, padding: '10px 14px', borderRadius: 12,
              whiteSpace: 'pre-wrap',
              ...(msg.sender_type === 'human'
                ? { background: '#2563eb', color: 'white', borderRadius: '12px 12px 2px 12px' }
                : { background: '#f3f4f6', color: '#111827', borderRadius: '12px 12px 12px 2px' })
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {running && (
          <div style={{ maxWidth: '85%', alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Agent</span>
            </div>
            <div style={{ fontSize: 13, padding: '10px 14px', borderRadius: '12px 12px 12px 2px', background: '#f3f4f6', display: 'flex', gap: 4, alignItems: 'center' }}>
              {[0, 200, 400].map(delay => (
                <span key={delay} style={{
                  width: 6, height: 6, background: '#9ca3af', borderRadius: '50%',
                  animation: `bounce 1.2s ${delay}ms infinite`
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid #e5e7eb', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {canRun && !running && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={onRunAgent} style={{
              padding: '6px 20px', background: '#059669', color: 'white',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500
            }}>
              Run agent
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Message or answer agent's question..."
            rows={2}
            style={{
              flex: 1, resize: 'none', fontSize: 13, border: '1px solid #e5e7eb',
              borderRadius: 8, padding: '8px 12px', fontFamily: 'inherit', lineHeight: 1.5, outline: 'none'
            }}
          />
          <button
            disabled={!draft.trim()}
            onClick={send}
            style={{
              padding: '8px 16px', background: '#2563eb', color: 'white',
              border: 'none', borderRadius: 8, cursor: draft.trim() ? 'pointer' : 'not-allowed',
              fontSize: 13, opacity: draft.trim() ? 1 : 0.4
            }}
          >
            Send
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
      `}</style>
    </div>
  )
}
