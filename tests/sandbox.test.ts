import { describe, expect, it } from 'vitest'
import { challenges } from '../src/core/academy/catalog'
import { runChallenge, runScratch } from '../src/main/sandbox'

const jsChallenges = challenges.filter((c) => c.language === 'javascript' && c.tests?.length && c.solution)

describe('retos de JavaScript', () => {
  it.each(jsChallenges.map((c) => [c.id, c] as const))('la solución de referencia de %s pasa sus pruebas', async (_, c) => {
    const res = await runChallenge(c.id, c.solution!)
    expect(res.error).toBeUndefined()
    expect(res.ok).toBe(true)
  })

  it('el código inicial no pasa y un bucle infinito se corta', async () => {
    const suma = jsChallenges.find((c) => c.id === 'ch-js-suma')!
    expect((await runChallenge(suma.id, suma.starter!)).ok).toBe(false)
    const loop = await runChallenge(suma.id, 'function suma(nums) { while (true) {} }')
    expect(loop.error).toMatch(/tardó demasiado/)
  })

  it('acepta funciones flecha y recoge los console.log', async () => {
    const res = await runChallenge('ch-js-suma', "const suma = (nums) => { console.log('hola'); return nums.reduce((t, n) => t + n, 0) }")
    expect(res.ok).toBe(true)
    expect(res.logs).toContain('hola')
  })
})

describe('modo libre', () => {
  it('ejecuta JavaScript suelto y muestra sus console.log o el error', async () => {
    const ok = await runScratch('javascript', "const x = [1, 2].map((n) => n * 2)\nconsole.log(x.join(','))")
    expect(ok.error).toBeUndefined()
    expect(ok.logs).toEqual(['2,4'])
    expect((await runScratch('javascript', 'noExiste()')).error).toMatch(/noExiste/)
  })
})
