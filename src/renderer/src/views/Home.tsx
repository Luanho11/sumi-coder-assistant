import { allCourses, findLessonV2 } from '../../../core/academy/v2/courses'
import { isLessonMastered, nextAction, pasoClase } from '../../../core/academy/v2/gating'
import { duracionClase } from '../../../core/academy/v2/scenes'
import { emptyProgressV2 } from '../../../core/academy/v2/types'
import { rutaActiva } from '../../../core/academy/activas'
import { capstoneFor, findChallenge, findTrack, lessonExtra } from '../../../core/academy/catalog'
import { CAREER_LEVEL_LABELS } from '../../../core/academy/level'
import { buildScenes, estimateMinutes } from '../../../core/academy/scenes'
import type { AcademyView } from '../../../main/academy'
import { Icon } from '../components/Icon'
import { TrackCover } from '../components/TrackCover'
import { pantallaDeClase, type Screen } from '../v2/CourseV2'
import './Home.css'

interface Props {
  view: AcademyView
  firstName: string
  onOpenLesson: (trackId: string, lessonId: string) => void
  onOpenCourse: (courseId: string, screen?: Screen) => void
  onOpenChallenge: (id: string) => void
  onGoAcademy: () => void
  onStartPlacement: () => void
  onStartInterview: () => void
  onOpenAchievements: () => void
  onOpenLevel: () => void
  onOpenCapstone: (trackId: string) => void
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 6) return 'Buenas noches'
  if (h < 13) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

// La racha se mide contra una meta semanal de 7 días, como el anillo de "Ejercicio" del Apple Watch.
const STREAK_GOAL = 7

interface Ring {
  key: string
  pct: number
  color: string
}

/** Anillos concéntricos de actividad, cada uno lleno según su porcentaje (como máximo una vuelta). */
function ActivityRings({ rings }: { rings: Ring[] }) {
  return (
    <svg viewBox="0 0 120 120" className="rings" aria-hidden>
      {rings.map((r, i) => {
        const radius = 52 - i * 15
        const length = 2 * Math.PI * radius
        return (
          <g key={r.key} style={{ ['--ring' as string]: r.color }}>
            <circle cx="60" cy="60" r={radius} className="ring-track" />
            <circle
              cx="60"
              cy="60"
              r={radius}
              className="ring-fill"
              strokeDasharray={length}
              strokeDashoffset={length * (1 - Math.min(r.pct, 100) / 100)}
            />
          </g>
        )
      })}
    </svg>
  )
}

