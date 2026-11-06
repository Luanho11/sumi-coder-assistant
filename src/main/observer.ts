import type { NativeImage } from 'electron'
import { ProviderError } from '../core/errors'
import { backoffMs, captureBlocker, CHANGE_THRESHOLD, newObserverState, parseObserverReply, signatureDiff } from '../core/observer'
import type { ImageAttachment, Observation, ObserverSettings, ObserverStatus } from '../core/types'

interface Deps {
  getSettings: () => Promise<ObserverSettings>
  capture: () => Promise<NativeImage>
  signature: (img: NativeImage) => number[]
  toAttachment: (img: NativeImage) => ImageAttachment
  /** Envía la captura al modelo con el prompt del observador y devuelve el texto de la respuesta. */
  analyze: (image: ImageAttachment) => Promise<string>
  onObservation: (o: Observation) => void
  onStatus: (s: ObserverStatus) => void
}

export class ScreenObserver {
  private state = newObserverState()
  private timer: NodeJS.Timeout | null = null
  private active = false
  private busy = false
  private lastInfo?: string
  private settings?: ObserverSettings

  constructor(private readonly deps: Deps) {}

  async status(): Promise<ObserverStatus> {
    const s = this.settings ?? (await this.deps.getSettings())
    return { active: this.active, capturesToday: this.state.capturesToday, dailyCap: s.dailyCap, intervalSec: s.intervalSec, lastInfo: this.lastInfo }
  }

  async start(): Promise<void> {
    if (this.active) return
    this.active = true
    this.lastInfo = undefined
    await this.schedule(5_000)
  }

  async stop(): Promise<void> {
    this.active = false
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    await this.emitStatus()
  }

  /** Analiza la pantalla ahora. Con `force` ignora la comprobación de cambios (botón "Analizar pantalla"). */
  async runOnce(force = false): Promise<Observation | null> {
    if (this.busy) return null
    this.busy = true
    try {
      this.settings = await this.deps.getSettings()
      const blocker = captureBlocker(this.state, this.settings)
      if (blocker) {
        this.lastInfo = blocker
        return null
      }
      const img = await this.deps.capture()
      const signature = this.deps.signature(img)
      if (!force && signatureDiff(this.state.lastSignature, signature) < CHANGE_THRESHOLD) {
        this.lastInfo = 'Sin cambios en pantalla desde el último análisis.'
        return null
      }
      this.state.lastSignature = signature
      this.state.capturesToday++
      const reply = await this.deps.analyze(this.deps.toAttachment(img))
      const observation = parseObserverReply(reply)
      this.lastInfo = observation ? undefined : 'Nada que comentar en el último análisis.'
      if (observation) this.deps.onObservation(observation)
      return observation
    } catch (err) {
      if (err instanceof ProviderError && err.kind === 'rate_limit') {
        this.state.backoffUntil = Date.now() + backoffMs(err.retryAfterSec)
      }
      this.lastInfo = err instanceof Error ? err.message : String(err)
      return null
    } finally {
      this.busy = false
      await this.emitStatus()
    }
  }

  private async schedule(delayMs?: number): Promise<void> {
    if (!this.active) return
    const s = await this.deps.getSettings()
    // Pausar y reanudar durante un análisis deja dos llamadas a schedule(); sin esto habría dos bucles de capturas.
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(async () => {
      await this.runOnce()
      await this.schedule()
    }, delayMs ?? s.intervalSec * 1000)
    await this.emitStatus()
  }

  private async emitStatus(): Promise<void> {
    this.deps.onStatus(await this.status())
  }
}
