// Validador del contenido pedagógico v2 de XARA (cursos de 3 niveles con compuertas de aprobación).
// Uso:
//   node scripts/validate-content-v2.mjs                      -> valida src/core/academy/data/courses/*.json
//   node scripts/validate-content-v2.mjs --lesson muestra.json -> valida una clase suelta ({ glossary, lesson })
//   node scripts/validate-content-v2.mjs --course curso.json   -> valida un curso concreto
// Sale con código 1 si hay errores. Los avisos (warn) no bloquean pero hay que leerlos.
// Los curso con "status": "draft" se validan clase por clase (estricto) pero sin exigir el curso completo.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
const warnings = []
const fail = (where, msg) => errors.push(`${where}: ${msg}`)
const warn = (where, msg) => warnings.push(`${where}: ${msg}`)
const read = (file) => JSON.parse(readFileSync(file, 'utf8'))

// ───────────────────────── Constantes del estándar (única fuente de verdad) ─────────────────────────
export const LIMITS = {
  sceneTitle: 70,
  sceneContentMax: 900,
  sceneOnScreenWords: 55, // texto en pantalla sin contar código, tablas ni diagramas: se dice, no se escribe
  storyOnScreenWords: 40,
  narrationMin: 140,
  narrationMax: 1500, // la voz recorta a 1.800 caracteres: nunca te acerques
  lessonNarrationWordsMin: 2400,
  lessonNarrationWordsMax: 4600,
  lessonScenesMin: 40,
  lessonScenesMax: 64,
  partsMin: 4,
  partsMax: 7,
  scenesPerPartMax: 14,
  realCaseSourcesMin: 2,
  storyScenesRealMin: 4,
  masteryItemsMin: 10,
  masteryPassPct: 80,
  moduleExamPerAttemptMin: 10,
  moduleExamBankMin: 20,
  levelExamPerAttemptMin: 20,
  levelExamBankMin: 50,
  levelEntryCheckMin: 8,
  passPct: 80,
  minPerObjectivePct: 60,
  practiceCScore: 70,
  projectScore: 70,
  glossaryMin: 15,
  microPerPartMin: 2
}
const BLOOM = ['recordar', 'comprender', 'aplicar', 'analizar', 'evaluar', 'crear']
const SCENE_KINDS = ['hook', 'story', 'concept', 'definition', 'analogy', 'worked-example', 'faded-example', 'non-example', 'misconception', 'compare', 'pause-think', 'demo', 'recap']
const ITEM_TYPES = ['mcq', 'multi', 'order', 'classify', 'fill', 'match', 'spot', 'code', 'sql', 'written']
const TIERS = ['A', 'B', 'C', 'D']
const LEVELS = ['principiante', 'intermedio', 'avanzado']
const AREAS = ['fundamentos', 'frontend', 'backend', 'datos', 'calidad', 'analisis', 'devops', 'seguridad', 'ia']
const POLICIES = ['sin_ia', 'ia_tutor', 'ia_par']
// Relleno que no enseña nada (heredado del validador v1) + vicios típicos de clase pobre.
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
// El profesor nunca da nada por sabido.
const ASSUMING = [/como (ya )?sabes/i, /como (ya )?(vimos|sabrás)/i, /obviamente/i, /evidentemente/i, /por supuesto que/i, /es trivial/i, /simplemente (tienes|basta)/i]
const BAD_OPTIONS = [/todas las anteriores/i, /ninguna de las anteriores/i, /todas son correctas/i, /ambas son correctas/i]
const EMOJI = /\p{Extended_Pictographic}/u

// ───────────────────────── Utilidades ─────────────────────────
const isText = (v, min = 1, max = Infinity) => typeof v === 'string' && v.trim().length >= min && v.length <= max
const arr = (v) => (Array.isArray(v) ? v : [])
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const words = (s) => (String(s).match(/[\p{L}\p{N}]+/gu) ?? []).length

/** Texto plano que el alumno lee en pantalla (sin código, tablas ni diagramas). */
function onScreenText(md) {
  return String(md)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/[*_`>#-]/g, ' ')
}
const hasVisual = (md) => /```mermaid/.test(md) || /^\s*\|.*\|\s*$/m.test(md) || /```[a-z]+/.test(md)

function termRegex(t) {
  const esc = norm(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}])${esc}(?![\\p{L}\\p{N}])`, 'iu')
}

function textOfItem(it) {
  return [it.prompt, it.explanation, ...arr(it.options).map((o) => (typeof o === 'string' ? o : `${o.text} ${o.whyNot ?? ''}`)), ...arr(it.steps), ...arr(it.cases).map((c) => c.text), it.template, it.artifact, ...arr(it.pairs).map((p) => `${p.left} ${p.right}`)]
    .filter(Boolean)
    .join(' \n ')
}

function checkGeneric(where, text) {
  for (const re of GENERIC) if (re.test(text)) fail(where, `frase genérica (${re.source}): di algo concreto`)
  for (const re of ASSUMING) if (re.test(text)) fail(where, `da algo por sabido (${re.source}): el profesor nunca asume`)
}

