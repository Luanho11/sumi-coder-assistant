export type Level = 'principiante' | 'intermedio' | 'avanzado' | 'proyecto'
export type Difficulty = 'principiante' | 'intermedio' | 'avanzado'
export type ExerciseKind = 'guiado' | 'practica_autonoma' | 'reto' | 'sintesis' | 'aplicacion_real' | 'entrevista'
export type EvaluationLevel = 'bien_hecho' | 'parcial' | 'incorrecto' | 'falta_evidencia' | 'no_defendible'
export type ErrorType = 'conceptual' | 'omision' | 'mala_practica' | 'incompleto' | 'dependiente_ia'
/** Cómo se permite usar IA en el ejercicio: así se trabaja en 2026, pero hay que poder defender el resultado. */
export type AiPolicy = 'sin_ia' | 'ia_tutor' | 'ia_par'
export type PhaseId = 'entender' | 'plan' | 'construir' | 'verificar' | 'defender'
export type Area = 'fundamentos' | 'frontend' | 'backend' | 'datos' | 'calidad' | 'analisis' | 'devops' | 'seguridad' | 'ia'

export interface Resource {
  kind: 'video' | 'doc'
  title: string
  url: string
  /** Para vídeos de YouTube: permite comprobar desde el equipo que sigue disponible. */
  youtubeId?: string
}

export interface QuizQuestion {
  id: string
  area: Area
  difficulty: Difficulty
  question: string
  options: string[]
  correctIndex: number
  explanation?: string
  trackId?: string
}

export interface GuidedStep {
  id: PhaseId
  title: string
  prompt: string
  checklist?: string[]
}

export interface Exercise {
  id: string
  trackId: string
  moduleId: string
  lessonId: string
  title: string
  description: string
  objective?: string
  difficulty: Difficulty
  kind: ExerciseKind
  theory: boolean
  aiPolicy: AiPolicy
  constraints: string[]
  /** Pasos propios; si faltan se usan los cinco pasos genéricos. */
  steps?: GuidedStep[]
  hints: string[]
  solution?: string
  criteria: string[]
  commonErrors: string[]
  harderVariant?: string
  skill?: string
  interviewQuestion?: string
  portfolioEvidence?: string
  resources: Resource[]
}

export interface Lesson {
  id: string
  title: string
  objective?: string
  slides: { title: string; content: string }[]
  videos: Resource[]
  quiz?: QuizQuestion
  exerciseIds: string[]
}

export interface ExamQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

/** Material extra de cada clase (data/extras): lo que hace la clase visual y cierra con "lo que aprendiste". */
export interface LessonExtra {
  emoji: string
  summary: string
  analogy: string
  learned: string[]
  check: ExamQuestion[]
  diagram?: string
}

export interface ModuleExtra {
  emoji: string
  exam: ExamQuestion[]
}

export interface TrackExtras {
  trackId: string
  lessons: Record<string, LessonExtra>
  modules: Record<string, ModuleExtra>
}

/**
 * Tipo de reto:
 * - resuelve: escribe la solución desde cero (se corrige con pruebas).
 * - bug: el `starter` trae un fallo; encuéntralo y arréglalo (se corrige con pruebas).
 * - explica: lee el código y explica qué hace; se autoevalúa contra los puntos clave.
 * - css: arregla el CSS para que la página se vea como el modelo (vista previa en vivo).
 */
export type ChallengeKind = 'resuelve' | 'bug' | 'explica' | 'css'

export interface Challenge {
  id: string
  kind?: ChallengeKind
  trackId?: string
  lessonId?: string
  area: Area
  title: string
  emoji: string
  difficulty: Difficulty
  language: 'javascript' | 'sql' | 'css'
  prompt: string
  starter: string
  solution: string
  hints: string[]
  xp: number
  functionName?: string
  tests?: { name: string; args: unknown[]; expected: unknown }[]
  /** SQL: script que crea y llena las tablas. */
  setup?: string
  ordered?: boolean
  /** explica: puntos que una buena explicación debería mencionar (para autoevaluar). */
  explainPoints?: string[]
  /** css: HTML fijo sobre el que actúa el CSS del alumno, y descripción del modelo a imitar. */
  html?: string
  model?: string
  /** Análisis estilo chess.com que se revela al resolver: por qué, la clave y errores típicos. */
  analysis?: string
}

