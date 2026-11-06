import { AREA_LABELS } from './level'
import { extractJson } from './evaluation'
import type { Area, InterviewAnswerGrade, InterviewQuestion, InterviewReport } from './types'

// Simulador de entrevista: elige preguntas, arma el mensaje para que la IA corrija y, si no hay IA, estima por palabras clave.

const KIND_LABEL: Record<InterviewQuestion['kind'], string> = {
  tecnica: 'Técnica',
  conductual: 'Conductual',
  diseno: 'Diseño de sistemas',
  codigo: 'Código'
}

export interface InterviewTurn {
  question: InterviewQuestion
  answer: string
}

/** Elige preguntas para una entrevista: por área si se indica, variando tipos. */
export function pickInterview(bank: InterviewQuestion[], area: Area | 'mixta', count = 5): InterviewQuestion[] {
  const pool = area === 'mixta' ? bank : bank.filter((q) => q.area === area)
  const source = pool.length >= count ? pool : bank
  const shuffled = [...source].sort(() => Math.random() - 0.5)
  const seenKind = new Set<string>()
  const chosen: InterviewQuestion[] = []
  // Primero una de cada tipo disponible; luego se completa.
  for (const q of shuffled) {
    if (chosen.length >= count) break
    if (!seenKind.has(q.kind)) {
      seenKind.add(q.kind)
      chosen.push(q)
    }
  }
  for (const q of shuffled) {
    if (chosen.length >= count) break
    if (!chosen.includes(q)) chosen.push(q)
  }
  return chosen
}

export const INTERVIEW_SYSTEM = `Eres XARA, entrevistadora técnica senior en 2026. Corriges las respuestas de un simulacro de entrevista con criterio realista pero con ánimo de enseñar.
Para cada respuesta juzga solo lo que el candidato escribió. Premia la claridad, los trade-offs y los ejemplos concretos; penaliza las respuestas vagas o de memoria sin entender.
Responde SOLO con un JSON válido, sin texto alrededor, con esta forma:
{"grades":[{"questionId":"...","score":0-100,"covered":["puntos clave que sí tocó"],"missing":["los que faltaron"],"feedback":"2-3 frases directas y accionables"}],"verdict":"veredicto honesto en 1-2 frases: ¿pasaría esta entrevista? qué reforzar"}`

export function buildInterviewMessage(turns: InterviewTurn[]): string {
  const blocks = turns.map((t, i) => {
    const q = t.question
    return `Pregunta ${i + 1} (id ${q.id}, ${KIND_LABEL[q.kind]}, ${AREA_LABELS[q.area]}): ${q.question}
Puntos clave esperados: ${q.keyPoints.join('; ')}
Señales de respuesta floja: ${q.redFlags.join('; ')}
Respuesta del candidato: ${t.answer.trim() || '(no respondió)'}`
  })
  return `Corrige este simulacro de entrevista. Devuelve un grade por cada pregunta, con su questionId.\n\n${blocks.join('\n\n')}`
}

export function parseInterview(text: string, turns: InterviewTurn[], now = new Date()): InterviewReport | undefined {
  const json = extractJson(text) as { grades?: InterviewAnswerGrade[]; verdict?: string } | undefined
  if (!json || !Array.isArray(json.grades) || !json.grades.length) return undefined
  const grades: InterviewAnswerGrade[] = json.grades
    .filter((g) => turns.some((t) => t.question.id === g.questionId))
    .map((g) => ({
      questionId: g.questionId,
      score: clamp(Number(g.score)),
      covered: arr(g.covered),
      missing: arr(g.missing),
      feedback: String(g.feedback ?? '').slice(0, 400)
    }))
  if (!grades.length) return undefined
  return {
    at: now.toISOString(),
    area: areaOf(turns),
    grades,
    score: Math.round(grades.reduce((s, g) => s + g.score, 0) / grades.length),
    verdict: String(json.verdict ?? '').slice(0, 400) || 'Sigue practicando: cada simulacro cuenta.',
    mode: 'ia'
  }
}

/** Estimación sin IA: puntúa por cuántos puntos clave aparecen (por palabras) en la respuesta. */
export function offlineInterview(turns: InterviewTurn[], now = new Date()): InterviewReport {
  const grades = turns.map((t): InterviewAnswerGrade => {
    const text = t.answer.toLowerCase()
    const covered = t.question.keyPoints.filter((k) => keyHit(text, k))
    const missing = t.question.keyPoints.filter((k) => !covered.includes(k))
    const ratio = t.question.keyPoints.length ? covered.length / t.question.keyPoints.length : 0
    return {
      questionId: t.question.id,
      // Sin IA no se premia tan alto: techo del 80 %.
      score: Math.round(Math.min(0.8, ratio) * 100),
      covered,
      missing,
      feedback: 'Estimación sin IA (por palabras clave). Conéctate a un proveedor para una corrección real.'
    }
  })
  return {
    at: now.toISOString(),
    area: areaOf(turns),
    grades,
    score: grades.length ? Math.round(grades.reduce((s, g) => s + g.score, 0) / grades.length) : 0,
    verdict: 'Estimación sin IA: mide cuántas ideas clave mencionaste, no cómo las explicaste.',
    mode: 'offline'
  }
}

function keyHit(text: string, key: string): boolean {
  const words = key
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
  if (!words.length) return false
  return words.filter((w) => text.includes(w)).length / words.length >= 0.5
}

function areaOf(turns: InterviewTurn[]): Area | 'mixta' {
  const areas = new Set(turns.map((t) => t.question.area))
  return areas.size === 1 ? [...areas][0] : 'mixta'
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)))
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).slice(0, 6) : []
}
