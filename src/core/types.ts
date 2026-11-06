// Tipos compartidos entre main, preload y renderer. Sin dependencias de Electron.

/**
 * Acción solicitada a XARA.
 * - analyze: primera consulta de un problema (flujo completo).
 * - hint / debug / review / tests / explain: acciones rápidas sobre la sesión.
 * - followup: pregunta libre de aclaración.
 */
export type CopilotAction = 'analyze' | 'hint' | 'debug' | 'review' | 'tests' | 'explain' | 'followup' | 'lesson'

export type Role = 'user' | 'assistant'

export interface ImageAttachment {
  mimeType: 'image/png' | 'image/jpeg'
  /** Contenido en base64, sin el prefijo `data:`. */
  data: string
}

export interface ChatMessage {
  role: Role
  content: string
  images?: ImageAttachment[]
}

export interface TurnUsage {
  inputTokens?: number
  outputTokens?: number
}

export type TurnStatus = 'streaming' | 'done' | 'error' | 'cancelled'

export interface Turn {
  id: string
  action: CopilotAction
  input: string
  /** Respuesta en Markdown con secciones `## ...`. */
  output: string
  status: TurnStatus
  error?: ProviderErrorInfo
  providerId: string
  model: string
  createdAt: string
  durationMs?: number
  usage?: TurnUsage
  /** Temas técnicos detectados en la respuesta (para el perfil de aprendizaje). */
  topics?: string[]
  /** Valoración del usuario: alimenta el perfil que se reutiliza en consultas futuras. */
  feedback?: TurnFeedback
  /** La consulta incluía una captura. La imagen no se guarda en el historial. */
  hadImage?: boolean
  /** Datos sobre el usuario que XARA decidió guardar en la memoria durante este turno. */
  remembered?: string[]
}

export interface TurnFeedback {
  rating: 'up' | 'down'
  note?: string
  at: string
}

/** Configuración editable del perfil de aprendizaje (profile.json). */
export interface LearningProfile {
  /** Si es false, no se añade memoria a las consultas. */
  enabled: boolean
  /** Preferencias escritas por el usuario, p. ej. "Prefiero TypeScript y respuestas cortas". */
  preferences: string
  /** Memoria persistente: hechos sobre el usuario que XARA tiene siempre presentes. */
  facts: MemoryFact[]
}

export interface MemoryFact {
  id: string
  text: string
  /** inicial: lo que se sabía al instalar; xara: lo guardó ella conversando; usuario: lo escribió el usuario. */
  source: 'inicial' | 'xara' | 'usuario'
  at: string
}

export interface TopicStat {
  topic: string
  sessions: number
  /** Señales de dificultad: pistas, explicaciones, depuraciones y valoraciones negativas. */
  struggle: number
}

/** Lo que la app ha aprendido del uso, calculado a partir del historial local. */
export interface ProfileInsights {
  sessionCount: number
  ratedUp: number
  ratedDown: number
  topTopics: TopicStat[]
  weakTopics: TopicStat[]
  /** Motivos de valoraciones negativas más frecuentes. */
  dislikes: { note: string; count: number }[]
}

export interface ProfileView extends LearningProfile {
  insights: ProfileInsights
  /** Texto exacto que se añade al prompt (transparencia). */
  promptBlock: string
}

export interface Session {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  turns: Turn[]
}

export interface SessionSummary {
  id: string
  title: string
  updatedAt: string
  turnCount: number
}

export type ProviderId = 'gemini' | 'groq' | 'ollama'

export interface Settings {
  providerId: ProviderId
  models: Record<ProviderId, string>
  ollamaUrl: string
  alwaysOnTop: boolean
  observer: ObserverSettings
  /** Permiso para que XARA modifique archivos del disco (con diff y copia de seguridad). Desactivado por defecto. */
  codeFix: boolean
  voice: VoiceSettings
}

export interface VoiceSettings {
  /** fish: voz Verity (Fish Audio); gemini: voz de la API de Gemini; sistema: voces de Windows, sin conexión. */
  engine: 'fish' | 'gemini' | 'sistema'
  /** Leer en voz alta cada respuesta de XARA al terminar. */
  autoRead: boolean
  /** Voz de Gemini (p. ej. Kore, Aoede). */
  geminiVoice: string
  /** Id del modelo de voz de Fish Audio; vacío = el precargado en el build. */
  fishModel: string
  /** Nombre de la voz de Windows; vacío = la primera en español. */
  systemVoice: string
  /** Volumen de la voz (0 a 1). */
  volume: number
}

export interface ObserverSettings {
  intervalSec: number
  /** Máximo de análisis de pantalla por día, para no agotar el nivel gratuito del proveedor. */
  dailyCap: number
}

export type ObservationKind = 'error' | 'bug' | 'seguridad' | 'practica' | 'atasco'

export interface Observation {
  id: string
  at: string
  kind: ObservationKind
  title: string
  tip: string
}

export interface ObserverStatus {
  active: boolean
  capturesToday: number
  dailyCap: number
  intervalSec: number
  /** Último motivo por el que no se analizó (sin cambios, límite…), para mostrarlo. */
  lastInfo?: string
}

/** Texto o captura que llega desde un atajo global para rellenar la consulta. */
export interface QuickInput {
  text?: string
  image?: ImageAttachment
  /** Vista previa como data URL para la interfaz. */
  preview?: string
}

/** Vista de configuración que recibe la interfaz: nunca incluye credenciales. */
export interface SettingsView extends Settings {
  secrets: Record<ProviderId, { configured: boolean; source?: 'stored' | 'env' }>
  /** false si el sistema no ofrece cifrado (safeStorage) para guardar claves. */
  encryptionAvailable: boolean
  /** Atajos globales que Windows no dejó registrar (los usa otra app). */
  shortcutConflicts: string[]
}

export type ProviderErrorKind =
  | 'auth'
  | 'rate_limit'
  | 'network'
  | 'bad_request'
  | 'not_found'
  | 'server'
  | 'blocked'
  | 'aborted'
  | 'config'
  | 'unknown'

export interface ProviderErrorInfo {
  kind: ProviderErrorKind
  message: string
  /** Segundos sugeridos por el proveedor antes de reintentar. */
  retryAfterSec?: number
  status?: number
  retryable: boolean
}

/** Eventos de streaming que main envía a la interfaz. */
export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; usage?: TurnUsage; finishReason?: string }

export interface RunRequest {
  /** Lo genera la interfaz antes de invocar, para no perder eventos que lleguen antes de la respuesta IPC. */
  requestId: string
  sessionId: string
  action: CopilotAction
  input: string
  image?: ImageAttachment
}

export type RunEvent =
  | { requestId: string; type: 'started'; turn: Turn }
  | { requestId: string; type: 'delta'; text: string }
  | { requestId: string; type: 'finished'; turn: Turn }
  | { requestId: string; type: 'failed'; message: string }
