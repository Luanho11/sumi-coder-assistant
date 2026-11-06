import { useEffect, useState } from 'react'
import type { Observation, ObserverStatus, SettingsView } from '../../../core/types'
import { cleanIpcError } from '../util'
import './Dialog.css'

interface Props {
  settings: SettingsView
  providerName: string
  status: ObserverStatus
  observations: Observation[]
  onSettings: (s: SettingsView) => void
  onExplore: (o: Observation) => void
  onClose: () => void
}

export function ObserverDialog({ settings, providerName, status, observations, onSettings, onExplore, onClose }: Props) {
  const [intervalSec, setIntervalSec] = useState(settings.observer.intervalSec)
  const [dailyCap, setDailyCap] = useState(settings.observer.dailyCap)
  const [analyzing, setAnalyzing] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const saveLimits = async () => {
    try {
      onSettings(await window.copilot.updateSettings({ observer: { intervalSec, dailyCap } }))
      setMsg('Ajustes guardados.')
    } catch (err) {
      setMsg(cleanIpcError(err))
    }
  }

  const analyzeNow = async () => {
    setAnalyzing(true)
    setMsg(null)
    try {
      const o = await window.copilot.analyzeScreenNow()
      if (!o) setMsg((await window.copilot.observerStatus()).lastInfo ?? 'Nada que comentar.')
    } catch (err) {
      setMsg(cleanIpcError(err))
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Modo observador">
        <h2>Modo observador</h2>
        <p className="hint">
          Cada {settings.observer.intervalSec} s captura tu pantalla principal y, si cambió, la envía a <b>{providerName}</b> para pedir un consejo de
          tutor. Las capturas no se guardan. Mientras está activo verás el indicador <b>● Observando</b> y el título de la ventana lo indica. Se pausa
          con <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>O</kbd> o al bloquear el equipo.
        </p>
        <p className="hint">
          Úsalo solo donde la ayuda con IA esté permitida. No intenta ocultarse de otras capturas ni de sistemas de supervisión. Evita tener contraseñas o
          datos de terceros a la vista: también se enviarían.
          {settings.providerId === 'gemini' && ' Con la clave gratuita de Gemini, Google puede usar estas capturas para mejorar sus productos; para que no salgan del equipo usa Ollama.'}
        </p>

        <div className="row observer-actions">
          <button className={status.active ? 'danger' : 'primary'} onClick={() => window.copilot.setObserver(!status.active)}>
            {status.active ? 'Pausar observador' : 'Activar observador'}
          </button>
          <button onClick={analyzeNow} disabled={analyzing}>
            {analyzing ? 'Analizando…' : 'Analizar pantalla ahora'}
          </button>
        </div>
        <p className="hint">
          Hoy: {status.capturesToday} de {status.dailyCap} análisis{status.lastInfo ? ` · ${status.lastInfo}` : ''}
        </p>

        <div className="field">
          <label>Frecuencia y límite diario (cuida el nivel gratuito del proveedor)</label>
          <div className="row">
            <input type="number" min={30} step={10} value={intervalSec} onChange={(e) => setIntervalSec(Number(e.target.value))} aria-label="Segundos entre capturas" />
            <input type="number" min={1} value={dailyCap} onChange={(e) => setDailyCap(Number(e.target.value))} aria-label="Análisis por día" />
            <button onClick={saveLimits}>Guardar</button>
          </div>
          <p className="hint">Segundos entre capturas (mínimo 30) · análisis máximos por día.</p>
        </div>

        {observations.length > 0 && (
          <ul className="observations">
            {observations.map((o) => (
              <li key={o.id}>
                <div>
                  <b>{o.title}</b> <span className="muted-text">{new Date(o.at).toLocaleTimeString('es', { timeStyle: 'short' })}</span>
                </div>
                <div>{o.tip}</div>
                <button onClick={() => onExplore(o)}>Profundizar</button>
              </li>
            ))}
          </ul>
        )}

        {msg && <p className="ok-text">{msg}</p>}
        <div className="modal-actions">
          <button className="primary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
