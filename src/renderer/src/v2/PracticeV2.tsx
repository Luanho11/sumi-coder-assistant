import { useEffect, useRef, useState } from 'react'
import { findCourse, findLessonV2 } from '../../../core/academy/v2/courses'
import { practiceOpen } from '../../../core/academy/v2/gating'
import type { Answer } from '../../../core/academy/v2/grading'
import type { RubricGrade, RubricLevel } from '../../../core/academy/v2/ai-hooks'
import { rubricScore } from '../../../core/academy/v2/ai-hooks'
import type { Tier } from '../../../core/academy/v2/types'
import type { VoiceSettings } from '../../../core/types'
import type { AcademyView } from '../../../main/academy'
import { Markdown } from '../components/Markdown'
import { playCorrect, playFinish, playWrong } from '../feedback'
import { useVoice } from '../useVoice'
import { ItemView, esEjecutable, gradeCode, gradeLocal, isAnswered } from './Items'
import './v2.css'

const TIER_NAME: Record<Tier, string> = { A: 'Replica', B: 'Adapta', C: 'Crea', D: 'Transfiere' }
const TIER_HELP: Record<Tier, string> = {
  A: 'Repite el ejemplo de la clase con otros datos. Tienes plantilla y comprobaciones.',
  B: 'Un caso donde cambia algo. La plantilla ya no trae huecos.',
  C: 'La tarea profesional completa, a tu manera.',
  D: 'Una situación nueva, sin ayuda.'
}
const draftKey = (id: string, k: string) => `xara.v2.borrador.${id}.${k}`
const load = (id: string, k: string) => {
  try {
    return localStorage.getItem(draftKey(id, k)) ?? ''
  } catch {
    return ''
  }
}
const save = (id: string, k: string, v: string) => {
  try {
    localStorage.setItem(draftKey(id, k), v)
  } catch {
    /* el borrador simplemente no se guarda */
  }
}

interface Props {
  lessonId: string
  tier: Tier
  view: AcademyView
  voiceSettings: VoiceSettings
  onBack: () => void
  onUpdate: (v: AcademyView) => void
  onOpenPart: (partId: string) => void
  onTier: (t: Tier) => void
  onMastery: () => void
}

