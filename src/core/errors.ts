import type { ProviderErrorInfo, ProviderErrorKind } from './types'

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind
  readonly status?: number
  readonly retryAfterSec?: number

  constructor(kind: ProviderErrorKind, message: string, opts: { status?: number; retryAfterSec?: number } = {}) {
    super(message)
    this.name = 'ProviderError'
    this.kind = kind
    this.status = opts.status
    this.retryAfterSec = opts.retryAfterSec
  }

  toInfo(): ProviderErrorInfo {
    return {
      kind: this.kind,
      message: this.message,
      status: this.status,
      retryAfterSec: this.retryAfterSec,
      retryable: isRetryable(this.kind)
    }
  }
}

export function isRetryable(kind: ProviderErrorKind): boolean {
  return kind === 'rate_limit' || kind === 'network' || kind === 'server'
}

/** Extrae el mensaje de un cuerpo de error JSON típico (`{error:{message}}`) o devuelve el texto recortado. */
export function extractErrorDetail(body: string): string {
  try {
    const parsed = JSON.parse(body)
    const err = Array.isArray(parsed) ? parsed[0]?.error : parsed?.error
    if (typeof err === 'string') return err
    if (err?.message) return String(err.message)
  } catch {
  }
  return body.trim().slice(0, 300)
}

/** Lee `Retry-After` en segundos o como fecha HTTP. */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number | undefined {
  if (!value) return undefined
  const secs = Number(value)
  if (Number.isFinite(secs) && secs >= 0) return Math.ceil(secs)
  const date = Date.parse(value)
  if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - now) / 1000))
  return undefined
}

/** Convierte una respuesta HTTP fallida en un ProviderError con mensaje útil en español. */
export function errorFromHttp(providerName: string, status: number, body: string, retryAfter?: string | null): ProviderError {
  const detail = extractErrorDetail(body)
  const suffix = detail ? ` Detalle: ${detail}` : ''
  if (status === 401 || status === 403) {
    return new ProviderError('auth', `${providerName} rechazó la credencial (HTTP ${status}). Revisa la clave en Configuración.${suffix}`, { status })
  }
  if (status === 429) {
    const retryAfterSec = parseRetryAfter(retryAfter)
    const wait = retryAfterSec !== undefined ? ` Espera unos ${retryAfterSec} s antes de reintentar.` : ' Espera un momento antes de reintentar.'
    return new ProviderError('rate_limit', `${providerName} ha aplicado un límite de uso (HTTP 429).${wait}${suffix}`, { status, retryAfterSec })
  }
  if (status === 402) {
    return new ProviderError('config', `${providerName} indica que la cuenta no tiene crédito (HTTP 402).${suffix}`, { status })
  }
  if (status === 404) {
    return new ProviderError('not_found', `${providerName} no encontró el recurso o el modelo (HTTP 404). Comprueba el nombre del modelo.${suffix}`, { status })
  }
  if (status === 400 || status === 422) {
    // Google devuelve 400 con API_KEY_INVALID cuando la clave no es válida.
    if (/API_KEY_INVALID|API key not valid/i.test(body)) {
      return new ProviderError('auth', `${providerName} indica que la clave API no es válida. Revisa la clave en Configuración.`, { status })
    }
    return new ProviderError('bad_request', `${providerName} rechazó la petición (HTTP ${status}).${suffix}`, { status })
  }
  if (status >= 500) {
    return new ProviderError('server', `${providerName} tuvo un error interno o está saturado (HTTP ${status}). Reintenta en unos segundos.${suffix}`, { status })
  }
  return new ProviderError('unknown', `${providerName} respondió con HTTP ${status}.${suffix}`, { status })
}

/** Normaliza cualquier excepción (fetch fallido, abort, etc.) a ProviderError. */
export function toProviderError(providerName: string, err: unknown): ProviderError {
  if (err instanceof ProviderError) return err
  if (err instanceof Error && (err.name === 'AbortError' || /aborted/i.test(err.message))) {
    return new ProviderError('aborted', 'Consulta cancelada.')
  }
  const msg = err instanceof Error ? err.message : String(err)
  const cause = err instanceof Error && err.cause instanceof Error ? ` (${err.cause.message})` : ''
  if (err instanceof TypeError || /fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|network/i.test(msg)) {
    return new ProviderError('network', `No se pudo conectar con ${providerName}. Comprueba tu conexión o la URL configurada.${cause}`)
  }
  return new ProviderError('unknown', `Error inesperado con ${providerName}: ${msg}`)
}
