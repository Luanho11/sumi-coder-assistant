import { makeAiHooks, offlineWrittenCheck, rubricScore, type RubricGrade, type RubricLevel } from '../core/academy/v2/ai-hooks'
import { PRACTICE_PASS } from '../core/academy/v2/constants'
import { findCourse, findLessonV2, findModuleV2, allCourses } from '../core/academy/v2/courses'
import {
  dominarPorSalto,
  ensureLesson,
  gradeAnswers,
  recordCheckpoint,
  recordPartDone,
  recordPause,
  recordPractice,
  recordProject,
  recordReadiness,
  startExam,
  startMastery,
  submitExam,
  submitMastery
} from '../core/academy/v2/engine'
import { examEnPreparacion, lessonBlocker, levelExamBlocker, levelProjectBlocker, moduleExamBlocker, practiceOpen } from '../core/academy/v2/gating'
import type { Answer } from '../core/academy/v2/grading'
import { dueReviews, gradeReview } from '../core/academy/v2/review'
import { emptyProgressV2, type Item, type Tier } from '../core/academy/v2/types'
import type { AcademyProgress } from '../core/academy/types'
import type { ChatMessage } from '../core/types'
import type { AcademyView } from './academy'
import type { AcademyStore } from './storage'
import { runItem } from './sandbox'

type Handle = (channel: string, fn: (...args: any[]) => unknown) => void // eslint-disable-line @typescript-eslint/no-explicit-any

interface Deps {
  store: AcademyStore
  complete: (system: string, messages: ChatMessage[], signal: AbortSignal) => Promise<string>
}

const MAX_TEXT = 50_000
const unlockAll = () => process.env.XARA_UNLOCK_ALL === '1'
const str = (v: unknown, max = 200) => {
  if (typeof v !== 'string' || !v || v.length > max) throw new Error('Dato no válido.')
  return v
}
const text = (v: unknown) => (typeof v === 'string' ? v.slice(0, MAX_TEXT) : '')
const bools = (v: unknown) => (Array.isArray(v) ? v.map(Boolean).slice(0, 50) : [])
const levelsOf = (v: unknown): RubricLevel[] => (Array.isArray(v) ? v.filter((x): x is RubricLevel => x === 'bien' || x === 'parcial' || x === 'falta') : [])
const answersOf = (v: unknown): Record<string, Answer> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, Answer>) : {})

/** Ejecuta aquí los ítems de código y SQL con lo que escribió el alumno: la corrección no depende de lo que diga el cliente. */
async function ejecutarCodigo(items: Item[], answers: Record<string, Answer>): Promise<Record<string, boolean>> {
  const ok: Record<string, boolean> = {}
  for (const it of items) {
    const a = answers[it.id]
    if ((it.type === 'code' || it.type === 'sql') && typeof a === 'string') ok[it.id] = (await runItem(it, a)).ok
  }
  return ok
}

function lessonOrThrow(id: unknown) {
  const ref = findLessonV2(str(id))
  if (!ref) throw new Error('La clase no existe.')
  return ref
}

function findItem(id: string): Item | undefined {
  for (const c of allCourses)
    for (const lv of c.levels) {
      const pools: Item[][] = [lv.exam.bank, lv.entryCheck ?? []]
      for (const m of lv.modules) {
        pools.push(m.exam.bank)
        for (const l of m.lessons) pools.push(l.mastery.items, l.review, l.readiness, l.parts.flatMap((p) => p.checkpoint), l.practice.flatMap((e) => e.checks ?? []))
      }
      for (const pool of pools) {
        const it = pool.find((x) => x.id === id)
        if (it) return it
      }
    }
  return undefined
}

