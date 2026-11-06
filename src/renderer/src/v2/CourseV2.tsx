import { useState } from 'react'
import { courseLessons, findCourse, nivelesEscritos } from '../../../core/academy/v2/courses'
import { duracionClase } from '../../../core/academy/v2/scenes'
import {
  courseProgress,
  examEnPreparacion,
  isLessonMastered,
  lessonBlocker,
  lessonStatus,
  levelExamBlocker,
  levelProjectBlocker,
  levelExamPassed,
  levelPassed,
  levelProjectPassed,
  moduleExamBlocker,
  moduleExamPassed,
  pasoClase,
  proyectoEnPreparacion,
  nextAction,
  type LessonStatus
} from '../../../core/academy/v2/gating'
import { emptyProgressV2, type Lesson, type LessonProgress } from '../../../core/academy/v2/types'
import type { AcademyView } from '../../../main/academy'
import { TrackCover } from '../components/TrackCover'
import './v2.css'

const EN_PREPARACION = 'Este examen está en preparación: todavía no tiene preguntas.'

export type Screen =
  | { kind: 'map' }
  | { kind: 'lesson'; lessonId: string; partId?: string }
  | { kind: 'practice'; lessonId: string; tier: 'A' | 'B' | 'C' | 'D' }
  | { kind: 'mastery'; lessonId: string }
  | { kind: 'moduleExam'; moduleId: string }
  | { kind: 'levelExam'; levelId: string }
  | { kind: 'project'; levelId: string }
  | { kind: 'entry'; levelId: string }
  | { kind: 'review'; lessonId: string }

/** La pantalla donde se retoma una clase: no obliga a repetir lo que ya se aprobó. */
export function pantallaDeClase(lesson: Lesson, lp: LessonProgress | undefined): Screen {
  const paso = pasoClase(lesson, lp)
  if (paso.kind === 'practice') return { kind: 'practice', lessonId: lesson.id, tier: paso.tier }
  if (paso.kind === 'mastery') return { kind: 'mastery', lessonId: lesson.id }
  return { kind: 'lesson', lessonId: lesson.id }
}

const STATUS_LABEL: Record<LessonStatus, string> = { bloqueada: 'Bloqueada', disponible: 'Disponible', en_curso: 'En curso', dominada: 'Dominada' }

interface Props {
  courseId: string
  view: AcademyView
  onOpen: (s: Screen) => void
  onClose: () => void
}

