import { describe, expect, it } from 'vitest'
import { agruparBloques, buildScenes, captionAt, captionLines, splitBlocks } from '../src/core/academy/scenes'
import type { Lesson } from '../src/core/academy/types'

describe('splitBlocks', () => {
  it('separa puntos de lista, tablas y código sin partir el código por sus líneas vacías', () => {
    const md = '- **const**: fijo.\n- **let**: cambia.\n\n```js\nconst a = 1\n\nlet b = 2\n```\n⚠️ Ojo.\n\n| Tipo | Ejemplo |\n|---|---|\n| string | `x` |\nFin.'
    expect(splitBlocks(md)).toEqual([
      '- **const**: fijo.',
      '- **let**: cambia.',
      '```js\nconst a = 1\n\nlet b = 2\n```',
      '⚠️ Ojo.',
      '| Tipo | Ejemplo |\n|---|---|\n| string | `x` |',
      'Fin.'
    ])
  })
})

describe('agruparBloques', () => {
  it('parte lo largo en varias diapositivas sin cortar un bloque', () => {
    const bloque = 'a'.repeat(150)
    expect(agruparBloques([bloque, bloque, bloque]).map((g) => g.length)).toEqual([2, 1])
    expect(agruparBloques(['b'.repeat(900)])).toEqual([['b'.repeat(900)]])
    expect(agruparBloques([])).toEqual([])
  })
  it('una diapositiva larga se reparte en escenas y la narración no repite el título', () => {
    const larga: Lesson = { id: 'l2', title: 'T', slides: [{ title: 'Largo', content: `${'x'.repeat(200)}\n\n${'y'.repeat(200)}` }, { title: 'Vacía', content: '' }], videos: [], exerciseIds: [] }
    const escenas = buildScenes(larga).filter((s) => s.kind === 'slide')
    expect(escenas.map((s) => s.title)).toEqual(['Largo', 'Largo', 'Vacía'])
    expect(escenas[0].narration.startsWith('Largo. ')).toBe(true)
    expect(escenas[1].narration.startsWith('Largo')).toBe(false)
  })
})

describe('buildScenes', () => {
  const lesson: Lesson = {
    id: 'l1',
    title: 'Variables',
    slides: [{ title: 'const y let', content: 'Primero esto.\n\nLuego aquello.' }],
    videos: [],
    exerciseIds: []
  }

  it('arma portada, una escena por diapositiva y cierre con lo aprendido', () => {
    const scenes = buildScenes(lesson, { emoji: '🏷️', summary: 'Guardar datos.', analogy: '', learned: ['Usar const'], check: [] })
    expect(scenes.map((s) => s.kind)).toEqual(['intro', 'slide', 'outro'])
    expect(scenes[0].narration).toBe('Variables. Guardar datos.')
    expect(scenes[2].blocks).toEqual(['- Usar const'])
  })

  it('revela los bloques en orden, después del título', () => {
    const [, slide] = buildScenes(lesson)
    expect(slide.reveals[0]).toBeGreaterThan(0)
    expect(slide.reveals[1]).toBeGreaterThan(slide.reveals[0])
    expect(slide.reveals[1]).toBeLessThan(1)
  })
})

describe('subtítulos', () => {
  it('muestra la frase que corresponde al avance de la voz', () => {
    const lines = captionLines('Hola. Esto es una frase más larga. Fin.')
    expect(lines).toEqual(['Hola.', 'Esto es una frase más larga.', 'Fin.'])
    expect(captionAt(lines, 0)).toBe('Hola.')
    expect(captionAt(lines, 0.5)).toBe('Esto es una frase más larga.')
    expect(captionAt(lines, 1)).toBe('Fin.')
  })
})
