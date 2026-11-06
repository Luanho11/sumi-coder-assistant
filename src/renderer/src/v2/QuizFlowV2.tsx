import { useEffect, useMemo, useState } from 'react'
import type { Answer } from '../../../core/academy/v2/grading'
import { rubricScore, type RubricGrade, type RubricLevel } from '../../../core/academy/v2/ai-hooks'
import type { Criterion, Exercise, Item } from '../../../core/academy/v2/types'
import type { AcademyView } from '../../../main/academy'
import { playFinish, playWrong } from '../feedback'
import { ItemView, isAnswered } from './Items'
import { GradeView } from './PracticeV2'
import './v2.css'

// Un intento de prueba: dominio de clase, examen de módulo o de nivel, repaso y preguntas de entrada.
// Se responde sin ver el resultado y, al entregar, se corrige todo con explicación y qué repasar.

export interface Loaded {
  items: Item[]
  writtenTasks?: Exercise[]
}
export interface Outcome {
  report: { pct: number; correct: number; total: number; byObjective: Record<string, number>; weakObjectives: string[] }
  passed: boolean
  questionsPassed?: boolean
  weakParts?: { id: string; title: string }[]
  results: { id: string; ok: boolean; explanation: string; why?: string }[]
  view: AcademyView
}

interface Props {
  title: string
  intro: string
  color: string
  passPct: number
  load: () => Promise<Loaded>
  submit: (items: Item[], answers: Record<string, Answer>, external: Record<string, boolean>, written: Record<string, { score: number; provisional?: boolean }>) => Promise<Outcome>
  /** Texto de cada objetivo, para el informe. */
  objectives: Record<string, string>
  onBack: () => void
  onUpdate: (v: AcademyView) => void
  onOpenPart?: (partId: string) => void
  doneLabel: string
  onDone: () => void
  /** Si es informativo (preguntas de entrada) no hay aprobado ni suspenso. */
  informative?: boolean
}

