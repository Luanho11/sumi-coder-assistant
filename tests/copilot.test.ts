import { describe, expect, it } from 'vitest'
import { executeTurn } from '../src/core/copilot'
import { ProviderError } from '../src/core/errors'
import type { GenerateRequest, ModelProvider } from '../src/core/providers'
import type { Session, StreamEvent } from '../src/core/types'

function provider(script: (req: GenerateRequest) => AsyncGenerator<StreamEvent>): ModelProvider & { last?: GenerateRequest } {
  const p: ModelProvider & { last?: GenerateRequest } = {
    id: 'gemini',
    displayName: 'Prueba',
    stream: (req) => {
      p.last = req
      return script(req)
    },
    listModels: async () => []
  }
  return p
}

const session: Session = { id: 's', title: 't', createdAt: '', updatedAt: '', turns: [] }
let t = 1000
const base = { session, model: 'm1', newId: () => 'turn-1', now: () => (t += 500) }

describe('executeTurn', () => {
  it('acumula la respuesta y notifica deltas', async () => {
    const deltas: string[] = []
    const p = provider(async function* () {
      yield { type: 'delta', text: '## Resumen\n' }
      yield { type: 'delta', text: 'X' }
      yield { type: 'done', usage: { outputTokens: 2 } }
    })
    const turn = await executeTurn({ ...base, action: 'analyze', input: 'Two Sum', provider: p, onDelta: (d) => deltas.push(d) })
    expect(turn).toMatchObject({ id: 'turn-1', status: 'done', output: '## Resumen\nX', model: 'm1', providerId: 'gemini', usage: { outputTokens: 2 } })
    expect(turn.durationMs).toBe(500)
    expect(deltas).toEqual(['## Resumen\n', 'X'])
    expect(p.last!.messages.at(-1)!.content).toContain('Two Sum')
  })

  it('añade la memoria al prompt y extrae los temas de la respuesta', async () => {
    const p = provider(async function* () {
      yield { type: 'delta', text: '## Respuesta\nOK\n<!-- temas: sql -->' }
      yield { type: 'done' }
    })
    const turn = await executeTurn({ ...base, action: 'followup', input: 'q', provider: p, profilePrompt: 'Memoria del usuario: prefiere SQL' })
    expect(p.last!.system).toContain('Memoria del usuario: prefiere SQL')
    expect(turn.topics).toEqual(['sql'])
    expect(turn.output).toBe('## Respuesta\nOK')
  })

  it('conserva el texto parcial y registra el error sin lanzar', async () => {
    const p = provider(async function* () {
      yield { type: 'delta', text: 'parcial' }
      throw new ProviderError('rate_limit', 'límite', { status: 429, retryAfterSec: 3 })
    })
    const turn = await executeTurn({ ...base, action: 'hint', input: '', provider: p })
    expect(turn.status).toBe('error')
    expect(turn.output).toBe('parcial')
    expect(turn.error).toMatchObject({ kind: 'rate_limit', retryAfterSec: 3, retryable: true })
  })

  it('marca como cancelado cuando se aborta', async () => {
    const p = provider(async function* () {
      throw new DOMException('aborted', 'AbortError')
    })
    const turn = await executeTurn({ ...base, action: 'hint', input: '', provider: p })
    expect(turn.status).toBe('cancelled')
  })
})
