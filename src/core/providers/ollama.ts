import { errorFromHttp, ProviderError, toProviderError } from '../errors'
import { readNdjson } from '../stream'
import type { StreamEvent } from '../types'
import type { FetchLike, GenerateRequest, ModelProvider } from './types'

// API local de Ollama: https://github.com/ollama/ollama/blob/main/docs/api.md
const NAME = 'Ollama'

interface OllamaChunk {
  message?: { content?: string }
  done?: boolean
  done_reason?: string
  prompt_eval_count?: number
  eval_count?: number
  error?: string
}

export class OllamaProvider implements ModelProvider {
  readonly id = 'ollama' as const
  readonly displayName = NAME

  constructor(
    private readonly baseUrl = 'http://127.0.0.1:11434',
    private readonly fetchImpl: FetchLike = fetch
  ) {}

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/+$/, '')}${path}`
  }

  async *stream(req: GenerateRequest): AsyncGenerator<StreamEvent> {
    if (!req.model) throw new ProviderError('config', 'No hay modelo de Ollama seleccionado. Descarga uno con `ollama pull <modelo>`.')
    const body = {
      model: req.model,
      stream: true,
      options: { temperature: req.temperature ?? 0.3 },
      messages: [
        { role: 'system', content: req.system },
        ...req.messages.map((m) => ({ role: m.role, content: m.content, ...(m.images ? { images: m.images.map((img) => img.data) } : {}) }))
      ]
    }
    let res: Response
    try {
      res = await this.fetchImpl(this.url('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: req.signal
      })
    } catch (err) {
      const e = toProviderError(NAME, err)
      if (e.kind === 'network') {
        throw new ProviderError('network', `No se pudo conectar con Ollama en ${this.baseUrl}. ¿Está instalado y en ejecución?`)
      }
      throw e
    }
    if (!res.ok) throw errorFromHttp(NAME, res.status, await res.text().catch(() => ''), res.headers.get('retry-after'))
    if (!res.body) throw new ProviderError('unknown', 'Ollama devolvió una respuesta vacía.')

    let produced = false
    try {
      for await (const chunk of readNdjson<OllamaChunk>(res.body)) {
        if (chunk.error) throw new ProviderError('server', `Ollama: ${chunk.error}`)
        const text = chunk.message?.content
        if (text) {
          produced = true
          yield { type: 'delta', text }
        }
        if (chunk.done) {
          if (!produced) throw new ProviderError('unknown', 'Ollama terminó sin devolver texto.')
          yield {
            type: 'done',
            finishReason: chunk.done_reason,
            usage: { inputTokens: chunk.prompt_eval_count, outputTokens: chunk.eval_count }
          }
          return
        }
      }
    } catch (err) {
      throw toProviderError(NAME, err)
    }
    throw new ProviderError('network', 'La conexión con Ollama se cortó antes de terminar la respuesta.')
  }

  async listModels(signal?: AbortSignal): Promise<string[]> {
    try {
      const res = await this.fetchImpl(this.url('/api/tags'), { signal })
      if (!res.ok) throw errorFromHttp(NAME, res.status, await res.text().catch(() => ''))
      const json = (await res.json()) as { models?: { name: string }[] }
      return (json.models ?? []).map((m) => m.name).sort()
    } catch (err) {
      const e = toProviderError(NAME, err)
      if (e.kind === 'network') {
        throw new ProviderError('network', `No se pudo conectar con Ollama en ${this.baseUrl}. ¿Está instalado y en ejecución?`)
      }
      throw e
    }
  }
}
