import { useEffect, useState } from 'react'
import './Loading.css'

interface Props {
  message: string
  tips?: string[]
}

const DEFAULT_TIPS = [
  'Un buen programador no memoriza: sabe dónde buscar y cómo razonar.',
  'Leer código ajeno enseña tanto como escribir el tuyo.',
  'Antes de programar, explica el problema con tus palabras.',
  'Los nombres claros valen más que los comentarios.',
  'Equivocarse y entender por qué es la forma más rápida de aprender.',
  'La IA es tu copiloto: tú decides el rumbo, no al revés.',
  'Divide el problema en pasos pequeños y prueba cada uno.'
]

/** Pantalla de espera mientras la IA trabaja: un spinner y consejos que van rotando. */
export function Loading({ message, tips = DEFAULT_TIPS }: Props) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % tips.length), 3500)
    return () => clearInterval(id)
  }, [tips.length])

  return (
    <div className="loading-box" role="status" aria-live="polite">
      <div className="loading-orb" />
      <b>{message}</b>
      <p className="loading-tip" key={i}>
        💡 {tips[i]}
      </p>
    </div>
  )
}