export function CourseV2({ courseId, view, onOpen, onClose }: Props) {
  const course = findCourse(courseId)
  const escritos = course ? nivelesEscritos(course) : []
  const p = view.progress.v2 ?? emptyProgressV2()
  const opts = { unlockAll: view.unlockAll }
  const [why, setWhy] = useState<string | null>(null)
  if (!course) return null
  const prog = courseProgress(course, p)
  const next = nextAction(course, p)
  const abrirClase = (lessonId: string) => {
    const lesson = courseLessons(course).find((r) => r.lesson.id === lessonId)?.lesson
    if (lesson) onOpen(pantallaDeClase(lesson, p.lessons[lessonId]))
  }
  const goNext = () => {
    if (!next) return
    if (next.kind === 'lesson') abrirClase(next.id)
    else if (next.kind === 'moduleExam') onOpen({ kind: 'moduleExam', moduleId: next.id })
    else if (next.kind === 'levelExam') onOpen({ kind: 'levelExam', levelId: next.id })
    else onOpen({ kind: 'project', levelId: next.id })
  }
  const gate = (reason: string | null, go: () => void) => () => (reason ? setWhy(reason) : (setWhy(null), go()))
  const order = new Map(courseLessons(course).map((r) => [r.lesson.id, r.order]))
  void order
  const due = Object.entries(p.reviews).filter(([, r]) => new Date(r.dueAt).getTime() <= Date.now()).map(([id]) => id)

  return (
    <div className="x2-map" style={{ ['--track' as string]: course.color }}>
      <button className="back" onClick={onClose}>‹ Academia</button>
      <header className="x2-map-head">
        <div className="x2-cover"><TrackCover trackId={course.id} color={course.color} /></div>
        <div>
          <h2 className="x2-title">{course.title}</h2>
          <p className="x2-muted">{course.description}</p>
          <p className="x2-muted">{prog.mastered} de {prog.total} clases dominadas</p>
          <div className="x2-progress" role="progressbar" aria-valuenow={prog.pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${prog.pct}%` }} /></div>
          <div className="x2-row">
            {next ? (
              <button className="x2-btn primary" onClick={goNext}>
                {next.kind === 'lesson' ? `Continuar: ${next.title}` : next.kind === 'moduleExam' ? `Examen del módulo «${next.title}»` : next.kind === 'levelExam' ? `Examen del nivel ${next.title}` : `Proyecto: ${next.title}`}
              </button>
            ) : (
              <p className="x2-feedback">{course.status === 'draft' ? 'Dominaste todas las clases escritas. Las demás llegan pronto; los repasos aparecen en «Hoy».' : 'Curso completado. Los repasos seguirán apareciendo en «Hoy».'}</p>
            )}
            {course.status === 'draft' && <span className="x2-chip warn">En preparación</span>}
          </div>
          {course.status === 'draft' && (
            <p className="x2-muted">
              {escritos.length < course.levels.length
                ? `Este curso nuevo está en preparación: por ahora solo tiene el nivel ${escritos.join(' y ')}. Los demás niveles llegan después.`
                : 'Este curso nuevo está en preparación: por ahora tiene solo las clases ya escritas.'}
            </p>
          )}
        </div>
      </header>

      {why && <p className="x2-feedback bad" role="alert">{why}</p>}
      {due.length > 0 && (
        <section className="x2-card x2-due">
          <h3>Repaso de hoy</h3>
          <p className="x2-muted">Cinco minutos de preguntas sobre clases que ya dominas, para que no se olviden.</p>
          <div className="x2-row">{due.map((id) => {
            const l = courseLessons(course).find((r) => r.lesson.id === id)
            return l ? <button key={id} className="x2-btn" onClick={() => onOpen({ kind: 'review', lessonId: id })}>{l.lesson.title}</button> : null
          })}</div>
        </section>
      )}

      {course.levels.map((level, li) => {
        const lvBlock = li > 0 && !levelPassed(course, course.levels[li - 1], p) && !opts.unlockAll
        const sinClases = !level.modules.some((m) => m.lessons.length > 0)
        const passed = levelExamPassed(course, level, p) && levelProjectPassed(course, level, p)
        const examWhy = examEnPreparacion(level.exam) ? EN_PREPARACION : levelExamBlocker(course, level.id, p, opts)
        const projWhy = proyectoEnPreparacion(level) ? 'Este proyecto está en preparación: todavía no está escrito.' : levelProjectBlocker(course, level.id, p, opts)
        return (
          <section key={level.id} className={`x2-level ${lvBlock ? 'locked' : ''} ${passed ? 'passed' : ''}`}>
            <header>
              <h3>
                {level.title}
                <span className={`x2-chip ${passed ? 'ok' : lvBlock || sinClases ? '' : 'now'}`}>{passed ? 'Aprobado' : lvBlock ? 'Bloqueado' : sinClases ? 'En preparación' : 'En curso'}</span>
              </h3>
              <p className="x2-muted">{level.promise}</p>
              {li > 0 && !lvBlock && (level.entryCheck?.length ?? 0) > 0 && (
                <button className="x2-link" onClick={() => onOpen({ kind: 'entry', levelId: level.id })}>
                  {p.levels[`${course.id}:${level.id}`]?.entryChecked ? 'Repetir el diagnóstico de entrada' : 'Haz el diagnóstico de entrada (opcional)'}
                </button>
              )}
            </header>
            {level.modules.length === 0 && <p className="x2-muted">Las clases de este nivel están en preparación.</p>}
            {level.modules.map((m) => {
              const mWhy = examEnPreparacion(m.exam) ? EN_PREPARACION : moduleExamBlocker(course, m.id, p, opts)
              return (
                <div key={m.id} className="x2-module">
                  <h4>{m.title}</h4>
                  <p className="x2-muted">{m.description}</p>
                  <ul className="x2-lessons">
                    {m.lessons.map((l) => {
                      const st = lessonStatus(course, l.id, p, opts)
                      const reason = lessonBlocker(course, l.id, p, opts)
                      const lp = p.lessons[l.id]
                      const prov = Object.values(lp?.practice ?? {}).some((x) => x?.provisional)
                      return (
                        <li key={l.id} className={`st-${st}`}>
                          <button aria-disabled={st === 'bloqueada'} onClick={gate(reason, () => abrirClase(l.id))}>
                            <span className="x2-state" aria-hidden />
                            <span className="x2-lname">{l.title}</span>
                            <span className="x2-meta">≈ {duracionClase(l).total} min · {STATUS_LABEL[st]}{lp?.porSalto ? ' por examen' : ''}{prov && isLessonMastered(lp) ? ' · provisional' : ''}</span>
                          </button>
                        </li>
                      )
                    })}
                    <li className={`exam ${moduleExamPassed(m, p) ? 'st-dominada' : mWhy ? 'st-bloqueada' : 'st-disponible'}`}>
                      <button aria-disabled={!!mWhy} onClick={gate(mWhy, () => onOpen({ kind: 'moduleExam', moduleId: m.id }))}>
                        <span className="x2-state" aria-hidden />
                        <span className="x2-lname">Examen del módulo</span>
                        <span className="x2-meta">{moduleExamPassed(m, p) ? `Aprobado (${p.modules[m.id]?.bestPct} %)` : examEnPreparacion(m.exam) ? 'En preparación' : 'Prueba de salto: con 80 % das el módulo por dominado'}</span>
                      </button>
                    </li>
                  </ul>
                </div>
              )
            })}
            {level.modules.length > 0 && (
              <ul className="x2-lessons x2-closing">
                <li className={`exam ${levelExamPassed(course, level, p) ? 'st-dominada' : examWhy ? 'st-bloqueada' : 'st-disponible'}`}>
                  <button aria-disabled={!!examWhy} onClick={gate(examWhy, () => onOpen({ kind: 'levelExam', levelId: level.id }))}>
                    <span className="x2-state" aria-hidden />
                    <span className="x2-lname">Examen del nivel {level.id}</span>
                    <span className="x2-meta">{levelExamPassed(course, level, p) ? `Aprobado (${p.levels[`${course.id}:${level.id}`]?.exam?.bestPct} %)` : examEnPreparacion(level.exam) ? 'En preparación' : 'Prueba de salto: preguntas mezcladas y tareas escritas'}</span>
                  </button>
                </li>
                <li className={`exam ${levelProjectPassed(course, level, p) ? 'st-dominada' : projWhy ? 'st-bloqueada' : 'st-disponible'}`}>
                  <button aria-disabled={!!projWhy} onClick={gate(projWhy, () => onOpen({ kind: 'project', levelId: level.id }))}>
                    <span className="x2-state" aria-hidden />
                    <span className="x2-lname">Proyecto: {level.project.title}</span>
                    <span className="x2-meta">{levelProjectPassed(course, level, p) ? 'Aprobado' : proyectoEnPreparacion(level) ? 'En preparación' : 'Se aprueba con 70'}</span>
                  </button>
                </li>
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
