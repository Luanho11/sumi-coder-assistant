import { courseLessons } from './courses'
import type { Course, ExamSpec, Level, Lesson, LessonProgress, Module, ProgressV2 } from './types'

// Compuertas: avanzar exige aprobar. Todo es función pura de (curso, progreso): el estado «bloqueada» se deriva, nunca se guarda.

export interface GateOpts {
  /** Solo para desarrollo y pruebas (variable XARA_UNLOCK_ALL=1): ignora todas las compuertas. */
  unlockAll?: boolean
}

export type LessonStatus = 'bloqueada' | 'disponible' | 'en_curso' | 'dominada'
export type Action =
  | { kind: 'lesson'; id: string; title: string }
  | { kind: 'moduleExam'; id: string; title: string }
  | { kind: 'levelExam'; id: string; title: string }
  | { kind: 'project'; id: string; title: string }

const key = (course: Course, level: Level) => `${course.id}:${level.id}`

export function isLessonMastered(lp: LessonProgress | undefined): boolean {
  if (!lp?.mastery?.passedAt) return false
  const p = lp.practice
  return !!(p.A?.passed && p.B?.passed && p.C?.passed)
}

export function allPartsDone(lesson: Lesson, lp: LessonProgress | undefined): boolean {
  return !!lp && lesson.parts.every((p) => lp.partsDone.includes(p.id))
}

/** La práctica y el dominio se abren al terminar todas las partes de la clase. */
export function practiceOpen(lesson: Lesson, lp: LessonProgress | undefined, tier: 'A' | 'B' | 'C' | 'D'): boolean {
  if (!allPartsDone(lesson, lp)) return false
  const p = lp?.practice ?? {}
  if (tier === 'A') return true
  if (tier === 'B') return !!p.A?.passed
  if (tier === 'C') return !!p.B?.passed
  return !!p.C?.passed
}

export type PasoClase = { kind: 'lesson' } | { kind: 'practice'; tier: 'A' | 'B' | 'C' } | { kind: 'mastery' }

/** Dónde retoma una clase: las partes sin terminar, el primer escalón sin aprobar o la comprobación final. */
export function pasoClase(lesson: Lesson, lp: LessonProgress | undefined): PasoClase {
  if (!allPartsDone(lesson, lp)) return { kind: 'lesson' }
  const tier = (['A', 'B', 'C'] as const).find((t) => !lp?.practice[t]?.passed)
  if (tier) return { kind: 'practice', tier }
  return isLessonMastered(lp) ? { kind: 'lesson' } : { kind: 'mastery' }
}

export function masteryOpen(lesson: Lesson, lp: LessonProgress | undefined): boolean {
  return allPartsDone(lesson, lp) && !!lp?.practice.A?.passed && !!lp?.practice.B?.passed && !!lp?.practice.C?.passed
}

export function moduleLessonsMastered(module: Module, p: ProgressV2): boolean {
  return module.lessons.every((l) => isLessonMastered(p.lessons[l.id]))
}
/** Un examen sin preguntas (curso en borrador) no se puede rendir: la pantalla diría «0/0». */
export const examEnPreparacion = (e: ExamSpec) => e.bank.length === 0 && !e.writtenTasks?.length
export const proyectoEnPreparacion = (level: Level) => !level.project.brief && level.project.rubric.length === 0

export const moduleExamPassed = (module: Module, p: ProgressV2) => !!p.modules[module.id]?.passedAt
export const levelExamPassed = (course: Course, level: Level, p: ProgressV2) => !!p.levels[key(course, level)]?.exam?.passedAt
export const levelProjectPassed = (course: Course, level: Level, p: ProgressV2) => !!p.levels[key(course, level)]?.projectPassedAt

// Lo que aún no está escrito no puede frenar a quien ya dominó todo lo que sí existe.
const moduloCerrado = (m: Module, p: ProgressV2) => moduleExamPassed(m, p) || examEnPreparacion(m.exam)
const examenNivelCerrado = (course: Course, level: Level, p: ProgressV2) => levelExamPassed(course, level, p) || examEnPreparacion(level.exam)
const proyectoCerrado = (course: Course, level: Level, p: ProgressV2) => levelProjectPassed(course, level, p) || proyectoEnPreparacion(level)
export const levelModulesPassed = (level: Level, p: ProgressV2) => level.modules.every((m) => moduleLessonsMastered(m, p) && moduloCerrado(m, p))
export const levelPassed = (course: Course, level: Level, p: ProgressV2) => levelModulesPassed(level, p) && examenNivelCerrado(course, level, p) && proyectoCerrado(course, level, p)

