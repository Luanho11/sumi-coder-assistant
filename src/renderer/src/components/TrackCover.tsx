import type { SimpleIcon } from 'simple-icons'
import {
  siAngular,
  siCloudflare,
  siClaude,
  siCss,
  siCypress,
  siDocker,
  siDotnet,
  siFigma,
  siGit,
  siGithub,
  siGithubactions,
  siGnubash,
  siGooglegemini,
  siGrafana,
  siHtml5,
  siHuggingface,
  siJavascript,
  siJest,
  siJira,
  siKubernetes,
  siLangchain,
  siLinux,
  siNextdotjs,
  siNodedotjs,
  siOllama,
  siOwasp,
  siPostgresql,
  siPostman,
  siPython,
  siReact,
  siRedis,
  siSelenium,
  siSpringboot,
  siSqlite,
  siTypescript,
  siUml
} from 'simple-icons'
import './TrackCover.css'

type CoverIcon = Pick<SimpleIcon, 'slug' | 'hex' | 'path'>

// Simple Icons no incluye la taza de Java (Oracle retiró su logo), así que se dibuja aquí con sus colores.
const JAVA_CUP: CoverIcon = {
  slug: 'java',
  hex: 'E76F00',
  path: 'M8 4.5a.75.75 0 0 1 1.5 0v3a.75.75 0 0 1-1.5 0zM11.25 3a.75.75 0 0 1 1.5 0v4.5a.75.75 0 0 1-1.5 0zM4.5 10h12v4a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5zM16.5 11h1.25a2.75 2.75 0 0 1 0 5.5H16v-1.6h1.75a1.15 1.15 0 0 0 0-2.3H16.5zM3 20.25h15.5a.9.9 0 0 1 0 1.75H3a.9.9 0 0 1 0-1.75z'
}

// Logos de las tecnologías de cada ruta (Simple Icons, CC0). Una ruta nueva sin entrada muestra un libro.
const COVERS: Record<string, CoverIcon[]> = {
  'ingenieria-ia': [siClaude, siGooglegemini, siGit],
  javascript: [siJavascript, siTypescript],
  'html-css': [siHtml5, siCss],
  react: [siReact],
  angular: [siAngular],
  java: [JAVA_CUP, siSpringboot],
  python: [siPython],
  csharp: [siDotnet],
  'node-backend': [siNodedotjs, siNextdotjs],
  devops: [siGit, siDocker, siGithubactions],
  'datos-sql': [siPostgresql, siSqlite],
  'qa-testing': [siCypress, siSelenium, siPostman],
  'seguridad-web': [siOwasp, siCloudflare],
  'ia-aplicada': [siLangchain, siHuggingface, siOllama],
  'diseno-sistemas': [siRedis, siKubernetes, siPostgresql],
  entrevistas: [siGithub, siJira],
  'analisis-software': [siUml, siJira],
  'analisis-funcional': [siUml, siFigma],
  'soporte-ti': [siLinux],
  oficio: [siGnubash, siJest, siGrafana]
}

interface Props {
  trackId: string
  color: string
}

/** Portada ilustrada de una ruta: degradado de su color y los logos de sus tecnologías en "fichas" blancas. */
export function TrackCover({ trackId, color }: Props) {
  const icons = COVERS[trackId]
  return (
    <div className="track-cover" style={{ ['--track' as string]: color }} aria-hidden>
      {icons ? (
        icons.map((icon) => (
          <span key={icon.slug} className="cover-tile">
            <svg viewBox="0 0 24 24" fill={`#${icon.hex}`}>
              <path d={icon.path} />
            </svg>
          </span>
        ))
      ) : (
        <span className="cover-tile emoji">📘</span>
      )}
    </div>
  )
}
