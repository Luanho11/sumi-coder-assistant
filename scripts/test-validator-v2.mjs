import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const base = JSON.parse(readFileSync('docs/pedagogia/muestra-oro-sec-l1.v2.json', 'utf8'))
const clone = () => JSON.parse(JSON.stringify(base))
const cases = {
  'sin faded-example': [(d) => { d.lesson.parts[2].scenes = d.lesson.parts[2].scenes.filter((s) => s.kind !== 'faded-example') }, /faded-example/],
  'narración corta': [(d) => { d.lesson.parts[0].scenes[2].narration = 'Muy corta.' }, /narration entre/],
  'preparación usa término de la clase': [(d) => { d.lesson.readiness[0].prompt = '¿Qué es el alcance de una prueba y dónde se escribe?' }, /preparación solo puede preguntar/],
  'diapositiva con muro de texto': [(d) => { d.lesson.parts[0].scenes[2].content = ('Palabra '.repeat(120)).trim() }, /demasiado texto en pantalla/],
  'pista que remite a algo no enseñado': [(d) => { d.lesson.practice[0].hints[0].taughtIn = 'sec-l9-p1' }, /taughtIn/],
  'da por sabido': [(d) => { d.lesson.parts[0].scenes[2].narration += ' Como ya sabes, esto es obvio y trivial para ti, obviamente.' }, /da algo por sabido/],
  'práctica produce algo no modelado': [(d) => { d.lesson.practice[2].produces = 'informe-pentest' }, /produces/],
  'distractor sin whyNot': [(d) => { delete d.lesson.mastery.items[0].options[0].whyNot }, /whyNot/],
  'solo 2 niveles de práctica': [(d) => { d.lesson.practice = d.lesson.practice.filter((e) => e.tier !== 'B') }, /falta el nivel B/],
  'objetivo sin ítems de dominio': [(d) => { d.lesson.mastery.items = d.lesson.mastery.items.filter((i) => i.objective !== 'sec-l1-o3') }, /ítems de dominio/],
  'ejemplo resuelto sin artifact': [(d) => { delete d.lesson.parts[2].scenes.find((s) => s.kind === 'worked-example').artifact }, /necesita "artifact"/],
  'parte sin micro-ejercicios': [(d) => { for (const s of d.lesson.parts[1].scenes) delete s.micro }, /micro-ejercicios/],
  'micro con tipo lento': [(d) => { d.lesson.parts[0].scenes.find((s) => s.micro).micro.type = 'written' }, /micro: tipo/],
  'parte sin objetivos': [(d) => { delete d.lesson.parts[0].objectives }, /objectives: lista/],
  'ítem mide objetivo no enseñado en la parte': [(d) => { d.lesson.parts[0].checkpoint[0].objective = 'sec-l1-o4' }, /que esta parte no declara enseñar/],
  'frase genérica': [(d) => { d.lesson.parts[1].scenes[2].narration += ' Es muy importante en el mundo actual.' }, /frase genérica/],
  'gancho inventado': [(d) => { d.lesson.hook.imagined = true }, /gancho debe ser un caso REAL/],
  'historia sin fuente': [(d) => { delete d.lesson.parts[1].scenes[0].source }, /source:/],
  'parte sin escena de historia': [(d) => { for (const s of d.lesson.parts[2].scenes) if (s.kind === 'story') s.kind = 'concept' }, /cada parte abre o cierra con una escena "story"/],
  'caso real sin fuentes suficientes': [(d) => { d.lesson.realCase.sources = d.lesson.realCase.sources.slice(0, 1) }, /realCase\.sources/],
  'muy pocas diapositivas': [(d) => { d.lesson.parts[0].scenes = d.lesson.parts[0].scenes.slice(0, 3); d.lesson.parts[1].scenes = d.lesson.parts[1].scenes.slice(0, 3) }, /escenas: \d+ \(deben ser/],
  'dato técnico que se pregunta sin haberse enseñado': [(d) => { d.lesson.mastery.items[0].prompt += ' ¿Y qué hace `maxlength`?' }, /lo técnico «maxlength»/],
  'código sin escena «Cómo leer»': [(d) => { d.lesson.parts[0].scenes.find((s) => s.kind === 'concept').content += '\n\n```js\nif (a == b) { return a }\n```' }, /Cómo leer/]
}
let pass = 0
const run = (d) => {
  writeFileSync(join(tmpdir(), 'neg-v2.json'), JSON.stringify(d))
  try { return execFileSync('node', ['scripts/validate-content-v2.mjs', '--lesson', join(tmpdir(), 'neg-v2.json')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } catch (e) { return (e.stdout ?? '') + (e.stderr ?? '') }
}
if (/✗/.test(run(clone()))) { console.error('La muestra de oro base debe validar sin errores antes de probar los casos negativos'); process.exit(1) }
for (const [name, [mut, expected]] of Object.entries(cases)) {
  const d = clone(); mut(d)
  writeFileSync(join(tmpdir(), 'neg-v2.json'), JSON.stringify(d))
  let out = ''
  try { out = execFileSync('node', ['scripts/validate-content-v2.mjs', '--lesson', join(tmpdir(), 'neg-v2.json')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } catch (e) { out = (e.stdout ?? '') + (e.stderr ?? '') }
  const caught = out.split('\n').some((l) => l.startsWith('✗') && expected.test(l))
  if (caught) pass++
  console.log(caught ? 'DETECTADO ' : 'NO DETECTA ', name, caught ? '→ ' + (out.split('\n').find((l) => l.startsWith('✗')) ?? '').slice(0, 130) : '')
}
console.log(`${pass}/${Object.keys(cases).length} detectados`)
