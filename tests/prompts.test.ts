import { describe, expect, it } from 'vitest'
import { buildMessages, buildSystemPrompt, deriveTitle, formatUserMessage, nextHintStep } from '../src/core/prompts'
import type { Session, Turn } from '../src/core/types'

function turn(partial: Partial<Turn>): Turn {
  return {
    id: Math.random().toString(36),
    action: 'followup',
    input: 'pregunta',
    output: 'respuesta',
    status: 'done',
    providerId: 'gemini',
    model: 'm',
    createdAt: new Date(0).toISOString(),
    ...partial
  }
}

function session(turns: Turn[]): Session {
  return { id: 's', title: 't', createdAt: '', updatedAt: '', turns }
}

describe('buildSystemPrompt', () => {
  it('incluye las secciones del flujo de problema al analizar', () => {
    const p = buildSystemPrompt('analyze')
    for (const h of ['## Resumen', '## Estrategia', '## Código', '## Verificación', '## Pregunta para ti']) {
      expect(p).toContain(h)
    }
  })

  it('incluye criterio senior, el tono divertido y pide los temas', () => {
    const p = buildSystemPrompt('analyze')
    expect(p).toMatch(/senior/)
    expect(p).toMatch(/trade-offs/i)
    expect(p).toMatch(/divertido/)
    expect(p).toContain('<!-- temas:')
    expect(buildSystemPrompt('hint', 'MEMORIA')).toMatch(/MEMORIA$/)
  })

  it('ya no hay selector de modos: XARA decide cuánta ayuda dar', () => {
    const p = buildSystemPrompt('analyze')
    expect(p).toMatch(/decides tú/)
    expect(p).not.toMatch(/PLAN GUIADO/)
  })

  it('la acción pista nunca revela la solución completa', () => {
    expect(buildSystemPrompt('hint')).toMatch(/sin revelar la solución completa/)
  })

  it('puede guardar un dato duradero del usuario en la memoria', () => {
    expect(buildSystemPrompt('analyze')).toContain('<!-- recordar:')
  })
})

describe('modo tutor', () => {
  it('sube un peldaño de la escalera por cada pista dada, hasta 5', () => {
    expect(nextHintStep(session([turn({ action: 'analyze' })]))).toBe(1)
    expect(nextHintStep(session([turn({ action: 'hint' }), turn({ action: 'hint', status: 'error' })]))).toBe(2)
    expect(nextHintStep(session(Array.from({ length: 7 }, () => turn({ action: 'hint' }))))).toBe(5)
  })

  it('indica el peldaño en el prompt y pregunta qué ha probado en el primero', () => {
    expect(buildSystemPrompt('hint', '', 1)).toMatch(/Peldaño que toca ahora: 1 de 5\. .*qué ha probado/)
    expect(buildSystemPrompt('hint', '', 3)).not.toMatch(/qué ha probado/)
    expect(buildSystemPrompt('analyze')).toContain('## Pregunta para ti')
    expect(buildSystemPrompt('debug')).toContain('## Tipo de error')
  })
})

describe('buildMessages', () => {
  it('adjunta la imagen solo al mensaje actual y avisa de capturas antiguas', () => {
    const img = { mimeType: 'image/jpeg' as const, data: 'AAAA' }
    const msgs = buildMessages(session([turn({ action: 'analyze', input: 'x', hadImage: true })]), 'followup', '', { image: img })
    expect(msgs[0].content).toContain('ya no está disponible')
    expect(msgs[0].images).toBeUndefined()
    expect(msgs.at(-1)!.images).toEqual([img])
    expect(msgs.at(-1)!.content).toContain('Analiza la captura adjunta')
  })

  it('alterna usuario/asistente con los turnos completados y añade el actual', () => {
    const s = session([turn({ action: 'analyze', input: 'Enunciado', output: 'R1' }), turn({ input: 'q2', output: 'R2' })])
    const msgs = buildMessages(s, 'followup', '¿y la complejidad?')
    expect(msgs.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant', 'user'])
    expect(msgs[0].content).toContain('Enunciado')
    expect(msgs.at(-1)!.content).toBe('¿y la complejidad?')
  })

  it('excluye turnos con error o cancelados', () => {
    const s = session([turn({ action: 'analyze' }), turn({ status: 'error', output: 'parcial' }), turn({ status: 'cancelled' })])
    expect(buildMessages(s, 'hint', '')).toHaveLength(3)
  })

  it('recorta los turnos intermedios antiguos pero conserva el enunciado', () => {
    const big = 'x'.repeat(1000)
    const s = session([
      turn({ action: 'analyze', input: 'ENUNCIADO', output: 'a' }),
      turn({ input: 'viejo', output: big }),
      turn({ input: 'medio', output: big }),
      turn({ input: 'reciente', output: 'b' })
    ])
    const msgs = buildMessages(s, 'followup', 'nueva', { maxChars: 1200 })
    const text = msgs.map((m) => m.content).join('|')
    expect(text).toContain('ENUNCIADO')
    expect(text).toContain('reciente')
    expect(text).toContain('medio')
    expect(text).not.toContain('viejo')
  })

  it('genera mensajes útiles para acciones sin texto', () => {
    expect(formatUserMessage('hint', '')).toBe('Dame la siguiente pista.')
    expect(formatUserMessage('review', '  ')).toContain('código discutido')
  })
})

describe('deriveTitle', () => {
  it('usa la primera línea con contenido y la recorta', () => {
    expect(deriveTitle('\n\n# Two Sum\nDado un array...')).toBe('Two Sum')
    expect(deriveTitle('a'.repeat(100), 20)).toHaveLength(20)
    expect(deriveTitle('```\ncode')).toBe('code')
    expect(deriveTitle('   ')).toBe('Sesión sin título')
  })
})

describe('formato según el tipo de consulta', () => {
  it('analizar distingue concepto, duda rápida y problema, y pide analogías y diagramas', () => {
    const sys = buildSystemPrompt('analyze')
    expect(sys).toContain('A) CONCEPTO')
    expect(sys).toContain('B) DUDA RÁPIDA')
    expect(sys).toContain('C) PROBLEMA')
    expect(sys).toContain('```mermaid')
  })

  it('la clase tiene su propio mensaje de usuario', () => {
    expect(formatUserMessage('lesson', 'Slides de POO')).toBe('Dame una clase sobre este material:\n\nSlides de POO')
    expect(buildSystemPrompt('lesson')).toContain('## Comprueba lo que sabes')
  })
})
