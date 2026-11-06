import { findExercise, findTrack } from './catalog'
import { startModule } from './placement'
import type { AcademyProgress, Area, AreaLevel, Attempt, CareerLevel, Difficulty, ErrorType, EvaluationLevel, Exercise, LevelReport } from './types'

export const CAREER_LEVEL_LABELS: Record<CareerLevel, string> = {
  inicial: 'Inicial',
  junior: 'Junior',
  junior_plus: 'Junior avanzado',
  semi_senior: 'Semi-senior',
  senior: 'Senior'
}

// Los niveles de carrera en orden, de menos a más. Sirve para dibujar la escala y ubicar al alumno.
export const CAREER_LEVELS: CareerLevel[] = ['inicial', 'junior', 'junior_plus', 'semi_senior', 'senior']

export const CAREER_LEVEL_HINTS: Record<CareerLevel, string> = {
  inicial: 'Empiezas desde los cimientos: variables, lógica y tus primeras líneas.',
  junior: 'Ya programas cosas pequeñas y entiendes lo básico de un lenguaje.',
  junior_plus: 'Resuelves problemas reales y empiezas a trabajar con proyectos.',
  semi_senior: 'Construyes funciones completas y tomas decisiones de diseño.',
  senior: 'Dominas el oficio: arquitectura, buenas prácticas y mentoría.'
}

export const AREA_LABELS: Record<Area, string> = {
  fundamentos: 'Fundamentos',
  frontend: 'Frontend',
  backend: 'Backend',
  datos: 'Datos y SQL',
  calidad: 'Calidad y testing',
  analisis: 'Análisis',
  devops: 'Sistemas y DevOps',
  seguridad: 'Seguridad',
  ia: 'Ingeniería con IA'
}

export const EVALUATION_LABELS: Record<EvaluationLevel, string> = {
  bien_hecho: 'Bien hecho',
  parcial: 'Parcialmente correcto',
  incorrecto: 'Incorrecto',
  falta_evidencia: 'Falta evidencia',
  no_defendible: 'No defendible en un trabajo real'
}

export const ERROR_LABELS: Record<ErrorType, string> = {
  conceptual: 'Conceptual',
  omision: 'Omisión',
  mala_practica: 'Mala práctica',
  incompleto: 'Incompleto',
  dependiente_ia: 'Dependencia de la IA'
}

export const PASS_SCORE = 70
const POINTS: Record<Difficulty, number> = {
  principiante: 1,
  intermedio: 2,
  avanzado: 3
}
const PRIOR_POINTS: Record<Difficulty, number> = {
  principiante: 0,
  intermedio: 3,
  avanzado: 8
}
const THRESHOLDS: [CareerLevel, number][] = [
  ['junior', 3],
  ['junior_plus', 8],
  ['semi_senior', 16],
  ['senior', 28]
]
const START_POINTS = Object.fromEntries([['inicial', 0], ...THRESHOLDS]) as Record<CareerLevel, number>
const DAY = 86_400_000

/** Puntuación que cuenta como evidencia: las pistas y la falta de defensa restan. */
export function effectiveScore(a: Attempt): number {
  const hintPenalty = Math.min(20, Math.max(0, a.hintsUsed - 1) * 5)
  const capped = a.evaluation.level === 'no_defendible' ? Math.min(a.evaluation.score, 40) : a.evaluation.score
  return Math.max(0, Math.round(capped - hintPenalty))
}

function latestByExercise(attempts: Attempt[]): Map<string, Attempt> {
  const out = new Map<string, Attempt>()
  for (const a of attempts) {
    const prev = out.get(a.exerciseId)
    if (!prev || prev.at < a.at) out.set(a.exerciseId, a)
  }
  return out
}

function pointsFor(e: Exercise): number {
  const bonus = e.kind === 'reto' || e.kind === 'entrevista' || e.kind === 'aplicacion_real' ? 1 : 0
  return POINTS[e.difficulty] + bonus
}

function levelFromPoints(points: number, advancedPassed: number): CareerLevel {
  let level: CareerLevel = 'inicial'
  for (const [name, min] of THRESHOLDS) if (points >= min) level = name
  // Senior exige haber resuelto bien varios ejercicios avanzados, no solo acumular puntos.
  if (level === 'senior' && advancedPassed < 3) return 'semi_senior'
  return level
}

function nextThreshold(points: number): [CareerLevel, number] | undefined {
  return THRESHOLDS.find(([, min]) => points < min)
}

function areaOf(e: Exercise): Area {
  return findTrack(e.trackId)?.area ?? 'fundamentos'
}

