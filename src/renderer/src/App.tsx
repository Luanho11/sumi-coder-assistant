import { useCallback, useEffect, useRef, useState } from 'react'
import { findExercise } from '../../core/academy/catalog'
import { allCourses, courseLessons } from '../../core/academy/v2/courses'
import { lessonBlocker } from '../../core/academy/v2/gating'
import { emptyProgressV2 } from '../../core/academy/v2/types'
import { V2Shell } from './v2/V2Shell'
import { pantallaDeClase, type Screen } from './v2/CourseV2'
import type { ProviderInfo } from '../../core/providers'
import type { CopilotAction, Observation, ObserverStatus, ProviderId, SettingsView } from '../../core/types'
import type { AcademyView } from '../../main/academy'
import type { UsageDay } from '../../main/storage'
import { CodeFixDialog } from './components/CodeFixDialog'
import { Icon, type IconName } from './components/Icon'
import { ObserverDialog } from './components/ObserverDialog'
import { Onboarding } from './components/Onboarding'
import { ProfileDialog } from './components/ProfileDialog'
import { SettingsDialog } from './components/SettingsDialog'
import { newUnlocks, UnlockToast } from './components/UnlockToast'
import { XaraLogo } from './components/XaraLogo'
import { XaraPanel, type XaraHandle } from './components/XaraPanel'
import { playFinish } from './feedback'
import { Achievements } from './views/Achievements'
import { Academy } from './views/Academy'
import { CapstoneView } from './views/CapstoneView'
import { ExamView } from './views/ExamView'
import { ExerciseView } from './views/ExerciseView'
import { Home } from './views/Home'
import { Interview } from './views/Interview'
import { LessonView } from './views/LessonView'
import { LevelView, levelSummary } from './views/LevelView'
import { PlacementView } from './views/PlacementView'
import { Sandbox } from './views/Sandbox'
import './App.css'

type View = 'hoy' | 'academia' | 'entorno' | 'entrevista' | 'nivel' | 'logros'

// Una pantalla a pantalla completa que tapa la vista actual (clase, examen, proyecto, ejercicio, examen de nivel).
type Overlay =
  | { kind: 'lesson'; trackId: string; lessonId: string }
  | { kind: 'exam'; trackId: string; moduleId: string }
  | { kind: 'capstone'; trackId: string }
  | { kind: 'exercise'; id: string }
  | { kind: 'placement' }
  | { kind: 'v2'; courseId: string; screen?: Screen }
  | null

const NAV: { id: View; label: string; icon: IconName }[] = [
  { id: 'hoy', label: 'Hoy', icon: 'home' },
  { id: 'academia', label: 'Academia', icon: 'book' },
  { id: 'entorno', label: 'Entorno', icon: 'terminal' },
  { id: 'entrevista', label: 'Entrevista', icon: 'mic' },
  { id: 'nivel', label: 'Mi nivel', icon: 'brain' },
  { id: 'logros', label: 'Logros', icon: 'trophy' }
]

const FIRST_NAME = 'LM'

