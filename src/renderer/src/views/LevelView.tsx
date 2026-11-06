import { findExercise } from '../../../core/academy/catalog'
import { AREA_LABELS, CAREER_LEVEL_LABELS } from '../../../core/academy/level'
import type { CareerLevel } from '../../../core/academy/types'
import type { AcademyView } from '../../../main/academy'
import './LevelView.css'

interface Props {
  view: AcademyView
  onOpenExercise: (id: string) => void
  onStartPlacement: () => void
  onCareerAdvice: (summary: string) => void
}

const LADDER: CareerLevel[] = ['inicial', 'junior', 'junior_plus', 'semi_senior', 'senior']

/** Resumen en texto del nivel, para pedir orientación de carrera a XARA. */
export function levelSummary(view: AcademyView): string {
  const r = view.report
  const areas = r.areas.map((a) => `- ${AREA_LABELS[a.area]}: ${CAREER_LEVEL_LABELS[a.level]} (${a.evidence} evidencias, media ${a.score})`).join('\n')
  return `Nivel global: ${CAREER_LEVEL_LABELS[r.overall]}.\nÁreas:\n${areas || '- Aún sin datos'}\nEjercicios superados: ${r.evidence.map((e) => e.title).join('; ') || 'ninguno'}.${
    view.progress.placement ? `\nExamen de nivel: ${CAREER_LEVEL_LABELS[view.progress.placement.overall]}.` : ''
  }`
}

export function LevelView({ view, onOpenExercise, onStartPlacement, onCareerAdvice }: Props) {
  const r = view.report
  const step = LADDER.indexOf(r.overall)

  return (
    <div className="level-view">
      <section className="level-hero">
        <span className="tag">Mi nivel</span>
        <h2>{CAREER_LEVEL_LABELS[r.overall]}</h2>
        <ol className="ladder">
          {LADDER.map((l, i) => (
            <li key={l} className={i < step ? 'past' : i === step ? 'now' : ''}>
              {CAREER_LEVEL_LABELS[l]}
            </li>
          ))}
        </ol>
        {r.limitingFactor && <p className="muted-text">{r.limitingFactor}</p>}
        <div className="level-actions">
          {!view.progress.placement && (
            <button className="primary" onClick={onStartPlacement}>
              Hacer examen de nivel
            </button>
          )}
          <button onClick={() => onCareerAdvice(levelSummary(view))}>Pedir orientación de carrera a XARA</button>
        </div>
      </section>

      <section className="level-card">
        <h3>Por áreas</h3>
        {r.areas.length === 0 && <p className="muted-text">Aún no hay datos: haz el examen de nivel o tu primer ejercicio.</p>}
        {r.areas.map((a) => (
          <div key={a.area} className="area-row">
            <span className="area-name">{AREA_LABELS[a.area]}</span>
            <span className="area-bar">
              <span
                style={{
                  width: `${((LADDER.indexOf(a.level) + 1) / LADDER.length) * 100}%`
                }}
              />
            </span>
            <span className="area-level">{CAREER_LEVEL_LABELS[a.level]}</span>
            <span className="muted-text area-meta">{a.evidence} {a.evidence === 1 ? 'evidencia' : 'evidencias'}</span>
          </div>
        ))}
      </section>

      <div className="level-grid">
        <section className="level-card">
          <h3>Evidencias</h3>
          {r.evidence.length === 0 ? (
            <p className="muted-text">Cada ejercicio bien hecho (70 o más) aparece aquí: es lo que podrás enseñar en una entrevista.</p>
          ) : (
            <ul className="evidence">
              {r.evidence.map((e) => (
                <li key={e.exerciseId}>
                  <button onClick={() => onOpenExercise(e.exerciseId)}>{e.title}</button>
                  <b>{e.score}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="level-card">
          <h3>Para repasar</h3>
          {r.pendingReview.length === 0 ? (
            <p className="muted-text">Nada pendiente. Lo que no apruebes volverá aquí al día siguiente para repasarlo.</p>
          ) : (
            <ul className="evidence">
              {r.pendingReview.map((id) => (
                <li key={id}>
                  <button onClick={() => onOpenExercise(id)}>{findExercise(id)?.title}</button>
                </li>
              ))}
            </ul>
          )}
          {r.calibration !== undefined && (
            <p className="calibration">
              <b>Calibración: {Math.round((1 - r.calibration) * 100)}%</b>{' '}
              <span className="muted-text">
                {r.calibration > 0.3
                  ? 'Tu seguridad y tus resultados no coinciden mucho: antes de evaluar, repasa los criterios.'
                  : 'Sabes bastante bien cuándo dominas algo. Es una habilidad senior.'}
              </span>
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
