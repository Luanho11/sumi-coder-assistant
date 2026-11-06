import { errorFromHttp, ProviderError, toProviderError } from './errors'
import type { FetchLike } from './providers/types'

// Voz de XARA con la API de Gemini (nivel gratuito): texto → voz y voz → texto.
// Si falla (sin conexión, sin clave o límite diario agotado) la interfaz usa las voces de Windows.

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
// Modelo TTS de la documentación de Gemini API; si Google lo renombra, se cambia aquí.
export const TTS_MODEL = 'gemini-2.5-flash-preview-tts'
export const GEMINI_VOICES = ['Kore', 'Aoede', 'Leda', 'Zephyr', 'Puck', 'Charon']
const MAX_SPEECH_CHARS = 1800
const TTS_STYLE = 'Lee esto en español latino con voz cálida, cercana y alegre, como una tutora amable que anima a su alumno, a ritmo natural:'

/** Convierte la respuesta en Markdown en algo que se pueda decir en voz alta: sin código, diagramas ni símbolos. */
export function speakableText(markdown: string): string {
  const text = markdown
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/```mermaid[\s\S]*?(```|$)/g, ' Te dejé un diagrama en pantalla. ')
    .replace(/```[\s\S]*?(```|$)/g, ' Te dejé el código en pantalla. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s*(.+)$/gm, '$1.')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*\|.*\|\s*$/gm, '')
    .replace(/[*_~>#|]/g, '')
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .replace(/^\s*[-+]\s+/gm, '')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
  return text.length > MAX_SPEECH_CHARS ? `${text.slice(0, text.lastIndexOf('.', MAX_SPEECH_CHARS) + 1 || MAX_SPEECH_CHARS)}` : text
}

/** Gemini devuelve PCM de 16 bits mono a 24 kHz; el navegador necesita una cabecera WAV para reproducirlo. */
export function pcmToWav(pcm: Uint8Array, sampleRate = 24_000): Uint8Array {
  const header = new DataView(new ArrayBuffer(44))
  const write = (offset: number, s: string) => [...s].forEach((c, i) => header.setUint8(offset + i, c.charCodeAt(0)))
  write(0, 'RIFF')
  header.setUint32(4, 36 + pcm.length, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  header.setUint32(16, 16, true)
  header.setUint16(20, 1, true)
  header.setUint16(22, 1, true)
  header.setUint32(24, sampleRate, true)
  header.setUint32(28, sampleRate * 2, true)
  header.setUint16(32, 2, true)
  header.setUint16(34, 16, true)
  write(36, 'data')
  header.setUint32(40, pcm.length, true)
  const out = new Uint8Array(44 + pcm.length)
  out.set(new Uint8Array(header.buffer), 0)
  out.set(pcm, 44)
  return out
}

interface GeminiAudioResponse {
  candidates?: { content?: { parts?: { text?: string; inlineData?: { mimeType?: string; data?: string } }[] } }[]
}

async function post(apiKey: string, model: string, body: unknown, fetchImpl: FetchLike, signal?: AbortSignal): Promise<GeminiAudioResponse> {
  if (!apiKey) throw new ProviderError('config', 'Falta la clave API de Gemini. Añádela en Configuración.')
  let res: Response
  try {
    res = await fetchImpl(`${BASE_URL}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal
    })
  } catch (err) {
    throw toProviderError('Gemini', err)
  }
  if (!res.ok) throw errorFromHttp('Gemini', res.status, await res.text().catch(() => ''), res.headers.get('retry-after'))
  return (await res.json()) as GeminiAudioResponse
}

/** Audio WAV en base64 con la respuesta leída por la voz elegida. */
export async function geminiSpeech(apiKey: string, voice: string, text: string, fetchImpl: FetchLike = fetch, signal?: AbortSignal): Promise<string> {
  const json = await post(
    apiKey,
    TTS_MODEL,
    {
      contents: [{ parts: [{ text: `${TTS_STYLE}\n\n${text}` }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICES.includes(voice) ? voice : GEMINI_VOICES[0] } } }
      }
    },
    fetchImpl,
    signal
  )
  const data = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data
  if (!data) throw new ProviderError('unknown', 'Gemini no devolvió audio.')
  return Buffer.from(pcmToWav(Buffer.from(data, 'base64'))).toString('base64')
}

// Fish Audio: voz de alta calidad (la voz "Verity" que eligió LM). Devuelve audio MP3 en base64.
// https://docs.fish.audio/  (endpoint REST /v1/tts, respuesta en bytes de audio)
const FISH_URL = 'https://api.fish.audio/v1/tts'
// Si el modelo falta o no se reconoce, Fish usa s2.1-pro, que es de pago, y una cuenta gratuita recibe 402.
export const FISH_MODEL = 's2.1-pro-free'
// La Verity original de Fish (60d2a0d6…) es una voz inglesa y en español suena con acento; estas son versiones clonadas en español.
export const FISH_VOICES = [
  { id: '5e503fc64ded446a9f8636b6009db547', name: 'Verity en español' },
  { id: '641bbeed324f4ce2bb1f1b13ed2f9975', name: 'Verity! Español' }
]
export const DEFAULT_FISH_VOICE = FISH_VOICES[0].id

export async function fishSpeech(apiKey: string, modelId: string, text: string, fetchImpl: FetchLike = fetch, signal?: AbortSignal): Promise<string> {
  if (!apiKey) throw new ProviderError('config', 'Falta la clave de Fish Audio. Añádela en Configuración.')
  if (!modelId) throw new ProviderError('config', 'Falta el id del modelo de voz de Fish Audio.')
  let res: Response
  try {
    res = await fetchImpl(FISH_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', model: FISH_MODEL },
      body: JSON.stringify({ text, reference_id: modelId, format: 'mp3', language: 'es', normalize: true, latency: 'normal' }),
      signal
    })
  } catch (err) {
    throw toProviderError('Fish Audio', err)
  }
  if (!res.ok) throw errorFromHttp('Fish Audio', res.status, await res.text().catch(() => ''), res.headers.get('retry-after'))
  const buf = Buffer.from(await res.arrayBuffer())
  if (!buf.length) throw new ProviderError('unknown', 'Fish Audio no devolvió audio.')
  return buf.toString('base64')
}

/** Transcribe lo que dijo el usuario (WAV en base64) con el modelo de chat configurado. */
export async function geminiTranscribe(apiKey: string, model: string, wavBase64: string, fetchImpl: FetchLike = fetch, signal?: AbortSignal): Promise<string> {
  const json = await post(
    apiKey,
    model,
    {
      contents: [
        {
          parts: [
            { text: 'Transcribe literalmente este audio en español. Devuelve solo el texto dicho, sin comillas ni comentarios. Si no se entiende nada, devuelve una cadena vacía.' },
            { inline_data: { mime_type: 'audio/wav', data: wavBase64 } }
          ]
        }
      ],
      generationConfig: { temperature: 0 }
    },
    fetchImpl,
    signal
  )
  return (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .trim()
}
