// Genera la matriz de alineación de un curso v2: para cada objetivo, qué parte lo enseña y qué ítems y prácticas lo evalúan.
// Uso: node scripts/gen-alineacion-v2.mjs [curso.json ...]   (sin argumentos, todos los de src/core/academy/data/courses)
// Salida: docs/alineacion/<curso>.md
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'src/core/academy/data/courses')
const files = process.argv.length > 2 ? process.argv.slice(2) : readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f))
mkdirSync(path.join(root, 'docs/alineacion'), { recursive: true })

for (const f of files) {
  const c = JSON.parse(readFileSync(f, 'utf8'))
  const out = [`# Matriz de alineación · ${c.title}`, '', `Estado del curso: **${c.status}**. Cada objetivo debe aparecer enseñado en una parte y evaluado en ítems de comprobación, práctica y dominio.`, '']
  for (const lv of c.levels) for (const m of lv.modules) for (const l of m.lessons) {
    out.push(`## ${l.title} (\`${l.id}\`)`, '', '| Objetivo | Se enseña en | Micro-ejercicios | Comprobación | Práctica | Dominio |', '|---|---|---|---|---|---|')
    for (const o of l.objectives) {
      const parts = l.parts.filter((p) => (p.objectives ?? []).includes(o.id))
      const micro = parts.flatMap((p) => p.scenes.filter((s) => s.micro && s.micro.objective === o.id).map((s) => s.micro.id))
      const cp = parts.flatMap((p) => p.checkpoint.filter((i) => i.objective === o.id).map((i) => i.id))
      const pr = l.practice.filter((e) => (e.objectives ?? []).includes(o.id)).map((e) => e.tier)
      const ma = l.mastery.items.filter((i) => i.objective === o.id).map((i) => `${i.id} (${i.type})`)
      out.push(`| ${o.text.replace(/^Podrás /, '')} | ${parts.map((p) => p.title).join('; ') || '❌ ninguna'} | ${micro.join(', ') || '—'} | ${cp.join(', ') || '—'} | ${pr.join(', ') || '❌'} | ${ma.join(', ') || '❌'} |`)
    }
    out.push('')
  }
  writeFileSync(path.join(root, 'docs/alineacion', `${c.id}.md`), out.join('\n'))
  console.log(`docs/alineacion/${c.id}.md`)
}
