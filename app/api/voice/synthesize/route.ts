import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) return NextResponse.json({ audioBase64: null, useBrowserTTS: true, text })

  const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: text.slice(0, 1000),
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
      }),
    })
    if (!res.ok) return NextResponse.json({ audioBase64: null, useBrowserTTS: true, text })
    const base64 = Buffer.from(await res.arrayBuffer()).toString('base64')
    return NextResponse.json({ audioBase64: base64, useBrowserTTS: false })
  } catch {
    return NextResponse.json({ audioBase64: null, useBrowserTTS: true, text })
  }
}
