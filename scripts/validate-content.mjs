// Valida el contenido de la academia escrito como JSON: extras por ruta, rutas nuevas, retos de código y banco de entrevista.
// Uso: node scripts/validate-content.mjs  (sale con código 1 si hay errores)
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import initSqlJs from 'sql.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = path.join(root, 'src/core/academy/data')
const errors = []
const warnings = []
const fail = (where, msg) => errors.push(`${where}: ${msg}`)
const warn = (where, msg) => warnings.push(`${where}: ${msg}`)
const read = (file) => JSON.parse(readFileSync(file, 'utf8'))

const AREAS = ['fundamentos', 'frontend', 'backend', 'datos', 'calidad', 'analisis', 'devops', 'seguridad', 'ia']
const DIFFICULTIES = ['principiante', 'intermedio', 'avanzado']
const KINDS = ['guiado', 'practica_autonoma', 'reto', 'sintesis', 'aplicacion_real', 'entrevista']
const POLICIES = ['sin_ia', 'ia_tutor', 'ia_par']
const LEVELS = ['principiante', 'intermedio', 'avanzado', 'proyecto']
// Frases de relleno que LM señaló como genéricas: no aportan nada concreto.
const GENERIC = [
  /es (muy )?importante/i,
  /en el mundo actual/i,
  /hoy en día/i,
  /en conclusión/i,
  /cabe destacar/i,
  /juega un papel/i,
  /fundamental para/i,
  /amplia gama/i,
  /sumérgete/i,
  /\bdesbloquea/i,
  /el siguiente nivel/i,
  /potencia tu/i
]
const EMOJI = /\p{Extended_Pictographic}/u
const JARGON = /\b(API|endpoint|framework|runtime|callback|middleware|backend|frontend|deploy|query|hook|props|ORM|JWT|CRUD|async|stack)\b/

const isText = (v, max) => typeof v === 'string' && v.trim().length > 0 && (!max || v.length <= max)

function checkGeneric(where, text) {
  for (const re of GENERIC) if (re.test(text)) fail(where, `frase genérica (${re.source})`)
}

function checkQuestion(where, q) {
  if (!isText(q.question, 260)) fail(where, 'question vacía o > 260')
  if (!Array.isArray(q.options) || q.options.length !== 4 || !q.options.every((o) => isText(o, 160))) fail(where, 'options debe tener 4 textos ≤ 160')
  if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) fail(where, 'correctIndex 0-3')
  if (!isText(q.explanation, 240)) fail(where, 'explanation vacía o > 240')
  if (new Set(q.options ?? []).size !== (q.options ?? []).length) fail(where, 'opciones repetidas')
  checkGeneric(where, `${q.question} ${q.explanation}`)
}

function checkPositions(where, questions) {
  if (questions.length < 4) return
  const positions = new Set(questions.map((q) => q.correctIndex))
  if (positions.size < 3) fail(where, 'la respuesta correcta cae casi siempre en la misma posición')
}