export function computeLevel(progress: AcademyProgress, now = new Date()): LevelReport {
  const latest = latestByExercise(progress.attempts)
  const byArea = new Map<Area, { scores: number[]; points: number; earned: number; evidence: number; advanced: number }>()
  const evidence: LevelReport['evidence'] = []
  const pendingReview: string[] = []

  for (const [id, attempt] of latest) {
    const e = findExercise(id)
    if (!e) continue
    const score = effectiveScore(attempt)
    const area = areaOf(e)
    const acc = byArea.get(area) ?? {
      scores: [],
      points: 0,
      earned: 0,
      evidence: 0,
      advanced: 0
    }
    acc.scores.push(score)
    if (score >= PASS_SCORE) {
      acc.points += pointsFor(e)
      acc.earned += pointsFor(e)
      acc.evidence++
      if (e.difficulty === 'avanzado') acc.advanced++
      evidence.push({ exerciseId: id, title: e.title, score })
    } else if (now.getTime() - new Date(attempt.at).getTime() >= DAY) {
      pendingReview.push(id)
    }
    byArea.set(area, acc)
  }

  for (const [area, info] of Object.entries(progress.placement?.areas ?? {}) as [Area, { level: Difficulty }][]) {
    if (!byArea.has(area)) byArea.set(area, { scores: [], points: 0, earned: 0, evidence: 0, advanced: 0 })
    const acc = byArea.get(area)!
    // El examen da un punto de partida; los ejercicios lo superan cuando aportan más evidencia.
    acc.points = Math.max(acc.points, PRIOR_POINTS[info.level])
  }

  const areas: (AreaLevel & { points: number })[] = [...byArea.entries()]
    .map(([area, acc]) => ({
      area,
      score: acc.scores.length ? Math.round(acc.scores.reduce((s, v) => s + v, 0) / acc.scores.length) : 0,
      evidence: acc.evidence,
      level: levelFromPoints(acc.points, acc.advanced),
      points: acc.points
    }))
    .sort((a, b) => b.points - a.points)

  // Perfil en T: cuentan las tres áreas con más ejercicios aprobados, no se penaliza especializarse.
  const top = [...byArea.values()].map((a) => a.earned).sort((a, b) => b - a).slice(0, 3)
  const earnedPoints = top.length ? top.reduce((s, v) => s + v, 0) / top.length : 0
  // El nivel global parte del resultado del examen (el mismo que vio al terminarlo) y solo lo superan los ejercicios.
  const overallPoints = Math.max(earnedPoints, progress.placement ? START_POINTS[progress.placement.overall] : 0)
  const advancedTotal = [...byArea.values()].reduce((s, a) => s + a.advanced, 0)
  const overall = levelFromPoints(overallPoints, advancedTotal)
  const next = nextThreshold(overallPoints)

  const withConfidence = progress.attempts.filter((a) => a.confidence >= 1 && a.confidence <= 5)
  const calibration = withConfidence.length
    ? Math.round((withConfidence.reduce((s, a) => s + Math.abs(((a.confidence - 1) / 4) * 100 - a.evaluation.score), 0) / withConfidence.length) * 10) / 1000
    : undefined

  return {
    overall,
    overallScore: Math.round(overallPoints * 10) / 10,
    areas: areas.map(({ points: _p, ...a }) => a),
    evidence: evidence.sort((a, b) => b.score - a.score).slice(0, 20),
    ...(calibration !== undefined ? { calibration } : {}),
    pendingReview,
    ...(next
      ? {
          limitingFactor: `Para llegar a ${CAREER_LEVEL_LABELS[next[0]]} te faltan ${Math.ceil((next[1] - overallPoints) * 10) / 10} puntos de evidencia en tus áreas fuertes (un ejercicio intermedio bien hecho suma 2; uno avanzado, 3; retos, entrevistas y aplicaciones reales, 1 más).`
        }
      : {})
  }
}

export interface Recommendation {
  exercise: Exercise
  reason: string
}

/** Siguiente ejercicio: primero repasos pendientes; si no, el siguiente de la ruta adaptado a cómo van los últimos intentos. */
export function recommendNext(progress: AcademyProgress, trackId: string, now = new Date()): Recommendation | undefined {
  const report = computeLevel(progress, now)
  const review = report.pendingReview.map(findExercise).find((e) => e?.trackId === trackId)
  if (review)
    return {
      exercise: review,
      reason: 'Repaso: la última vez no llegaste al aprobado y ya ha pasado un día. Repetirlo ahora fija lo aprendido.'
    }

  const track = findTrack(trackId)
  if (!track) return undefined
  const latest = latestByExercise(progress.attempts)
  const passed = (id: string) => {
    const a = latest.get(id)
    return !!a && effectiveScore(a) >= PASS_SCORE
  }
  const placementLevel = progress.placement?.areas[track.area]?.level
  const firstModule = startModule(track, placementLevel)
  const modules = track.modules.slice(
    Math.max(
      0,
      track.modules.findIndex((m) => m.id === firstModule)
    )
  )
  const ordered = modules
    .flatMap((m) => m.lessons.flatMap((l) => l.exerciseIds))
    .map(findExercise)
    .filter((e): e is Exercise => !!e)
  const pending = ordered.filter((e) => !passed(e.id))
  if (!pending.length) return undefined

  const recent = progress.attempts.filter((a) => findExercise(a.exerciseId)?.trackId === trackId).slice(-2)
  const struggling = recent.length === 2 && recent.every((a) => effectiveScore(a) < 50)
  const flying = recent.length === 2 && recent.every((a) => effectiveScore(a) >= 85)
  if (struggling) {
    const guided = pending.find((e) => e.kind === 'guiado')
    if (guided)
      return {
        exercise: guided,
        reason: 'Los dos últimos intentos costaron: toca un ejercicio guiado para afianzar la base.'
      }
  }
  if (flying) {
    const hard = pending.find((e) => e.kind === 'reto' || e.kind === 'entrevista' || e.difficulty === 'avanzado')
    if (hard)
      return {
        exercise: hard,
        reason: 'Vas muy bien: subimos la dificultad con un reto.'
      }
  }
  return {
    exercise: pending[0],
    reason: placementLevel ? 'Siguiente paso de la ruta según tu examen de nivel.' : 'Siguiente paso de la ruta.'
  }
}

export function latestAttempt(progress: AcademyProgress, exerciseId: string): Attempt | undefined {
  return latestByExercise(progress.attempts.filter((a) => a.exerciseId === exerciseId)).get(exerciseId)
}
