import { describe, expect, it } from 'vitest'
import { readNdjson, readSseData } from '../src/core/stream'
import { streamOf } from './helpers'

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = []
  for await (const x of gen) out.push(x)
  return out
}

describe('readSseData', () => {
  it('reconstruye eventos partidos entre fragmentos y caracteres multibyte', async () => {
    const bytes = new TextEncoder().encode('data: {"t":"canción"}\n\ndata: {"t":"ñ"}\n\n')
    const chunks = [bytes.slice(0, 5), bytes.slice(5, 19), bytes.slice(19, 30), bytes.slice(30)]
    expect(await collect(readSseData(streamOf(chunks)))).toEqual(['{"t":"canción"}', '{"t":"ñ"}'])
  })

  it('ignora comentarios, une data multilínea y emite el último evento sin línea en blanco', async () => {
    const out = await collect(readSseData(streamOf([': ping\n', 'data: a\ndata: b\n\n', 'data: final'])))
    expect(out).toEqual(['a\nb', 'final'])
  })
})

describe('readNdjson', () => {
  it('parsea líneas JSON y salta líneas vacías', async () => {
    const out = await collect(readNdjson(streamOf(['{"a":1}\n\n{"a"', ':2}\n'])))
    expect(out).toEqual([{ a: 1 }, { a: 2 }])
  })
})