const mermaid = (await import(path.join(root, 'node_modules/mermaid/dist/mermaid.core.mjs'))).default
async function checkDiagram(where, code) {
  if (!/classDef\s+\w+\s+fill:/.test(code) && !/^\s*(pie|journey|timeline|quadrantChart)/m.test(code)) fail(where, 'el diagrama no usa color (classDef ... fill:)')
  const nodes = new Set([...code.matchAll(/^\s*([A-Za-z]\w*)\s*[[({>]/gm)].map((m) => m[1]))
  if (nodes.size > 12) fail(where, `demasiados nodos (${nodes.size} > 12)`)
  try {
    await mermaid.parse(code)
  } catch (e) {
    // Fuera del navegador mermaid falla al configurar DOMPurify después de analizar bien el texto.
    if (!String(e.message).includes('DOMPurify')) fail(where, `mermaid no lo entiende: ${String(e.message).split('\n')[0]}`)
  }
}

const base = read(path.join(dataDir, 'base.json'))
const extraTracks = existsSync(path.join(dataDir, 'tracks'))
  ? readdirSync(path.join(dataDir, 'tracks'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ file: f, ...read(path.join(dataDir, 'tracks', f)) }))
  : []
const xaraIds = readFileSync(path.join(root, 'src/core/academy/xara-track.ts'), 'utf8')
const xaraLessons = [...new Set([...xaraIds.matchAll(/id: '(xa-l\d+)'/g)].map((m) => m[1]))]
const xaraModules = [...new Set([...xaraIds.matchAll(/id: '(xa-m\d+)'/g)].map((m) => m[1]))]

const tracks = new Map()
for (const t of base.tracks) tracks.set(t.id, { lessons: t.modules.flatMap((m) => m.lessons.map((l) => l.id)), modules: t.modules.map((m) => m.id) })
tracks.set('ingenieria-ia', { lessons: xaraLessons, modules: xaraModules })
const exerciseIds = new Set(base.exercises.map((e) => e.id))

for (const { file, track, exercises } of extraTracks) {
  const where = `tracks/${file}`
  if (!track || !Array.isArray(exercises)) {
    fail(where, 'debe tener { track, exercises }')
    continue
  }
  if (tracks.has(track.id)) fail(where, `id de ruta repetido: ${track.id}`)
  if (!AREAS.includes(track.area)) fail(where, `area inválida: ${track.area}`)
  if (!/^#[0-9a-f]{6}$/i.test(track.color ?? '')) fail(where, 'color debe ser #rrggbb')
  if (track.source !== 'xara') fail(where, "source debe ser 'xara'")
  for (const k of ['title', 'description']) if (!isText(track[k], 200)) fail(where, `${k} vacío o > 200`)
  const lessonIds = []
  for (const m of track.modules ?? []) {
    const mw = `${where} ${m.id}`
    if (m.trackId !== track.id) fail(mw, 'trackId del módulo no coincide')
    if (!LEVELS.includes(m.level)) fail(mw, `level inválido: ${m.level}`)
    if (!isText(m.title, 80) || !isText(m.description, 220)) fail(mw, 'title ≤ 80 y description ≤ 220')
    for (const l of m.lessons ?? []) {
      const lw = `${mw} ${l.id}`
      lessonIds.push(l.id)
      if (!isText(l.title, 80)) fail(lw, 'title vacío o > 80')
      if (!Array.isArray(l.slides) || l.slides.length < 2 || l.slides.length > 5) fail(lw, 'entre 2 y 5 slides')
      for (const s of l.slides ?? []) {
        if (!isText(s.title, 70)) fail(lw, `slide sin título o título > 70: ${s.title}`)
        if (!isText(s.content, 700)) fail(lw, `slide vacía o > 700 caracteres: ${s.title}`)
        checkGeneric(lw, s.content)
      }
      if (!Array.isArray(l.videos)) fail(lw, 'videos debe ser un array (puede estar vacío)')
      for (const v of l.videos ?? []) if (v.kind !== 'video' || !isText(v.title) || !/^https:\/\//.test(v.url ?? '')) fail(lw, 'vídeo mal formado')
      if (l.quiz) {
        checkQuestion(`${lw} quiz`, l.quiz)
        if (l.quiz.area !== track.area || !DIFFICULTIES.includes(l.quiz.difficulty)) fail(lw, 'quiz.area/difficulty')
      }
      if (l.labId !== undefined) fail(lw, 'labId ya no existe: la práctica va en exercises')
      for (const id of l.exerciseIds ?? []) if (!exercises.some((e) => e.id === id)) fail(lw, `ejercicio inexistente: ${id}`)
    }
  }
  for (const e of exercises) {
    const ew = `${where} ${e.id}`
    if (exerciseIds.has(e.id)) fail(ew, 'id de ejercicio repetido')
    exerciseIds.add(e.id)
    if (e.trackId !== track.id || !lessonIds.includes(e.lessonId)) fail(ew, 'trackId/lessonId no coinciden con la ruta')
    if (!DIFFICULTIES.includes(e.difficulty) || !KINDS.includes(e.kind) || !POLICIES.includes(e.aiPolicy)) fail(ew, 'difficulty/kind/aiPolicy inválidos')
    if (!isText(e.title, 90) || !isText(e.description, 900)) fail(ew, 'title ≤ 90 y description ≤ 900')
    if (typeof e.theory !== 'boolean') fail(ew, 'theory debe ser booleano')
    for (const k of ['constraints', 'hints', 'criteria', 'commonErrors', 'resources']) if (!Array.isArray(e[k])) fail(ew, `${k} debe ser array`)
    if ((e.hints ?? []).length < 3) fail(ew, 'al menos 3 pistas (de menos a más concretas)')
    if ((e.criteria ?? []).length < 3) fail(ew, 'al menos 3 criterios de evaluación')
    checkGeneric(ew, e.description)
  }
  tracks.set(track.id, { lessons: lessonIds, modules: (track.modules ?? []).map((m) => m.id) })
}

const extrasDir = path.join(dataDir, 'extras')
const lessonsWithExtras = new Set()
for (const file of existsSync(extrasDir) ? readdirSync(extrasDir).filter((f) => f.endsWith('.json')) : []) {
  const where = `extras/${file}`
  const data = read(path.join(extrasDir, file))
  const track = tracks.get(data.trackId)
  if (!track) {
    fail(where, `trackId desconocido: ${data.trackId}`)
    continue
  }
  if (file !== `${data.trackId}.json`) fail(where, 'el archivo debe llamarse <trackId>.json')
  const seenLearned = new Set()
  const allChecks = []
  for (const [id, l] of Object.entries(data.lessons ?? {})) {
    const lw = `${where} ${id}`
    if (!track.lessons.includes(id)) fail(lw, 'lección que no existe en la ruta')
    lessonsWithExtras.add(id)
    if (!EMOJI.test(l.emoji ?? '') || l.emoji.length > 4) fail(lw, 'emoji: un solo emoji')
    if (!isText(l.summary, 120)) fail(lw, 'summary vacío o > 120')
    if (!isText(l.analogy, 200)) fail(lw, 'analogy vacía o > 200')
    if (!Array.isArray(l.learned) || l.learned.length < 3 || l.learned.length > 4) fail(lw, 'learned: 3 o 4 frases')
    for (const s of l.learned ?? []) {
      if (!isText(s, 100)) fail(lw, `learned > 100: ${s}`)
      if (!EMOJI.test([...s][0] ?? '')) fail(lw, `cada frase de learned empieza con emoji: ${s}`)
      if (JARGON.test(s)) fail(lw, `learned con tecnicismo: ${s}`)
      if (seenLearned.has(s)) fail(lw, `learned repetido en otra lección: ${s}`)
      seenLearned.add(s)
    }
    if (!Array.isArray(l.check) || l.check.length !== 2) fail(lw, 'check: exactamente 2 preguntas de repaso')
    for (const [i, q] of (l.check ?? []).entries()) checkQuestion(`${lw} check[${i}]`, q)
    allChecks.push(...(l.check ?? []))
    if (l.diagram !== undefined) await checkDiagram(`${lw} diagram`, l.diagram)
    checkGeneric(lw, `${l.summary} ${l.analogy} ${(l.learned ?? []).join(' ')}`)
  }
  checkPositions(`${where} check`, allChecks)
  for (const id of track.lessons) if (!lessonsWithExtras.has(id)) fail(where, `falta la lección ${id}`)
  for (const [id, m] of Object.entries(data.modules ?? {})) {
    const mw = `${where} ${id}`
    if (!track.modules.includes(id)) fail(mw, 'módulo que no existe en la ruta')
    if (!EMOJI.test(m.emoji ?? '')) fail(mw, 'emoji del módulo')
    if (!Array.isArray(m.exam) || m.exam.length < 5 || m.exam.length > 8) fail(mw, 'exam: entre 5 y 8 preguntas')
    for (const [i, q] of (m.exam ?? []).entries()) checkQuestion(`${mw} exam[${i}]`, q)
    checkPositions(`${mw} exam`, m.exam ?? [])
  }
  for (const id of track.modules) if (!data.modules?.[id]) fail(where, `falta el examen del módulo ${id}`)
}
for (const [id] of tracks) if (!existsSync(path.join(extrasDir, `${id}.json`))) warn('extras', `la ruta ${id} no tiene extras todavía`)

const SQL = await initSqlJs()
function runSql(setup, query) {
  const db = new SQL.Database()
  try {
    db.run(setup)
    const res = db.exec(query)
    const last = res[res.length - 1]
    return last ? { columns: last.columns, rows: last.values } : { columns: [], rows: [] }
  } finally {
    db.close()
  }
}
function sameResult(got, expected, ordered) {
  if (JSON.stringify(got.columns) !== JSON.stringify(expected.columns)) return false
  const norm = (rows) => rows.map((r) => JSON.stringify(r))
  const a = norm(got.rows)
  const b = norm(expected.rows)
  if (!ordered) {
    a.sort()
    b.sort()
  }
  return JSON.stringify(a) === JSON.stringify(b)
}
function runJs(code, functionName, tests) {
  return tests.map((t) => {
    try {
      const ctx = vm.createContext({})
      vm.runInContext(`${code}\n;globalThis.__fn = ${functionName}`, ctx, { timeout: 1000 })
      ctx.__args = structuredClone(t.args)
      const got = vm.runInContext('__fn(...__args)', ctx, { timeout: 1000 })
      return JSON.stringify(got) === JSON.stringify(t.expected)
    } catch {
      return false
    }
  })
}

const challengesFile = path.join(dataDir, 'challenges.json')
if (existsSync(challengesFile)) {
  const challenges = read(challengesFile)
  const ids = new Set()
  for (const c of challenges) {
    const cw = `challenges ${c.id}`
    if (ids.has(c.id)) fail(cw, 'id repetido')
    ids.add(c.id)
    if (!AREAS.includes(c.area) || !DIFFICULTIES.includes(c.difficulty)) fail(cw, 'area/difficulty inválidos')
    if (c.trackId && !tracks.has(c.trackId)) fail(cw, `trackId desconocido: ${c.trackId}`)
    if (c.lessonId && !tracks.get(c.trackId)?.lessons.includes(c.lessonId)) fail(cw, `lessonId no pertenece a la ruta: ${c.lessonId}`)
    if (!isText(c.title, 60) || !isText(c.prompt, 400) || !EMOJI.test(c.emoji ?? '')) fail(cw, 'title ≤ 60, prompt ≤ 400 y emoji')
    if (!Array.isArray(c.hints) || c.hints.length !== 3) fail(cw, 'exactamente 3 pistas')
    if (![10, 20, 30, 50].includes(c.xp)) fail(cw, 'xp debe ser 10, 20, 30 o 50')
    checkGeneric(cw, c.prompt)
    if (c.analysis && !isText(c.analysis, 600)) fail(cw, 'analysis ≤ 600')
    const kind = c.kind ?? 'resuelve'
    if (!['resuelve', 'bug', 'explica', 'css'].includes(kind)) fail(cw, 'kind inválido')
    if (kind === 'explica') {
      if (!Array.isArray(c.explainPoints) || c.explainPoints.length < 3) fail(cw, 'explica: explainPoints (≥3)')
      else checkGeneric(cw, c.explainPoints.join(' '))
      if (!isText(c.starter, 2000)) fail(cw, 'explica: starter con el código a explicar')
    } else if (kind === 'css' || c.language === 'css') {
      if (!isText(c.html, 2000) || !isText(c.model, 300)) fail(cw, 'css: html (código fijo) y model (descripción del modelo)')
      if (!isText(c.starter, 2000) || !isText(c.solution, 2000)) fail(cw, 'css: starter (CSS roto) y solution (CSS correcto)')
    } else if (c.language === 'javascript') {
      if (!/^[A-Za-z_]\w*$/.test(c.functionName ?? '')) fail(cw, 'functionName inválido')
      if (!Array.isArray(c.tests) || c.tests.length < 3) fail(cw, 'al menos 3 tests { name, args: [], expected }')
      else {
        if (!runJs(c.solution, c.functionName, c.tests).every(Boolean)) fail(cw, 'la solución no pasa sus tests')
        if (runJs(c.starter, c.functionName, c.tests).every(Boolean)) fail(cw, kind === 'bug' ? 'el código con el bug ya pasa todos los tests' : 'el código inicial ya pasa todos los tests')
      }
    } else if (c.language === 'sql') {
      try {
        const expected = runSql(c.setup, c.solution)
        if (!expected.rows.length) fail(cw, 'la solución no devuelve filas')
        if (c.expected && !sameResult(expected, c.expected, c.ordered)) fail(cw, 'expected no coincide con la solución')
        let starterOk = false
        try {
          starterOk = sameResult(runSql(c.setup, c.starter), expected, c.ordered)
        } catch {}
        if (starterOk) fail(cw, 'el código inicial ya da el resultado correcto')
      } catch (e) {
        fail(cw, `SQL falla: ${e.message}`)
      }
    } else fail(cw, "language debe ser 'javascript', 'sql' o 'css'")
  }
}

const capstonesFile = path.join(dataDir, 'capstones.json')
if (existsSync(capstonesFile)) {
  const ids = new Set()
  for (const c of read(capstonesFile)) {
    const cw = `capstones ${c.id}`
    if (ids.has(c.id)) fail(cw, 'id repetido')
    ids.add(c.id)
    if (!tracks.has(c.trackId)) fail(cw, `trackId desconocido: ${c.trackId}`)
    if (!DIFFICULTIES.includes(c.level) || !EMOJI.test(c.emoji ?? '')) fail(cw, 'level y emoji')
    if (!isText(c.title, 80) || !isText(c.summary, 300) || !isText(c.why, 300)) fail(cw, 'title ≤ 80, summary y why ≤ 300')
    for (const k of ['features', 'acceptance', 'deliverables', 'stretch']) if (!Array.isArray(c[k]) || c[k].length < 2) fail(cw, `${k}: al menos 2`)
    if (!Array.isArray(c.milestones) || c.milestones.length < 3) fail(cw, 'al menos 3 hitos')
    for (const m of c.milestones ?? []) if (!isText(m.title, 90) || !Array.isArray(m.tasks) || m.tasks.length < 2) fail(cw, `hito mal formado: ${m.title}`)
    if (!c.aiGuide || !Array.isArray(c.aiGuide.steps) || c.aiGuide.steps.length < 3 || !Array.isArray(c.aiGuide.samplePrompts) || c.aiGuide.samplePrompts.length < 2)
      fail(cw, 'aiGuide: steps (≥3) y samplePrompts (≥2)')
    checkGeneric(cw, `${c.summary} ${c.why} ${(c.features ?? []).join(' ')}`)
  }
  for (const [id] of tracks) if (![...ids].some((x) => read(capstonesFile).find((c) => c.id === x && c.trackId === id))) warn('capstones', `la ruta ${id} no tiene proyecto final todavía`)
}

const interviewFile = path.join(dataDir, 'interview.json')
if (existsSync(interviewFile)) {
  const ids = new Set()
  for (const q of read(interviewFile)) {
    const qw = `interview ${q.id}`
    if (ids.has(q.id)) fail(qw, 'id repetido')
    ids.add(q.id)
    if (!AREAS.includes(q.area) || !DIFFICULTIES.includes(q.level)) fail(qw, 'area/level inválidos')
    if (!['tecnica', 'conductual', 'diseno', 'codigo'].includes(q.kind)) fail(qw, 'kind inválido')
    if (!isText(q.question, 300) || !isText(q.followUp, 200)) fail(qw, 'question ≤ 300 y followUp ≤ 200')
    if (!Array.isArray(q.keyPoints) || q.keyPoints.length < 3 || q.keyPoints.length > 5) fail(qw, 'keyPoints: 3 a 5')
    if (!Array.isArray(q.redFlags) || q.redFlags.length < 2 || q.redFlags.length > 3) fail(qw, 'redFlags: 2 o 3')
    checkGeneric(qw, `${q.question} ${q.keyPoints?.join(' ')}`)
  }
}

for (const w of warnings) console.log(`aviso  ${w}`)
for (const e of errors) console.log(`error  ${e}`)
console.log(errors.length ? `\n${errors.length} errores` : '\nContenido válido')
process.exit(errors.length ? 1 : 0)
