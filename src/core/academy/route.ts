import { findTrack } from './catalog'
import { startModule } from './placement'
import type { AcademyModule, AcademyProgress, Track } from './types'

// Ruta recomendada: un camino de módulos en orden, armado a partir del examen de nivel.
// Sin examen se propone una ruta de inicio y se invita a hacerlo.

export interface RouteStep {
  trackId: string
  trackTitle: string
  color: string
  module: AcademyModule
  done: number
  total: number
  status: 'hecho' | 'actual' | 'pendiente'
}

const DEFAULT_TRACKS = ['javascript', 'ingenieria-ia', 'seguridad-web']
const MODULES_PER_TRACK = 3
const MAX_STEPS = 9

function modulesFrom(track: Track, progress: AcademyProgress): AcademyModule[] {
  // Quien empieza de cero arranca cada ruta por el principio, aunque haya acertado alguna pregunta difícil.
  const level = progress.placement?.overall === 'inicial' ? undefined : progress.placement?.areas[track.area]?.level
  const first = startModule(track, level)
  const index = Math.max(0, track.modules.findIndex((m) => m.id === first))
  return track.modules.slice(index, index + MODULES_PER_TRACK)
}

export function recommendedRoute(progress: AcademyProgress): RouteStep[] {
  const ids = progress.placement?.recommendedTrackIds.length ? progress.placement.recommendedTrackIds : DEFAULT_TRACKS
  const tracks = ids.map(findTrack).filter((t): t is Track => !!t)
  const done = new Set(progress.lessonsDone)
  // Se alterna entre rutas (módulo 1 de cada una, luego módulo 2…): mezclar temas fija mejor que hacer una ruta entera seguida.
  const queues = tracks.map((t) => modulesFrom(t, progress).map((module) => ({ track: t, module })))
  const steps: RouteStep[] = []
  for (let round = 0; round < MODULES_PER_TRACK; round++) {
    for (const queue of queues) {
      const item = queue[round]
      if (!item) continue
      const total = item.module.lessons.length
      const finished = item.module.lessons.filter((l) => done.has(l.id)).length
      steps.push({
        trackId: item.track.id,
        trackTitle: item.track.title,
        color: item.track.color,
        module: item.module,
        done: finished,
        total,
        status: total > 0 && finished === total ? 'hecho' : 'pendiente'
      })
    }
  }
  const current = steps.find((s) => s.status !== 'hecho')
  if (current) current.status = 'actual'
  return steps.slice(0, MAX_STEPS)
}

/** Siguiente clase sin terminar del módulo actual de la ruta. */
export function nextLesson(progress: AcademyProgress): { trackId: string; lessonId: string; title: string; moduleTitle: string } | undefined {
  const step = recommendedRoute(progress).find((s) => s.status === 'actual')
  const lesson = step?.module.lessons.find((l) => !progress.lessonsDone.includes(l.id))
  return step && lesson ? { trackId: step.trackId, lessonId: lesson.id, title: lesson.title, moduleTitle: step.module.title } : undefined
}
