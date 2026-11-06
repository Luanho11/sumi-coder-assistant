import { useEffect, useRef, useState } from 'react'
import { findTrack, stepsFor } from '../../../core/academy/catalog'
import { EVALUATION_LABELS, ERROR_LABELS, effectiveScore, latestAttempt, PASS_SCORE } from '../../../core/academy/level'
import type { Attempt, Draft, Exercise, PhaseId } from '../../../core/academy/types'
import type { AcademyView, LinkStatus } from '../../../main/academy'
import { Markdown } from '../components/Markdown'
import { AI_POLICY_LABELS, KIND_LABELS } from '../labels'
import { cleanIpcError } from '../util'
import './ExerciseView.css'

interface Props {
  exercise: Exercise
  view: AcademyView
  onBack: () => void
  onUpdate: (view: AcademyView) => void
  onAskTutor: (text: string) => void
}

const MIN_TRY_CHARS = 30
const CONFIDENCE = ['Nada', 'Poca', 'Algo', 'Bastante', 'Total']

export function ExerciseView({ exercise: e, view, onBack, onUpdate, onAskTutor }: Props) {
  const steps = stepsFor(e)
  const saved = view.progress.drafts[e.id]
  const [answers, setAnswers] = useState<Draft['answers']>(saved?.answers ?? {})
  const [hintsShown, setHintsShown] = useState(saved?.hintsShown ?? 0)
  const [aiHints, setAiHints] = useState<string[]>([])
  const [active, setActive] = useState(0)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [busy, setBusy] = useState<'evaluar' | 'pista' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showSolution, setShowSolution] = useState(false)
  const [links, setLinks] = useState<Record<string, LinkStatus>>({})
  const firstRender = useRef(true)
  const attempts = view.progress.attempts.filter((a) => a.exerciseId === e.id)
  const last = latestAttempt(view.progress, e.id)
  const passed = !!last && effectiveScore(last) >= PASS_SCORE
  const written = Object.values(answers).join('').trim().length
  const step = steps[active]

  useEffect(() => {
    void window.copilot.checkLinks(e.resources.map((r) => r.url)).then(setLinks)
  }, [e])

  // Guardado automático del borrador: no se pierde nada al cambiar de vista o cerrar la app.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const timer = setTimeout(() => void window.copilot.saveDraft(e.id, { answers, hintsShown }).then(onUpdate), 700)
    return () => clearTimeout(timer)
  }, [answers, hintsShown, e.id, onUpdate])

  const setAnswer = (id: PhaseId, text: string) => setAnswers((prev) => ({ ...prev, [id]: text }))

  const revealHint = () => {
    if (written < MIN_TRY_CHARS) {
      setMessage('Antes de pedir una pista, escribe lo que has intentado o lo que entiendes. Saber pedir ayuda concreta también es una habilidad profesional.')
      return
    }
    setMessage(null)
    setHintsShown((n) => Math.min(e.hints.length, n + 1))
  }

  const askAiHint = async () => {
    if (written < MIN_TRY_CHARS) {
      setMessage('Escribe primero lo que llevas: XARA te dará una pista sobre tu intento, no una genérica.')
      return
    }
    setBusy('pista')
    setMessage(null)
    try {
      const res = await window.copilot.aiHint(e.id, { answers, hintsShown })
      setAiHints((prev) => [...prev, res.text])
      setHintsShown(res.progress.drafts[e.id]?.hintsShown ?? hintsShown)
      onUpdate(res)
    } catch (err) {
      setMessage(cleanIpcError(err))
    } finally {
      setBusy(null)
    }
  }

  const evaluate = async () => {
    if (confidence === null) return
    setBusy('evaluar')
    setMessage(null)
    try {
      await window.copilot.saveDraft(e.id, { answers, hintsShown })
      const res = await window.copilot.evaluate(e.id, confidence)
      onUpdate(res)
      if (res.notice) setMessage(res.notice)
      setConfidence(null)
    } catch (err) {
      setMessage(cleanIpcError(err))
    } finally {
      setBusy(null)
    }
  }

  const askTutor = () =>
    onAskTutor(
      `Estoy con el ejercicio "${e.title}" (${findTrack(e.trackId)?.title}). ${e.description}\n\nLo que llevo:\n${steps.map((s) => `${s.title}: ${answers[s.id]?.trim() || '(vacío)'}`).join('\n')}\n\nNo me des la solución: ayúdame a entender lo que me falta.`
    )

  return (
    <div className="exercise">
      <div className="exercise-main">
        <button className="back" onClick={onBack}>
          ‹ Academia
        </button>
        <header>
          <div className="tags">
            <span className="tag">{findTrack(e.trackId)?.title}</span>
            <span className="tag">{KIND_LABELS[e.kind]}</span>
            <span className="tag">{e.difficulty}</span>
            {passed && <span className="tag ok">Superado</span>}
          </div>
          <h2>{e.title}</h2>
          <Markdown text={e.description} />
          {e.objective && (
            <p className="muted-text">
              <b>Objetivo:</b> {e.objective}
            </p>
          )}
          <p className={`policy policy-${e.aiPolicy}`}>{AI_POLICY_LABELS[e.aiPolicy]}</p>
          {e.constraints.length > 0 && (
            <ul className="constraints">
              {e.constraints.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </header>

        <ol className="stepper">
          {steps.map((s, i) => (
            <li key={s.id}>
              <button className={`${i === active ? 'on' : ''} ${answers[s.id]?.trim() ? 'filled' : ''}`} onClick={() => setActive(i)}>
                <span className="num">{answers[s.id]?.trim() ? '✓' : i + 1}</span>
                {s.title}
              </button>
            </li>
          ))}
        </ol>

        <section className="step-card" key={step.id}>
          <p className="step-prompt">{step.prompt}</p>
          {step.checklist && (
            <ul className="checklist">
              {step.checklist.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
          <textarea
            rows={step.id === 'construir' ? 14 : 7}
            value={answers[step.id] ?? ''}
            onChange={(ev) => setAnswer(step.id, ev.target.value)}
            placeholder="Escribe aquí. Se guarda solo."
            spellCheck={false}
          />
          <div className="step-nav">
            <button disabled={active === 0} onClick={() => setActive((i) => i - 1)}>
              Anterior
            </button>
            {active < steps.length - 1 ? (
              <button className="primary" onClick={() => setActive((i) => i + 1)}>
                Siguiente paso
              </button>
            ) : (
              <span className="muted-text">Último paso: cuando acabes, pide la evaluación.</span>
            )}
          </div>
        </section>

        <section className="evaluate">
          <p>
            <b>¿Cuánta seguridad tienes en tu respuesta?</b> <span className="muted-text">Compararla con el resultado entrena tu criterio.</span>
          </p>
          <div className="segmented">
            {CONFIDENCE.map((c, i) => (
              <button key={c} className={confidence === i + 1 ? 'on' : ''} onClick={() => setConfidence(i + 1)}>
                {c}
              </button>
            ))}
          </div>
          <button className="primary" disabled={confidence === null || busy !== null || written === 0} onClick={evaluate}>
            {busy === 'evaluar' ? 'XARA está evaluando…' : 'Evaluar con XARA'}
          </button>
        </section>

        {message && (
          <p className="exercise-message" role="status">
            {message}
          </p>
        )}

        {last && <EvaluationCard attempt={last} />}

        {passed && e.harderVariant && (
          <section className="variant">
            <b>Variante más difícil</b>
            <p>{e.harderVariant}</p>
          </section>
        )}

        {attempts.length > 0 && e.solution && (
          <section className="solution">
            <button onClick={() => setShowSolution((v) => !v)}>{showSolution ? 'Ocultar solución de referencia' : 'Ver solución de referencia'}</button>
            {showSolution && (
              <>
                <p className="muted-text">Compárala con la tuya: hay otras soluciones válidas. Si no entiendes algo, pregúntale a XARA.</p>
                <Markdown text={'```\n' + e.solution + '\n```'} />
              </>
            )}
          </section>
        )}

        {attempts.length > 1 && <p className="muted-text history">Intentos: {attempts.map((a) => `${effectiveScore(a)}`).join(' → ')}</p>}
      </div>

      <aside className="exercise-aside">
        <section>
          <h3>Pistas</h3>
          <p className="muted-text small">Cada pista cuenta en la evaluación: úsalas cuando de verdad te atasques.</p>
          <ol className="hints">
            {e.hints.slice(0, hintsShown).map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ol>
          {aiHints.map((h, i) => (
            <div key={i} className="ai-hint">
              <Markdown text={h} />
            </div>
          ))}
          {hintsShown < e.hints.length ? (
            <button onClick={revealHint}>
              Ver pista {hintsShown + 1} de {e.hints.length}
            </button>
          ) : (
            <button onClick={askAiHint} disabled={busy !== null}>
              {busy === 'pista' ? 'Pensando…' : 'Pista de XARA sobre mi intento'}
            </button>
          )}
        </section>

        <section>
          <h3>Dónde está la respuesta</h3>
          <ul className="resources">
            {e.resources.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer">
                  {r.kind === 'video' ? '▶ ' : '📄 '}
                  {r.title}
                </a>
                {links[r.url] === 'roto' && <span className="tag bad">No disponible</span>}
                {links[r.url] === 'ok' && r.youtubeId && <span className="tag ok">Disponible</span>}
              </li>
            ))}
            <li>
              <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(e.skill ?? e.title)}`} target="_blank" rel="noreferrer">
                ▶ Buscar más vídeos sobre “{e.skill ?? e.title}”
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h3>¿Dudas?</h3>
          <button
            onClick={askTutor}
            disabled={e.aiPolicy === 'sin_ia'}
            title={e.aiPolicy === 'sin_ia' ? 'Este ejercicio es sin IA: usa las pistas' : undefined}
          >
            Preguntar a XARA en el tutor
          </button>
          {e.interviewQuestion && (
            <p className="muted-text small">
              <b>En entrevista te pueden preguntar:</b> {e.interviewQuestion}
            </p>
          )}
          {e.portfolioEvidence && (
            <p className="muted-text small">
              <b>Evidencia para tu portafolio:</b> {e.portfolioEvidence}
            </p>
          )}
        </section>
      </aside>
    </div>
  )
}

function EvaluationCard({ attempt }: { attempt: Attempt }) {
  const ev = attempt.evaluation
  const score = effectiveScore(attempt)
  return (
    <section className={`evaluation level-${ev.level}`}>
      <header>
        <span className="score">{score}</span>
        <div>
          <b>{EVALUATION_LABELS[ev.level]}</b>
          <span className="muted-text small">
            {ev.mode === 'offline' ? 'Estimación sin IA (orientativa)' : 'Evaluado por XARA'}
            {attempt.hintsUsed > 1 && ` · ${attempt.hintsUsed} pistas usadas`}
            {` · seguridad declarada ${CONFIDENCE[attempt.confidence - 1]?.toLowerCase()}`}
          </span>
        </div>
      </header>
      {ev.criteria.length > 0 && (
        <ul className="criteria">
          {ev.criteria.map((c) => (
            <li key={c.criterion} className={`met-${c.met}`}>
              <span className="mark">{c.met === 'si' ? '✓' : c.met === 'parcial' ? '◐' : '✗'}</span>
              <span>
                {c.criterion}
                {c.evidence && <span className="muted-text small"> — {c.evidence}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {ev.errorTypes.length > 0 && (
        <p className="small">
          <b>Tipo de error:</b> {ev.errorTypes.map((t) => ERROR_LABELS[t]).join(', ')}
        </p>
      )}
      {ev.strengths.length > 0 && (
        <p className="small">
          <b>Lo que haces bien:</b> {ev.strengths.join(' ')}
        </p>
      )}
      {ev.improve.length > 0 && (
        <ul className="small improve">
          {ev.improve.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
      {ev.nextStep && (
        <p className="next-step">
          <b>Siguiente paso:</b> {ev.nextStep}
        </p>
      )}
    </section>
  )
}
