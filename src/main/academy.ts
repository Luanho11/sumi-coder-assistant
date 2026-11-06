import {
  buildHintMessage,
  buildEvaluationMessage,
  buildPracticalMessage,
  EVALUATOR_SYSTEM,
  offlineEvaluation,
  parseEvaluation,
  parsePractical,
  PRACTICAL_SYSTEM
} from '../core/academy/evaluation'
import { catalog, findChallenge, findExercise, interviewBank, stepsFor } from '../core/academy/catalog'
import { computeLevel } from '../core/academy/level'
import { badges, computeXp, dailyChallenge, dayKey, ranks, streak, xpLevel, type Badge, type Unlock } from '../core/academy/gamification'
import { buildInterviewMessage, INTERVIEW_SYSTEM, offlineInterview, parseInterview, pickInterview, type InterviewTurn } from '../core/academy/interview'
import { buildPlacement, type PlacementAnswer } from '../core/academy/placement'
import { recommendedRoute, nextLesson, type RouteStep } from '../core/academy/route'
import { runChallenge, runScratch } from './sandbox'
import type { AcademyProgress, Area, Attempt, Draft, ExamQuestion, InterviewQuestion, InterviewReport, LevelReport, PhaseId } from '../core/academy/types'
import { moduleExtra } from '../core/academy/catalog'
import type { ChatMessage } from '../core/types'
import type { AcademyStore } from './storage'
import { registerAcademyV2 } from './academy-v2'

export interface AcademyView {
  progress: AcademyProgress
  report: LevelReport
  route: RouteStep[]
  nextLesson: ReturnType<typeof nextLesson>
  xp: { total: number; level: number; current: number; needed: number }
  streak: { days: number; activeToday: boolean }
  badges: Badge[]
  rank: { emoji: string; title: string }
  nextRank?: { emoji: string; title: string; atLevel: number; theme: string }
  unlocks: Unlock[]
  dailyChallengeId?: string
  /** Solo desarrollo: XARA_UNLOCK_ALL=1 ignora las compuertas de la academia v2. */
  unlockAll?: boolean
}

export type LinkStatus = 'ok' | 'roto' | 'desconocido'

export interface ExamResult {
  correctIndex: number
  chosen: number
  ok: boolean
  explanation: string
}

interface Deps {
  store: AcademyStore
  complete: (system: string, messages: ChatMessage[], signal: AbortSignal) => Promise<string>
  hintSystem: (step: number) => Promise<string>
}

type Handle = (channel: string, fn: (...args: any[]) => unknown) => void

const MAX_ANSWER = 50_000
const PHASES: PhaseId[] = ['entender', 'plan', 'construir', 'verificar', 'defender']

// Solo se comprueban enlaces del catálogo: el proceso principal no hace peticiones a URLs arbitrarias.
const KNOWN_LINKS = new Map(
  [...catalog.exercises.flatMap((e) => e.resources), ...catalog.tracks.flatMap((t) => t.modules.flatMap((m) => m.lessons.flatMap((l) => l.videos)))].map(
    (r) => [r.url, r]
  )
)
const linkCache = new Map<string, LinkStatus>()

async function checkLink(url: string): Promise<LinkStatus> {
  const r = KNOWN_LINKS.get(url)
  if (!r) return 'desconocido'
  if (url.startsWith('https://www.youtube.com/results')) return 'ok'
  const cached = linkCache.get(url)
  if (cached) return cached
  let status: LinkStatus = 'desconocido'
  try {
    if (r.youtubeId) {
      // oEmbed responde 404/400 si el vídeo no existe o es privado, y 401 si existe pero no se puede incrustar.
      const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(8000) })
      status = res.ok || res.status === 401 ? 'ok' : res.status === 404 || res.status === 400 ? 'roto' : 'desconocido'
    } else {
      let res = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(8000)
      })
      if (res.status === 405 || res.status === 403)
        res = await fetch(url, {
          redirect: 'follow',
          signal: AbortSignal.timeout(8000)
        })
      status = res.ok ? 'ok' : res.status === 404 || res.status === 410 ? 'roto' : 'desconocido'
    }
  } catch {
    return 'desconocido' // sin conexión: no se guarda para volver a probar
  }
  linkCache.set(url, status)
  return status
}

function sanitizeDraft(raw: unknown, previous: Draft | undefined, maxHints: number): Draft {
  const d = (raw ?? {}) as {
    answers?: Record<string, unknown>
    hintsShown?: unknown
  }
  const answers: Draft['answers'] = {}
  for (const id of PHASES) {
    const v = d.answers?.[id]
    if (typeof v === 'string') answers[id] = v.slice(0, MAX_ANSWER)
  }
  // Las pistas vistas no pueden bajar: así cuentan en la evaluación aunque se borre el borrador.
  const shown = Math.max(previous?.hintsShown ?? 0, Math.min(maxHints, Math.floor(Number(d.hintsShown) || 0)))
  return { answers, hintsShown: shown, updatedAt: new Date().toISOString() }
}

