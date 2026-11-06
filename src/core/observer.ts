// Modo observador: cada cierto tiempo se captura la pantalla y, si cambió lo suficiente,
// se pide al modelo un único consejo de tutor. La lógica de cuándo capturar y cómo leer la
// respuesta está aquí, sin Electron, para poder probarla.

import type { ObserverSettings, Observation, ObservationKind } from './types'

export const MIN_INTERVAL_SEC = 30
/** Diferencia media de brillo (0-1) por debajo de la cual la pantalla se considera igual. */
export const CHANGE_THRESHOLD = 0.02
const DEFAULT_BACKOFF_MS = 5 * 60_000

export const DEFAULT_OBSERVER: ObserverSettings = { intervalSec: 60, dailyCap: 120 }

export interface ObserverState {
  day: string
  capturesToday: number
  lastSignature?: number[]
  backoffUntil?: number
}

export function newObserverState(now = Date.now()): ObserverState {
  return { day: dayOf(now), capturesToday: 0 }
}

/** Día local: el límite diario se reinicia a medianoche del usuario, no a medianoche UTC. */
function dayOf(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function mergeObserverSettings(stored: Partial<ObserverSettings> | undefined): ObserverSettings {
  const interval = Number(stored?.intervalSec)
  const cap = Number(stored?.dailyCap)
  return {
    intervalSec: Number.isFinite(interval) ? Math.max(MIN_INTERVAL_SEC, Math.round(interval)) : DEFAULT_OBSERVER.intervalSec,
    dailyCap: Number.isFinite(cap) && cap > 0 ? Math.round(cap) : DEFAULT_OBSERVER.dailyCap
  }
}

/** Motivo por el que no se puede capturar ahora, o null si se puede. Reinicia el contador al cambiar de día. */
export function captureBlocker(state: ObserverState, settings: ObserverSettings, now = Date.now()): string | null {
  const today = dayOf(now)
  if (state.day !== today) {
    state.day = today
    state.capturesToday = 0
  }
  if (state.backoffUntil && now < state.backoffUntil) {
    return `En pausa por límite del proveedor hasta las ${new Date(state.backoffUntil).toLocaleTimeString('es')}.`
  }
  if (state.capturesToday >= settings.dailyCap) return `Límite diario de ${settings.dailyCap} análisis alcanzado.`
  return null
}

/** Firma de la pantalla: brillo de una miniatura en escala de grises, a partir de píxeles BGRA. */
export function signatureFromBgra(bitmap: Uint8Array): number[] {
  const out: number[] = []
  for (let i = 0; i + 2 < bitmap.length; i += 4) {
    out.push((0.114 * bitmap[i] + 0.587 * bitmap[i + 1] + 0.299 * bitmap[i + 2]) / 255)
  }
  return out
}

export function signatureDiff(a: number[] | undefined, b: number[]): number {
  if (!a || a.length !== b.length || b.length === 0) return 1
  let sum = 0
  for (let i = 0; i < b.length; i++) sum += Math.abs(a[i] - b[i])
  return sum / b.length
}

export function backoffMs(retryAfterSec?: number): number {
  return retryAfterSec !== undefined ? Math.max(retryAfterSec * 1000, 30_000) : DEFAULT_BACKOFF_MS
}

export const OBSERVER_SYSTEM = `Eres el modo OBSERVADOR de XARA, tutora de programación. Recibes una captura de la pantalla de un desarrollador web mientras trabaja.
Decide si hay algo que merezca interrumpirle: un error visible (mensaje de error, test fallido, excepción), un bug probable en el código, un riesgo de seguridad, una mala práctica clara o señales de que está atascado.
Si no hay nada valioso o la pantalla no muestra trabajo técnico, no avises: interrumpir sin motivo es peor que callar.
Cuando avises, actúa como tutor: da una pista o una pregunta que le haga pensar, no la solución. Cita lo que ves (archivo, línea o mensaje). No repitas datos personales, contraseñas ni claves que aparezcan.
Responde SOLO con un objeto JSON, sin texto alrededor:
{"avisar": true|false, "tipo": "error"|"bug"|"seguridad"|"practica"|"atasco", "titulo": "máx. 60 caracteres", "consejo": "máx. 280 caracteres, en español"}`

const KINDS: ObservationKind[] = ['error', 'bug', 'seguridad', 'practica', 'atasco']

/** Lee la respuesta del modelo. Devuelve null si no hay que avisar o si la respuesta no es válida. */
export function parseObserverReply(text: string, now = Date.now(), newId: () => string = () => globalThis.crypto.randomUUID()): Observation | null {
  const match = /\{[\s\S]*\}/.exec(text)
  if (!match) return null
  let data: Record<string, unknown>
  try {
    data = JSON.parse(match[0])
  } catch {
    return null
  }
  if (data.avisar !== true) return null
  const tip = typeof data.consejo === 'string' ? data.consejo.trim() : ''
  if (!tip) return null
  const kind = KINDS.includes(data.tipo as ObservationKind) ? (data.tipo as ObservationKind) : 'practica'
  const title = typeof data.titulo === 'string' && data.titulo.trim() ? data.titulo.trim().slice(0, 80) : 'Sugerencia'
  return { id: newId(), at: new Date(now).toISOString(), kind, title, tip: tip.slice(0, 400) }
}
