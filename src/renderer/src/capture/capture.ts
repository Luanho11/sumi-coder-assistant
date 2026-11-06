import './capture.css'

interface Region {
  x: number
  y: number
  w: number
  h: number
}

declare global {
  interface Window {
    captura: {
      alRecibirImagen: (cb: (dataUrl: string) => void) => void
      terminar: (region: Region | null) => void
    }
  }
}

const fondo = document.getElementById('fondo') as HTMLImageElement
const seleccion = document.getElementById('seleccion') as HTMLDivElement
let inicio: { x: number; y: number } | null = null

window.captura.alRecibirImagen((dataUrl) => {
  fondo.src = dataUrl
})

function rectangulo(e: MouseEvent) {
  const x = Math.min(inicio!.x, e.clientX)
  const y = Math.min(inicio!.y, e.clientY)
  return { x, y, w: Math.abs(e.clientX - inicio!.x), h: Math.abs(e.clientY - inicio!.y) }
}

window.addEventListener('mousedown', (e) => {
  inicio = { x: e.clientX, y: e.clientY }
  seleccion.hidden = false
})

window.addEventListener('mousemove', (e) => {
  if (!inicio) return
  const r = rectangulo(e)
  Object.assign(seleccion.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` })
})

window.addEventListener('mouseup', (e) => {
  if (!inicio) return
  const r = rectangulo(e)
  inicio = null
  const ancho = window.innerWidth
  const alto = window.innerHeight
  window.captura.terminar({ x: r.x / ancho, y: r.y / alto, w: r.w / ancho, h: r.h / alto })
})

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.captura.terminar(null)
  if (e.key === 'Enter') window.captura.terminar({ x: 0, y: 0, w: 1, h: 1 })
})
