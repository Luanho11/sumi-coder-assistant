import type { Area } from '../types'

// Esquema v2 de los cursos: tres niveles, clases largas con partes y comprobaciones, práctica en escalera y compuertas.
// Es el contrato descrito en docs/pedagogia/ESTANDAR.md; el validador scripts/validate-content-v2.mjs lo hace cumplir.

export type LevelId = 'principiante' | 'intermedio' | 'avanzado'
export type Bloom = 'recordar' | 'comprender' | 'aplicar' | 'analizar' | 'evaluar' | 'crear'
export type SceneKind =
  | 'hook'
  | 'story'
  | 'concept'
  | 'definition'
  | 'analogy'
  | 'worked-example'
  | 'faded-example'
  | 'non-example'
  | 'misconception'
  | 'compare'
  | 'pause-think'
  | 'demo'
  | 'recap'
export type ItemType = 'mcq' | 'multi' | 'order' | 'classify' | 'fill' | 'match' | 'spot' | 'code' | 'sql' | 'written'
export type Tier = 'A' | 'B' | 'C' | 'D'

export interface Criterion {
  criterion: string
  objective?: string
  levels: { bien: string; parcial: string; falta: string }
}

export interface Scene {
  kind: SceneKind
  title: string
  content: string
  narration: string
  glossaryRefs?: string[]
  artifact?: string
  /** Mini-ejercicio rápido tras esta idea: se oye, se responde y se oye la explicación. */
  micro?: Item
  /** Historia (hook y story): la cifra o el año que ocupa la pantalla, p. ej. «1989» o «114.000». */
  stamp?: string
  /** Lugar y fecha del hecho, p. ej. «CERN, Ginebra · 12 de marzo de 1989». */
  dateline?: string
  /** Fuente del hecho real (nombre corto que se ve en pantalla). */
  source?: string
  /** Viñeta inventada para ilustrar; se rotula como «Imaginemos». Nunca en el gancho. */
  imagined?: boolean
}

export interface Option {
  text: string
  whyNot?: string
}

export interface Item {
  id: string
  type: ItemType
  objective: string
  bloom: Bloom
  prompt: string
  explanation?: string
  options?: Option[]
  correctIndex?: number
  correctIndexes?: number[]
  steps?: string[]
  buckets?: string[]
  cases?: { text: string; bucket: string }[]
  template?: string
  blanks?: { accept: string[] }[]
  pairs?: { left: string; right: string }[]
  artifact?: string
  correctLines?: number[]
  starter?: string
  solution?: string
  tests?: { name?: string; args: unknown[]; expected: unknown }[]
  functionName?: string
  setup?: string
  rubric?: Criterion[]
  exemplar?: string
  minWords?: number
  offlineChecklist?: { criterion: string; anyOf: string[] }[]
}

export interface Part {
  id: string
  title: string
  /** Objetivos de la clase que esta parte enseña: las comprobaciones y micro-ejercicios miden solo estos. */
  objectives: string[]
  scenes: Scene[]
  checkpoint: Item[]
  reteach: Scene
}

export interface Exercise {
  id: string
  tier: Tier
  title: string
  statement: string
  decoded: { youAreAsked: string[]; terms: string[]; doNotNeed?: string[] }
  produces?: string
  aiPolicy: 'sin_ia' | 'ia_tutor' | 'ia_par'
  objectives: string[]
  scaffold?: string
  steps: { id: string; title: string; prompt: string; checklist?: string[] }[]
  hints: { text: string; taughtIn: string }[]
  exemplar: string
  exemplarNotes: string[]
  rubric: Criterion[]
  commonErrors: string[]
  selfCheck: string[]
  checks?: Item[]
  interviewQuestion?: string
  harderVariant?: string
  legacyId?: string
  challengeId?: string
}

