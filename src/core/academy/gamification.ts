import { challenges, findExercise } from './catalog'
import { effectiveScore, PASS_SCORE } from './level'
import type { AcademyProgress, Challenge, Difficulty } from './types'

// Puntos, racha e insignias: premian el esfuerzo que demuestra aprendizaje (aprobar, arreglar, defender), no el tiempo de pantalla.

export const XP_ATTEMPT: Record<Difficulty, number> = { principiante: 20, intermedio: 30, avanzado: 40 }
export const XP = { lesson: 10, exam: 50, interview: 30 }
const PASS_EXAM = 70

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function computeXp(p: AcademyProgress): number {
  const passed = new Set<string>()
  let xp = p.lessonsDone.length * XP.lesson
  for (const a of p.attempts) {
    const e = findExercise(a.exerciseId)
    if (!e || passed.has(e.id) || effectiveScore(a) < PASS_SCORE) continue
    passed.add(e.id)
    xp += XP_ATTEMPT[e.difficulty]
  }
  for (const id of Object.keys(p.challenges)) xp += challenges.find((c) => c.id === id)?.xp ?? 0
  xp += Object.values(p.exams).filter((e) => e.score >= PASS_EXAM).length * XP.exam
  return xp + p.interviews.length * XP.interview
}

/** Nivel de juego: cada nivel pide 50 XP más que el anterior (100, 150, 200…). */
export function xpLevel(xp: number): { level: number; current: number; needed: number } {
  let level = 1
  let needed = 100
  let rest = xp
  while (rest >= needed) {
    rest -= needed
    level++
    needed += 50
  }
  return { level, current: rest, needed }
}

/** Días seguidos con actividad. Si hoy aún no hubo actividad, la racha de ayer sigue viva. */
export function streak(activity: string[], today = new Date()): { days: number; activeToday: boolean } {
  const days = new Set(activity)
  const cursor = new Date(today)
  const activeToday = days.has(dayKey(cursor))
  if (!activeToday) cursor.setDate(cursor.getDate() - 1)
  let count = 0
  while (days.has(dayKey(cursor))) {
    count++
    cursor.setDate(cursor.getDate() - 1)
  }
  return { days: count, activeToday }
}

export interface Badge {
  id: string
  emoji: string
  title: string
  how: string
  earned: boolean
}

export function badges(p: AcademyProgress, today = new Date()): Badge[] {
  const passedAttempts = p.attempts.filter((a) => effectiveScore(a) >= PASS_SCORE)
  const rules: [Omit<Badge, 'earned'>, boolean][] = [
    [{ id: 'primer-paso', emoji: '👣', title: 'Primer paso', how: 'Termina tu primera clase' }, p.lessonsDone.length >= 1],
    [{ id: 'brujula', emoji: '🧭', title: 'Brújula', how: 'Haz el examen de nivel' }, !!p.placement],
    [{ id: 'constructor', emoji: '🛠️', title: 'Constructor', how: 'Aprueba 3 ejercicios' }, passedAttempts.length >= 3],
    [{ id: 'sin-red', emoji: '🎯', title: 'Sin red', how: 'Aprueba un ejercicio sin pedir pistas' }, passedAttempts.some((a) => a.hintsUsed === 0)],
    [{ id: 'codigo-verde', emoji: '✅', title: 'Todo en verde', how: 'Supera 5 retos de código' }, Object.keys(p.challenges).length >= 5],
    [{ id: 'examen', emoji: '🏅', title: 'Módulo dominado', how: 'Saca 90 o más en un examen de módulo' }, Object.values(p.exams).some((e) => e.score >= 90)],
    [{ id: 'defensor', emoji: '🛡️', title: 'Defensor', how: 'Aprueba 3 ejercicios de la ruta de seguridad' }, passedAttempts.filter((a) => a.exerciseId.startsWith('sec-')).length >= 3],
    [{ id: 'entrevistado', emoji: '🎤', title: 'Listo para la entrevista', how: 'Saca 70 o más en un simulacro de entrevista' }, p.interviews.some((i) => i.score >= 70)],
    [{ id: 'racha-7', emoji: '🔥', title: 'Semana en llamas', how: 'Mantén una racha de 7 días' }, streak(p.activity, today).days >= 7],
    [{ id: 'calibrado', emoji: '⚖️', title: 'Bien calibrado', how: 'Acierta tu seguridad (±1) en 5 evaluaciones' }, calibratedAttempts(p) >= 5]
  ]
  return rules.map(([b, earned]) => ({ ...b, earned }))
}

function calibratedAttempts(p: AcademyProgress): number {
  return p.attempts.filter((a) => Math.abs(a.confidence - (1 + Math.round((a.evaluation.score / 100) * 4))) <= 1).length
}

export interface Rank {
  atLevel: number
  emoji: string
  title: string
  /** Tema de color de la app que se desbloquea con el rango: un premio real que se ve en toda la interfaz. */
  theme: string
  accent: string
}

export const RANKS: Rank[] = [
  { atLevel: 1, emoji: '🌱', title: 'Aprendiz', theme: 'Azul XARA', accent: '#0071e3' },
  { atLevel: 3, emoji: '🔧', title: 'Constructor', theme: 'Menta', accent: '#00a37a' },
  { atLevel: 5, emoji: '🎨', title: 'Artesano', theme: 'Atardecer', accent: '#f2602b' },
  { atLevel: 8, emoji: '🛠️', title: 'Ingeniero', theme: 'Uva', accent: '#8e44ec' },
  { atLevel: 12, emoji: '🏛️', title: 'Arquitecto', theme: 'Oro', accent: '#c48600' },
  { atLevel: 18, emoji: '🚀', title: 'Senior en camino', theme: 'Rubí', accent: '#e0245e' }
]

export interface Unlock extends Rank {
  unlocked: boolean
}

/** Rango actual y la escalera completa con lo que ya abriste y lo que falta. */
export function ranks(level: number): { current: Rank; next?: Rank; ladder: Unlock[] } {
  const ladder = RANKS.map((r) => ({ ...r, unlocked: level >= r.atLevel }))
  const earned = RANKS.filter((r) => level >= r.atLevel)
  const current = earned[earned.length - 1] ?? RANKS[0]
  const next = RANKS.find((r) => r.atLevel > level)
  return { current, next, ladder }
}

/** Reto del día: el mismo durante todo el día, elegido entre los que aún no superaste. */
export function dailyChallenge(p: AcademyProgress, today = new Date()): Challenge | undefined {
  const pending = challenges.filter((c) => !p.challenges[c.id])
  const pool = pending.length ? pending : challenges
  if (!pool.length) return undefined
  const key = dayKey(today)
  let hash = 0
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return pool[hash % pool.length]
}
