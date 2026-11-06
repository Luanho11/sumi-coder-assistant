import { describe, expect, it } from 'vitest'
import { allCourses, courseLessons, findCourse, findLessonV2 } from '../src/core/academy/v2/courses'
import { courseToTrack } from '../src/core/academy/v2/adapter'
import { dominarPorSalto } from '../src/core/academy/v2/engine'
import { drawItems, seededRng } from '../src/core/academy/v2/draw'
import {
  courseProgress,
  isLessonMastered,
  lessonBlocker,
  lessonStatus,
  levelExamBlocker,
  levelExamPassed,
  levelProjectBlocker,
  moduleExamPassed,
  moduleExamBlocker,
  nextAction,
  practiceOpen
} from '../src/core/academy/v2/gating'
import { examPassed, gradeItem, lessonMasteryPassed, normalize, scoreAttempt, weakParts } from '../src/core/academy/v2/grading'
import { dueReviews, gradeReview, scheduleReview } from '../src/core/academy/v2/review'
import { emptyProgressV2, type Course, type Item, type Lesson, type ProgressV2 } from '../src/core/academy/v2/types'

const item = (id: string, objective: string, extra: Partial<Item> = {}): Item => ({
  id,
  type: 'mcq',
  objective,
  bloom: 'aplicar',
  prompt: 'Pregunta de prueba',
  explanation: 'Explicación',
  options: [{ text: 'a', whyNot: 'x' }, { text: 'b' }, { text: 'c', whyNot: 'z' }, { text: 'd', whyNot: 'w' }],
  correctIndex: 1,
  ...extra
})

function lesson(id: string): Lesson {
  const scene = { kind: 'concept' as const, title: 't', content: 'c', narration: 'n' }
  return {
    id, title: `Clase ${id}`, minutes: 30,
    objectives: [{ id: `${id}-o1`, bloom: 'aplicar', text: 'Podrás algo' }],
    requires: [], teaches: [], modelsArtifacts: [], realCase: { title: 'Caso', summary: 's', sources: [] }, readiness: [], remedial: [], hook: scene,
    parts: [{ id: `${id}-p1`, title: 'Parte', objectives: [`${id}-o1`], scenes: [scene], checkpoint: [item(`${id}-cp`, `${id}-o1`)], reteach: scene }, { id: `${id}-p2`, title: 'Parte 2', objectives: [`${id}-o2`], scenes: [scene], checkpoint: [item(`${id}-cp2`, `${id}-o2`)], reteach: scene }],
    practice: [], mastery: { items: [], passPct: 80 }, wrapup: { keyIdeas: [], cheatSheet: '', commonMistakes: [], nextLesson: '' }, review: []
  }
}

const exam = { bank: [item('ex1', 'o1')], perAttempt: 10, passPct: 80, minPerObjectivePct: 60 }
const project = (id: string) => ({ id, title: `Proyecto ${id}`, brief: 'Brief', deliverables: [], milestones: [], rubric: [{ criterion: 'c', levels: { bien: 'b', parcial: 'p', falta: 'f' } }], passScore: 70, portfolioEntry: '' })
const course: Course = {
  schema: 2, status: 'published', id: 'demo', title: 'Demo', description: 'd', area: 'fundamentos', color: '#123456', audience: 'a', entryBaseline: [], outcomes: [], prerequisiteCourses: [], glossary: [],
  levels: [
    { id: 'principiante', title: 'P', promise: '', modules: [{ id: 'm1', title: 'M1', description: '', lessons: [lesson('l1'), lesson('l2')], exam }, { id: 'm2', title: 'M2', description: '', lessons: [lesson('l3')], exam }], exam, project: project('p1') },
    { id: 'intermedio', title: 'I', promise: '', modules: [{ id: 'm3', title: 'M3', description: '', lessons: [lesson('l4')], exam }], exam, project: project('p2') },
    { id: 'avanzado', title: 'A', promise: '', modules: [], exam, project: project('p3') }
  ]
}

const master = (p: ProgressV2, id: string) => {
  p.lessons[id] = { partsDone: [`${id}-p1`, `${id}-p2`], checkpoints: {}, reteachShown: [], pauseAnswers: {}, practice: { A: { passed: true, attempts: 1 }, B: { passed: true, attempts: 1 }, C: { passed: true, attempts: 1 } }, mastery: { bestPct: 90, attempts: 1, lastItemIds: [], byObjective: {}, passedAt: 'x' } }
}

