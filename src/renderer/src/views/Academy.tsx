import { useMemo, useState } from 'react'
import { capstoneFor, catalog, findExercise, lessonExtra, moduleExtra } from '../../../core/academy/catalog'
import { XP } from '../../../core/academy/gamification'
import { AREA_LABELS, effectiveScore, latestAttempt, PASS_SCORE } from '../../../core/academy/level'
import { RUTAS_ACTIVAS, rutaActiva } from '../../../core/academy/activas'
import { nextLesson } from '../../../core/academy/route'
import { buildScenes, estimateMinutes } from '../../../core/academy/scenes'
import type { AcademyModule, Exercise, Lesson, Track } from '../../../core/academy/types'
import type { AcademyView } from '../../../main/academy'
import { allCourses, courseLessons, nivelesEscritos } from '../../../core/academy/v2/courses'
import { courseProgress } from '../../../core/academy/v2/gating'
import { emptyProgressV2, type Course } from '../../../core/academy/v2/types'
import { TrackCover } from '../components/TrackCover'
import './Academy.css'

interface Props {
  view: AcademyView
  onOpenCourse: (courseId: string) => void
  onOpenLesson: (trackId: string, lessonId: string) => void
  onOpenExam: (trackId: string, moduleId: string) => void
  onOpenCapstone: (trackId: string) => void
}

type Mode = 'tarjetas' | 'lista'
const MODE_KEY = 'xara.academia.vista'

function savedMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'lista' ? 'lista' : 'tarjetas'
  } catch {
    return 'tarjetas'
  }
}

// Primero las rutas activas; dentro de cada grupo, las recomendadas por el examen y luego el resto.
function orderedTracks(view: AcademyView): Track[] {
  const rec = view.progress.placement?.recommendedTrackIds ?? []
  const score = (t: Track) => {
    const i = rec.indexOf(t.id)
    const activa = RUTAS_ACTIVAS.indexOf(t.id)
    return (activa === -1 ? 1000 : activa) + (i === -1 ? 100 : i)
  }
  return [...catalog.tracks].sort((a, b) => score(a) - score(b))
}

const etiquetaNuevo = (curso: Course | undefined) => {
  if (curso?.status !== 'draft') return 'Nuevo'
  const escritos = nivelesEscritos(curso)
  return escritos.length < curso.levels.length ? `Nuevo · solo ${escritos.join(' y ')}` : 'Nuevo · en preparación'
}

