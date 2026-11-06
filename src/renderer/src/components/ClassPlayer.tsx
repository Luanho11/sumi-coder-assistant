import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { XP } from '../../../core/academy/gamification'
import { buildScenes, captionAt, captionLines, estimateMinutes } from '../../../core/academy/scenes'
import type { Lesson, LessonExtra } from '../../../core/academy/types'
import type { VoiceSettings } from '../../../core/types'
import { speakableText } from '../../../core/voice'
import { prefetchSpeech, useVoice } from '../useVoice'
import { Markdown } from './Markdown'
import { TrackCover } from './TrackCover'
import './ClassPlayer.css'

interface Props {
  lesson: Lesson
  extra?: LessonExtra
  trackId: string
  color: string
  kicker: string
  voiceSettings: VoiceSettings
  done: boolean
  /** Se llama una vez que todas las escenas se han visto: la clase se marca sola como vista. */
  onComplete: () => void
  onChallenge?: () => void
}

// Iconos dibujados (no emojis): en Windows los emojis de reproductor salen como pegatinas de colores.
const ICONS = {
  play: 'M8 5.5v13a1 1 0 0 0 1.5.86l11-6.5a1 1 0 0 0 0-1.72l-11-6.5A1 1 0 0 0 8 5.5z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  prev: 'M6 5h2v14H6zM19 5.8v12.4a.8.8 0 0 1-1.25.66L9.5 13.2a1.4 1.4 0 0 1 0-2.4l8.25-5.66A.8.8 0 0 1 19 5.8z',
  next: 'M16 5h2v14h-2zM5 5.8v12.4a.8.8 0 0 0 1.25.66l8.25-5.66a1.4 1.4 0 0 0 0-2.4L6.25 5.14A.8.8 0 0 0 5 5.8z',
  expand: 'M4 4h6v2H6v4H4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z'
}

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d={ICONS[name]} />
    </svg>
  )
}

// Una escena se da por vista cuando XARA termina de narrarla o cuando estuvo en pantalla este tiempo.
const SEEN_AFTER_MS = 4000
// Lectura en silencio, algo más rápida que la voz (unos 1200 caracteres por minuto).
const SILENT_MS_PER_CHAR = 50

