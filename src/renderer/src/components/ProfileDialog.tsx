import { useEffect, useState } from 'react'
import type { ProfileView } from '../../../core/types'
import { cleanIpcError } from '../util'
import './Dialog.css'

const SOURCE_LABELS: Record<string, string> = { inicial: 'de serie', xara: 'aprendido', usuario: 'tuyo' }

export function ProfileDialog({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<ProfileView | null>(null)
  const [prefs, setPrefs] = useState('')
  const [newFact, setNewFact] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    void window.copilot.getProfile().then((v) => {
      setView(v)
      setPrefs(v.preferences)
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const update = async (patch: Partial<ProfileView>, done: string) => {
    try {
      setView(await window.copilot.updateProfile(patch))
      setMsg(done)
    } catch (err) {
      setMsg(cleanIpcError(err))
    }
  }

  if (!view) return null
  const ins = view.insights

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Memoria de XARA">
        <h2>Lo que XARA ha aprendido de ti</h2>
        <p className="hint">
          El modelo no se reentrena. La app aprende de tu historial local (temas, acciones que pides y tus 👍/👎) y añade un resumen a cada
          consulta para adaptar las respuestas. Ese resumen sí viaja al proveedor junto con la pregunta.
        </p>

        <label className="check">
          <input type="checkbox" checked={view.enabled} onChange={(e) => update({ enabled: e.target.checked }, e.target.checked ? 'Memoria activada.' : 'Memoria desactivada.')} />
          Usar esta memoria en las consultas
        </label>

        <div className="field">
          <label>Mis preferencias (se respetan siempre)</label>
          <textarea
            rows={3}
            maxLength={600}
            value={prefs}
            onChange={(e) => setPrefs(e.target.value)}
            placeholder="Ej.: Prefiero TypeScript, respuestas cortas y pruebas con Vitest. Estoy preparando entrevistas de frontend."
          />
          <div className="row end">
            <button onClick={() => update({ preferences: prefs }, 'Preferencias guardadas.')} disabled={prefs === view.preferences}>
              Guardar preferencias
            </button>
          </div>
        </div>

        <div className="field">
          <label>Lo que XARA recuerda de ti</label>
          <p className="hint">Puedes borrar lo que no quieras o añadir algo. XARA también guarda cosas sola mientras conversan (marcadas como «aprendido»).</p>
          <ul className="facts">
            {view.facts.map((f) => (
              <li key={f.id}>
                <span>{f.text}</span>
                <span className="tag">{SOURCE_LABELS[f.source] ?? f.source}</span>
                <button className="icon-btn" title="Olvidar" onClick={() => void window.copilot.forgetFact(f.id).then(setView)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
          <div className="row">
            <input
              value={newFact}
              placeholder="Añade un dato sobre ti (p. ej. prefiero ejemplos con videojuegos)"
              onChange={(e) => setNewFact(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFact.trim()) {
                  void window.copilot.rememberFact(newFact.trim()).then(setView)
                  setNewFact('')
                }
              }}
            />
            <button
              disabled={!newFact.trim()}
              onClick={() => {
                void window.copilot.rememberFact(newFact.trim()).then(setView)
                setNewFact('')
              }}
            >
              Añadir
            </button>
          </div>
        </div>

        <div className="insights">
          <div>
            <b>{ins.sessionCount}</b> sesiones · <b>{ins.ratedUp}</b> 👍 · <b>{ins.ratedDown}</b> 👎
          </div>
          <div>
            <span className="muted-text">Temas que más practicas: </span>
            {ins.topTopics.length ? ins.topTopics.map((t) => `${t.topic} (${t.sessions})`).join(', ') : 'aún ninguno'}
          </div>
          <div>
            <span className="muted-text">Temas a reforzar: </span>
            {ins.weakTopics.length ? ins.weakTopics.map((t) => t.topic).join(', ') : 'aún ninguno'}
          </div>
          {ins.dislikes.length > 0 && (
            <div>
              <span className="muted-text">Lo que no te ha servido: </span>
              {ins.dislikes.map((d) => `${d.note} (${d.count})`).join(', ')}
            </div>
          )}
        </div>

        <details className="prompt-block">
          <summary>Texto exacto que se añade a cada consulta</summary>
          <pre>{view.promptBlock || '(nada todavía: valora respuestas o escribe tus preferencias)'}</pre>
        </details>
        <p className="hint">Para que olvide algo, borra las sesiones correspondientes en el historial o desactiva la memoria.</p>

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
