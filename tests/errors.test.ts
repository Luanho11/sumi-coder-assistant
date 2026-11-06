import { describe, expect, it } from 'vitest'
import { errorFromHttp, parseRetryAfter, ProviderError, toProviderError } from '../src/core/errors'

describe('errorFromHttp', () => {
  it('clasifica autenticación', () => {
    expect(errorFromHttp('Gemini', 401, '').kind).toBe('auth')
    expect(errorFromHttp('Gemini', 403, '{"error":{"message":"denied"}}').message).toContain('denied')
  })

  it('detecta clave inválida de Google aunque llegue como 400', () => {
    const body = JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } })
    expect(errorFromHttp('Gemini', 400, body).kind).toBe('auth')
  })

  it('clasifica límites con Retry-After', () => {
    const e = errorFromHttp('Gemini', 429, '{"error":{"message":"quota"}}', '17')
    expect(e.kind).toBe('rate_limit')
    expect(e.retryAfterSec).toBe(17)
    expect(e.toInfo().retryable).toBe(true)
    expect(e.message).toContain('17 s')
  })

  it('clasifica errores de servidor como reintentables y 400 como no', () => {
    expect(errorFromHttp('X', 503, '').toInfo().retryable).toBe(true)
    expect(errorFromHttp('X', 400, 'bad').toInfo()).toMatchObject({ kind: 'bad_request', retryable: false })
    expect(errorFromHttp('X', 404, '').kind).toBe('not_found')
  })
})

describe('toProviderError', () => {
  it('reconoce fallos de red de fetch', () => {
    const err = new TypeError('fetch failed', { cause: new Error('getaddrinfo ENOTFOUND') })
    const e = toProviderError('Gemini', err)
    expect(e.kind).toBe('network')
    expect(e.message).toContain('ENOTFOUND')
  })

  it('reconoce cancelaciones', () => {
    const abort = new DOMException('This operation was aborted', 'AbortError')
    expect(toProviderError('Gemini', abort).kind).toBe('aborted')
  })

  it('no reenvuelve un ProviderError', () => {
    const e = new ProviderError('config', 'x')
    expect(toProviderError('G', e)).toBe(e)
  })
})

describe('parseRetryAfter', () => {
  it('acepta segundos y fechas HTTP', () => {
    expect(parseRetryAfter('5')).toBe(5)
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 0)).toBe(10)
    expect(parseRetryAfter('basura')).toBeUndefined()
    expect(parseRetryAfter(null)).toBeUndefined()
  })
})