export function PracticeV2({ lessonId, tier, view, voiceSettings, onBack, onUpdate, onOpenPart, onTier, onMastery }: Props) {
  const ref = findLessonV2(lessonId)
  const ex = ref?.lesson.practice.find((e) => e.tier === tier)
  const lp = view.progress.v2?.lessons[lessonId]
  const result = lp?.practice[tier]
  const steps = ex?.steps ?? []
  const phased = tier === 'C' || tier === 'D'
  const [text, setText] = useState(() => (ex ? load(ex.id, 'texto') : ''))
  const [phaseAnswers, setPhaseAnswers] = useState<Record<string, string>>(() => Object.fromEntries(steps.map((s) => [s.id, ex ? load(ex.id, s.id) : ''])))
  const [phase, setPhase] = useState(0)
  const [checkAnswers, setCheckAnswers] = useState<Record<string, Answer>>({})
  const [codeOk, setCodeOk] = useState<Record<string, boolean>>({})
  const [checkResults, setCheckResults] = useState<Record<string, ReturnType<typeof gradeLocal>>>({})
  const [hints, setHints] = useState(0)
  const [busy, setBusy] = useState(false)
  const [out, setOut] = useState<{ grade: RubricGrade | null; passed: boolean; needsSelfCheck: boolean; tooShort: boolean; checksOk: boolean } | null>(null)
  const [levels, setLevels] = useState<RubricLevel[]>([])
  const [self, setSelf] = useState<{ score: number; passed: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const voice = useVoice(voiceSettings, (t) => (phased ? setPhaseAnswers((a) => ({ ...a, [steps[phase].id]: `${a[steps[phase].id] ?? ''} ${t}`.trim() })) : setText((x) => `${x} ${t}`.trim())))
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => () => voice.stop(), []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!ref || !ex) return null
  const open = practiceOpen(ref.lesson, lp, tier) || view.unlockAll
  const lessonParts = ref.lesson.parts
  const exemplarOpen = !!result?.firstAttemptAt
  const fullAnswer = phased ? steps.map((s) => `### ${s.title}\n${phaseAnswers[s.id] ?? ''}`).join('\n\n') : text
  const written = (phased ? Object.values(phaseAnswers).join(' ') : text).trim().length
  const tiers = ref.lesson.practice.map((e) => e.tier)
  const nextTier = tiers[tiers.indexOf(tier) + 1]
  const checks = ex.checks ?? []
  const allChecked = checks.every((c) => checkResults[c.id])

  const setPhaseText = (id: string, v: string) => {
    setPhaseAnswers((a) => ({ ...a, [id]: v }))
    save(ex.id, id, v)
  }
  const insertScaffold = () => {
    if (!ex.scaffold) return
    if (phased) {
      const s = steps.find((x) => x.id === 'construir') ?? steps[0]
      setPhaseText(s.id, phaseAnswers[s.id] ? `${phaseAnswers[s.id]}\n\n${ex.scaffold}` : ex.scaffold)
    } else {
      const v = text ? `${text}\n\n${ex.scaffold}` : ex.scaffold
      setText(v)
      save(ex.id, 'texto', v)
    }
  }

  const checkOne = (id: string) => {
    const it = checks.find((c) => c.id === id)!
    const r = esEjecutable(it) ? gradeCode(it, codeOk[id] === true) : gradeLocal(it, checkAnswers[id])
    setCheckResults((s) => ({ ...s, [id]: r }))
    if (r.ok) playCorrect()
    else playWrong()
  }

  const reintentar = (id: string) => {
    const sinId = <T,>(m: Record<string, T>) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== id))
    setCheckResults(sinId)
    setCheckAnswers(sinId)
    setCodeOk(sinId)
    setOut(null)
    setSelf(null)
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    setOut(null)
    setSelf(null)
    try {
      const r = await window.copilot.v2.practiceSubmit({ lessonId, tier, answer: fullAnswer, checkAnswers })
      onUpdate(r.view)
      setOut({ grade: r.grade, passed: r.passed, needsSelfCheck: r.needsSelfCheck, tooShort: r.tooShort, checksOk: r.checksOk })
      setLevels(ex.rubric.map(() => 'parcial'))
      if (r.passed) playFinish()
      else playWrong()
    } catch (e) {
      setError(String((e as Error).message).replace(/^Error invoking remote method '[^']+': Error: /, ''))
    } finally {
      setBusy(false)
    }
  }

  const sendSelf = async () => {
    setBusy(true)
    try {
      const r = await window.copilot.v2.practiceSelfCheck(lessonId, tier, levels)
      onUpdate(r.view)
      setSelf({ score: r.score, passed: r.passed })
      if (r.passed) playFinish()
    } catch (e) {
      setError(String((e as Error).message).replace(/^Error invoking remote method '[^']+': Error: /, ''))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="x2-practice" style={{ ['--track' as string]: ref.course.color }}>
      <button className="back" onClick={onBack}>
        ‹ {ref.lesson.title}
      </button>
      <ol className="x2-tiers" aria-label="Escalones de práctica">
        {tiers.map((t) => {
          const p = lp?.practice[t]
          return (
            <li key={t} className={`${t === tier ? 'now' : ''} ${p?.passed ? 'done' : ''}`}>
              <button disabled={!(practiceOpen(ref.lesson, lp, t) || view.unlockAll)} onClick={() => onTier(t)}>
                <b>{t}</b> {TIER_NAME[t]}
                {p?.passed && <span className="x2-ok">{p.provisional ? ' · provisional' : ' · superado'}</span>}
              </button>
            </li>
          )
        })}
      </ol>
      <header className="x2-ex-head">
        <h2 className="x2-title">{ex.title}</h2>
        <p className="x2-muted">{TIER_HELP[tier]}</p>
      </header>
      {!open && <p className="x2-feedback bad">Este escalón se abre al superar el anterior (y al terminar todas las partes de la clase).</p>}

      <section className="x2-card">
        <Markdown text={ex.statement} />
      </section>

      <section className="x2-card x2-decoded">
        <h3>Lo que te piden, traducido</h3>
        <ul>
          {ex.decoded.youAreAsked.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        {ex.decoded.doNotNeed && ex.decoded.doNotNeed.length > 0 && (
          <p className="x2-muted">
            <b>No necesitas:</b> {ex.decoded.doNotNeed.join(' · ')}
          </p>
        )}
        <Terms courseId={ref.course.id} ids={ex.decoded.terms} />
      </section>

      {ex.scaffold && (
        <details className="x2-card x2-scaffold">
          <summary>Plantilla</summary>
          <Markdown text={ex.scaffold} />
          <button className="x2-btn" onClick={insertScaffold} disabled={!open}>
            Insertar en mi respuesta
          </button>
        </details>
      )}

      {checks.length > 0 && (
        <section className="x2-card">
          <h3>Comprobaciones</h3>
          {checks.map((c) => (
            <div key={c.id}>
              <ItemView item={c} answer={checkAnswers[c.id]} result={checkResults[c.id]} disabled={!open} onCodeResult={(ok) => setCodeOk((s) => ({ ...s, [c.id]: ok }))} onChange={(a) => { setCheckAnswers((s) => ({ ...s, [c.id]: a })); setCodeOk((s) => ({ ...s, [c.id]: false })); if (c.type === 'mcq' && !checkResults[c.id]) setTimeout(() => setCheckResults((s) => ({ ...s, [c.id]: gradeLocal(c, a) })), 0) }} />
              {checkResults[c.id] && !checkResults[c.id].ok && (
                <button className="x2-btn" disabled={!open} onClick={() => reintentar(c.id)}>
                  Intentar otra vez
                </button>
              )}
              {!checkResults[c.id] && c.type !== 'mcq' && (
                <button className="x2-btn" disabled={!isAnswered(c, checkAnswers[c.id])} onClick={() => checkOne(c.id)}>
                  Comprobar
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="x2-card">
        <h3>{phased ? steps[phase]?.title : 'Tu respuesta'}</h3>
        {phased && (
          <>
            <ol className="x2-phases">
              {steps.map((s, i) => (
                <li key={s.id} className={i === phase ? 'now' : phaseAnswers[s.id]?.trim() ? 'done' : ''}>
                  <button onClick={() => setPhase(i)}>{s.title}</button>
                </li>
              ))}
            </ol>
            <p className="x2-muted">{steps[phase]?.prompt}</p>
          </>
        )}
        {!phased && steps.length > 0 && (
          <ol className="x2-howto">
            {steps.map((s) => (
              <li key={s.id}>
                <b>{s.title}.</b> {s.prompt}
              </li>
            ))}
          </ol>
        )}
        <textarea
          ref={taRef}
          className="x2-textarea big"
          rows={phased ? 9 : 12}
          disabled={!open}
          value={phased ? (phaseAnswers[steps[phase].id] ?? '') : text}
          placeholder="Escribe aquí. Se guarda solo."
          onChange={(e) => (phased ? setPhaseText(steps[phase].id, e.target.value) : (setText(e.target.value), save(ex.id, 'texto', e.target.value)))}
        />
        <div className="x2-row">
          <button className={`x2-btn ${voice.recording ? 'rec' : ''}`} onClick={() => void voice.toggleRecording()} aria-pressed={voice.recording} title="Dicta tu respuesta en voz alta">
            {voice.recording ? 'Detener dictado' : 'Dictar'}
          </button>
          {phased && phase < steps.length - 1 && (
            <button className="x2-btn" onClick={() => setPhase(phase + 1)}>
              Siguiente paso
            </button>
          )}
          <button className="x2-btn primary" disabled={!open || busy || written < 30 || (checks.length > 0 && !allChecked)} onClick={submit}>
            {busy ? 'Revisando…' : 'Enviar mi intento'}
          </button>
        </div>
        {voice.error && <p className="x2-feedback bad">{voice.error}</p>}
        {error && <p className="x2-feedback bad">{error}</p>}
      </section>

      <section className="x2-card">
        <h3>Pistas</h3>
        <p className="x2-muted">Úsalas cuando de verdad te atasques: cada pista te lleva a la parte de la clase donde se explicó.</p>
        {ex.hints.slice(0, hints).map((h, i) => {
          const part = lessonParts.find((p) => p.id === h.taughtIn)
          return (
            <div key={i} className="x2-hint">
              <p>{h.text}</p>
              {part && (
                <button className="x2-link" onClick={() => onOpenPart(part.id)}>
                  Repasa: {part.title}
                </button>
              )}
            </div>
          )
        })}
        {hints < ex.hints.length && (
          <button className="x2-btn" disabled={!open || written < 10} onClick={() => setHints(hints + 1)} title={written < 10 ? 'Primero escribe un intento' : undefined}>
            Ver pista {hints + 1} de {ex.hints.length}
          </button>
        )}
        {hints < ex.hints.length && written < 10 && <p className="x2-muted">Antes de pedir una pista, escribe un primer intento.</p>}
      </section>

      {out && (
        <section className={`x2-card x2-result ${out.passed ? 'ok' : ''}`} role="status">
          <h3>{out.tooShort ? 'Escribe un poco más' : out.passed ? 'Superado' : out.needsSelfCheck ? 'Compara y valora tu trabajo' : 'Todavía no'}</h3>
          {out.tooShort && <p>Tu respuesta es demasiado corta para corregirla. Desarrolla cada punto.</p>}
          {checks.length > 0 && <p>{out.checksOk ? 'Superaste las comprobaciones.' : 'Alguna comprobación no está bien: pulsa «Intentar otra vez» en la que dice «Todavía no», corrígela y envía de nuevo. Para pasar este escalón hacen falta todas, aunque tu texto esté bien.'}</p>}
          {out.grade && <GradeView grade={out.grade} />}
          {out.needsSelfCheck && !self && (
            <>
              <p>
                No hay conexión con la corrección de XARA, así que lo valoras tú con la rúbrica, comparando con el modelo de abajo. Se marcará como <b>provisional</b> y se confirmará cuando XARA pueda corregirlo.
              </p>
              <ul className="x2-rubric">
                {ex.rubric.map((r, i) => (
                  <li key={r.criterion}>
                    <b>{r.criterion}</b>
                    <div className="x2-seg">
                      {(['bien', 'parcial', 'falta'] as RubricLevel[]).map((l) => (
                        <button key={l} aria-pressed={levels[i] === l} onClick={() => setLevels((s) => s.map((x, k) => (k === i ? l : x)))}>
                          {l === 'bien' ? 'Bien' : l === 'parcial' ? 'A medias' : 'Falta'}
                        </button>
                      ))}
                    </div>
                    <p className="x2-muted">{r.levels[levels[i] ?? 'parcial']}</p>
                  </li>
                ))}
              </ul>
              <p className="x2-muted">Tu valoración: {rubricScore(levels)} de 100 (se necesitan 70).</p>
              <button className="x2-btn primary" disabled={busy} onClick={sendSelf}>
                Registrar mi valoración
              </button>
            </>
          )}
          {self && <p>{self.passed ? `Aprobado de forma provisional (${self.score}).` : self.score >= 70 ? `Tu valoración (${self.score}) llega a 70, pero falta superar las comprobaciones de arriba: corrígelas y envía de nuevo.` : `Con ${self.score} todavía no llegas a 70. Revisa el modelo y vuelve a intentarlo.`}</p>}
        </section>
      )}

      {exemplarOpen && (
        <section className="x2-card x2-compare">
          <h3>Compara con el modelo</h3>
          <div className="x2-compare-grid">
            <div>
              <h4>Tu respuesta</h4>
              <pre className="x2-pre">{result?.answer ?? fullAnswer}</pre>
            </div>
            <div>
              <h4>Respuesta modelo</h4>
              <pre className="x2-pre">{ex.exemplar}</pre>
            </div>
          </div>
          <h4>Qué mirar</h4>
          <ul>
            {ex.exemplarNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <details>
            <summary>Errores comunes</summary>
            <ul>
              {ex.commonErrors.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </details>
          <details>
            <summary>Lista para revisar tu trabajo</summary>
            <ul>
              {ex.selfCheck.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </details>
        </section>
      )}

      {result?.passed && (
        <div className="x2-row">
          {nextTier ? (
            <button className="x2-btn primary" onClick={() => onTier(nextTier)}>
              Siguiente escalón: {nextTier} · {TIER_NAME[nextTier]}
            </button>
          ) : (
            <button className="x2-btn primary" onClick={onMastery}>
              Ir a la comprobación de la clase
            </button>
          )}
          {nextTier && ['A', 'B', 'C'].every((t) => lp?.practice[t as Tier]?.passed) && (
            <button className="x2-btn" onClick={onMastery}>
              Ir a la comprobación de la clase
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function Terms({ courseId, ids }: { courseId: string; ids: string[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const terms = ids.map((id) => glossary(courseId, id)).filter((t): t is NonNullable<typeof t> => !!t)
  if (!terms.length) return null
  const t = terms.find((x) => x.id === open)
  return (
    <div className="x2-terms">
      <span className="x2-muted">Palabras de la tarea:</span>
      {terms.map((x) => (
        <button key={x.id} aria-expanded={open === x.id} onClick={() => setOpen(open === x.id ? null : x.id)}>
          {x.term}
        </button>
      ))}
      {t && (
        <p className="x2-gl-def">
          <b>{t.term}</b>: {t.plain} <i>Ejemplo: {t.example}</i>
        </p>
      )}
    </div>
  )
}

const glossary = (courseId: string, id: string) => findCourse(courseId)?.glossary.find((g) => g.id === id)

export function GradeView({ grade }: { grade: RubricGrade }) {
  return (
    <div className="x2-grade">
      <p className="x2-score">
        <b>{grade.score}</b> de 100
      </p>
      <ul className="x2-rubric">
        {grade.criteria.map((c) => (
          <li key={c.criterion} className={`lv-${c.level}`}>
            <b>{c.criterion}</b> <span>{c.level === 'bien' ? 'Bien' : c.level === 'parcial' ? 'A medias' : 'Falta'}</span>
            {c.evidence && <p className="x2-muted">{c.evidence}</p>}
          </li>
        ))}
      </ul>
      {grade.strengths.length > 0 && (
        <>
          <h4>Lo que hiciste bien</h4>
          <ul>
            {grade.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
      {grade.improve.length > 0 && (
        <>
          <h4>Qué mejorar</h4>
          <ul>
            {grade.improve.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}
      {grade.nextStep && <p><b>Siguiente paso:</b> {grade.nextStep}</p>}
    </div>
  )
}
