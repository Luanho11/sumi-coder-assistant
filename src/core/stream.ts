/** Divide un stream de bytes en líneas de texto, tolerando cortes a mitad de línea o de carácter UTF-8. */
export async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).replace(/\r$/, '')
        buffer = buffer.slice(idx + 1)
        yield line
      }
    }
    buffer += decoder.decode()
    if (buffer.length > 0) yield buffer.replace(/\r$/, '')
  } finally {
    reader.releaseLock()
  }
}

/** Devuelve el contenido `data:` de cada evento SSE (los eventos multilínea se unen con \n). */
export async function* readSseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  let data: string[] = []
  for await (const line of readLines(body)) {
    if (line === '') {
      if (data.length) yield data.join('\n')
      data = []
      continue
    }
    if (line.startsWith(':')) continue
    if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
  }
  if (data.length) yield data.join('\n')
}

/** Devuelve cada línea JSON no vacía de un stream NDJSON. */
export async function* readNdjson<T = unknown>(body: ReadableStream<Uint8Array>): AsyncGenerator<T> {
  for await (const line of readLines(body)) {
    const trimmed = line.trim()
    if (trimmed) yield JSON.parse(trimmed) as T
  }
}
