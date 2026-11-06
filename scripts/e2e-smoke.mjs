// Prueba de humo de extremo a extremo: arranca la app compilada (out/) con Playwright y un servidor
// Ollama SIMULADO, y recorre el flujo central. No usa ningún modelo real.
// Uso: npm run build && node scripts/e2e-smoke.mjs [carpeta-capturas]
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const shots = path.resolve(process.argv[2] ?? path.join(root, 'e2e-shots'))
mkdirSync(shots, { recursive: true })
const PORT = 11555
const results = []

function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const mock = spawn(process.execPath, [path.join(root, 'scripts/mock-ollama.mjs'), String(PORT)], { stdio: 'inherit' })
await new Promise((r) => setTimeout(r, 500))

const MOCK_SETTINGS = JSON.stringify({ providerId: 'ollama', ollamaUrl: `http://127.0.0.1:${PORT}`, models: { gemini: 'gemini-3.8-flash', ollama: 'mock' }, helpLevel: 'plan' })
const dataDir = mkdtempSync(path.join(os.tmpdir(), 'xara-e2e-'))
writeFileSync(path.join(dataDir, 'settings.json'), MOCK_SETTINGS)

async function launch(dir = dataDir) {
  const app = await electron.launch({ args: [root, '--no-sandbox'], env: { ...process.env, XARA_DATA_DIR: dir } })
  const win = await app.firstWindow()
  await win.setViewportSize({ width: 1100, height: 780 }).catch(() => {})
  await win.waitForSelector('.composer textarea')
  return { app, win }
}

