'use client'
import { useState, useRef, useCallback, useEffect } from 'react'

export interface VoiceMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
}

export function useVoiceMode(workspaceId: string) {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isActive, setIsActive] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [error, setError] = useState('')
  const [conversation, setConversation] = useState<VoiceMessage[]>([])

  const socketRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const accumulatedRef = useRef('')

  // ── Deepgram STT ─────────────────────────────────────────────────────────

  const stopMic = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
    recorderRef.current?.stop()
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.close(1000)
    setIsListening(false)
    setInterimText('')
  }, [])

  const speakText = useCallback(async (text: string) => {
    if (!text.trim()) return
    setIsSpeaking(true)
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null }

    try {
      const res = await fetch('/api/voice/synthesize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 1000) }),
      })
      const data = await res.json()

      if (data.useBrowserTTS && data.text && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utt = new SpeechSynthesisUtterance(data.text)
        utt.rate = 1.0; utt.pitch = 1.0
        utt.onend = () => setIsSpeaking(false)
        utt.onerror = () => setIsSpeaking(false)
        window.speechSynthesis.speak(utt)
        return
      }

      if (data.audioBase64) {
        await new Promise<void>((resolve) => {
          const audio = new Audio(`data:audio/mpeg;base64,${data.audioBase64}`)
          currentAudioRef.current = audio
          audio.onended = () => { setIsSpeaking(false); resolve() }
          audio.onerror = () => { setIsSpeaking(false); resolve() }
          audio.play().catch(() => { setIsSpeaking(false); resolve() })
        })
        return
      }
    } catch {}
    setIsSpeaking(false)
  }, [])

  const processVoiceInput = useCallback(async (text: string) => {
    if (!text.trim()) return
    setIsProcessing(true)

    const userMsg: VoiceMessage = { id: Date.now().toString(), role: 'user', text, timestamp: new Date() }
    setConversation(prev => [...prev, userMsg])

    try {
      const history = [...conversation, userMsg].slice(-8).map(m => ({ role: m.role, content: m.text }))
      const res = await fetch('/api/voice/respond', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, message: text, history }),
      })
      const data = await res.json()
      const replyText = data.reply
      const assistantMsg: VoiceMessage = { id: (Date.now() + 1).toString(), role: 'assistant', text: replyText, timestamp: new Date() }
      setConversation(prev => [...prev, assistantMsg])
      await speakText(replyText)
    } catch (e: any) {
      setError(e?.message || 'Agent response failed')
    } finally {
      setIsProcessing(false)
    }
  }, [conversation, workspaceId, speakText])

  const stopListeningAndProcess = useCallback(() => {
    const text = accumulatedRef.current.trim()
    stopMic()
    if (text) processVoiceInput(text)
  }, [stopMic, processVoiceInput])

  const startListening = useCallback(async () => {
    if (isListening || isSpeaking || isProcessing) return
    setError('')
    setTranscript('')
    setInterimText('')
    accumulatedRef.current = ''

    try {
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, sampleRate: 16000, channelCount: 1 }
      })
    } catch {
      setError('Microphone access denied. Please allow mic access and try again.')
      return
    }

    const key = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY
    if (!key) { setError('Deepgram API key not configured'); return }

    const ws = new WebSocket(
      `wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&interim_results=true&utterance_end_ms=1000`,
      ['token', key]
    )
    socketRef.current = ws

    ws.onopen = () => {
      setIsListening(true)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const recorder = new MediaRecorder(micStreamRef.current!, { mimeType })
      recorderRef.current = recorder
      recorder.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data)
      })
      recorder.start(250)
    }

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data)
        if (data.type === 'SpeechStarted') {
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
        }
        if (data.type === 'UtteranceEnd' && accumulatedRef.current.trim()) {
          stopListeningAndProcess(); return
        }
        const alt = data?.channel?.alternatives?.[0]
        if (!alt?.transcript) return
        if (data.is_final) {
          accumulatedRef.current += (accumulatedRef.current ? ' ' : '') + alt.transcript
          setTranscript(accumulatedRef.current)
          setInterimText('')
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
          silenceTimerRef.current = setTimeout(() => {
            if (accumulatedRef.current.trim()) stopListeningAndProcess()
          }, 1500)
        } else {
          setInterimText(alt.transcript)
        }
      } catch {}
    }

    ws.onerror = () => { setError('Voice connection failed — check Deepgram key'); stopMic() }
    ws.onclose = (e) => {
      setIsListening(false)
      if (e.code !== 1000 && e.code !== 1001) setError(`Connection closed (${e.code})`)
    }
  }, [isListening, isSpeaking, isProcessing, stopMic, stopListeningAndProcess])

  const stopListening = useCallback(() => stopMic(), [stopMic])

  const stopSpeaking = useCallback(() => {
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  const activate = useCallback(() => setIsActive(true), [])

  const deactivate = useCallback(() => {
    stopMic()
    stopSpeaking()
    setIsActive(false)
    setConversation([])
    setTranscript('')
    setError('')
    accumulatedRef.current = ''
  }, [stopMic, stopSpeaking])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMic()
      stopSpeaking()
    }
  }, [stopMic, stopSpeaking])

  return {
    isListening, isSpeaking, isProcessing, isActive,
    transcript, interimText, error, conversation,
    startListening, stopListening, speakText, stopSpeaking,
    processVoiceInput, activate, deactivate,
  }
}
