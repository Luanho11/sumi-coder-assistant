import { app } from 'electron'
import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'

const OLD_NAME = 'Copiloto Técnico'
// Cachés de Chromium y archivos de bloqueo: se regeneran solos y copiarlos solo da problemas.
const SKIP = /[\\/](Cache|Code Cache|GPUCache|DawnCache|DawnGraphiteCache|DawnWebGPUCache|Crashpad|blob_storage|Singleton[^\\/]*)([\\/]|$)/

/**
 * La app se llamaba "Copiloto Técnico": al renombrarla Electron usa otra carpeta de datos.
 * Se copia la carpeta antigua la primera vez para conservar sesiones, memoria, ajustes y claves.
 */
export function migrateUserData(): void {
  const target = app.getPath('userData')
  const old = path.join(app.getPath('appData'), OLD_NAME)
  if (existsSync(path.join(target, 'settings.json')) || !existsSync(path.join(old, 'settings.json'))) return
  try {
    cpSync(old, target, {
      recursive: true,
      force: false,
      errorOnExist: false,
      filter: (src) => !SKIP.test(src)
    })
  } catch (err) {
    console.error('No se pudieron migrar los datos de Copiloto Técnico', err)
  }
}