export interface CapstoneMilestone {
  title: string
  tasks: string[]
}

/** Proyecto final de nivel laboral al terminar una ruta: para el portafolio y GitHub de LM. */
export interface Capstone {
  id: string
  trackId: string
  title: string
  emoji: string
  summary: string
  level: Difficulty
  /** Por qué este proyecto luce en una entrevista o en GitHub. */
  why: string
  features: string[]
  acceptance: string[]
  milestones: CapstoneMilestone[]
  deliverables: string[]
  stretch: string[]
  /** Cómo construirlo con IA de forma ética (especificar, revisar, verificar) y prompts de ejemplo. */
  aiGuide: { steps: string[]; samplePrompts: string[] }
}

export type InterviewKind = 'tecnica' | 'conductual' | 'diseno' | 'codigo'

export interface InterviewQuestion {
  id: string
  area: Area
  level: Difficulty
  kind: InterviewKind
  question: string
  keyPoints: string[]
  redFlags: string[]
  followUp: string
}

export interface InterviewAnswerGrade {
  questionId: string
  score: number
  covered: string[]
  missing: string[]
  feedback: string
}

export interface InterviewReport {
  at: string
  area: Area | 'mixta'
  grades: InterviewAnswerGrade[]
  score: number
  verdict: string
  mode: 'ia' | 'offline'
}

export interface AcademyModule {
  id: string
  trackId: string
  title: string
  description: string
  level: Level
  lessons: Lesson[]
  project?: { title: string; description: string; deliverables: string[] }
  roles?: string[]
  /** Dato del proyecto base de LM, sin verificar ni ajustar por país. */
  salary?: string
}

export interface Track {
  id: string
  title: string
  description: string
  area: Area
  color: string
  source: 'xara' | 'base'
  modules: AcademyModule[]
}

export interface Catalog {
  tracks: Track[]
  exercises: Exercise[]
}

export interface CriterionResult {
  criterion: string
  met: 'si' | 'parcial' | 'no'
  evidence: string
}

export interface Evaluation {
  level: EvaluationLevel
  score: number
  criteria: CriterionResult[]
  errorTypes: ErrorType[]
  strengths: string[]
  improve: string[]
  nextStep: string
  /** 'ia' si la evaluó el modelo; 'offline' si es la estimación sin IA. */
  mode: 'ia' | 'offline'
}

export interface Attempt {
  exerciseId: string
  at: string
  evaluation: Evaluation
  hintsUsed: number
  /** Seguridad declarada antes de evaluar (1-5): sirve para medir la calibración. */
  confidence: number
}

export interface Draft {
  answers: Partial<Record<PhaseId, string>>
  hintsShown: number
  updatedAt: string
}

export interface PlacementResult {
  at: string
  areas: Partial<Record<Area, { correct: number; total: number; level: Difficulty }>>
  practical?: { score: number; summary: string; mode: 'ia' | 'offline' }
  overall: CareerLevel
  recommendedTrackIds: string[]
}

import type { ProgressV2 } from './v2/types'

export interface AcademyProgress {
  attempts: Attempt[]
  drafts: Record<string, Draft>
  placement?: PlacementResult
  /** Lecciones marcadas como vistas. */
  lessonsDone: string[]
  /** Retos de código superados (id → fecha). */
  challenges: Record<string, string>
  /** Mejor nota de cada examen de módulo. */
  exams: Record<string, { score: number; at: string }>
  interviews: InterviewReport[]
  /** Días con actividad (AAAA-MM-DD, hora local) para la racha. */
  activity: string[]
  /** Progreso de los cursos v2 (niveles, compuertas, dominio, repasos). */
  v2?: ProgressV2
}

export type CareerLevel = 'inicial' | 'junior' | 'junior_plus' | 'semi_senior' | 'senior'

export interface AreaLevel {
  area: Area
  score: number
  evidence: number
  level: CareerLevel
}

export interface LevelReport {
  overall: CareerLevel
  overallScore: number
  areas: AreaLevel[]
  evidence: { exerciseId: string; title: string; score: number }[]
  /** Diferencia media entre seguridad declarada y resultado (0 = bien calibrado). */
  calibration?: number
  pendingReview: string[]
  limitingFactor?: string
}
