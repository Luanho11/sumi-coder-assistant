// Perfil de aprendizaje: la app "mejora con el uso" sin reentrenar el modelo.
// A partir del historial local (temas, acciones pedidas y valoraciones) se calcula un resumen
// que se añade al prompt de sistema en cada consulta. Todo se queda en el equipo salvo ese resumen,
// que viaja con la consulta al proveedor elegido.

import type { LearningProfile, MemoryFact, ProfileInsights, Session, TopicStat } from './types'

/** Peso de cada acción como señal de dificultad en un tema. */
const STRUGGLE_WEIGHT: Record<string, number> = { hint: 1, explain: 1, debug: 1, followup: 0.5 }
const DOWN_WEIGHT = 2
const MAX_PROMPT_CHARS = 4000
const MAX_PREFERENCES_CHARS = 600
const MAX_FACTS = 60
const MAX_FACT_CHARS = 200

/** Lo que se sabía de LM al crear XARA: así la tutora lo conoce desde el primer día y él puede editarlo. */
export const INITIAL_FACTS = [
  'Se llama LM, habla español y usa Windows 11.',
  'Su objetivo: ser un gran profesional y conseguir un buen sueldo en 2026 trabajando con IA (especificar, revisar, verificar y defender código).',
  'Su stack principal es web: React, Vite, TypeScript y Node.js. Está preparando entrevistas técnicas.',
  'Tiene un proyecto propio de formación (Next.js + Electron) con rutas de aprendizaje; de ahí salió la academia de XARA.',
  'Aprende mejor con analogías, ejemplos concretos y diagramas con color; le aburren los textos largos, lo genérico y lo repetitivo.',
  'Quiere hablar con XARA de forma natural, sin elegir modos de ayuda: ella decide cuánto ayudar.',
  'Exige código limpio: cambiar solo lo necesario, sin código muerto y con el CSS de cada página en su propio archivo.',
  'Usa el nivel gratuito de Gemini y no ha autorizado gastos: antes de cualquier coste hay que avisarle con el precio y alternativas.'
]

export const DEFAULT_PROFILE: LearningProfile = { enabled: true, preferences: '', facts: [] }

export function computeInsights(sessions: Session[]): ProfileInsights {
  const stats = new Map<string, TopicStat>()
  const dislikes = new Map<string, number>()
  let ratedUp = 0
  let ratedDown = 0

  for (const s of sessions) {
    const topics = new Set<string>()
    let struggle = 0
    for (const t of s.turns) {
      t.topics?.forEach((x) => topics.add(x))
      if (t.status === 'done') {
        struggle += STRUGGLE_WEIGHT[t.action] ?? 0
      }
      if (t.feedback?.rating === 'up') ratedUp++
      if (t.feedback?.rating === 'down') {
        ratedDown++
        struggle += DOWN_WEIGHT
        const note = t.feedback.note?.trim()
        if (note) dislikes.set(note, (dislikes.get(note) ?? 0) + 1)
      }
    }
    for (const topic of topics) {
      const st = stats.get(topic) ?? { topic, sessions: 0, struggle: 0 }
      st.sessions++
      st.struggle += struggle
      stats.set(topic, st)
    }
  }

  const all = [...stats.values()]
  const topTopics = [...all].sort((a, b) => b.sessions - a.sessions || a.topic.localeCompare(b.topic)).slice(0, 8)
  const weakTopics = all
    .filter((t) => t.struggle / t.sessions >= 1.5)
    .sort((a, b) => b.struggle / b.sessions - a.struggle / a.sessions || b.sessions - a.sessions)
    .slice(0, 5)

  return {
    sessionCount: sessions.length,
    ratedUp,
    ratedDown,
    topTopics,
    weakTopics,
    dislikes: [...dislikes.entries()].map(([note, count]) => ({ note, count })).sort((a, b) => b.count - a.count).slice(0, 4)
  }
}

