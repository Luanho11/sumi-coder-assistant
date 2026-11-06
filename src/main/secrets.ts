import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { ProviderId } from '../core/types'
import { writeJsonAtomic } from './storage'

/** Interfaz mínima de cifrado; en la app la implementa `safeStorage` de Electron (DPAPI en Windows). */
export interface Encryptor {
  isAsyncEncryptionAvailable(): Promise<boolean>
  encryptStringAsync(plain: string): Promise<Buffer>
  decryptStringAsync(data: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }>
}

/**
 * Guarda las claves API cifradas con la cuenta de usuario del sistema operativo.
 * Las claves solo viven en el proceso principal: la interfaz nunca recibe su valor.
 * Si el sistema no ofrece cifrado, se rechaza guardar en lugar de escribir la clave en claro.
 */
export class SecretStore {
  private readonly file: string
  constructor(
    dir: string,
    private readonly enc: Encryptor
  ) {
    this.file = path.join(dir, 'secrets.json')
  }

  isAvailable(): Promise<boolean> {
    return this.enc.isAsyncEncryptionAvailable()
  }

  private async readAll(): Promise<Partial<Record<ProviderId, string>>> {
    try {
      return JSON.parse(await fs.readFile(this.file, 'utf8'))
    } catch {
      return {}
    }
  }

  async set(id: ProviderId, value: string): Promise<void> {
    const trimmed = value.trim()
    if (!trimmed) return this.clear(id)
    if (!(await this.isAvailable())) throw new Error('El cifrado del sistema no está disponible; no se guardará la clave en texto plano.')
    const all = await this.readAll()
    all[id] = (await this.enc.encryptStringAsync(trimmed)).toString('base64')
    await writeJsonAtomic(this.file, all)
  }

  async get(id: ProviderId): Promise<string | undefined> {
    const all = await this.readAll()
    const blob = all[id]
    if (!blob || !(await this.isAvailable())) return undefined
    try {
      const { result, shouldReEncrypt } = await this.enc.decryptStringAsync(Buffer.from(blob, 'base64'))
      // El sistema rotó la clave de cifrado: se vuelve a guardar con la nueva.
      if (shouldReEncrypt) await this.set(id, result)
      return result
    } catch {
      return undefined // p. ej. datos copiados de otro usuario/equipo
    }
  }

  async has(id: ProviderId): Promise<boolean> {
    return (await this.get(id)) !== undefined
  }

  async clear(id: ProviderId): Promise<void> {
    const all = await this.readAll()
    delete all[id]
    await writeJsonAtomic(this.file, all)
  }
}
