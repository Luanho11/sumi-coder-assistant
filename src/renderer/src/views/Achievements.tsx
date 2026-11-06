import { XP, XP_ATTEMPT } from '../../../core/academy/gamification'
import type { AcademyView } from '../../../main/academy'
import './Achievements.css'

interface Props {
  view: AcademyView
  theme: string
  onTheme: (theme: string) => void
}

const XP_WAYS: [string, string][] = [
  ['📖', `Ver una clase: +${XP.lesson} XP`],
  ['🧩', `Aprobar un ejercicio: +${XP_ATTEMPT.principiante} a +${XP_ATTEMPT.avanzado} XP según su dificultad`],
  ['⚡', 'Superar un reto: lo que indica cada reto'],
  ['🏅', `Aprobar un examen de módulo: +${XP.exam} XP`],
  ['🎤', `Hacer un simulacro de entrevista: +${XP.interview} XP`]
]

export function Achievements({ view, theme, onTheme }: Props) {
  const { xp, rank, nextRank, unlocks, badges, streak } = view
  const earned = badges.filter((b) => b.earned).length
  const pct = Math.round((xp.current / xp.needed) * 100)

  return (
    <div className="achievements">
      <header className="ach-hero">
        <span className="ach-rank-emoji">{rank.emoji}</span>
        <div className="ach-hero-info">
          <span className="ach-kicker">Tu rango</span>
          <h2>
            {rank.title} · nivel {xp.level}
          </h2>
          <span className="ach-xp-bar">
            <span style={{ width: `${pct}%` }} />
          </span>
          <span className="muted-text">
            {xp.current}/{xp.needed} XP para el nivel {xp.level + 1} · {xp.total} XP en total
          </span>
        </div>
        <div className="ach-stats">
          <span>
            🔥 <b>{streak.days}</b> {streak.days === 1 ? 'día' : 'días'}
          </span>
          <span>
            🏆 <b>{earned}</b>/{badges.length}
          </span>
        </div>
      </header>

      {nextRank && (
        <section className="ach-next">
          <span className="ach-next-emoji">{nextRank.emoji}</span>
          <div>
            <span className="ach-kicker">Próximo desbloqueo · nivel {nextRank.atLevel}</span>
            <b>Rango {nextRank.title}</b>
            <span className="muted-text">Te regala el tema de color {nextRank.theme} para toda la app.</span>
          </div>
          <span className="ach-next-left">
            {nextRank.atLevel - xp.level === 1 ? '¡A 1 nivel!' : `A ${nextRank.atLevel - xp.level} niveles`}
          </span>
        </section>
      )}

      <section>
        <h3>Rangos y temas</h3>
        <ol className="ach-ladder">
          {unlocks.map((u) => (
            <li key={u.atLevel} className={u.unlocked ? 'got' : 'locked'} style={{ ['--theme' as string]: u.accent }}>
              <span className="ach-node">{u.unlocked ? u.emoji : '🔒'}</span>
              <b>{u.title}</b>
              <span className="muted-text">Nivel {u.atLevel}</span>
              <span className="ach-swatch" />
              {u.unlocked ? (
                <button className={theme === u.theme ? 'on' : ''} disabled={theme === u.theme} onClick={() => onTheme(u.theme)}>
                  {theme === u.theme ? '✓ En uso' : `Usar ${u.theme}`}
                </button>
              ) : (
                <span className="ach-theme-name">Tema {u.theme}</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h3>
          Insignias <span className="muted-text">{earned} de {badges.length}</span>
        </h3>
        <div className="badge-grid">
          {badges.map((b) => (
            <div key={b.id} className={`badge ${b.earned ? 'got' : 'locked'}`}>
              <span className="badge-emoji">{b.emoji}</span>
              <b>{b.title}</b>
              <span className="muted-text">{b.earned ? '¡Ganada!' : b.how}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ach-ways">
        <h3>Cómo subir de nivel</h3>
        <ul>
          {XP_WAYS.map(([emoji, text]) => (
            <li key={text}>
              <span>{emoji}</span> {text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
