import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { findCourse, findLessonV2 } from '../../../core/academy/v2/courses'
import { buildLessonPlan, duracionClase, type Duracion } from '../../../core/academy/v2/scenes'
import type { Answer } from '../../../core/academy/v2/grading'
import type { Item, Scene } from '../../../core/academy/v2/types'
import { speakableText } from '../../../core/voice'
import type { VoiceSettings } from '../../../core/types'
import type { AcademyView } from '../../../main/academy'
import { Markdown } from '../components/Markdown'
import { playCorrect, playWrong } from '../feedback'
import { prefetchSpeech, useVoice } from '../useVoice'
import { ItemView, esEjecutable, gradeCode, gradeLocal, isAnswered } from './Items'
import './v2.css'

interface Props {
  lessonId: string
  view: AcademyView
  voiceSettings: VoiceSettings
  /** Abre una parte concreta (desde las pistas de la práctica). */
  startPartId?: string
  onBack: () => void
  onUpdate: (view: AcademyView) => void
  onPractice: () => void
}

const ICONS = {
  play: 'M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  prev: 'M6 5h2v14H6zM19 5.8v12.4a.8.8 0 0 1-1.25.66L9.5 13.2a1.4 1.4 0 0 1 0-2.4l8.25-5.66A.8.8 0 0 1 19 5.8z',
  next: 'M16 5h2v14h-2zM5 5.8v12.4a.8.8 0 0 0 1.25.66l8.25-5.66a1.4 1.4 0 0 0 0-2.4L6.25 5.14A.8.8 0 0 0 5 5.8z',
  expand: 'M4 4h6v2H6v4H4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z'
}
const Icon = ({ name }: { name: keyof typeof ICONS }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
    <path d={ICONS[name]} />
  </svg>
)

const KIND_LABEL: Record<Scene['kind'], string> = {
  hook: 'El caso',
  story: 'Historia',
  concept: 'Idea',
  definition: 'Definición',
  analogy: 'Analogía',
  'worked-example': 'Ejemplo resuelto',
  'faded-example': 'Ahora tú',
  'non-example': 'Lo que no es',
  misconception: 'Error típico',
  compare: 'Comparación',
  'pause-think': 'Pausa y piensa',
  demo: 'Demostración',
  recap: 'Resumen'
}

/** Las etiquetas solo aparecen cuando dicen qué hacer con la escena. */
const LABELED = new Set<Scene['kind']>(['worked-example', 'faded-example', 'misconception', 'non-example', 'pause-think'])

type Phase =
  | { kind: 'ready' }
  | { kind: 'scene' }
  | { kind: 'micro' }
  | { kind: 'checkpoint'; part: number }
  | { kind: 'alt'; part: number; title: string; md: string; narration: string; back: 'scene' | 'checkpoint' }
  | { kind: 'wrap' }

const SEEN_AFTER_MS = 4000
// Si ninguna voz puede sonar, la clase sigue en silencio al ritmo de lectura (unos 1200 caracteres por minuto): nunca se queda congelada.
const SILENT_MS_PER_CHAR = 50
const READ_KEY = 'xara.v2.leerPreguntas'

function readAloudPref(): boolean {
  try {
    return localStorage.getItem(READ_KEY) !== '0'
  } catch {
    return true
  }
}

/** Texto que se dice en voz alta de una pregunta: el enunciado y, si son cortas, las opciones. */
function spokenQuestion(item: Item): string {
  let t = item.prompt.replace(/___/g, 'espacio en blanco')
  if ((item.type === 'mcq' || item.type === 'multi') && item.options?.every((o) => o.text.length <= 110)) t += ' ' + item.options.map((o, i) => `Opción ${String.fromCharCode(65 + i)}: ${o.text}.`).join(' ')
  if (item.type === 'order') t += ' Ordena los pasos en la pantalla.'
  return speakableText(t)
}

