import { describe, expect, it } from 'vitest'
import { buildProfilePrompt, computeInsights, mergeProfile } from '../src/core/profile'
import { extractTopics, stripHiddenComments } from '../src/core/topics'
import type { Session, Turn } from '../src/core/types'

let n = 0
function turn(p: Partial<Turn>): Turn {
  return { id: `t${n++}`, action: 'analyze', input: '', output: 'x', status: 'done', providerId: 'gemini', model: 'm', createdAt: '', ...p }
}
function session(turns: Turn[]): Session {
  return { id: `s${n++}`, title: 't', createdAt: '', updatedAt: '', turns }
}

describe('extractTopics', () => {
  it('extrae y normaliza los temas y quita el comentario', () => {
    const r = extractTopics('## Resumen\nHola\n\n<!-- temas: Hash Map, arrays,  arrays , x -->\n')
    expect(r.topics).toEqual(['hash map', 'arrays'])
    expect(r.text).toBe('## Resumen\nHola')
  })
  it('no toca respuestas sin comentario', () => {
    expect(extractTopics('a')).toEqual({ topics: [], text: 'a' })
  })
  it('oculta un comentario a medio recibir durante el streaming', () => {
    expect(stripHiddenComments('texto\n<!-- tem')).toBe('texto')
  })
})

describe('computeInsights', () => {
  const sessions = [
    session([turn({ topics: ['sql', 'joins'] }), turn({ action: 'hint' }), turn({ action: 'hint' }), turn({ action: 'explain', feedback: { rating: 'down', note: 'Demasiado largo', at: '' } })]),
    session([turn({ topics: ['sql'], feedback: { rating: 'up', at: '' } })]),
    session([turn({ topics: ['react'] }), turn({ action: 'followup', feedback: { rating: 'down', note: 'Demasiado largo', at: '' } })]),
    session([turn({ topics: ['arrays'] })])
  ]
  const ins = computeInsights(sessions)

  it('cuenta sesiones por tema y valoraciones', () => {
    expect(ins.topTopics[0]).toMatchObject({ topic: 'sql', sessions: 2 })
    expect(ins.ratedUp).toBe(1)
    expect(ins.ratedDown).toBe(2)
  })
  it('detecta temas débiles por pistas, explicaciones y valoraciones negativas', () => {
    expect(ins.weakTopics.map((t) => t.topic)).toEqual(['joins', 'sql', 'react'])
    expect(ins.weakTopics.map((t) => t.topic)).not.toContain('arrays')
  })
  it('agrupa motivos de valoraciones negativas', () => {
    expect(ins.dislikes).toEqual([{ note: 'Demasiado largo', count: 2 }])
  })
})

describe('buildProfilePrompt', () => {
  it('resume preferencias, temas débiles y motivos de rechazo', () => {
    const ins = computeInsights([session([turn({ topics: ['grafos'] }), turn({ action: 'hint' }), turn({ action: 'debug' })])])
    const p = buildProfilePrompt({ enabled: true, preferences: 'Prefiero TypeScript\nrespuestas cortas', facts: [] }, ins)
    expect(p).toContain('Prefiero TypeScript / respuestas cortas')
    expect(p).toContain('ayuda: grafos')
  })
  it('no da por dominado un tema débil ni uno visto una sola vez', () => {
    const ins = computeInsights([
      session([turn({ topics: ['grafos'] }), turn({ action: 'hint' }), turn({ action: 'hint' }), turn({ action: 'debug' })]),
      session([turn({ topics: ['grafos', 'sql'] })]),
      session([turn({ topics: ['sql'] })]),
      session([turn({ topics: ['css'] })])
    ])
    const p = buildProfilePrompt({ enabled: true, preferences: '', facts: [] }, ins)
    expect(p).toContain('domina por práctica: sql (2 sesiones)')
    expect(p).not.toMatch(/domina[^\n]*grafos/)
    expect(p).not.toMatch(/domina[^\n]*css/)
  })

  it('queda vacío si está desactivado o no hay nada aprendido', () => {
    const ins = computeInsights([])
    expect(buildProfilePrompt({ enabled: true, preferences: '', facts: [] }, ins)).toBe('')
    expect(buildProfilePrompt({ enabled: false, preferences: 'x', facts: [] }, ins)).toBe('')
  })
  it('limita el tamaño del bloque', () => {
    const p = buildProfilePrompt(mergeProfile({ preferences: 'a'.repeat(5000) }), computeInsights([]))
    expect(p.length).toBeLessThanOrEqual(4000)
  })
})
