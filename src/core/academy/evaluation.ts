import { stepsFor } from './catalog'
import { PRACTICAL_TASKS } from './placement-bank'
import type { CriterionResult, Draft, ErrorType, Evaluation, EvaluationLevel, Exercise, PhaseId, PlacementResult } from './types'

const LEVELS: EvaluationLevel[] = ['bien_hecho', 'parcial', 'incorrecto', 'falta_evidencia', 'no_defendible']
const ERRORS: ErrorType[] = ['conceptual', 'omision', 'mala_practica', 'incompleto', 'dependiente_ia']
const POLICY_TEXT = {
  sin_ia: 'Sin IA: debe resolverlo por sí mismo.',
  ia_tutor: 'IA solo como tutor: puede preguntar dudas, pero la solución debe ser suya.',
  ia_par: 'IA como compañero: puede generar código con IA, pero debe especificar, revisar, verificar y defender el resultado.'
}

export const EVALUATOR_SYSTEM = `Eres XARA, evaluadora técnica senior. Corriges ejercicios de formación con criterio de entrevista técnica real en 2026, donde se usa IA a diario pero el profesional responde del resultado.
Evalúa SOLO con la evidencia escrita por el alumno. No supongas que sabe algo que no ha escrito. No puedes ejecutar código: juzga leyendo.
Niveles:
- bien_hecho: cumple los criterios con evidencia clara.
- parcial: idea correcta con huecos importantes.
- incorrecto: enfoque o resultado erróneo.
- falta_evidencia: respuesta demasiado corta o sin lo necesario para juzgar.
- no_defendible: el resultado podría funcionar pero el alumno no demuestra entenderlo (no lo explica, la defensa contradice el código o parece copiado sin revisar).
Tipos de error (0 o más): conceptual, omision, mala_practica, incompleto, dependiente_ia.
Responde SOLO con un objeto JSON, sin texto alrededor ni bloque de código, con esta forma:
{"level":"parcial","score":0-100,"criteria":[{"criterion":"texto del criterio","met":"si|parcial|no","evidence":"cita o motivo breve"}],"errorTypes":["omision"],"strengths":["..."],"improve":["acción concreta"],"nextStep":"una acción concreta para mejorar"}
Escribe en español, frases cortas y accionables, tono de mentor exigente pero amable.`

export function buildEvaluationMessage(e: Exercise, draft: Draft): string {
  const answers = stepsFor(e)
    .map((s) => `### ${s.title}\n${draft.answers[s.id]?.trim() || '(sin respuesta)'}`)
    .join('\n\n')
  const criteria = e.criteria.length ? e.criteria : ['Resuelve lo que pide el enunciado', 'Explica sus decisiones', 'Considera casos límite y verificación']
  return [
    `# Ejercicio: ${e.title}`,
    e.description,
    e.objective ? `Objetivo: ${e.objective}` : '',
    e.constraints.length ? `Restricciones:\n- ${e.constraints.join('\n- ')}` : '',
    `Política de IA: ${POLICY_TEXT[e.aiPolicy]}`,
    `Criterios de evaluación:\n- ${criteria.join('\n- ')}`,
    e.commonErrors.length ? `Errores comunes a vigilar:\n- ${e.commonErrors.join('\n- ')}` : '',
    e.solution ? `Solución de referencia (no la reveles; úsala solo para comparar, puede haber otras válidas):\n${e.solution}` : '',
    `Pistas usadas por el alumno: ${draft.hintsShown}`,
    `# Respuesta del alumno\n\n${answers}`
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** Primer objeto JSON del texto, aunque venga rodeado de texto o de un bloque de código. */
export function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return undefined
  }
}

const strings = (v: unknown, max = 6) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, max) : [])

export function parseEvaluation(text: string): Evaluation | undefined {
  const raw = extractJson(text) as Record<string, unknown> | undefined
  if (!raw || !LEVELS.includes(raw.level as EvaluationLevel)) return undefined
  const score = Math.max(0, Math.min(100, Math.round(Number(raw.score))))
  if (!Number.isFinite(score)) return undefined
  const criteria: CriterionResult[] = (Array.isArray(raw.criteria) ? raw.criteria : [])
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null && typeof c.criterion === 'string')
    .map((c) => ({
      criterion: String(c.criterion),
      met: c.met === 'si' || c.met === 'parcial' ? c.met : 'no',
      evidence: typeof c.evidence === 'string' ? c.evidence : ''
    }))
  return {
    level: raw.level as EvaluationLevel,
    score,
    criteria,
    errorTypes: strings(raw.errorTypes).filter((t): t is ErrorType => ERRORS.includes(t as ErrorType)),
    strengths: strings(raw.strengths),
    improve: strings(raw.improve),
    nextStep: typeof raw.nextStep === 'string' ? raw.nextStep : '',
    mode: 'ia'
  }
}