describe('catálogo v2', () => {
  it('carga la muestra de oro como borrador de seguridad-web', () => {
    const c = findCourse('seguridad-web')
    expect(c?.status).toBe('draft')
    expect(allCourses.length).toBeGreaterThan(0)
    expect(findLessonV2('sec-l1')?.lesson.parts.length).toBe(4)
  })
  it('el adaptador entrega la forma antigua', () => {
    const { track, exercises } = courseToTrack(course)
    expect(track.modules.map((m) => m.level)).toEqual(['principiante', 'principiante', 'intermedio'])
    expect(exercises).toEqual([])
    const sec = courseToTrack(findCourse('seguridad-web')!)
    const clases = courseLessons(findCourse('seguridad-web')!).length
    expect(sec.exercises.map((e) => e.kind)).toEqual(Array.from({ length: clases }, () => ['guiado', 'practica_autonoma', 'aplicacion_real']).flat())
    expect(sec.track.modules[0].lessons[0].slides.length).toBeGreaterThan(10)
  })
})

describe('cadena de desbloqueo', () => {
  it('solo la primera clase está abierta al empezar', () => {
    const p = emptyProgressV2()
    expect(lessonStatus(course, 'l1', p)).toBe('disponible')
    expect(lessonStatus(course, 'l2', p)).toBe('bloqueada')
    expect(lessonStatus(course, 'l3', p)).toBe('bloqueada')
    expect(lessonStatus(course, 'l4', p)).toBe('bloqueada')
    expect(lessonBlocker(course, 'l2', p)).toMatch(/Clase l1/)
  })
  it('dominar una clase abre la siguiente de su módulo', () => {
    const p = emptyProgressV2()
    master(p, 'l1')
    expect(lessonStatus(course, 'l1', p)).toBe('dominada')
    expect(lessonBlocker(course, 'l2', p)).toBeNull()
  })
  it('para dominar hace falta práctica A, B y C y el dominio ≥ 80 %', () => {
    const p = emptyProgressV2()
    master(p, 'l1')
    delete p.lessons.l1.practice.C
    expect(isLessonMastered(p.lessons.l1)).toBe(false)
    p.lessons.l1.practice.C = { passed: true, attempts: 1 }
    delete p.lessons.l1.mastery!.passedAt
    expect(isLessonMastered(p.lessons.l1)).toBe(false)
  })
  it('el módulo siguiente exige aprobar el examen del módulo', () => {
    const p = emptyProgressV2()
    master(p, 'l1')
    master(p, 'l2')
    expect(lessonBlocker(course, 'l3', p)).toMatch(/examen del módulo «M1»/)
    expect(moduleExamBlocker(course, 'm1', p)).toBeNull()
    p.modules.m1 = { bestPct: 85, attempts: 1, lastItemIds: [], byObjective: {}, written: {}, passedAt: 'x' }
    expect(lessonBlocker(course, 'l3', p)).toBeNull()
  })
  it('el examen de módulo se puede rendir sin dominar las clases (prueba de salto)', () => {
    const p = emptyProgressV2()
    expect(moduleExamBlocker(course, 'm1', p)).toBeNull()
    master(p, 'l1')
    expect(moduleExamBlocker(course, 'm1', p)).toBeNull()
    expect(moduleExamBlocker(course, 'm3', p)).toMatch(/nivel principiante/)
  })
  it('aprobar un examen de salto da por dominadas las clases y los módulos', () => {
    const p = emptyProgressV2()
    master(p, 'l1')
    const antes = p.lessons.l1
    dominarPorSalto(p, courseLessons(course).slice(0, 3).map((r) => r.lesson), [course.levels[0].modules[1]], 88)
    expect(p.lessons.l1).toBe(antes)
    for (const id of ['l2', 'l3']) {
      expect(isLessonMastered(p.lessons[id])).toBe(true)
      expect(p.lessons[id].porSalto).toBe(true)
    }
    expect(moduleExamPassed(course.levels[0].modules[1], p)).toBe(true)
    expect(p.reviews).toEqual({})
  })
  it('el nivel siguiente exige examen y proyecto del nivel anterior', () => {
    const p = emptyProgressV2()
    for (const id of ['l1', 'l2', 'l3']) master(p, id)
    p.modules.m1 = { bestPct: 90, attempts: 1, lastItemIds: [], byObjective: {}, written: {}, passedAt: 'x' }
    p.modules.m2 = { ...p.modules.m1 }
    expect(levelExamBlocker(course, 'principiante', p)).toBeNull()
    expect(levelProjectBlocker(course, 'principiante', p)).toBeNull()
    expect(lessonBlocker(course, 'l4', p)).toMatch(/nivel principiante/)
    p.levels['demo:principiante'] = { exam: { bestPct: 90, attempts: 1, lastItemIds: [], byObjective: {}, written: {}, passedAt: 'x' } }
    expect(lessonBlocker(course, 'l4', p)).toMatch(/nivel principiante/)
    p.levels['demo:principiante'].projectPassedAt = 'x'
    expect(lessonBlocker(course, 'l4', p)).toBeNull()
    expect(levelExamBlocker(course, 'intermedio', p)).toBeNull()
  })
  it('el proyecto exige el examen del nivel o dominar sus módulos', () => {
    const p = emptyProgressV2()
    expect(levelProjectBlocker(course, 'principiante', p)).toMatch(/proyecto/)
    p.levels['demo:principiante'] = { exam: { bestPct: 90, attempts: 1, lastItemIds: [], byObjective: {}, written: {}, passedAt: 'x' } }
    expect(levelProjectBlocker(course, 'principiante', p)).toBeNull()
  })
  it('los exámenes y proyectos sin escribir no frenan el avance', () => {
    const vacio = { bank: [], perAttempt: 10, passPct: 80, minPerObjectivePct: 60 }
    const sinEscribir = { ...project('p1'), title: 'Por escribir', brief: '', rubric: [] }
    const curso: Course = {
      ...course,
      levels: [
        { ...course.levels[0], modules: [{ ...course.levels[0].modules[0], exam: vacio }, course.levels[0].modules[1]], exam: vacio, project: sinEscribir },
        course.levels[1]
      ]
    }
    const p = emptyProgressV2()
    master(p, 'l1')
    expect(lessonBlocker(curso, 'l3', p)).toMatch(/clases del módulo «M1»/)
    master(p, 'l2')
    expect(lessonBlocker(curso, 'l3', p)).toBeNull()
    expect(nextAction(curso, p)).toMatchObject({ kind: 'lesson', id: 'l3' })
    master(p, 'l3')
    p.modules.m2 = { bestPct: 90, attempts: 1, lastItemIds: [], byObjective: {}, written: {}, passedAt: 'x' }
    expect(lessonBlocker(curso, 'l4', p)).toBeNull()
    expect(levelExamPassed(curso, curso.levels[0], p)).toBe(false)
  })
  it('un nivel sin examen escrito no se da por superado si quedan clases sin dominar', () => {
    const vacio = { bank: [], perAttempt: 10, passPct: 80, minPerObjectivePct: 60 }
    const curso: Course = { ...course, levels: [{ ...course.levels[0], modules: course.levels[0].modules.map((m) => ({ ...m, exam: vacio })), exam: vacio, project: { ...project('p1'), brief: '', rubric: [] } }, course.levels[1]] }
    const p = emptyProgressV2()
    master(p, 'l1')
    master(p, 'l2')
    expect(lessonBlocker(curso, 'l4', p)).toMatch(/nivel principiante/)
    master(p, 'l3')
    expect(lessonBlocker(curso, 'l4', p)).toBeNull()
  })
  it('XARA_UNLOCK_ALL ignora las compuertas', () => {
    const p = emptyProgressV2()
    expect(lessonBlocker(course, 'l4', p, { unlockAll: true })).toBeNull()
    expect(moduleExamBlocker(course, 'm3', p, { unlockAll: true })).toBeNull()
    expect(levelExamBlocker(course, 'avanzado', p, { unlockAll: true })).toBeNull()
  })
  it('nextAction apunta a lo primero sin aprobar', () => {
    const p = emptyProgressV2()
    expect(nextAction(course, p)).toMatchObject({ kind: 'lesson', id: 'l1' })
    master(p, 'l1')
    master(p, 'l2')
    expect(nextAction(course, p)).toMatchObject({ kind: 'moduleExam', id: 'm1' })
    expect(courseProgress(course, p)).toMatchObject({ mastered: 2, total: 4, pct: 50 })
  })
  it('la práctica se abre al terminar las partes y en orden A, B, C', () => {
    const p = emptyProgressV2()
    const l = course.levels[0].modules[0].lessons[0]
    expect(practiceOpen(l, undefined, 'A')).toBe(false)
    p.lessons.l1 = { partsDone: ['l1-p1', 'l1-p2'], checkpoints: {}, reteachShown: [], pauseAnswers: {}, practice: {} }
    expect(practiceOpen(l, p.lessons.l1, 'A')).toBe(true)
    expect(practiceOpen(l, p.lessons.l1, 'B')).toBe(false)
    p.lessons.l1.practice.A = { passed: true, attempts: 1 }
    expect(practiceOpen(l, p.lessons.l1, 'B')).toBe(true)
    expect(practiceOpen(l, p.lessons.l1, 'C')).toBe(false)
  })
})

