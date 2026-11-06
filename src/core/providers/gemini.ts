import { errorFromHttp, ProviderError, toProviderError } from '../errors'
import { readSseData } from '../stream'
import type { StreamEvent, TurnUsage } from '../types'
import type { FetchLike, GenerateRequest, ModelProvider } from './types'

// API REST oficial de Gemini (Google AI Studio): https://ai.google.dev/api/generate-content
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'
const NAME = 'Gemini'

interface GeminiPart {
  text?: string
  thought?: boolean
}

interface GeminiChunk {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }
  error?: { code?: number; message?: string; status?: string }
}

/** Motivos de finalización que indican que la respuesta se cortó por políticas del proveedor. */
const BLOCKING_FINISH = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII'])

export class GeminiProvider implements ModelProvider {
  readonly id = 'gemini' as const
  readonly displayName = NAME

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly baseUrl = BASE_URL
  ) {}

  private headers(): Record<string, string> {
    if (!this.apiKey) throw new ProviderError('config', 'Falta la clave API de Gemini. Añádela en Configuración.')
    return { 'x-goog-api-key': this.apiKey, 'Content-Type': 'application/json' }
  }

  async *stream(req: GenerateRequest): AsyncGenerator<StreamEvent> {
    const headers = this.headers()
    if (!req.model) throw new ProviderError('config', 'No hay modelo de Gemini seleccionado.')
    const body = {
      system_instruction: { parts: [{ text: req.system }] },
      contents: req.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }, ...(m.images ?? []).map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.data } }))]
      })),
      generationConfig: { temperature: req.temperature ?? 0.3 }
    }
    const url = `${this.baseUrl}/models/${encodeURIComponent(req.model)}:streamGenerateContent?alt=sse`

    let res: Response
    try {
      res = await this.fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body), signal: req.signal })
    } catch (err) {
      throw toProviderError(NAME, err)
    }
    if (!res.ok) throw errorFromHttp(NAME, res.status, await safeText(res), res.headers.get('retry-after'))
    if (!res.body) throw new ProviderError('unknown', 'Gemini devolvió una respuesta vacía.')

    let usage: TurnUsage | undefined
    let finishReason: string | undefined
    let produced = false
    try {
      for await (const data of readSseData(res.body)) {
        let chunk: GeminiChunk
        try {
          chunk = JSON.parse(data)
        } catch {
          continue
        }
        if (chunk.error) {
          const status = chunk.error.code ?? 500
          throw errorFromHttp(NAME, status, JSON.stringify({ error: chunk.error }))
        }
        if (chunk.promptFeedback?.blockReason) {
          throw new ProviderError('blocked', `Gemini bloqueó la consulta (${chunk.promptFeedback.blockReason}). Reformúlala.`)
        }
        const cand = chunk.candidates?.[0]
        // Las partes marcadas como `thought` son razonamiento interno: no se muestran como respuesta.
        const text = (cand?.content?.parts ?? []).filter((p) => !p.thought && p.text).map((p) => p.text).join('')
        if (text) {
          produced = true
          yield { type: 'delta', text }
        }
        if (cand?.finishReason) finishReason = cand.finishReason
        if (chunk.usageMetadata) {
          usage = { inputTokens: chunk.usageMetadata.promptTokenCount, outputTokens: chunk.usageMetadata.candidatesTokenCount }
        }
      }
    } catch (err) {
      throw toProviderError(NAME, err)
    }

    if (finishReason && BLOCKING_FINISH.has(finishReason)) {
      throw new ProviderError('blocked', `Gemini detuvo la respuesta por sus políticas (${finishReason}).`)
    }
    if (!produced) throw new ProviderError('unknown', `Gemini terminó sin devolver texto${finishReason ? ` (${finishReason})` : ''}.`)
    yield { type: 'done', usage, finishReason }
  }

  async listModels(signal?: AbortSignal): Promise<string[]> {
    const headers = this.headers()
    const names: string[] = []
    let pageToken = ''
    try {
      do {
        const url = `${this.baseUrl}/models?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`
        const res = await this.fetchImpl(url, { headers, signal })
        if (!res.ok) throw errorFromHttp(NAME, res.status, await safeText(res), res.headers.get('retry-after'))
        const json = (await res.json()) as {
          models?: { name: string; supportedGenerationMethods?: string[] }[]
          nextPageToken?: string
        }
        for (const m of json.models ?? []) {
          if (m.supportedGenerationMethods?.includes('generateContent') && /gemini/i.test(m.name)) {
            names.push(m.name.replace(/^models\//, ''))
          }
        }
        pageToken = json.nextPageToken ?? ''
      } while (pageToken)
    } catch (err) {
      throw toProviderError(NAME, err)
    }
    return names.sort()
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ''
  }
}
