import { CHECKPOINT_FAILS_FOR_RETEACH, PRACTICE_PASS, PROJECT_PASS } from './constants'
import { drawItems } from './draw'
import { allPartsDone, isLessonMastered, masteryOpen } from './gating'
import { examPassed, gradeItem, isAutoGraded, lessonMasteryPassed, scoreAttempt, weakParts, type Answer, type AttemptReport } from './grading'
import { scheduleReview } from './review'
import type { ExamProgress, ExamSpec, Item, Lesson, LessonProgress, Module, ProgressV2, Tier } from './types'

// Mutaciones del progreso v2: funciones puras sobre ProgressV2 (el almacén las llama dentro de `update`).

export function ensureLesson(p: ProgressV2, lessonId: string): LessonProgress {
  p.ultimaClase = lessonId
  return (p.lessons[lessonId] ??= { partsDone: [], checkpoints: {}, reteachShown: [], pauseAnswers: {}, practice: {} })
}

export function recordReadiness(p: ProgressV2, lessonId: string, results: boolean[]): void {
  ensureLesson(p, lessonId).readiness = results.map(Boolean).slice(0, 3)
}

export function recordPartDone(p: ProgressV2, lessonId: string, partId: string): void {
  const lp = ensureLesson(p, lessonId)
  if (!lp.partsDone.includes(partId)) lp.partsDone.push(partId)
}

/** Registra un intento de la comprobación de una parte. Devuelve si toca mostrar la explicación alternativa (`reteach`). */
export function recordCheckpoint(p: ProgressV2, lessonId: string, partId: string, results: boolean[]): { reteach: boolean } {
  const lp = ensureLesson(p, lessonId)
  const history = (lp.checkpoints[partId] ??= [])
  history.push(results.length > 0 && results.every(Boolean))
  if (history.length > 20) history.splice(0, history.length - 20)
  const recent = history.slice(-CHECKPOINT_FAILS_FOR_RETEACH)
  const reteach = recent.length === CHECKPOINT_FAILS_FOR_RETEACH && recent.every((x) => !x)
  if (reteach && !lp.reteachShown.includes(partId)) lp.reteachShown.push(partId)
  return { reteach }
}

export function recordPause(p: ProgressV2, lessonId: string, key: string, text: string): void {
  ensureLesson(p, lessonId).pauseAnswers[key.slice(0, 80)] = text.slice(0, 2000)
}

export function recordPractice(
  p: ProgressV2,
  lessonId: string,
  tier: Tier,
  r: { passed: boolean; score?: number; provisional?: boolean; answer?: string; checksOk?: boolean },
  now = new Date()
): void {
  const lp = ensureLesson(p, lessonId)
  const prev = lp.practice[tier]
  const passed = !!prev?.passed || r.passed
  // «Provisional» = aprobado solo por autocomprobación. Una corrección real lo confirma y ya no vuelve a ser provisional.
  const confirmedBefore = !!prev?.passed && !prev.provisional
  const provisional = r.passed ? (confirmedBefore ? false : !!r.provisional) : !!prev?.provisional
  const score = r.score !== undefined ? Math.max(r.score, prev?.score ?? 0) : prev?.score
  const answer = r.answer !== undefined ? r.answer.slice(0, 20_000) : prev?.answer
  const checksOk = r.checksOk ?? prev?.checksOk
  lp.practice[tier] = {
    passed,
    ...(score !== undefined ? { score } : {}),
    ...(passed && provisional ? { provisional: true } : {}),
    ...(checksOk !== undefined ? { checksOk } : {}),
    attempts: (prev?.attempts ?? 0) + 1,
    firstAttemptAt: prev?.firstAttemptAt ?? now.toISOString(),
    ...(answer ? { answer } : {})
  }
}

export const practiceScorePasses = (score: number) => score >= PRACTICE_PASS

// ───────────────────────── Dominio de la clase ─────────────────────────

