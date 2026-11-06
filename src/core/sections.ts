// Divide la respuesta Markdown del modelo en secciones `## ...` para mostrarlas como bloques plegables.
// Funciona con texto parcial (durante el streaming) e ignora encabezados dentro de bloques de código.

export interface Section {
  /** Clave normalizada (minúsculas, sin tildes) para decidir el comportamiento en la interfaz. */
  key: string
  title: string
  body: string
}

export interface ParsedResponse {
  /** Texto anterior al primer encabezado (normalmente vacío). */
  preamble: string
  sections: Section[]
}

export function normalizeKey(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseSections(markdown: string): ParsedResponse {
  const lines = markdown.split(/\r?\n/)
  const sections: Section[] = []
  const preamble: string[] = []
  let current: { title: string; lines: string[] } | null = null
  let fence: string | null = null

  for (const line of lines) {
    const fenceMatch = /^\s*(```+|~~~+)/.exec(line)
    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (fence === null) fence = marker[0].repeat(marker.length)
      else if (marker.startsWith(fence)) fence = null
    }
    const heading = fence === null && !fenceMatch ? /^##\s+(.+?)\s*#*\s*$/.exec(line) : null
    if (heading) {
      if (current) sections.push(finish(current))
      current = { title: heading[1].replace(/\*\*/g, '').trim(), lines: [] }
      continue
    }
    if (current) current.lines.push(line)
    else preamble.push(line)
  }
  if (current) sections.push(finish(current))
  return { preamble: preamble.join('\n').trim(), sections }
}

function finish(s: { title: string; lines: string[] }): Section {
  return { key: normalizeKey(s.title), title: s.title, body: s.lines.join('\n').trim() }
}

/** Secciones que se muestran plegadas por defecto: detalle extenso que se consulta bajo demanda. */
const COLLAPSED_BY_DEFAULT = new Set(['explicacion', 'que repasar'])

export function isCollapsedByDefault(key: string, action: string): boolean {
  if (action === 'explain') return false
  return COLLAPSED_BY_DEFAULT.has(key)
}
