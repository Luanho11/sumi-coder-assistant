import { describe, expect, it } from 'vitest'
import { buildFixMessage, findSecrets, isBlockedFile, isIgnored, lineDiff, parseFix } from '../src/core/codefix'

describe('corrección de archivos', () => {
  it('bloquea archivos de secretos por nombre o extensión', () => {
    for (const name of ['.env', '.env.local', 'id_rsa', 'server.pem', 'secrets.json', 'credentials.yml', '.npmrc']) expect(isBlockedFile(name)).toBe(true)
    for (const name of ['index.ts', 'environment.ts', 'README.md']) expect(isBlockedFile(name)).toBe(false)
  })

  it('detecta secretos en el contenido', () => {
    expect(findSecrets('const k = "AIza' + 'a'.repeat(35) + '"')).toEqual(['clave de Google'])
    expect(findSecrets('DATABASE_URL=postgres://user:pass@host/db')).toEqual(['cadena de conexión con contraseña'])
    expect(findSecrets('const x = 1')).toEqual([])
  })

  it('respeta patrones sencillos de .gitignore', () => {
    const patterns = ['# comentario', 'node_modules/', '*.log', '/dist', 'config/local.json', '!keep.log']
    expect(isIgnored(patterns, 'node_modules/a/b.js')).toBe(true)
    expect(isIgnored(patterns, 'logs/app.log')).toBe(true)
    expect(isIgnored(patterns, 'dist/main.js')).toBe(true)
    expect(isIgnored(patterns, 'config/local.json')).toBe(true)
    expect(isIgnored(patterns, 'src/app.ts')).toBe(false)
    expect(isIgnored(['node_modules/'], 'node_modules')).toBe(false)
  })

  it('separa la explicación del archivo completo devuelto', () => {
    const fix = parseFix('## Cambios\n- Corrijo el bucle\n\n## Archivo\n```ts\nconst a = 1\n```')!
    expect(fix).toEqual({
      explanation: '- Corrijo el bucle',
      code: 'const a = 1'
    })
    expect(parseFix('sin código')).toBeUndefined()
    expect(buildFixMessage('a.ts', 'x', '')).toContain('Revisa y corrige')
  })

  it('el diff por líneas marca lo añadido y lo borrado', () => {
    expect(lineDiff('a\nb\nc', 'a\nB\nc\nd')).toEqual([
      { type: 'same', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'add', text: 'B' },
      { type: 'same', text: 'c' },
      { type: 'add', text: 'd' }
    ])
  })
})
