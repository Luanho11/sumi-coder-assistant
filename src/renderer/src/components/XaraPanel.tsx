import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { CopilotAction, QuickInput, Session, SessionSummary, SettingsView, Turn } from '../../../core/types'
import { stripHiddenComments } from '../../../core/topics'
import { useVoice } from '../useVoice'
import { cleanIpcError } from '../util'
import { Composer } from './Composer'
import { Icon } from './Icon'
import { TurnView } from './TurnView'
import './XaraPanel.css'

export interface XaraHandle {
  ask: (action: CopilotAction, text: string) => Promise<void>
  prefill: (q: QuickInput) => void
}

interface Props {
  settings: SettingsView
  onClose: () => void
  onOpenSettings: () => void
  onOpenProfile: () => void
}

interface Live {
  requestId: string
  sessionId: string
  turn: Turn
}

export const XaraPanel = forwardRef<XaraHandle, Props>(function XaraPanel({ settings, onClose, onOpenSettings, onOpenProfile }, ref) {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [current, setCurrent] = useState<Session | null>(null)
  const [live, setLive] = useState<Live | null>(null)
  const [input, setInput] = useState('')
  const [attachment, setAttachment] = useState<QuickInput | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showList, setShowList] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const turnsRef = useRef<HTMLDivElement>(null)
  const liveRef = useRef<Live | null>(null)
  const spokenRef = useRef<string | null>(null)
  liveRef.current = live
  // XARA gestiona su propia voz: lee en voz alta sus respuestas y transcribe lo que dictas al campo de texto.
  const voice = useVoice(settings.voice, (text) => {
    setInput(text)
    inputRef.current?.focus()
  })

  const refreshSessions = useCallback(async () => setSessions(await window.copilot.listSessions()), [])

  useEffect(() => {
    void (async () => {
      const list = await window.copilot.listSessions()
      setSessions(list)
      if (list[0]) setCurrent((await window.copilot.getSession(list[0].id)) ?? null)
    })()
  }, [])

  useEffect(
    () =>
      window.copilot.onRunEvent((ev) => {
        const l = liveRef.current
        if (!l || ev.requestId !== l.requestId) return
        if (ev.type === 'started') setLive({ ...l, turn: ev.turn })
        else if (ev.type === 'delta') setLive((prev) => (prev ? { ...prev, turn: { ...prev.turn, output: prev.turn.output + ev.text } } : prev))
        else if (ev.type === 'finished') {
          liveRef.current = null
          setLive(null)
          void window.copilot.getSession(l.sessionId).then((s) => {
            setCurrent((cur) => (cur && s && cur.id === s.id ? s : cur))
            // Lee en voz alta la respuesta recién terminada si está activada la lectura automática.
            const last = s?.turns.at(-1)
            if (settings.voice.autoRead && last && last.status === 'done' && last.id !== spokenRef.current) {
              spokenRef.current = last.id
              void voice.speak(stripHiddenComments(last.output))
            }
          })
          void refreshSessions()
        } else if (ev.type === 'failed') {
          liveRef.current = null
          setLive(null)
          setNotice(ev.message)
        }
      }),
    [refreshSessions, settings.voice.autoRead, voice]
  )

  useEffect(() => {
    turnsRef.current?.querySelector('article.turn:last-of-type')?.scrollIntoView({ block: 'start' })
  }, [current?.id, current?.turns.length, live?.requestId])

  const send = useCallback(
    async (action: CopilotAction, text: string, clearInput = true, target?: Session) => {
      if (live) return
      setNotice(null)
      let session = target ?? current
      if (!session) {
        session = await window.copilot.createSession()
        setCurrent(session)
      }
      const requestId = crypto.randomUUID()
      const placeholder: Turn = {
        id: 'pending',
        action,
        input: text,
        output: '',
        status: 'streaming',
        providerId: settings.providerId,
        model: settings.models[settings.providerId],
        createdAt: new Date().toISOString(),
        hadImage: !!attachment
      }
      const next = { requestId, sessionId: session.id, turn: placeholder }
      liveRef.current = next
      setLive(next)
      try {
        await window.copilot.run({ requestId, sessionId: session.id, action, input: text, image: attachment?.image })
        setAttachment(null)
        if (clearInput) setInput('')
      } catch (err) {
        liveRef.current = null
        setLive(null)
        setNotice(cleanIpcError(err))
      }
    },
    [live, current, settings, attachment]
  )

  useImperativeHandle(
    ref,
    () => ({
      ask: async (action, text) => {
        if (live) {
          setNotice('Espera a que XARA termine la respuesta en curso.')
          return
        }
        const session = await window.copilot.createSession()
        setCurrent(session)
        await send(action, text, false, session)
        await refreshSessions()
      },
      // Rellena el campo (desde un atajo global: texto o captura) sin enviar todavía.
      prefill: (q) => {
        if (q.text) setInput(q.text)
        if (q.image) setAttachment(q)
        if (!q.text && !q.image) setNotice('El portapapeles está vacío: copia texto o una imagen y vuelve a intentarlo.')
        inputRef.current?.focus()
      }
    }),
    [live, send, refreshSessions]
  )

  const newSession = useCallback(async () => {
    if (current && current.turns.length === 0) {
      inputRef.current?.focus()
      return
    }
    setCurrent(await window.copilot.createSession())
    setInput('')
    await refreshSessions()
    inputRef.current?.focus()
  }, [current, refreshSessions])

  const cancel = useCallback(() => {
    if (live) void window.copilot.cancel(live.requestId)
  }, [live])

  const captureRegion = useCallback(async () => {
    try {
      const q = await window.copilot.captureRegion()
      if (q) setAttachment(q)
    } catch (err) {
      setNotice(cleanIpcError(err))
    }
  }, [])

  const useClipboard = useCallback(async () => {
    const q = await window.copilot.readClipboard()
    if (q.text) setInput(q.text)
    else if (q.image) setAttachment(q)
    else setNotice('El portapapeles está vacío.')
    inputRef.current?.focus()
  }, [])

  const turns = current?.turns ?? []
  const liveHere = live && current && live.sessionId === current.id ? live : null

  return (
    <aside className="xara-panel">
      <header className="xp-head">
        <button className="icon-btn" title="Conversaciones" onClick={() => setShowList((v) => !v)}>
          <Icon name="chat" size={17} />
        </button>
        <b className="xp-title">XARA</b>
        {voice.speaking && (
          <>
            <button className="icon-btn active" title={voice.paused ? 'Reanudar' : 'Pausar'} onClick={voice.togglePause}>
              <Icon name={voice.paused ? 'play' : 'stop'} size={15} />
            </button>
            <button className="icon-btn active" title="Silenciar" onClick={voice.stop}>
              <Icon name="speaker" size={16} />
            </button>
          </>
        )}
        <button className="icon-btn" title="Nueva conversación" onClick={newSession}>
          <Icon name="plus" size={16} />
        </button>
        <button className="icon-btn" title="Lo que XARA sabe de ti" onClick={onOpenProfile}>
          <Icon name="sparkles" size={16} />
        </button>
        <button className="icon-btn" title="Configuración" onClick={onOpenSettings}>
          <Icon name="gear" size={16} />
        </button>
        <button className="icon-btn" title="Cerrar panel" onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </header>

      {showList && (
        <div className="xp-sessions">
          {sessions.length === 0 && <p className="muted-text">Aún no hay conversaciones.</p>}
          {sessions.map((s) => (
            <button
              key={s.id}
              className={current?.id === s.id ? 'on' : ''}
              onClick={async () => {
                setCurrent((await window.copilot.getSession(s.id)) ?? null)
                setShowList(false)
              }}
            >
              {s.title}
            </button>
          ))}
        </div>
      )}

      {notice && (
        <div className="xp-notice" role="alert">
          {notice} <button onClick={() => setNotice(null)}>Cerrar</button>
        </div>
      )}
      {voice.error && <div className="xp-notice">{voice.error}</div>}

      <div className="xp-turns" ref={turnsRef}>
        {turns.length === 0 && !liveHere && (
          <div className="xp-empty">
            <div className="xp-orb" />
            <h3>Hola, soy XARA 👋</h3>
            <p className="muted-text">Pregúntame un concepto, pégame un error o cuéntame en qué andas. Te explico con ejemplos y diagramas, sin rollos.</p>
          </div>
        )}
        {turns.map((t, i) => (
          <TurnView
            key={t.id}
            turn={t}
            defaultOpen={i === turns.length - 1 && !liveHere}
            onRetry={i === turns.length - 1 && !live ? () => send(t.action, t.input, false) : undefined}
            onSpeak={() => voice.speak(stripHiddenComments(t.output))}
          />
        ))}
        {liveHere && <TurnView turn={liveHere.turn} defaultOpen live />}
      </div>

      <Composer
        ref={inputRef}
        value={input}
        onChange={setInput}
        hasTurns={turns.length > 0}
        busy={!!live}
        onSend={send}
        onCancel={cancel}
        attachment={attachment}
        onAttach={setAttachment}
        onCapture={captureRegion}
        onClipboard={useClipboard}
        recording={voice.recording}
        onMic={voice.toggleRecording}
      />
    </aside>
  )
})
