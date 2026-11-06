// El modelo añade al final comentarios `<!-- temas: a, b -->` y, a veces, `<!-- recordar: dato -->`.
// Se extraen para el perfil y la memoria y se ocultan en la interfaz.

const TOPICS_RE = /<!--\s*temas?\s*:([\s\S]*?)-->/i
const REMEMBER_RE = /<!--\s*recordar\s*:([\s\S]*?)-->/gi

export function extractTopics(output: string): { topics: string[]; text: string } {
  const m = TOPICS_RE.exec(output)
  if (!m) return { topics: [], text: output }
  const topics = [
    ...new Set(
      m[1]
        .split(/[,;\n]/)
        .map((t) => t.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40))
        .filter((t) => t.length > 1)
    )
  ].slice(0, 5)
  return { topics, text: output.replace(TOPICS_RE, '').trimEnd() }
}

export function extractRemember(output: string): { facts: string[]; text: string } {
  const facts = [...output.matchAll(REMEMBER_RE)]
    .map((m) => m[1].trim().replace(/\s+/g, ' ').slice(0, 200))
    .filter((f) => f.length > 3)
    .slice(0, 2)
  return { facts, text: output.replace(REMEMBER_RE, '').trimEnd() }
}

/** Oculta comentarios HTML, incluido uno a medio recibir durante el streaming. */
export function stripHiddenComments(text: string): string {
  return text.replace(/<!--[\s\S]*?-->/g, '').replace(/<!--[\s\S]*$/, '').trimEnd()
}