export function QuizFlowV2({ title, intro, color, passPct, load, submit, objectives, onBack, onUpdate, onOpenPart, doneLabel, onDone, informative }: Props) {
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [codeOk, setCodeOk] = useState<Record<string, boolean>>({})
  const [i, setI] = useState(0)
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<Outcome | null>(null)
  const [tasks, setTasks] = useState<Record<string, { text: string; score?: number; provisional?: boolean; grade?: RubricGrade | null; needsSelf?: boolean; levels?: RubricLevel[]; rubric?: Criterion[] }>>({})
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setData(null)
    setError(null)
    setAnswers({})
    setCodeOk({})
    setI(0)
    setOut(null)
    setTasks({})
    load()
      .then(setData)
      .catch((e) => setError(String((e as Error).message).replace(/^Error invoking remote method '[^']+': Error: /, '')))
  }, [attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = data?.items ?? []
  const item = items[i]
  const written = data?.writtenTasks ?? []
  const allAnswered = items.length > 0 && items.every((it) => isAnswered(it, answers[it.id]))
  const tasksDone = written.every((t) => tasks[t.id]?.score !== undefined)
  const pctDone = useMemo(() => (items.length ? Math.round((items.filter((it) => isAnswered(it, answers[it.id])).length / items.length) * 100) : 0), [items, answers])

  const gradeTask = async (t: Exercise) => {
    const cur = tasks[t.id]
    if (!cur?.text?.trim()) return
    setBusy(true)
    try {
      const r = await window.copilot.v2.gradeTask(t.id, cur.text)
      if (r.grade) setTasks((s) => ({ ...s, [t.id]: { ...cur, score: r.grade!.score, grade: r.grade, provisional: false } }))
      else if (r.needsSelfCheck) setTasks((s) => ({ ...s, [t.id]: { ...cur, needsSelf: true, rubric: r.rubric, levels: r.rubric.map(() => 'parcial' as RubricLevel) } }))
      else setError('Tu respuesta es demasiado corta para corregirla.')
    } finally {
      setBusy(false)
    }
  }

  const send = async () => {
    setBusy(true)
    setError(null)
    try {
      // Las respuestas escritas del banco se corrigen con la rúbrica (IA, o comprobación de puntos clave si no hay conexión).
      const external: Record<string, boolean> = { ...codeOk }
      for (const it of items) {
        if (it.type === 'written') {
          const r = await window.copilot.v2.gradeWritten(it.id, String(answers[it.id] ?? ''))
          external[it.id] = r.ok
        }
      }
      const wr = Object.fromEntries(Object.entries(tasks).filter(([, v]) => v.score !== undefined).map(([k, v]) => [k, { score: v.score!, ...(v.provisional ? { provisional: true } : {}) }]))
      const o = await submit(items, answers, external, wr)
      onUpdate(o.view)
      setOut(o)
      if (informative || o.passed) playFinish()
      else playWrong()
    } catch (e) {
      setError(String((e as Error).message).replace(/^Error invoking remote method '[^']+': Error: /, ''))
    } finally {
      setBusy(false)
    }
  }

  if (error && !data) {
    return (
      <div className="x2-flow">
        <button className="back" onClick={onBack}>‹ Volver</button>
        <p className="x2-feedback bad">{error}</p>
      </div>
    )
  }
  if (!data) return <div className="x2-flow"><p className="x2-muted">Preparando las preguntas…</p></div>

  // ───── Resultado ─────
  if (out) {
    const byId = new Map(out.results.map((r) => [r.id, r]))
    return (
      <div className="x2-flow" style={{ ['--track' as string]: color }}>
        <button className="back" onClick={onBack}>‹ Volver</button>
        <h2 className="x2-title">{title}</h2>
        <section className={`x2-card x2-scorecard ${informative || out.passed ? 'ok' : 'bad'}`} role="status">
          <p className="x2-bignum">{out.report.pct}<small> %</small></p>
          <div>
            <h3>{informative ? 'Así estás de partida' : out.passed ? 'Aprobado' : 'Todavía no'}</h3>
            <p>
              {out.report.correct} de {out.report.total} correctas.{' '}
              {informative ? 'No cuenta para tu nota: sirve para saber qué repasar.' : out.passed ? 'Puedes avanzar.' : `Necesitas ${passPct} %${out.questionsPassed === false ? ' y no bajar de 60 % en ningún objetivo' : ''}${written.length && out.questionsPassed ? ' y aprobar las tareas escritas' : ''}.`}
            </p>
          </div>
        </section>
        <section className="x2-card">
          <h3>Por objetivo</h3>
          <ul className="x2-bars">
            {Object.entries(out.report.byObjective).map(([o, v]) => (
              <li key={o} className={v < 60 ? 'low' : v < passPct ? 'mid' : 'ok'}>
                <span>{objectives[o] ?? o}</span>
                <span className="x2-bar"><i style={{ width: `${v}%` }} /></span>
                <b>{v} %</b>
              </li>
            ))}
          </ul>
          {!out.passed && !informative && out.weakParts && out.weakParts.length > 0 && onOpenPart && (
            <>
              <h4>Repasa estas partes antes de reintentar</h4>
              <div className="x2-row">
                {out.weakParts.map((p) => (
                  <button key={p.id} className="x2-btn" onClick={() => onOpenPart(p.id)}>
                    {p.title}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
        <section className="x2-card">
          <h3>Revisión pregunta a pregunta</h3>
          {items.map((it) => (
            <ItemView key={it.id} item={it} answer={answers[it.id]} onChange={() => undefined} result={byId.get(it.id) ? { ok: byId.get(it.id)!.ok, why: byId.get(it.id)!.why, explanation: byId.get(it.id)!.explanation } : undefined} />
          ))}
        </section>
        <div className="x2-row">
          {out.passed || informative ? (
            <button className="x2-btn primary" onClick={onDone}>{doneLabel}</button>
          ) : (
            <button className="x2-btn primary" onClick={() => setAttempt(attempt + 1)}>Reintentar con otras preguntas</button>
          )}
          <button className="x2-btn" onClick={onBack}>Volver</button>
        </div>
      </div>
    )
  }

  // ───── Intento ─────
  return (
    <div className="x2-flow" style={{ ['--track' as string]: color }}>
      <button className="back" onClick={onBack}>‹ Volver</button>
      <h2 className="x2-title">{title}</h2>
      <p className="x2-muted">{intro}</p>
      <div className="x2-progress" role="progressbar" aria-valuenow={pctDone} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pctDone}%` }} /></div>
      <ol className="x2-dots" aria-label="Preguntas">
        {items.map((it, k) => (
          <li key={it.id} className={`${k === i ? 'now' : ''} ${isAnswered(it, answers[it.id]) ? 'done' : ''}`}>
            <button onClick={() => setI(k)} aria-label={`Pregunta ${k + 1}`}>{k + 1}</button>
          </li>
        ))}
      </ol>
      {item && (
        <section className="x2-card">
          <p className="x2-muted">Pregunta {i + 1} de {items.length}</p>
          <ItemView item={item} answer={answers[item.id]} onChange={(a) => setAnswers((s) => ({ ...s, [item.id]: a }))} onCodeResult={(ok) => setCodeOk((s) => ({ ...s, [item.id]: ok }))} />
          <div className="x2-row">
            <button className="x2-btn" disabled={i === 0} onClick={() => setI(i - 1)}>Anterior</button>
            <button className="x2-btn" disabled={i >= items.length - 1} onClick={() => setI(i + 1)}>Siguiente</button>
          </div>
        </section>
      )}

      {written.map((t) => {
        const cur = tasks[t.id] ?? { text: '' }
        return (
          <section key={t.id} className="x2-card">
            <h3>Tarea escrita: {t.title}</h3>
            <p>{t.statement}</p>
            <textarea className="x2-textarea" rows={8} value={cur.text} disabled={cur.score !== undefined} placeholder="Escribe aquí tu respuesta." onChange={(e) => setTasks((s) => ({ ...s, [t.id]: { ...cur, text: e.target.value } }))} />
            {cur.score === undefined && !cur.needsSelf && (
              <button className="x2-btn" disabled={busy || cur.text.trim().length < 50} onClick={() => void gradeTask(t)}>Corregir esta tarea</button>
            )}
            {cur.grade && <GradeView grade={cur.grade} />}
            {cur.needsSelf && cur.score === undefined && cur.rubric && (
              <>
                <p>Sin conexión con la corrección de XARA: valórala tú con la rúbrica, comparando con el modelo. Quedará <b>provisional</b>.</p>
                <details open><summary>Respuesta modelo</summary><pre className="x2-pre">{t.exemplar}</pre></details>
                <ul className="x2-rubric">
                  {cur.rubric.map((r, k) => (
                    <li key={r.criterion}>
                      <b>{r.criterion}</b>
                      <div className="x2-seg">
                        {(['bien', 'parcial', 'falta'] as RubricLevel[]).map((l) => (
                          <button key={l} aria-pressed={cur.levels?.[k] === l} onClick={() => setTasks((s) => ({ ...s, [t.id]: { ...cur, levels: (cur.levels ?? []).map((x, q) => (q === k ? l : x)) } }))}>
                            {l === 'bien' ? 'Bien' : l === 'parcial' ? 'A medias' : 'Falta'}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
                <button className="x2-btn" onClick={() => setTasks((s) => ({ ...s, [t.id]: { ...cur, score: rubricScore(cur.levels ?? []), provisional: true, needsSelf: false } }))}>
                  Registrar mi valoración ({rubricScore(cur.levels ?? [])})
                </button>
              </>
            )}
            {cur.score !== undefined && !cur.grade && <p>Valoración registrada: {cur.score}{cur.provisional ? ' (provisional)' : ''}.</p>}
          </section>
        )
      })}

      {error && <p className="x2-feedback bad">{error}</p>}
      <div className="x2-row">
        <button className="x2-btn primary" disabled={!allAnswered || !tasksDone || busy} onClick={send}>
          {busy ? 'Corrigiendo…' : allAnswered && tasksDone ? 'Entregar y ver resultado' : !allAnswered ? `Responde todas (${items.filter((it) => isAnswered(it, answers[it.id])).length}/${items.length})` : 'Completa las tareas escritas'}
        </button>
      </div>
    </div>
  )
}
