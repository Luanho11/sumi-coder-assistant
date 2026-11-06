import { promises as fs } from 'node:fs'
import path from 'node:path'
import { DEFAULT_OBSERVER, mergeObserverSettings } from '../core/observer'
import { addFacts, mergeProfile } from '../core/profile'
import { PROVIDERS } from '../core/providers'
import { recommendTracks } from '../core/academy/placement'
import type { AcademyProgress } from '../core/academy/types'
import type { ProgressV2 } from '../core/academy/v2/types'
import type { LearningProfile, MemoryFact, ProviderId, Session, SessionSummary, Settings, TurnFeedback } from '../core/types'

// Persistencia local en JSON dentro de la carpeta de datos de la app (%APPDATA%\XARA Coder Assistant en Windows).
// Un archivo por sesión: un fallo al escribir una sesión no corrompe las demás.

const ID_RE = /^[a-zA-Z0-9-]{1,64}$/

export const DEFAULT_SETTINGS: Settings = {
  providerId: 'groq',
  models: { gemini: PROVIDERS.gemini.defaultModel, groq: PROVIDERS.groq.defaultModel, ollama: PROVIDERS.ollama.defaultModel },
  ollamaUrl: 'http://127.0.0.1:11434',
  alwaysOnTop: false,
  observer: DEFAULT_OBSERVER,
  codeFix: false,
  voice: { engine: 'fish', autoRead: false, geminiVoice: 'Kore', fishModel: '', systemVoice: '', volume: 1 }
}

/** Escritura atómica: archivo temporal + rename, para no dejar JSON a medias si la app se cierra. */
export async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
  await fs.rename(tmp, file)
}

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw err
  }
}

// Versión del formato de settings.json. La 2 (v0.6) cambió los valores por defecto a Groq como IA y Verity como voz.
const SETTINGS_VERSION = 2

type StoredSettings = Partial<Settings> & { version?: number }

/** Los ajustes guardados antes de la v0.6 traían Gemini por defecto (lento, y su voz no gustó): pasan a Groq y Verity una sola vez. */
export function migrateSettings(stored: StoredSettings | undefined): StoredSettings | undefined {
  if (!stored || (stored.version ?? 1) >= SETTINGS_VERSION) return stored
  return {
    ...stored,
    providerId: stored.providerId === 'gemini' ? 'groq' : stored.providerId,
    voice: stored.voice?.engine === 'gemini' ? { ...stored.voice, engine: 'fish' } : stored.voice
  }
}

export class SettingsStore {
  private readonly file: string
  constructor(dir: string) {
    this.file = path.join(dir, 'settings.json')
  }

  async get(): Promise<Settings> {
    let stored: StoredSettings | undefined
    try {
      stored = await readJson<StoredSettings>(this.file)
    } catch {
      stored = undefined // archivo dañado: se vuelve a los valores por defecto
    }
    return mergeSettings(migrateSettings(stored))
  }

  async update(patch: Partial<Settings>): Promise<Settings> {
    const current = await this.get()
    const next = mergeSettings({ ...current, ...patch, models: { ...current.models, ...patch.models } })
    await writeJsonAtomic(this.file, { ...next, version: SETTINGS_VERSION })
    return next
  }
}

const PROVIDER_IDS: ProviderId[] = ['gemini', 'groq', 'ollama']

/** Combina lo guardado con los valores por defecto descartando valores inválidos. */
export function mergeSettings(stored: Partial<Settings> | undefined): Settings {
  const s = stored ?? {}
  return {
    providerId: PROVIDER_IDS.includes(s.providerId as ProviderId) ? (s.providerId as ProviderId) : DEFAULT_SETTINGS.providerId,
    models: {
      gemini: typeof s.models?.gemini === 'string' ? s.models.gemini : DEFAULT_SETTINGS.models.gemini,
      groq: typeof s.models?.groq === 'string' ? s.models.groq : DEFAULT_SETTINGS.models.groq,
      ollama: typeof s.models?.ollama === 'string' ? s.models.ollama : DEFAULT_SETTINGS.models.ollama
    },
    ollamaUrl: typeof s.ollamaUrl === 'string' && /^https?:\/\//.test(s.ollamaUrl) ? s.ollamaUrl : DEFAULT_SETTINGS.ollamaUrl,
    alwaysOnTop: typeof s.alwaysOnTop === 'boolean' ? s.alwaysOnTop : DEFAULT_SETTINGS.alwaysOnTop,
    observer: mergeObserverSettings(s.observer),
    codeFix: s.codeFix === true,
    voice: mergeVoice(s.voice)
  }
}