export function registerAcademyV2(handle: Handle, deps: Deps, view: (p?: AcademyProgress) => Promise<AcademyView>): void {
  const { store } = deps
  const hooks = makeAiHooks(deps.complete)
  const mutate = async (change: (v2: NonNullable<AcademyProgress['v2']>, p: AcademyProgress) => void) =>
    view(
      await store.update((p) => {
        p.v2 ??= emptyProgressV2()
        change(p.v2, p)
        const today = new Date().toISOString().slice(0, 10)
        if (!p.activity.includes(today)) p.activity.push(today)
      })
    )


  handle('v2:readiness', (lessonId: unknown, results: unknown) => {
    const ref = lessonOrThrow(lessonId)
    return mutate((v2) => recordReadiness(v2, ref.lesson.id, bools(results)))
  })

  handle('v2:partDone', (lessonId: unknown, partId: unknown) => {
    const ref = lessonOrThrow(lessonId)
    const pid = str(partId)
    if (!ref.lesson.parts.some((p) => p.id === pid)) throw new Error('La parte no existe.')
    return mutate((v2) => recordPartDone(v2, ref.lesson.id, pid))
  })

  handle('v2:checkpoint', async (lessonId: unknown, partId: unknown, results: unknown) => {
    const ref = lessonOrThrow(lessonId)
    const pid = str(partId)
    let reteach = false
    const v = await mutate((v2) => void (reteach = recordCheckpoint(v2, ref.lesson.id, pid, bools(results)).reteach))
    return { reteach, view: v }
  })

  handle('v2:pause', (lessonId: unknown, key: unknown, answer: unknown) => {
    const ref = lessonOrThrow(lessonId)
    return mutate((v2) => recordPause(v2, ref.lesson.id, str(key, 80), text(answer)))
  })

  handle('v2:reexplain', async (lessonId: unknown, partId: unknown, sceneIndex: unknown, question: unknown) => {
    const ref = lessonOrThrow(lessonId)
    const part = ref.lesson.parts.find((p) => p.id === partId)
    const scene = part?.scenes[Math.max(0, Math.min((part?.scenes.length ?? 1) - 1, Math.trunc(Number(sceneIndex) || 0)))] ?? ref.lesson.hook
    // Si no hay IA, el cliente muestra la escena `reteach` de la parte.
    return hooks.reexplain({ sceneTitle: scene.title, sceneContent: scene.content, sceneNarration: scene.narration, question: text(question).slice(0, 500) })
  })

  // ───────── Práctica escalonada ─────────
  handle('v2:practiceSubmit', async (payload: unknown) => {
    const pl = (payload ?? {}) as Record<string, unknown>
    const ref = lessonOrThrow(pl.lessonId)
    const tier = pl.tier as Tier
    const ex = ref.lesson.practice.find((e) => e.tier === tier)
    if (!ex) throw new Error('Ese ejercicio no existe.')
    const progress = await store.get()
    const lp = progress.v2?.lessons[ref.lesson.id]
    if (!unlockAll() && !practiceOpen(ref.lesson, lp, tier)) throw new Error('Todavía no puedes hacer este ejercicio: termina antes las partes y el escalón anterior.')
    const answer = text(pl.answer)
    const checkAnswers = answersOf(pl.checkAnswers)
    const checks = gradeAnswers(ex.checks ?? [], checkAnswers, await ejecutarCodigo(ex.checks ?? [], checkAnswers))
    const checksOk = checks.every((c) => c.ok)
    let grade: RubricGrade | null = null
    let passed = false
    let needsSelfCheck = false
    if (tier === 'A') {
      passed = checksOk && answer.trim().length >= 30
    } else {
      grade = answer.trim().length >= 30 ? await hooks.gradeRubric({ title: ex.title, statement: ex.statement, rubric: ex.rubric, exemplar: ex.exemplar, answer }) : null
      if (grade) passed = grade.score >= PRACTICE_PASS && (tier !== 'B' || checksOk)
      else needsSelfCheck = answer.trim().length >= 30
    }
    const v = await mutate((v2) => recordPractice(v2, ref.lesson.id, tier, { passed, ...(grade ? { score: grade.score } : {}), answer, checksOk }))
    return { checks, checksOk, grade, passed, needsSelfCheck, tooShort: answer.trim().length < 30, view: v }
  })

  handle('v2:practiceSelfCheck', async (lessonId: unknown, tier: unknown, levels: unknown) => {
    const ref = lessonOrThrow(lessonId)
    const ex = ref.lesson.practice.find((e) => e.tier === tier)
    if (!ex) throw new Error('Ese ejercicio no existe.')
    const progress = await store.get()
    const prev = progress.v2?.lessons[ref.lesson.id]?.practice[ex.tier]
    if (!prev?.firstAttemptAt) throw new Error('Primero envía tu intento y compáralo con la respuesta modelo.')
    const ls = levelsOf(levels)
    if (ls.length !== ex.rubric.length) throw new Error('Valora todos los criterios.')
    const score = rubricScore(ls)
    const passed = score >= PRACTICE_PASS && (ex.tier !== 'B' || prev.checksOk !== false)
    const v = await mutate((v2) => recordPractice(v2, ref.lesson.id, ex.tier, { passed, score, provisional: true }))
    return { score, passed, view: v }
  })

  // ───────── Dominio de la clase ─────────
  handle('v2:masteryStart', async (lessonId: unknown) => {
    const ref = lessonOrThrow(lessonId)
    const p = (await store.get()).v2 ?? emptyProgressV2()
    if (unlockAll()) {
      ensureLesson(p, ref.lesson.id)
      for (const t of ['A', 'B', 'C'] as Tier[]) p.lessons[ref.lesson.id].practice[t] ??= { passed: true, attempts: 0 }
      p.lessons[ref.lesson.id].partsDone = ref.lesson.parts.map((x) => x.id)
    }
    return startMastery(ref.lesson, p)
  })

  handle('v2:masterySubmit', async (lessonId: unknown, itemIds: unknown, answers: unknown, external: unknown) => {
    const ref = lessonOrThrow(lessonId)
    const ids = (Array.isArray(itemIds) ? itemIds : []).filter((x): x is string => typeof x === 'string').slice(0, 60)
    const ejecutados = await ejecutarCodigo(ref.lesson.mastery.items.filter((i) => ids.includes(i.id)), answersOf(answers))
    let outcome: ReturnType<typeof submitMastery> | undefined
    const v = await mutate((v2, p) => {
      if (unlockAll()) {
        ensureLesson(v2, ref.lesson.id).partsDone = ref.lesson.parts.map((x) => x.id)
        for (const t of ['A', 'B', 'C'] as Tier[]) v2.lessons[ref.lesson.id].practice[t] ??= { passed: true, attempts: 0 }
      }
      outcome = submitMastery(ref.lesson, v2, ids, answersOf(answers), new Date(), { ...(external as Record<string, boolean>), ...ejecutados })
      if (outcome.passed && !p.lessonsDone.includes(ref.lesson.id)) p.lessonsDone.push(ref.lesson.id)
    })
    return { ...outcome!, view: v }
  })

  // Corrección de una respuesta escrita suelta (ítem `written`): IA con rúbrica; sin IA, comprobación de puntos clave (provisional).
  handle('v2:gradeWritten', async (itemId: unknown, answer: unknown) => {
    const item = findItem(str(itemId))
    if (!item || item.type !== 'written') throw new Error('Ese ítem no es de respuesta escrita.')
    const ans = text(answer)
    const grade = ans.trim().length >= 20 ? await hooks.gradeRubric({ title: item.prompt.slice(0, 80), statement: item.prompt, rubric: item.rubric ?? [], exemplar: item.exemplar, answer: ans }) : null
    if (grade) return { score: grade.score, ok: grade.score >= PRACTICE_PASS, provisional: false, grade, missing: [] as string[] }
    const off = offlineWrittenCheck(item, ans)
    return { score: off.score, ok: off.score >= PRACTICE_PASS, provisional: true, grade: null, missing: off.missing }
  })

  // Ítems `code` y `sql`: se ejecutan en el sandbox del Entorno con las pruebas del propio ítem.
  handle('v2:runCode', (itemId: unknown, code: unknown) => {
    const item = findItem(str(itemId))
    if (!item || (item.type !== 'code' && item.type !== 'sql')) throw new Error('Ese ítem no se ejecuta.')
    return runItem(item, typeof code === 'string' ? code : '')
  })

  // Tareas escritas de los exámenes de nivel (rúbrica): IA; sin IA, el cliente hace la autocomprobación guiada.
  handle('v2:gradeTask', async (taskId: unknown, answer: unknown) => {
    const id = str(taskId)
    const task = allCourses.flatMap((c) => c.levels.flatMap((l) => [...(l.exam.writtenTasks ?? []), ...l.modules.flatMap((m) => m.exam.writtenTasks ?? [])])).find((t) => t.id === id)
    if (!task) throw new Error('Esa tarea no existe.')
    const ans = text(answer)
    const grade = ans.trim().length >= 50 ? await hooks.gradeRubric({ title: task.title, statement: task.statement, rubric: task.rubric, exemplar: task.exemplar, answer: ans }) : null
    return { grade, needsSelfCheck: !grade && ans.trim().length >= 50, tooShort: ans.trim().length < 50, rubric: task.rubric, exemplar: task.exemplar }
  })

  // ───────── Exámenes de módulo y de nivel ─────────
  const examSpec = (kind: unknown, id: string) => {
    if (kind === 'module') {
      const f = findModuleV2(id)
      if (!f) throw new Error('El módulo no existe.')
      return { course: f.course, spec: f.module.exam, key: id, lessons: f.module.lessons, modules: [], blocker: (p: AcademyProgress) => moduleExamBlocker(f.course, id, p.v2 ?? emptyProgressV2(), { unlockAll: unlockAll() }) }
    }
    const [courseId, levelId] = id.split(':')
    const course = findCourse(courseId)
    const level = course?.levels.find((l) => l.id === levelId)
    if (!course || !level) throw new Error('El nivel no existe.')
    return { course, spec: level.exam, key: id, lessons: level.modules.flatMap((m) => m.lessons), modules: level.modules, blocker: (p: AcademyProgress) => levelExamBlocker(course, levelId, p.v2 ?? emptyProgressV2(), { unlockAll: unlockAll() }) }
  }

  handle('v2:examStart', async (kind: unknown, id: unknown) => {
    const e = examSpec(kind, str(id))
    if (examEnPreparacion(e.spec)) throw new Error('Este examen está en preparación: todavía no tiene preguntas.')
    const p = await store.get()
    const why = e.blocker(p)
    if (why) throw new Error(why)
    const prev = kind === 'module' ? p.v2?.modules[e.key]?.lastItemIds : p.v2?.levels[e.key]?.exam?.lastItemIds
    return { items: startExam(e.spec, p.v2 ?? emptyProgressV2(), prev), writtenTasks: e.spec.writtenTasks ?? [], passPct: e.spec.passPct }
  })

  handle('v2:examSubmit', async (kind: unknown, id: unknown, itemIds: unknown, answers: unknown, external: unknown, written: unknown) => {
    const e = examSpec(kind, str(id))
    const ids = (Array.isArray(itemIds) ? itemIds : []).filter((x): x is string => typeof x === 'string').slice(0, 80)
    const wr = (typeof written === 'object' && written !== null ? written : {}) as Record<string, { score: number; provisional?: boolean }>
    const ejecutados = await ejecutarCodigo(e.spec.bank.filter((i) => ids.includes(i.id)), answersOf(answers))
    let outcome: ReturnType<typeof submitExam> | undefined
    const v = await mutate((v2) => {
      outcome = submitExam(e.spec, { kind: kind === 'module' ? 'module' : 'level', key: e.key }, v2, ids, answersOf(answers), { external: { ...(external as Record<string, boolean>), ...ejecutados }, written: wr })
      if (outcome.passed) dominarPorSalto(v2, e.lessons, e.modules, outcome.report.pct)
    })
    return { ...outcome!, view: v }
  })

  // ───────── Proyecto de nivel ─────────
  const projectOf = (courseId: unknown, levelId: unknown) => {
    const course = findCourse(str(courseId))
    const level = course?.levels.find((l) => l.id === levelId)
    if (!course || !level) throw new Error('El nivel no existe.')
    return { course, level, key: `${course.id}:${level.id}` }
  }

  handle('v2:projectSubmit', async (courseId: unknown, levelId: unknown, submission: unknown) => {
    const { course, level, key } = projectOf(courseId, levelId)
    const p = await store.get()
    const why = levelProjectBlocker(course, level.id, p.v2 ?? emptyProgressV2(), { unlockAll: unlockAll() })
    if (why) throw new Error(why)
    const sub = text(submission)
    const grade = sub.trim().length >= 50 ? await hooks.gradeRubric({ title: level.project.title, statement: `${level.project.brief}\n\nEntregables:\n- ${level.project.deliverables.join('\n- ')}`, rubric: level.project.rubric, answer: sub }) : null
    if (grade) {
      const v = await mutate((v2) => recordProject(v2, key, grade.score, false))
      return { grade, needsSelfCheck: false, passed: grade.score >= level.project.passScore, view: v }
    }
    return { grade: null, needsSelfCheck: sub.trim().length >= 50, passed: false, tooShort: sub.trim().length < 50, view: await view(p) }
  })

  handle('v2:projectSelfCheck', async (courseId: unknown, levelId: unknown, levels: unknown) => {
    const { level, key } = projectOf(courseId, levelId)
    const ls = levelsOf(levels)
    if (ls.length !== level.project.rubric.length) throw new Error('Valora todos los criterios.')
    const score = rubricScore(ls)
    const v = await mutate((v2) => recordProject(v2, key, score, true))
    return { score, passed: score >= level.project.passScore, view: v }
  })

  handle('v2:entryDone', (courseId: unknown, levelId: unknown) => {
    const { key } = projectOf(courseId, levelId)
    return mutate((v2) => void ((v2.levels[key] ??= {}).entryChecked = true))
  })

  // ───────── Repaso espaciado ─────────
  handle('v2:reviewDue', async () => {
    const p = (await store.get()).v2 ?? emptyProgressV2()
    return dueReviews(p).flatMap((id) => {
      const ref = findLessonV2(id)
      return ref ? [{ lessonId: id, title: ref.lesson.title, items: ref.lesson.review }] : []
    })
  })

  handle('v2:reviewSubmit', (lessonId: unknown, ok: unknown) => {
    const ref = lessonOrThrow(lessonId)
    return mutate((v2) => void gradeReview(v2, ref.lesson.id, ok === true))
  })

  void lessonBlocker
}