export function Home({ view, firstName, onOpenLesson, onOpenCourse, onOpenChallenge, onGoAcademy, onStartPlacement, onStartInterview, onOpenAchievements, onOpenLevel, onOpenCapstone }: Props) {
  const { xp, streak, badges, nextLesson } = view
  const daily = view.dailyChallengeId ? findChallenge(view.dailyChallengeId) : undefined
  const earned = badges.filter((b) => b.earned).length
  const capstone = nextLesson ? capstoneFor(nextLesson.trackId) : undefined
  const track = nextLesson ? findTrack(nextLesson.trackId) : undefined
  const lesson = track?.modules.flatMap((m) => m.lessons).find((l) => l.id === nextLesson?.lessonId)
  // Una ruta con curso nuevo ofrece la siguiente clase del curso nuevo, no la de la ruta antigua del mismo nombre.
  const curso = nextLesson ? allCourses.find((c) => c.id === nextLesson.trackId) : undefined
  const accion = curso ? nextAction(curso, view.progress.v2 ?? emptyProgressV2()) : undefined
  const refNueva = accion?.kind === 'lesson' ? findLessonV2(accion.id) : undefined
  const siguiente = curso
    ? refNueva && { trackId: curso.id, lessonId: refNueva.lesson.id, title: refNueva.lesson.title, moduleTitle: refNueva.module.title, minutes: duracionClase(refNueva.lesson).total }
    : nextLesson && lesson && { ...nextLesson, minutes: estimateMinutes(buildScenes(lesson, lessonExtra(lesson.id))) }
  // Repaso espaciado de las clases dominadas en los cursos nuevos
  const dueLessons = Object.entries(view.progress.v2?.reviews ?? {})
    .filter(([, r]) => new Date(r.dueAt).getTime() <= Date.now())
    .map(([id]) => findLessonV2(id))
    .filter((x): x is NonNullable<typeof x> => !!x)
  const ultimaId = view.progress.v2?.ultimaClase
  const ultima = ultimaId ? findLessonV2(ultimaId) : undefined
  const ultimaLp = ultimaId ? view.progress.v2?.lessons[ultimaId] : undefined
  const continuar = ultima && !isLessonMastered(ultimaLp) ? ultima : undefined
  const paso = continuar ? pasoClase(continuar.lesson, ultimaLp) : undefined
  const pasoTexto = paso?.kind === 'practice' ? `Sigue la práctica ${paso.tier}` : paso?.kind === 'mastery' ? 'Sigue la comprobación final' : 'Sigue la clase'
  const today = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })

  const rings: (Ring & { label: string; value: string })[] = [
    { key: 'xp', label: 'Nivel', value: `${xp.level} · ${xp.current}/${xp.needed} XP`, pct: (xp.current / xp.needed) * 100, color: '#fa114f' },
    { key: 'racha', label: 'Racha', value: `${streak.days} de ${STREAK_GOAL} días`, pct: (streak.days / STREAK_GOAL) * 100, color: '#92e82a' },
    { key: 'insignias', label: 'Insignias', value: `${earned} de ${badges.length}`, pct: (earned / badges.length) * 100, color: '#1eeaef' }
  ]

  return (
    <div className="home">
      <header className="home-head">
        <span className="home-date">{today}</span>
        <h1>
          {greeting()}, {firstName}
        </h1>
      </header>

      {dueLessons.length > 0 && (
        <button className="up-next" style={{ ['--track' as string]: dueLessons[0].course.color }} onClick={() => onOpenCourse(dueLessons[0].course.id)}>
          <span className="up-next-text">
            <span className="up-next-kicker">Repaso de hoy</span>
            <b>{dueLessons.length === 1 ? dueLessons[0].lesson.title : `${dueLessons.length} clases para repasar`}</b>
            <span className="up-next-sub">Cinco minutos de preguntas para que lo aprendido no se olvide.</span>
            <span className="up-next-play">Repasar ahora</span>
          </span>
        </button>
      )}

      {continuar && (
        <button className="up-next" style={{ ['--track' as string]: continuar.course.color }} onClick={() => onOpenCourse(continuar.course.id, pantallaDeClase(continuar.lesson, ultimaLp))}>
          <span className="up-next-text">
            <span className="up-next-kicker">Continúa donde quedaste</span>
            <b>{continuar.lesson.title}</b>
            <span className="up-next-sub">
              {continuar.course.title} · {pasoTexto}
            </span>
            <span className="up-next-play">Continuar</span>
          </span>
        </button>
      )}

      {siguiente && track && rutaActiva(track.id) ? (
        <button className="up-next" style={{ ['--track' as string]: track.color }} onClick={() => onOpenLesson(siguiente.trackId, siguiente.lessonId)}>
          <span className="up-next-text">
            <span className="up-next-kicker">Tu siguiente clase</span>
            <b>{siguiente.title}</b>
            <span className="up-next-sub">
              {track.title} · {siguiente.moduleTitle}
            </span>
            <span className="up-next-play">
              <Icon name="play" size={14} /> Ver clase · {siguiente.minutes} min
            </span>
          </span>
          <TrackCover trackId={track.id} color={track.color} />
        </button>
      ) : (
        <button className="up-next" style={{ ['--track' as string]: 'var(--accent)' }} onClick={onGoAcademy}>
          <span className="up-next-text">
            <span className="up-next-kicker">Academia</span>
            <b>Elige tu primera ruta</b>
            <span className="up-next-sub">Clases en vídeo con la voz de XARA, práctica y exámenes.</span>
            <span className="up-next-play">Explorar rutas</span>
          </span>
        </button>
      )}

      <div className="home-row">
        <button className="tile activity" onClick={onOpenAchievements}>
          <span className="tile-title">Actividad</span>
          <span className="activity-body">
            <ActivityRings rings={rings} />
            <span className="activity-legend">
              {rings.map((r) => (
                <span key={r.key} style={{ ['--ring' as string]: r.color }}>
                  <small>{r.label}</small>
                  <b>{r.value}</b>
                </span>
              ))}
            </span>
          </span>
          <span className="tile-foot">
            {view.rank.emoji} {view.rank.title}
            {view.nextRank && ` · tema ${view.nextRank.theme} en el nivel ${view.nextRank.atLevel}`}
            <span className="tile-more">Ver logros ›</span>
          </span>
        </button>

        {daily && (
          <button className="tile daily" onClick={() => onOpenChallenge(daily.id)}>
            <span className="tile-title">Reto del día</span>
            <span className="daily-emoji">{daily.emoji}</span>
            <b>{daily.title}</b>
            <span className="tile-foot">
              +{daily.xp} XP · {daily.language === 'sql' ? 'SQL' : 'JavaScript'}
              <span className="tile-more">Resolver ›</span>
            </span>
          </button>
        )}
      </div>

      <div className="home-row small">
        {!view.progress.placement && (
          <button className="tile mini" onClick={onStartPlacement}>
            <span className="mini-icon" style={{ ['--tint' as string]: '#5e5ce6' }}>
              <Icon name="brain" size={20} />
            </span>
            <b>Examen de nivel</b>
            <span className="muted-text">XARA te ubica y arma tu ruta.</span>
          </button>
        )}
        <button className="tile mini" onClick={onStartInterview}>
          <span className="mini-icon" style={{ ['--tint' as string]: '#ff375f' }}>
            <Icon name="mic" size={20} />
          </span>
          <b>Simulador de entrevista</b>
          <span className="muted-text">Preguntas reales y un informe al final.</span>
        </button>
        <div className="tile mini">
          <span className="mini-icon" style={{ ['--tint' as string]: '#ff9f0a' }}>
            <Icon name="flame" size={20} />
          </span>
          <b>{streak.activeToday ? 'Racha activa hoy' : 'Estudia hoy'}</b>
          <span className="muted-text">{streak.activeToday ? `Llevas ${streak.days} ${streak.days === 1 ? 'día seguido' : 'días seguidos'}.` : 'Una clase basta para no perder tu racha.'}</span>
        </div>
        <button className="tile mini" onClick={onOpenLevel}>
          <span className="mini-icon" style={{ ['--tint' as string]: '#30d158' }}>
            <Icon name="check" size={20} />
          </span>
          <b>{CAREER_LEVEL_LABELS[view.report.overall]}</b>
          <span className="muted-text">{view.progress.placement ? 'Tu nivel según examen y práctica.' : 'Haz el examen para ubicarte.'}</span>
        </button>
        {capstone && nextLesson && (
          <button className="tile mini" onClick={() => onOpenCapstone(nextLesson.trackId)}>
            <span className="mini-icon" style={{ ['--tint' as string]: '#64d2ff' }}>
              {capstone.emoji}
            </span>
            <b>{capstone.title}</b>
            <span className="muted-text">Proyecto final para tu GitHub.</span>
          </button>
        )}
      </div>
    </div>
  )
}
