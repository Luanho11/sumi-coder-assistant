import { useEffect, useMemo, useState } from 'react'
import { gradeItem, normalize, type Answer, type ItemResult } from '../../../core/academy/v2/grading'
import type { Item } from '../../../core/academy/v2/types'
import { Markdown } from '../components/Markdown'
import { playCorrect, playWrong } from '../feedback'

// Renderizador de ítems de la academia v2. Es un componente controlado: quien lo usa guarda la respuesta y decide cuándo corregir.

function seeded<T>(arr: T[], seed: string): T[] {
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const rng = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    return (h >>> 0) / 4294967296
  }
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** ¿Hay respuesta suficiente para poder corregir? */
export function isAnswered(item: Item, a: Answer | undefined): boolean {
  if (a === undefined || a === null) return false
  switch (item.type) {
    case 'mcq':
      return typeof a === 'number'
    case 'multi':
      return Array.isArray(a) && a.length > 0
    case 'order':
      return Array.isArray(a) && a.length === (item.steps ?? []).length
    case 'classify':
      return Array.isArray(a) && (item.cases ?? []).every((_, i) => !!(a as string[])[i])
    case 'fill':
      return Array.isArray(a) && (item.blanks ?? []).every((_, i) => !!String((a as string[])[i] ?? '').trim())
    case 'match':
      return typeof a === 'object' && !Array.isArray(a) && (item.pairs ?? []).every((p) => !!(a as Record<string, string>)[p.left])
    case 'spot':
      return Array.isArray(a) && a.length > 0
    case 'written':
    case 'code':
    case 'sql':
      return typeof a === 'string' && a.trim().length > 0
  }
}

/** Corrige en el momento los ítems de respuesta cerrada (comprobaciones de parte, preparación, repaso). */
export function gradeLocal(item: Item, a: Answer | undefined): ItemResult {
  return gradeItem(item, a)
}

/** Los ítems de código y SQL se corrigen al probarlos: el resultado de «Probar» es la corrección. */
export const esEjecutable = (item: Item) => item.type === 'code' || item.type === 'sql'

export function gradeCode(item: Item, pasa: boolean): ItemResult {
  return { ok: pasa, explanation: item.explanation ?? '', ...(pasa ? {} : { why: 'Pulsa «Probar» y haz que pasen las pruebas.' }) }
}

interface Props {
  item: Item
  answer: Answer | undefined
  onChange: (a: Answer) => void
  result?: { ok: boolean; why?: string; explanation: string }
  disabled?: boolean
  /** Para `code` y `sql`: el resultado de ejecutar las pruebas. */
  onCodeResult?: (ok: boolean) => void
}

function Feedback({ result }: { result: NonNullable<Props['result']> }) {
  return (
    <div className={`x2-feedback ${result.ok ? 'ok' : 'bad'}`} role="status">
      <b>{result.ok ? 'Correcto.' : 'Todavía no.'}</b>
      {!result.ok && result.why && <p>{result.why}</p>}
      {result.explanation && <p>{result.explanation}</p>}
    </div>
  )
}

