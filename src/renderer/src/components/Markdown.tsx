import { memo, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { highlight } from '../highlight'
import { Diagram } from './Diagram'
import './Markdown.css'

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node && typeof node === 'object' && 'props' in node) return textOf((node as { props: { children?: ReactNode } }).props.children)
  return ''
}

function langOf(node: ReactNode): string | undefined {
  const className = (node as { props?: { className?: string } } | null)?.props?.className ?? ''
  return /language-(\w+)/.exec(className)?.[1]
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const [copied, setCopied] = useState(false)
  const code = textOf(children).replace(/\n$/, '')
  const lang = langOf(children)
  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }
  return (
    <div className="code-block">
      <div className="code-bar">
        {lang && <span className="code-lang">{lang}</span>}
        <button className="copy-btn" onClick={copy} title="Copiar código">
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre>
        <code>{highlight(code, lang)}</code>
      </pre>
    </div>
  )
}

const CALLOUTS: Record<string, string> = { ejemplo: 'ejemplo', ojo: 'ojo', truco: 'truco', 'error típico': 'error', recuerda: 'recuerda' }

/** Una cita que empieza por «Ejemplo:», «Ojo:», «Truco:», «Error típico:» o «Recuerda:» se dibuja como tarjeta de color. */
function calloutOf(children: ReactNode): { kind: string; label: string } | null {
  const head = textOf(children).trim().replace(/\s+/g, ' ')
  const m = /^(ejemplo|ojo|truco|error típico|recuerda):/i.exec(head)
  return m ? { kind: CALLOUTS[m[1].toLowerCase()], label: m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() } : null
}

export const Markdown = memo(function Markdown({ text, variant }: { text: string; variant?: 'definition' }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          blockquote: ({ children }) => {
            const c = calloutOf(children)
            return c ? <div className={`callout callout-${c.kind}`}>{children}</div> : <blockquote>{children}</blockquote>
          },
          // En una definición, «**Término**: explicación» se dibuja como ficha: el término arriba y su explicación debajo.
          li: ({ children }) => {
            if (variant !== 'definition') return <li>{children}</li>
            const kids = Array.isArray(children) ? children : [children]
            const first = kids.find((k) => typeof k === 'object' && k !== null && 'type' in (k as object) && (k as { type: unknown }).type === 'strong')
            if (!first) return <li>{children}</li>
            const rest = kids.filter((k) => k !== first).map((k, i) => (typeof k === 'string' && i === 0 ? k.replace(/^\s*:\s*/, '') : k))
            return (
              <li className="term-card">
                <span className="term-name">{first as ReactNode}</span>
                <span className="term-def">{rest}</span>
              </li>
            )
          },
          pre: ({ children }) => (langOf(children) === 'mermaid' ? <Diagram code={textOf(children).trim()} /> : <CodeBlock>{children}</CodeBlock>),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          )
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})

/** Texto de una línea (preguntas, opciones, explicaciones) donde solo hace falta mostrar el `código` entre comillas invertidas. */
export function InlineCode({ text }: { text: string }) {
  return <>{text.split(/`([^`]+)`/).map((part, i) => (i % 2 ? <code key={i} className="inline-code">{part}</code> : part))}</>
}