/** La clase como un vídeo: escenas a pantalla completa narradas por XARA, con subtítulos y controles de reproductor. */
export function ClassPlayer({ lesson, extra, trackId, color, kicker, voiceSettings, done, onComplete, onChallenge }: Props) {
  const scenes = useMemo(() => buildScenes(lesson, extra), [lesson, extra])
  const voice = useVoice(voiceSettings, () => {})
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [captions, setCaptions] = useState(true)
  const [seen, setSeen] = useState<Set<number>>(new Set())
  const [silent, setSilent] = useState(false)
  const [firstTime] = useState(!done)
  const playerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const scene = scenes[index]
  const last = scenes.length - 1
  const lines = useMemo(() => captionLines(scene.narration), [scene])
  const complete = seen.size === scenes.length
  const atEnd = !playing && index === last && seen.has(last)

  const markSeen = (i: number) => setSeen((prev) => (prev.has(i) ? prev : new Set(prev).add(i)))

  useEffect(() => prefetchSpeech(voiceSettings.engine, scenes[0].narration), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reproducción: narra la escena actual, pide ya el audio de la siguiente y avanza sola al terminar.
  useEffect(() => {
    if (!playing) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const advance = () => {
      markSeen(index)
      if (index < last) setIndex(index + 1)
      else setPlaying(false)
    }
    void voice.speak(scene.narration).then((r) => {
      if (cancelled) return
      if (r === 'detenida') return setPlaying(false)
      if (r === 'terminada') return advance()
      // Si ninguna voz puede sonar, la clase sigue en silencio al ritmo de lectura: nunca se queda congelada.
      setSilent(true)
      timer = setTimeout(advance, Math.max(SEEN_AFTER_MS, speakableText(scene.narration).length * SILENT_MS_PER_CHAR))
    })
    if (index < last) prefetchSpeech(voiceSettings.engine, scenes[index + 1].narration)
    return () => {
      cancelled = true
      clearTimeout(timer)
      voice.stop()
    }
  }, [playing, index]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (playing) return
    const t = setTimeout(() => markSeen(index), SEEN_AFTER_MS)
    return () => clearTimeout(t)
  }, [playing, index])

  useEffect(() => {
    if (complete && !done) onComplete()
  }, [complete]) // eslint-disable-line react-hooks/exhaustive-deps

  const revealAll = !playing || silent || seen.has(index)
  const shown = scene.blocks.filter((_, i) => revealAll || voice.progress >= scene.reveals[i]).length

  // El bloque que acaba de aparecer se desliza a la vista si la escena es más alta que la pantalla.
  useEffect(() => {
    if (playing) bodyRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [shown, playing])

  const goTo = (i: number) => setIndex(Math.max(0, Math.min(last, i)))

  const togglePlay = () => {
    if (atEnd) {
      setIndex(0)
      setPlaying(true)
    } else if (!playing) setPlaying(true)
    else if (silent) setPlaying(false)
    else voice.togglePause()
  }

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void playerRef.current?.requestFullscreen()
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === ' ') togglePlay()
    else if (e.key === 'ArrowRight') goTo(index + 1)
    else if (e.key === 'ArrowLeft') goTo(index - 1)
    else return
    e.preventDefault()
  }

  const loading = playing && !silent && !voice.speaking && !voice.paused
  const firstUnseen = scenes.findIndex((_, i) => !seen.has(i))

  return (
    <div className="class-player" ref={playerRef} tabIndex={0} onKeyDown={onKey} style={{ ['--track' as string]: color }}>
      <div className="player-stage">
        <div className={`scene scene-${scene.kind}`} key={index} data-emoji={extra?.emoji ?? ''}>
          {scene.kind === 'intro' ? (
            <>
              <TrackCover trackId={trackId} color={color} />
              <span className="scene-kicker">{kicker}</span>
              <h2>
                {extra?.emoji ? `${extra.emoji} ` : ''}
                {lesson.title}
              </h2>
              {(extra?.summary || lesson.objective) && <p className="scene-lead">{extra?.summary || lesson.objective}</p>}
            </>
          ) : (
            <>
              <h3>{scene.title}</h3>
              <div className="scene-body" ref={bodyRef}>
                {scene.blocks.slice(0, shown).map((b, i) => (
                  <div key={i} className="scene-block">
                    <Markdown text={b} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className={`player-voice ${voice.speaking && !voice.paused ? 'on' : ''}`} aria-hidden>
          <i />
          <i />
          <i />
          XARA
        </div>

        {loading && <div className="player-loading">Preparando la voz…</div>}

        {captions && playing && voice.speaking && <p className="player-caption">{captionAt(lines, voice.progress)}</p>}

        {!playing && index === 0 && !seen.has(last) && (
          <button className="player-big-play" onClick={togglePlay}>
            <span>
              <Icon name="play" />
            </span>
            Ver la clase · ≈ {estimateMinutes(scenes)} min
          </button>
        )}

        {atEnd && (
          <div className="player-end">
            {complete ? (
              <>
                <b className="end-title">✓ Clase completada</b>
                {firstTime && <span className="end-xp">+{XP.lesson} XP</span>}
              </>
            ) : (
              <>
                <b className="end-title">Te saltaste algunas escenas</b>
                <span>Mírala completa y se marcará sola como vista.</span>
              </>
            )}
            <div className="end-actions">
              {!complete && (
                <button className="primary" onClick={() => goTo(firstUnseen)}>
                  Ver lo que falta
                </button>
              )}
              {complete && onChallenge && (
                <button className="primary" onClick={onChallenge}>
                  Ponte a prueba ↓
                </button>
              )}
              <button onClick={togglePlay}>↻ Volver a ver</button>
            </div>
          </div>
        )}
      </div>

      <div className="player-controls">
        <button className="ctl" onClick={() => goTo(index - 1)} disabled={index === 0} title="Escena anterior (←)">
          <Icon name="prev" />
        </button>
        <button className="ctl play" onClick={togglePlay} title="Reproducir o pausar (espacio)">
          <Icon name={playing && !voice.paused ? 'pause' : 'play'} />
        </button>
        <button className="ctl" onClick={() => goTo(index + 1)} disabled={index === last} title="Escena siguiente (→)">
          <Icon name="next" />
        </button>
        <div className="player-timeline">
          {scenes.map((s, i) => (
            <button key={i} className={seen.has(i) ? 'seen' : ''} title={s.title} onClick={() => goTo(i)}>
              <span style={{ width: `${i < index || (i === index && atEnd) ? 100 : i === index && playing ? voice.progress * 100 : 0}%` }} />
            </button>
          ))}
        </div>
        <span className="player-count">
          {index + 1} / {scenes.length}
        </span>
        <button className={`ctl cc ${captions ? 'on' : ''}`} onClick={() => setCaptions(!captions)} title="Subtítulos">
          CC
        </button>
        <button className="ctl" onClick={toggleFullscreen} title="Pantalla completa">
          <Icon name="expand" />
        </button>
      </div>
      {voice.error && <p className="player-error">{voice.error}</p>}
    </div>
  )
}