describe('umbrales', () => {
  const items = Array.from({ length: 10 }, (_, i) => item(`q${i}`, i < 5 ? 'oA' : 'oB'))
  it('79 % falla y 80 % pasa el dominio de clase', () => {
    const oks = (n: number) => items.map((_, i) => i < n)
    expect(lessonMasteryPassed(scoreAttempt(items.slice(0, 5), [true, true, true, true, false]))).toBe(true)
    expect(scoreAttempt(Array.from({ length: 100 }, (_, i) => item(`x${i}`, 'o')), Array.from({ length: 100 }, (_, i) => i < 79)).pct).toBe(79)
    expect(lessonMasteryPassed(scoreAttempt(Array.from({ length: 100 }, (_, i) => item(`x${i}`, 'o')), Array.from({ length: 100 }, (_, i) => i < 79)))).toBe(false)
    expect(lessonMasteryPassed(scoreAttempt(Array.from({ length: 100 }, (_, i) => item(`x${i}`, 'o')), Array.from({ length: 100 }, (_, i) => i < 80)))).toBe(true)
    expect(oks(8)).toHaveLength(10)
  })
  it('un objetivo por debajo de 60 % hunde el examen aunque la media pase', () => {
    // 20 ítems: objetivo A 10/10 y objetivo B 6/10 → global 80 %, B 60 % → pasa; B 5/10 → global 75 %.
    const mk = (okB: number) => {
      const its = [...Array.from({ length: 10 }, (_, i) => item(`a${i}`, 'A')), ...Array.from({ length: 10 }, (_, i) => item(`b${i}`, 'B'))]
      const oks = [...Array(10).fill(true), ...Array.from({ length: 10 }, (_, i) => i < okB)]
      return scoreAttempt(its, oks)
    }
    expect(examPassed(mk(6))).toBe(true)
    expect(examPassed(mk(5))).toBe(false)
    // Media alta pero un objetivo en 50 %: 30 ítems, A 10/10, B 10/10, C 5/10 → 83 % global y C 50 %.
    const its = [...Array.from({ length: 10 }, (_, i) => item(`a${i}`, 'A')), ...Array.from({ length: 10 }, (_, i) => item(`b${i}`, 'B')), ...Array.from({ length: 10 }, (_, i) => item(`c${i}`, 'C'))]
    const r = scoreAttempt(its, its.map((_, i) => i < 20 || i < 25))
    expect(r.pct).toBe(83)
    expect(r.byObjective.C).toBe(50)
    expect(examPassed(r)).toBe(false)
    expect(r.weakObjectives).toContain('C')
  })
  it('weakParts devuelve las partes que enseñan los objetivos fallados', () => {
    const l = lesson('z')
    expect(weakParts(l, ['z-o1']).map((p) => p.id)).toEqual(['z-p1'])
    expect(weakParts(l, ['z-o2']).map((p) => p.id)).toEqual(['z-p2'])
  })
})