function mergeVoice(v: Partial<Settings['voice']> | undefined): Settings['voice'] {
  const d = DEFAULT_SETTINGS.voice
  const engine = v?.engine === 'sistema' || v?.engine === 'gemini' || v?.engine === 'fish' ? v.engine : d.engine
  const vol = typeof v?.volume === 'number' && v.volume >= 0 && v.volume <= 1 ? v.volume : 1
  return {
    engine,
    autoRead: v?.autoRead === true,
    geminiVoice: typeof v?.geminiVoice === 'string' && v.geminiVoice ? v.geminiVoice : d.geminiVoice,
    fishModel: typeof v?.fishModel === 'string' ? v.fishModel : '',
    systemVoice: typeof v?.systemVoice === 'string' ? v.systemVoice : '',
    volume: vol
  }
}

/** Día local AAAA-MM-DD para agrupar el uso diario. */
function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface UsageDay {
  day: string
  counts: Record<ProviderId, number>
}

/**
 * Cuenta cuántas llamadas ha hecho XARA a cada proveedor hoy. Es un conteo local y aproximado
 * (no es la cuota exacta de Google), pensado para que LM vea cuánto está gastando del nivel gratuito.
 */
export class UsageStore {
  private readonly file: string
  constructor(dir: string) {
    this.file = path.join(dir, 'usage.json')
  }

  async get(): Promise<UsageDay> {
    const today = todayKey()
    const stored = await readJson<UsageDay>(this.file).catch(() => undefined)
    if (!stored || stored.day !== today || typeof stored.counts !== 'object') {
      return { day: today, counts: { gemini: 0, groq: 0, ollama: 0 } }
    }
    const c = stored.counts
    return { day: today, counts: { gemini: Number(c.gemini) || 0, groq: Number(c.groq) || 0, ollama: Number(c.ollama) || 0 } }
  }

  async bump(id: ProviderId): Promise<UsageDay> {
    const cur = await this.get()
    cur.counts[id] = (cur.counts[id] || 0) + 1
    await writeJsonAtomic(this.file, cur).catch(() => {})
    return cur
  }
}

export class ProfileStore {
  private readonly file: string
  constructor(dir: string) {
    this.file = path.join(dir, 'profile.json')
  }

  async get(): Promise<LearningProfile> {
    try {
      return mergeProfile(await readJson<Partial<LearningProfile>>(this.file))
    } catch {
      return mergeProfile(undefined)
    }
  }

  async update(patch: Partial<LearningProfile>): Promise<LearningProfile> {
    const next = mergeProfile({ ...(await this.get()), ...patch })
    await writeJsonAtomic(this.file, next)
    return next
  }

  /** Añade hechos nuevos (sin duplicar) a la memoria persistente. */
  async remember(texts: string[], source: MemoryFact['source']): Promise<LearningProfile> {
    const current = await this.get()
    return this.update({ facts: addFacts(current.facts, texts, source) })
  }

  async forget(id: string): Promise<LearningProfile> {
    const current = await this.get()
    return this.update({ facts: current.facts.filter((f) => f.id !== id) })
  }
}

export class SessionStore {
  private readonly dir: string
  constructor(dataDir: string) {
    this.dir = path.join(dataDir, 'sessions')
  }

  private file(id: string): string {
    if (!ID_RE.test(id)) throw new Error(`Identificador de sesión no válido: ${id}`)
    return path.join(this.dir, `${id}.json`)
  }

