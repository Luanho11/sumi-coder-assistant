import { capstoneFor, findTrack } from '../../../core/academy/catalog'
import './CapstoneView.css'

interface Props {
  trackId: string
  onBack: () => void
  onAskTutor: (text: string) => void
}

export function CapstoneView({ trackId, onBack, onAskTutor }: Props) {
  const track = findTrack(trackId)
  const cap = capstoneFor(trackId)
  if (!track || !cap) return null

  const brief = `Quiero construir este proyecto de portafolio: "${cap.title}". ${cap.summary}\nFunciones: ${cap.features.join('; ')}.\nAyúdame a empezar: especifiquemos juntos el primer hito y dime cómo usar la IA de forma correcta para construirlo sin dejar de aprender.`

  return (
    <div className="capstone-view">
      <button className="back" onClick={onBack}>
        ‹ Academia
      </button>
      <span className="tag" style={{ ['--track' as string]: track.color }}>
        {track.title} · Proyecto final
      </span>
      <h2>
        {cap.emoji} {cap.title}
      </h2>
      <p className="cap-summary">{cap.summary}</p>
      <div className="cap-why">
        <b>💼 Por qué suma a tu GitHub</b>
        <p>{cap.why}</p>
      </div>

      <button className="primary cap-cta" onClick={() => onAskTutor(brief)}>
        💬 Empezar con XARA
      </button>

      <div className="cap-cols">
        <section>
          <h3>✨ Funciones</h3>
          <ul>
            {cap.features.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>✅ Cuándo está bien hecho</h3>
          <ul>
            {cap.acceptance.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      </div>

      <section>
        <h3>🗺️ Plan por hitos</h3>
        <ol className="cap-milestones">
          {cap.milestones.map((m, i) => (
            <li key={i}>
              <b>{m.title}</b>
              <ul>
                {m.tasks.map((t, j) => (
                  <li key={j}>{t}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section className="cap-ai">
        <h3>🤖 Construirlo con IA de forma ética</h3>
        <ul>
          {cap.aiGuide.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        <h4>Prompts de ejemplo</h4>
        <div className="cap-prompts">
          {cap.aiGuide.samplePrompts.map((p, i) => (
            <div key={i} className="cap-prompt">
              <pre>{p}</pre>
              <button onClick={() => onAskTutor(`Revisa y mejora este prompt para mi proyecto "${cap.title}", y explícame por qué:\n\n${p}`)}>Mejóralo conmigo</button>
            </div>
          ))}
        </div>
      </section>

      <div className="cap-cols">
        <section>
          <h3>📦 Entregables</h3>
          <ul>
            {cap.deliverables.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>🚀 Para destacar aún más</h3>
          <ul>
            {cap.stretch.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
