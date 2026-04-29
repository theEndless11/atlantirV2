'use client'

import { useState, useEffect } from 'react'
import useDeepgram from '@/hooks/useDeepgram'

interface Props {
  processing: boolean
  onSubmit: (text: string) => void
  onClose: () => void
}

type Tab = 'live' | 'paste' | 'goal'

export default function MeetingInput({ processing, onSubmit, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('live')
  const [manualTranscript, setManualTranscript] = useState('')
  const [liveTranscript, setLiveTranscript] = useState('')

  const { transcript, interimText, isRecording, error: deepgramError, loadDevices, start, stop } = useDeepgram()

  const canSubmit = tab === 'live'
    ? liveTranscript.trim().length > 0 && !isRecording
    : manualTranscript.trim().length > 0

  function switchTab(t: Tab) {
    if (isRecording) stop()
    setTab(t)
  }

  async function startRecording() {
    setLiveTranscript('')
    await start()
  }

  function stopRecording() {
    stop()
    setLiveTranscript(transcript)
  }

  useEffect(() => { loadDevices() }, [])
  useEffect(() => { setLiveTranscript(transcript) }, [transcript])

  function submit() {
    const text = tab === 'live' ? liveTranscript : manualTranscript
    if (!text.trim()) return
    onSubmit(text.trim())
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: 12, width: 580, maxWidth: '95vw', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb', fontWeight: 500, fontSize: 15 }}>
          <span>New meeting</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#6b7280' }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
            {(['live', 'paste', 'goal'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: '1px solid', fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  borderColor: tab === t ? '#bfdbfe' : '#e5e7eb',
                  background: tab === t ? '#eff6ff' : 'white',
                  color: tab === t ? '#1d4ed8' : '#6b7280',
                  fontWeight: tab === t ? 500 : 400,
                }}
              >
                {t === 'live' && (
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: isRecording ? '#ef4444' : '#d1d5db',
                    animation: isRecording ? 'blink 1s infinite' : 'none',
                    display: 'inline-block'
                  }} />
                )}
                {t === 'live' ? 'Live recording' : t === 'paste' ? 'Paste transcript' : 'Type a goal'}
              </button>
            ))}
          </div>

          {tab === 'live' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: '#f9fafb', borderRadius: 10, border: '1px solid #e5e7eb' }}>
                <div style={{ position: 'relative', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isRecording && <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #ef4444', animation: 'pulse-ring 1.5s infinite' }} />}
                  <span style={{ width: 14, height: 14, borderRadius: '50%', background: isRecording ? '#ef4444' : '#d1d5db', display: 'inline-block' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{isRecording ? 'Recording...' : 'Ready to record'}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{isRecording ? 'Deepgram is transcribing in real-time' : 'Click start to capture your meeting'}</div>
                </div>
                {!isRecording
                  ? <button onClick={startRecording} style={{ padding: '7px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Start</button>
                  : <button onClick={stopRecording} style={{ padding: '7px 16px', background: '#374151', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Stop</button>
                }
              </div>
              {deepgramError && <p style={{ fontSize: 13, color: '#dc2626', margin: 0 }}>{deepgramError}</p>}
              {(isRecording || liveTranscript) && (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', padding: '8px 12px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>Live transcript</div>
                  <div style={{ padding: 12, fontSize: 13, lineHeight: 1.6, color: '#374151', maxHeight: 180, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                    {liveTranscript}<span style={{ color: '#9ca3af' }}>{interimText ? ` ${interimText}` : ''}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab !== 'live' && (
            <>
              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 10px' }}>
                {tab === 'paste' ? 'Paste your meeting transcript. The orchestrator will extract tasks automatically.' : 'Describe what you want to get done.'}
              </p>
              <textarea
                value={manualTranscript}
                onChange={e => setManualTranscript(e.target.value)}
                rows={tab === 'paste' ? 10 : 6}
                placeholder={tab === 'paste' ? 'Paste transcript here...' : 'e.g. Prepare a competitive analysis of our top 3 rivals...'}
                style={{ width: '100%', resize: 'vertical', fontSize: 13, lineHeight: 1.6, border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
              />
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid #e5e7eb' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', border: '1px solid #e5e7eb', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button
            disabled={!canSubmit || processing}
            onClick={submit}
            style={{ padding: '8px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: canSubmit && !processing ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 500, opacity: canSubmit && !processing ? 1 : 0.4 }}
          >
            {processing ? 'Processing...' : 'Generate tasks'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes pulse-ring { 0%{transform:scale(0.8);opacity:1} 100%{transform:scale(1.4);opacity:0} }
      `}</style>
    </div>
  )
}
