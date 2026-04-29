'use client'
import { useState, useRef, useCallback } from 'react'

export type CaptureMode = 'mic' | 'system' | 'both'

export function useDeepgram() {
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [error, setError] = useState('')
  const [captureMode, setCaptureMode] = useState<CaptureMode>('both')
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')

  const socketRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const displayStreamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const loadDevices = useCallback(async () => {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true })
      tmp.getTracks().forEach(t => t.stop())
      const devices = await navigator.mediaDevices.enumerateDevices()
      const inputs = devices.filter(d => d.kind === 'audioinput')
      setAudioDevices(inputs)
      if (!selectedDeviceId && inputs.length) setSelectedDeviceId(inputs[0].deviceId)
    } catch {
      setError('Microphone access denied')
    }
  }, [selectedDeviceId])

  const mixStreams = useCallback((streams: MediaStream[]): MediaStream => {
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const dest = ctx.createMediaStreamDestination()
    for (const stream of streams) {
      if (stream.getAudioTracks().length > 0) {
        ctx.createMediaStreamSource(stream).connect(dest)
      }
    }
    return dest.stream
  }, [])

  const start = useCallback(async () => {
    setError('')
    setTranscript('')
    setInterimText('')

    const streams: MediaStream[] = []

    // Mic
    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, echoCancellation: true, noiseSuppression: true }
          : { echoCancellation: true, noiseSuppression: true },
      }
      micStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints)
      streams.push(micStreamRef.current)
    } catch (e) {
      console.warn('[deepgram] mic unavailable:', e)
    }

    // System / tab audio
    if (captureMode === 'system' || captureMode === 'both') {
      try {
        const ds = await (navigator.mediaDevices as any).getDisplayMedia({
          video: true, audio: { echoCancellation: false, noiseSuppression: false, sampleRate: 44100 }, systemAudio: 'include',
        })
        displayStreamRef.current = ds
        ds.getVideoTracks().forEach((t: MediaStreamTrack) => t.stop())
        if (ds.getAudioTracks().length > 0) {
          streams.push(ds)
        } else {
          setError('No audio captured from screen share. Enable "Share tab audio" in the picker.')
        }
        ds.getVideoTracks()[0]?.addEventListener('ended', () => { if (isRecording) stop() })
      } catch (e: any) {
        if (e.name === 'NotAllowedError') setError('Screen share cancelled. Using mic only.')
      }
    }

    if (streams.length === 0) { setError('No audio source available'); return }

    const finalStream = streams.length === 1 ? streams[0] : mixStreams(streams)
    const key = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY
    if (!key) { setError('Deepgram API key not configured'); return }

    const ws = new WebSocket(
      `wss://api.deepgram.com/v1/listen?model=nova-2&language=en&smart_format=true&interim_results=true&utterance_end_ms=1000`,
      ['token', key]
    )
    socketRef.current = ws

    ws.onopen = () => {
      setIsRecording(true)
      setIsPaused(false)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
      const recorder = new MediaRecorder(finalStream, { mimeType })
      recorderRef.current = recorder
      recorder.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data)
      })
      recorder.start(250)
    }

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data)
        const alt = data?.channel?.alternatives?.[0]
        if (!alt) return
        if (data.is_final) {
          if (alt.transcript) {
            setTranscript(prev => prev ? prev + ' ' + alt.transcript : alt.transcript)
            setInterimText('')
          }
        } else {
          setInterimText(alt.transcript || '')
        }
      } catch {}
    }

    ws.onerror = () => setError('Deepgram connection failed. Check your API key.')
    ws.onclose = (e) => {
      setIsRecording(false)
      if (e.code !== 1000) setError(`Connection closed (${e.code})`)
    }
  }, [captureMode, selectedDeviceId, mixStreams, isRecording])

  const pause = useCallback(() => {
    recorderRef.current?.pause()
    setIsPaused(true)
  }, [])

  const resume = useCallback(() => {
    recorderRef.current?.resume()
    setIsPaused(false)
  }, [])

  const stop = useCallback((): string => {
    recorderRef.current?.stop()
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    displayStreamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.close(1000)
    setIsRecording(false)
    setIsPaused(false)
    setInterimText('')
    // Return current transcript value — caller reads from state
    return transcript
  }, [transcript])

  return {
    transcript, interimText, isRecording, isPaused, error,
    captureMode, setCaptureMode, audioDevices, selectedDeviceId, setSelectedDeviceId,
    loadDevices, start, pause, resume, stop,
  }
}