export function Academy({ view, onOpenCourse, onOpenLesson, onOpenExam, onOpenCapstone }: Props) {
  const tracks = useMemo(() => orderedTracks(view), [view])
  const v2 = useMemo(() => new Map(allCourses.map((c) => [c.id, c])), [])
  const suggested = nextLesson(view.progress)
  const [mode, setMode] = useState<Mode>(savedMode)
  const [trackId, setTrackId] = useState(suggested?.trackId ?? tracks[0].id)
  // En modo tarjetas, si se está dentro de una ruta o viendo la cuadrícula.
  const [inTrack, setInTrack] = useState(false)
  const track = catalog.tracks.find((t) => t.id === trackId) ?? tracks[0]
  const progress = view.progress
  const recommended = new Set(progress.placement?.recommendedTrackIds ?? [])
  const capstone = capstoneFor(track.id)

  const changeMode = (m: Mode) => {
    setMode(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      /* la vista elegida simplemente no se recuerda */
    }
  }

  const lessonDone = (id: string) => progress.lessonsDone.includes(id)
  const exState = (id: string) => {
    const a = latestAttempt(progress, id)
    return !a ? 'pendiente' : effectiveScore(a) >= PASS_SCORE ? 'superado' : 'intentado'
  }
  const moduleProgress = (m: AcademyModule) => {
    const total = m.lessons.length
    const done = m.lessons.filter((l) => lessonDone(l.id)).length
    return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
  }
  const trackProgress = (t: Track) => {
    const lessons = t.modules.flatMap((m) => m.lessons)
    const done = lessons.filter((l) => lessonDone(l.id)).length
    return { total: lessons.length, done, pct: lessons.length ? Math.round((done / lessons.length) * 100) : 0 }
  }
  const tp = trackProgress(track)
  const continueLesson: Lesson | undefined =
    track.modules.flatMap((m) => m.lessons).find((l) => l.id === suggested?.lessonId) ??
    track.modules.flatMap((m) => m.lessons).find((l) => !lessonDone(l.id))

  const modeSwitch = (
    <div className="segmented" role="tablist" aria-label="Vista de la academia">
      <button className={mode === 'tarjetas' ? 'on' : ''} onClick={() => changeMode('tarjetas')}>
        ▦ Tarjetas
      </button>
      <button className={mode === 'lista' ? 'on' : ''} onClick={() => changeMode('lista')}>
        ☰ Lista
      </button>
    </div>
  )

  if (mode === 'tarjetas' && !inTrack) {
    return (
      <div className="academy cards">
        <header className="academy-bar">
          <div>
            <h2>¿Qué quieres aprender hoy?</h2>
            <p className="muted-text">Las rutas “Para ti” salen de tu examen de nivel.</p>
          </div>
          <div className="academy-bar-tools">
            {modeSwitch}
          </div>
        </header>
        <div className="track-grid">
          {tracks.map((t) => {
            const curso = v2.get(t.id)
            const p = curso ? { done: courseProgress(curso, progress.v2 ?? emptyProgressV2()).mastered, total: courseLessons(curso).length, pct: courseProgress(curso, progress.v2 ?? emptyProgressV2()).pct } : trackProgress(t)
            const modulos = curso ? curso.levels.reduce((n, l) => n + l.modules.length, 0) : t.modules.length
            return (
              <button
                key={t.id}
                className={`track-card ${rutaActiva(t.id) ? '' : 'building'}`}
                style={{ ['--track' as string]: t.color }}
                aria-disabled={!rutaActiva(t.id)}
                onClick={() => {
                  if (!rutaActiva(t.id)) return
                  if (v2.has(t.id)) return onOpenCourse(t.id)
                  setTrackId(t.id)
                  setInTrack(true)
                }}
              >
                <TrackCover trackId={t.id} color={t.color} />
                <div className="track-card-body">
                  <span className="track-card-area">
                    {AREA_LABELS[t.area]}
                    {!rutaActiva(t.id) && <span className="tag">En construcción</span>}
                    {rutaActiva(t.id) && recommended.has(t.id) && <span className="tag accent">Para ti</span>}
                    {rutaActiva(t.id) && v2.has(t.id) && <span className="tag accent">{etiquetaNuevo(v2.get(t.id))}</span>}
                  </span>
                  <b>{t.title}</b>
                  <span className="track-card-bar">
                    <span style={{ width: `${p.pct}%` }} />
                  </span>
                  <span className="muted-text track-card-meta">
                    {p.done}/{p.total} clases · {modulos} módulos
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const detail = (
    <section className="track-body">
      {v2.has(track.id) && (
        <div className="v2-banner">
          <b>Este curso tiene una versión nueva</b>: clases largas con ejercicios en cada idea, tres niveles y examen para avanzar.
          <button className="primary" onClick={() => onOpenCourse(track.id)}>
            Abrir el curso nuevo
          </button>
        </div>
      )}
      <div className="track-tools">
        {mode === 'tarjetas' ? (
          <button className="back" onClick={() => setInTrack(false)}>
            ‹ Todas las rutas
          </button>
        ) : (
          <span />
        )}
        {modeSwitch}
      </div>

      <header className="track-hero" style={{ ['--track' as string]: track.color }}>
        <div className="track-hero-text">
          <span className="track-hero-area">
            {AREA_LABELS[track.area]}
            {recommended.has(track.id) && <span className="tag accent">Para ti</span>}
          </span>
          <h2>{track.title}</h2>
          <p>{track.description}</p>
          <div className="track-hero-actions">
            {continueLesson && (
              <button className="hero-play" onClick={() => onOpenLesson(track.id, continueLesson.id)}>
                ▶ {tp.done ? 'Continuar' : 'Empezar'}: {continueLesson.title}
              </button>
            )}
            <span className="track-hero-progress">
              <span className="track-card-bar">
                <span style={{ width: `${tp.pct}%` }} />
              </span>
              {tp.done} de {tp.total} clases
            </span>
          </div>
        </div>
        <TrackCover trackId={track.id} color={track.color} />
      </header>

      {/* Solo se abre el módulo donde el alumno debe continuar; los demás, plegados para no abrumar. */}
      {track.modules.map((m, mi) => {
        const mp = moduleProgress(m)
        const exam = moduleExtra(m.id)
        const examScore = progress.exams[m.id]?.score
        const examPassed = examScore !== undefined && examScore >= PASS_SCORE
        const hasSuggested = m.lessons.some((l) => l.id === continueLesson?.id)
        return (
          <details key={m.id} className="module" open={hasSuggested} style={{ ['--track' as string]: track.color }}>
            <summary>
              <span className="module-head">
                <span className="module-kicker">Módulo {mi + 1}</span>
                <span className="module-title">{m.title}</span>
              </span>
              <span className="muted-text module-count">{mp.pct === 100 ? '✓ Completado' : `${mp.done} de ${mp.total}`}</span>
              <span className="module-chevron" aria-hidden />
            </summary>
            <p className="muted-text module-desc">{m.description}</p>
            <div className="episodes">
              {m.lessons.map((l, li) => {
                const done = lessonDone(l.id)
                const next = l.id === continueLesson?.id
                const extra = lessonExtra(l.id)
                const exs = l.exerciseIds.map(findExercise).filter((e): e is Exercise => !!e)
                const practiced = exs.filter((e) => exState(e.id) === 'superado').length
                return (
                  <button key={l.id} className={`episode ${next ? 'next' : ''}`} onClick={() => onOpenLesson(track.id, l.id)}>
                    <span className="episode-thumb">
                      <span className="episode-n">Clase {li + 1}</span>
                      <span className="episode-emoji">{extra?.emoji ?? '▶'}</span>
                      {done && <span className="episode-done">✓ Vista</span>}
                      <span className="episode-time">{estimateMinutes(buildScenes(l, extra))} min</span>
                      <span className="episode-play" aria-hidden />
                    </span>
                    <b>{l.title}</b>
                    <span className="muted-text episode-meta">
                      {next ? <span className="episode-next">Continúa aquí</span> : exs.length > 0 ? `${practiced}/${exs.length} prácticas` : done ? 'Vista' : 'Sin ver'}
                    </span>
                  </button>
                )
              })}
              {exam && (
                <button className="episode exam" onClick={() => onOpenExam(track.id, m.id)}>
                  <span className="episode-thumb">
                    <span className="episode-n">Examen</span>
                    <span className="episode-emoji">{examPassed ? '🏆' : '⭐'}</span>
                    {examPassed && <span className="episode-done">✓ Aprobado</span>}
                  </span>
                  <b>Examen del módulo</b>
                  <span className="muted-text episode-meta">{examScore !== undefined ? `Tu mejor nota: ${examScore}/100` : `${exam.exam.length} preguntas · +${XP.exam} XP`}</span>
                </button>
              )}
            </div>
          </details>
        )
      })}

      {capstone && (
        <button className="capstone" style={{ ['--track' as string]: track.color }} onClick={() => onOpenCapstone(track.id)}>
          <span className="capstone-kicker">Proyecto final para tu GitHub {capstone.emoji}</span>
          <b>{capstone.title}</b>
          <span className="muted-text">{capstone.summary}</span>
        </button>
      )}
    </section>
  )

  if (mode === 'tarjetas') return <div className="academy single">{detail}</div>

  return (
    <div className="academy">
      <nav className="tracks">
        {tracks.map((t) => (
          <button key={t.id} className={`track ${t.id === track.id ? 'on' : ''} ${rutaActiva(t.id) ? '' : 'building'}`} aria-disabled={!rutaActiva(t.id)} onClick={() => rutaActiva(t.id) && setTrackId(t.id)}>
            <span className="dot" style={{ background: t.color }} />
            <span className="track-name">{t.title}</span>
            {recommended.has(t.id) && <span className="tag accent">Para ti</span>}
          </button>
        ))}
      </nav>
      {detail}
    </div>
  )
}
