import type { NativeImage } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScreenObserver } from '../src/main/observer'

describe('ScreenObserver', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('pausar y reanudar durante un análisis no duplica el bucle de capturas', async () => {
    let terminarAnalisis = () => {}
    const analyze = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          terminarAnalisis = () => resolve('{"avisar": false}')
        })
    )
    const observer = new ScreenObserver({
      getSettings: async () => ({ intervalSec: 60, dailyCap: 100 }),
      capture: async () => ({}) as NativeImage,
      // Firma distinta en cada captura para que siempre haya "cambios".
      signature: () => [Math.random()],
      toAttachment: () => ({ mimeType: 'image/jpeg', data: '' }),
      analyze,
      onObservation: () => {},
      onStatus: () => {}
    })

    await observer.start()
    await vi.advanceTimersByTimeAsync(5_000)
    expect(analyze).toHaveBeenCalledTimes(1)

    await observer.stop()
    await observer.start()
    terminarAnalisis()
    await vi.advanceTimersByTimeAsync(0)

    expect(vi.getTimerCount()).toBe(1)
    await observer.stop()
  })
})
