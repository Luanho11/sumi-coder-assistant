import { describe, expect, it } from 'vitest'
import { findLessonV2 } from '../src/core/academy/v2/courses'
import { offlineWrittenCheck, parseRubricGrade, rubricScore } from '../src/core/academy/v2/ai-hooks'
import { masteryAttemptSize, recordCheckpoint, recordPartDone, recordPractice, recordProject, startExam, startMastery, submitExam, submitMastery } from '../src/core/academy/v2/engine'
import { isLessonMastered, masteryOpen, pasoClase } from '../src/core/academy/v2/gating'
import { seededRng } from '../src/core/academy/v2/draw'
import { duracionClase } from '../src/core/academy/v2/scenes'
import { emptyProgressV2, type Item, type Tier } from '../src/core/academy/v2/types'

const lesson = findLessonV2('sec-l1')!.lesson

function ready() {
  const p = emptyProgressV2()
  for (const part of lesson.parts) recordPartDone(p, lesson.id, part.id)
  for (const t of ['A', 'B', 'C'] as Tier[]) recordPractice(p, lesson.id, t, { passed: true, score: 85 })
  return p
}
const answerAll = (items: Item[], good: boolean): Record<string, never> => {
  const a: Record<string, unknown> = {}
  for (const it of items) {
    if (it.type === 'mcq') a[it.id] = good ? it.correctIndex : (it.correctIndex! + 1) % 4
    else if (it.type === 'multi') a[it.id] = good ? it.correctIndexes : [0]
    else if (it.type === 'order') a[it.id] = good ? it.steps : [...(it.steps ?? [])].reverse()
    else if (it.type === 'classify') a[it.id] = (it.cases ?? []).map((c) => (good ? c.bucket : (it.buckets ?? []).find((b) => b !== c.bucket)))
    else if (it.type === 'fill') a[it.id] = (it.blanks ?? []).map((b) => (good ? b.accept[0] : 'zzz'))
    else if (it.type === 'spot') a[it.id] = good ? it.correctLines : [1]
  }
  return a as Record<string, never>
}

describe('dominio de la clase', () => {
  it('no se abre hasta terminar las partes y aprobar A, B y C', () => {
    const p = emptyProgressV2()
    expect(masteryOpen(lesson, p.lessons[lesson.id])).toBe(false)
    expect(() => startMastery(lesson, p)).toThrow(/Te falta/)
    expect(() => submitMastery(lesson, p, ['sec-l1-m1'], {})).toThrow(/Te falta/)
  })
  it('un intento perfecto domina la clase, programa el repaso y registra las estadísticas', () => {
    const p = ready()
    const items = startMastery(lesson, p, seededRng(1))
    expect(items).toHaveLength(masteryAttemptSize(lesson.mastery.items.length))
    const r = submitMastery(lesson, p, items.map((i) => i.id), answerAll(items, true))
    expect(r.passed).toBe(true)
    expect(r.report.pct).toBe(100)
    expect(isLessonMastered(p.lessons[lesson.id])).toBe(true)
    expect(p.reviews[lesson.id]).toBeDefined()
    expect(Object.keys(p.items).length).toBe(items.length)
  })
  it('un intento fallido no domina y señala las partes a repasar; el reintento trae otros ítems', () => {
    const p = ready()
    const first = startMastery(lesson, p, seededRng(2))
    const r = submitMastery(lesson, p, first.map((i) => i.id), answerAll(first, false))
    expect(r.passed).toBe(false)
    expect(r.weakParts.length).toBeGreaterThan(0)
    expect(isLessonMastered(p.lessons[lesson.id])).toBe(false)
    expect(p.reviews[lesson.id]).toBeUndefined()
    const second = startMastery(lesson, p, seededRng(3))
    const unseen = second.filter((i) => !first.some((f) => f.id === i.id))
    expect(unseen.length).toBeGreaterThan(0)
  })
  it('el mejor porcentaje se conserva y el aprobado no se pierde al fallar después', () => {
    const p = ready()
    const items = startMastery(lesson, p, seededRng(4))
    submitMastery(lesson, p, items.map((i) => i.id), answerAll(items, true))
    const again = startMastery(lesson, p, seededRng(5))
    submitMastery(lesson, p, again.map((i) => i.id), answerAll(again, false))
    expect(p.lessons[lesson.id].mastery?.bestPct).toBe(100)
    expect(p.lessons[lesson.id].mastery?.passedAt).toBeDefined()
  })
})