describe('corrección de ítems', () => {
  it('mcq devuelve el whyNot de la opción elegida', () => {
    const it = item('a', 'o')
    expect(gradeItem(it, 1).ok).toBe(true)
    expect(gradeItem(it, 0)).toMatchObject({ ok: false, why: 'x' })
    expect(gradeItem(it, undefined).ok).toBe(false)
  })
  it('multi exige exactamente el conjunto correcto', () => {
    const it = item('m', 'o', { type: 'multi', options: [{ text: '1' }, { text: '2', whyNot: 'n' }, { text: '3' }, { text: '4', whyNot: 'n' }, { text: '5', whyNot: 'n' }], correctIndexes: [0, 2] })
    expect(gradeItem(it, [2, 0]).ok).toBe(true)
    expect(gradeItem(it, [0]).ok).toBe(false)
    expect(gradeItem(it, [0, 1, 2]).ok).toBe(false)
  })
  it('fill ignora tildes, mayúsculas y espacios', () => {
    const it = item('f', 'o', { type: 'fill', template: 'La ___', blanks: [{ accept: ['ventana de pruebas', 'ventana'] }] })
    expect(gradeItem(it, [' VENTANA  de   pruebas. ']).ok).toBe(true)
    expect(gradeItem(it, ['alcance']).ok).toBe(false)
    expect(normalize('  ¡Ventáná!  ')).toBe('ventana')
  })
  it('order, classify, match y spot', () => {
    expect(gradeItem(item('o', 'o', { type: 'order', steps: ['a', 'b', 'c', 'd'] }), ['a', 'b', 'c', 'd']).ok).toBe(true)
    expect(gradeItem(item('o', 'o', { type: 'order', steps: ['a', 'b', 'c', 'd'] }), ['b', 'a', 'c', 'd']).ok).toBe(false)
    const cl = item('c', 'o', { type: 'classify', buckets: ['X', 'Y'], cases: [{ text: '1', bucket: 'X' }, { text: '2', bucket: 'Y' }] })
    expect(gradeItem(cl, ['X', 'Y']).ok).toBe(true)
    expect(gradeItem(cl, ['Y', 'Y']).ok).toBe(false)
    const mt = item('m', 'o', { type: 'match', pairs: [{ left: 'a', right: '1' }, { left: 'b', right: '2' }] })
    expect(gradeItem(mt, { a: '1', b: '2' }).ok).toBe(true)
    expect(gradeItem(mt, { a: '2', b: '1' }).ok).toBe(false)
    const sp = item('s', 'o', { type: 'spot', artifact: 'l1\nl2\nl3', correctLines: [1, 3] })
    expect(gradeItem(sp, [3, 1]).ok).toBe(true)
    expect(gradeItem(sp, [1]).ok).toBe(false)
  })
})

