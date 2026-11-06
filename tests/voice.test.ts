import { describe, expect, it } from 'vitest'
import { FISH_MODEL, fishSpeech } from '../src/core/voice'
import { fakeFetch } from './helpers'

describe('fishSpeech', () => {
  it('pide el modelo gratuito con la voz indicada y devuelve el MP3 en base64', async () => {
    const f = fakeFetch([new Response(new Uint8Array([1, 2, 3]))])
    const audio = await fishSpeech('clave', 'voz-verity', 'Hola', f)
    expect(audio).toBe(Buffer.from([1, 2, 3]).toString('base64'))
    const { headers, body } = f.calls[0].init as { headers: Record<string, string>; body: string }
    // Sin un modelo reconocido Fish usa el de pago y una cuenta gratuita recibe 402.
    expect(headers.model).toBe(FISH_MODEL)
    expect(FISH_MODEL).toBe('s2.1-pro-free')
    expect(JSON.parse(body)).toMatchObject({ text: 'Hola', reference_id: 'voz-verity', format: 'mp3' })
  })

  it('explica la falta de crédito en vez de fallar en silencio', async () => {
    const f = fakeFetch([new Response('{"status":402,"message":"Insufficient balance"}', { status: 402 })])
    await expect(fishSpeech('clave', 'voz', 'Hola', f)).rejects.toThrow(/no tiene crédito/)
  })
})
