import { useState } from 'react'
import { Icon } from './Icon'
import './Onboarding.css'

interface Props {
  firstName: string
  onStartPlacement: () => void
  onClose: () => void
}

interface Slide {
  emoji: string
  tint: string
  title: string
  body: React.ReactNode
}

// Guía de bienvenida: en pocas pantallas le dice al alumno qué es XARA, cómo se usa y por dónde empezar.
export function Onboarding({ firstName, onStartPlacement, onClose }: Props) {
  const [i, setI] = useState(0)

  const slides: Slide[] = [
    {
      emoji: '🎓',
      tint: '#0071e3',
      title: `Hola ${firstName}, soy XARA`,
      body: (
        <>
          <p>Tu tutora de programación con inteligencia artificial.</p>
          <p className="muted-text">Te acompaño desde donde estás hoy hasta convertirte en programador contratado en 2026, aprendiendo a trabajar con IA en lugar de competir con ella.</p>
        </>
      )
    },
    {
      emoji: '🗺️',
      tint: '#30b94d',
      title: 'Cómo funciona, en 3 pasos',
      body: (
        <ol className="ob-steps">
          <li>
            <b>1 · Examen de nivel</b>
            <span>Unas preguntas y tareas cortas para ubicarte. Sin nota, solo para saber desde dónde empezamos.</span>
          </li>
          <li>
            <b>2 · Tu ruta en Academia</b>
            <span>Te armo una ruta de temas con clases, práctica y exámenes, en el orden que te conviene.</span>
          </li>
          <li>
            <b>3 · Practica y demuéstralo</b>
            <span>Retos diarios, entrevistas simuladas y proyectos para tu GitHub. Ganas XP, rachas e insignias.</span>
          </li>
        </ol>
      )
    },
    {
      emoji: '💬',
      tint: '#a855f7',
      title: 'Háblame o escríbeme',
      body: (
        <>
          <p>
            Abre mi panel con el botón <b>XARA</b> (o <kbd>Ctrl</kbd>+<kbd>J</kbd>) y pregúntame lo que sea: una duda, que te dé una clase o que te rete.
          </p>
          <ul className="ob-list">
            <li>⌨️ Puedes escribirme siempre en la caja de texto.</li>
            <li>🎤 Si tu PC tiene micrófono, pulsa el 🎤 para dictarme.</li>
            <li>📱 El micrófono del celular aún no está integrado: mientras tanto, escríbeme sin problema.</li>
          </ul>
        </>
      )
    },
    {
      emoji: '⚙️',
      tint: '#ff8c00',
      title: 'Voz, clave y observador',
      body: (
        <ul className="ob-list">
          <li>
            🔊 <b>Mi voz ya está lista</b> (Verity). Ajusta volumen, pausa o cámbiala en <b>Configuración</b>.
          </li>
          <li>
            🔑 <b>Tu clave ya está puesta</b> y es gratuita. Puedes verla o cambiarla en <b>Configuración</b> (el ⚙️ arriba a la derecha).
          </li>
          <li>
            👁️ <b>Modo observador</b>: si lo activas, miro tu pantalla cada cierto tiempo y te doy un consejo. Es opcional y lo controlas con el ojo de arriba.
          </li>
        </ul>
      )
    }
  ]

  const slide = slides[i]
  const last = i === slides.length - 1

  return (
    <div className="ob-backdrop" role="dialog" aria-modal="true" aria-label="Guía de bienvenida">
      <div className="ob-card">
        <button className="ob-skip" onClick={onClose}>
          Saltar
        </button>
        <div className="ob-hero" style={{ ['--tint' as string]: slide.tint }}>
          <span className="ob-emoji">{slide.emoji}</span>
        </div>
        <h2 className="ob-title">{slide.title}</h2>
        <div className="ob-body">{slide.body}</div>

        <div className="ob-dots">
          {slides.map((_, n) => (
            <span key={n} className={n === i ? 'on' : ''} onClick={() => setI(n)} />
          ))}
        </div>

        <div className="ob-actions">
          {i > 0 && (
            <button onClick={() => setI((n) => n - 1)}>Atrás</button>
          )}
          {last ? (
            <>
              <button onClick={onClose}>Explorar por mi cuenta</button>
              <button
                className="primary"
                onClick={() => {
                  onClose()
                  onStartPlacement()
                }}
              >
                Hacer mi examen de nivel <Icon name="play" size={13} />
              </button>
            </>
          ) : (
            <button className="primary" onClick={() => setI((n) => n + 1)}>
              Siguiente
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
