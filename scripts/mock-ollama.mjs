// Servidor SIMULADO con la API de Ollama (/api/tags, /api/chat) para probar la interfaz sin un modelo real.
// Las respuestas están marcadas como [SIMULADO]. Nunca se usa en la app salvo que configures su URL a mano.
// Uso: node scripts/mock-ollama.mjs [puerto]   — modelos especiales: "error-429", "error-500".
import http from 'node:http'

const port = Number(process.argv[2] ?? 11555)

const ANSWER = `## Resumen
[SIMULADO] Se pide encontrar dos índices cuyos valores sumen el objetivo.

## Requisitos y supuestos
- Devuelve los índices, no los valores.
- Supuesto: existe exactamente una solución.

## Estrategia
Usar un \`Map\` valor → índice en una sola pasada: O(n) tiempo, O(n) espacio.
Alternativa: doble bucle O(n²), más simple pero lenta.

## Plan de acción
1. Recorrer el array.
2. Buscar \`target - x\` en el mapa.
3. Guardar \`x\` con su índice.

## Código
\`\`\`ts
function twoSum(nums: number[], target: number): [number, number] {
  const seen = new Map<number, number>()
  // TODO: completar
  throw new Error('sin solución')
}
\`\`\`

## Verificación
| caso | entrada | salida |
|---|---|---|
| básico | [2,7,11,15], 9 | [0,1] |
| duplicados | [3,3], 6 | [0,1] |

## Explicación
Recorro una vez guardando lo visto; para cada número compruebo si su complemento ya apareció.

<!-- temas: hash map, arrays -->
`

const HINT = `## Pista
[SIMULADO] ¿Qué estructura te permite saber en O(1) si ya viste un número?

## Qué comprobar
Prueba a mano con [3,3] y objetivo 6.

<!-- temas: hash map -->
`

const CONCEPT = `## Idea clave
[SIMULADO] La programación orientada a objetos agrupa datos y comportamiento en objetos.

## Analogía
Una clase es el plano de una casa; cada objeto es una casa construida con ese plano.

## Cómo se ve
\`\`\`mermaid
classDiagram
  Animal <|-- Perro
  Animal : +nombre
  Animal : +hablar()
  Perro : +hablar()
\`\`\`

## Ejemplo
\`\`\`ts
class Perro { hablar() { return 'guau' } }
\`\`\`

## Ejercicio para ti
Modela una cuenta bancaria con depositar y retirar.

## Pregunta para ti
¿Qué pasa si retiras más de lo que hay?

<!-- temas: poo -->
`

const EVALUATION = JSON.stringify({
  level: 'parcial',
  score: 62,
  criteria: [
    { criterion: 'Detecta la inyección SQL y propone consultas parametrizadas', met: 'si', evidence: '[SIMULADO] Lo menciona en Hallazgos' },
    { criterion: 'Detecta la falta de autorización (IDOR: el userId viene del cliente)', met: 'no', evidence: '[SIMULADO] No aparece' }
  ],
  errorTypes: ['omision'],
  strengths: ['[SIMULADO] Identificas bien el riesgo de inyección.'],
  improve: ['Revisa quién puede pedir los pedidos de otro usuario.'],
  nextStep: '[SIMULADO] Repasa autorización a nivel de objeto (IDOR).'
})

const PRACTICAL = JSON.stringify({ score: 70, summary: '[SIMULADO] Buen razonamiento en la tarea 1; falta seguridad en la 2.', tasks: [] })

/** Corrección simulada: sustituye "<=" por "<" en el archivo recibido. */
function fixOf(message) {
  const fence = '`'.repeat(3)
  const code = message.split(fence + '\n')[1]?.split('\n' + fence)[0] ?? ''
  return `## Cambios\n- [SIMULADO] El bucle se salía del array: uso < en vez de <=.\n\n## Archivo\n${fence}js\n${code.replaceAll('<=', '<')}\n${fence}\n`
}

let lastSystem = ''
let lastImages = 0

const OBSERVATION = JSON.stringify({ avisar: true, tipo: 'error', titulo: '[SIMULADO] Test fallido', consejo: '¿Qué devuelve tu función cuando el array está vacío?' })

const server = http.createServer(async (req, res) => {
  // Solo para pruebas: devuelve el último prompt de sistema recibido.
  if (req.url === '/debug/last-system') {
    res.end(lastSystem)
    return
  }
  if (req.url === '/debug/last-images') {
    res.end(String(lastImages))
    return
  }
  if (req.url === '/api/tags') {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ models: [{ name: 'mock' }, { name: 'error-429' }, { name: 'error-500' }] }))
    return
  }
  if (req.url === '/api/chat' && req.method === 'POST') {
    let body = ''
    for await (const c of req) body += c
    const parsed = JSON.parse(body)
    lastSystem = parsed.messages[0]?.content ?? ''
    lastImages = parsed.messages.reduce((n, m) => n + (m.images?.length ?? 0), 0)
    if (parsed.model === 'error-429') {
      res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '12' })
      res.end(JSON.stringify({ error: 'rate limited (simulado)' }))
      return
    }
    if (parsed.model === 'error-500') {
      res.writeHead(500, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'fallo interno (simulado)' }))
      return
    }
    const last = parsed.messages.at(-1).content
    const text = lastSystem.includes('modo OBSERVADOR')
      ? OBSERVATION
      : lastSystem.includes('Corriges ejercicios')
        ? EVALUATION
        : lastSystem.includes('parte práctica de un examen')
          ? PRACTICAL
          : lastSystem.includes('Corriges UN archivo')
            ? fixOf(last)
            : /pista/i.test(last)
              ? HINT
              : /qué es/i.test(last)
                ? CONCEPT
                : ANSWER
    res.writeHead(200, { 'content-type': 'application/x-ndjson' })
    const parts = text.match(/[\s\S]{1,40}/g)
    for (const p of parts) {
      res.write(JSON.stringify({ message: { role: 'assistant', content: p }, done: false }) + '\n')
      await new Promise((r) => setTimeout(r, 15))
    }
    res.end(JSON.stringify({ message: { role: 'assistant', content: '' }, done: true, done_reason: 'stop', prompt_eval_count: 100, eval_count: parts.length }) + '\n')
    return
  }
  res.writeHead(404).end()
})

server.listen(port, '127.0.0.1', () => console.log(`mock-ollama escuchando en http://127.0.0.1:${port}`))