/** Tamaño del intento: el 80 % del banco (mínimo 8), de modo que el reintento pueda traer otros ítems. */
export const masteryAttemptSize = (n: number) => Math.min(n, Math.max(8, Math.ceil(n * 0.8)))

export function startMastery(lesson: Lesson, p: ProgressV2, rng?: () => number): Item[] {
  const lp = p.lessons[lesson.id]
  if (!masteryOpen(lesson, lp)) throw new Error('Te falta terminar las partes y aprobar la práctica A, B y C de esta clase.')
  const yaPreguntado = [...lesson.readiness, ...lesson.parts.flatMap((x) => [...x.checkpoint, ...x.scenes.flatMap((s) => (s.micro ? [s.micro] : []))]), ...lesson.practice.flatMap((e) => e.checks ?? [])]
  return drawItems(lesson.mastery.items, masteryAttemptSize(lesson.mastery.items.length), { prev: lp?.mastery?.lastItemIds, stats: p.items, yaPreguntado, rng })
}

function recordStats(p: ProgressV2, items: Item[], oks: boolean[], now: Date) {
  items.forEach((it, i) => {
    const s = (p.items[it.id] ??= { seen: 0, correct: 0, lastAt: '' })
    s.seen++
    if (oks[i]) s.correct++
    s.lastAt = now.toISOString()
  })
}

export interface MasteryOutcome {
  report: AttemptReport
  passed: boolean
  weakParts: { id: string; title: string }[]
  results: { id: string; ok: boolean; explanation: string; why?: string }[]
}

export function gradeAnswers(items: Item[], answers: Record<string, Answer>, external: Record<string, boolean> = {}) {
  const results = items.map((it) => {
    if (isAutoGraded(it)) {
      const r = gradeItem(it, answers[it.id])
      return { id: it.id, ok: r.ok, explanation: r.explanation, ...(r.why ? { why: r.why } : {}) }
    }
    return { id: it.id, ok: external[it.id] === true, explanation: it.explanation ?? '' }
  })
  return results
}

export function submitMastery(lesson: Lesson, p: ProgressV2, itemIds: string[], answers: Record<string, Answer>, now = new Date(), external: Record<string, boolean> = {}): MasteryOutcome {
  const lp = p.lessons[lesson.id]
  if (!masteryOpen(lesson, lp)) throw new Error('Te falta terminar las partes y aprobar la práctica A, B y C de esta clase.')
  const items = itemIds.map((id) => lesson.mastery.items.find((i) => i.id === id)).filter((i): i is Item => !!i)
  if (!items.length) throw new Error('No hay ítems que corregir.')
  const results = gradeAnswers(items, answers, external)
  const report = scoreAttempt(items, results.map((r) => r.ok))
  const passed = lessonMasteryPassed(report)
  recordStats(p, items, results.map((r) => r.ok), now)
  const lpw = ensureLesson(p, lesson.id)
  const prev = lpw.mastery
  lpw.mastery = {
    bestPct: Math.max(prev?.bestPct ?? 0, report.pct),
    attempts: (prev?.attempts ?? 0) + 1,
    lastItemIds: items.map((i) => i.id),
    byObjective: report.byObjective,
    ...(prev?.passedAt ? { passedAt: prev.passedAt } : passed ? { passedAt: now.toISOString() } : {})
  }
  if (passed) scheduleReview(p, lesson.id, now)
  return { report, passed, weakParts: passed ? [] : weakParts(lesson, report.weakObjectives), results }
}

// ───────────────────────── Exámenes de módulo y de nivel ─────────────────────────

export function startExam(spec: ExamSpec, p: ProgressV2, prev?: string[], rng?: () => number): Item[] {
  return drawItems(spec.bank, spec.perAttempt, { prev, stats: p.items, rng })
}