function levelBlocker(course: Course, level: Level, p: ProgressV2): string | null {
  const i = course.levels.indexOf(level)
  if (i <= 0) return null
  const prev = course.levels[i - 1]
  return levelPassed(course, prev, p) ? null : `Te falta aprobar el examen y el proyecto del nivel ${prev.id}.`
}

/** Por qué una clase está bloqueada (null si está abierta). */
export function lessonBlocker(course: Course, lessonId: string, p: ProgressV2, opts: GateOpts = {}): string | null {
  if (opts.unlockAll) return null
  const ref = courseLessons(course).find((r) => r.lesson.id === lessonId)
  if (!ref) return 'Esa clase no existe.'
  const lb = levelBlocker(course, ref.level, p)
  if (lb) return lb
  const mi = ref.level.modules.indexOf(ref.module)
  const li = ref.module.lessons.indexOf(ref.lesson)
  if (li > 0) {
    const prev = ref.module.lessons[li - 1]
    return isLessonMastered(p.lessons[prev.id]) ? null : `Te falta dominar la clase «${prev.title}»: aprobar su práctica y su comprobación con 80 %.`
  }
  if (mi > 0) {
    const prev = ref.level.modules[mi - 1]
    if (!moduleLessonsMastered(prev, p)) return `Te falta dominar todas las clases del módulo «${prev.title}».`
    if (!moduloCerrado(prev, p)) return `Te falta aprobar el examen del módulo «${prev.title}» con 80 %.`
  }
  return null
}

export function lessonStatus(course: Course, lessonId: string, p: ProgressV2, opts: GateOpts = {}): LessonStatus {
  if (lessonBlocker(course, lessonId, p, opts)) return 'bloqueada'
  const lp = p.lessons[lessonId]
  if (isLessonMastered(lp)) return 'dominada'
  const touched = !!lp && (lp.partsDone.length > 0 || !!lp.readiness || Object.keys(lp.practice).length > 0 || (lp.mastery?.attempts ?? 0) > 0)
  return touched ? 'en_curso' : 'disponible'
}

// Los exámenes de módulo y de nivel son también «pruebas de salto»: se pueden rendir sin haber cursado las clases, y al aprobarlos las dan por dominadas.
export function moduleExamBlocker(course: Course, moduleId: string, p: ProgressV2, opts: GateOpts = {}): string | null {
  if (opts.unlockAll) return null
  for (const level of course.levels) {
    if (!level.modules.some((x) => x.id === moduleId)) continue
    return levelBlocker(course, level, p)
  }
  return 'Ese módulo no existe.'
}

export function levelExamBlocker(course: Course, levelId: string, p: ProgressV2, opts: GateOpts = {}): string | null {
  if (opts.unlockAll) return null
  const level = course.levels.find((l) => l.id === levelId)
  if (!level) return 'Ese nivel no existe.'
  return levelBlocker(course, level, p)
}

/** El proyecto se abre al aprobar el examen del nivel o al dominar todos sus módulos. */
export function levelProjectBlocker(course: Course, levelId: string, p: ProgressV2, opts: GateOpts = {}): string | null {
  const lb = levelExamBlocker(course, levelId, p, opts)
  if (lb || opts.unlockAll) return lb
  const level = course.levels.find((l) => l.id === levelId)!
  return levelExamPassed(course, level, p) || levelModulesPassed(level, p) ? null : 'Para el proyecto te falta aprobar el examen del nivel o dominar todos sus módulos.'
}


/** La acción exacta que toca ahora: la primera cosa sin aprobar, en orden. */
export function nextAction(course: Course, p: ProgressV2): Action | null {
  for (const level of course.levels) {
    for (const m of level.modules) {
      for (const l of m.lessons) if (!isLessonMastered(p.lessons[l.id])) return { kind: 'lesson', id: l.id, title: l.title }
      if (!moduloCerrado(m, p)) return { kind: 'moduleExam', id: m.id, title: m.title }
    }
    if (!examenNivelCerrado(course, level, p)) return { kind: 'levelExam', id: level.id, title: level.title }
    if (!proyectoCerrado(course, level, p)) return { kind: 'project', id: level.id, title: level.project.title }
  }
  return null
}

export function courseProgress(course: Course, p: ProgressV2): { mastered: number; total: number; pct: number } {
  const lessons = courseLessons(course)
  const mastered = lessons.filter((r) => isLessonMastered(p.lessons[r.lesson.id])).length
  return { mastered, total: lessons.length, pct: lessons.length ? Math.round((mastered / lessons.length) * 100) : 0 }
}
