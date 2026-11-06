import { useEffect, useRef, useState } from 'react'
import { findExercise, findTrack, lessonExtra } from '../../../core/academy/catalog'
import type { Exercise } from '../../../core/academy/types'
import type { VoiceSettings } from '../../../core/types'
import type { AcademyView, LinkStatus } from '../../../main/academy'
import { ClassPlayer } from '../components/ClassPlayer'
import { Diagram } from '../components/Diagram'
import { InlineCode } from '../components/Markdown'
import { playCorrect, playWrong } from '../feedback'
import { KIND_LABELS } from '../labels'
import './LessonView.css'

interface Props {
  trackId: string
  lessonId: string
  view: AcademyView
  voiceSettings: VoiceSettings
  onBack: () => void
  onUpdate: (view: AcademyView) => void
  onOpenExercise: (id: string) => void
  onClassWithXara: (material: string) => void
}

export function LessonView({ trackId, lessonId, view, voiceSettings, onBack, onUpdate, onOpenExercise, onClassWithXara }: Props) {
  const track = findTrack(trackId)
  const module = track?.modules.find((m) => m.lessons.some((l) => l.id === lessonId))
  const lesson = module?.lessons.find((l) => l.id === lessonId)
  const extra = lessonExtra(lessonId)
  const [links, setLinks] = useState<Record<string, LinkStatus>>({})
  const [checkPicks, setCheckPicks] = useState<Record<number, number>>({})
  const checkRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (lesson) void window.copilot.checkLinks(lesson.videos.map((v) => v.url)).then(setLinks)
    setCheckPicks({})
  }, [lesson])

  if (!track || !module || !lesson) return null
  const done = view.progress.lessonsDone.includes(lesson.id)
  const material = `Ruta: ${track.title}. Módulo: ${module.title}. Clase: ${lesson.title}.${lesson.objective ? ` Objetivo: ${lesson.objective}` : ''}\n\n${lesson.slides.map((s) => `### ${s.title}\n${s.content}`).join('\n\n')}`
  const exercises = lesson.exerciseIds.map(findExercise).filter((e): e is Exercise => !!e)
  const hasCheck = !!extra && extra.check.length > 0

  return (
    <div className="lesson-view">
      <button className="back" onClick={onBack}>
        ‹ Academia
      </button>
      <ClassPlayer
        key={lesson.id}
        lesson={lesson}
        extra={extra}
        trackId={track.id}
        color={track.color}
        kicker={`${track.title} · ${module.title}`}
        voiceSettings={voiceSettings}
        done={done}
        onComplete={() => void window.copilot.markLessonDone(lesson.id).then(onUpdate)}
        onChallenge={hasCheck ? () => checkRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) : undefined}
      />

      <div className="lesson-head">
        <div>
          <span className="tag" style={{ ['--track' as string]: track.color }}>
            {track.title} · {module.title}
          </span>
          <h2>{lesson.title}</h2>
        </div>
        <div className="lesson-actions">
          {done && <span className="done-chip">✓ Vista</span>}
          <button onClick={() => onClassWithXara(material)}>💬 Pregúntale a XARA</button>
        </div>
      </div>

      {extra?.analogy && (
        <div className="analogy">
          <b>🪄 Para que lo veas claro</b>
          <p>{extra.analogy}</p>
        </div>
      )}

      {extra?.diagram && (
        <section className="lesson-block">
          <h3>Cómo se ve</h3>
          <Diagram code={extra.diagram} />
        </section>
      )}

      {lesson.videos.length > 0 && (
        <section className="lesson-block">
          <h3>Vídeos</h3>
          <ul className="video-list">
            {lesson.videos.map((v) => (
              <li key={v.url}>
                <a href={v.url} target="_blank" rel="noreferrer">
                  ▶ {v.title}
                </a>
                {links[v.url] === 'roto' && <span className="tag bad">No disponible</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {exercises.length > 0 && (
        <section className="lesson-block">
          <h3>Practica</h3>
          <ul className="practice-list">
            {exercises.map((e) => (
              <li key={e.id}>
                <button onClick={() => onOpenExercise(e.id)}>
                  {e.title} <span className="tag">{KIND_LABELS[e.kind]}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {extra && hasCheck && (
        <section className="lesson-block" ref={checkRef}>
          <h3>Comprueba lo que sabes</h3>
          {extra.check.map((q, qi) => {
            const picked = checkPicks[qi]
            return (
              <div key={qi} className="check-q">
                <p>
                  <InlineCode text={q.question} />
                </p>
                <div className="quiz-options">
                  {q.options.map((o, i) => (
                    <button
                      key={o}
                      disabled={picked !== undefined}
                      className={picked === undefined ? '' : i === q.correctIndex ? 'right fb-correct' : i === picked ? 'wrong fb-wrong' : ''}
                      onClick={() => {
                        if (picked !== undefined) return
                        if (i === q.correctIndex) playCorrect()
                        else playWrong()
                        setCheckPicks((p) => ({ ...p, [qi]: i }))
                      }}
                    >
                      <InlineCode text={o} />
                    </button>
                  ))}
                </div>
                {picked !== undefined && (
                  <p className="muted-text">
                    {picked === q.correctIndex ? '✅ ¡Correcto! ' : '❌ No es esa. '}
                    <InlineCode text={q.explanation} />
                  </p>
                )}
              </div>
            )
          })}
        </section>
      )}

      {extra && extra.learned.length > 0 && (
        <section className="learned">
          <h3>🎓 Lo que aprendiste</h3>
          <ul>
            {extra.learned.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