export interface ExamOutcome {
  report: AttemptReport
  /** Aprobado de la parte de preguntas (≥ 80 % y ≥ 60 % por objetivo). */
  questionsPassed: boolean
  /** Aprobado final: preguntas y tareas escritas. */
  passed: boolean
  results: { id: string; ok: boolean; explanation: string; why?: string }[]
}

export function submitExam(
  spec: ExamSpec,
  slot: { kind: 'module' | 'level'; key: string },
  p: ProgressV2,
  itemIds: string[],
  answers: Record<string, Answer>,
  opts: { now?: Date; external?: Record<string, boolean>; written?: Record<string, { score: number; provisional?: boolean }> } = {}
): ExamOutcome {
  const now = opts.now ?? new Date()
  const items = itemIds.map((id) => spec.bank.find((i) => i.id === id)).filter((i): i is Item => !!i)
  if (!items.length) throw new Error('No hay ítems que corregir.')
  const results = gradeAnswers(items, answers, opts.external)
  const report = scoreAttempt(items, results.map((r) => r.ok))
  const questionsPassed = examPassed(report)
  const written = opts.written ?? {}
  const tasks = spec.writtenTasks ?? []
  const writtenPassed = tasks.every((t) => (written[t.id]?.score ?? 0) >= PRACTICE_PASS)
  const passed = questionsPassed && writtenPassed
  recordStats(p, items, results.map((r) => r.ok), now)
  const target: Record<string, ExamProgress> = slot.kind === 'module' ? p.modules : ((p.levels[slot.key] ??= {}) as unknown as Record<string, ExamProgress>)
  const prev: ExamProgress | undefined = slot.kind === 'module' ? p.modules[slot.key] : p.levels[slot.key]?.exam
  const next: ExamProgress = {
    bestPct: Math.max(prev?.bestPct ?? 0, report.pct),
    attempts: (prev?.attempts ?? 0) + 1,
    lastItemIds: items.map((i) => i.id),
    byObjective: report.byObjective,
    written: { ...(prev?.written ?? {}), ...written },
    ...(prev?.passedAt ? { passedAt: prev.passedAt } : passed ? { passedAt: now.toISOString() } : {})
  }
  if (slot.kind === 'module') target[slot.key] = next
  else p.levels[slot.key].exam = next
  return { report, questionsPassed, passed, results }
}

/** Aprobar un examen de salto da por dominadas las clases (y, en el de nivel, los módulos) que aún no lo estaban. No programa repasos. */
export function dominarPorSalto(p: ProgressV2, lessons: Lesson[], modules: Module[], pct: number, now = new Date()): void {
  const stamp = now.toISOString()
  const aprobada = { passed: true, attempts: 0 }
  for (const l of lessons) {
    if (isLessonMastered(p.lessons[l.id])) continue
    const prev = p.lessons[l.id]
    p.lessons[l.id] = {
      readiness: prev?.readiness,
      partsDone: l.parts.map((x) => x.id),
      checkpoints: prev?.checkpoints ?? {},
      reteachShown: prev?.reteachShown ?? [],
      pauseAnswers: prev?.pauseAnswers ?? {},
      practice: { A: aprobada, B: aprobada, C: aprobada },
      mastery: { bestPct: pct, attempts: 0, lastItemIds: [], byObjective: {}, passedAt: stamp },
      porSalto: true
    }
  }
  for (const m of modules) {
    if (p.modules[m.id]?.passedAt) continue
    p.modules[m.id] = { bestPct: pct, attempts: 0, lastItemIds: [], byObjective: {}, written: {}, passedAt: stamp, porSalto: true }
  }
}

export function recordProject(p: ProgressV2, key: string, score: number, provisional: boolean, now = new Date()): void {
  const lv = (p.levels[key] ??= {})
  lv.projectScore = Math.max(lv.projectScore ?? 0, score)
  if (score >= PROJECT_PASS) {
    lv.projectProvisional = lv.projectPassedAt && lv.projectProvisional === false ? false : provisional
    lv.projectPassedAt ??= now.toISOString()
  }
}

export { allPartsDone }
