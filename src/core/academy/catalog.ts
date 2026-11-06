/// <reference types="vite/client" />
import base from './data/base.json'
import type { Capstone, Catalog, Challenge, Exercise, GuidedStep, InterviewQuestion, LessonExtra, ModuleExtra, Track, TrackExtras } from './types'
import { xaraExercises, xaraTrack } from './xara-track'
import { courseToTrack } from './v2/adapter'
import { allCourses } from './v2/courses'

// Contenido escrito como JSON y validado con scripts/validate-content.mjs: rutas nuevas, extras de cada clase, retos y banco de entrevista.
const newTracks = Object.values(import.meta.glob<{ track: Track; exercises: Exercise[] }>('./data/tracks/*.json', { eager: true, import: 'default' }))
const extras = Object.values(import.meta.glob<TrackExtras>('./data/extras/*.json', { eager: true, import: 'default' }))
const challengeFiles = import.meta.glob<Challenge[]>('./data/challenges.json', { eager: true, import: 'default' })
const interviewFiles = import.meta.glob<InterviewQuestion[]>('./data/interview.json', { eager: true, import: 'default' })
const capstoneFiles = import.meta.glob<Capstone[]>('./data/capstones.json', { eager: true, import: 'default' })

const legacy: Catalog = {
  tracks: [xaraTrack, ...newTracks.map((t) => t.track), ...(base.tracks as Track[])],
  exercises: [...xaraExercises, ...newTracks.flatMap((t) => t.exercises), ...(base.exercises as Exercise[])]
}

// Un curso v2 publicado reemplaza a la ruta antigua del mismo id; el adaptador conserva la forma antigua para el resto de la app.
const legacyIds = new Set(legacy.tracks.map((t) => t.id))
// Un curso nuevo en borrador solo reemplaza a la ruta antigua en la Academia; si no tiene ruta antigua, entra al catálogo para poder abrirse.
const published = allCourses.filter((c) => c.status === 'published' || !legacyIds.has(c.id)).map(courseToTrack)
const replaced = new Set(published.map((p) => p.track.id))
export const catalog: Catalog = {
  // La ruta v2 ocupa el lugar de la antigua (mismo orden en la Academia); un curso v2 sin ruta antigua se añade al final.
  tracks: [...legacy.tracks.map((t) => published.find((p) => p.track.id === t.id)?.track ?? t), ...published.filter((p) => !legacyIds.has(p.track.id)).map((p) => p.track)],
  exercises: [...legacy.exercises.filter((e) => !replaced.has(e.trackId)), ...published.flatMap((p) => p.exercises)]
}
export const challenges: Challenge[] = Object.values(challengeFiles).flat()
export const interviewBank: InterviewQuestion[] = Object.values(interviewFiles).flat()
export const capstones: Capstone[] = Object.values(capstoneFiles).flat()

export function capstoneFor(trackId: string): Capstone | undefined {
  return capstones.find((c) => c.trackId === trackId)
}

const byId = new Map(catalog.exercises.map((e) => [e.id, e]))
const lessonExtras = new Map<string, LessonExtra>(extras.flatMap((x) => Object.entries(x.lessons)))
const moduleExtras = new Map<string, ModuleExtra>(extras.flatMap((x) => Object.entries(x.modules)))

export function findExercise(id: string): Exercise | undefined {
  return byId.get(id)
}

export function findTrack(id: string): Track | undefined {
  return catalog.tracks.find((t) => t.id === id)
}

export function lessonExtra(lessonId: string): LessonExtra | undefined {
  return lessonExtras.get(lessonId)
}

export function moduleExtra(moduleId: string): ModuleExtra | undefined {
  return moduleExtras.get(moduleId)
}

export function findChallenge(id: string): Challenge | undefined {
  return challenges.find((c) => c.id === id)
}

/** Pasos guiados del ejercicio: los propios o cinco genéricos construidos con sus datos. */
export function stepsFor(e: Exercise): GuidedStep[] {
  if (e.steps?.length) return e.steps
  const build = e.theory
    ? 'Escribe tu respuesta completa: definiciones, ejemplo propio y relación con un caso real.'
    : e.aiPolicy === 'sin_ia'
      ? 'Escribe tu solución sin ayuda de IA. Si te atascas, usa las pistas: quedan registradas.'
      : 'Escribe tu solución. Puedes apoyarte en IA, pero pega aquí solo lo que entiendes y defenderías línea a línea.'
  return [
    {
      id: 'entender',
      title: 'Entender',
      prompt: 'Antes de mirar pistas: explica con tus palabras qué se pide, qué entra y qué sale, y qué dudas tienes.',
      ...(e.constraints.length ? { checklist: e.constraints } : {})
    },
    {
      id: 'plan',
      title: 'Planificar',
      prompt: 'Escribe el plan o la especificación que darías a un compañero o a un agente: pasos, casos límite y cómo sabrás que está bien.'
    },
    { id: 'construir', title: 'Construir', prompt: build },
    {
      id: 'verificar',
      title: 'Verificar',
      prompt: '¿Cómo compruebas que funciona? Escribe casos de prueba concretos y revisa si caíste en estos errores comunes.',
      ...(e.commonErrors.length ? { checklist: e.commonErrors } : {})
    },
    {
      id: 'defender',
      title: 'Defender',
      prompt: e.interviewQuestion
        ? `Pregunta de entrevista: "${e.interviewQuestion}". Respóndela en 4-6 frases usando tu solución como ejemplo.`
        : 'Explica tus decisiones, una alternativa que descartaste y por qué.'
    }
  ]
}
