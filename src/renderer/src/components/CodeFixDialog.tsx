import { useEffect, useMemo, useState } from 'react'
import { lineDiff } from '../../../core/codefix'
import type { SettingsView } from '../../../core/types'
import { cleanIpcError } from '../util'
import { Markdown } from './Markdown'
import './Dialog.css'
import './CodeFixDialog.css'

interface Props {
  settings: SettingsView
  onSettings: (s: SettingsView) => void
  onClose: () => void
}

interface Picked {
  token: string
  name: string
  path: string
  content: string
}

export function CodeFixDialog({ settings, onSettings, onClose }: Props) {
  const [understood, setUnderstood] = useState(false)
  const [file, setFile] = useState<Picked | null>(null)
  const [instruction, setInstruction] = useState('')
  const [proposal, setProposal] = useState<{
    explanation: string
    proposal: string
  } | null>(null)
  const [backup, setBackup] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const diff = useMemo(() => (file && proposal ? lineDiff(file.content, proposal.proposal) : []), [file, proposal])
  const changes = diff.filter((d) => d.type !== 'same').length

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(cleanIpcError(err))
    } finally {
      setBusy(false)
    }
  }

  const setPermission = (codeFix: boolean) => run(async () => onSettings(await window.copilot.updateSettings({ codeFix })))

  if (!settings.codeFix) {
    return (
      <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal" role="dialog" aria-label="Permiso de corrección de código">
          <h2>Permitir que XARA corrija archivos</h2>
          <div className="warning">
            <b>Antes de activarlo, ten en cuenta:</b>
            <ul>
              <li>
                XARA podrá <b>modificar archivos de tu disco</b> que tú elijas, uno a uno.
              </li>
              <li>
                El contenido del archivo <b>se envía a tu proveedor de IA</b> (con Gemini gratuito, Google puede usarlo para mejorar sus productos). No lo uses
                con código confidencial de terceros.
              </li>
              <li>
                Siempre verás el <b>cambio línea a línea</b> antes de aplicarlo y se guarda una <b>copia de seguridad</b> para deshacerlo.
              </li>
              <li>Se bloquean archivos de secretos (.env, claves, certificados), los incluidos en .gitignore y los que contengan claves o contraseñas.</li>
              <li>La IA puede equivocarse: revisa el cambio y ejecuta tus pruebas después.</li>
            </ul>
          </div>
          <label className="check">
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
            Lo entiendo y quiero activar la corrección de archivos
          </label>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button onClick={onClose}>Cancelar</button>
            <button className="primary" disabled={!understood || busy} onClick={() => setPermission(true)}>
              Activar permiso
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-label="Corregir archivo">
        <h2>Corregir un archivo</h2>
        {!file ? (
          <>
            <p className="hint">Elige el archivo. XARA lo leerá solo después de comprobar que no contiene secretos.</p>
            <div className="modal-actions start">
              <button className="primary" disabled={busy} onClick={() => run(async () => setFile(await window.copilot.pickFileToFix()))}>
                Elegir archivo…
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="file-name">
              <b>{file.name}</b> <span className="muted-text">{file.path}</span>
            </p>
            {!proposal && (
              <div className="field">
                <label>¿Qué quieres corregir?</label>
                <textarea
                  rows={3}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Ej.: el bucle se sale del array; añade validación de la entrada"
                />
                <div className="modal-actions start">
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => run(async () => setProposal(await window.copilot.proposeFix(file.token, instruction)))}
                  >
                    {busy ? 'XARA está preparando el cambio…' : 'Proponer corrección'}
                  </button>
                </div>
              </div>
            )}
            {proposal && (
              <>
                <Markdown text={proposal.explanation} />
                <p className="hint">{changes ? `${changes} líneas cambian.` : 'XARA no propone cambios.'} Revisa el diff antes de aplicar.</p>
                <pre className="diff">
                  {diff.map((d, i) => (
                    <div key={i} className={`diff-${d.type}`}>
                      {d.type === 'add' ? '+ ' : d.type === 'del' ? '- ' : '  '}
                      {d.text}
                    </div>
                  ))}
                </pre>
              </>
            )}
            {done && <p className="ok-text">{done}</p>}
          </>
        )}
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button className="danger-link" onClick={() => setPermission(false)}>
            Retirar permiso
          </button>
          <span className="spacer" />
          {backup && (
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await window.copilot.undoFix(file!.token)
                  setBackup(null)
                  setDone('Cambio deshecho: el archivo vuelve a estar como antes.')
                })
              }
            >
              Deshacer
            </button>
          )}
          {proposal && !backup && changes > 0 && (
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const res = await window.copilot.applyFix(file!.token)
                  setBackup(res.backup)
                  setDone(`Aplicado. Copia de seguridad en ${res.backup}`)
                })
              }
            >
              Aplicar cambio
            </button>
          )}
          <button onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
