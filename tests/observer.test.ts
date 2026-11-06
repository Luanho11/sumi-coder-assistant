import { describe, expect, it } from 'vitest'
import {
  backoffMs,
  captureBlocker,
  CHANGE_THRESHOLD,
  mergeObserverSettings,
  newObserverState,
  parseObserverReply,
  signatureDiff,
  signatureFromBgra
} from '../src/core/observer'

describe('captureBlocker', () => {
  const settings = { intervalSec: 60, dailyCap: 2 }

  it('respeta el límite diario y lo reinicia al cambiar de día', () => {
    const day1 = Date.parse('2026-10-24T10:00:00Z')
    const state = newObserverState(day1)
    expect(captureBlocker(state, settings, day1)).toBeNull()
    state.capturesToday = 2
    expect(captureBlocker(state, settings, day1)).toMatch(/Límite diario/)
    expect(captureBlocker(state, settings, day1 + 24 * 3600_000)).toBeNull()
    expect(state.capturesToday).toBe(0)
  })

  it('espera tras un límite del proveedor', () => {
    const now = Date.now()
    const state = { ...newObserverState(now), backoffUntil: now + 60_000 }
    expect(captureBlocker(state, settings, now)).toMatch(/En pausa/)
    expect(captureBlocker(state, settings, now + 61_000)).toBeNull()
  })

  it('aplica una espera mínima razonable', () => {
    expect(backoffMs(5)).toBe(30_000)
    expect(backoffMs(120)).toBe(120_000)
    expect(backoffMs()).toBe(300_000)
  })
})

describe('detección de cambios', () => {
  it('convierte BGRA a brillo y compara firmas', () => {
    const negro = signatureFromBgra(new Uint8Array([0, 0, 0, 255, 0, 0, 0, 255]))
    const blanco = signatureFromBgra(new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]))
    expect(negro).toEqual([0, 0])
    expect(blanco[0]).toBeCloseTo(1)
    expect(signatureDiff(negro, negro)).toBe(0)
    expect(signatureDiff(negro, blanco)).toBeCloseTo(1)
    expect(signatureDiff(undefined, negro)).toBe(1)
  })

  it('un cambio mínimo queda por debajo del umbral', () => {
    const a = Array(576).fill(0.5)
    const b = a.map((v, i) => (i < 5 ? v + 0.5 : v))
    expect(signatureDiff(a, b)).toBeLessThan(CHANGE_THRESHOLD)
  })
})

describe('parseObserverReply', () => {
  const at = Date.parse('2026-10-24T10:00:00Z')

  it('lee el JSON aunque venga dentro de un bloque de código', () => {
    const o = parseObserverReply('```json\n{"avisar": true, "tipo": "error", "titulo": "Test fallido", "consejo": "¿Qué devuelve sum([])?"}\n```', at, () => 'id1')
    expect(o).toEqual({ id: 'id1', at: '2026-10-24T10:00:00.000Z', kind: 'error', title: 'Test fallido', tip: '¿Qué devuelve sum([])?' })
  })

  it('no avisa si el modelo dice que no o si la respuesta no es válida', () => {
    expect(parseObserverReply('{"avisar": false}')).toBeNull()
    expect(parseObserverReply('no hay nada')).toBeNull()
    expect(parseObserverReply('{"avisar": true, "consejo": ""}')).toBeNull()
    expect(parseObserverReply('{roto')).toBeNull()
  })

  it('normaliza tipo y título desconocidos', () => {
    const o = parseObserverReply('{"avisar": true, "tipo": "otro", "consejo": "x"}')
    expect(o).toMatchObject({ kind: 'practica', title: 'Sugerencia' })
  })
})

describe('mergeObserverSettings', () => {
  it('impone un intervalo mínimo y valores por defecto', () => {
    expect(mergeObserverSettings({ intervalSec: 5, dailyCap: -1 })).toEqual({ intervalSec: 30, dailyCap: 120 })
    expect(mergeObserverSettings(undefined)).toEqual({ intervalSec: 60, dailyCap: 120 })
  })
})
