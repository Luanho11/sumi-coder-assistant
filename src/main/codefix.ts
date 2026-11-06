import { dialog, type BrowserWindow } from 'electron'
import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'
import { buildFixMessage, findSecrets, FIX_SYSTEM, isBlockedFile, isIgnored, MAX_FIX_BYTES, parseFix } from '../core/codefix'
import type { ChatMessage } from '../core/types'

interface Deps {
  getWindow: () => BrowserWindow | null
  isEnabled: () => Promise<boolean>
  complete: (system: string, messages: ChatMessage[], signal: AbortSignal) => Promise<string>
  backupDir: string
}

type Handle = (channel: string, fn: (...args: any[]) => unknown) => void

interface Pending {
  file: string
  original: string
  proposal?: string
  backup?: string
}

/** Busca .gitignore desde la carpeta del archivo hasta la raíz del repositorio (carpeta con .git). */
async function ignoredByGit(file: string): Promise<boolean> {
  let dir = path.dirname(file)
  for (let i = 0; i < 30; i++) {
    const gitignore = path.join(dir, '.gitignore')
    if (existsSync(gitignore)) {
      const patterns = (await fs.readFile(gitignore, 'utf8')).split(/\r?\n/)
      if (isIgnored(patterns, path.relative(dir, file).split(path.sep).join('/'))) return true
    }
    if (existsSync(path.join(dir, '.git'))) return false
    const parent = path.dirname(dir)
    if (parent === dir) return false
    dir = parent
  }
  return false
}

// El renderer solo maneja un token: la ruta y el contenido propuesto viven en el proceso principal,
// así la interfaz no puede pedir escribir en otra ruta ni colar otro contenido.
export function registerCodeFix(handle: Handle, deps: Deps): void {
  const pending = new Map<string, Pending>()

  const get = (token: unknown): Pending => {
    const p = typeof token === 'string' ? pending.get(token) : undefined
    if (!p) throw new Error('Vuelve a elegir el archivo.')
    return p
  }

  const assertEnabled = async () => {
    if (!(await deps.isEnabled())) throw new Error('La corrección de archivos está desactivada. Actívala en Configuración.')
  }

  handle('codefix:pick', async () => {
    await assertEnabled()
    const win = deps.getWindow()
    const res = win
      ? await dialog.showOpenDialog(win, {
          properties: ['openFile'],
          title: 'Elige el archivo que XARA puede corregir'
        })
      : { canceled: true, filePaths: [] }
    const file = res.filePaths[0]
    if (res.canceled || !file) return null
    const name = path.basename(file)
    if (isBlockedFile(name)) throw new Error(`"${name}" parece un archivo de secretos o credenciales: XARA no lo abre.`)
    const stat = await fs.stat(file)
    if (stat.size > MAX_FIX_BYTES) throw new Error('El archivo es demasiado grande (máximo 300 KB).')
    if (await ignoredByGit(file)) throw new Error(`"${name}" está en .gitignore: suele contener datos locales o secretos y no se envía al modelo.`)
    const content = await fs.readFile(file, 'utf8')
    if (content.includes('\u0000')) throw new Error('Es un archivo binario: solo se pueden corregir archivos de texto.')
    const secrets = findSecrets(content)
    if (secrets.length) throw new Error(`El archivo contiene lo que parece un secreto (${secrets.join(', ')}). Quítalo antes de enviarlo a un proveedor de IA.`)
    const token = globalThis.crypto.randomUUID()
    pending.set(token, { file, original: content })
    return { token, name, path: file, content }
  })

  handle('codefix:propose', async (token: unknown, instruction: unknown) => {
    await assertEnabled()
    const p = get(token)
    const text = await deps.complete(
      FIX_SYSTEM,
      [
        {
          role: 'user',
          content: buildFixMessage(path.basename(p.file), p.original, String(instruction ?? '').slice(0, 4000))
        }
      ],
      AbortSignal.timeout(180_000)
    )
    const fix = parseFix(text)
    if (!fix) throw new Error('La IA no devolvió el archivo corregido. Vuelve a intentarlo con una petición más concreta.')
    // Se conservan los saltos de línea del archivo original (CRLF en Windows).
    p.proposal = p.original.includes('\r\n') ? fix.code.replace(/\r?\n/g, '\r\n') : fix.code
    return { explanation: fix.explanation, proposal: p.proposal }
  })

  handle('codefix:apply', async (token: unknown) => {
    await assertEnabled()
    const p = get(token)
    if (p.proposal === undefined) throw new Error('No hay ninguna propuesta que aplicar.')
    if ((await fs.readFile(p.file, 'utf8')) !== p.original)
      throw new Error('El archivo cambió desde que lo abriste. Vuelve a elegirlo para no pisar tus cambios.')
    await fs.mkdir(deps.backupDir, { recursive: true })
    p.backup = path.join(deps.backupDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-${path.basename(p.file)}`)
    await fs.copyFile(p.file, p.backup)
    await fs.writeFile(p.file, p.proposal, 'utf8')
    return { backup: p.backup }
  })

  handle('codefix:undo', async (token: unknown) => {
    const p = get(token)
    if (!p.backup) throw new Error('No hay ningún cambio aplicado que deshacer.')
    if ((await fs.readFile(p.file, 'utf8')) !== p.proposal)
      throw new Error('El archivo cambió después de aplicar la corrección; restáuralo a mano desde la copia: ' + p.backup)
    await fs.copyFile(p.backup, p.file)
    pending.delete(token as string)
  })
}