  async list(): Promise<SessionSummary[]> {
    let names: string[]
    try {
      names = await fs.readdir(this.dir)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw err
    }
    const out: SessionSummary[] = []
    for (const name of names) {
      if (!name.endsWith('.json')) continue
      try {
        const s = await readJson<Session>(path.join(this.dir, name))
        if (s?.id) out.push({ id: s.id, title: s.title, updatedAt: s.updatedAt, turnCount: s.turns?.length ?? 0 })
      } catch {
        // se ignoran archivos dañados para que una sesión rota no bloquee el historial
      }
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  async get(id: string): Promise<Session | undefined> {
    return readJson<Session>(this.file(id))
  }

  async save(session: Session): Promise<void> {
    await writeJsonAtomic(this.file(session.id), session)
  }

  async create(title = 'Nueva sesión', now = new Date()): Promise<Session> {
    const session: Session = {
      id: globalThis.crypto.randomUUID(),
      title,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      turns: []
    }
    await this.save(session)
    return session
  }

  async rename(id: string, title: string): Promise<Session> {
    const s = await this.get(id)
    if (!s) throw new Error('La sesión no existe.')
    s.title = title.trim().slice(0, 120) || s.title
    await this.save(s)
    return s
  }

  /** Todas las sesiones completas (para calcular el perfil). Ignora archivos dañados. */
  async all(): Promise<Session[]> {
    const out: Session[] = []
    for (const s of await this.list()) {
      const full = await this.get(s.id).catch(() => undefined)
      if (full) out.push(full)
    }
    return out
  }

  /** Guarda o quita (null) la valoración de un turno. */
  async setFeedback(sessionId: string, turnId: string, feedback: TurnFeedback | null): Promise<Session> {
    const s = await this.get(sessionId)
    if (!s) throw new Error('La sesión no existe.')
    const turn = s.turns.find((t) => t.id === turnId)
    if (!turn) throw new Error('El turno no existe.')
    if (feedback) turn.feedback = feedback
    else delete turn.feedback
    await this.save(s)
    return s
  }

  async delete(id: string): Promise<void> {
    await fs.rm(this.file(id), { force: true })
  }
}

/** Rellena lo que falte en un progreso v2 guardado por una versión anterior, sin perder lo que sí tiene. */
function sanitizeV2(v: Partial<ProgressV2>): ProgressV2 {
  const obj = <T>(x: unknown): Record<string, T> => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, T>) : {})
  return { ...(typeof v.ultimaClase === 'string' ? { ultimaClase: v.ultimaClase.slice(0, 80) } : {}), lessons: obj(v.lessons), modules: obj(v.modules), levels: obj(v.levels), items: obj(v.items), reviews: obj(v.reviews) }
}

export class AcademyStore {
  private readonly file: string
  constructor(dir: string) {
    this.file = path.join(dir, 'academy.json')
  }

  private sanitizeStr(v: unknown): Record<string, string> {
    return typeof v === 'object' && v !== null ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'string')) : {}
  }

  async get(): Promise<AcademyProgress> {
    let stored: Partial<AcademyProgress> | undefined
    try {
      stored = await readJson<Partial<AcademyProgress>>(this.file)
    } catch {
      stored = undefined // archivo dañado: se empieza de cero en lugar de bloquear la academia
    }
    return {
      attempts: Array.isArray(stored?.attempts) ? stored.attempts : [],
      drafts: typeof stored?.drafts === 'object' && stored.drafts !== null ? stored.drafts : {},
      lessonsDone: Array.isArray(stored?.lessonsDone) ? stored.lessonsDone : [],
      challenges: this.sanitizeStr(stored?.challenges),
      exams: typeof stored?.exams === 'object' && stored.exams !== null ? stored.exams : {},
      interviews: Array.isArray(stored?.interviews) ? stored.interviews : [],
      activity: Array.isArray(stored?.activity) ? stored.activity : [],
      // La ruta se recalcula con las reglas actuales: así un examen hecho con una versión anterior también las aprovecha.
      ...(stored?.placement ? { placement: { ...stored.placement, recommendedTrackIds: recommendTracks(stored.placement.areas ?? {}, stored.placement.overall) } } : {}),
      ...(stored?.v2 && typeof stored.v2 === 'object' ? { v2: sanitizeV2(stored.v2) } : {})
    }
  }

  async update(change: (p: AcademyProgress) => void): Promise<AcademyProgress> {
    const p = await this.get()
    change(p)
    await writeJsonAtomic(this.file, p)
    return p
  }
}
