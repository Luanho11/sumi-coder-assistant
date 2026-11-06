// Corrección de archivos con permiso explícito: qué archivos se bloquean, qué se envía al modelo
// y cómo se muestra el cambio antes de aplicarlo.

export const MAX_FIX_BYTES = 300_000

const BLOCKED_NAMES = [
  /^\.env(\..*)?$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)/i,
  /^\.npmrc$/i,
  /^\.netrc$/i,
  /^\.pypirc$/i,
  /secrets?\.(json|ya?ml|toml)$/i,
  /^credentials/i
]
const BLOCKED_EXT = /\.(pem|key|p12|pfx|jks|keystore|kdbx|crt|cer)$/i

export function isBlockedFile(name: string): boolean {
  return BLOCKED_EXT.test(name) || BLOCKED_NAMES.some((re) => re.test(name))
}

const SECRET_PATTERNS: [string, RegExp][] = [
  ['clave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['clave de AWS', /AKIA[0-9A-Z]{16}/],
  ['clave de Google', /AIza[0-9A-Za-z_-]{35}/],
  ['token de GitHub', /gh[pousr]_[A-Za-z0-9]{36}/],
  ['clave tipo sk-', /\bsk-[A-Za-z0-9_-]{20,}/],
  ['token de Slack', /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ['cadena de conexión con contraseña', /\b[a-z]+:\/\/[^\s:/@]+:[^\s@/]+@/i]
]

/** Tipos de secreto encontrados en el contenido; si hay alguno no se envía al proveedor. */
export function findSecrets(content: string): string[] {
  return SECRET_PATTERNS.filter(([, re]) => re.test(content)).map(([name]) => name)
}

/**
 * Comprobación sencilla de .gitignore: nombres exactos, comodines con * y carpetas acabadas en /.
 * No cubre negaciones (!) ni ** en medio de la ruta; ante la duda el archivo se bloquea igual por nombre o contenido.
 */
export function isIgnored(patterns: string[], relPath: string): boolean {
  const parts = relPath.split('/')
  for (const raw of patterns) {
    const p = raw.trim()
    if (!p || p.startsWith('#') || p.startsWith('!')) continue
    const dir = p.endsWith('/')
    const body = p.replace(/^\//, '').replace(/\/$/, '')
    const re = new RegExp(
      `^${body
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')}$`
    )
    if (body.includes('/')) {
      if (re.test(relPath) || parts.some((_, i) => re.test(parts.slice(0, i + 1).join('/')))) return true
    } else {
      const candidates = dir ? parts.slice(0, -1) : parts
      if (candidates.some((part) => re.test(part))) return true
    }
  }
  return false
}

export const FIX_SYSTEM = `Eres XARA, ingeniera senior. Corriges UN archivo según lo que pide el usuario.
Reglas:
- Cambia solo lo necesario; respeta estilo, nombres y formato del archivo.
- Devuelve primero una sección "## Cambios" con una lista breve de qué cambias y por qué.
- Después, una sección "## Archivo" con el archivo COMPLETO corregido en un único bloque de código. Nada después.
- Si la petición no está clara o el cambio es arriesgado, dilo en "## Cambios" y devuelve el archivo sin modificar.`

export function buildFixMessage(fileName: string, content: string, instruction: string): string {
  return `Archivo: ${fileName}\n\nQué quiero corregir: ${instruction.trim() || 'Revisa y corrige errores evidentes.'}\n\n\`\`\`\n${content}\n\`\`\``
}

/** Separa la explicación y el último bloque de código de la respuesta. */
export function parseFix(text: string): { explanation: string; code: string } | undefined {
  const blocks = [...text.matchAll(/```[^\n]*\n([\s\S]*?)\n?```/g)]
  const last = blocks.at(-1)
  if (!last) return undefined
  const explanation = text
    .slice(0, last.index)
    .replace(/##\s*Archivo\s*$/i, '')
    .replace(/^##\s*Cambios\s*/i, '')
    .trim()
  return { explanation, code: last[1] }
}

export interface DiffLine {
  type: 'same' | 'add' | 'del'
  text: string
}

/** Diff por líneas con LCS. Para archivos muy grandes cae a "todo borrado / todo añadido". */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split(/\r?\n/)
  const b = after.split(/\r?\n/)
  if (a.length * b.length > 4_000_000) return [...a.map((text) => ({ type: 'del' as const, text })), ...b.map((text) => ({ type: 'add' as const, text }))]
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i] })
      i++
      j++
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ type: 'del', text: a[i++] })
    else out.push({ type: 'add', text: b[j++] })
  }
  while (i < a.length) out.push({ type: 'del', text: a[i++] })
  while (j < b.length) out.push({ type: 'add', text: b[j++] })
  return out
}
