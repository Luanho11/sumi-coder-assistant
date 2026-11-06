import { useState } from 'react'
import type { SessionSummary } from '../../../core/types'
import { Icon } from './Icon'
import './Sidebar.css'

interface Props {
  sessions: SessionSummary[]
  currentId?: string
  onNew: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
}

export function Sidebar({ sessions, currentId, onNew, onOpen, onDelete, onRename }: Props) {
  const [filter, setFilter] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const shown = filter ? sessions.filter((s) => s.title.toLowerCase().includes(filter.toLowerCase())) : sessions

  return (
    <aside className="sidebar">
      <button className="primary" onClick={onNew} title="Ctrl+N">
        + Nueva sesión
      </button>
      <input placeholder="Buscar en el historial" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <ul className="session-list">
        {shown.map((s) => (
          <li key={s.id} className={s.id === currentId ? 'selected' : ''}>
            {editing === s.id ? (
              <input
                autoFocus
                defaultValue={s.title}
                onBlur={(e) => {
                  onRename(s.id, e.target.value)
                  setEditing(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') setEditing(null)
                }}
              />
            ) : (
              <button className="session-item" onClick={() => onOpen(s.id)} onDoubleClick={() => setEditing(s.id)} title="Doble clic para renombrar">
                <span className="session-title">{s.title}</span>
                <span className="session-meta">
                  {new Date(s.updatedAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })} · {s.turnCount}
                </span>
              </button>
            )}
            {confirmDelete === s.id ? (
              <span className="confirm">
                <button
                  className="danger"
                  onClick={() => {
                    onDelete(s.id)
                    setConfirmDelete(null)
                  }}
                >
                  Borrar
                </button>
                <button onClick={() => setConfirmDelete(null)}>No</button>
              </span>
            ) : (
              <button className="icon-btn del" title="Eliminar sesión" onClick={() => setConfirmDelete(s.id)}>
                <Icon name="close" size={13} />
              </button>
            )}
          </li>
        ))}
        {shown.length === 0 && <li className="muted">Sin sesiones</li>}
      </ul>
    </aside>
  )
}
