import { describe, expect, it } from 'vitest'
import { OllamaProvider } from '../src/core/providers/ollama'
import type { StreamEvent } from '../src/core/types'
import { fakeFetch, streamOf } from './helpers'

async function collect(gen: AsyncGenerator<StreamEvent>) {
  const out: StreamEvent[] = []
  for await (const ev of gen) out.push(ev)
  return out
}

const req = { model: 'qwen', system: 'SYS', messages: [{ role: 'user' as const, content: 'hola' }] }

describe('OllamaProvider', () => {
  it('emite deltas desde NDJSON e incluye el prompt de sistema', async () => {
    const f = fakeFetch([
      new Response(
        streamOf([
          '{"message":{"content":"Ho"},"done":false}\n',
          '{"message":{"content":"la"},"done":false}\n{"message":{"content":""},"done":true,"done_reason":"stop","prompt_eval_count":3,"eval_count":2}\n'
        ])
      )
    ])
    const events = await collect(new OllamaProvider('http://127.0.0.1:11434/', f).stream(req))
    expect(events.filter((e) => e.type === 'delta').map((e) => (e as { text: string }).text).join('')).toBe('Hola')
    expect(events.at(-1)).toEqual({ type: 'done', finishReason: 'stop', usage: { inputTokens: 3, outputTokens: 2 } })
    expect(f.calls[0].url).toBe('http://127.0.0.1:11434/api/chat')
    expect(JSON.parse(f.calls[0].init!.body as string).messages[0]).toEqual({ role: 'system', content: 'SYS' })
  })

  it('explica cómo resolver si Ollama no está en ejecución', async () => {
    const f = fakeFetch([new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED') })])
    await expect(collect(new OllamaProvider(undefined, f).stream(req))).rejects.toThrow(/¿Está instalado y en ejecución\?/)
  })

  it('detecta un stream cortado antes de terminar', async () => {
    const f = fakeFetch([new Response(streamOf(['{"message":{"content":"a"},"done":false}\n']))])
    await expect(collect(new OllamaProvider(undefined, f).stream(req))).rejects.toMatchObject({ kind: 'network' })
  })

  it('envía las capturas en el campo images', async () => {
    const f = fakeFetch([new Response(streamOf(['{"message":{"content":"a"},"done":true}\n']))])
    await collect(new OllamaProvider(undefined, f).stream({ ...req, messages: [{ role: 'user', content: 'mira', images: [{ mimeType: 'image/png', data: 'QUJD' }] }] }))
    expect(JSON.parse(f.calls[0].init!.body as string).messages[1]).toEqual({ role: 'user', content: 'mira', images: ['QUJD'] })
  })

  it('lista modelos instalados', async () => {
    const f = fakeFetch([Response.json({ models: [{ name: 'b:latest' }, { name: 'a:7b' }] })])
    expect(await new OllamaProvider(undefined, f).listModels()).toEqual(['a:7b', 'b:latest'])
  })
})
