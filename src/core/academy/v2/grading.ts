import { MIN_PER_OBJECTIVE, PASS_PCT } from './constants'
import type { Item, Lesson } from './types'

// Corrección de los ítems de respuesta cerrada. `written`, `code` y `sql` se corrigen fuera (IA con rúbrica, Entorno).

export type Answer = number | number[] | string | string[] | Record<string, string>

export interface ItemResult {
  ok: boolean
  /** Explicación general del ítem. */
  explanation: string
  /** Para test: el `whyNot` de la opción elegida (qué error de razonamiento delata). */
  why?: string
}

export const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[¿?¡!.,;:()«»"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const sameSet = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join()

export const isAutoGraded = (it: Item) => !['written', 'code', 'sql'].includes(it.type)

export function gradeItem(item: Item, answer: Answer | undefined): ItemResult {
  const explanation = item.explanation ?? ''
  const fail = (why?: string): ItemResult => ({ ok: false, explanation, ...(why ? { why } : {}) })
  if (answer === undefined || answer === null) return fail()
  switch (item.type) {
    case 'mcq': {
      const i = Number(answer)
      const ok = i === item.correctIndex
      return { ok, explanation, ...(!ok && item.options?.[i]?.whyNot ? { why: item.options[i].whyNot } : {}) }
    }
    case 'multi': {
      const chosen = (Array.isArray(answer) ? answer : []).map(Number)
      const ok = sameSet(chosen, item.correctIndexes ?? [])
      const wrong = chosen.find((i) => !(item.correctIndexes ?? []).includes(i))
      return { ok, explanation, ...(!ok && wrong !== undefined && item.options?.[wrong]?.whyNot ? { why: item.options[wrong].whyNot } : {}) }
    }
    case 'order': {
      const a = Array.isArray(answer) ? (answer as string[]) : []
      return { ok: a.length === (item.steps ?? []).length && a.every((s, i) => s === item.steps?.[i]), explanation }
    }
    case 'classify': {
      const a = Array.isArray(answer) ? (answer as string[]) : []
      const cases = item.cases ?? []
      return { ok: a.length === cases.length && cases.every((c, i) => a[i] === c.bucket), explanation }
    }
    case 'fill': {
      const a = Array.isArray(answer) ? (answer as string[]) : [String(answer)]
      const blanks = item.blanks ?? []
      const ok = a.length >= blanks.length && blanks.every((b, i) => b.accept.some((x) => normalize(x) === normalize(a[i] ?? '')))
      return { ok, explanation }
    }
    case 'match': {
      const a = typeof answer === 'object' && !Array.isArray(answer) ? (answer as Record<string, string>) : {}
      const pairs = item.pairs ?? []
      return { ok: pairs.every((p) => a[p.left] === p.right), explanation }
    }
    case 'spot': {
      const a = (Array.isArray(answer) ? answer : []).map(Number)
      return { ok: sameSet(a, item.correctLines ?? []), explanation }
    }
    default:
      return fail()
  }
}

export interface AttemptReport {
  pct: number
  correct: number
  total: number
  byObjective: Record<string, number>
  weakObjectives: string[]
}

/** Resultado de un intento: porcentaje global y por objetivo (un objetivo sin aciertos puede hundir el examen aunque la media pase). */
export function scoreAttempt(items: Item[], oks: boolean[]): AttemptReport {
  const per: Record<string, { ok: number; n: number }> = {}
  items.forEach((it, i) => {
    const s = (per[it.objective] ??= { ok: 0, n: 0 })
    s.n++
    if (oks[i]) s.ok++
  })
  const correct = oks.filter(Boolean).length
  const byObjective = Object.fromEntries(Object.entries(per).map(([k, v]) => [k, Math.round((v.ok / v.n) * 100)]))
  const pct = items.length ? Math.round((correct / items.length) * 100) : 0
  const weakObjectives = Object.entries(byObjective)
    .filter(([, v]) => v < MIN_PER_OBJECTIVE || v < PASS_PCT)
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => k)
  return { pct, correct, total: items.length, byObjective, weakObjectives }
}

/** Dominio de clase: ≥ 80 % global. */
export const lessonMasteryPassed = (r: AttemptReport) => r.pct >= PASS_PCT
/** Examen de módulo o de nivel: ≥ 80 % global y ≥ 60 % en cada objetivo. */
export const examPassed = (r: AttemptReport) => r.pct >= PASS_PCT && Object.values(r.byObjective).every((v) => v >= MIN_PER_OBJECTIVE)

/** Partes de la clase que enseñan los objetivos fallados (por las comprobaciones que los miden). */
export function weakParts(lesson: Lesson, weakObjectives: string[]): { id: string; title: string }[] {
  return lesson.parts.filter((p) => (p.objectives?.length ? p.objectives : p.checkpoint.map((c) => c.objective)).some((o) => weakObjectives.includes(o))).map((p) => ({ id: p.id, title: p.title }))
}
