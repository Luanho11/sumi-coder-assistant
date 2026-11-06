import { speakableText } from '../voice'
import type { Lesson, LessonExtra } from './types'

// Guion de la clase en vídeo: cada diapositiva es una escena que XARA narra mientras sus bloques aparecen
// en pantalla al ritmo de la voz (como los vídeos de clase de NotebookLM).

export interface Scene {
  kind: 'intro' | 'slide' | 'outro'
  title: string
  /** Trozos de Markdown que se van mostrando: un párrafo, un punto de lista, una tabla o un bloque de código. */
  blocks: string[]
  /** En qué fracción de la narración (0 a 1) aparece cada bloque. */
  reveals: number[]
  narration: string
}

const LIST_ITEM = /^\s*([-*+]|\d+\.)\s/
// Un bloque que casi no se dice en voz alta (una tabla, un emoji) cuenta como una frase corta para que también aparezca.
const MIN_WEIGHT = 20

/** Parte el Markdown de una diapositiva en bloques que se puedan revelar uno a uno sin romper el código ni las tablas. */
export function splitBlocks(markdown: string): string[] {
  const blocks: string[] = []
  let current: string[] = []
  let fenced = false
  const flush = () => {
    if (current.some((l) => l.trim())) blocks.push(current.join('\n').trim())
    current = []
  }
  for (const line of markdown.split('\n')) {
    if (fenced) {
      current.push(line)
      if (line.trim().startsWith('```')) {
        fenced = false
        flush()
      }
      continue
    }
    if (line.trim().startsWith('```')) {
      flush()
      fenced = true
      current.push(line)
      continue
    }
    if (!line.trim()) {
      flush()
      continue
    }
    const isTable = line.trim().startsWith('|')
    const inTable = current.length > 0 && current[current.length - 1].trim().startsWith('|')
    if (LIST_ITEM.test(line) || isTable !== inTable) flush()
    current.push(line)
  }
  flush()
  return blocks
}

function weight(text: string): number {
  return Math.max(speakableText(text).length, MIN_WEIGHT)
}

function scene(kind: Scene['kind'], title: string, blocks: string[], narration: string): Scene {
  const total = weight(title) + blocks.reduce((sum, b) => sum + weight(b), 0)
  let said = weight(title)
  const reveals = blocks.map((b) => {
    const at = said / total
    said += weight(b)
    return at
  })
  return { kind, title, blocks, reveals, narration }
}

// Una diapositiva con más texto que esto se parte en varias, sin cortar un bloque (código, tabla o párrafo) por la mitad.
const MAX_CHARS_DIAPOSITIVA = 320

/** Reparte los bloques en grupos de, como mucho, MAX_CHARS_DIAPOSITIVA letras; un bloque más largo queda solo. */
export function agruparBloques(blocks: string[]): string[][] {
  const grupos: string[][] = []
  let actual: string[] = []
  let largo = 0
  for (const b of blocks) {
    if (actual.length && largo + b.length > MAX_CHARS_DIAPOSITIVA) {
      grupos.push(actual)
      actual = []
      largo = 0
    }
    actual.push(b)
    largo += b.length
  }
  if (actual.length) grupos.push(actual)
  return grupos
}

export function buildScenes(lesson: Lesson, extra?: LessonExtra): Scene[] {
  const intro = scene('intro', lesson.title, [], `${lesson.title}. ${extra?.summary ?? lesson.objective ?? ''}`)
  const slides = lesson.slides.flatMap((s) =>
    [agruparBloques(splitBlocks(s.content))].flatMap((g) => (g.length ? g : [[]])).map((grupo, i) => scene('slide', s.title, grupo, `${i === 0 ? `${s.title}. ` : ''}${grupo.join('\n\n')}`))
  )
  const learned = extra?.learned ?? []
  const outro = learned.length
    ? scene('outro', 'Lo que aprendiste', learned.map((l) => `- ${l}`), `Repasemos lo que aprendiste. ${learned.join('. ')}.`)
    : scene('outro', 'Clase terminada', [], `Muy bien, terminaste la clase ${lesson.title}.`)
  return [intro, ...slides, outro]
}

/** Frases de la narración, para los subtítulos. */
export function captionLines(narration: string): string[] {
  return speakableText(narration)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** La frase que se está diciendo cuando la narración va por `progress` (0 a 1). */
export function captionAt(lines: string[], progress: number): string {
  const total = lines.reduce((sum, l) => sum + l.length, 0)
  let said = 0
  for (const line of lines) {
    said += line.length
    if (said / total >= progress) return line
  }
  return lines[lines.length - 1] ?? ''
}

/** Minutos aproximados de la clase: unas 900 letras por minuto a ritmo de explicación. */
export function estimateMinutes(scenes: Scene[]): number {
  const chars = scenes.reduce((sum, s) => sum + speakableText(s.narration).length, 0)
  return Math.max(1, Math.round(chars / 900))
}
