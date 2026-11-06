import { splitBlocks } from '../scenes'
import { speakableText } from '../../voice'
import { masteryAttemptSize } from './engine'
import type { Lesson, Scene } from './types'

// Guion de la clase v2: la voz lee la NARRACIÓN (lo que dice el profesor) mientras los bloques de la pantalla van apareciendo.

export interface ScenePlay {
  key: string
  /** Parte a la que pertenece (null en el gancho). */
  partId: string | null
  scene: Scene
  blocks: string[]
  /** En qué fracción de la narración (0 a 1) aparece cada bloque. */
  reveals: number[]
}

const MIN_WEIGHT = 20
const weight = (t: string) => Math.max(speakableText(t).length, MIN_WEIGHT)

export function playFor(scene: Scene, key: string, partId: string | null): ScenePlay {
  const blocks = splitBlocks(scene.content)
  const total = weight(scene.title) + blocks.reduce((s, b) => s + weight(b), 0)
  let said = weight(scene.title)
  const reveals = blocks.map((b) => {
    const at = said / total
    said += weight(b)
    return at
  })
  return { key, partId, scene, blocks, reveals }
}

export interface LessonPlan {
  /** Escenas en orden: el gancho y luego las de cada parte. */
  plays: ScenePlay[]
  /** Índice de la primera y la última escena de cada parte. */
  parts: { id: string; title: string; first: number; last: number }[]
}

export function buildLessonPlan(lesson: Lesson): LessonPlan {
  const plays: ScenePlay[] = [playFor(lesson.hook, `${lesson.id}:hook`, null)]
  const parts: LessonPlan['parts'] = []
  for (const part of lesson.parts) {
    const first = plays.length
    part.scenes.forEach((s, i) => plays.push(playFor(s, `${part.id}:${i}`, part.id)))
    parts.push({ id: part.id, title: part.title, first, last: plays.length - 1 })
  }
  return { plays, parts }
}

/** Minutos de narración: unas 900 letras por minuto a ritmo de explicación (igual que el reproductor antiguo). */
export function narrationMinutes(plays: ScenePlay[]): number {
  const chars = plays.reduce((s, p) => s + speakableText(p.scene.narration).length, 0)
  return Math.max(1, Math.round(chars / 900))
}

// Tiempos por actividad, aproximados: un micro-ejercicio, una pregunta de comprobación y cada escalón de práctica.
const MIN_MICRO = 0.5
const MIN_PREGUNTA = 0.7
const MIN_PRACTICA = { A: 5, B: 8, C: 12 }
const MIN_DOMINIO_POR_PREGUNTA = 0.5

export interface Duracion {
  /** Solo la narración. */
  escucha: number
  /** Narración más micro-ejercicios y comprobaciones de cada parte. */
  clase: number
  /** Todo: clase, práctica A, B y C y comprobación final. */
  total: number
}

/** La duración sale del contenido de la clase, no de un número escrito a mano. */
export function duracionClase(lesson: Lesson): Duracion {
  const escucha = narrationMinutes(buildLessonPlan(lesson).plays)
  const micro = lesson.parts.reduce((n, p) => n + p.scenes.filter((s) => s.micro).length, 0)
  const preguntas = lesson.parts.reduce((n, p) => n + p.checkpoint.length, 0)
  const clase = Math.round(escucha + micro * MIN_MICRO + preguntas * MIN_PREGUNTA)
  const practica = lesson.practice.reduce((n, e) => n + (e.tier === 'D' ? 0 : MIN_PRACTICA[e.tier]), 0)
  const total = Math.round((clase + practica + masteryAttemptSize(lesson.mastery.items.length) * MIN_DOMINIO_POR_PREGUNTA) / 5) * 5
  return { escucha, clase, total }
}
