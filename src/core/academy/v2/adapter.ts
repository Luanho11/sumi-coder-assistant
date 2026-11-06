import type { AcademyModule, Exercise as LegacyExercise, ExerciseKind, Track } from '../types'
import type { Course, Exercise, Tier } from './types'

// Adaptador: los módulos antiguos (nivel, ranking, ruta recomendada, gamificación) siguen leyendo la forma antigua.
const KIND: Record<Tier, ExerciseKind> = { A: 'guiado', B: 'practica_autonoma', C: 'aplicacion_real', D: 'sintesis' }

function toLegacyExercise(e: Exercise, trackId: string, moduleId: string, lessonId: string, difficulty: LegacyExercise['difficulty']): LegacyExercise {
  return {
    id: e.id,
    trackId,
    moduleId,
    lessonId,
    title: e.title,
    description: e.statement,
    difficulty,
    kind: KIND[e.tier],
    theory: false,
    aiPolicy: e.aiPolicy,
    constraints: [],
    hints: e.hints.map((h) => h.text),
    solution: e.exemplar,
    criteria: e.rubric.map((r) => r.criterion),
    commonErrors: e.commonErrors,
    ...(e.interviewQuestion ? { interviewQuestion: e.interviewQuestion } : {}),
    resources: []
  }
}

export function courseToTrack(course: Course): { track: Track; exercises: LegacyExercise[] } {
  const exercises: LegacyExercise[] = []
  const modules: AcademyModule[] = course.levels.flatMap((level) =>
    level.modules.map((m) => ({
      id: m.id,
      trackId: course.id,
      title: m.title,
      description: m.description,
      level: level.id,
      lessons: m.lessons.map((l) => {
        for (const e of l.practice) exercises.push(toLegacyExercise(e, course.id, m.id, l.id, level.id))
        return {
          id: l.id,
          title: l.title,
          objective: l.objectives[0]?.text,
          slides: [l.hook, ...l.parts.flatMap((p) => p.scenes)].map((s) => ({ title: s.title, content: s.content })),
          videos: [],
          exerciseIds: l.practice.map((e) => e.id)
        }
      })
    }))
  )
  return {
    track: { id: course.id, title: course.title, description: course.description, area: course.area, color: course.color, source: 'xara', modules },
    exercises
  }
}