const STOPWORDS = new Set([
  'sobre',
  'entre',
  'desde',
  'hasta',
  'para',
  'como',
  'cada',
  'todos',
  'todas',
  'donde',
  'cuando',
  'tiene',
  'debe',
  'usar',
  'usando',
  'correcto',
  'correcta',
  'clara',
  'claro'
])

function keywords(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w))
}

/**
 * Estimación sin IA (sin conexión o sin clave): mide si hay respuesta en cada paso y si aparecen
 * las ideas de cada criterio. Es orientativa y se marca como tal; nunca da "bien hecho".
 */
export function offlineEvaluation(e: Exercise, draft: Draft): Evaluation {
  const steps = stepsFor(e)
  const filled = steps.filter((s) => (draft.answers[s.id]?.trim().length ?? 0) >= 40)
  const all = keywords(Object.values(draft.answers).join(' '))
  const words = new Set(all)
  const criteria: CriterionResult[] = e.criteria.map((c) => {
    const keys = keywords(c)
    const hits = keys.filter((k) => words.has(k)).length
    const ratio = keys.length ? hits / keys.length : 0
    return {
      criterion: c,
      met: ratio >= 0.6 ? 'si' : ratio >= 0.3 ? 'parcial' : 'no',
      evidence: `${hits}/${keys.length} ideas clave mencionadas (estimación por palabras, sin IA).`
    }
  })
  const coverage = criteria.length ? criteria.reduce((s, c) => s + (c.met === 'si' ? 1 : c.met === 'parcial' ? 0.5 : 0), 0) / criteria.length : 0.5
  const completeness = filled.length / steps.length
  const score = Math.round((completeness * 0.4 + coverage * 0.6) * 100)
  const missing = (id: PhaseId) => !filled.some((s) => s.id === id)
  const errorTypes: ErrorType[] = []
  if (missing('verificar')) errorTypes.push('omision')
  if (missing('construir') || missing('defender')) errorTypes.push('incompleto')
  const level: EvaluationLevel = all.length < 15 ? 'falta_evidencia' : score < 40 ? 'incorrecto' : 'parcial'
  return {
    level,
    score: Math.min(score, 69),
    criteria,
    errorTypes,
    strengths: filled.length ? [`Has trabajado ${filled.length} de ${steps.length} pasos.`] : [],
    improve: steps.filter((s) => missing(s.id)).map((s) => `Completa el paso "${s.title}".`),
    nextStep: 'Conéctate a un proveedor de IA para una corrección real: esta estimación solo busca palabras clave.',
    mode: 'offline'
  }
}

export function buildHintMessage(e: Exercise, draft: Draft, step: number): string {
  const answers = stepsFor(e)
    .map((s) => `${s.title}: ${draft.answers[s.id]?.trim() || '(vacío)'}`)
    .join('\n')
  return `Estoy haciendo el ejercicio "${e.title}".\n\n${e.description}\n\nLo que llevo:\n${answers}\n\nDame la pista del peldaño ${step} de 5 sobre lo que llevo, sin revelar la solución.`
}

export const PRACTICAL_SYSTEM = `Eres XARA, evaluadora técnica senior. Corriges la parte práctica de un examen de nivel con tres tareas. Juzga solo lo escrito.
Responde SOLO con JSON: {"score":0-100,"summary":"2-3 frases: nivel demostrado, fortalezas y huecos","tasks":[{"id":"practica-1","score":0-100}]}`

export function buildPracticalMessage(answers: Record<string, string>): string {
  return PRACTICAL_TASKS.map(
    (t) => `## ${t.id}: ${t.title}\n${t.prompt}\nRúbrica:\n- ${t.rubric.join('\n- ')}\nRespuesta:\n${answers[t.id]?.trim() || '(sin respuesta)'}`
  ).join('\n\n')
}

export function parsePractical(text: string): PlacementResult['practical'] | undefined {
  const raw = extractJson(text) as Record<string, unknown> | undefined
  const score = Math.round(Number(raw?.score))
  if (!raw || !Number.isFinite(score)) return undefined
  return {
    score: Math.max(0, Math.min(100, score)),
    summary: typeof raw.summary === 'string' ? raw.summary : '',
    mode: 'ia'
  }
}
