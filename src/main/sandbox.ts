import path from 'node:path'
import { Worker } from 'node:worker_threads'
import initSqlJs, { type SqlJsStatic } from 'sql.js'
import { findChallenge } from '../core/academy/catalog'
import type { Challenge } from '../core/academy/types'

// Ejecuta el código del alumno de forma aislada: JavaScript en un worker sin acceso a Node, SQL en SQLite en memoria (sql.js).
// Nunca se usa eval en el proceso principal ni se toca el disco con lo que escribe el usuario.

export interface Grid {
  columns: string[]
  rows: unknown[][]
}

export interface TestResult {
  name: string
  passed: boolean
  expected: string
  got: string
  // Para los retos de SQL: el resultado y lo esperado como tabla real, no como texto con barras.
  gotGrid?: Grid
  expectedGrid?: Grid
}

export interface RunResult {
  ok: boolean
  passed: number
  total: number
  tests: TestResult[]
  error?: string
  logs?: string[]
}

const JS_TIMEOUT = 2000
const MAX_CODE = 20_000

// El worker recibe el código y los tests, y responde con el resultado de cada uno. No importa nada de Node.
const WORKER_SRC = `
const { parentPort, workerData } = require('node:worker_threads')
const logs = []
const console = { log: (...a) => logs.push(a.map(String).join(' ')), error: (...a) => logs.push(a.map(String).join(' ')), warn: () => {}, info: () => {} }
const results = []
try {
  // Se evalúa como script (sin paréntesis alrededor) y la última expresión, el nombre, devuelve la función declarada.
  const fn = (0, eval)(workerData.code + '\\n;' + workerData.functionName)
  if (typeof fn !== 'function') throw new Error('No se encontró la función ' + workerData.functionName)
  for (const t of workerData.tests) {
    try {
      const got = fn.apply(null, structuredClone(t.args))
      const gotJson = JSON.stringify(got) ?? 'undefined'
      const expJson = JSON.stringify(t.expected) ?? 'undefined'
      results.push({ name: t.name, passed: gotJson === expJson, expected: expJson, got: gotJson })
    } catch (e) {
      results.push({ name: t.name, passed: false, expected: JSON.stringify(t.expected), got: 'Error: ' + (e && e.message || e) })
    }
  }
  parentPort.postMessage({ results, logs })
} catch (e) {
  parentPort.postMessage({ error: (e && e.message) || String(e), logs })
}
`

function runJs(code: string, functionName: string, tests: NonNullable<Challenge['tests']>): Promise<RunResult> {
  return new Promise((resolve) => {
    const worker = new Worker(WORKER_SRC, { eval: true, workerData: { code, functionName, tests }, resourceLimits: { maxOldGenerationSizeMb: 64 } })
    const timer = setTimeout(() => {
      void worker.terminate()
      resolve({ ok: false, passed: 0, total: tests.length, tests: [], error: 'El código tardó demasiado (¿un bucle infinito?). Se detuvo a los 2 segundos.' })
    }, JS_TIMEOUT)
    worker.once('message', (msg: { results?: TestResult[]; error?: string; logs?: string[] }) => {
      clearTimeout(timer)
      void worker.terminate()
      if (msg.error) resolve({ ok: false, passed: 0, total: tests.length, tests: [], error: msg.error, logs: msg.logs })
      else {
        const results = msg.results ?? []
        resolve({ ok: results.every((r) => r.passed), passed: results.filter((r) => r.passed).length, total: results.length, tests: results, logs: msg.logs })
      }
    })
    worker.once('error', (err: Error) => {
      clearTimeout(timer)
      resolve({ ok: false, passed: 0, total: tests.length, tests: [], error: err.message })
    })
  })
}

let sqlPromise: Promise<SqlJsStatic> | null = null
function sql(): Promise<SqlJsStatic> {
  // En producción el .wasm va empaquetado junto al código del proceso principal.
  sqlPromise ??= initSqlJs({ locateFile: (f) => path.join(__dirname, f) })
  return sqlPromise
}

function query(SQL: SqlJsStatic, setup: string, code: string): Grid {
  const db = new SQL.Database()
  try {
    db.run(setup)
    const res = db.exec(code)
    const last = res[res.length - 1]
    return last ? { columns: last.columns, rows: last.values } : { columns: [], rows: [] }
  } finally {
    db.close()
  }
}