function exerciseOrThrow(id: unknown) {
  const e = typeof id === 'string' ? findExercise(id) : undefined
  if (!e) throw new Error('El ejercicio no existe.')
  return e
}

export function registerAcademy(handle: Handle, deps: Deps): void {
  const { store } = deps
  const view = async (progress?: AcademyProgress): Promise<AcademyView> => {
    const p = progress ?? (await store.get())
    const total = computeXp(p)
    const xp = { total, ...xpLevel(total) }
    const daily = dailyChallenge(p)
    const { current, next, ladder } = ranks(xp.level)
    return {
      progress: p,
      report: computeLevel(p),
      route: recommendedRoute(p),
      nextLesson: nextLesson(p),
      xp,
      streak: streak(p.activity),
      badges: badges(p),
      rank: { emoji: current.emoji, title: current.title },
      ...(next ? { nextRank: { emoji: next.emoji, title: next.title, atLevel: next.atLevel, theme: next.theme } } : {}),
      unlocks: ladder,
      ...(daily ? { dailyChallengeId: daily.id } : {}),
      ...(process.env.XARA_UNLOCK_ALL === '1' ? { unlockAll: true } : {})
    }
  }

  // Cada acción que cuenta como estudiar marca el día de hoy para la racha.
  const markToday = (p: AcademyProgress) => {
    const today = dayKey(new Date())
    if (!p.activity.includes(today)) p.activity.push(today)
  }

  registerAcademyV2(handle, { store, complete: deps.complete }, view)

  handle('academy:get', () => view())

  handle('academy:draft', async (exerciseId: unknown, draft: unknown) => {
    const e = exerciseOrThrow(exerciseId)
    return view(await store.update((p) => (p.drafts[e.id] = sanitizeDraft(draft, p.drafts[e.id], e.hints.length + 5))))
  })

  handle('academy:lessonDone', async (lessonId: unknown) => {
    if (typeof lessonId !== 'string' || lessonId.length > 120) throw new Error('Clase no válida.')
    return view(
      await store.update((p) => {
        if (!p.lessonsDone.includes(lessonId)) p.lessonsDone.push(lessonId)
        markToday(p)
      })
    )
  })

  handle('academy:evaluate', async (exerciseId: unknown, confidence: unknown) => {
    const e = exerciseOrThrow(exerciseId)
    const draft = (await store.get()).drafts[e.id]
    if (!draft || !stepsFor(e).some((s) => draft.answers[s.id]?.trim())) throw new Error('Escribe tu respuesta antes de pedir la evaluación.')
    let notice: string | undefined
    let evaluation = undefined
    try {
      const text = await deps.complete(EVALUATOR_SYSTEM, [{ role: 'user', content: buildEvaluationMessage(e, draft) }], AbortSignal.timeout(120_000))
      evaluation = parseEvaluation(text)
      if (!evaluation) notice = 'La IA respondió en un formato inesperado; se muestra una estimación sin IA.'
    } catch (err) {
      notice = `No se pudo contactar con el proveedor (${(err as Error).message}); se muestra una estimación sin IA.`
    }
    const attempt: Attempt = {
      exerciseId: e.id,
      at: new Date().toISOString(),
      evaluation: evaluation ?? offlineEvaluation(e, draft),
      hintsUsed: draft.hintsShown,
      confidence: Math.max(1, Math.min(5, Math.round(Number(confidence) || 3)))
    }
    const progress = await store.update((p) => {
      p.attempts.push(attempt)
      markToday(p)
    })
    return { attempt, notice, ...(await view(progress)) }
  })

  handle('academy:aiHint', async (exerciseId: unknown, draftRaw: unknown) => {
    const e = exerciseOrThrow(exerciseId)
    const progress = await store.update((p) => {
      const d = sanitizeDraft(draftRaw, p.drafts[e.id], e.hints.length + 5)
      d.hintsShown = Math.min(e.hints.length + 5, d.hintsShown + 1)
      p.drafts[e.id] = d
    })
    const draft = progress.drafts[e.id]
    const step = Math.min(5, draft.hintsShown)
    const text = await deps.complete(await deps.hintSystem(step), [{ role: 'user', content: buildHintMessage(e, draft, step) }], AbortSignal.timeout(90_000))
    return { text, ...(await view(progress)) }
  })

  handle('academy:placement', async (answers: unknown, practical: unknown) => {
    const list: PlacementAnswer[] = (Array.isArray(answers) ? answers : [])
      .filter((a): a is PlacementAnswer => typeof a?.questionId === 'string' && Number.isInteger(a?.choice))
      .slice(0, 100)
    const texts = (typeof practical === 'object' && practical !== null ? practical : {}) as Record<string, unknown>
    const clean = Object.fromEntries(
      Object.entries(texts)
        .filter(([, v]) => typeof v === 'string')
        .map(([k, v]) => [k, (v as string).slice(0, MAX_ANSWER)])
    )
    let graded = undefined
    let notice: string | undefined
    if (Object.values(clean).some((v) => v.trim())) {
      try {
        graded = parsePractical(await deps.complete(PRACTICAL_SYSTEM, [{ role: 'user', content: buildPracticalMessage(clean) }], AbortSignal.timeout(120_000)))
        if (!graded) notice = 'La parte práctica no se pudo corregir (formato inesperado); el nivel se calcula solo con la parte teórica.'
      } catch (err) {
        notice = `Sin conexión con el proveedor (${(err as Error).message}): el nivel se calcula solo con la parte teórica.`
      }
    }
    const result = buildPlacement(list, graded)
    return {
      notice,
      ...(await view(await store.update((p) => (p.placement = result))))
    }
  })

  handle('academy:runChallenge', async (challengeId: unknown, code: unknown) => {
    if (typeof challengeId !== 'string' || typeof code !== 'string') throw new Error('Reto no válido.')
    const result = await runChallenge(challengeId, code)
    if (!result.ok) return { result, ...(await view()) }
    const progress = await store.update((p) => {
      if (!p.challenges[challengeId]) p.challenges[challengeId] = new Date().toISOString()
      markToday(p)
    })
    return { result, ...(await view(progress)) }
  })

  handle('academy:runScratch', (language: unknown, code: unknown, setup: unknown) => {
    if (language !== 'javascript' && language !== 'sql') throw new Error('Lenguaje no válido.')
    return runScratch(language, String(code ?? ''), typeof setup === 'string' ? setup : '')
  })

  // Retos sin ejecución (explicar código, corregir CSS): el alumno los marca como logrados tras autoevaluarse o pedir revisión a XARA.
  handle('academy:markChallenge', async (challengeId: unknown) => {
    if (typeof challengeId !== 'string') throw new Error('Reto no válido.')
    const c = findChallenge(challengeId)
    if (!c) throw new Error('El reto no existe.')
    if (c.kind !== 'explica' && c.kind !== 'css') throw new Error('Ese reto se supera ejecutándolo, no marcándolo.')
    return view(
      await store.update((p) => {
        if (!p.challenges[challengeId]) p.challenges[challengeId] = new Date().toISOString()
        markToday(p)
      })
    )
  })

  handle('academy:submitExam', async (moduleId: unknown, answers: unknown) => {
    if (typeof moduleId !== 'string') throw new Error('Módulo no válido.')
    const extra = moduleExtra(moduleId)
    if (!extra) throw new Error('Ese módulo no tiene examen.')
    const picks = (Array.isArray(answers) ? answers : []).map((n) => Math.trunc(Number(n)))
    const results = extra.exam.map((q: ExamQuestion, i: number) => ({ correctIndex: q.correctIndex, chosen: picks[i], ok: picks[i] === q.correctIndex, explanation: q.explanation }))
    const correct = results.filter((r) => r.ok).length
    const score = Math.round((correct / extra.exam.length) * 100)
    const progress = await store.update((p) => {
      const prev = p.exams[moduleId]
      if (!prev || score > prev.score) p.exams[moduleId] = { score, at: new Date().toISOString() }
      markToday(p)
    })
    return { score, correct, total: extra.exam.length, results, ...(await view(progress)) }
  })

  handle('academy:interviewStart', (area: unknown, count: unknown) => {
    const a = (typeof area === 'string' ? area : 'mixta') as Area | 'mixta'
    const n = Math.max(3, Math.min(7, Math.trunc(Number(count) || 5)))
    return pickInterview(interviewBank, a, n)
  })

  handle('academy:interviewGrade', async (payload: unknown) => {
    const list = Array.isArray(payload) ? payload : []
    const turns: InterviewTurn[] = list
      .map((t) => ({ question: interviewBank.find((q: InterviewQuestion) => q.id === (t as { id?: string })?.id), answer: String((t as { answer?: string })?.answer ?? '').slice(0, MAX_ANSWER) }))
      .filter((t): t is InterviewTurn => !!t.question)
    if (!turns.length) throw new Error('No hay respuestas que corregir.')
    let report: InterviewReport | undefined
    let notice: string | undefined
    try {
      report = parseInterview(await deps.complete(INTERVIEW_SYSTEM, [{ role: 'user', content: buildInterviewMessage(turns) }], AbortSignal.timeout(120_000)), turns)
      if (!report) notice = 'La IA respondió en un formato inesperado; se muestra una estimación sin IA.'
    } catch (err) {
      notice = `Sin conexión con el proveedor (${(err as Error).message}); se muestra una estimación sin IA.`
    }
    const final = report ?? offlineInterview(turns)
    const progress = await store.update((p) => {
      p.interviews.push(final)
      markToday(p)
    })
    return { interview: final, notice, ...(await view(progress)) }
  })

  handle('resources:check', async (urls: unknown) => {
    const list = (Array.isArray(urls) ? urls : []).filter((u): u is string => typeof u === 'string').slice(0, 30)
    return Object.fromEntries(await Promise.all(list.map(async (u) => [u, await checkLink(u)] as const)))
  })
}