export function App() {
  const [settings, setSettings] = useState<SettingsView | null>(null)
  const [providers, setProviders] = useState<Record<ProviderId, ProviderInfo> | null>(null)
  const [academy, setAcademy] = useState<AcademyView | null>(null)
  const academyRef = useRef<AcademyView | null>(null)
  const [unlocked, setUnlocked] = useState<string[] | null>(null)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('xara.tema') ?? ''
    } catch {
      return ''
    }
  })
  const [view, setView] = useState<View>('hoy')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [challengeId, setChallengeId] = useState<string | undefined>(undefined)
  const [interviewAuto, setInterviewAuto] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showCodeFix, setShowCodeFix] = useState(false)
  const [showObserver, setShowObserver] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return localStorage.getItem('xara.onboarded') !== '1'
    } catch {
      return true
    }
  })
  const [observerStatus, setObserverStatus] = useState<ObserverStatus | null>(null)
  const [usage, setUsage] = useState<UsageDay | null>(null)
  const [observations, setObservations] = useState<Observation[]>([])
  const [latestObservation, setLatestObservation] = useState<Observation | null>(null)
  const xaraRef = useRef<XaraHandle>(null)

  useEffect(() => {
    void (async () => {
      const [s, p, obs, acad, use] = await Promise.all([
        window.copilot.getSettings(),
        window.copilot.providersInfo(),
        window.copilot.observerStatus(),
        window.copilot.getAcademy(),
        window.copilot.getUsage()
      ])
      setObserverStatus(obs)
      academyRef.current = acad
      setAcademy(acad)
      setUsage(use)
      setSettings(s)
      setProviders(p)
      const needsKey = p[s.providerId].requiresKey && !s.secrets[s.providerId].configured
      if (needsKey) setShowSettings(true)
    })()
  }, [])

  useEffect(() => {
    const offs = [
      window.copilot.onObserverStatus(setObserverStatus),
      window.copilot.onUsage(setUsage),
      window.copilot.onObservation((o) => {
        setObservations((prev) => [o, ...prev].slice(0, 20))
        setLatestObservation(o)
      }),
      window.copilot.onQuickInput((q) => {
        setPanelOpen(true)
        xaraRef.current?.prefill(q)
      })
    ]
    return () => offs.forEach((off) => off())
  }, [])

  // Todo cambio de progreso pasa por aquí para avisar al momento de lo que se acaba de desbloquear.
  const applyAcademy = useCallback((next: AcademyView) => {
    const prev = academyRef.current
    academyRef.current = next
    setAcademy(next)
    const won = prev ? newUnlocks(prev, next) : []
    if (won.length) {
      setUnlocked(won)
      playFinish()
    }
  }, [])
  const closeUnlocked = useCallback(() => setUnlocked(null), [])

  // El tema elegido solo se aplica si su rango ya está desbloqueado; el azul inicial deja los colores del CSS (claro y oscuro).
  useEffect(() => {
    const unlock = academy?.unlocks.find((u) => u.theme === theme && u.unlocked && u.atLevel > 1)
    const root = document.documentElement.style
    if (unlock) root.setProperty('--accent', unlock.accent)
    else root.removeProperty('--accent')
  }, [academy, theme])

  const chooseTheme = (t: string) => {
    setTheme(t)
    try {
      localStorage.setItem('xara.tema', t)
    } catch {
      /* el tema se aplica igual en esta sesión */
    }
  }

  /** Abre el panel y le pasa una consulta a XARA (dudas, clase, orientación, retos, proyectos). */
  const askXara = useCallback((action: CopilotAction, text: string) => {
    setPanelOpen(true)
    void xaraRef.current?.ask(action, text)
  }, [])

  const exploreObservation = useCallback(
    (o: Observation) => {
      setShowObserver(false)
      setLatestObservation(null)
      askXara('analyze', `El observador vio esto en mi pantalla: "${o.title}: ${o.tip}". Ayúdame a entenderlo como tutor.`)
    },
    [askXara]
  )

  /** Abre una clase: si la ruta tiene curso v2, entra por su mapa (respetando las compuertas); si no, por la clase antigua. */
  const openLesson = useCallback((trackId: string, lessonId: string) => {
    const a = academyRef.current
    const course = allCourses.find((c) => c.id === trackId)
    if (!course) return setOverlay({ kind: 'lesson', trackId, lessonId })
    const lessonRef = courseLessons(course).find((r) => r.lesson.id === lessonId)
    const blocked = !!lessonRef && lessonBlocker(course, lessonId, a?.progress.v2 ?? emptyProgressV2(), { unlockAll: a?.unlockAll })
    setOverlay({ kind: 'v2', courseId: course.id, ...(lessonRef && !blocked ? { screen: pantallaDeClase(lessonRef.lesson, a?.progress.v2?.lessons[lessonId]) } : {}) })
  }, [])

  const openChallenge = useCallback((id: string) => {
    setChallengeId(id)
    setOverlay(null)
    setView('entorno')
  }, [])

  const startInterview = useCallback(() => {
    setInterviewAuto(true)
    setOverlay(null)
    setView('entrevista')
  }, [])

  const toggleOnTop = useCallback(async () => {
    if (settings) setSettings(await window.copilot.updateSettings({ alwaysOnTop: !settings.alwaysOnTop }))
  }, [settings])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setPanelOpen((v) => !v)
      } else if (mod && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        setShowProfile(true)
      } else if (mod && !e.shiftKey && !e.altKey && e.key >= '1' && e.key <= '6') {
        e.preventDefault()
        setOverlay(null)
        setView(NAV[Number(e.key) - 1].id)
      } else if (mod && e.key === ',') {
        e.preventDefault()
        setShowSettings(true)
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        void toggleOnTop()
      } else if (e.key === 'Escape' && overlay) {
        e.preventDefault()
        setOverlay(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleOnTop, overlay])

  if (!settings || !providers || !academy) return <div className="loading">Cargando…</div>

  const provider = providers[settings.providerId]
  const model = settings.models[settings.providerId]
  const missingKey = provider.requiresKey && !settings.secrets[settings.providerId].configured
  const closeOverlay = () => setOverlay(null)
  const closeOnboarding = () => {
    setShowOnboarding(false)
    try {
      localStorage.setItem('xara.onboarded', '1')
    } catch {
      /* el onboarding simplemente volverá a salir: no es crítico */
    }
  }

  return (
    <div className={`app ${panelOpen ? 'panel-open' : ''}`}>
      <nav className="rail" aria-label="Secciones">
        <div className="rail-logo" title="XARA Coder Assistant">
          <XaraLogo size={44} />
        </div>
        {NAV.map((n, i) => (
          <button
            key={n.id}
            className={`rail-btn ${view === n.id && !overlay ? 'on' : ''}`}
            title={`${n.label} (Ctrl+${i + 1})`}
            onClick={() => {
              setOverlay(null)
              setView(n.id)
            }}
          >
            <Icon name={n.icon} size={21} />
            <span>{n.label}</span>
          </button>
        ))}
        <div className="rail-spacer" />
        <button className={`rail-btn ${panelOpen ? 'on' : ''}`} title="Hablar con XARA (Ctrl+J)" onClick={() => setPanelOpen((v) => !v)}>
          <Icon name="chat" size={21} />
          <span>XARA</span>
        </button>
      </nav>

      <main className="workspace">
        <header className="topbar">
          <h1 className="title">{overlay ? '' : NAV.find((n) => n.id === view)?.label}</h1>
          {observerStatus?.active && (
            <button className="observing" title="El observador está analizando tu pantalla" onClick={() => setShowObserver(true)}>
              ● Observando
            </button>
          )}
          <button className="model-pill" title="Proveedor y modelo (Ctrl+,)" onClick={() => setShowSettings(true)}>
            {provider.name.split(' ')[0]} · {model || 'sin modelo'}
          </button>
          {settings.providerId === 'gemini' && usage && <UsagePill used={usage.counts.gemini} />}
          <button className={`icon-btn ${observerStatus?.active ? 'active' : ''}`} title="Modo observador" onClick={() => setShowObserver(true)}>
            <Icon name="eye" />
          </button>
          <button className={`icon-btn ${settings.codeFix ? 'active' : ''}`} title="Revisar o corregir un archivo (con tu permiso)" onClick={() => setShowCodeFix(true)}>
            <Icon name="wrench" />
          </button>
          <button className={`icon-btn ${settings.alwaysOnTop ? 'active' : ''}`} title="Mantener ventana encima (Ctrl+Shift+T)" onClick={toggleOnTop}>
            <Icon name="pin" />
          </button>
          <button className="icon-btn" title="Lo que XARA sabe de ti (Ctrl+M)" onClick={() => setShowProfile(true)}>
            <Icon name="sparkles" />
          </button>
          <button className="icon-btn" title="Cómo empezar (guía)" onClick={() => setShowOnboarding(true)}>
            <Icon name="help" />
          </button>
          <button className="icon-btn" title="Configuración (Ctrl+,)" onClick={() => setShowSettings(true)}>
            <Icon name="gear" />
          </button>
        </header>

        {missingKey && (
          <div className="banner">
            Falta configurar la clave de {provider.name}. <button onClick={() => setShowSettings(true)}>Configurar</button>
          </div>
        )}
        {notice && (
          <div className="banner banner-error" role="alert">
            {notice} <button onClick={() => setNotice(null)}>Cerrar</button>
          </div>
        )}
        {latestObservation && (
          <div className="observation-bar" role="status">
            <span className="observation-text">
              <b>{latestObservation.title}</b> {latestObservation.tip}
            </span>
            <button onClick={() => exploreObservation(latestObservation)}>Profundizar</button>
            <button className="icon-btn" title="Descartar" onClick={() => setLatestObservation(null)}>
              <Icon name="close" size={14} />
            </button>
          </div>
        )}

        <div className="view">
          {overlay?.kind === 'lesson' && (
            <LessonView
              trackId={overlay.trackId}
              lessonId={overlay.lessonId}
              view={academy}
              voiceSettings={settings.voice}
              onBack={closeOverlay}
              onUpdate={applyAcademy}
              onOpenExercise={(id) => setOverlay({ kind: 'exercise', id })}
              onClassWithXara={(material) => askXara('lesson', material)}
            />
          )}
          {overlay?.kind === 'v2' && (
            <V2Shell key={`${overlay.courseId}-${overlay.screen?.kind ?? 'map'}`} courseId={overlay.courseId} initial={overlay.screen} view={academy} voiceSettings={settings.voice} onClose={closeOverlay} onUpdate={applyAcademy} />
          )}
          {overlay?.kind === 'exam' && (
            <ExamView trackId={overlay.trackId} moduleId={overlay.moduleId} onBack={closeOverlay} onUpdate={applyAcademy} />
          )}
          {overlay?.kind === 'capstone' && <CapstoneView trackId={overlay.trackId} onBack={closeOverlay} onAskTutor={(text) => askXara('analyze', text)} />}
          {overlay?.kind === 'exercise' && findExercise(overlay.id) && (
            <ExerciseView
              key={overlay.id}
              exercise={findExercise(overlay.id)!}
              view={academy}
              onBack={closeOverlay}
              onUpdate={applyAcademy}
              onAskTutor={(text) => askXara('analyze', text)}
            />
          )}
          {overlay?.kind === 'placement' && <PlacementView view={academy} onDone={applyAcademy} onExit={closeOverlay} />}

          {!overlay && view === 'hoy' && (
            <Home
              view={academy}
              firstName={FIRST_NAME}
              onOpenLesson={openLesson}
              onOpenCourse={(courseId, screen) => setOverlay({ kind: 'v2', courseId, screen })}
              onOpenChallenge={openChallenge}
              onGoAcademy={() => setView('academia')}
              onStartPlacement={() => setOverlay({ kind: 'placement' })}
              onStartInterview={startInterview}
              onOpenAchievements={() => setView('logros')}
              onOpenLevel={() => setView('nivel')}
              onOpenCapstone={(trackId) => setOverlay({ kind: 'capstone', trackId })}
            />
          )}
          {!overlay && view === 'academia' && (
            <Academy
              view={academy}
              onOpenCourse={(courseId) => setOverlay({ kind: 'v2', courseId })}
              onOpenLesson={openLesson}
              onOpenExam={(trackId, moduleId) => setOverlay({ kind: 'exam', trackId, moduleId })}
              onOpenCapstone={(trackId) => setOverlay({ kind: 'capstone', trackId })}
            />
          )}
          {!overlay && view === 'entorno' && (
            <Sandbox view={academy} initialChallengeId={challengeId} onUpdate={applyAcademy} onAskTutor={(text) => askXara('analyze', text)} />
          )}
          {!overlay && view === 'entrevista' && <Interview view={academy} onUpdate={applyAcademy} autoStart={interviewAuto} />}
          {!overlay && view === 'nivel' && (
            <LevelView
              view={academy}
              onOpenExercise={(id) => setOverlay({ kind: 'exercise', id })}
              onStartPlacement={() => setOverlay({ kind: 'placement' })}
              onCareerAdvice={() => askXara('analyze', `Oriéntame en mi carrera según mi nivel actual.\n\n${levelSummary(academy)}`)}
            />
          )}
          {!overlay && view === 'logros' && <Achievements view={academy} theme={theme || 'Azul XARA'} onTheme={chooseTheme} />}
        </div>
      </main>

      <XaraPanel
        ref={xaraRef}
        settings={settings}
        onClose={() => setPanelOpen(false)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenProfile={() => setShowProfile(true)}
      />

      {showCodeFix && <CodeFixDialog settings={settings} onSettings={setSettings} onClose={() => setShowCodeFix(false)} />}
      {showObserver && observerStatus && (
        <ObserverDialog
          settings={settings}
          providerName={provider.name}
          status={observerStatus}
          observations={observations}
          onSettings={setSettings}
          onExplore={exploreObservation}
          onClose={() => setShowObserver(false)}
        />
      )}
      {showOnboarding && !missingKey && (
        <Onboarding
          firstName={FIRST_NAME}
          onStartPlacement={() => {
            closeOnboarding()
            setOverlay({ kind: 'placement' })
          }}
          onClose={closeOnboarding}
        />
      )}
      {unlocked && (
        <UnlockToast
          items={unlocked}
          onOpen={() => {
            setUnlocked(null)
            setOverlay(null)
            setView('logros')
          }}
          onClose={closeUnlocked}
        />
      )}
      {showProfile && <ProfileDialog onClose={() => setShowProfile(false)} />}
      {showSettings && (
        <SettingsDialog settings={settings} providers={providers} onChange={setSettings} onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

// Referencia blanda del nivel gratuito de Gemini (aproximada: la cuota real la fija Google y cambia).
const GEMINI_FREE_SOFT = 200

function UsagePill({ used }: { used: number }) {
  const pct = Math.min(100, Math.round((used / GEMINI_FREE_SOFT) * 100))
  const level = pct >= 90 ? 'high' : pct >= 65 ? 'mid' : 'ok'
  return (
    <span
      className={`usage-pill ${level}`}
      title={`XARA ha hecho ${used} llamadas a Gemini hoy. La referencia (~${GEMINI_FREE_SOFT}) es aproximada del nivel gratuito; la cuota exacta la fija Google y se reinicia cada día. Si se agota, XARA te avisa y puedes usar Ollama (local) desde Configuración.`}
    >
      <span className="usage-bar" style={{ ['--pct' as string]: pct }} />
      Gemini hoy: {used}
      <span className="usage-soft">/ ~{GEMINI_FREE_SOFT}</span>
    </span>
  )
}