function sameRows(a: Grid, b: Grid, ordered: boolean): boolean {
  if (JSON.stringify(a.columns) !== JSON.stringify(b.columns)) return false
  const norm = (rows: unknown[][]) => {
    const out = rows.map((r) => JSON.stringify(r))
    if (!ordered) out.sort()
    return out
  }
  return JSON.stringify(norm(a.rows)) === JSON.stringify(norm(b.rows))
}

async function runSql(c: Challenge, code: string): Promise<RunResult> {
  const SQL = await sql()
  let got
  try {
    got = query(SQL, c.setup ?? '', code)
  } catch (err) {
    return { ok: false, passed: 0, total: 1, tests: [], error: `SQL: ${(err as Error).message}` }
  }
  const expected = query(SQL, c.setup ?? '', c.solution)
  const ok = sameRows(got, expected, c.ordered ?? false)
  const fmt = (r: Grid) => [r.columns.join(' | '), ...r.rows.map((row) => row.join(' | '))].join('\n') || '(sin filas)'
  return {
    ok,
    passed: ok ? 1 : 0,
    total: 1,
    tests: [{ name: 'Resultado esperado', passed: ok, expected: fmt(expected), got: fmt(got), gotGrid: got, expectedGrid: expected }]
  }
}

/** Ejecuta la solución del alumno a un reto y comprueba si pasa. */
export async function runChallenge(challengeId: string, code: string): Promise<RunResult> {
  const c = findChallenge(challengeId)
  if (!c) throw new Error('El reto no existe.')
  if (typeof code !== 'string' || code.length > MAX_CODE) throw new Error('Código no válido o demasiado largo.')
  if (c.kind === 'explica' || c.kind === 'css') throw new Error('Este reto no se ejecuta con pruebas.')
  return c.language === 'sql' ? runSql(c, code) : runJs(code, c.functionName ?? '', c.tests ?? [])
}

/** Permite probar JS o SQL libremente en el entorno (sin tests): el resultado o el error. */
export async function runScratch(language: 'javascript' | 'sql', code: string, setup = ''): Promise<RunResult> {
  if (typeof code !== 'string' || code.length > MAX_CODE) throw new Error('Código no válido o demasiado largo.')
  if (language === 'sql') {
    const SQL = await sql()
    try {
      const got = query(SQL, setup, code)
      const fmt = [got.columns.join(' | '), ...got.rows.map((r) => r.join(' | '))].join('\n') || '(sin filas)'
      return { ok: true, passed: 1, total: 1, tests: [{ name: 'Resultado', passed: true, expected: '', got: fmt, gotGrid: got }] }
    } catch (err) {
      return { ok: false, passed: 0, total: 1, tests: [], error: `SQL: ${(err as Error).message}` }
    }
  }
  const res = await runJs(`function __scratch() {\n${code}\n}`, '__scratch', [{ name: 'Ejecución', args: [], expected: undefined }])
  // En modo libre no hay pruebas: si el código lanza un error, ese error es el resultado.
  const thrown = res.tests[0]?.got.startsWith('Error: ') ? res.tests[0].got.slice(7) : undefined
  return { ...res, ok: !res.error && !thrown, tests: [], ...(thrown ? { error: thrown } : {}) }
}

/** Corrige un ítem de tipo `code` o `sql` de la academia v2 (mismas pruebas que los retos del Entorno). */
export async function runItem(item: { type: string; functionName?: string; tests?: { name?: string; args: unknown[]; expected: unknown }[]; setup?: string; solution?: string }, code: string): Promise<RunResult> {
  if (typeof code !== 'string' || code.length > MAX_CODE) throw new Error('Código no válido o demasiado largo.')
  if (item.type === 'sql') {
    return runSql({ setup: item.setup, solution: item.solution ?? '', ordered: false } as Challenge, code)
  }
  const tests = (item.tests ?? []).map((t, i) => ({ name: t.name ?? `Prueba ${i + 1}`, args: t.args, expected: t.expected }))
  return runJs(code, item.functionName ?? '', tests)
}