/** Bloque que se añade al prompt de sistema. Vacío si el perfil está desactivado o aún no hay nada aprendido. */
export function buildProfilePrompt(profile: LearningProfile, insights: ProfileInsights): string {
  if (!profile.enabled) return ''
  const lines: string[] = profile.facts.map((f) => `- ${f.text}`)
  const prefs = profile.preferences.trim().slice(0, MAX_PREFERENCES_CHARS)
  if (prefs) lines.push(`- Preferencias declaradas por el usuario (respétalas): ${prefs.replace(/\s*\n\s*/g, ' / ')}`)
  if (insights.weakTopics.length) {
    lines.push(
      `- Temas en los que ha necesitado más ayuda: ${insights.weakTopics.map((t) => t.topic).join(', ')}. Si aparecen, refuerza los fundamentos, explica el porqué paso a paso y sugiere un mini ejercicio de repaso al final de la explicación.`
    )
  }
  // Solo se dan por dominados los temas repetidos en los que no ha mostrado dificultad.
  const weak = new Set(insights.weakTopics.map((t) => t.topic))
  const practiced = insights.topTopics.filter((t) => t.sessions >= 2 && !weak.has(t.topic)).slice(0, 5)
  if (practiced.length) {
    lines.push(`- Temas que domina por práctica: ${practiced.map((t) => `${t.topic} (${t.sessions} sesiones)`).join(', ')}. No repitas lo básico de estos salvo que lo pida.`)
  }
  if (insights.dislikes.length) {
    lines.push(`- Ha valorado como poco útiles respuestas por: ${insights.dislikes.map((d) => `"${d.note}" (${d.count})`).join(', ')}. Evítalo.`)
  }
  if (!lines.length) return ''
  const block = `Memoria del usuario (lo que sabes de él y lo aprendido de su historial local; úsala para adaptar la respuesta sin recitarla):\n${lines.join('\n')}`
  return block.length > MAX_PROMPT_CHARS ? `${block.slice(0, MAX_PROMPT_CHARS - 1)}…` : block
}

export function newFact(text: string, source: MemoryFact['source'], now = new Date()): MemoryFact {
  return { id: globalThis.crypto.randomUUID(), text: text.trim().slice(0, MAX_FACT_CHARS), source, at: now.toISOString() }
}

function isFact(f: unknown): f is MemoryFact {
  const x = f as Partial<MemoryFact>
  return typeof x?.id === 'string' && typeof x.text === 'string' && !!x.text.trim() && ['inicial', 'xara', 'usuario'].includes(x.source as string)
}

/** Añade hechos nuevos sin duplicar (ignora mayúsculas y espacios) y respeta el máximo, descartando los más antiguos de XARA. */
export function addFacts(facts: MemoryFact[], texts: string[], source: MemoryFact['source']): MemoryFact[] {
  const key = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim()
  const seen = new Set(facts.map((f) => key(f.text)))
  const out = [...facts]
  for (const t of texts) {
    if (!t.trim() || seen.has(key(t))) continue
    seen.add(key(t))
    out.push(newFact(t, source))
  }
  while (out.length > MAX_FACTS) {
    const oldest = out.findIndex((f) => f.source === 'xara')
    out.splice(oldest >= 0 ? oldest : 0, 1)
  }
  return out
}

export function mergeProfile(stored: Partial<LearningProfile> | undefined): LearningProfile {
  return {
    enabled: typeof stored?.enabled === 'boolean' ? stored.enabled : DEFAULT_PROFILE.enabled,
    preferences: typeof stored?.preferences === 'string' ? stored.preferences.slice(0, MAX_PREFERENCES_CHARS) : '',
    // Sin memoria guardada se parte de lo que ya se sabe del usuario.
    facts: Array.isArray(stored?.facts)
      ? stored.facts.filter(isFact).map((f) => ({ ...f, text: f.text.slice(0, MAX_FACT_CHARS) })).slice(-MAX_FACTS)
      : INITIAL_FACTS.map((t) => newFact(t, 'inicial', new Date(0)))
  }
}
