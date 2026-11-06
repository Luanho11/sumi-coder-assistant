import { useCallback, useEffect, useRef, useState } from 'react'
import type { VoiceSettings } from '../../core/types'
import { speakableText } from '../../core/voice'

// Voz de XARA en la interfaz: reproduce el audio de Verity (Fish) o Gemini y, de respaldo, la voz del sistema (Web Speech).
// También graba el micrófono y lo manda a transcribir. Todo tolera que falte permiso o conexión.

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

function pickSystemVoice(name: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? []
  if (name) {
    const exact = voices.find((v) => v.name === name)
    if (exact) return exact
  }
  return voices.find((v) => v.lang.startsWith('es')) ?? voices[0]
}

const RESPALDO = 'Mientras tanto suena la voz de Windows.'
const SIN_RESPALDO = 'Tampoco pude usar la voz de Windows: revisa que tenga una voz instalada (Configuración de Windows → Hora e idioma → Voz).'

type SpeechResult = Awaited<ReturnType<typeof window.copilot.speak>>

// Audio pedido por adelantado (la siguiente escena de una clase) para que no haya silencio entre escenas.
const pending = new Map<string, Promise<SpeechResult>>()

/** Pide ya el audio de un texto que se va a decir enseguida; speak() lo reutiliza. */
export function prefetchSpeech(engine: VoiceSettings['engine'], text: string) {
  if (engine === 'sistema' || !text.trim() || pending.has(text)) return
  if (pending.size > 4) pending.clear()
  pending.set(text, window.copilot.speak(text))
}

export function systemVoices(): { name: string; lang: string }[] {
  return (window.speechSynthesis?.getVoices() ?? []).map((v) => ({ name: v.name, lang: v.lang }))
}

/** Cómo acabó una lectura: completa, detenida (por el usuario u otra lectura) o sin ninguna voz que pudiera sonar. */
export type Lectura = 'terminada' | 'detenida' | 'sin_voz'

export interface Voice {
  speaking: boolean
  paused: boolean
  /** Cuánto lleva dicho de la lectura en curso (0 a 1), para subtítulos y barras de avance. */
  progress: number
  recording: boolean
  /** Resuelve al terminar de hablar, para encadenar lecturas. */
  speak: (text: string) => Promise<Lectura>
  stop: () => void
  togglePause: () => void
  toggleRecording: () => Promise<void>
  error: string | null
}