let mermaidParse = null
let mermaidChecked = false
async function checkDiagrams(where, md) {
  for (const m of String(md).matchAll(/```mermaid\n([\s\S]*?)```/g)) {
    const code = m[1]
    if (!/classDef\s+\w+\s+fill:/.test(code) && !/^\s*(pie|journey|timeline|quadrantChart|sequenceDiagram|stateDiagram)/m.test(code)) fail(where, 'el diagrama no usa color (classDef ... fill:)')
    const nodes = new Set([...code.matchAll(/^\s*([A-Za-z]\w*)\s*[[({>]/gm)].map((x) => x[1]))
    if (nodes.size > 12) fail(where, `demasiados nodos en el diagrama (${nodes.size} > 12)`)
    if (!mermaidChecked) {
      mermaidChecked = true
      try {
        mermaidParse = (await import(path.join(root, 'node_modules/mermaid/dist/mermaid.core.mjs'))).default
      } catch {
        warn('mermaid', 'mermaid no está instalado: no se comprobó la sintaxis de los diagramas')
      }
    }
    if (mermaidParse) {
      try {
        await mermaidParse.parse(code)
      } catch (e) {
        if (!String(e.message).includes('DOMPurify')) fail(where, `mermaid no lo entiende: ${String(e.message).split('\n')[0]}`)
      }
    }
  }
}

// ───────────────────────── Ítems (preguntas) ─────────────────────────
function checkItem(where, it, ctx) {
  if (!isText(it.id)) return fail(where, 'item sin id')
  if (ctx.itemIds.has(it.id)) fail(where, `id de item repetido: ${it.id}`)
  ctx.itemIds.add(it.id)
  if (!ITEM_TYPES.includes(it.type)) return fail(where, `type inválido: ${it.type}`)
  if (!BLOOM.includes(it.bloom)) fail(where, `bloom inválido: ${it.bloom}`)
  if (ctx.objectiveIds && !ctx.objectiveIds.has(it.objective)) fail(where, `objective inexistente: ${it.objective}`)
  if (!isText(it.prompt, 10, 600)) fail(where, 'prompt vacío o > 600')
  if (it.type !== 'written' && !isText(it.explanation, 30, 420)) fail(where, 'explanation entre 30 y 420 caracteres (explica POR QUÉ)')
  checkGeneric(where, textOfItem(it))
  switch (it.type) {
    case 'mcq': {
      const o = arr(it.options)
      if (o.length !== 4 || !o.every((x) => isText(x.text, 1, 220))) fail(where, 'mcq: 4 opciones {text, whyNot} con text ≤ 220')
      if (!Number.isInteger(it.correctIndex) || it.correctIndex < 0 || it.correctIndex > 3) fail(where, 'mcq: correctIndex 0-3')
      o.forEach((x, i) => {
        if (i !== it.correctIndex && !isText(x.whyNot, 15, 260)) fail(where, `mcq: la opción ${i + 1} (incorrecta) necesita whyNot (qué error de razonamiento delata)`)
        for (const re of BAD_OPTIONS) if (re.test(x.text ?? '')) fail(where, `mcq: opción prohibida (${re.source})`)
      })
      if (new Set(o.map((x) => x.text)).size !== o.length) fail(where, 'mcq: opciones repetidas')
      break
    }
    case 'multi': {
      const o = arr(it.options)
      const c = arr(it.correctIndexes)
      if (o.length < 5 || o.length > 6) fail(where, 'multi: 5-6 opciones')
      if (c.length < 2 || c.length >= o.length || !c.every((i) => Number.isInteger(i) && i >= 0 && i < o.length)) fail(where, 'multi: correctIndexes válidos (2 o más, no todas)')
      o.forEach((x, i) => {
        if (!c.includes(i) && !isText(x.whyNot, 15, 260)) fail(where, `multi: la opción ${i + 1} (incorrecta) necesita whyNot`)
      })
      break
    }
    case 'order':
      if (arr(it.steps).length < 4 || arr(it.steps).length > 7 || new Set(it.steps).size !== it.steps.length) fail(where, 'order: 4-7 pasos distintos, escritos en el orden correcto')
      break
    case 'classify': {
      const b = arr(it.buckets)
      const c = arr(it.cases)
      if (b.length < 2 || b.length > 4) fail(where, 'classify: 2-4 categorías')
      if (c.length < 6) fail(where, 'classify: al menos 6 casos')
      for (const k of c) if (!b.includes(k.bucket)) fail(where, `classify: caso con categoría inexistente: ${k.bucket}`)
      for (const name of b) if (c.filter((k) => k.bucket === name).length < 2) fail(where, `classify: la categoría "${name}" necesita al menos 2 casos`)
      break
    }
    case 'fill': {
      const n = (String(it.template ?? '').match(/___/g) ?? []).length
      const blanks = arr(it.blanks)
      if (n < 1 || n > 4 || n !== blanks.length) fail(where, 'fill: el template debe tener tantos "___" como blanks (1-4)')
      for (const bl of blanks) if (arr(bl.accept).length < 1) fail(where, 'fill: cada hueco necesita accept[]')
      break
    }
    case 'match':
      if (arr(it.pairs).length < 4 || arr(it.pairs).length > 6) fail(where, 'match: 4-6 pares')
      break
    case 'spot': {
      const lines = String(it.artifact ?? '').split('\n').length
      if (lines < 3) fail(where, 'spot: artifact con al menos 3 líneas')
      if (arr(it.correctLines).length < 1 || !it.correctLines.every((n) => Number.isInteger(n) && n >= 1 && n <= lines)) fail(where, 'spot: correctLines (1-based) válidas')
      break
    }
    case 'code':
    case 'sql':
      if (!isText(it.starter) || !isText(it.solution) || arr(it.tests).length < 2) fail(where, `${it.type}: starter, solution y al menos 2 tests`)
      break
    case 'written':
      if (arr(it.rubric).length < 3) fail(where, 'written: rúbrica con al menos 3 criterios')
      if (!isText(it.exemplar, 200)) fail(where, 'written: exemplar (respuesta modelo) de al menos 200 caracteres')
      if (arr(it.offlineChecklist).length < 3) fail(where, 'written: offlineChecklist con al menos 3 comprobaciones {criterion, anyOf[]}')
      break
  }
}

function checkItemSet(where, items, { min = 0, label = 'items' } = {}) {
  if (items.length < min) fail(where, `${label}: mínimo ${min}, hay ${items.length}`)
  const mcq = items.filter((i) => i.type === 'mcq')
  if (mcq.length >= 4 && new Set(mcq.map((i) => i.correctIndex)).size < 3) fail(where, `${label}: la respuesta correcta cae casi siempre en la misma posición`)
  if (mcq.length >= 4) {
    const longest = mcq.filter((i) => i.options[i.correctIndex].text.length >= Math.max(...i.options.map((o) => o.text.length))).length
    if (longest / mcq.length > 0.6) warn(where, `${label}: la opción correcta es la más larga en ${longest}/${mcq.length} preguntas (se adivina por tamaño)`)
  }
}

// ───────────────────────── Clase ─────────────────────────
async function checkLesson(lesson, course, state) {
  const w = lesson.id
  const order = state.order.get(lesson.id)
  const gl = state.glossary
  const objectiveIds = new Set(arr(lesson.objectives).map((o) => o.id))
  const ctx = { itemIds: state.itemIds, objectiveIds }
  if (!isText(lesson.title, 3, 90)) fail(w, 'title vacío o > 90')
  if (!Number.isInteger(lesson.minutes) || lesson.minutes < 15 || lesson.minutes > 60) fail(w, 'minutes entero entre 15 y 60 (tiempo honesto, con práctica)')

  // Objetivos medibles
  const obj = arr(lesson.objectives)
  if (obj.length < 2 || obj.length > 5) fail(w, 'entre 2 y 5 objectives')
  for (const o of obj) {
    if (!isText(o.id) || !BLOOM.includes(o.bloom) || !/^Podrás /.test(o.text ?? '')) fail(w, `objetivo mal formado (id, bloom, text que empiece por "Podrás "): ${o.id}`)
  }
  if (!obj.some((o) => ['aplicar', 'analizar', 'evaluar', 'crear'].includes(o.bloom))) fail(w, 'al menos un objetivo debe ser de nivel aplicar o superior (no solo recordar/comprender)')

  // Glosario: lo que enseña / lo que exige
  for (const id of arr(lesson.teaches)) {
    const t = gl.get(id)
    if (!t) fail(w, `teaches: término inexistente en el glosario: ${id}`)
    else if (t.firstTaughtIn !== lesson.id) fail(w, `teaches: "${id}" tiene firstTaughtIn=${t.firstTaughtIn}, debería ser ${lesson.id}`)
  }
  for (const id of arr(lesson.requires)) {
    const t = gl.get(id)
    if (!t) fail(w, `requires: término inexistente: ${id}`)
    else if ((state.order.get(t.firstTaughtIn) ?? 1e9) >= order) fail(w, `requires: "${id}" se enseña en ${t.firstTaughtIn}, que no es anterior a esta clase`)
  }

  // Escenas
  const parts = arr(lesson.parts)
  if (parts.length < LIMITS.partsMin || parts.length > LIMITS.partsMax) fail(w, `entre ${LIMITS.partsMin} y ${LIMITS.partsMax} parts`)
  const scenes = [lesson.hook, ...parts.flatMap((p) => arr(p.scenes))].filter(Boolean)
  if (!lesson.hook || lesson.hook.kind !== 'hook') fail(w, 'falta hook (escena kind "hook": un problema real que la clase te enseña a resolver)')
  if (scenes.length < LIMITS.lessonScenesMin || scenes.length > LIMITS.lessonScenesMax) fail(w, `escenas: ${scenes.length} (deben ser ${LIMITS.lessonScenesMin}-${LIMITS.lessonScenesMax})`)
  let narrationWords = 0
  let visuals = 0
  const sceneText = []
  for (const [i, s] of scenes.entries()) {
    const sw = `${w} escena ${i + 1} "${s.title}"`
    if (!SCENE_KINDS.includes(s.kind)) fail(sw, `kind inválido: ${s.kind}`)
    if (!isText(s.title, 3, LIMITS.sceneTitle)) fail(sw, `title vacío o > ${LIMITS.sceneTitle}`)
    if (!isText(s.content, 10, LIMITS.sceneContentMax)) fail(sw, `content vacío o > ${LIMITS.sceneContentMax} caracteres (parte la idea en dos escenas)`)
    if (!isText(s.narration, LIMITS.narrationMin, LIMITS.narrationMax)) fail(sw, `narration entre ${LIMITS.narrationMin} y ${LIMITS.narrationMax} caracteres (hoy ${String(s.narration ?? '').length})`)
    const screenWords = words(onScreenText(s.content))
    const maxWords = s.kind === 'story' || s.kind === 'hook' ? LIMITS.storyOnScreenWords : LIMITS.sceneOnScreenWords
    if (screenWords > maxWords) fail(sw, `demasiado texto en pantalla (${screenWords} > ${maxWords} palabras): lo que no cabe se dice, no se escribe`)
    if (s.kind === 'story' || s.kind === 'hook') {
      if (!isText(s.stamp, 1, 14)) fail(sw, 'stamp: la cifra o el año que ocupa la pantalla (máx. 14 caracteres), p. ej. «1989»')
      if (!isText(s.dateline, 8, 90)) fail(sw, 'dateline: lugar y fecha del hecho, p. ej. «CERN, Ginebra · marzo de 1989»')
      if (s.kind === 'hook' && s.imagined) fail(sw, 'el gancho debe ser un caso REAL con fuente, no una viñeta inventada')
      if (!s.imagined && !isText(s.source, 3, 60)) fail(sw, 'source: nombre corto de la fuente del hecho real (o marca imagined:true si es una viñeta inventada)')
    }
    // La narración no debe ser la diapositiva leída en voz alta.
    const a = new Set(norm(onScreenText(s.content)).match(/[a-z0-9]+/g) ?? [])
    const b = new Set(norm(s.narration ?? '').match(/[a-z0-9]+/g) ?? [])
    const inter = [...a].filter((x) => b.has(x)).length
    if (a.size > 12 && inter / a.size > 0.9 && b.size < a.size * 1.5) warn(sw, 'la narración casi repite la diapositiva: el profesor debe explicar, no leer')
    narrationWords += words(s.narration ?? '')
    if (hasVisual(s.content)) visuals++
    checkGeneric(sw, `${s.title} ${s.content} ${s.narration}`)
    if (EMOJI.test(s.title) || (s.content.match(/\p{Extended_Pictographic}/gu) ?? []).length > 3) warn(sw, 'demasiados emojis: no sustituyen a una explicación')
    for (const g of arr(s.glossaryRefs)) if (!gl.has(g)) fail(sw, `glossaryRefs: término inexistente: ${g}`)
    if ((s.kind === 'worked-example' || s.kind === 'faded-example') && !isText(s.artifact)) fail(sw, `${s.kind} necesita "artifact" (qué entregable se está modelando)`)
    await checkDiagrams(sw, s.content)
    if (s.micro) {
      checkItem(`${sw} micro`, s.micro, ctx)
      if (!['mcq', 'multi', 'fill', 'order', 'classify', 'spot'].includes(s.micro.type)) fail(sw, `micro: tipo ${s.micro.type} no permitido (solo respuesta cerrada y rápida)`)
      if (String(s.micro.prompt ?? '').length > 260) fail(sw, 'micro: el enunciado se oye en voz alta, máximo 260 caracteres')
      if (s.micro.type === 'mcq' && arr(s.micro.options).some((o) => String(o.text ?? '').length > 110)) warn(sw, 'micro: opciones largas; se leen en voz alta, acórtalas')
    }
    sceneText.push({ where: sw, text: `${s.title} ${s.content} ${s.narration}`, kind: s.kind })
  }
  if (narrationWords < LIMITS.lessonNarrationWordsMin) fail(w, `narración total ${narrationWords} palabras (< ${LIMITS.lessonNarrationWordsMin}): la clase es demasiado corta para enseñar el contenido`)
  if (narrationWords > LIMITS.lessonNarrationWordsMax) warn(w, `narración total ${narrationWords} palabras (> ${LIMITS.lessonNarrationWordsMax}): considera partir la clase en dos`)
  const kinds = (k) => scenes.filter((s) => s.kind === k).length
  // La historia: cada clase recorre un caso real con fuentes verificables
  const rc = lesson.realCase
  if (!rc || !isText(rc.title, 5, 100) || !isText(rc.summary, 100, 700)) fail(w, 'realCase: {title, summary (100-700 caracteres), sources[]}: el caso real que recorre la clase')
  const rcs = arr(rc?.sources)
  if (rcs.length < LIMITS.realCaseSourcesMin) fail(w, `realCase.sources: al menos ${LIMITS.realCaseSourcesMin} fuentes distintas con título, URL https y la afirmación que respaldan`)
  for (const src of rcs) if (!isText(src.title, 5) || !/^https:\/\/[^ ]+\.[^ ]+/.test(src.url ?? '') || !isText(src.claim, 15)) fail(w, `realCase.sources: fuente mal formada (${src.title ?? '?'})`)
  const storyScenes = scenes.filter((s) => s.kind === 'story' || s.kind === 'hook')
  if (storyScenes.filter((s) => !s.imagined).length < LIMITS.storyScenesRealMin) fail(w, `historia: al menos ${LIMITS.storyScenesRealMin} escenas reales (hook + story con source) que cuenten el caso paso a paso`)
  if (kinds('worked-example') < 2) fail(w, 'necesita ≥ 2 escenas "worked-example" (ejemplo resuelto paso a paso, con el porqué de cada paso)')
  if (kinds('faded-example') < 1) fail(w, 'necesita ≥ 1 escena "faded-example" (ejemplo con huecos que el alumno completa)')
  if (kinds('non-example') + kinds('misconception') < 1) fail(w, 'necesita ≥ 1 "non-example" o "misconception" (qué NO es / error típico y por qué falla)')
  if (kinds('analogy') < 1) fail(w, 'necesita ≥ 1 "analogy"')
  if (visuals < 3) fail(w, `necesita ≥ 3 escenas con apoyo visual (diagrama mermaid, tabla o código); hay ${visuals}`)
  if (kinds('pause-think') < 1) warn(w, 'sin "pause-think": añade al menos una pregunta que el alumno responda antes de ver la solución')

  // Partes
  for (const p of parts) {
    const pw = `${w} parte "${p.title}"`
    if (!isText(p.id) || !isText(p.title, 3, 80)) fail(pw, 'id/title de parte')
    if (state.partIds.has(p.id)) fail(pw, `id de parte repetido: ${p.id}`)
    state.partIds.set(p.id, order)
    if (arr(p.scenes).length < 3 || arr(p.scenes).length > LIMITS.scenesPerPartMax) fail(pw, `entre 3 y ${LIMITS.scenesPerPartMax} escenas por parte`)
    const pobj = arr(p.objectives)
    if (pobj.length < 1 || !pobj.every((o) => objectiveIds.has(o))) fail(pw, 'objectives: lista de objetivos de la clase que esta parte ENSEÑA (≥ 1, ids válidos)')
    for (const o of pobj) state.taught.add(o)
    for (const it of [...arr(p.checkpoint), ...arr(p.scenes).flatMap((x) => (x.micro ? [x.micro] : []))]) {
      if (!pobj.includes(it.objective)) fail(pw, `el ítem ${it.id} mide el objetivo ${it.objective}, que esta parte no declara enseñar (solo se pregunta lo que se enseñó)`)
    }
    const micros = arr(p.scenes).filter((x) => x.micro).length
    if (micros < LIMITS.microPerPartMin) fail(pw, `micro-ejercicios: ${micros}; cada parte necesita al menos ${LIMITS.microPerPartMin} (un mini-ejercicio justo después de cada idea nueva, para oírlo y practicarlo en el momento)`)
    if (!arr(p.scenes).some((x) => x.kind === 'story')) fail(pw, 'cada parte abre o cierra con una escena "story": la historia continúa (un nuevo giro del caso real, otro caso o una viñeta imaginada)')
    const cps = arr(p.checkpoint)
    if (cps.length < 1 || cps.length > 3) fail(pw, 'checkpoint: 1-3 items de comprobación inmediata')
    cps.forEach((it, i) => checkItem(`${pw} checkpoint ${i + 1}`, it, ctx))
    if (!p.reteach || !isText(p.reteach.narration, 150, LIMITS.narrationMax) || !isText(p.reteach.content, 10, LIMITS.sceneContentMax)) fail(pw, 'reteach: escena alternativa (otra analogía, otro ejemplo) por si el checkpoint falla')
  }

  // Alineación: todo objetivo de la clase lo enseña alguna parte (si no, se evaluaría algo no enseñado)
  for (const o of obj) if (!parts.some((pt) => arr(pt.objectives).includes(o.id))) fail(w, `objetivo ${o.id}: ninguna parte lo enseña (añade el objetivo a una parte o escribe esa parte)`)

  // Preparación (prerrequisitos): no puede preguntar lo que esta clase enseña
  const ready = arr(lesson.readiness)
  if (ready.length !== 3) fail(w, 'readiness: exactamente 3 preguntas de prerrequisitos ("¿estás listo?")')
  ready.forEach((it, i) => checkItem(`${w} readiness ${i + 1}`, it, ctx))
  for (const r of arr(lesson.remedial)) if (!r.lessonId && !isText(r.refresher, 50, 700)) fail(w, 'remedial: lessonId o refresher (50-700 caracteres)')
  if (ready.length && arr(lesson.remedial).length === 0) fail(w, 'remedial: indica a dónde va el alumno si falla la preparación (lessonId o refresher)')

  // Registrar entregables modelados aquí (ejemplo resuelto + ejemplo con huecos)
  for (const art of arr(lesson.modelsArtifacts)) {
    const worked = scenes.some((s) => s.kind === 'worked-example' && s.artifact === art)
    const faded = scenes.some((s) => s.kind === 'faded-example' && s.artifact === art)
    if (!worked || !faded) fail(w, `modelsArtifacts "${art}": falta worked-example y/o faded-example con artifact="${art}"`)
    if (!state.models.has(art)) state.models.set(art, { order, lesson: lesson.id })
  }

  // Práctica escalonada
  const ex = arr(lesson.practice)
  for (const t of ['A', 'B', 'C']) if (!ex.some((e) => e.tier === t)) fail(w, `práctica: falta el nivel ${t} (A replicar, B adaptar, C crear)`)
  for (const e of ex) {
    const ew = `${w} práctica ${e.tier} "${e.title}"`
    if (!TIERS.includes(e.tier)) fail(ew, 'tier A|B|C|D')
    if (!isText(e.id) || ctx.itemIds.has(e.id)) fail(ew, 'id vacío o repetido')
    ctx.itemIds.add(e.id)
    if (!isText(e.title, 5, 90) || !isText(e.statement, 80, 1600)) fail(ew, 'title ≤ 90 y statement entre 80 y 1600')
    if (!POLICIES.includes(e.aiPolicy)) fail(ew, 'aiPolicy inválida')
    if (arr(e.decoded?.youAreAsked).length < 2) fail(ew, 'decoded.youAreAsked: "lo que te piden, traducido" (≥ 2 puntos en palabras sencillas)')
    if (arr(e.objectives).length < 1 || !e.objectives.every((x) => objectiveIds.has(x))) fail(ew, 'objectives inválidos')
    if ((e.tier === 'A' || e.tier === 'B') && !isText(e.scaffold, 80)) fail(ew, 'scaffold (plantilla o esqueleto) obligatorio en A y B')
    if (!isText(e.exemplar, 150) || arr(e.exemplarNotes).length < 2) fail(ew, 'exemplar (respuesta modelo, se muestra tras el primer intento) + ≥ 2 exemplarNotes (qué mirar y por qué está bien)')
    if (arr(e.hints).length < 3) fail(ew, 'al menos 3 hints progresivas')
    for (const h of arr(e.hints)) {
      if (!isText(h.text, 15)) fail(ew, 'hint sin texto')
      const po = state.partIds.get(h.taughtIn)
      if (po === undefined || po > order) fail(ew, `hint.taughtIn "${h.taughtIn}" debe ser una parte de esta clase o anterior (toda pista remite a algo ya enseñado)`)
    }
    const rubric = arr(e.rubric)
    if (rubric.length < (e.tier === 'C' || e.tier === 'D' ? 4 : 3)) fail(ew, `rúbrica: mínimo ${e.tier === 'C' || e.tier === 'D' ? 4 : 3} criterios`)
    for (const r of rubric) if (!isText(r.criterion) || !objectiveIds.has(r.objective) || !r.levels || !isText(r.levels.bien) || !isText(r.levels.parcial) || !isText(r.levels.falta)) fail(ew, 'rúbrica: {criterion, objective, levels:{bien,parcial,falta}}')
    if (arr(e.commonErrors).length < 2 || arr(e.selfCheck).length < 3) fail(ew, 'commonErrors ≥ 2 y selfCheck ≥ 3')
    if ((e.tier === 'A' || e.tier === 'B') && arr(e.checks).length < 2 && !arr(e.rubric).length) fail(ew, 'A y B necesitan comprobación automática (checks ≥ 2)')
    arr(e.checks).forEach((it, i) => checkItem(`${ew} check ${i + 1}`, it, ctx))
    for (const t of arr(e.decoded?.terms)) {
      const g = gl.get(t)
      if (!g) fail(ew, `decoded.terms: término inexistente: ${t}`)
      else if ((state.order.get(g.firstTaughtIn) ?? 1e9) > order) fail(ew, `decoded.terms: "${t}" se enseña después de esta clase`)
    }
    if (e.produces) {
      const found = state.models.get(e.produces)
      if (!found || found.order > order) fail(ew, `produces "${e.produces}": ningún ejemplo resuelto + ejemplo con huecos de ese entregable en esta clase o anteriores (paridad de nivel: no se pide lo que no se modeló)`)
    }
    checkGeneric(ew, `${e.statement} ${e.exemplar}`)
    sceneText.push({ where: ew, text: `${e.statement} ${arr(e.hints).map((h) => h.text).join(' ')} ${arr(e.decoded?.youAreAsked).join(' ')}`, kind: 'practice' })
  }

  // Dominio
  const mastery = lesson.mastery
  if (!mastery || mastery.passPct !== LIMITS.masteryPassPct) fail(w, `mastery.passPct debe ser ${LIMITS.masteryPassPct}`)
  const mi = arr(mastery?.items)
  mi.forEach((it, i) => checkItem(`${w} mastery ${i + 1}`, it, ctx))
  checkItemSet(`${w} mastery`, mi, { min: LIMITS.masteryItemsMin, label: 'mastery' })
  for (const o of obj) {
    if (mi.filter((it) => it.objective === o.id).length < 2) fail(w, `objetivo ${o.id}: necesita ≥ 2 ítems de dominio que lo midan`)
    if (!ex.some((e) => arr(e.objectives).includes(o.id))) fail(w, `objetivo ${o.id}: ninguna práctica lo trabaja`)
  }
  if (new Set(mi.map((i) => i.type)).size < 3) fail(w, 'mastery: usa al menos 3 tipos de ítem distintos (no solo test)')
  if (mi.every((i) => ['recordar', 'comprender'].includes(i.bloom))) fail(w, 'mastery: algún ítem debe exigir aplicar o analizar, no solo recordar')

  // Cierre y repaso
  const wr = lesson.wrapup
  if (!wr || arr(wr.keyIdeas).length < 3 || arr(wr.keyIdeas).length > 6) fail(w, 'wrapup.keyIdeas: 3-6')
  if (!wr || !isText(wr.cheatSheet, 200, 1800)) fail(w, 'wrapup.cheatSheet: hoja de referencia (Markdown) de 200-1800 caracteres')
  if (!wr || arr(wr.commonMistakes).length < 2) fail(w, 'wrapup.commonMistakes: ≥ 2 {mistake, fix}')
  const rv = arr(lesson.review)
  if (rv.length < 3 || rv.length > 4) fail(w, 'review: 3-4 ítems para el repaso espaciado (distintos a los de mastery)')
  rv.forEach((it, i) => checkItem(`${w} review ${i + 1}`, it, ctx))

  // Paridad técnica: todo lo técnico que se pregunta se explicó antes (el alumno nunca se topa con algo no enseñado)
  {
    const taught = [lesson.hook, ...parts.flatMap((p) => arr(p.scenes)), ...parts.map((p) => p.reteach)].filter(Boolean)
    state.corpus += ' ' + norm(taught.map((x) => `${x.title} ${x.content} ${x.narration}`).join(' '))
    for (const g of state.glossary.values()) if ((state.order.get(g.firstTaughtIn) ?? 1e9) <= order) state.corpus += ' ' + norm(`${g.term} ${arr(g.aliases).join(' ')} ${g.plain} ${g.example}`)
    const scan = [
      ...parts.flatMap((p) => [...arr(p.checkpoint), ...arr(p.scenes).flatMap((x) => (x.micro ? [x.micro] : []))]),
      ...arr(lesson.mastery?.items),
      ...arr(lesson.review),
      ...arr(lesson.practice).flatMap((e) => arr(e.checks))
    ]
    // Los ejemplos de una práctica se presentan en su propio enunciado: ahí se introducen sus nombres.
    const ownContext = new Map()
    for (const e of arr(lesson.practice)) for (const c of arr(e.checks)) ownContext.set(c.id, norm(`${e.statement} ${e.scaffold ?? ''}`))
    for (const it of scan) {
      for (const m of textOfItem(it).matchAll(/`([^`\n]+)`/g)) {
        const tok = norm(m[1]).trim()
        // «nombre=valor» es un dato de ejemplo que la propia pregunta presenta
        if (!tok || /^[\w.-]+=\S*$/.test(tok) || state.corpus.includes(tok) || (ownContext.get(it.id) ?? '').includes(tok)) continue
        const missing = (tok.match(/[a-z0-9_]+/g) ?? []).filter((w) => w.length >= 3 && !/^\d+$/.test(w) && !state.corpus.includes(w) && !(ownContext.get(it.id) ?? '').includes(w))
        if (missing.length) fail(`${w} ${it.id}`, `lo técnico «${m[1]}» aparece en una pregunta pero ninguna escena lo explica antes (${missing.join(', ')}): enséñalo o quítalo`)
      }
    }
    // Si hay código para leer, antes hay una escena «Cómo leer…» que enseña la notación
    const usesCode = taught.some((x) => /```(?!mermaid|text)[a-z]+/.test(x.content)) || scan.some((it) => it.type === 'spot' && /[{}]|=>|\bfunction\b|\bif\s*\(/.test(String(it.artifact ?? '')))
    const readsCode = taught.some((x) => /c[oó]mo leer/i.test(x.title))
    if (usesCode && !readsCode && !state.readsCode) fail(w, 'hay código en pantalla o en preguntas, pero ninguna escena «Cómo leer…» explica antes la notación (símbolos, palabras clave, qué hace cada línea)')
    if (readsCode) state.readsCode = true
  }

  // Un término no puede usarse antes de enseñarse
  for (const [id, t] of gl) {
    const to = state.order.get(t.firstTaughtIn) ?? 1e9
    const re = [t.term, ...arr(t.aliases)].map(termRegex)
    const test = (text) => re.some((r) => r.test(norm(text)))
    // La preparación mide prerrequisitos: no puede usar ni lo que enseña esta clase ni lo posterior.
    if (to >= order) for (const it of ready) if (test(textOfItem(it))) fail(`${w} readiness`, `usa el término "${t.term}", que se enseña en ${t.firstTaughtIn}: la preparación solo puede preguntar lo que ya se sabe`)
    if (to <= order) continue
    for (const it of [...mi, ...rv]) if (test(textOfItem(it))) fail(`${w} ${it.id}`, `usa el término "${t.term}" antes de enseñarlo (${t.firstTaughtIn})`)
    for (const s of sceneText) if (test(s.text)) (s.kind === 'practice' ? fail : warn)(s.where, `menciona "${t.term}" antes de enseñarlo (${t.firstTaughtIn})`)
  }

}

// ───────────────────────── Curso ─────────────────────────
async function checkCourse(course, where, { lessonOnly = false } = {}) {
  const draft = course.status === 'draft' || lessonOnly
  const state = { order: new Map(), glossary: new Map(), itemIds: new Set(), partIds: new Map(), models: new Map(), taught: new Set(), corpus: '', readsCode: false }
  if (!lessonOnly) {
    if (course.schema !== 2) fail(where, 'schema debe ser 2')
    if (!['draft', 'published'].includes(course.status)) fail(where, 'status: "draft" | "published"')
    if (!AREAS.includes(course.area) || !/^#[0-9a-f]{6}$/i.test(course.color ?? '')) fail(where, 'area/color inválidos')
    if (!isText(course.title, 3, 120) || !isText(course.description, 20, 300) || !isText(course.audience, 30)) fail(where, 'title/description/audience')
    if (!draft) {
      if (arr(course.entryBaseline).length < 1) fail(where, 'entryBaseline: lo ÚNICO que se asume al entrar')
      if (arr(course.outcomes).length < 6 || arr(course.outcomes).length > 10) fail(where, 'outcomes: 6-10 resultados "Podrás…" verificables')
      if (arr(course.glossary).length < LIMITS.glossaryMin) fail(where, `glosario: mínimo ${LIMITS.glossaryMin} términos`)
    }
  }
  const levels = lessonOnly ? [{ id: 'principiante', modules: [{ id: 'm', lessons: [course.lesson] }] }] : arr(course.levels)
  if (!lessonOnly && !draft && (levels.length !== 3 || levels.some((l, i) => l.id !== LEVELS[i]))) fail(where, 'levels: exactamente principiante, intermedio, avanzado, en ese orden')
  // Orden global de clases y glosario
  let n = 0
  for (const lv of levels) for (const m of arr(lv.modules)) for (const l of arr(m.lessons)) state.order.set(l.id, n++)
  for (const t of arr(course.glossary)) {
    if (!isText(t.id) || state.glossary.has(t.id)) fail(where, `glosario: id vacío o repetido: ${t.id}`)
    if (!isText(t.term) || !isText(t.plain, 20, 260) || !isText(t.example, 10) || !state.order.has(t.firstTaughtIn)) fail(where, `glosario "${t.id}": term, plain (20-260), example y firstTaughtIn (una clase existente)`)
    if (/^(es|son) (un|una|el|la)\s+(cosa|concepto)/i.test(t.plain ?? '')) warn(where, `glosario "${t.id}": definición circular o vacía`)
    state.glossary.set(t.id, t)
  }
  const ids = new Set()
  for (const lv of levels) {
    const lw = `${where} nivel ${lv.id}`
    if (!lessonOnly && !draft) {
      if (!isText(lv.promise, 20) || !/^Al terminar este nivel podrás/.test(lv.promise)) fail(lw, 'promise: "Al terminar este nivel podrás…"')
      if (lv.id !== 'principiante' && arr(lv.entryCheck).length < LIMITS.levelEntryCheckMin) fail(lw, `entryCheck: ≥ ${LIMITS.levelEntryCheckMin} preguntas que comprueban los prerrequisitos del nivel anterior`)
      const ex = lv.exam
      if (!ex || ex.perAttempt < LIMITS.levelExamPerAttemptMin || arr(ex.bank).length < LIMITS.levelExamBankMin || ex.passPct !== LIMITS.passPct || ex.minPerObjectivePct !== LIMITS.minPerObjectivePct) fail(lw, `examen de nivel: perAttempt ≥ ${LIMITS.levelExamPerAttemptMin}, bank ≥ ${LIMITS.levelExamBankMin}, passPct ${LIMITS.passPct}, minPerObjectivePct ${LIMITS.minPerObjectivePct}`)
      if (arr(ex?.writtenTasks).length < 2) fail(lw, 'examen de nivel: ≥ 2 tareas escritas/prácticas con rúbrica (writtenTasks)')
      const pr = lv.project
      if (!pr || arr(pr.deliverables).length < 3 || arr(pr.rubric).length < 5 || pr.passScore !== LIMITS.projectScore || !isText(pr.brief, 150)) fail(lw, `proyecto de nivel: brief, ≥ 3 deliverables, rúbrica ≥ 5 criterios, passScore ${LIMITS.projectScore}`)
    }
  }
  // Clases
  for (const lv of levels) {
    for (const m of arr(lv.modules)) {
      const mw = `${where} módulo ${m.id}`
      if (!lessonOnly) {
        if (!isText(m.id) || !isText(m.title, 3, 90)) fail(mw, 'id/title')
        if (!draft) {
          const ex = m.exam
          if (!ex || ex.perAttempt < LIMITS.moduleExamPerAttemptMin || arr(ex.bank).length < LIMITS.moduleExamBankMin || ex.passPct !== LIMITS.passPct) fail(mw, `examen de módulo: perAttempt ≥ ${LIMITS.moduleExamPerAttemptMin}, bank ≥ ${LIMITS.moduleExamBankMin}, passPct ${LIMITS.passPct}`)
          else {
            const ctx = { itemIds: state.itemIds, objectiveIds: null }
            ex.bank.forEach((it, i) => checkItem(`${mw} examen ${i + 1}`, it, ctx))
            checkItemSet(`${mw} examen`, ex.bank, { label: 'banco' })
          }
        }
      }
      for (const l of arr(m.lessons)) {
        if (ids.has(l.id)) fail(l.id, 'id de clase repetido')
        ids.add(l.id)
        await checkLesson(l, course, state)
      }
    }
  }
  return state
}

// ───────────────────────── Entrada ─────────────────────────
export async function run(argv) {
  const lessonIdx = argv.indexOf('--lesson')
  const courseIdx = argv.indexOf('--course')
  if (lessonIdx >= 0) {
    const sample = read(argv[lessonIdx + 1])
    await checkCourse({ glossary: sample.glossary, lesson: sample.lesson, status: 'draft' }, argv[lessonIdx + 1], { lessonOnly: true })
  } else if (courseIdx >= 0) {
    await checkCourse(read(argv[courseIdx + 1]), argv[courseIdx + 1])
  } else {
    const dir = path.join(root, 'src/core/academy/data/courses')
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : []
    if (!files.length) warn('courses', 'no hay cursos v2 todavía en src/core/academy/data/courses')
    for (const f of files) await checkCourse(read(path.join(dir, f)), `courses/${f}`)
  }
  for (const x of warnings) console.warn(`⚠ ${x}`)
  for (const x of errors) console.error(`✗ ${x}`)
  console.log(`\n${errors.length} errores, ${warnings.length} avisos`)
  return errors.length
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit((await run(process.argv.slice(2))) ? 1 : 0)
}
