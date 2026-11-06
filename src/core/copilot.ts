import { toProviderError } from './errors'
import { buildMessages, buildSystemPrompt, nextHintStep } from './prompts'
import type { ModelProvider } from './providers'
import { extractRemember, extractTopics } from './topics'
import type { CopilotAction, ImageAttachment, Session, Turn } from './types'

export interface ExecuteTurnInput {
  session: Session
  action: CopilotAction
  input: string
  image?: ImageAttachment
  provider: ModelProvider
  model: string
  signal?: AbortSignal
  /** Bloque de memoria del usuario que se añade al prompt de sistema (ver profile.ts). */
  profilePrompt?: string
  onDelta?: (text: string) => void
  /** Se llama una vez con el turno inicial (estado `streaming`). */
  onStart?: (turn: Turn) => void
  newId?: () => string
  now?: () => number
}

/**
 * Ejecuta un turno completo contra el proveedor y devuelve el turno final.
 * Nunca lanza: los errores quedan registrados en `turn.error` con un mensaje para el usuario,
 * y se conserva el texto parcial recibido hasta el fallo.
 */
export async function executeTurn(args: ExecuteTurnInput): Promise<Turn> {
  const now = args.now ?? Date.now
  const started = now()
  const turn: Turn = {
    id: (args.newId ?? defaultId)(),
    action: args.action,
    input: args.input,
    output: '',
    status: 'streaming',
    providerId: args.provider.id,
    model: args.model,
    createdAt: new Date(started).toISOString(),
    ...(args.image ? { hadImage: true } : {})
  }
  args.onStart?.({ ...turn })

  try {
    const stream = args.provider.stream({
      model: args.model,
      system: buildSystemPrompt(args.action, args.profilePrompt, nextHintStep(args.session)),
      messages: buildMessages(args.session, args.action, args.input, { image: args.image }),
      signal: args.signal
    })
    for await (const ev of stream) {
      if (ev.type === 'delta') {
        turn.output += ev.text
        args.onDelta?.(ev.text)
      } else {
        turn.usage = ev.usage
      }
    }
    turn.status = 'done'
  } catch (err) {
    const e = toProviderError(args.provider.displayName, err)
    turn.status = e.kind === 'aborted' ? 'cancelled' : 'error'
    turn.error = e.toInfo()
  }
  const { topics, text } = extractTopics(turn.output)
  const { facts, text: clean } = extractRemember(text)
  turn.output = clean
  if (topics.length) turn.topics = topics
  if (facts.length && turn.status === 'done') turn.remembered = facts
  turn.durationMs = now() - started
  return turn
}

function defaultId(): string {
  return globalThis.crypto.randomUUID()
}
