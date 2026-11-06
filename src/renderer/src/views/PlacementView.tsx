import { useState } from 'react'
import { findTrack } from '../../../core/academy/catalog'
import { AREA_LABELS, CAREER_LEVEL_HINTS, CAREER_LEVEL_LABELS, CAREER_LEVELS } from '../../../core/academy/level'
import { nextQuestion, PLACEMENT_AREAS, QUESTIONS_PER_AREA, type PlacementAnswer } from '../../../core/academy/placement'
import { PRACTICAL_TASKS } from '../../../core/academy/placement-bank'
import type { Area } from '../../../core/academy/types'
import type { AcademyView } from '../../../main/academy'
import { Loading } from '../components/Loading'
import { Markdown } from '../components/Markdown'
import { cleanIpcError } from '../util'
import './PlacementView.css'

const GRADING_TIPS = [
  'XARA está leyendo tus respuestas prácticas con calma, como lo haría un mentor.',
  'No corrige para ponerte nota: busca dónde estás parado para armarte la mejor ruta.',
  'La parte teórica ya está lista; esto es solo el ajuste fino con tu código.',
  'En segundos tendrás tu punto de partida y los temas por los que conviene empezar.'
]

interface Props {
  view: AcademyView
  onDone: (view: AcademyView) => void
  onExit: () => void
}

type Phase = 'intro' | 'theory' | 'practical' | 'sending' | 'result'

