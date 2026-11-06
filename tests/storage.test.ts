import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { SecretStore, type Encryptor } from '../src/main/secrets'
import { mergeSettings, migrateSettings, ProfileStore, SessionStore, SettingsStore } from '../src/main/storage'

let dir: string
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'copiloto-test-'))
})

describe('SessionStore', () => {
  it('crea, recupera, renombra, lista por fecha y borra sesiones', async () => {
    const store = new SessionStore(dir)
    const a = await store.create('A', new Date('2026-01-01'))
    const b = await store.create('B', new Date('2026-02-01'))
    expect((await store.list()).map((s) => s.title)).toEqual(['B', 'A'])
    await store.rename(a.id, '  Nuevo  ')
    expect((await store.get(a.id))!.title).toBe('Nuevo')
    await store.delete(b.id)
    expect((await store.list()).map((s) => s.id)).toEqual([a.id])
  })

  it('ignora archivos dañados al listar', async () => {
    const store = new SessionStore(dir)
    await store.create('ok')
    await fs.writeFile(path.join(dir, 'sessions', 'roto.json'), '{no json')
    expect(await store.list()).toHaveLength(1)
  })

  it('rechaza identificadores con rutas', async () => {
    const store = new SessionStore(dir)
    await expect(store.get('../settings')).rejects.toThrow(/no válido/)
  })

  it('no deja archivos temporales tras guardar', async () => {
    const store = new SessionStore(dir)
    await store.create('x')
    const files = await fs.readdir(path.join(dir, 'sessions'))
    expect(files.every((f) => f.endsWith('.json'))).toBe(true)
  })
})

describe('Feedback y perfil', () => {
  it('guarda y quita la valoración de un turno', async () => {
    const store = new SessionStore(dir)
    const s = await store.create('x')
    s.turns.push({ id: 't1', action: 'analyze', input: '', output: 'o', status: 'done', providerId: 'gemini', model: 'm', createdAt: '' })
    await store.save(s)
    await store.setFeedback(s.id, 't1', { rating: 'down', note: 'Muy básico', at: 'now' })
    expect((await store.all())[0].turns[0].feedback).toMatchObject({ rating: 'down', note: 'Muy básico' })
    await store.setFeedback(s.id, 't1', null)
    expect((await store.get(s.id))!.turns[0].feedback).toBeUndefined()
    await expect(store.setFeedback(s.id, 'nope', null)).rejects.toThrow(/turno/)
  })

  it('persiste el perfil y arranca con los hechos iniciales sobre el usuario', async () => {
    const store = new ProfileStore(dir)
    const first = await store.get()
    expect(first).toMatchObject({ enabled: true, preferences: '' })
    expect(first.facts.length).toBeGreaterThan(0)
    expect(first.facts.every((f) => f.source === 'inicial')).toBe(true)
    await store.update({ preferences: 'TS' })
    await store.update({ enabled: false })
    const reloaded = await new ProfileStore(dir).get()
    expect(reloaded).toMatchObject({ enabled: false, preferences: 'TS' })
  })

  it('recuerda y olvida hechos de la memoria', async () => {
    const store = new ProfileStore(dir)
    await store.remember(['Le gusta Rust'], 'usuario')
    const withFact = await store.get()
    const fact = withFact.facts.find((f) => f.text === 'Le gusta Rust')
    expect(fact?.source).toBe('usuario')
    await store.forget(fact!.id)
    expect((await store.get()).facts.some((f) => f.text === 'Le gusta Rust')).toBe(false)
  })
})

describe('Settings', () => {
  it('descarta valores inválidos y usa los valores por defecto', () => {
    const s = mergeSettings({ providerId: 'otro' as never, ollamaUrl: 'file:///etc', alwaysOnTop: 'sí' as never })
    expect(s).toMatchObject({ providerId: 'groq', ollamaUrl: 'http://127.0.0.1:11434', alwaysOnTop: false })
  })

  it('persiste cambios parciales sin perder el resto de modelos', async () => {
    const store = new SettingsStore(dir)
    await store.update({ models: { gemini: 'g1', groq: 'q1', ollama: 'o1' } })
    await store.update({ models: { gemini: 'g2' } as never })
    expect((await new SettingsStore(dir).get()).models).toEqual({ gemini: 'g2', groq: 'q1', ollama: 'o1' })
  })

  it('se recupera de un settings.json dañado', async () => {
    await fs.writeFile(path.join(dir, 'settings.json'), '{{{')
    expect((await new SettingsStore(dir).get()).providerId).toBe('groq')
  })

  it('pasa a Groq y Verity los ajustes anteriores a la v0.6, pero respeta lo elegido después', async () => {
    const old = { providerId: 'gemini' as const, voice: { engine: 'gemini' as const, autoRead: true, geminiVoice: 'Kore', fishModel: '', systemVoice: '', volume: 1 } }
    expect(migrateSettings(old)).toMatchObject({ providerId: 'groq', voice: { engine: 'fish', autoRead: true } })
    expect(migrateSettings({ providerId: 'ollama' })?.providerId).toBe('ollama')

    await fs.writeFile(path.join(dir, 'settings.json'), JSON.stringify(old))
    const store = new SettingsStore(dir)
    expect((await store.get()).providerId).toBe('groq')
    await store.update({ providerId: 'gemini' })
    expect((await new SettingsStore(dir).get()).providerId).toBe('gemini')
  })
})

describe('SecretStore', () => {
  const fakeEnc = (available = true): Encryptor => ({
    isAsyncEncryptionAvailable: async () => available,
    encryptStringAsync: async (s) => Buffer.from([...Buffer.from(s)].map((b) => b ^ 0x5a)),
    decryptStringAsync: async (b) => ({ result: Buffer.from([...b].map((x) => x ^ 0x5a)).toString(), shouldReEncrypt: false })
  })

  it('guarda la clave cifrada (nunca en claro) y la recupera', async () => {
    const store = new SecretStore(dir, fakeEnc())
    await store.set('gemini', '  AIzaSECRETO  ')
    const raw = await fs.readFile(path.join(dir, 'secrets.json'), 'utf8')
    expect(raw).not.toContain('AIzaSECRETO')
    expect(await store.get('gemini')).toBe('AIzaSECRETO')
    await store.clear('gemini')
    expect(await store.has('gemini')).toBe(false)
  })

  it('se niega a guardar si el cifrado no está disponible', async () => {
    const store = new SecretStore(dir, fakeEnc(false))
    await expect(store.set('gemini', 'k')).rejects.toThrow(/texto plano/)
  })
})
