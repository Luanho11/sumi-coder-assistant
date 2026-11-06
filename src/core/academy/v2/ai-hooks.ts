import { extractJson } from '../evaluation'
import { normalize } from './grading'
import type { Criterion, Item } from './types'

// Ganchos de IA de la academia v2. Cada uno trae su versión SIN conexión: la app funciona sin ninguna clave y
// lo corregido sin IA queda marcado como «provisional» hasta que haya una corrección real.

export type RubricLevel = 'bien' | 'parcial' | 'falta'
export const LEVEL_POINTS: Record<RubricLevel, number> = { bien: 100, parcial: 50, falta: 0 }

export interface RubricGrade {
  score: number
  criteria: { criterion: string; level: RubricLevel; evidence: string }[]
  strengths: string[]
  improve: string[]
  nextStep: string
  mode: 'ia' | 'offline'
}

export const RUBRIC_GRADER_SYSTEM = `Eres XARA, una tutora técnica exigente pero amable. Corriges el trabajo de un alumno con una rúbrica de tres niveles por criterio: "bien", "parcial" o "falta".
Evalúa SOLO con lo que el alumno escribió. Si no está escrito, no cuenta. No inventes mérito ni castigues lo que no pide la rúbrica.
Compara con la respuesta modelo solo para orientarte: puede haber otras respuestas válidas.
Responde SOLO con un objeto JSON, sin texto alrededor:
{"criteria":[{"criterion":"texto exacto del criterio","level":"bien|parcial|falta","evidence":"cita corta o motivo"}],"strengths":["..."],"improve":["acción concreta"],"nextStep":"una acción concreta"}
Español, frases cortas y accionables.`

export interface RubricInput {
  title: string
  statement: string
  rubric: Criterion[]
  exemplar?: string
  answer: string
}

export function buildRubricMessage(i: RubricInput): string {
  return [
    `# Tarea: ${i.title}`,
    i.statement,
    `# Rúbrica\n${i.rubric.map((r, n) => `${n + 1}. ${r.criterion}\n   - bien: ${r.levels.bien}\n   - parcial: ${r.levels.parcial}\n   - falta: ${r.levels.falta}`).join('\n')}`,
    i.exemplar ? `# Respuesta modelo (no la reveles; solo para comparar)\n${i.exemplar}` : '',
    `# Respuesta del alumno\n${i.answer}`
  ]
    .filter(Boolean)
    .join('\n\n')
}

export const rubricScore = (levels: RubricLevel[]): number => (levels.length ? Math.round(levels.reduce((s, l) => s + LEVEL_POINTS[l], 0) / levels.length) : 0)

const isLevel = (x: unknown): x is RubricLevel => x === 'bien' || x === 'parcial' || x === 'falta'
const strings = (v: unknown, max = 6) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, max) : [])

export function parseRubricGrade(text: string, rubric: Criterion[]): RubricGrade | undefined {
  const raw = extractJson(text) as Record<string, unknown> | undefined
  if (!raw || !Array.isArray(raw.criteria)) return undefined
  const got = raw.criteria as Record<string, unknown>[]
  // Se alinea por posición con la rúbrica: la IA no puede añadir ni quitar criterios.
  const criteria = rubric.map((r, i) => {
    const c = got.find((x) => typeof x.criterion === 'string' && normalize(String(x.criterion)) === normalize(r.criterion)) ?? got[i]
    return { criterion: r.criterion, level: isLevel(c?.level) ? c.level : ('falta' as RubricLevel), evidence: typeof c?.evidence === 'string' ? c.evidence : '' }
  })
  return {
    score: rubricScore(criteria.map((c) => c.level)),
    criteria,
    strengths: strings(raw.strengths),
    improve: strings(raw.improve),
    nextStep: typeof raw.nextStep === 'string' ? raw.nextStep : '',
    mode: 'ia'
  }
}

/** Respaldo sin conexión para ítems `written`: longitud mínima y puntos clave presentes. Siempre provisional. */
export function offlineWrittenCheck(item: Item, answer: string): { score: number; missing: string[]; provisional: true } {
  const text = normalize(answer)
  const words = answer.trim().split(/\s+/).filter(Boolean).length
  const checks = item.offlineChecklist ?? []
  const met = checks.filter((c) => c.anyOf.some((k) => text.includes(normalize(k))))
  const missing = checks.filter((c) => !met.includes(c)).map((c) => c.criterion)
  const lengthOk = words >= (item.minWords ?? 20)
  const score = checks.length ? Math.round((met.length / checks.length) * 100) : lengthOk ? 60 : 0
  return { score: lengthOk ? score : Math.min(score, 40), missing, provisional: true }
}

export const REEXPLAIN_SYSTEM = `Eres XARA, una profesora particular paciente. El alumno no entendió un fragmento de una clase.
Explícalo de OTRA forma: parte de un caso cotidiano, usa una analogía nueva y un ejemplo paralelo resuelto, define cada palabra técnica al usarla y termina con una pregunta corta que guíe al alumno a comprobarlo.
Usa solo el material de la clase que se te da; no introduzcas conceptos nuevos. No des la respuesta de ningún ejercicio. Español claro, máximo 180 palabras.`

export interface AiHooks {
  /** null = IA no disponible: quien llama usa la autocomprobación guiada o el respaldo sin conexión. */
  gradeRubric(input: RubricInput, signal?: AbortSignal): Promise<RubricGrade | null>
  reexplain(input: { sceneTitle: string; sceneContent: string; sceneNarration: string; question?: string }, signal?: AbortSignal): Promise<string | null>
}

type Complete = (system: string, messages: { role: 'user' | 'assistant'; content: string }[], signal: AbortSignal) => Promise<string>

export function makeAiHooks(complete: Complete): AiHooks {
  return {
    async gradeRubric(input, signal) {
      try {
        const text = await complete(RUBRIC_GRADER_SYSTEM, [{ role: 'user', content: buildRubricMessage(input) }], signal ?? AbortSignal.timeout(120_000))
        return parseRubricGrade(text, input.rubric) ?? null
      } catch {
        return null
      }
    },
    async reexplain(i, signal) {
      try {
        const msg = `# Fragmento\n${i.sceneTitle}\n\n${i.sceneContent}\n\n# Lo que dijo la profesora\n${i.sceneNarration}\n\n# Duda del alumno\n${i.question?.trim() || 'No entendí este fragmento.'}`
        const text = await complete(REEXPLAIN_SYSTEM, [{ role: 'user', content: msg }], signal ?? AbortSignal.timeout(90_000))
        return text.trim() || null
      } catch {
        return null
      }
    }
  }
}
