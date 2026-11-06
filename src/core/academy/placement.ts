import { catalog } from './catalog'
import { PLACEMENT_BANK } from './placement-bank'
import type { Area, CareerLevel, Difficulty, PlacementResult, QuizQuestion, Track } from './types'

export const PLACEMENT_AREAS: Area[] = ['fundamentos', 'frontend', 'backend', 'datos', 'calidad', 'seguridad', 'devops', 'analisis', 'ia']
export const QUESTIONS_PER_AREA = 3
const ORDER: Difficulty[] = ['principiante', 'intermedio', 'avanzado']

export interface PlacementAnswer {
  questionId: string
  choice: number
}

export interface GradedAnswer {
  area: Area
  difficulty: Difficulty
  correct: boolean
}

/** Banco propio primero y después las preguntas de las clases del proyecto base. */
export const PLACEMENT_POOL: QuizQuestion[] = [
  ...PLACEMENT_BANK,
  ...catalog.tracks.flatMap((t) => t.modules.flatMap((m) => m.lessons.flatMap((l) => (l.quiz ? [l.quiz] : []))))
]

const poolById = new Map(PLACEMENT_POOL.map((q) => [q.id, q]))

export function gradeAnswer(a: PlacementAnswer): GradedAnswer | undefined {
  const q = poolById.get(a.questionId)
  return q
    ? {
        area: q.area,
        difficulty: q.difficulty,
        correct: q.correctIndex === a.choice
      }
    : undefined
}

/** Escalera adaptativa: empieza en intermedio, sube si acierta y baja si falla. */
export function nextDifficulty(answered: GradedAnswer[]): Difficulty {
  const last = answered.at(-1)
  if (!last) return 'intermedio'
  const i = ORDER.indexOf(last.difficulty) + (last.correct ? 1 : -1)
  return ORDER[Math.max(0, Math.min(ORDER.length - 1, i))]
}

export function nextQuestion(area: Area, answers: PlacementAnswer[]): QuizQuestion | null {
  const seen = new Set(answers.map((a) => a.questionId))
  const graded = answers.map(gradeAnswer).filter((g): g is GradedAnswer => g?.area === area)
  if (graded.length >= QUESTIONS_PER_AREA) return null
  const target = nextDifficulty(graded)
  const free = PLACEMENT_POOL.filter((q) => q.area === area && !seen.has(q.id))
  // Si no quedan preguntas del nivel buscado se usa la más cercana.
  const distance = (q: QuizQuestion) => Math.abs(ORDER.indexOf(q.difficulty) - ORDER.indexOf(target))
  return free.sort((a, b) => distance(a) - distance(b))[0] ?? null
}

export function areaLevel(graded: GradedAnswer[]): Difficulty {
  const ok = (d: Difficulty) => graded.filter((g) => g.difficulty === d && g.correct).length
  const fail = (d: Difficulty) => graded.filter((g) => g.difficulty === d && !g.correct).length
  if (ok('avanzado') > 0 && ok('avanzado') >= fail('avanzado')) return 'avanzado'
  if (ok('avanzado') > 0 || (ok('intermedio') > 0 && ok('intermedio') >= fail('intermedio'))) return 'intermedio'
  return 'principiante'
}

const LEVEL_VALUE: Record<Difficulty, number> = {
  principiante: 0,
  intermedio: 1,
  avanzado: 2
}

/** Un examen corto no basta para llamar a nadie senior: el tope es semi-senior y lo demás lo dan las evidencias. */
export function overallFromScore(value: number): CareerLevel {
  if (value < 0.4) return 'inicial'
  if (value < 0.9) return 'junior'
  if (value < 1.4) return 'junior_plus'
  return 'semi_senior'
}

export function buildPlacement(answers: PlacementAnswer[], practical: PlacementResult['practical'] | undefined, now = new Date()): PlacementResult {
  const graded = answers.map(gradeAnswer).filter((g): g is GradedAnswer => !!g)
  const areas: PlacementResult['areas'] = {}
  for (const area of PLACEMENT_AREAS) {
    const mine = graded.filter((g) => g.area === area)
    if (mine.length)
      areas[area] = {
        correct: mine.filter((g) => g.correct).length,
        total: mine.length,
        level: areaLevel(mine)
      }
  }
  const values = Object.values(areas).map((a) => {
    const v = LEVEL_VALUE[a!.level]
    return a!.correct === 0 ? v - 0.5 : v
  })
  const theory = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0
  const combined = practical && practical.mode === 'ia' ? theory * 0.7 + (practical.score / 50) * 0.3 : theory
  const overall = overallFromScore(combined)
  return {
    at: now.toISOString(),
    areas,
    ...(practical ? { practical } : {}),
    overall,
    recommendedTrackIds: recommendTracks(areas, overall)
  }
}

/** La ruta de IA siempre; además las rutas de las áreas evaluadas más flojas. Quien empieza de cero, primero los cimientos. */
export function recommendTracks(areas: PlacementResult['areas'], overall: CareerLevel): string[] {
  const weakest = (Object.entries(areas) as [Area, { correct: number; total: number }][])
    .filter(([area]) => area !== 'ia')
    .sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
  const out = overall === 'inicial' ? ['javascript', 'ingenieria-ia'] : ['ingenieria-ia']
  for (const [area] of weakest) {
    // Un área floja se refuerza con una ruta que empiece desde lo básico, no con una que arranca en nivel intermedio.
    const track = catalog.tracks.find((t) => t.area === area && !out.includes(t.id) && t.modules[0]?.level === 'principiante')
    if (track) out.push(track.id)
    if (out.length === 3) break
  }
  return out
}

/** Primer módulo de la ruta acorde al nivel del área: no repetir lo que ya sabe. */
export function startModule(track: Track, level: Difficulty | undefined): string | undefined {
  const wanted = level === 'avanzado' ? ['avanzado', 'proyecto'] : level === 'intermedio' ? ['intermedio', 'avanzado', 'proyecto'] : []
  return (track.modules.find((m) => wanted.includes(m.level)) ?? track.modules[0])?.id
}