export interface Lesson {
  id: string
  title: string
  minutes: number
  objectives: { id: string; bloom: Bloom; text: string }[]
  requires: string[]
  teaches: string[]
  modelsArtifacts: string[]
  readiness: Item[]
  remedial: { lessonId?: string; refresher?: string }[]
  /** El caso real que recorre la clase: hechos con fuente verificable. */
  realCase: { title: string; summary: string; sources: { title: string; url: string; claim: string }[] }
  hook: Scene
  parts: Part[]
  practice: Exercise[]
  mastery: { items: Item[]; passPct: number }
  wrapup: { keyIdeas: string[]; cheatSheet: string; commonMistakes: { mistake: string; fix: string }[]; nextLesson: string }
  review: Item[]
  resources?: { kind: 'doc' | 'video'; title: string; url: string }[]
  verify?: string[]
}

export interface GlossaryTerm {
  id: string
  term: string
  aliases?: string[]
  plain: string
  example: string
  nonExample?: string
  firstTaughtIn: string
}

export interface ExamSpec {
  bank: Item[]
  perAttempt: number
  passPct: number
  minPerObjectivePct: number
  writtenTasks?: Exercise[]
}

export interface Project {
  id: string
  title: string
  brief: string
  deliverables: string[]
  milestones: { title: string; tasks: string[] }[]
  rubric: Criterion[]
  passScore: number
  portfolioEntry: string
}

export interface Module {
  id: string
  title: string
  description: string
  lessons: Lesson[]
  exam: ExamSpec
}

export interface Level {
  id: LevelId
  title: string
  promise: string
  entryCheck?: Item[]
  modules: Module[]
  exam: ExamSpec
  project: Project
}

export interface Course {
  schema: 2
  status: 'draft' | 'published'
  id: string
  title: string
  description: string
  area: Area
  color: string
  audience: string
  entryBaseline: string[]
  outcomes: string[]
  prerequisiteCourses: string[]
  glossary: GlossaryTerm[]
  levels: Level[]
  legacy?: { replacesModules: string[]; keptExerciseIds: string[] }
}

// ───────────────────────── Progreso ─────────────────────────

export interface PracticeResult {
  passed: boolean
  score?: number
  /** Corregido sin conexión o por autocomprobación: se acepta para avanzar pero se confirma cuando haya corrección real. */
  provisional?: boolean
  /** Comprobaciones automáticas superadas en el último intento (en B se exigen además de la rúbrica). */
  checksOk?: boolean
  attempts: number
  firstAttemptAt?: string
  answer?: string
}

export interface MasteryResult {
  bestPct: number
  attempts: number
  lastItemIds: string[]
  byObjective: Record<string, number>
  passedAt?: string
}

export interface LessonProgress {
  readiness?: boolean[]
  partsDone: string[]
  checkpoints: Record<string, boolean[]>
  reteachShown: string[]
  pauseAnswers: Record<string, string>
  practice: Partial<Record<Tier, PracticeResult>>
  mastery?: MasteryResult
  /** Dominada al aprobar un examen de módulo o de nivel, sin cursarla. */
  porSalto?: boolean
}

export interface ExamProgress extends MasteryResult {
  written: Record<string, { score: number; provisional?: boolean }>
  /** Aprobado como examen de nivel que saltó el módulo, sin rendir el suyo. */
  porSalto?: boolean
}

export interface LevelProgress {
  exam?: ExamProgress
  projectScore?: number
  projectProvisional?: boolean
  projectPassedAt?: string
  entryChecked?: boolean
}

export interface ItemStat {
  seen: number
  correct: number
  lastAt: string
}

export interface ReviewState {
  /** Etapa del repaso espaciado (0 = a 1 día, 1 = a 3, 2 = a 7, 3 = a 21). */
  stage: number
  dueAt: string
}

export interface ProgressV2 {
  /** La última clase con la que se trabajó: Inicio la ofrece para continuar. */
  ultimaClase?: string
  lessons: Record<string, LessonProgress>
  modules: Record<string, ExamProgress>
  levels: Record<string, LevelProgress>
  items: Record<string, ItemStat>
  reviews: Record<string, ReviewState>
}

export const emptyProgressV2 = (): ProgressV2 => ({ lessons: {}, modules: {}, levels: {}, items: {}, reviews: {} })
