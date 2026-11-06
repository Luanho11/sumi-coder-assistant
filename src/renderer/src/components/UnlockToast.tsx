import { useEffect } from 'react'
import type { AcademyView } from '../../../main/academy'
import './UnlockToast.css'

/** Lo que se acaba de desbloquear entre dos estados de la academia: insignias nuevas y subida de rango. */
export function newUnlocks(prev: AcademyView, next: AcademyView): string[] {
  const had = new Set(prev.badges.filter((b) => b.earned).map((b) => b.id))
  const won = next.badges.filter((b) => b.earned && !had.has(b.id)).map((b) => `${b.emoji} Insignia: ${b.title}`)
  if (next.rank.title !== prev.rank.title) won.unshift(`${next.rank.emoji} Nuevo rango: ${next.rank.title} (y un tema de color nuevo)`)
  return won
}

interface Props {
  items: string[]
  onOpen: () => void
  onClose: () => void
}

export function UnlockToast({ items, onOpen, onClose }: Props) {
  useEffect(() => {
    const id = setTimeout(onClose, 6000)
    return () => clearTimeout(id)
  }, [items, onClose])

  return (
    <div className="unlock-toast" role="status">
      <span className="unlock-burst">🏆</span>
      <div>
        <b>¡Desbloqueaste algo!</b>
        {items.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <button className="primary" onClick={onOpen}>
        Ver logros
      </button>
    </div>
  )
}