export function PlacementView({ view, onDone, onExit }: Props) {
  const [phase, setPhase] = useState<Phase>(view.progress.placement ? 'result' : 'intro')
  const [areas, setAreas] = useState<Area[]>(PLACEMENT_AREAS)
  const [answers, setAnswers] = useState<PlacementAnswer[]>([])
  const [practical, setPractical] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)

  const areaIndex = areas.findIndex((a) => nextQuestion(a, answers) !== null)
  const area = areas[areaIndex]
  const question = area ? nextQuestion(area, answers) : null
  const total = areas.length * QUESTIONS_PER_AREA

  const answer = (choice: number) => {
    if (!question) return
    const next = [...answers, { questionId: question.id, choice }]
    setAnswers(next)
    if (areas.every((a) => nextQuestion(a, next) === null)) setPhase('practical')
  }

  const submit = async (withPractical: boolean) => {
    setPhase('sending')
    try {
      const res = await window.copilot.submitPlacement(answers, withPractical ? practical : {})
      setNotice(res.notice ?? null)
      onDone(res)
      setPhase('result')
    } catch (err) {
      setNotice(cleanIpcError(err))
      setPhase('practical')
    }
  }

  const toggleArea = (a: Area) =>
    setAreas((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : PLACEMENT_AREAS.filter((x) => x === a || prev.includes(x))))

  if (phase === 'intro') {
    return (
      <div className="placement">
        <h2>Examen de nivel</h2>
        <p className="muted-text">
          Dos partes. <b>Teórica:</b> {QUESTIONS_PER_AREA} preguntas por área que se adaptan a tus respuestas (si aciertas sube la dificultad; si fallas, baja).{' '}
          <b>Práctica:</b> tres tareas cortas que corrige XARA con IA. Responde sin ayuda: el objetivo es ubicarte bien, no sacar nota.
        </p>
        <p className="muted-text">Elige las áreas que quieres que evalúe:</p>
        <div className="area-chips">
          {PLACEMENT_AREAS.map((a) => (
            <button key={a} className={areas.includes(a) ? 'on' : ''} onClick={() => toggleArea(a)}>
              {AREA_LABELS[a]}
            </button>
          ))}
        </div>
        <div className="placement-actions">
          <button onClick={onExit}>Ahora no</button>
          <button className="primary" disabled={!areas.length} onClick={() => setPhase('theory')}>
            Empezar ({areas.length * QUESTIONS_PER_AREA} preguntas)
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'theory' && question) {
    return (
      <div className="placement">
        <div className="bar">
          <span style={{ width: `${(answers.length / total) * 100}%` }} />
        </div>
        <span className="tag">
          {AREA_LABELS[area]} · pregunta {answers.length + 1} de {total}
        </span>
        <h3 className="question" key={question.id}>
          <Markdown text={question.question} />
        </h3>
        <div className="options">
          {question.options.map((o, i) => (
            <button key={`${question.id}-${i}`} onClick={() => answer(i)}>
              <Markdown text={o} />
            </button>
          ))}
        </div>
        <button className="link" onClick={() => answer(-1)}>
          No lo sé
        </button>
      </div>
    )
  }

  if (phase === 'sending') {
    return (
      <div className="placement">
        <Loading message="XARA está corrigiendo tu examen…" tips={GRADING_TIPS} />
      </div>
    )
  }

  if (phase === 'practical') {
    return (
      <div className="placement">
        <h2>Parte práctica</h2>
        <p className="muted-text">
          Tres tareas cortas. XARA las corrige con IA (necesita tu proveedor configurado). Si prefieres, puedes saltarla y se usará solo la parte teórica.
        </p>
        {PRACTICAL_TASKS.map((t) => (
          <section key={t.id} className="task">
            <b>{t.title}</b>
            <Markdown text={t.prompt} />
            <textarea rows={6} value={practical[t.id] ?? ''} onChange={(e) => setPractical((p) => ({ ...p, [t.id]: e.target.value }))} spellCheck={false} />
          </section>
        ))}
        {notice && <p className="placement-notice">{notice}</p>}
        <div className="placement-actions">
          <button onClick={() => submit(false)}>Saltar parte práctica</button>
          <button className="primary" disabled={!Object.values(practical).some((v) => v.trim())} onClick={() => submit(true)}>
            Terminar examen
          </button>
        </div>
      </div>
    )
  }

  const result = view.progress.placement
  if (!result) return null
  return (
    <div className="placement">
      <span className="tag">Resultado del examen · {new Date(result.at).toLocaleDateString('es')}</span>
      <h2>
        Punto de partida: <span className="level-name">{CAREER_LEVEL_LABELS[result.overall]}</span>
      </h2>
      <p className="muted-text">
        Un examen corto solo te ubica; tu nivel real lo irán demostrando los ejercicios en “Mi nivel”. Por eso este resultado nunca pasa de semi-senior.
      </p>

      <div className="level-scale">
        {CAREER_LEVELS.map((lvl, i) => {
          const here = lvl === result.overall
          const passed = CAREER_LEVELS.indexOf(result.overall) >= i
          return (
            <div key={lvl} className={`level-step ${here ? 'here' : ''} ${passed ? 'passed' : ''}`}>
              <span className="level-dot">{here ? '●' : passed ? '✓' : i + 1}</span>
              <span className="level-step-name">{CAREER_LEVEL_LABELS[lvl]}</span>
              {here && <span className="level-you">Estás aquí</span>}
            </div>
          )
        })}
      </div>
      <p className="level-hint">{CAREER_LEVEL_HINTS[result.overall]}</p>

      {notice && <p className="placement-notice">{notice}</p>}
      <table className="areas-table">
        <tbody>
          {(Object.entries(result.areas) as [Area, { correct: number; total: number; level: string }][]).map(([a, r]) => (
            <tr key={a}>
              <td>{AREA_LABELS[a]}</td>
              <td>
                {r.correct}/{r.total}
              </td>
              <td>{r.level}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.practical && (
        <p>
          <b>Parte práctica: {result.practical.score}/100.</b> {result.practical.summary}
        </p>
      )}

      <div className="route-box">
        <b>🧭 Tu ruta recomendada</b>
        <p className="muted-text">XARA eligió estos temas a partir de lo que ya sabes. Empieza por el primero y avanza en orden.</p>
        <ol className="route-list">
          {result.recommendedTrackIds.map((id, i) => {
            const track = findTrack(id)
            if (!track) return null
            return (
              <li key={id} className={i === 0 ? 'first' : ''}>
                <span className="route-num">{i + 1}</span>
                <div>
                  <b>{track.title}</b>
                  {i === 0 && <span className="route-start">empieza aquí</span>}
                </div>
              </li>
            )
          })}
        </ol>
      </div>

      <div className="placement-actions">
        <button
          onClick={() => {
            setAnswers([])
            setPractical({})
            setNotice(null)
            setPhase('intro')
          }}
        >
          Repetir examen
        </button>
        <button className="primary" onClick={onExit}>
          Empezar mi ruta
        </button>
      </div>
    </div>
  )
}