describe('sorteo de exámenes', () => {
  const bank = Array.from({ length: 60 }, (_, i) => item(`b${i}`, `o${i % 6}`))
  it('cubre todos los objetivos y no repite el intento anterior mientras alcance el banco', () => {
    const first = drawItems(bank, 20, { rng: seededRng(1) })
    expect(first).toHaveLength(20)
    expect(new Set(first.map((i) => i.objective)).size).toBe(6)
    const second = drawItems(bank, 20, { rng: seededRng(2), prev: first.map((i) => i.id) })
    expect(second.some((i) => first.some((f) => f.id === i.id))).toBe(false)
    expect(new Set(second.map((i) => i.objective)).size).toBe(6)
  })
  it('con banco pequeño devuelve todo y es reproducible con semilla', () => {
    expect(drawItems(bank.slice(0, 5), 10)).toHaveLength(5)
    expect(drawItems(bank, 10, { rng: seededRng(7) }).map((i) => i.id)).toEqual(drawItems(bank, 10, { rng: seededRng(7) }).map((i) => i.id))
  })
  it('deja para el final los ítems que repiten lo que la clase ya preguntó', () => {
    const repetido = { ...item('r1', 'o1'), prompt: '¿Qué problema causó la pérdida de casos en Inglaterra?' }
    const mismo = { ...item('r2', 'o1'), prompt: 'En Inglaterra, ¿qué problema causó la pérdida de casos?' }
    const otro = { ...item('r3', 'o1'), prompt: 'Escribe una consulta con la columna nombre' }
    const sorteo = drawItems([repetido, mismo, otro], 1, { yaPreguntado: [repetido], rng: seededRng(3) })
    expect(sorteo.map((i) => i.id)).toEqual(['r3'])
  })
  it('prefiere los ítems menos vistos', () => {
    const stats = Object.fromEntries(bank.slice(0, 30).map((b) => [b.id, { seen: 5, correct: 5, lastAt: '' }]))
    const d = drawItems(bank, 20, { rng: seededRng(3), stats })
    expect(d.filter((i) => Number(i.id.slice(1)) >= 30).length).toBeGreaterThanOrEqual(15)
  })
})

describe('repaso espaciado', () => {
  const t0 = new Date('2026-01-01T10:00:00Z')
  it('programa a 1 día y recorre 3, 7 y 21 días', () => {
    const p = emptyProgressV2()
    scheduleReview(p, 'l1', t0)
    expect(dueReviews(p, t0)).toEqual([])
    const d1 = new Date(t0.getTime() + 86_400_000)
    expect(dueReviews(p, d1)).toEqual(['l1'])
    const s1 = gradeReview(p, 'l1', true, d1)
    expect(s1?.stage).toBe(1)
    expect(new Date(s1!.dueAt).getTime() - d1.getTime()).toBe(3 * 86_400_000)
    const s2 = gradeReview(p, 'l1', true, d1)
    expect(new Date(s2!.dueAt).getTime() - d1.getTime()).toBe(7 * 86_400_000)
    const s3 = gradeReview(p, 'l1', true, d1)
    expect(new Date(s3!.dueAt).getTime() - d1.getTime()).toBe(21 * 86_400_000)
    expect(gradeReview(p, 'l1', true, d1)).toBeNull()
    expect(p.reviews.l1).toBeUndefined()
  })
  it('un fallo reinicia el intervalo', () => {
    const p = emptyProgressV2()
    scheduleReview(p, 'l1', t0)
    gradeReview(p, 'l1', true, t0)
    const r = gradeReview(p, 'l1', false, t0)
    expect(r?.stage).toBe(0)
  })
})
