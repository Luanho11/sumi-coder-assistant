import { useId } from 'react'

/** Logo de XARA: los signos de código "><" forman la X, sobre el degradado azul-violeta de la marca. */
export function XaraLogo({ size = 44 }: { size?: number }) {
  // ids únicos para que varios logos en la misma página no compartan degradados
  const id = useId()
  return (
    <svg viewBox="0 0 1024 1024" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2f6bff" />
          <stop offset="0.55" stopColor="#6a3dff" />
          <stop offset="1" stopColor="#c13dff" />
        </linearGradient>
        <radialGradient id={`${id}glow`} cx="0.3" cy="0.15" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1024" height="1024" rx="232" fill={`url(#${id}bg)`} />
      <rect width="1024" height="1024" rx="232" fill={`url(#${id}glow)`} />
      <g strokeLinecap="round" strokeLinejoin="round" fill="none" strokeWidth="100">
        <path d="M296 284 L448 512 L296 740" stroke="#fff" />
        <path d="M728 284 L576 512 L728 740" stroke="#ffd6f5" />
      </g>
    </svg>
  )
}
