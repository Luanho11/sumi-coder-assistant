import type { Item, ItemStat } from './types'

// Sorteo de ítems de examen: cubre todos los objetivos, evita repetir los del intento anterior mientras el banco alcance
// y prefiere los menos vistos. Con `yaPreguntado` deja para el final los que repiten lo que la clase ya preguntó.

const palabras = (it: Item) => new Set(`${it.prompt} ${JSON.stringify(it.options ?? it.steps ?? '')}`.toLowerCase().match(/\p{L}{4,}/gu) ?? [])

/** Dos ítems «repiten» si comparten la mitad de sus palabras: la misma pregunta con otras letras. */
export function repiten(a: Item, b: Item): boolean {
  const x = palabras(a)
  const y = palabras(b)
  let comunes = 0
  for (const w of x) if (y.has(w)) comunes++
  return comunes / Math.max(1, x.size + y.size - comunes) >= 0.5
}

export function seededRng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function drawItems(bank: Item[], n: number, opts: { prev?: string[]; stats?: Record<string, ItemStat>; yaPreguntado?: Item[]; rng?: () => number } = {}): Item[] {
  const rng = opts.rng ?? Math.random
  if (bank.length <= n) return shuffle(bank, rng)
  const prev = new Set(opts.prev ?? [])
  const seen = (it: Item) => opts.stats?.[it.id]?.seen ?? 0
  const eco = new Set(bank.filter((it) => opts.yaPreguntado?.some((q) => repiten(it, q))).map((it) => it.id))
  const rank = (items: Item[]) =>
    shuffle(items, rng).sort((a, b) => Number(prev.has(a.id)) - Number(prev.has(b.id)) || Number(eco.has(a.id)) - Number(eco.has(b.id)) || seen(a) - seen(b))
  const chosen: Item[] = []
  const used = new Set<string>()
  // Un ítem de cada objetivo primero: el examen mide todo lo que se enseñó.
  const byObj = new Map<string, Item[]>()
  for (const it of bank) byObj.set(it.objective, [...(byObj.get(it.objective) ?? []), it])
  for (const items of shuffle([...byObj.values()], rng)) {
    if (chosen.length >= n) break
    const pick = rank(items)[0]
    chosen.push(pick)
    used.add(pick.id)
  }
  for (const it of rank(bank.filter((x) => !used.has(x.id)))) {
    if (chosen.length >= n) break
    chosen.push(it)
  }
  return shuffle(chosen, rng)
}
