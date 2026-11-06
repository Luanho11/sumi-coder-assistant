import { forwardRef } from 'react'
import type { CopilotAction, QuickInput } from '../../../core/types'
import { Icon } from './Icon'
import './Composer.css'

interface Props {
  value: string
  onChange: (v: string) => void
  hasTurns: boolean
  busy: boolean
  onSend: (action: CopilotAction, text: string) => void
  onCancel: () => void
  attachment: QuickInput | null
  onAttach: (q: QuickInput | null) => void
  onCapture: () => void
  onClipboard: () => void
  recording: boolean
  onMic: () => void
}

const QUICK_ACTIONS: { action: CopilotAction; label: string; title: string }[] = [
  { action: 'hint', label: 'Pista', title: 'Siguiente pista sin revelar la solución (Alt+1)' },
  { action: 'debug', label: 'Depurar', title: 'Pega código o un error y depúralo (Alt+2)' },
  { action: 'review', label: 'Revisar', title: 'Pega tu código para revisarlo (Alt+3)' },
  { action: 'tests', label: 'Pruebas', title: 'Casos de prueba y casos límite (Alt+4)' },
  { action: 'explain', label: 'Explicar', title: 'Cómo explicar y defender la solución (Alt+5)' }
]

export const Composer = forwardRef<HTMLTextAreaElement, Props>(function Composer(
  { value, onChange, hasTurns, busy, onSend, onCancel, attachment, onAttach, onCapture, onClipboard, recording, onMic },
  ref
) {
  const primary: CopilotAction = hasTurns ? 'followup' : 'analyze'
  const hasContent = value.trim().length > 0 || !!attachment
  const canSendPrimary = !busy && hasContent

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = [...e.clipboardData.files].find((f) => f.type === 'image/png' || f.type === 'image/jpeg')
    if (!file) return
    e.preventDefault()
    const reader = new FileReader()
    reader.onload = () => {
      const preview = String(reader.result)
      onAttach({ preview, image: { mimeType: file.type as 'image/png' | 'image/jpeg', data: preview.split(',')[1] } })
    }
    reader.readAsDataURL(file)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (canSendPrimary) onSend(primary, value)
      return
    }
    if (e.altKey && /^[1-5]$/.test(e.key)) {
      e.preventDefault()
      const qa = QUICK_ACTIONS[Number(e.key) - 1]
      if (!busy && (hasTurns || hasContent)) onSend(qa.action, value)
    }
  }

  return (
    <footer className="composer">
      {attachment?.preview && (
        <div className="attachment">
          <img src={attachment.preview} alt="Captura adjunta" />
          <span className="muted-text">Captura adjunta: se enviará con la próxima consulta y no se guarda en el historial.</span>
          <button className="icon-btn" title="Quitar captura" onClick={() => onAttach(null)}>
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder={hasTurns ? 'Pregunta lo que quieras, o pega código…' : 'Pregúntame lo que sea: un concepto, un error, una idea…'}
        rows={hasTurns ? 2 : 3}
        spellCheck={false}
      />
      <div className="composer-row">
        <div className="quick">
          <button className={recording ? 'mic on' : 'mic'} title={recording ? 'Detener y transcribir' : 'Hablar por micrófono'} onClick={onMic} disabled={busy}>
            <Icon name="mic" size={15} /> {recording ? 'Escuchando…' : 'Hablar'}
          </button>
          <button title="Recortar una zona de la pantalla (Ctrl+Alt+S)" onClick={onCapture} disabled={busy}>
            <Icon name="camera" size={15} />
          </button>
          <button title="Usar lo que copiaste (Ctrl+Alt+C)" onClick={onClipboard} disabled={busy}>
            <Icon name="clipboard" size={15} />
          </button>
          {QUICK_ACTIONS.map((qa) => (
            <button key={qa.action} title={qa.title} disabled={busy || (!hasTurns && !hasContent)} onClick={() => onSend(qa.action, value)}>
              {qa.label}
            </button>
          ))}
        </div>
        {busy ? (
          <button className="danger send" onClick={onCancel} title="Esc">
            Cancelar
          </button>
        ) : (
          <button className="primary send" disabled={!canSendPrimary} onClick={() => onSend(primary, value)} title="Ctrl+Enter">
            Enviar
          </button>
        )}
      </div>
    </footer>
  )
})
