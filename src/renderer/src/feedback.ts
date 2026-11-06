// Sonidos cortos de feedback generados con WebAudio (sin archivos): acierto, error y final.
// Son sutiles y toleran que el navegador bloquee el audio hasta la primera interacción.

let ctx: AudioContext | null = null
function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

// Reproduce una secuencia de notas (frecuencia Hz, inicio y duración en segundos).
function play(notes: { f: number; t: number; d: number; type?: OscillatorType }[], gain = 0.06): void {
  const ac = audio()
  if (!ac) return
  const now = ac.currentTime
  for (const n of notes) {
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = n.type ?? 'sine'
    osc.frequency.value = n.f
    g.gain.setValueAtTime(0, now + n.t)
    g.gain.linearRampToValueAtTime(gain, now + n.t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d)
    osc.connect(g).connect(ac.destination)
    osc.start(now + n.t)
    osc.stop(now + n.t + n.d + 0.02)
  }
}

/** Acierto: dos notas ascendentes alegres. */
export function playCorrect(): void {
  play([
    { f: 660, t: 0, d: 0.12 },
    { f: 880, t: 0.1, d: 0.16 }
  ])
}

/** Error: una nota grave corta, sin ser desagradable. */
export function playWrong(): void {
  play([{ f: 200, t: 0, d: 0.22, type: 'triangle' }], 0.05)
}

/** Final del examen/entrevista: pequeña fanfarria. */
export function playFinish(): void {
  play([
    { f: 523, t: 0, d: 0.14 },
    { f: 659, t: 0.13, d: 0.14 },
    { f: 784, t: 0.26, d: 0.14 },
    { f: 1047, t: 0.39, d: 0.28 }
  ])
}
