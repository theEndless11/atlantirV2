'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useVoiceMode } from '@/hooks/useVoiceMode'

interface Props { workspaceId: string }

const quickPhrases = [
  'What tasks are running?',
  'What tools are connected?',
  'What databases are linked?',
  'Summarize recent work',
]

export default function VoiceMode({ workspaceId }: Props) {
  const {
    isListening, isSpeaking, isProcessing, isActive,
    transcript, interimText, error, conversation,
    startListening, stopListening, stopSpeaking,
    processVoiceInput, activate, deactivate,
  } = useVoiceMode(workspaceId)

  const convEl = useRef<HTMLDivElement>(null)
  const grainCanvas = useRef<HTMLCanvasElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const orbState = useMemo(() => {
    if (isListening)  return 'listening'
    if (isProcessing) return 'processing'
    if (isSpeaking)   return 'speaking'
    return 'idle'
  }, [isListening, isProcessing, isSpeaking])

  const micLabel = isListening ? 'TAP TO SEND' : isProcessing ? 'PROCESSING…' : isSpeaking ? 'SPEAKING' : 'TAP TO SPEAK'

  useEffect(() => {
    if (convEl.current) convEl.current.scrollTop = convEl.current.scrollHeight
  }, [conversation])

  // Animated film-grain canvas
  useEffect(() => {
    const canvas = grainCanvas.current
    if (!canvas || !isActive) return
    const ctx = canvas.getContext('2d')!
    let raf: number
    function drawGrain() {
      canvas!.width  = window.innerWidth
      canvas!.height = window.innerHeight
      const img = ctx.createImageData(canvas!.width, canvas!.height)
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v
        img.data[i + 3] = 18
      }
      ctx.putImageData(img, 0, 0)
      raf = requestAnimationFrame(drawGrain)
    }
    drawGrain()
    return () => cancelAnimationFrame(raf)
  }, [isActive])

  function openVoiceMode() { activate(); setTimeout(() => startListening(), 100) }
  function toggleMic() {
    if (isListening) {
      stopListening()
      const text = transcript.trim()
      if (text) processVoiceInput(text)
    } else if (!isSpeaking && !isProcessing) {
      startListening()
    }
  }

  if (!mounted) return null

  return createPortal(
    <>
      {/* FAB button */}
      {!isActive && (
        <button
          onClick={openVoiceMode}
          title="Voice assistant"
          className={`voice-fab${isListening ? ' fab-listening' : ''}`}
        >
          <div className="fab-pulse" />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="fab-wave">
            <rect className="fw fw1" x="1"  y="6" width="2.2" height="12" rx="1.1" fill="currentColor"/>
            <rect className="fw fw2" x="4.5" y="3" width="2.2" height="18" rx="1.1" fill="currentColor"/>
            <rect className="fw fw3" x="8"   y="1" width="2.2" height="22" rx="1.1" fill="currentColor"/>
            <rect className="fw fw4" x="11.5"y="4" width="2.2" height="16" rx="1.1" fill="currentColor"/>
            <rect className="fw fw5" x="15"  y="2" width="2.2" height="20" rx="1.1" fill="currentColor"/>
            <rect className="fw fw6" x="18.5"y="6" width="2.2" height="12" rx="1.1" fill="currentColor"/>
          </svg>
        </button>
      )}

      {/* Fullscreen overlay */}
      {isActive && (
        <div className="vm-fullscreen">
          {/* Aurora blobs */}
          <div className="vm-aurora">
            <div className="aurora-blob ab1" />
            <div className="aurora-blob ab2" />
            <div className="aurora-blob ab3" />
            <div className="aurora-blob ab4" />
          </div>
          {/* Grain */}
          <canvas ref={grainCanvas} className="vm-grain" />

          {/* Top bar */}
          <header className="vm-topbar">
            <div className="vm-logo">
              <div className="vm-logo-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`logo-wave${isListening || isSpeaking ? ' active' : ''}`}>
                  <rect className="lw lw1" x="1"   y="6" width="2" height="12" rx="1" fill="currentColor"/>
                  <rect className="lw lw2" x="4.5" y="3" width="2" height="18" rx="1" fill="currentColor"/>
                  <rect className="lw lw3" x="8"   y="1" width="2" height="22" rx="1" fill="currentColor"/>
                  <rect className="lw lw4" x="11.5"y="4" width="2" height="16" rx="1" fill="currentColor"/>
                  <rect className="lw lw5" x="15"  y="2" width="2" height="20" rx="1" fill="currentColor"/>
                  <rect className="lw lw6" x="18.5"y="6" width="2" height="12" rx="1" fill="currentColor"/>
                </svg>
              </div>
              <div className="vm-logo-text">
                <div className="vm-title">Voice Assistant</div>
                <div className="vm-subtitle">Atlantir Workspace AI</div>
              </div>
            </div>
            <button className="vm-close" onClick={deactivate} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </header>

          {/* Stage — orb + label */}
          <div className="vm-stage">
            <div className={`vm-orb-wrap ${orbState}`}>
              <div className="orb-ring r1" />
              <div className="orb-ring r2" />
              <div className="orb-ring r3" />
              <div className="orb-ring r4" />
              <div className="orb-core">
                {orbState === 'idle' && (
                  <div className="vis-idle">
                    {[8,14,22,28,32,28,22,14,8].map((h, i) => (
                      <span key={i} className="idle-bar" style={{ height: h }} />
                    ))}
                  </div>
                )}
                {orbState === 'listening' && (
                  <div className="vis-listen">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <span key={i} className="listen-bar" style={{ ['--i' as any]: i + 1 }} />
                    ))}
                  </div>
                )}
                {orbState === 'processing' && (
                  <div className="vis-process">
                    {[0,1,2,3].map(i => <span key={i} />)}
                  </div>
                )}
                {orbState === 'speaking' && (
                  <div className="vis-speak">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <span key={i} className="speak-bar" style={{ ['--i' as any]: i + 1 }} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={`vm-state-label ${orbState}`}>
              {isListening
                ? (interimText || transcript || 'Listening…')
                : isProcessing ? 'Thinking…'
                : isSpeaking  ? 'Speaking…'
                : 'Ask me anything'}
            </div>
          </div>

          {/* Conversation feed */}
          <div className="vm-feed-wrap">
            {conversation.length > 0 ? (
              <div ref={convEl} className="vm-feed">
                {conversation.map((msg: any) => (
                  <div key={msg.id} className={`vm-msg ${msg.role}`}>
                    {msg.role === 'assistant' && (
                      <div className="vm-avatar">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                          <rect x="1" y="6" width="2" height="12" rx="1" fill="white"/>
                          <rect x="4.5" y="3" width="2" height="18" rx="1" fill="white"/>
                          <rect x="8" y="1" width="2" height="22" rx="1" fill="white"/>
                          <rect x="11.5" y="4" width="2" height="16" rx="1" fill="white"/>
                          <rect x="15" y="2" width="2" height="20" rx="1" fill="white"/>
                          <rect x="18.5" y="6" width="2" height="12" rx="1" fill="white"/>
                        </svg>
                      </div>
                    )}
                    <div className="vm-bubble">{msg.text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="vm-empty">
                <p className="vm-hint">Ask me anything about your workspace</p>
                <div className="vm-pills">
                  {quickPhrases.map(q => (
                    <button key={q} className="vm-pill" onClick={() => processVoiceInput(q)}>{q}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="vm-controls">
            <button
              className={`vm-mic-btn state-${orbState}`}
              disabled={isProcessing}
              onClick={toggleMic}
              aria-label={isListening ? 'Send' : 'Speak'}
            >
              {isListening && (
                <div className="mic-halo">
                  <span /><span /><span />
                </div>
              )}
              {isProcessing
                ? <span className="mic-spinner" />
                : isListening
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>
                : isSpeaking
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              }
            </button>
            <div className={`vm-mic-label ${orbState}`}>{micLabel}</div>
            {isSpeaking && (
              <button className="vm-stop-btn" onClick={stopSpeaking}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                Stop speaking
              </button>
            )}
          </div>

          {error && <div className="vm-error">{error}</div>}
        </div>
      )}

      <style>{`
        /* ─── FAB ──────────────────────────────────────────── */
        .voice-fab {
          position: fixed; bottom: 54px; right: 68px;
          width: 52px; height: 52px; border-radius: 50%;
          background: linear-gradient(135deg, #c33aed, #db5427);
          border: none; cursor: pointer; color: #fff; z-index: 400;
          box-shadow: 0 6px 20px rgba(0,0,0,.3);
          display: flex; align-items: center; justify-content: center;
          transition: transform .2s, box-shadow .2s;
          overflow: visible;
        }
        .voice-fab:hover { transform: scale(1.07); box-shadow: 0 10px 28px rgba(0,0,0,.4); }
        .voice-fab.fab-listening { background: linear-gradient(145deg, #f97316, #ef4444); box-shadow: 0 8px 20px rgba(239,68,68,.4); }
        .fab-pulse {
          position: absolute; inset: -2px; border-radius: 50%; background: inherit;
          animation: fab-glow 3s ease-in-out infinite; pointer-events: none;
        }
        .fab-listening .fab-pulse { animation: fab-glow-fast .9s ease-in-out infinite; }
        @keyframes fab-glow      { 0%,100%{opacity:0;transform:scale(1)} 50%{opacity:.18;transform:scale(1.08)} }
        @keyframes fab-glow-fast { 0%,100%{opacity:.2;transform:scale(1)} 50%{opacity:.4;transform:scale(1.14)} }
        .fab-wave .fw { transform-origin: center bottom; animation: fab-wv 1.8s ease-in-out infinite; }
        .fab-wave .fw1{animation-delay:0s}  .fab-wave .fw2{animation-delay:.1s}
        .fab-wave .fw3{animation-delay:.2s} .fab-wave .fw4{animation-delay:.1s}
        .fab-wave .fw5{animation-delay:0s}  .fab-wave .fw6{animation-delay:.05s}
        @keyframes fab-wv { 0%,100%{transform:scaleY(.55)} 50%{transform:scaleY(1)} }

        /* ─── FULLSCREEN ───────────────────────────────────── */
        .vm-fullscreen {
          position: fixed; inset: 0; background: #07050f;
          display: flex; flex-direction: column; align-items: center;
          z-index: 500; overflow: hidden;
        }

        /* ─── AURORA ───────────────────────────────────────── */
        .vm-aurora { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
        .aurora-blob {
          position: absolute; border-radius: 50%;
          filter: blur(90px); opacity: .55;
          animation: drift 18s ease-in-out infinite alternate;
        }
        .ab1 { width:560px;height:560px;top:-160px;left:-100px;background:radial-gradient(circle,#7c3aed 0%,transparent 70%);animation-duration:20s; }
        .ab2 { width:480px;height:480px;top:-80px;right:-120px;background:radial-gradient(circle,#db2777 0%,transparent 70%);animation-duration:16s;animation-delay:-6s; }
        .ab3 { width:400px;height:400px;bottom:-100px;left:10%;background:radial-gradient(circle,#2563eb 0%,transparent 70%);animation-duration:22s;animation-delay:-10s; }
        .ab4 { width:340px;height:340px;bottom:60px;right:5%;background:radial-gradient(circle,#0d9488 0%,transparent 70%);animation-duration:14s;animation-delay:-3s; }
        @keyframes drift { 0%{transform:translate(0,0) scale(1)} 100%{transform:translate(40px,30px) scale(1.08)} }

        /* ─── GRAIN ────────────────────────────────────────── */
        .vm-grain { position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay;opacity:.4;z-index:1; }

        /* ─── TOP BAR ──────────────────────────────────────── */
        .vm-topbar {
          position:relative;z-index:10;width:100%;
          display:flex;align-items:center;justify-content:space-between;
          padding:24px 32px 0;
        }
        .vm-logo { display:flex;align-items:center;gap:12px; }
        .vm-logo-icon {
          width:34px;height:34px;border-radius:10px;
          background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);
          display:flex;align-items:center;justify-content:center;color:#a78bfa;
        }
        .vm-logo-text { display:flex;flex-direction:column;gap:1px; }
        .vm-title    { font-size:15px;font-weight:700;color:#fff;letter-spacing:-.015em; }
        .vm-subtitle { font-size:11px;color:rgba(255,255,255,.3);font-weight:500;letter-spacing:.01em; }
        .vm-close {
          width:34px;height:34px;border-radius:10px;
          background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);
          color:rgba(255,255,255,.4);cursor:pointer;
          display:flex;align-items:center;justify-content:center;transition:all .15s;
        }
        .vm-close:hover { background:rgba(255,255,255,.12);color:#fff; }
        .logo-wave .lw { transform-origin:center bottom;animation:logo-wv-idle 4s ease-in-out infinite;opacity:.4; }
        .logo-wave.active .lw { animation:logo-wv 2.4s ease-in-out infinite;opacity:1; }
        .logo-wave .lw1{animation-delay:0s}  .logo-wave .lw2{animation-delay:.15s}
        .logo-wave .lw3{animation-delay:.3s} .logo-wave .lw4{animation-delay:.15s}
        .logo-wave .lw5{animation-delay:0s}  .logo-wave .lw6{animation-delay:.1s}
        @keyframes logo-wv      { 0%,100%{transform:scaleY(.6);opacity:.4}  50%{transform:scaleY(1);opacity:1} }
        @keyframes logo-wv-idle { 0%,100%{transform:scaleY(.5);opacity:.25} 50%{transform:scaleY(.7);opacity:.45} }

        /* ─── STAGE ────────────────────────────────────────── */
        .vm-stage {
          position:relative;z-index:10;flex:1;
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px;
        }
        .vm-orb-wrap {
          position:relative;display:flex;align-items:center;justify-content:center;
          width:260px;height:260px;
        }
        .orb-ring {
          position:absolute;border-radius:50%;
          border:1px solid rgba(124,58,237,.12);transition:border-color .4s,transform .4s;
        }
        .r1{width:260px;height:260px} .r2{width:210px;height:210px}
        .r3{width:162px;height:162px} .r4{width:118px;height:118px}
        .vm-orb-wrap.listening  .orb-ring { border-color:rgba(124,58,237,.5); }
        .vm-orb-wrap.listening  .r1{animation:ring-pulse 2.4s ease-out infinite}
        .vm-orb-wrap.listening  .r2{animation:ring-pulse 2.4s ease-out infinite .4s}
        .vm-orb-wrap.listening  .r3{animation:ring-pulse 2.4s ease-out infinite .8s}
        .vm-orb-wrap.listening  .r4{animation:ring-pulse 2.4s ease-out infinite 1.2s}
        .vm-orb-wrap.speaking   .orb-ring { border-color:rgba(16,185,129,.45); }
        .vm-orb-wrap.speaking   .r1{animation:ring-pulse 1.6s ease-out infinite}
        .vm-orb-wrap.speaking   .r2{animation:ring-pulse 1.6s ease-out infinite .28s}
        .vm-orb-wrap.speaking   .r3{animation:ring-pulse 1.6s ease-out infinite .56s}
        .vm-orb-wrap.speaking   .r4{animation:ring-pulse 1.6s ease-out infinite .84s}
        @keyframes ring-pulse { 0%{transform:scale(.88);opacity:.85} 100%{transform:scale(1.12);opacity:0} }
        .orb-core {
          width:100px;height:100px;border-radius:50%;
          background:rgba(124,58,237,.1);border:1.5px solid rgba(124,58,237,.3);
          box-shadow:0 0 60px rgba(124,58,237,.2),inset 0 1px 0 rgba(255,255,255,.07);
          display:flex;align-items:center;justify-content:center;
          transition:all .35s ease;position:relative;z-index:2;
        }
        .vm-orb-wrap.listening  .orb-core {
          background:rgba(124,58,237,.38);border-color:rgba(147,77,255,.8);
          box-shadow:0 0 80px rgba(124,58,237,.6),0 0 120px rgba(124,58,237,.25),inset 0 1px 0 rgba(255,255,255,.1);
          transform:scale(1.06);
        }
        .vm-orb-wrap.speaking   .orb-core {
          background:rgba(16,185,129,.28);border-color:rgba(52,211,153,.7);
          box-shadow:0 0 70px rgba(16,185,129,.45);transform:scale(1.04);
        }
        .vm-orb-wrap.processing .orb-core {
          background:rgba(124,58,237,.15);border-color:rgba(124,58,237,.4);
          box-shadow:0 0 50px rgba(124,58,237,.3);
          animation:orb-breathe 1.8s ease-in-out infinite;
        }
        @keyframes orb-breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }

        /* ─── VISUALISERS ──────────────────────────────────── */
        .vis-idle { display:flex;gap:3px;align-items:flex-end;height:32px; }
        .idle-bar { display:block;width:3px;border-radius:2px;background:rgba(167,139,250,.5); }
        .vis-listen { display:flex;gap:3px;align-items:center; }
        .listen-bar {
          display:block;width:3.5px;border-radius:3px;background:#a78bfa;height:6px;
          animation:wv .65s ease-in-out infinite alternate;
          animation-delay:calc((var(--i) - 1) * .07s);
        }
        @keyframes wv { 0%{height:4px;opacity:.4} 100%{height:34px;opacity:1} }
        .vis-process { display:flex;gap:7px;align-items:center; }
        .vis-process span {
          width:7px;height:7px;border-radius:50%;background:#7c3aed;
          animation:pdot 1.2s infinite;
        }
        .vis-process span:nth-child(1){animation-delay:0s}
        .vis-process span:nth-child(2){animation-delay:.2s}
        .vis-process span:nth-child(3){animation-delay:.4s}
        .vis-process span:nth-child(4){animation-delay:.6s}
        @keyframes pdot { 0%,80%,100%{transform:scale(.4);opacity:.3} 40%{transform:scale(1);opacity:1} }
        .vis-speak { display:flex;gap:4px;align-items:center; }
        .speak-bar {
          display:block;width:4px;border-radius:3px;background:#34d399;height:8px;
          animation:spk .5s ease-in-out infinite alternate;
          animation-delay:calc((var(--i) - 1) * .1s);
        }
        @keyframes spk { 0%{height:4px;opacity:.5} 100%{height:30px;opacity:1} }

        /* ─── STATE LABEL ──────────────────────────────────── */
        .vm-state-label {
          font-size:17px;font-weight:500;letter-spacing:-.01em;
          color:rgba(255,255,255,.28);transition:color .3s;
          min-height:26px;text-align:center;max-width:340px;
        }
        .vm-state-label.listening  { color:#c4b5fd; }
        .vm-state-label.speaking   { color:#6ee7b7; }
        .vm-state-label.processing { color:rgba(255,255,255,.55); }

        /* ─── FEED ─────────────────────────────────────────── */
        .vm-feed-wrap {
          position:relative;z-index:10;width:100%;max-width:640px;padding:0 24px;
        }
        .vm-feed {
          max-height:200px;overflow-y:auto;
          display:flex;flex-direction:column;gap:10px;
          padding:16px 0 4px;border-top:1px solid rgba(255,255,255,.06);
        }
        .vm-feed::-webkit-scrollbar{width:3px}
        .vm-feed::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:3px}
        .vm-msg { display:flex;align-items:flex-end;gap:8px; }
        .vm-msg.user      { justify-content:flex-end; }
        .vm-msg.assistant { justify-content:flex-start; }
        .vm-avatar {
          width:26px;height:26px;border-radius:8px;flex-shrink:0;
          background:linear-gradient(135deg,#7c3aed,#4f46e5);
          display:flex;align-items:center;justify-content:center;color:#fff;
        }
        .vm-bubble { max-width:78%;padding:10px 14px;font-size:13.5px;line-height:1.55; }
        .vm-msg.user .vm-bubble {
          background:rgba(109,40,217,.22);border:1px solid rgba(109,40,217,.3);
          color:#ddd6fe;border-radius:16px 16px 4px 16px;
        }
        .vm-msg.assistant .vm-bubble {
          background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.08);
          color:rgba(255,255,255,.82);border-radius:16px 16px 16px 4px;
        }
        .vm-empty {
          padding:16px 0 4px;border-top:1px solid rgba(255,255,255,.06);
          display:flex;flex-direction:column;align-items:center;gap:14px;
        }
        .vm-hint { font-size:12.5px;color:rgba(255,255,255,.25);margin:0; }
        .vm-pills { display:flex;flex-wrap:wrap;gap:8px;justify-content:center; }
        .vm-pill {
          font-size:12px;padding:7px 15px;
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
          border-radius:20px;color:rgba(255,255,255,.42);cursor:pointer;transition:all .15s;
        }
        .vm-pill:hover {
          background:rgba(124,58,237,.2);border-color:rgba(124,58,237,.4);
          color:#c4b5fd;transform:translateY(-1px);
        }

        /* ─── CONTROLS ─────────────────────────────────────── */
        .vm-controls {
          position:relative;z-index:10;
          display:flex;flex-direction:column;align-items:center;gap:12px;
          padding:20px 20px 40px;
        }
        .vm-mic-btn {
          position:relative;width:72px;height:72px;border-radius:50%;
          background:linear-gradient(145deg,#7c3aed,#4f46e5);
          border:none;cursor:pointer;color:#fff;
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 8px 30px rgba(79,70,229,.5),0 2px 8px rgba(0,0,0,.3);
          transition:all .2s cubic-bezier(.34,1.56,.64,1);overflow:visible;
        }
        .vm-mic-btn:hover:not(:disabled){transform:scale(1.07);box-shadow:0 12px 40px rgba(79,70,229,.65)}
        .vm-mic-btn.state-listening {
          background:linear-gradient(145deg,#dc2626,#b91c1c);
          box-shadow:0 8px 30px rgba(220,38,38,.55);
          animation:mic-pulse 1.4s ease-in-out infinite;
        }
        .vm-mic-btn.state-speaking {
          background:linear-gradient(145deg,#059669,#0d9488);
          box-shadow:0 8px 30px rgba(5,150,105,.5);
        }
        .vm-mic-btn.state-processing{opacity:.5;cursor:not-allowed}
        @keyframes mic-pulse{0%,100%{box-shadow:0 8px 30px rgba(220,38,38,.55)}50%{box-shadow:0 8px 44px rgba(220,38,38,.9)}}
        .mic-halo{position:absolute;inset:-8px;pointer-events:none}
        .mic-halo span{position:absolute;inset:0;border-radius:50%;border:1.5px solid rgba(220,38,38,.45)}
        .mic-halo span:nth-child(1){animation:halo 1.6s ease-out infinite}
        .mic-halo span:nth-child(2){animation:halo 1.6s ease-out infinite .45s}
        .mic-halo span:nth-child(3){animation:halo 1.6s ease-out infinite .9s}
        @keyframes halo{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.6);opacity:0}}
        .mic-spinner{width:22px;height:22px;border-radius:50%;border:2px solid rgba(255,255,255,.25);border-top-color:#fff;animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .vm-mic-label{font-size:12.5px;font-weight:500;color:rgba(255,255,255,.28);letter-spacing:.03em;text-transform:uppercase;transition:color .3s}
        .vm-mic-label.listening  { color:#c4b5fd; }
        .vm-mic-label.speaking   { color:#6ee7b7; }
        .vm-mic-label.processing { color:rgba(255,255,255,.5); }
        .vm-stop-btn {
          display:flex;align-items:center;gap:7px;padding:7px 18px;border-radius:20px;
          background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);
          color:rgba(255,255,255,.4);font-size:12px;cursor:pointer;transition:all .13s;
        }
        .vm-stop-btn:hover{background:rgba(239,68,68,.14);color:#f87171;border-color:rgba(239,68,68,.28)}
        .vm-error {
          position:absolute;bottom:24px;left:50%;transform:translateX(-50%);
          padding:10px 20px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.22);
          border-radius:12px;color:#f87171;font-size:12.5px;z-index:20;white-space:nowrap;
        }
      `}</style>
    </>,
    document.body
  )
}