export function useVoice(settings: VoiceSettings, onTranscript: (text: string) => void): Voice {
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const finishRef = useRef<((r: Lectura) => void) | null>(null)

  // Solo cierra la lectura a la que pertenece: el aviso tardío de una voz ya cancelada no debe cortar la siguiente.
  const settle = (owner: ((r: Lectura) => void) | null, r: Lectura) => {
    if (!owner || finishRef.current !== owner) return
    finishRef.current = null
    owner(r)
  }

  const stop = useCallback(() => {
    settle(finishRef.current, 'detenida')
    window.speechSynthesis?.cancel()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setSpeaking(false)
    setPaused(false)
  }, [])

  // Pausa o reanuda la lectura en curso (audio de Fish/Gemini o voz del sistema).
  const togglePause = useCallback(() => {
    const a = audioRef.current
    if (a) {
      if (a.paused) {
        void a.play()
        setPaused(false)
      } else {
        a.pause()
        setPaused(true)
      }
      return
    }
    if (window.speechSynthesis?.speaking) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
        setPaused(false)
      } else {
        window.speechSynthesis.pause()
        setPaused(true)
      }
    }
  }, [])

  const systemSpeak = useCallback(
    (text: string) => {
      const owner = finishRef.current
      if (!window.speechSynthesis) {
        setError('Tu sistema no tiene voces instaladas.')
        settle(owner, 'sin_voz')
        return
      }
      window.speechSynthesis.cancel()
      const said = speakableText(text)
      const u = new SpeechSynthesisUtterance(said)
      const v = pickSystemVoice(settings.systemVoice)
      if (v) {
        u.voice = v
        u.lang = v.lang
      }
      u.rate = 1.02
      u.volume = settings.volume ?? 1
      u.onboundary = (e) => setProgress(e.charIndex / said.length)
      u.onend = () => {
        if (finishRef.current !== owner) return
        setProgress(1)
        setSpeaking(false)
        settle(owner, 'terminada')
      }
      u.onerror = (e) => {
        if (finishRef.current !== owner) return
        setSpeaking(false)
        const stopped = e.error === 'interrupted' || e.error === 'canceled'
        if (!stopped) setError((prev) => (prev?.includes(RESPALDO) ? prev.replace(RESPALDO, SIN_RESPALDO) : SIN_RESPALDO))
        settle(owner, stopped ? 'detenida' : 'sin_voz')
      }
      setSpeaking(true)
      window.speechSynthesis.speak(u)
    },
    [settings.systemVoice, settings.volume]
  )

  const speak = useCallback(
    async (text: string) => {
      stop()
      setError(null)
      setProgress(0)
      if (!text.trim()) return 'terminada' as const
      let mine: (r: Lectura) => void = () => {}
      const finished = new Promise<Lectura>((resolve) => (mine = resolve))
      finishRef.current = mine
      if (settings.engine === 'sistema') {
        systemSpeak(text)
        return finished
      }
      setSpeaking(true)
      const res = await (pending.get(text) ?? window.copilot.speak(text))
      pending.delete(text)
      // Si se detuvo (o empezó otra lectura) mientras se generaba el audio, este ya no se reproduce.
      if (finishRef.current !== mine) return 'detenida' as const
      if (!res.ok) {
        // Se sigue hablando con la voz del sistema, pero siempre se dice por qué: un cambio de voz en silencio parece un error.
        setError(
          res.reason === 'sin_clave'
            ? `Falta la clave de la voz en Configuración. ${RESPALDO}`
            : `La voz natural no respondió: ${res.message ?? res.reason}. ${RESPALDO}`
        )
        systemSpeak(text)
        return finished
      }
      const audio = new Audio(URL.createObjectURL(base64ToBlob(res.audio, res.mime)))
      audio.volume = settings.volume ?? 1
      audioRef.current = audio
      audio.ontimeupdate = () => audio.duration && setProgress(audio.currentTime / audio.duration)
      audio.onended = () => {
        if (finishRef.current !== mine) return
        setProgress(1)
        setSpeaking(false)
        setPaused(false)
        settle(mine, 'terminada')
      }
      const fallback = () => {
        if (finishRef.current !== mine) return
        setError(`No pude reproducir el audio de la voz natural. ${RESPALDO}`)
        systemSpeak(text)
      }
      audio.onerror = fallback
      void audio.play().catch(fallback)
      return finished
    },
    [settings.engine, settings.volume, stop, systemSpeak]
  )

  const toggleRecording = useCallback(async () => {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    setError(null)
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('No pude usar el micrófono. Revisa los permisos de Windows.')
      return
    }
    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    chunksRef.current = []
    recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data)
    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop())
      setRecording(false)
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const wav = await webmToWavBase64(blob).catch(() => null)
      if (!wav) {
        setError('No pude procesar el audio grabado.')
        return
      }
      const res = await window.copilot.transcribe(wav)
      if (res.ok && res.text.trim()) onTranscript(res.text.trim())
      else if (!res.ok && res.reason === 'sin_clave') setError('Configura tu clave de Gemini para dictar por voz.')
      else if (res.ok) setError('No entendí lo que dijiste; intenta de nuevo.')
    }
    recorder.start()
    setRecording(true)
  }, [recording, onTranscript])

  useEffect(() => () => stop(), [stop])

  return { speaking, paused, progress, recording, speak, stop, togglePause, toggleRecording, error }
}

/** Decodifica el audio grabado y lo vuelve a codificar como WAV PCM 16 bits, que es lo que Gemini acepta. */
async function webmToWavBase64(blob: Blob): Promise<string> {
  const ctx = new AudioContext()
  const buffer = await ctx.decodeAudioData(await blob.arrayBuffer())
  await ctx.close()
  const channel = buffer.getChannelData(0)
  const rate = buffer.sampleRate
  const pcm = new DataView(new ArrayBuffer(44 + channel.length * 2))
  const write = (off: number, s: string) => [...s].forEach((c, i) => pcm.setUint8(off + i, c.charCodeAt(0)))
  write(0, 'RIFF')
  pcm.setUint32(4, 36 + channel.length * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  pcm.setUint32(16, 16, true)
  pcm.setUint16(20, 1, true)
  pcm.setUint16(22, 1, true)
  pcm.setUint32(24, rate, true)
  pcm.setUint32(28, rate * 2, true)
  pcm.setUint16(32, 2, true)
  pcm.setUint16(34, 16, true)
  write(36, 'data')
  pcm.setUint32(40, channel.length * 2, true)
  for (let i = 0; i < channel.length; i++) {
    const s = Math.max(-1, Math.min(1, channel[i]))
    pcm.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  let bin = ''
  const bytes = new Uint8Array(pcm.buffer)
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}