describe('duración de la clase', () => {
  it('sale del contenido y crece de la escucha a la clase y al total', () => {
    const d = duracionClase(lesson)
    expect(d.escucha).toBeGreaterThan(5)
    expect(d.clase).toBeGreaterThan(d.escucha)
    expect(d.total).toBeGreaterThan(d.clase)
  })
})

describe('retomar una clase', () => {
  it('abre donde toca: partes, escalón sin aprobar, comprobación final', () => {
    const p = emptyProgressV2()
    expect(pasoClase(lesson, p.lessons[lesson.id])).toEqual({ kind: 'lesson' })
    for (const part of lesson.parts) recordPartDone(p, lesson.id, part.id)
    expect(pasoClase(lesson, p.lessons[lesson.id])).toEqual({ kind: 'practice', tier: 'A' })
    recordPractice(p, lesson.id, 'A', { passed: true, score: 85 })
    expect(pasoClase(lesson, p.lessons[lesson.id])).toEqual({ kind: 'practice', tier: 'B' })
    recordPractice(p, lesson.id, 'B', { passed: true, score: 85 })
    recordPractice(p, lesson.id, 'C', { passed: true, score: 85 })
    expect(pasoClase(lesson, p.lessons[lesson.id])).toEqual({ kind: 'mastery' })
  })
  it('recuerda la última clase con la que se trabajó', () => {
    const p = emptyProgressV2()
    recordPartDone(p, lesson.id, lesson.parts[0].id)
    expect(p.ultimaClase).toBe(lesson.id)
  })
})

describe('comprobaciones, práctica y proyecto', () => {
  it('dos fallos seguidos activan la explicación alternativa', () => {
    const p = emptyProgressV2()
    expect(recordCheckpoint(p, 'x', 'x-p1', [false]).reteach).toBe(false)
    expect(recordCheckpoint(p, 'x', 'x-p1', [false, true]).reteach).toBe(true)
    expect(recordCheckpoint(p, 'x', 'x-p2', [true]).reteach).toBe(false)
    expect(recordCheckpoint(p, 'x', 'x-p1', [true]).reteach).toBe(false)
  })
  it('el aprobado provisional se confirma con una corrección real y no vuelve a ser provisional', () => {
    const p = emptyProgressV2()
    recordPractice(p, 'x', 'C', { passed: true, score: 75, provisional: true })
    expect(p.lessons.x.practice.C).toMatchObject({ passed: true, provisional: true, attempts: 1 })
    recordPractice(p, 'x', 'C', { passed: true, score: 80 })
    expect(p.lessons.x.practice.C?.provisional).toBeUndefined()
    recordPractice(p, 'x', 'C', { passed: true, score: 72, provisional: true })
    expect(p.lessons.x.practice.C?.provisional).toBeUndefined()
    expect(p.lessons.x.practice.C?.score).toBe(80)
  })
  it('un intento fallido después de aprobar no quita el aprobado', () => {
    const p = emptyProgressV2()
    recordPractice(p, 'x', 'B', { passed: true, score: 90 })
    recordPractice(p, 'x', 'B', { passed: false, score: 20 })
    expect(p.lessons.x.practice.B?.passed).toBe(true)
    expect(p.lessons.x.practice.B?.attempts).toBe(2)
  })
  it('el proyecto aprueba con 70 y se queda provisional si fue por autocomprobación', () => {
    const p = emptyProgressV2()
    recordProject(p, 'c:principiante', 69, true)
    expect(p.levels['c:principiante'].projectPassedAt).toBeUndefined()
    recordProject(p, 'c:principiante', 70, true)
    expect(p.levels['c:principiante'].projectPassedAt).toBeDefined()
    expect(p.levels['c:principiante'].projectProvisional).toBe(true)
  })
})

