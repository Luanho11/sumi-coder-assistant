/// <reference types="vite/client" />
import type { Course, Level, Lesson, Module } from './types'

// Los cursos v2 son JSON en data/courses. Un curso v2 reemplaza a la ruta antigua del mismo id; «draft» marca que le faltan clases.
const files = import.meta.glob<Course>('../data/courses/*.json', { eager: true, import: 'default' })
export const allCourses: Course[] = Object.values(files).filter((c) => c && c.schema === 2)

export function findCourse(id: string): Course | undefined {
  return allCourses.find((c) => c.id === id)
}

export function publishedCourse(id: string): Course | undefined {
  return allCourses.find((c) => c.id === id && c.status === 'published')
}

export interface LessonRef {
  course: Course
  level: Level
  module: Module
  lesson: Lesson
  /** Posición de la clase en el orden pedagógico del curso (0 = la primera). */
  order: number
}

/** Todas las clases de un curso en el orden en que se enseñan. */
export function courseLessons(course: Course): LessonRef[] {
  const out: LessonRef[] = []
  for (const level of course.levels)
    for (const module of level.modules) for (const lesson of module.lessons) out.push({ course, level, module, lesson, order: out.length })
  return out
}

export function findLessonV2(lessonId: string): LessonRef | undefined {
  for (const course of allCourses) {
    const ref = courseLessons(course).find((r) => r.lesson.id === lessonId)
    if (ref) return ref
  }
  return undefined
}

export function findModuleV2(moduleId: string): { course: Course; level: Level; module: Module } | undefined {
  for (const course of allCourses)
    for (const level of course.levels) {
      const module = level.modules.find((m) => m.id === moduleId)
      if (module) return { course, level, module }
    }
  return undefined
}

/** Los niveles de un curso que ya tienen clases escritas, para decir con claridad qué se puede estudiar hoy. */
export const nivelesEscritos = (course: Course): string[] => course.levels.filter((l) => l.modules.some((m) => m.lessons.length > 0)).map((l) => l.title.toLowerCase())
