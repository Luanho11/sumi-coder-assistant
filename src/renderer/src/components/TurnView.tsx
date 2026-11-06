import { useState } from 'react'
import { ACTION_LABELS } from '../../../core/prompts'
import { isCollapsedByDefault, parseSections } from '../../../core/sections'
import { stripHiddenComments } from '../../../core/topics'
import type { Turn, TurnFeedback } from '../../../core/types'
import { Icon } from './Icon'
import { Markdown } from './Markdown'
import './TurnView.css'

interface Props {
  turn: Turn
  defaultOpen?: boolean
  live?: boolean
  onRetry?: () => void
  onFeedback?: (feedback: Omit<TurnFeedback, 'at'> | null) => void
  onSpeak?: () => void
}

const DOWN_REASONS = ['Demasiado largo', 'Muy básico', 'Demasiado avanzado', 'Incorrecto', 'Reveló demasiado', 'Poco concreto']

export function TurnView({ turn, defaultOpen, live, onRetry, onFeedback, onSpeak }: Props) {
  const [open, setOpen] = useState(!!defaultOpen)
  const [askReason, setAskReason] = useState(false)
  const parsed = parseSections(stripHiddenComments(turn.output))
  const summary = parsed.sections[0]

  return (
    <article className={`turn turn-${turn.status}`}>
      <header className="turn-header" onClick={() => setOpen((v) => !v)}>
        <span className={`chev ${open ? 'open' : ''}`}>›</span>
        <span className="turn-action">{ACTION_LABELS[turn.action]}</span>
        {!open && <span className="turn-preview">{previewOf(turn, summary?.body)}</span>}
        <span className="turn-meta">
          {turn.model}
          {turn.durationMs !== undefined && ` · ${(turn.durationMs / 1000).toFixed(1)} s`}
          {turn.usage?.outputTokens !== undefined && ` · ${turn.usage.outputTokens} tok`}
        </span>
      </header>
      {open && (
        <div className="turn-body">
          {onSpeak && turn.status === 'done' && (
            <button className="speak-btn" title="Leer en voz alta" onClick={onSpeak}>
              <Icon name="speaker" size={14} /> Escuchar
            </button>
          )}
          {turn.input.trim() && (
            <details className="turn-input">
              <summary>Tu entrada</summary>
              <pre>{turn.input}</pre>
            </details>
          )}
          {parsed.preamble && <Markdown text={parsed.preamble} />}
          {parsed.sections.map((s, i) => (
            <details key={`${turn.id}-${i}`} className="section" open={!isCollapsedByDefault(s.key, turn.action)}>
              <summary>{s.title}</summary>
              <Markdown text={s.body} />
            </details>
          ))}
          {turn.remembered?.length ? (
            <div className="remembered" title="XARA lo guardó en su memoria">
              🧠 Recordaré: {turn.remembered.join(' · ')}
            </div>
          ) : null}
          {live && turn.status === 'streaming' && (
            <div className="streaming">
              <span className="dot" /> {turn.output ? 'Recibiendo…' : 'Esperando al modelo…'} <kbd>Esc</kbd> para cancelar
            </div>
          )}
          {turn.status === 'cancelled' && <div className="note">Respuesta cancelada{turn.output ? ' (se conserva lo recibido).' : '.'}</div>}
          {turn.error && turn.status === 'error' && (
            <div className="error-box" role="alert">
              <b>{ERROR_TITLES[turn.error.kind] ?? 'Error'}:</b> {turn.error.message}
              {onRetry && (
                <button onClick={onRetry} className="retry">
                  Reintentar
                </button>
              )}
            </div>
          )}
          {onFeedback && turn.status === 'done' && (
            <div className="feedback">
              {turn.topics?.map((t) => (
                <span key={t} className="tag topic">
                  {t}
                </span>
              ))}
              <span className="spacer" />
              <span className="muted-text">¿Te ha servido?</span>
              <button
                className={turn.feedback?.rating === 'up' ? 'on' : ''}
                aria-pressed={turn.feedback?.rating === 'up'}
                title="Útil"
                onClick={() => {
                  setAskReason(false)
                  onFeedback(turn.feedback?.rating === 'up' ? null : { rating: 'up' })
                }}
              >
                👍
              </button>
              <button
                className={turn.feedback?.rating === 'down' ? 'on' : ''}
                aria-pressed={turn.feedback?.rating === 'down'}
                title="No útil"
                onClick={() => {
                  if (turn.feedback?.rating === 'down') {
                    setAskReason(false)
                    onFeedback(null)
                  } else {
                    setAskReason(true)
                    onFeedback({ rating: 'down' })
                  }
                }}
              >
                👎
              </button>
              {turn.feedback?.note && <span className="tag">{turn.feedback.note}</span>}
            </div>
          )}
          {onFeedback && askReason && turn.feedback?.rating === 'down' && !turn.feedback.note && (
            <div className="reasons">
              <span className="muted-text">¿Por qué? (se tendrá en cuenta en próximas respuestas)</span>
              {DOWN_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setAskReason(false)
                    onFeedback({ rating: 'down', note: r })
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

const ERROR_TITLES: Record<string, string> = {
  auth: 'Credencial no válida',
  rate_limit: 'Límite de uso',
  network: 'Sin conexión',
  bad_request: 'Petición rechazada',
  not_found: 'Modelo no encontrado',
  server: 'Error del proveedor',
  blocked: 'Bloqueado por el proveedor',
  config: 'Configuración incompleta',
  unknown: 'Error'
}

function previewOf(turn: Turn, summaryBody?: string): string {
  const base = summaryBody || turn.input || turn.error?.message || ''
  const line = base.replace(/[#*`>]/g, '').replace(/\s+/g, ' ').trim()
  return line.length > 110 ? `${line.slice(0, 109)}…` : line
}
