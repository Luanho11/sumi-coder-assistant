import { describe, expect, it } from 'vitest'
import { isCollapsedByDefault, normalizeKey, parseSections } from '../src/core/sections'

describe('parseSections', () => {
  it('divide por encabezados de nivel 2 y conserva el orden', () => {
    const md = '## Resumen\nSe pide X.\n\n## Plan de acción\n1. A\n2. B\n'
    const r = parseSections(md)
    expect(r.sections.map((s) => s.title)).toEqual(['Resumen', 'Plan de acción'])
    expect(r.sections[1].body).toBe('1. A\n2. B')
    expect(r.sections[1].key).toBe('plan de accion')
  })

  it('ignora "##" dentro de bloques de código', () => {
    const md = '## Código\n```py\n## no es encabezado\nprint(1)\n```\n## Verificación\nok'
    const r = parseSections(md)
    expect(r.sections.map((s) => s.title)).toEqual(['Código', 'Verificación'])
    expect(r.sections[0].body).toContain('## no es encabezado')
  })

  it('funciona con texto parcial durante el streaming (bloque de código sin cerrar)', () => {
    const r = parseSections('## Resumen\nHola\n## Código\n```ts\nconst a = 1\n## sigue dentro')
    expect(r.sections).toHaveLength(2)
    expect(r.sections[1].body).toContain('## sigue dentro')
  })

  it('devuelve el texto previo al primer encabezado como preámbulo', () => {
    const r = parseSections('Texto suelto\n## Respuesta\nSí')
    expect(r.preamble).toBe('Texto suelto')
    expect(r.sections[0].body).toBe('Sí')
  })

  it('no confunde "###" con secciones', () => {
    const r = parseSections('## Estrategia\n### Alternativa\nB')
    expect(r.sections).toHaveLength(1)
  })

  it('normaliza tildes, negritas y emojis en la clave', () => {
    expect(normalizeKey('Explicación')).toBe('explicacion')
    expect(parseSections('## **Verificación** ##\nx').sections[0].title).toBe('Verificación')
  })

  it('pliega por defecto solo el detalle extenso', () => {
    expect(isCollapsedByDefault('explicacion', 'analyze')).toBe(true)
    expect(isCollapsedByDefault('explicacion', 'explain')).toBe(false)
    expect(isCollapsedByDefault('resumen', 'analyze')).toBe(false)
  })
})
