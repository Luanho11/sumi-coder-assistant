import { describe, expect, it } from 'vitest'
import { GeminiProvider } from '../src/core/providers/gemini'
import type { StreamEvent } from '../src/core/types'
import { fakeFetch, sse, streamOf } from './helpers'

async function collect(gen: AsyncGenerator<StreamEvent>) {
  const out: StreamEvent[] = []
  for await (const ev of gen) out.push(ev)
  return out
}

const req = { model: 'gemini-test', system: 'SYS', messages: [{ role: 'user' as const, content: 'hola' }, { role: 'assistant' as const, content: 'r' }, { role: 'user' as const, content: 'q' }] }

describe('GeminiProvider.stream', () => {
  it('envía la petición oficial con la clave en cabecera (no en la URL) y emite deltas', async () => {
    const f = fakeFetch([
      new Response(
        streamOf(
          sse([
            { candidates: [{ content: { parts: [{ text: 'pensando', thought: true }] } }] },
            { candidates: [{ content: { parts: [{ text: '## Resumen\n' }] } }] },
            { candidates: [{ content: { parts: [{ text: 'Hola' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 } }
          ])
        ),
        { status: 200, headers: { 'content-type': 'text/event-stream' } }
      )
    ])
    const events = await collect(new GeminiProvider('SECRET', f).stream(req))
    expect(events).toEqual([
      { type: 'delta', text: '## Resumen\n' },
      { type: 'delta', text: 'Hola' },
      { type: 'done', finishReason: 'STOP', usage: { inputTokens: 10, outputTokens: 5 } }
    ])
    const call = f.calls[0]
    expect(call.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:streamGenerateContent?alt=sse')
    expect(call.url).not.toContain('SECRET')
    expect((call.init!.headers as Record<string, string>)['x-goog-api-key']).toBe('SECRET')
    const body = JSON.parse(call.init!.body as string)
    expect(body.system_instruction.parts[0].text).toBe('SYS')
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user'])
  })

  it('falla con error de configuración si no hay clave, sin llamar a la red', async () => {
    const f = fakeFetch([])
    await expect(collect(new GeminiProvider('', f).stream(req))).rejects.toMatchObject({ kind: 'config' })
    expect(f.calls).toHaveLength(0)
  })

  it('traduce 429 a límite de uso con Retry-After', async () => {
    const f = fakeFetch([new Response('{"error":{"code":429,"message":"Resource exhausted","status":"RESOURCE_EXHAUSTED"}}', { status: 429, headers: { 'retry-after': '30' } })])
    await expect(collect(new GeminiProvider('k', f).stream(req))).rejects.toMatchObject({ kind: 'rate_limit', retryAfterSec: 30 })
  })

  it('traduce clave inválida a error de autenticación', async () => {
    const f = fakeFetch([new Response('{"error":{"code":400,"message":"API key not valid.","status":"INVALID_ARGUMENT"}}', { status: 400 })])
    await expect(collect(new GeminiProvider('k', f).stream(req))).rejects.toMatchObject({ kind: 'auth' })
  })

  it('traduce fallos de red', async () => {
    const f = fakeFetch([new TypeError('fetch failed')])
    await expect(collect(new GeminiProvider('k', f).stream(req))).rejects.toMatchObject({ kind: 'network' })
  })

  it('detecta un error enviado dentro del stream', async () => {
    const f = fakeFetch([new Response(streamOf(sse([{ candidates: [{ content: { parts: [{ text: 'a' }] } }] }, { error: { code: 503, message: 'overloaded' } }])))])
    await expect(collect(new GeminiProvider('k', f).stream(req))).rejects.toMatchObject({ kind: 'server' })
  })

  it('informa de bloqueos por políticas', async () => {
    const f = fakeFetch([new Response(streamOf(sse([{ promptFeedback: { blockReason: 'SAFETY' } }])))])
    await expect(collect(new GeminiProvider('k', f).stream(req))).rejects.toMatchObject({ kind: 'blocked' })
  })

  it('no da por buena una respuesta vacía', async () => {
    const f = fakeFetch([new Response(streamOf(sse([{ candidates: [{ finishReason: 'MAX_TOKENS' }] }])))])
    await expect(collect(new GeminiProvider('k', f).stream(req))).rejects.toThrow(/sin devolver texto/)
  })

  it('propaga la cancelación', async () => {
    const controller = new AbortController()
    const f = fakeFetch([
      (call) => {
        controller.abort()
        call.init!.signal!.throwIfAborted()
        return new Response('')
      }
    ])
    await expect(collect(new GeminiProvider('k', f).stream({ ...req, signal: controller.signal }))).rejects.toMatchObject({ kind: 'aborted' })
  })
})

describe('GeminiProvider imágenes', () => {
  it('envía las capturas como inline_data', async () => {
    const f = fakeFetch([new Response(streamOf(sse([{ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }])))])
    const img = { mimeType: 'image/jpeg' as const, data: 'QUJD' }
    await collect(new GeminiProvider('k', f).stream({ model: 'm', system: 's', messages: [{ role: 'user', content: 'mira', images: [img] }] }))
    const body = JSON.parse(f.calls[0].init!.body as string)
    expect(body.contents[0].parts).toEqual([{ text: 'mira' }, { inline_data: { mime_type: 'image/jpeg', data: 'QUJD' } }])
  })
})

describe('GeminiProvider.listModels', () => {
  it('pagina y filtra modelos que soportan generateContent', async () => {
    const f = fakeFetch([
      Response.json({
        models: [
          { name: 'models/gemini-b', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/text-embedding', supportedGenerationMethods: ['embedContent'] }
        ],
        nextPageToken: 'p2'
      }),
      Response.json({ models: [{ name: 'models/gemini-a', supportedGenerationMethods: ['generateContent', 'countTokens'] }] })
    ])
    expect(await new GeminiProvider('k', f).listModels()).toEqual(['gemini-a', 'gemini-b'])
    expect(f.calls[1].url).toContain('pageToken=p2')
  })
})
