import { Fragment, type ReactNode } from 'react'

// Resaltado de sintaxis ligero y propio (sin librería): colorea JS/TS, SQL, JSON y Bash por tokens.
// No pretende ser perfecto, solo legible; ante la duda deja el texto sin color.

type Kind = 'kw' | 'str' | 'num' | 'com' | 'fn' | 'punct' | 'plain'

const JS_KW = 'const let var function return if else for while do switch case break continue new class extends super this import export from default async await try catch finally throw typeof instanceof of in null undefined true false void yield static get set'
const SQL_KW = 'select from where group by order having join left right inner outer on as insert into values update set delete create table primary key foreign references index and or not null distinct limit offset union all count sum avg min max case when then end desc asc between like exists'
const BASH_KW = 'cd ls npm npx node git docker run build test echo export sudo rm mkdir cp mv cat curl'

const LANGS: Record<string, { keywords: Set<string>; line: string; blockStr: boolean }> = {
  javascript: { keywords: words(JS_KW), line: '//', blockStr: true },
  typescript: { keywords: words(`${JS_KW} interface type enum implements namespace readonly public private protected abstract as keyof infer`), line: '//', blockStr: true },
  sql: { keywords: words(SQL_KW.toUpperCase() + ' ' + SQL_KW), line: '--', blockStr: false },
  json: { keywords: words('true false null'), line: '', blockStr: false },
  bash: { keywords: words(BASH_KW), line: '#', blockStr: false }
}
const ALIAS: Record<string, string> = { js: 'javascript', ts: 'typescript', jsx: 'javascript', tsx: 'typescript', shell: 'bash', sh: 'bash', postgres: 'sql', mysql: 'sql' }

function words(s: string): Set<string> {
  return new Set(s.split(/\s+/).filter(Boolean))
}

export function highlight(code: string, lang?: string): ReactNode {
  const key = ALIAS[lang ?? ''] ?? lang ?? ''
  const spec = LANGS[key]
  if (!spec) return code
  const tokens: { kind: Kind; text: string }[] = []
  let i = 0
  const n = code.length
  const isWord = (c: string) => /[A-Za-z0-9_$]/.test(c)
  while (i < n) {
    const c = code[i]
    const rest = code.slice(i)
    // Comentarios de línea
    if (spec.line && rest.startsWith(spec.line)) {
      const end = code.indexOf('\n', i)
      const stop = end === -1 ? n : end
      tokens.push({ kind: 'com', text: code.slice(i, stop) })
      i = stop
      continue
    }
    // Comentario de bloque
    if (spec.blockStr && rest.startsWith('/*')) {
      const end = code.indexOf('*/', i + 2)
      const stop = end === -1 ? n : end + 2
      tokens.push({ kind: 'com', text: code.slice(i, stop) })
      i = stop
      continue
    }
    // Cadenas
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < n && code[j] !== c) {
        if (code[j] === '\\') j++
        j++
      }
      tokens.push({ kind: 'str', text: code.slice(i, Math.min(j + 1, n)) })
      i = j + 1
      continue
    }
    // Números
    if (/[0-9]/.test(c)) {
      let j = i
      while (j < n && /[0-9._xa-fA-F]/.test(code[j])) j++
      tokens.push({ kind: 'num', text: code.slice(i, j) })
      i = j
      continue
    }
    // Identificadores y palabras clave
    if (isWord(c)) {
      let j = i
      while (j < n && isWord(code[j])) j++
      const word = code.slice(i, j)
      const nextNonSpace = code.slice(j).match(/^\s*\(/)
      if (spec.keywords.has(word)) tokens.push({ kind: 'kw', text: word })
      else if (nextNonSpace) tokens.push({ kind: 'fn', text: word })
      else tokens.push({ kind: 'plain', text: word })
      i = j
      continue
    }
    // Puntuación y espacios
    if (/[{}()[\].,;:=+\-*/<>!&|?%]/.test(c)) {
      tokens.push({ kind: 'punct', text: c })
      i++
      continue
    }
    tokens.push({ kind: 'plain', text: c })
    i++
  }
  return tokens.map((t, k) => (t.kind === 'plain' ? <Fragment key={k}>{t.text}</Fragment> : <span key={k} className={`tok-${t.kind}`}>{t.text}</span>))
}