try {
  // 1. Consulta completa con streaming.
  let { app, win } = await launch()
  await win.fill('.composer textarea', 'Two Sum\nDado un array de enteros y un objetivo, devuelve los índices de dos números que sumen el objetivo.')
  await win.keyboard.press('Control+Enter')
  await win.waitForSelector('.status-busy', { timeout: 5000 })
  check('muestra estado "Generando…" durante el streaming', true)
  await win.waitForSelector('.section summary:has-text("Verificación")', { timeout: 15000 })
  await win.waitForSelector('.status-ok', { timeout: 15000 })
  const titles = await win.$$eval('article.turn:last-of-type .section > summary', (els) => els.map((e) => e.textContent))
  check('respuesta organizada en secciones', titles.join('|') === 'Resumen|Requisitos y supuestos|Estrategia|Plan de acción|Código|Verificación|Explicación', titles.join(' | '))
  const explOpen = await win.$eval('article.turn:last-of-type details.section:last-of-type', (d) => d.open)
  check('la explicación aparece plegada por defecto', explOpen === false)
  check('el título de la sesión se deriva del enunciado', (await win.textContent('.topbar .title')) === 'Two Sum')
  await win.screenshot({ path: path.join(shots, '1-analisis.png') })

  // 2. Acción rápida: pista.
  await win.click('.quick button:has-text("Pista")')
  await win.waitForSelector('article.turn:nth-of-type(2) .section summary:has-text("Pista")', { timeout: 15000 })
  await win.waitForSelector('.status-ok')
  check('acción rápida "Pista" crea un segundo turno', (await win.$$('.turn')).length === 2)
  await win.screenshot({ path: path.join(shots, '2-pista.png') })

  // 2b. Aprendizaje: valorar, ver temas y comprobar que la memoria viaja en la siguiente consulta.
  const topics = await win.$$eval('article.turn:nth-of-type(1) .tag.topic', (els) => els.map((e) => e.textContent))
  check('muestra los temas detectados y oculta el comentario', topics.join(',') === 'hash map,arrays' && !(await win.textContent('article.turn:nth-of-type(1)')).includes('temas:'), topics.join(','))
  await win.click('article.turn:nth-of-type(2) .feedback button[title="No útil"]')
  await win.click('article.turn:nth-of-type(2) .reasons button:has-text("Demasiado largo")')
  await win.waitForSelector('article.turn:nth-of-type(2) .feedback .tag:has-text("Demasiado largo")')
  check('guarda una valoración negativa con motivo', true)
  await win.screenshot({ path: path.join(shots, '2b-valoracion.png') })
  await win.keyboard.press('Control+M')
  await win.waitForSelector('.modal:has-text("ha aprendido")')
  await win.fill('.modal textarea', 'Prefiero TypeScript y respuestas cortas')
  await win.click('.modal button:has-text("Guardar preferencias")')
  await win.waitForSelector('.modal .ok-text')
  await win.click('.prompt-block summary')
  const block = await win.textContent('.prompt-block pre')
  check('el perfil refleja preferencias, tema a reforzar y motivo', /Prefiero TypeScript/.test(block) && /hash map/.test(block) && /Demasiado largo/.test(block), block.replace(/\s+/g, ' ').slice(0, 160))
  await win.screenshot({ path: path.join(shots, '2c-memoria.png') })
  await win.click('.modal button:has-text("Cerrar")')
  await win.fill('.composer textarea', '¿Cuál es la complejidad?')
  await win.keyboard.press('Control+Enter')
  await win.waitForSelector('article.turn:nth-of-type(3) .feedback', { timeout: 15000 })
  const sys = await (await fetch(`http://127.0.0.1:${PORT}/debug/last-system`)).text()
  check('la siguiente consulta incluye la memoria en el prompt', sys.includes('Memoria del usuario') && sys.includes('Prefiero TypeScript'))

  // 2c. Recorte de pantalla: se abre la superposición, se arrastra y la captura llega a la consulta.
  await win.click('.quick button:has-text("Recortar")')
  const overlay = await app.waitForEvent('window', { timeout: 10000 })
  await overlay.waitForFunction(() => document.getElementById('fondo').src.startsWith('data:image'), null, { timeout: 10000 })
  await overlay.mouse.move(100, 100)
  await overlay.mouse.down()
  await overlay.mouse.move(500, 350, { steps: 5 })
  await overlay.mouse.up()
  await win.waitForSelector('.attachment img', { timeout: 10000 })
  check('el recorte de pantalla se adjunta a la consulta', true)
  await win.screenshot({ path: path.join(shots, '2d-captura.png') })
  await win.fill('.composer textarea', '¿Qué ves en esta zona?')
  await win.keyboard.press('Control+Enter')
  await win.waitForSelector('article.turn:nth-of-type(4) .feedback', { timeout: 15000 })
  const images = await (await fetch(`http://127.0.0.1:${PORT}/debug/last-images`)).text()
  check('la captura se envía al modelo y no queda adjunta después', images === '1' && (await win.$$('.attachment')).length === 0, `imágenes=${images}`)

  // 2e. Texto copiado desde otra app.
  await app.evaluate(({ clipboard }) => clipboard.writeText('Explica el event loop de Node'))
  await win.click('.quick button:has-text("Copiado")')
  const copiado = await win
    .waitForFunction(() => document.querySelector('.composer textarea').value === 'Explica el event loop de Node', null, { timeout: 5000 })
    .then(() => true, () => false)
  check('usa el texto copiado como consulta', copiado, await win.inputValue('.composer textarea'))
  await win.fill('.composer textarea', '')

  // 2f. Observador: análisis bajo demanda, aviso y profundizar.
  await win.click('.icon-btn[title="Modo observador"]')
  await win.waitForSelector('.modal:has-text("Modo observador")')
  await win.click('.modal button:has-text("Analizar pantalla ahora")')
  await win.waitForSelector('.observations li:has-text("Test fallido")', { timeout: 15000 })
  check('el observador analiza la pantalla y muestra el consejo', true)
  await win.click('.modal button:has-text("Activar observador")')
  await win.waitForSelector('.observing', { timeout: 5000 })
  const tituloVentana = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle())
  check('al activarlo aparece el indicador "Observando"', tituloVentana.includes('Observando'), tituloVentana)
  await win.screenshot({ path: path.join(shots, '2e-observador.png') })
  await win.click('.modal button:has-text("Pausar observador")')
  await win.waitForSelector('.observing', { state: 'detached', timeout: 5000 })
  check('se puede pausar', true)
  await win.click('.modal button:has-text("Cerrar")')
  await win.waitForSelector('.observation-bar')
  await win.screenshot({ path: path.join(shots, '2f-aviso.png') })
  await win.click('.observation-bar button:has-text("Profundizar")')
  await win.waitForSelector('article.turn:nth-of-type(5) .feedback', { timeout: 15000 })
  check('"Profundizar" convierte el aviso en una consulta', (await win.textContent('article.turn:nth-of-type(5)')).includes('Aclaración'))

  // 3. Persistencia: reiniciar y recuperar la sesión.
  await app.close()
  ;({ app, win } = await launch())
  await win.waitForSelector('.session-item')
  const sessionTitles = await win.$$eval('.session-title', (els) => els.map((e) => e.textContent))
  check('la sesión persiste tras reiniciar', sessionTitles.includes('Two Sum'))
  check('se recuperan los turnos de la sesión', (await win.$$('.turn')).length === 5)

  // 4. Error de límite del proveedor (429) con mensaje y reintento.
  await win.evaluate(() => window.copilot.updateSettings({ models: { ollama: 'error-429' } }))
  await win.fill('.composer textarea', '¿Y si hay varios pares válidos?')
  await win.keyboard.press('Control+Enter')
  await win.waitForSelector('.error-box', { timeout: 10000 })
  const errText = await win.textContent('.error-box')
  check('muestra error de límite de uso (429)', /Límite de uso/.test(errText) && /12 s/.test(errText), errText.trim())
  check('ofrece reintentar', (await win.$$('.error-box .retry')).length === 1)
  await win.screenshot({ path: path.join(shots, '3-error-429.png') })

  // 5. Error de red: servidor caído.
  await win.evaluate(() => window.copilot.updateSettings({ models: { ollama: 'mock' }, ollamaUrl: 'http://127.0.0.1:9' }))
  await win.click('.error-box .retry')
  await win.waitForSelector('article.turn:last-of-type .error-box:has-text("Sin conexión")', { timeout: 10000 })
  check('muestra error de red', true)

  // 6. Nueva sesión con atajo.
  await win.keyboard.press('Control+N')
  await win.waitForSelector('.empty')
  check('Ctrl+N abre una sesión vacía', true)
  await app.close()

  // 7. Primer arranque sin clave: se abre la configuración y la API no expone claves.
  const fresh = mkdtempSync(path.join(os.tmpdir(), 'xara-e2e-fresh-'))
  ;({ app, win } = await launch(fresh))
  await win.waitForSelector('.modal', { timeout: 5000 })
  check('primer arranque abre la configuración del proveedor', true)
  const view = await win.evaluate(() => window.copilot.getSettings())
  check('la interfaz solo recibe si hay clave, nunca su valor', JSON.stringify(view.secrets) === '{"gemini":{"configured":false},"ollama":{"configured":false}}')
  const nodeAccess = await win.evaluate(() => typeof window.require === 'undefined' && typeof window.process === 'undefined')
  check('la interfaz no tiene acceso a Node', nodeAccess)
  await win.screenshot({ path: path.join(shots, '4-configuracion.png') })
  await app.close()

  // 8. XARA: pregunta conceptual → formato de clase con diagrama.
  const xaraDir = mkdtempSync(path.join(os.tmpdir(), 'xara-e2e-academia-'))
  writeFileSync(path.join(xaraDir, 'settings.json'), MOCK_SETTINGS)
  ;({ app, win } = await launch(xaraDir))
  await win.fill('.composer textarea', '¿Qué es la programación orientada a objetos? Déjame un ejercicio')
  await win.keyboard.press('Control+Enter')
  await win.waitForSelector('article.turn .section summary:has-text("Pregunta para ti")', { timeout: 15000 })
  const conceptTitles = await win.$$eval('article.turn:last-of-type .section > summary', (els) => els.map((e) => e.textContent))
  check('una pregunta conceptual usa el formato de clase', conceptTitles.slice(0, 3).join('|') === 'Idea clave|Analogía|Cómo se ve', conceptTitles.join(' | '))
  const svg = await win.waitForSelector('.diagram svg', { timeout: 15000 }).then(() => true, () => false)
  check('el diagrama Mermaid se dibuja como gráfico', svg)
  const sysConcept = await (await fetch(`http://127.0.0.1:${PORT}/debug/last-system`)).text()
  check('el prompt pide clasificar la consulta y usar analogías y diagramas', sysConcept.includes('CONCEPTO') && sysConcept.includes('analogía') && sysConcept.includes('mermaid'))
  await win.screenshot({ path: path.join(shots, '5-concepto-diagrama.png') })

  // 9. Examen de nivel con un área y la parte práctica.
  await win.click('nav.views button:has-text("Academia")')
  await win.waitForSelector('.placement-cta')
  await win.screenshot({ path: path.join(shots, '6-academia.png') })
  await win.click('.placement-cta button:has-text("Empezar examen")')
  for (const label of ['Fundamentos', 'Frontend', 'Datos y SQL', 'Calidad y testing', 'Seguridad', 'Sistemas y DevOps', 'Análisis', 'Ingeniería con IA']) {
    await win.click(`.area-chips button:has-text("${label}")`)
  }
  await win.click('.placement-actions button:has-text("Empezar (3 preguntas)")')
  for (let i = 0; i < 3; i++) {
    await win.waitForSelector(`.placement .tag:has-text("pregunta ${i + 1} de 3")`)
    await win.click('.options button >> nth=0')
  }
  await win.waitForSelector('.placement h2:has-text("Parte práctica")')
  await win.fill('.task textarea >> nth=0', 'El bucle usa <= y se sale del array; debe ser >= 5 y dividir entre aprobados.')
  await win.click('.placement-actions button:has-text("Terminar examen")')
  await win.waitForSelector('.placement h2:has-text("Punto de partida")', { timeout: 15000 })
  const placementText = await win.textContent('.placement')
  check('el examen de nivel da un punto de partida con la parte práctica corregida', /Parte práctica: 70\/100/.test(placementText) && /Backend/.test(placementText))
  await win.screenshot({ path: path.join(shots, '7-examen-resultado.png') })

  // 10. Ejercicio guiado: pistas con intento previo, evaluación con rúbrica.
  await win.click('.placement-actions button:has-text("Ir a mi ruta")')
  await win.click('.filter')
  await win.fill('.filter', 'Revisa este endpoint')
  await win.click('.exercise-item:has-text("Revisa este endpoint")')
  await win.waitForSelector('.exercise h2:has-text("Revisa este endpoint")')
  await win.click('.exercise-aside button:has-text("Ver pista 1")')
  check('pide escribir un intento antes de dar pistas', (await win.textContent('.exercise-message')).includes('Antes de pedir una pista'))
  await win.fill('.step-card textarea', 'Devuelve los pedidos de un usuario; solo debería poder verlos el propio usuario autenticado.')
  await win.click('.exercise-aside button:has-text("Ver pista 1")')
  await win.waitForSelector('.hints li')
  await win.click('.stepper button:has-text("Hallazgos")')
  await win.fill('.step-card textarea', 'Crítico: inyección SQL al concatenar userId y status; usar consultas parametrizadas ($1, $2).')
  await win.click('.evaluate .segmented button:has-text("Bastante")')
  await win.click('.evaluate button:has-text("Evaluar con XARA")')
  await win.waitForSelector('.evaluation .score', { timeout: 15000 })
  const evalText = await win.textContent('.evaluation')
  check('evalúa con rúbrica: nota, criterios y siguiente paso', /62/.test(evalText) && /Parcialmente correcto/.test(evalText) && /IDOR/.test(evalText), evalText.replace(/\s+/g, ' ').slice(0, 120))
  const evalPrompt = await (await fetch(`http://127.0.0.1:${PORT}/debug/last-system`)).text()
  check('la evaluación usa el prompt de evaluadora', evalPrompt.includes('evaluadora técnica senior'))
  await win.screenshot({ path: path.join(shots, '8-ejercicio-evaluado.png') })
  const academyFile = JSON.parse(readFileSync(path.join(xaraDir, 'academy.json'), 'utf8'))
  check('guarda el intento con las pistas usadas y la seguridad declarada', academyFile.attempts[0]?.hintsUsed === 1 && academyFile.attempts[0]?.confidence === 4)

  // 11. Mi nivel y carrera.
  await win.click('nav.views button:has-text("Mi nivel")')
  await win.waitForSelector('.level-hero h2')
  check('Mi nivel muestra el nivel y las áreas', (await win.$$('.area-row')).length >= 1)
  await win.screenshot({ path: path.join(shots, '9-mi-nivel.png') })
  await win.click('nav.views button:has-text("Carrera")')
  await win.waitForSelector('.career h2')
  check('la vista de carrera avisa de que son inferencias', (await win.textContent('.career header')).includes('no datos verificados'))

  // 12. Clase: diapositivas y clase interactiva con XARA en el tutor.
  await win.click('nav.views button:has-text("Academia")')
  await win.click('.exercise .back')
  await win.click('.academy .track:has-text("Ingeniería de software con IA")')
  await win.$eval('details.module:has(summary:has-text("Cómo se trabaja en 2026"))', (d) => (d.open = true))
  await win.click('details.module:has(summary:has-text("Cómo se trabaja en 2026")) .lesson-head button')
  await win.waitForSelector('.slide h3')
  await win.click('.lesson-actions button:has-text("Clase interactiva con XARA")')
  await win.waitForSelector('article.turn .turn-action:has-text("Clase")', { timeout: 15000 })
  check('la clase interactiva se abre en el tutor', (await win.textContent('nav.views button.on')) === 'Tutor')

  // 13. Corrección de archivos: aviso previo, diff, aplicar con copia y deshacer.
  const work = mkdtempSync(path.join(os.tmpdir(), 'xara-e2e-codigo-'))
  const target = path.join(work, 'promedio.js')
  const original = 'function f(notas) {\n  for (let i = 0; i <= notas.length; i++) {}\n}\n'
  writeFileSync(target, original)
  writeFileSync(path.join(work, '.env'), 'CLAVE=1')
  await win.click('.icon-btn[title^="Corregir un archivo"]')
  await win.waitForSelector('.modal .warning')
  check('antes de corregir pide permiso con aviso', (await win.textContent('.modal .warning')).includes('modificar archivos de tu disco'))
  await win.check('.modal .check input')
  await win.click('.modal button:has-text("Activar permiso")')
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] })
  }, path.join(work, '.env'))
  await win.click('.modal button:has-text("Elegir archivo")')
  await win.waitForSelector('.modal .error-text')
  check('bloquea archivos de secretos', (await win.textContent('.modal .error-text')).includes('secretos'))
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] })
  }, target)
  await win.click('.modal button:has-text("Elegir archivo")')
  await win.fill('.modal textarea', 'El bucle se sale del array')
  await win.click('.modal button:has-text("Proponer corrección")')
  await win.waitForSelector('.diff .diff-add', { timeout: 15000 })
  check('muestra el diff antes de aplicar y no toca el archivo', readFileSync(target, 'utf8') === original)
  await win.screenshot({ path: path.join(shots, '10-correccion-diff.png') })
  await win.click('.modal button:has-text("Aplicar cambio")')
  await win.waitForSelector('.modal .ok-text')
  const backupDir = path.join(xaraDir, 'backups')
  check('aplica el cambio y guarda copia de seguridad', readFileSync(target, 'utf8').includes('i < notas.length') && existsSync(backupDir))
  await win.click('.modal button:has-text("Deshacer")')
  await win.waitForSelector('.modal .ok-text:has-text("deshecho")')
  check('deshacer restaura el archivo original', readFileSync(target, 'utf8') === original)
  await app.close()
} catch (err) {
  check('excepción durante la prueba', false, String(err))
} finally {
  mock.kill()
}

const failed = results.filter((r) => !r.ok).length
console.log(`\n${results.length - failed}/${results.length} comprobaciones correctas. Capturas en ${shots}`)
process.exit(failed ? 1 : 0)
