import { useEffect, useRef, useState } from 'react'
import './Diagram.css'

type Mermaid = typeof import('mermaid').default

let loader: Promise<Mermaid> | null = null
let counter = 0

// Mermaid pesa bastante: se carga solo cuando aparece el primer diagrama.
function loadMermaid(): Promise<Mermaid> {
  loader ??= import('mermaid').then(({ default: mermaid }) => {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: dark ? 'dark' : 'neutral',
      fontFamily: 'Inter Variable, system-ui, sans-serif'
    })
    return mermaid
  })
  return loader
}

const STAGE_INIT = `%%{init: {'theme':'base','themeVariables':{'background':'transparent','primaryColor':'#ffffff','primaryTextColor':'#12151b','primaryBorderColor':'#12151b','lineColor':'#12151b','secondaryColor':'#ffffff','tertiaryColor':'#ffffff','actorBkg':'#ffffff','actorBorder':'#12151b','actorTextColor':'#12151b','actorLineColor':'#6b7280','signalColor':'#12151b','signalTextColor':'#12151b','labelBoxBkgColor':'#ffffff','labelTextColor':'#12151b','noteBkgColor':'#fff3c4','noteTextColor':'#12151b','fontSize':'18px','fontFamily':'Atkinson Hyperlegible Next Variable, system-ui, sans-serif'}}}%%`

/** Diagrama Mermaid. Mientras llega por streaming o si no es válido se muestra el código. */
export function Diagram({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    // Se espera a que el texto deje de cambiar para no intentar dibujar un diagrama a medias.
    const timer = setTimeout(async () => {
      const mermaid = await loadMermaid()
      if (!(await mermaid.parse(code, { suppressErrors: true }))) {
        if (!cancelled) setInvalid(true)
        return
      }
      // Dentro del escenario de las clases el fondo es papel claro: el diagrama usa su propia paleta.
      const onStage = !!ref.current?.closest('.x2-stage')
      const source = onStage && !/%%\{init/.test(code) ? `${STAGE_INIT}\n${code}` : code
      const { svg } = await mermaid.render(`diagrama-${++counter}`, source)
      if (!cancelled) {
        setSvg(svg)
        setInvalid(false)
      }
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [code])

  if (svg) return <div className="diagram" ref={ref} dangerouslySetInnerHTML={{ __html: svg }} />
  return (
    <div className="diagram-pending" ref={ref}>
      <pre>{code}</pre>
      {invalid && <span className="muted-text">El diagrama aún está incompleto o no es válido; se muestra su código.</span>}
    </div>
  )
}