function CorrectAnswer({ item }: { item: Item }) {
  switch (item.type) {
    case 'order':
      return (
        <ol className="x2-correct">
          {item.steps?.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      )
    case 'classify':
      return (
        <ul className="x2-correct">
          {item.cases?.map((c) => (
            <li key={c.text}>
              {c.text} → <b>{c.bucket}</b>
            </li>
          ))}
        </ul>
      )
    case 'fill':
      return <p className="x2-correct">{item.blanks?.map((b) => b.accept[0]).join(' · ')}</p>
    case 'match':
      return (
        <ul className="x2-correct">
          {item.pairs?.map((p) => (
            <li key={p.left}>
              {p.left} → <b>{p.right}</b>
            </li>
          ))}
        </ul>
      )
    case 'spot':
      return <p className="x2-correct">Líneas: {item.correctLines?.join(', ')}</p>
    case 'multi':
      return (
        <ul className="x2-correct">
          {item.correctIndexes?.map((i) => (
            <li key={i}>{item.options?.[i]?.text}</li>
          ))}
        </ul>
      )
    default:
      return null
  }
}

export function ItemView({ item, answer, onChange, result, disabled, onCodeResult }: Props) {
  const locked = disabled || !!result
  return (
    <div className="x2-item">
      <div className="x2-prompt">
        <Markdown text={item.prompt} />
      </div>
      <Body item={item} answer={answer} onChange={onChange} locked={locked} result={result} onCodeResult={onCodeResult} />
      {result && (
        <>
          <Feedback result={result} />
          {!result.ok && item.type !== 'mcq' && item.type !== 'written' && item.type !== 'code' && item.type !== 'sql' && (
            <details className="x2-solution">
              <summary>Ver la respuesta correcta</summary>
              <CorrectAnswer item={item} />
            </details>
          )}
        </>
      )}
    </div>
  )
}

function Body({ item, answer, onChange, locked, result, onCodeResult }: Omit<Props, 'disabled'> & { locked: boolean }) {
  switch (item.type) {
    case 'mcq':
      return (
        <div className="x2-options" role="radiogroup">
          {item.options?.map((o, i) => {
            const state = result ? (i === item.correctIndex ? 'right' : i === answer ? 'wrong' : '') : answer === i ? 'sel' : ''
            return (
              <button key={o.text} role="radio" aria-checked={answer === i} className={`x2-option ${state}`} disabled={locked} onClick={() => onChange(i)}>
                <span className="x2-mark" aria-hidden />
                {o.text}
              </button>
            )
          })}
        </div>
      )
    case 'multi': {
      const chosen = (Array.isArray(answer) ? answer : []) as number[]
      return (
        <div className="x2-options">
          {item.options?.map((o, i) => {
            const on = chosen.includes(i)
            const state = result ? ((item.correctIndexes ?? []).includes(i) ? 'right' : on ? 'wrong' : '') : on ? 'sel' : ''
            return (
              <button key={o.text} role="checkbox" aria-checked={on} className={`x2-option check ${state}`} disabled={locked} onClick={() => onChange(on ? chosen.filter((x) => x !== i) : [...chosen, i])}>
                <span className="x2-mark" aria-hidden />
                {o.text}
              </button>
            )
          })}
        </div>
      )
    }
    case 'order':
      return <OrderBody item={item} answer={answer} onChange={onChange} locked={locked} />
    case 'classify': {
      const a = (Array.isArray(answer) ? answer : []) as string[]
      return (
        <ul className="x2-classify">
          {item.cases?.map((c, i) => {
            const state = result ? (a[i] === c.bucket ? 'right' : 'wrong') : ''
            return (
              <li key={c.text} className={state}>
                <span>{c.text}</span>
                <span className="x2-seg" role="group">
                  {item.buckets?.map((b) => (
                    <button key={b} aria-pressed={a[i] === b} disabled={locked} onClick={() => onChange(Object.assign([...(item.cases ?? []).map((_, k) => a[k] ?? '')], { [i]: b }))}>
                      {b}
                    </button>
                  ))}
                </span>
              </li>
            )
          })}
        </ul>
      )
    }
    case 'fill': {
      const a = (Array.isArray(answer) ? answer : []) as string[]
      const parts = String(item.template ?? '').split('___')
      return (
        <p className="x2-fill">
          {parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < parts.length - 1 && (
                <input
                  aria-label={`Hueco ${i + 1}`}
                  value={a[i] ?? ''}
                  disabled={locked}
                  className={result ? (item.blanks?.[i]?.accept.some((x) => normalize(x) === normalize(a[i] ?? '')) ? 'right' : 'wrong') : ''}
                  onChange={(e) => onChange((item.blanks ?? []).map((_, k) => (k === i ? e.target.value : (a[k] ?? ''))))}
                />
              )}
            </span>
          ))}
        </p>
      )
    }
    case 'match': {
      const a = (typeof answer === 'object' && answer !== null && !Array.isArray(answer) ? answer : {}) as Record<string, string>
      const rights = seeded(
        (item.pairs ?? []).map((p) => p.right),
        item.id
      )
      return (
        <ul className="x2-classify">
          {item.pairs?.map((p) => (
            <li key={p.left} className={result ? (a[p.left] === p.right ? 'right' : 'wrong') : ''}>
              <span>{p.left}</span>
              <select aria-label={p.left} value={a[p.left] ?? ''} disabled={locked} onChange={(e) => onChange({ ...a, [p.left]: e.target.value })}>
                <option value="">Elige…</option>
                {rights.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )
    }
    case 'spot': {
      const a = (Array.isArray(answer) ? answer : []) as number[]
      const lines = String(item.artifact ?? '').split('\n')
      return (
        <div className="x2-spot" role="group" aria-label="Líneas del texto">
          {lines.map((line, i) => {
            const n = i + 1
            const on = a.includes(n)
            const state = result ? ((item.correctLines ?? []).includes(n) ? 'right' : on ? 'wrong' : '') : on ? 'sel' : ''
            return (
              <button key={n} aria-pressed={on} className={`x2-line ${state}`} disabled={locked} onClick={() => onChange(on ? a.filter((x) => x !== n) : [...a, n])}>
                <span className="x2-ln">{n}</span>
                <code>{line.replace(/^Línea \d+:\s*/, '')}</code>
              </button>
            )
          })}
        </div>
      )
    }
    case 'written':
      return (
        <textarea className="x2-textarea" rows={6} disabled={locked} value={typeof answer === 'string' ? answer : ''} placeholder="Escribe aquí tu respuesta con tus palabras." onChange={(e) => onChange(e.target.value)} />
      )
    case 'code':
    case 'sql':
      return <CodeBody item={item} answer={answer} onChange={onChange} locked={locked} onCodeResult={onCodeResult} />
  }
}

function OrderBody({ item, answer, onChange, locked }: { item: Item; answer: Answer | undefined; onChange: (a: Answer) => void; locked: boolean }) {
  const initial = useMemo(() => {
    let s = seeded(item.steps ?? [], item.id)
    if (s.join('|') === (item.steps ?? []).join('|')) s = [...s.slice(1), s[0]]
    return s
  }, [item])
  useEffect(() => {
    if (answer === undefined) onChange(initial)
  }, [answer, initial, onChange])
  const a = (Array.isArray(answer) ? answer : initial) as string[]
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= a.length) return
    const b = [...a]
    ;[b[i], b[j]] = [b[j], b[i]]
    onChange(b)
  }
  return (
    <ol className="x2-order">
      {a.map((s, i) => (
        <li key={s}>
          <span>{s}</span>
          <span className="x2-move">
            <button aria-label="Subir" disabled={locked || i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button aria-label="Bajar" disabled={locked || i === a.length - 1} onClick={() => move(i, 1)}>
              ↓
            </button>
          </span>
        </li>
      ))}
    </ol>
  )
}

function CodeBody({ item, answer, onChange, locked, onCodeResult }: { item: Item; answer: Answer | undefined; onChange: (a: Answer) => void; locked: boolean; onCodeResult?: (ok: boolean) => void }) {
  const [run, setRun] = useState<Awaited<ReturnType<typeof window.copilot.v2.runCode>> | null>(null)
  const [busy, setBusy] = useState(false)
  const code = typeof answer === 'string' ? answer : (item.starter ?? '')
  useEffect(() => {
    if (answer === undefined && item.starter) onChange(item.starter)
  }, [answer, item.starter, onChange])
  const exec = async () => {
    setBusy(true)
    try {
      const r = await window.copilot.v2.runCode(item.id, code)
      setRun(r)
      onCodeResult?.(r.ok)
      if (r.ok) playCorrect()
      else playWrong()
    } catch (e) {
      setRun({ ok: false, passed: 0, total: 0, tests: [], error: String((e as Error).message) })
      onCodeResult?.(false)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="x2-code">
      <textarea className="x2-textarea mono" spellCheck={false} rows={9} disabled={locked} value={code} onChange={(e) => onChange(e.target.value)} />
      <button className="x2-btn" disabled={locked || busy} onClick={exec}>
        {busy ? 'Probando…' : 'Probar'}
      </button>
      {run && (
        <div className={`x2-feedback ${run.ok ? 'ok' : 'bad'}`}>
          <b>{run.ok ? (run.total === 1 ? 'Pasa la prueba.' : `Pasa las ${run.total} pruebas.`) : run.error ? 'Hay un error.' : `Pasa ${run.passed} de ${run.total}.`}</b>
          {run.error && <p>{run.error}</p>}
          {run.tests
            .filter((t) => !t.passed)
            .slice(0, 3)
            .map((t) => (
              <p key={t.name}>
                {t.name}: esperaba <code>{t.expected}</code> y obtuvo <code>{t.got}</code>
              </p>
            ))}
        </div>
      )}
    </div>
  )
}
