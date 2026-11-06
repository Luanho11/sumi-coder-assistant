import type { FetchLike } from '../src/core/providers'

/** Crea un ReadableStream que emite los fragmentos dados (como bytes UTF-8), para simular streaming. */
export function streamOf(chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(typeof c === 'string' ? enc.encode(c) : c)
      controller.close()
    }
  })
}

export interface Call {
  url: string
  init?: RequestInit
}

/** fetch falso que registra las llamadas y devuelve respuestas predefinidas en orden. */
export function fakeFetch(responses: (Response | Error | ((call: Call) => Response))[]): FetchLike & { calls: Call[] } {
  const calls: Call[] = []
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(input), init }
    calls.push(call)
    const next = responses.shift()
    if (!next) throw new Error('fakeFetch: no quedan respuestas')
    if (next instanceof Error) throw next
    return typeof next === 'function' ? next(call) : next
  }) as FetchLike & { calls: Call[] }
  fn.calls = calls
  return fn
}

export function sse(events: unknown[]): string[] {
  return events.map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`)
}