export function LessonPlayerV2({ lessonId, view, voiceSettings, startPartId, onBack, onUpdate, onPractice }: Props) {
  const ref = findLessonV2(lessonId)
  const lesson = ref?.lesson
  const plan = useMemo(() => (lesson ? buildLessonPlan(lesson) : null), [lesson])
  const lp = view.progress.v2?.lessons[lessonId]
  const voice = useVoice(voiceSettings, () => {})
  const playerRef = useRef<HTMLDivElement>(null)

  const firstOpenPart = useMemo(() => {
    if (!lesson || !plan) return 0
    const open = lesson.parts.findIndex((p) => !lp?.partsDone.includes(p.id))
    return open === -1 ? 0 : plan.parts[open].first
  }, [lesson, plan, lp?.partsDone])
  const startIndex = useMemo(() => {
    if (!plan) return 0
    const pi = startPartId ? plan.parts.findIndex((p) => p.id === startPartId) : -1
    return pi >= 0 ? plan.parts[pi].first : lp && lp.partsDone.length ? firstOpenPart : 0
  }, [plan, startPartId, lp, firstOpenPart])

  const [phase, setPhase] = useState<Phase>(() => (lp?.readiness || startPartId || (lp && lp.partsDone.length) ? { kind: 'scene' } : { kind: 'ready' }))
  const [index, setIndex] = useState(startIndex)
  const [playing, setPlaying] = useState(false)
  const [silent, setSilent] = useState(false)
  const [captions, setCaptions] = useState(true)
  const [seen, setSeen] = useState<Set<number>>(new Set())
  const [microDone, setMicroDone] = useState<Set<string>>(new Set())
  const [readAloud, setReadAloud] = useState(readAloudPref)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<HTMLElement>(null)
  const [hayMas, setHayMas] = useState(false)

  const scenePlay = plan?.plays[index]
  const partIdx = scenePlay?.partId && plan ? plan.parts.findIndex((p) => p.id === scenePlay.partId) : -1

  const toggleRead = () => {
    const next = !readAloud
    setReadAloud(next)
    try {
      localStorage.setItem(READ_KEY, next ? '1' : '0')
    } catch {
      /* la preferencia simplemente no se recuerda */
    }
  }

  // ───── Navegación ─────
  const goNextScene = () => {
    if (!plan || !scenePlay) return
    const part = plan.parts[partIdx]
    if (part && index === part.last) setPhase({ kind: 'checkpoint', part: partIdx })
    else if (index < plan.plays.length - 1) setIndex(index + 1)
  }
  const advance = () => {
    if (!scenePlay) return
    if (scenePlay.scene.micro && !microDone.has(scenePlay.key)) {
      setPlaying(false)
      setPhase({ kind: 'micro' })
    } else goNextScene()
  }
  const goPrev = () => {
    setPlaying(false)
    if (index > 0) setIndex(index - 1)
  }

  // ───── Reproducción: narra la escena, y al terminar ofrece su mini-ejercicio o pasa a la siguiente ─────
  useEffect(() => {
    if (phase.kind !== 'scene' || !playing || !scenePlay) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = () => {
      setSeen((s) => new Set(s).add(index))
      advance()
    }
    void voice.speak(scenePlay.scene.narration).then((r) => {
      if (cancelled) return
      if (r === 'detenida') return setPlaying(false)
      if (r === 'terminada') return finish()
      setSilent(true)
      timer = setTimeout(finish, Math.max(SEEN_AFTER_MS, speakableText(scenePlay.scene.narration).length * SILENT_MS_PER_CHAR))
    })
    const next = plan?.plays[index + 1]
    if (next && next.partId === scenePlay.partId) prefetchSpeech(voiceSettings.engine, next.scene.narration)
    return () => {
      cancelled = true
      clearTimeout(timer)
      voice.stop()
    }
  }, [phase.kind, playing, index]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase.kind !== 'scene' || playing) return
    const t = setTimeout(() => setSeen((s) => new Set(s).add(index)), SEEN_AFTER_MS)
    return () => clearTimeout(t)
  }, [phase.kind, playing, index])

  // Al salir de la clase o cambiar de pantalla, la voz se calla.
  useEffect(() => () => voice.stop(), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (phase.kind !== 'scene') setPlaying(false)
  }, [phase.kind])

  const revealAll = !playing || silent || seen.has(index)
  const shown = scenePlay ? scenePlay.blocks.filter((_, i) => revealAll || voice.progress >= scenePlay.reveals[i]).length : 0
  useEffect(() => {
    if (playing) bodyRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [shown, playing])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void playerRef.current?.requestFullscreen()
  }
  const medirScroll = () => {
    const el = sceneRef.current
    setHayMas(!!el && el.scrollHeight - el.scrollTop - el.clientHeight > 2)
  }
  const bajar = (direccion: 1 | -1, fraccion = 0.7) => {
    const el = sceneRef.current
    if (el) el.scrollBy({ top: direccion * el.clientHeight * fraccion, behavior: 'smooth' })
  }
  // Se mide al cambiar de escena y cada vez que aparece un bloque nuevo.
  useEffect(() => {
    medirScroll()
    const t = setTimeout(medirScroll, 400)
    return () => clearTimeout(t)
  }, [scenePlay?.key, shown, phase.kind])

  const onKey = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget || phase.kind !== 'scene') return
    if (e.key === ' ') setPlaying((p) => !p)
    else if (e.key === 'ArrowDown' || e.key === 'PageDown') bajar(1, e.key === 'PageDown' ? 0.9 : 0.35)
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') bajar(-1, e.key === 'PageUp' ? 0.9 : 0.35)
    else if (e.key === 'ArrowRight') advance()
    else if (e.key === 'ArrowLeft') goPrev()
    else return
    e.preventDefault()
  }

  if (!ref || !lesson || !plan || !scenePlay) return null
  const color = ref.course.color
  const duracion = duracionClase(lesson)

  // ───── «No entendí»: la IA lo explica de otra forma; sin IA, la escena alternativa de la parte ─────
  const dontGetIt = async () => {
    if (partIdx < 0) return
    setPlaying(false)
    voice.stop()
    setBusy(true)
    setNotice(null)
    const part = lesson.parts[partIdx]
    const sceneInPart = index - plan.parts[partIdx].first
    try {
      const text = await window.copilot.v2.reexplain(lesson.id, part.id, sceneInPart)
      if (text) setPhase({ kind: 'alt', part: partIdx, title: 'Otra forma de verlo', md: text, narration: text, back: 'scene' })
      else setPhase({ kind: 'alt', part: partIdx, title: part.reteach.title, md: part.reteach.content, narration: part.reteach.narration, back: 'scene' })
    } catch {
      setPhase({ kind: 'alt', part: partIdx, title: part.reteach.title, md: part.reteach.content, narration: part.reteach.narration, back: 'scene' })
    } finally {
      setBusy(false)
    }
  }

  const partTitle = partIdx >= 0 ? plan.parts[partIdx].title : 'Para empezar'

  // ───── Pantallas ─────
  let body: React.ReactNode
  if (phase.kind === 'ready') {
    body = (
      <Ready
        lessonId={lessonId}
        duracion={duracion}
        onStart={(results) => {
          void window.copilot.v2.readiness(lessonId, results).then(onUpdate)
          setPhase({ kind: 'scene' })
        }}
        voice={{ speak: voice.speak, stop: voice.stop }}
        readAloud={readAloud}
      />
    )
  } else if (phase.kind === 'wrap') {
    body = <Wrap lessonId={lessonId} view={view} onPractice={onPractice} onReplay={() => { setIndex(0); setPhase({ kind: 'scene' }) }} />
  } else {
    body = (
      <div className="x2-player" ref={playerRef} tabIndex={0} onKeyDown={onKey} style={{ ['--track' as string]: color }}>
        <div className={`x2-stage ${phase.kind !== 'scene' ? 'panel' : ''}`}>
          {phase.kind === 'scene' && (
            <article className={`x2-scene kind-${scenePlay.scene.kind}`} key={scenePlay.key} ref={sceneRef} onScroll={medirScroll}>
              {scenePlay.scene.kind === 'story' || scenePlay.scene.kind === 'hook' ? (
                <>
                  <div className="story-top">
                    <span>{scenePlay.scene.dateline}</span>
                    <span className={scenePlay.scene.imagined ? 'story-imagined' : ''}>{scenePlay.scene.imagined ? 'Imaginemos' : `Fuente: ${scenePlay.scene.source ?? ''}`}</span>
                  </div>
                  <p className="story-stamp" style={{ fontSize: `${Math.min(scenePlay.scene.kind === 'hook' ? 13 : 19, 78 / ((scenePlay.scene.stamp ?? '').length * 0.6 + 0.2))}cqw` }}>
                    {scenePlay.scene.stamp}
                  </p>
                  <div className="story-copy">
                    <h3>{scenePlay.scene.title}</h3>
                    <div className="x2-body" ref={bodyRef}>
                      {scenePlay.blocks.slice(0, shown).map((b, i) => (
                        <div key={i} className="x2-block">
                          <Markdown text={b} />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <header>
                    {LABELED.has(scenePlay.scene.kind) && <span className="x2-kind">{KIND_LABEL[scenePlay.scene.kind]}</span>}
                    <h3 className={scenePlay.scene.kind === 'misconception' && scenePlay.scene.title.startsWith('«') ? 'struck' : undefined}>{scenePlay.scene.title}</h3>
                  </header>
                  <div className="x2-body" ref={bodyRef}>
                    {scenePlay.blocks.slice(0, shown).map((b, i) => (
                      <div key={i} className="x2-block">
                        <Markdown text={b} variant={scenePlay.scene.kind === 'definition' ? 'definition' : undefined} />
                      </div>
                    ))}
                  </div>
                </>
              )}
              {scenePlay.scene.kind === 'pause-think' && revealAll && (
                <PauseBox key={scenePlay.key} initial={lp?.pauseAnswers[scenePlay.key] ?? ''} onSave={(t) => void window.copilot.v2.pause(lessonId, scenePlay.key, t).then(onUpdate)} />
              )}
              {(scenePlay.scene.glossaryRefs?.length ?? 0) > 0 && revealAll && <GlossaryChips ids={scenePlay.scene.glossaryRefs ?? []} courseId={ref.course.id} />}
            </article>
          )}
          {phase.kind === 'scene' && hayMas && (
            <button className="x2-more" onClick={() => bajar(1)} aria-label="Bajar en la diapositiva">
              Hay más abajo ↓
            </button>
          )}
          {phase.kind === 'micro' && scenePlay.scene.micro && (
            <MicroPanel
              key={scenePlay.key}
              item={scenePlay.scene.micro}
              readAloud={readAloud}
              voice={voice}
              onDone={() => {
                setMicroDone((s) => new Set(s).add(scenePlay.key))
                setPhase({ kind: 'scene' })
                goNextScene()
              }}
            />
          )}
          {phase.kind === 'checkpoint' && (
            <CheckpointPanel
              key={`cp-${phase.part}`}
              lessonId={lessonId}
              partIndex={phase.part}
              readAloud={readAloud}
              voice={voice}
              onUpdate={onUpdate}
              onReteach={() => {
                const part = lesson.parts[phase.part]
                setPhase({ kind: 'alt', part: phase.part, title: part.reteach.title, md: part.reteach.content, narration: part.reteach.narration, back: 'checkpoint' })
              }}
              onContinue={async () => {
                const part = lesson.parts[phase.part]
                onUpdate(await window.copilot.v2.partDone(lessonId, part.id))
                if (phase.part >= lesson.parts.length - 1) setPhase({ kind: 'wrap' })
                else {
                  setIndex(plan.parts[phase.part + 1].first)
                  setPhase({ kind: 'scene' })
                }
              }}
              onReview={() => {
                setIndex(plan.parts[phase.part].first)
                setPhase({ kind: 'scene' })
              }}
            />
          )}
          {phase.kind === 'alt' && (
            <AltPanel
              key={phase.title + phase.part}
              title={phase.title}
              md={phase.md}
              narration={phase.narration}
              voice={voice}
              onBack={() => setPhase(phase.back === 'checkpoint' ? { kind: 'checkpoint', part: phase.part } : { kind: 'scene' })}
              backLabel={phase.back === 'checkpoint' ? 'Volver a intentarlo' : 'Seguir con la clase'}
            />
          )}

          {phase.kind === 'scene' && captions && playing && voice.speaking && <p className="x2-caption">{captionNow(scenePlay.scene.narration, voice.progress)}</p>}
          {phase.kind === 'scene' && !playing && index === 0 && seen.size <= 1 && (
            <button className="x2-bigplay" onClick={() => setPlaying(true)}>
              <span>
                <Icon name="play" />
              </span>
              Escuchar la clase · ≈ {duracion.clase} min
            </button>
          )}
          {busy && <div className="x2-loading">Preparando otra explicación…</div>}
        </div>

        <div className="x2-controls">
          <button className="x2-ctl" onClick={goPrev} disabled={index === 0 || phase.kind !== 'scene'} title="Escena anterior (←)">
            <Icon name="prev" />
          </button>
          <button className="x2-ctl play" onClick={() => (phase.kind === 'scene' ? (playing ? (silent ? setPlaying(false) : voice.togglePause()) : setPlaying(true)) : undefined)} disabled={phase.kind !== 'scene'} title="Reproducir o pausar (espacio)">
            <Icon name={playing && !voice.paused ? 'pause' : 'play'} />
          </button>
          <button className="x2-ctl" onClick={advance} disabled={phase.kind !== 'scene'} title="Escena siguiente (→)">
            <Icon name="next" />
          </button>
          <ol className="x2-parts" aria-label="Partes de la clase">
            {plan.parts.map((p, i) => {
              const done = lp?.partsDone.includes(p.id)
              const current = i === partIdx || (phase.kind === 'checkpoint' && phase.part === i)
              const pct = i < partIdx || done ? 100 : i === partIdx ? Math.round(((index - p.first + (playing ? voice.progress : 0)) / (p.last - p.first + 1)) * 100) : 0
              return (
                <li key={p.id} className={`${current ? 'now' : ''} ${done ? 'done' : ''}`}>
                  <button title={p.title} onClick={() => { setPlaying(false); setIndex(p.first); setPhase({ kind: 'scene' }) }}>
                    <span style={{ width: `${pct}%` }} />
                  </button>
                </li>
              )
            })}
          </ol>
          <span className="x2-where">{partTitle}</span>
          <button className="x2-ctl text" onClick={dontGetIt} disabled={phase.kind !== 'scene' || partIdx < 0 || busy} title="Pide otra explicación de esta parte">
            No entendí
          </button>
          <button className={`x2-ctl text ${readAloud ? 'on' : ''}`} onClick={toggleRead} aria-pressed={readAloud} title="Leer en voz alta las preguntas y sus explicaciones">
            Preguntas en voz alta
          </button>
          <button className={`x2-ctl text ${captions ? 'on' : ''}`} onClick={() => setCaptions(!captions)} aria-pressed={captions} title="Subtítulos">
            Subtítulos
          </button>
          <button className="x2-ctl" onClick={toggleFullscreen} title="Pantalla completa">
            <Icon name="expand" />
          </button>
        </div>
        {voice.error && <p className="x2-error">{voice.error}</p>}
        {notice && <p className="x2-error">{notice}</p>}
      </div>
    )
  }

  return (
    <div className="x2-lesson">
      <button className="back" onClick={onBack}>
        ‹ {ref.course.title}
      </button>
      <h2 className="x2-title">{lesson.title}</h2>
      {body}
    </div>
  )
}

function captionNow(narration: string, progress: number): string {
  const lines = speakableText(narration)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
  const total = lines.reduce((s, l) => s + l.length, 0)
  let said = 0
  for (const l of lines) {
    said += l.length
    if (said / total >= progress) return l
  }
  return lines[lines.length - 1] ?? ''
}

function PauseBox({ initial, onSave }: { initial: string; onSave: (t: string) => void }) {
  const [t, setT] = useState(initial)
  return <textarea className="x2-textarea x2-pause" rows={3} value={t} placeholder="Escribe aquí tu respuesta; la verás al final de la clase." onChange={(e) => setT(e.target.value)} onBlur={() => t.trim() && onSave(t)} />
}

function GlossaryChips({ ids, courseId }: { ids: string[]; courseId: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const terms = ids.map((id) => glossaryOf(courseId, id)).filter((t): t is NonNullable<typeof t> => !!t)
  if (!terms.length) return null
  const t = terms.find((x) => x.id === open)
  return (
    <div className="x2-glossary">
      <span className="x2-gl-label">Palabras de esta escena</span>
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

function glossaryOf(courseId: string, id: string) {
  return findCourse(courseId)?.glossary.find((g) => g.id === id)
}

// ───────── Preparación ─────────
function Ready({ lessonId, duracion, onStart, voice, readAloud }: { lessonId: string; duracion: Duracion; onStart: (results: boolean[]) => void; voice: { speak: (t: string) => Promise<unknown>; stop: () => void }; readAloud: boolean }) {
  const ref = findLessonV2(lessonId)!
  const lesson = ref.lesson
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [results, setResults] = useState<Record<string, boolean>>({})
  const done = lesson.readiness.every((it) => results[it.id] !== undefined)
  const fails = lesson.readiness.filter((it) => results[it.id] === false).length
  return (
    <section className="x2-ready" style={{ ['--track' as string]: ref.course.color }}>
      <div className="x2-ready-main">
        <h3>Lo que podrás hacer al terminar</h3>
        <ul className="x2-objectives">
          {lesson.objectives.map((o) => (
            <li key={o.id}>{o.text.replace(/^Podrás /, '')}</li>
          ))}
        </ul>
        <p className="x2-muted">
          La clase dura unos {duracion.clase} minutos con sus ejercicios (la voz habla unos {duracion.escucha}); con la práctica y la comprobación final, unos {duracion.total}. No hace falta saber nada previo salvo lo que preguntan estas tres preguntas.
        </p>
      </div>
      <div className="x2-ready-check">
        <h3>Antes de empezar: tres preguntas</h3>
        <p className="x2-muted">No cuentan para tu nota. Sirven para saber si te falta algún punto de partida.</p>
        {lesson.readiness.map((it) => (
          <ItemView
            key={it.id}
            item={it}
            answer={answers[it.id]}
            onChange={(a) => {
              if (results[it.id] !== undefined) return
              setAnswers((s) => ({ ...s, [it.id]: a }))
              const r = gradeLocal(it, a)
              setResults((s) => ({ ...s, [it.id]: r.ok }))
              if (r.ok) playCorrect()
              else playWrong()
              if (readAloud) void voice.speak(speakableText(`${r.ok ? 'Correcto.' : 'Todavía no.'} ${r.why ?? ''} ${r.explanation}`))
            }}
            result={results[it.id] !== undefined ? { ...gradeLocal(it, answers[it.id]) } : undefined}
          />
        ))}
        {done && fails >= 2 && (
          <div className="x2-remedial" role="note">
            <b>Conviene un repaso antes de empezar.</b>
            {lesson.remedial.map((r, i) => (
              <p key={i}>{r.refresher ?? 'Repasa la clase indicada antes de seguir.'}</p>
            ))}
            <p className="x2-muted">Puedes seguir de todas formas: la clase explica todo desde cero.</p>
          </div>
        )}
        <button className="x2-btn primary" disabled={!done} onClick={() => { voice.stop(); onStart(lesson.readiness.map((it) => results[it.id] === true)) }}>
          {done ? 'Empezar la clase' : `Responde las ${lesson.readiness.length} preguntas`}
        </button>
      </div>
    </section>
  )
}

// ───────── Mini-ejercicio justo tras una idea ─────────
function MicroPanel({ item, readAloud, voice, onDone }: { item: Item; readAloud: boolean; voice: ReturnType<typeof useVoice>; onDone: () => void }) {
  const [answer, setAnswer] = useState<Answer | undefined>(undefined)
  const [result, setResult] = useState<ReturnType<typeof gradeLocal> | undefined>(undefined)
  const [codeOk, setCodeOk] = useState(false)
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    if (readAloud) void voice.speak(spokenQuestion(item))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const check = (a: Answer | undefined) => {
    voice.stop()
    const r = esEjecutable(item) ? gradeCode(item, codeOk) : gradeLocal(item, a)
    setResult(r)
    if (r.ok) playCorrect()
    else playWrong()
    if (readAloud) void voice.speak(speakableText(`${r.ok ? 'Correcto.' : 'Todavía no.'} ${r.why ?? ''} ${r.explanation}`))
  }
  return (
    <section className="x2-micro">
      <span className="x2-kind">Practícalo ahora</span>
      <ItemView
        item={item}
        answer={answer}
        result={result}
        onCodeResult={setCodeOk}
        onChange={(a) => {
          setAnswer(a)
          if (esEjecutable(item)) setCodeOk(false)
          if (item.type === 'mcq' && !result) check(a)
        }}
      />
      <div className="x2-row">
        {!result && item.type !== 'mcq' && (
          <button className="x2-btn primary" disabled={!isAnswered(item, answer)} onClick={() => check(answer)}>
            Comprobar
          </button>
        )}
        {!result && readAloud && (
          <button className="x2-btn" onClick={() => void voice.speak(spokenQuestion(item))}>
            Volver a oír la pregunta
          </button>
        )}
        {result && (
          <button className="x2-btn primary" autoFocus onClick={() => { voice.stop(); onDone() }}>
            Seguir con la clase
          </button>
        )}
      </div>
    </section>
  )
}

// ───────── Comprobación de fin de parte ─────────
function CheckpointPanel({ lessonId, partIndex, readAloud, voice, onUpdate, onReteach, onContinue, onReview }: { lessonId: string; partIndex: number; readAloud: boolean; voice: ReturnType<typeof useVoice>; onUpdate: (v: AcademyView) => void; onReteach: () => void; onContinue: () => void; onReview: () => void }) {
  const ref = findLessonV2(lessonId)!
  const part = ref.lesson.parts[partIndex]
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [results, setResults] = useState<Record<string, ReturnType<typeof gradeLocal>>>({})
  const [codeOk, setCodeOk] = useState<Record<string, boolean>>({})
  const [reteach, setReteach] = useState(false)
  const [saved, setSaved] = useState(false)
  const all = part.checkpoint.every((it) => results[it.id])
  const okAll = all && part.checkpoint.every((it) => results[it.id].ok)

  useEffect(() => {
    if (!all || saved) return
    setSaved(true)
    void window.copilot.v2.checkpoint(lessonId, part.id, part.checkpoint.map((it) => results[it.id].ok)).then((r) => {
      onUpdate(r.view)
      setReteach(r.reteach)
    })
  }, [all]) // eslint-disable-line react-hooks/exhaustive-deps

  const check = (it: Item, a: Answer | undefined) => {
    const r = esEjecutable(it) ? gradeCode(it, codeOk[it.id] === true) : gradeLocal(it, a)
    setResults((s) => ({ ...s, [it.id]: r }))
    if (r.ok) playCorrect()
    else playWrong()
    if (readAloud) void voice.speak(speakableText(`${r.ok ? 'Correcto.' : 'Todavía no.'} ${r.why ?? ''} ${r.explanation}`))
  }

  return (
    <section className="x2-checkpoint">
      <h3>Comprueba la parte «{part.title}»</h3>
      <p className="x2-muted">Responde con lo que acabas de escuchar. Si algo falla, lo explicamos de otra forma.</p>
      {part.checkpoint.map((it) => (
        <div key={it.id}>
          <ItemView item={it} answer={answers[it.id]} result={results[it.id]} onCodeResult={(ok) => setCodeOk((s) => ({ ...s, [it.id]: ok }))} onChange={(a) => { setAnswers((s) => ({ ...s, [it.id]: a })); if (esEjecutable(it)) setCodeOk((s) => ({ ...s, [it.id]: false })); if (it.type === 'mcq' && !results[it.id]) check(it, a) }} />
          {!results[it.id] && it.type !== 'mcq' && (
            <button className="x2-btn" disabled={!isAnswered(it, answers[it.id])} onClick={() => check(it, answers[it.id])}>
              Comprobar
            </button>
          )}
        </div>
      ))}
      {all && (
        <div className="x2-row">
          {okAll ? (
            <button className="x2-btn primary" autoFocus onClick={() => { voice.stop(); onContinue() }}>
              {partIndex >= ref.lesson.parts.length - 1 ? 'Terminar la clase' : 'Siguiente parte'}
            </button>
          ) : (
            <>
              <button className="x2-btn primary" onClick={() => { voice.stop(); onReteach() }}>
                {reteach ? 'Ver otra explicación' : 'Escuchar otra explicación'}
              </button>
              <button className="x2-btn" onClick={() => { voice.stop(); onReview() }}>
                Repetir la parte
              </button>
              <button className="x2-btn" onClick={() => { voice.stop(); onContinue() }}>
                Seguir de todas formas
              </button>
            </>
          )}
        </div>
      )}
    </section>
  )
}

function AltPanel({ title, md, narration, voice, onBack, backLabel }: { title: string; md: string; narration: string; voice: ReturnType<typeof useVoice>; onBack: () => void; backLabel: string }) {
  useEffect(() => {
    void voice.speak(narration)
    return () => voice.stop()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="x2-alt">
      <span className="x2-kind">Otra forma de verlo</span>
      <h3>{title}</h3>
      <Markdown text={md} />
      <div className="x2-row">
        <button className="x2-btn" onClick={() => void voice.speak(narration)}>
          Volver a oír
        </button>
        <button className="x2-btn primary" onClick={() => { voice.stop(); onBack() }}>
          {backLabel}
        </button>
      </div>
    </section>
  )
}

// ───────── Cierre ─────────
function Wrap({ lessonId, view, onPractice, onReplay }: { lessonId: string; view: AcademyView; onPractice: () => void; onReplay: () => void }) {
  const ref = findLessonV2(lessonId)!
  const w = ref.lesson.wrapup
  const lp = view.progress.v2?.lessons[lessonId]
  const pause = Object.values(lp?.pauseAnswers ?? {})
  const download = () => {
    const blob = new Blob([`# ${ref.lesson.title}\n\n${w.cheatSheet}\n`], { type: 'text/markdown' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${ref.lesson.id}-hoja-de-referencia.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <section className="x2-wrap" style={{ ['--track' as string]: ref.course.color }}>
      <h3>Clase escuchada</h3>
      <p className="x2-muted">Ahora toca practicar: tres escalones, del más guiado al más libre. Después, la comprobación final de la clase.</p>
      <div className="x2-wrap-grid">
        <div>
          <h4>Lo que te llevas</h4>
          <ul>
            {w.keyIdeas.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
          <h4>Errores comunes y cómo evitarlos</h4>
          <ul className="x2-mistakes">
            {w.commonMistakes.map((m) => (
              <li key={m.mistake}>
                <b>{m.mistake}.</b> {m.fix}
              </li>
            ))}
          </ul>
        </div>
        <details className="x2-cheat">
          <summary>Hoja de referencia (opcional)</summary>
          <Markdown text={w.cheatSheet} />
          <button className="x2-btn" onClick={download}>
            Descargar en Markdown
          </button>
        </details>
      </div>
      {pause.length > 0 && <p className="x2-muted">Tu respuesta a «Pausa y piensa»: «{pause[0]}»</p>}
      <div className="x2-row">
        <button className="x2-btn primary" onClick={onPractice}>
          Ir a la práctica
        </button>
        <button className="x2-btn" onClick={onReplay}>
          Volver a escuchar la clase
        </button>
      </div>
    </section>
  )
}