describe('exámenes', () => {
  const bank: Item[] = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, type: 'mcq', objective: i < 15 ? 'oA' : 'oB', bloom: 'aplicar', prompt: 'p', options: [{ text: 'a', whyNot: 'x' }, { text: 'b' }, { text: 'c', whyNot: 'x' }, { text: 'd', whyNot: 'x' }], correctIndex: 1, explanation: 'e' }))
  const spec = { bank, perAttempt: 10, passPct: 80, minPerObjectivePct: 60, writtenTasks: [{ id: 't1' }] as never }
  it('aprueba con ≥ 80 % y las tareas escritas aprobadas; sin tareas escritas no aprueba', () => {
    const p = emptyProgressV2()
    const items = startExam(spec, p, undefined, seededRng(1))
    const good = Object.fromEntries(items.map((i) => [i.id, 1]))
    const noTask = submitExam(spec, { kind: 'module', key: 'm1' }, p, items.map((i) => i.id), good)
    expect(noTask.questionsPassed).toBe(true)
    expect(noTask.passed).toBe(false)
    expect(p.modules.m1.passedAt).toBeUndefined()
    const ok = submitExam(spec, { kind: 'module', key: 'm1' }, p, items.map((i) => i.id), good, { written: { t1: { score: 75, provisional: true } } })
    expect(ok.passed).toBe(true)
    expect(p.modules.m1.passedAt).toBeDefined()
    expect(p.modules.m1.attempts).toBe(2)
  })
  it('el examen de nivel se guarda bajo su clave y un 79 % no aprueba', () => {
    const p = emptyProgressV2()
    const s2 = { ...spec, writtenTasks: [], perAttempt: 28 }
    const items = startExam(s2, p, undefined, seededRng(9))
    const answers = Object.fromEntries(items.map((i, k) => [i.id, k < 22 ? 1 : 0]))
    const r = submitExam(s2, { kind: 'level', key: 'c:intermedio' }, p, items.map((i) => i.id), answers)
    expect(r.report.pct).toBe(79)
    expect(r.passed).toBe(false)
    expect(p.levels['c:intermedio'].exam?.passedAt).toBeUndefined()
  })
})

describe('ganchos de IA', () => {
  const rubric = [{ criterion: 'Uno', levels: { bien: 'a', parcial: 'b', falta: 'c' } }, { criterion: 'Dos', levels: { bien: 'a', parcial: 'b', falta: 'c' } }]
  it('la puntuación sale de los niveles de la rúbrica', () => {
    expect(rubricScore(['bien', 'bien'])).toBe(100)
    expect(rubricScore(['bien', 'parcial'])).toBe(75)
    expect(rubricScore(['falta', 'falta'])).toBe(0)
  })
  it('parsea la respuesta de la IA, alineada con la rúbrica aunque falten o sobren criterios', () => {
    const g = parseRubricGrade('```json\n{"criteria":[{"criterion":"Uno","level":"bien","evidence":"ok"},{"criterion":"Inventado","level":"bien"}],"strengths":["a"],"improve":[],"nextStep":"x"}\n```', rubric)
    expect(g?.criteria).toHaveLength(2)
    expect(g?.criteria[0].level).toBe('bien')
    expect(g?.criteria[1].criterion).toBe('Dos')
    expect(parseRubricGrade('no es json', rubric)).toBeUndefined()
  })
  it('el respaldo sin conexión de respuestas escritas mide puntos clave y longitud', () => {
    const item = { id: 'w', type: 'written', objective: 'o', bloom: 'crear', prompt: 'p', minWords: 5, offlineChecklist: [{ criterion: 'Alcance', anyOf: ['alcance'] }, { criterion: 'Ventana', anyOf: ['ventana', 'horario'] }, { criterion: 'Contacto', anyOf: ['contacto'] }] } as Item
    expect(offlineWrittenCheck(item, 'El alcance es la app y la ventana es el sábado, con contacto de emergencia').score).toBe(100)
    const low = offlineWrittenCheck(item, 'solo alcance corto')
    expect(low.score).toBeLessThanOrEqual(40)
    expect(low.missing).toContain('Ventana')
    expect(low.provisional).toBe(true)
  })
})
