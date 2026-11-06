import { errorFromHttp, ProviderError, toProviderError } from '../errors'
import { readSseData } from '../stream'
import type { StreamEvent, TurnUsage } from '../types'
import type { FetchLike, GenerateRequest, ModelProvider } from './types'

// Groq expone una API compatible con OpenAI y responde muy rápido (hardware LPU).
// https://console.groq.com/docs/api-reference#chat-create
const BASE_URL = 'https://api.groq.com/openai/v1'
const NAME = 'Groq'

interface GroqChunk {
  choices?: { delta?: { content?: string }; finish_reason?: string }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
  error?: { message?: string; code?: string | number }
}

export class GroqProvider implements ModelProvider {
  readonly id = 'groq' as const
  readonly displayName = NAME

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly baseUrl = BASE_URL
  ) {}

  private headers(): Record<string, string> {
    if (!this.apiKey) throw new ProviderError('config', 'Falta la clave API de Groq. Añádela en Configuración.')
    return { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }
  }

  async *stream(req: GenerateRequest): AsyncGenerator<StreamEvent> {
    const headers = this.headers()
    if (!req.model) throw new ProviderError('config', 'No hay modelo de Groq seleccionado.')
    const messages = [
      { role: 'system', content: req.system },
      // Groq (texto) usa contenido plano; si llega una imagen, se avisa en texto para no romper la petición.
      ...req.messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.images?.length ? `${m.content}\n\n[Nota: hay una imagen adjunta que este proveedor no puede ver; usa Gemini para consultas con imagen.]` : m.content
      }))
    ]
    const body = { model: req.model, messages, temperature: req.temperature ?? 0.3, stream: true }

    let res: Response
    try {
      res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body), signal: req.signal })
    } catch (err) {
      throw toProviderError(NAME, err)
    }
    if (!res.ok) throw errorFromHttp(NAME, res.status, await safeText(res), res.headers.get('retry-after'))
    if (!res.body) throw new ProviderError('unknown', 'Groq devolvió una respuesta vacía.')

    let usage: TurnUsage | undefined
    let finishReason: string | undefined
    let produced = false
    try {
      for await (const data of readSseData(res.body)) {
        if (data === '[DONE]') break
        let chunk: GroqChunk
        try {
          chunk = JSON.parse(data)
        } catch {
          continue
        }
        if (chunk.error) throw new ProviderError('server', chunk.error.message ?? 'Error de Groq.')
        const choice = chunk.choices?.[0]
        const text = choice?.delta?.content
        if (text) {
          produced = true
          yield { type: 'delta', text }
        }
        if (choice?.finish_reason) finishReason = choice.finish_reason
        if (chunk.usage) usage = { inputTokens: chunk.usage.prompt_tokens, outputTokens: chunk.usage.completion_tokens }
      }
    } catch (err) {
      throw toProviderError(NAME, err)
    }

    if (!produced) throw new ProviderError('unknown', `Groq terminó sin devolver texto${finishReason ? ` (${finishReason})` : ''}.`)
    yield { type: 'done', usage, finishReason }
  }

  async listModels(signal?: AbortSignal): Promise<string[]> {
    const headers = this.headers()
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/models`, { headers, signal })
      if (!res.ok) throw errorFromHttp(NAME, res.status, await safeText(res), res.headers.get('retry-after'))
      const json = (await res.json()) as { data?: { id: string }[] }
      return (json.data ?? []).map((m) => m.id).sort()
    } catch (err) {
      throw toProviderError(NAME, err)
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ''
  }
}
