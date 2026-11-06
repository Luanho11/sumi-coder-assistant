import { useEffect, useMemo, useRef, useState } from 'react'
import { challenges, findChallenge } from '../../../core/academy/catalog'
import { AREA_LABELS } from '../../../core/academy/level'
import type { AcademyView } from '../../../main/academy'
import type { Grid, RunResult } from '../../../main/sandbox'
import { highlight } from '../highlight'
import { playCorrect, playFinish, playWrong } from '../feedback'
import { Icon } from '../components/Icon'
import { InlineCode } from '../components/Markdown'
import './Sandbox.css'

interface Props {
  view: AcademyView
  initialChallengeId?: string
  onUpdate: (view: AcademyView) => void
  onAskTutor: (text: string) => void
}

type Lang = 'javascript' | 'sql'
const DEFAULT_JS = '// Prueba lo que quieras. Usa console.log para ver resultados.\nconsole.log([1, 2, 3].map((n) => n * 2))\n'
const DEFAULT_SQL = 'CREATE TABLE numeros (n INTEGER);\nINSERT INTO numeros VALUES (1), (2), (3);\nSELECT n, n * n AS cuadrado FROM numeros;'

const KIND_BADGE: Record<string, { label: string; cls: string }> = {
  resuelve: { label: 'Resuelve', cls: '' },
  bug: { label: '🐛 Encuentra el bug', cls: 'bug' },
  explica: { label: '🔎 Explica el código', cls: 'explica' },
  css: { label: '🎨 Corrige el CSS', cls: 'css' }
}

export function Sandbox({ view, initialChallengeId, onUpdate, onAskTutor }: Props) {
  const [challengeId, setChallengeId] = useState<string | undefined>(initialChallengeId)
  const challenge = challengeId ? findChallenge(challengeId) : undefined
  const kind = challenge?.kind ?? 'resuelve'
  const [lang, setLang] = useState<Lang>('javascript')
  const [code, setCode] = useState(DEFAULT_JS)
  const [result, setResult] = useState<RunResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState(0)
  const [explanation, setExplanation] = useState('')
  const [revealed, setRevealed] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (initialChallengeId) openChallenge(initialChallengeId)
  }, [initialChallengeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const openChallenge = (id: string) => {
    const c = findChallenge(id)
    if (!c) return
    setChallengeId(id)
    setCode(c.starter)
    setResult(null)
    setHint(0)
    setExplanation('')
    setRevealed(false)
  }

  const freePlay = () => {
    setChallengeId(undefined)
    setCode(lang === 'sql' ? DEFAULT_SQL : DEFAULT_JS)
    setResult(null)
  }

  const run = async () => {
    setBusy(true)
    try {
      if (challenge) {
        const res = await window.copilot.runChallenge(challenge.id, code)
        setResult(res.result)
        onUpdate(res)
        if (res.result.ok) playCorrect()
        else playWrong()
      } else {
        setResult(await window.copilot.runScratch(lang, code))
      }
    } finally {
      setBusy(false)
    }
  }

  const markDone = async () => {
    if (!challenge) return
    onUpdate(await window.copilot.markChallenge(challenge.id))
    playFinish()
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!busy && (kind === 'resuelve' || kind === 'bug')) void run()
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = e.currentTarget
      const s = el.selectionStart
      setCode(code.slice(0, s) + '  ' + code.slice(el.selectionEnd))
      requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2))
    }
  }

  const activeLang: Lang = challenge && challenge.language !== 'css' ? (challenge.language as Lang) : lang
  const solved = challenge ? !!view.progress.challenges[challenge.id] : false
  const justSolved = kind === 'resuelve' || kind === 'bug' ? !!result?.ok : solved

  // Vista previa en vivo para los retos de CSS: el HTML es fijo y el alumno solo edita el CSS.
  const cssPreview = useMemo(() => {
    if (kind !== 'css' || !challenge) return ''
    return `<!doctype html><meta charset="utf-8"><style>body{margin:0;font-family:system-ui;padding:12px}${code}</style>${challenge.html ?? ''}`
  }, [kind, challenge, code])

  return (
    <div className="sandbox">
      <aside className="ch-list">
        <button className={`ch ${!challenge ? 'on' : ''}`} onClick={freePlay}>
          <b>🧪 Modo libre</b>
          <span className="muted-text">Prueba JavaScript o SQL sin reglas</span>
        </button>
        <h3>Retos</h3>
        {challenges.map((c) => {
          const b = KIND_BADGE[c.kind ?? 'resuelve']
          return (
            <button key={c.id} className={`ch ${challenge?.id === c.id ? 'on' : ''}`} onClick={() => openChallenge(c.id)}>
              <b>
                {view.progress.challenges[c.id] ? '✓ ' : ''}
                {c.emoji} {c.title}
              </b>
              <span className="muted-text">
                {b.cls ? `${b.label} · ` : ''}
                {AREA_LABELS[c.area]} · +{c.xp} XP
              </span>
            </button>
          )
        })}
      </aside>

      <section className="editor-pane">
        {challenge ? (
          <header className="ch-head">
            <div>
              <span className={`tag ${KIND_BADGE[kind].cls}`}>{KIND_BADGE[kind].label}</span>{' '}
              <span className="tag">{challenge.language === 'sql' ? 'SQL' : challenge.language === 'css' ? 'CSS' : 'JavaScript'}</span>
              {solved && <span className="tag good">Superado</span>}
              <h2>
                {challenge.emoji} {challenge.title}
              </h2>
            </div>
          </header>
        ) : (
          <header className="ch-head">
            <div className="segmented">
              {(['javascript', 'sql'] as Lang[]).map((l) => (
                <button
                  key={l}
                  className={lang === l ? 'on' : ''}
                  onClick={() => {
                    setLang(l)
                    setCode(l === 'sql' ? DEFAULT_SQL : DEFAULT_JS)
                    setResult(null)
                  }}
                >
                  {l === 'sql' ? 'SQL' : 'JavaScript'}
                </button>
              ))}
            </div>
          </header>
        )}

        {challenge && (
          <p className="ch-prompt">
            <InlineCode text={challenge.prompt} />
          </p>
        )}

        {/* EXPLICA: código a leer (solo lectura) + tu explicación */}
        {kind === 'explica' && challenge ? (
          <>
            <pre className="code-static">
              <code>{highlight(challenge.starter + '\n', 'javascript')}</code>
            </pre>
            <textarea
              className="explain-input"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Explica con tus palabras qué hace este código y cómo…"
              rows={5}
              spellCheck={false}
            />
            <div className="editor-actions">
              <button className="primary" onClick={() => setRevealed(true)} disabled={!explanation.trim()}>
                Ver los puntos clave
              </button>
              <button onClick={() => onAskTutor(`Escribí esta explicación de un código y quiero que me digas si es correcta y qué se me escapó:\n\nCódigo:\n\n\`\`\`js\n${challenge.starter}\n\`\`\`\n\nMi explicación:\n${explanation || '(todavía nada)'}`)}>
                Pedir opinión a XARA
              </button>
            </div>
            {revealed && (
              <div className="explain-points">
                <b>Una buena explicación menciona:</b>
                <ul>
                  {challenge.explainPoints?.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
                {!solved && (
                  <button className="primary" onClick={markDone}>
                    Lo entendí, marcar como logrado (+{challenge.xp} XP)
                  </button>
                )}
              </div>
            )}
          </>
        ) : kind === 'css' && challenge ? (
          <>
            <div className="css-model">
              <b>🎯 Objetivo</b>
              <p>{challenge.model}</p>
            </div>
            <div className="css-split">
              <div className="editor css-editor">
                <pre aria-hidden className="editor-view">
                  <code>{highlight(code + '\n', 'css')}</code>
                </pre>
                <textarea ref={taRef} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onKey} spellCheck={false} wrap="off" />
              </div>
              <iframe className="css-preview" title="Vista previa" sandbox="" srcDoc={cssPreview} />
            </div>
            <div className="editor-actions">
              {!solved && (
                <button className="primary" onClick={markDone}>
                  Quedó como el modelo (+{challenge.xp} XP)
                </button>
              )}
              <button onClick={() => setCode(challenge.solution)}>Ver una solución</button>
              <button onClick={() => onAskTutor(`Estoy corrigiendo este CSS para que se vea así: "${challenge.model}".\n\nHTML:\n\`\`\`html\n${challenge.html}\n\`\`\`\n\nMi CSS:\n\`\`\`css\n${code}\n\`\`\`\n\n¿Qué me falta o mejorarías?`)}>
                Pedir revisión a XARA
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="editor">
              <pre aria-hidden className="editor-view">
                <code>{highlight(code + '\n', activeLang)}</code>
              </pre>
              <textarea ref={taRef} value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={onKey} spellCheck={false} wrap="off" />
            </div>

            <div className="editor-actions">
              <button className="primary" onClick={run} disabled={busy}>
                <Icon name="play" size={14} /> {busy ? 'Ejecutando…' : kind === 'bug' ? 'Probar mi arreglo' : 'Ejecutar'} <kbd>Ctrl+⏎</kbd>
              </button>
              {challenge && (
                <>
                  <button onClick={() => setHint((h) => Math.min(h + 1, challenge.hints.length))} disabled={hint >= challenge.hints.length}>
                    Pista ({hint}/{challenge.hints.length})
                  </button>
                  <button
                    onClick={() =>
                      onAskTutor(
                        `Estoy con este reto de código:\n\n${challenge.prompt}\n\nMi intento:\n\n\`\`\`${activeLang}\n${code}\n\`\`\`\n\nNo me des la solución entera, guíame.`
                      )
                    }
                  >
                    Pedir ayuda a XARA
                  </button>
                </>
              )}
            </div>

            {challenge && hint > 0 && (
              <ul className="hints">
                {challenge.hints.slice(0, hint).map((h, i) => (
                  <li key={i}>💡 {h}</li>
                ))}
              </ul>
            )}

            {result && (
              <div className={`run-result ${result.ok ? 'ok' : 'fail'}`}>
                {result.error ? (
                  <pre className="run-error">{result.error}</pre>
                ) : (
                  <>
                    {challenge && <b>{result.ok ? `¡Correcto! ${result.passed}/${result.total} pruebas` : `${result.passed}/${result.total} pruebas pasan`}</b>}
                    {result.logs?.length ? <pre className="run-logs">{result.logs.join('\n')}</pre> : null}
                    {result.tests.map((t, i) => (
                      <div key={i} className={`test ${t.passed ? 'pass' : 'no'}`}>
                        <span>
                          {t.passed ? '✓' : '✕'} {t.name}
                        </span>
                        {t.gotGrid ? (
                          <div className="grid-result">
                            <div>
                              <span className="grid-label">Tu resultado</span>
                              <ResultGrid grid={t.gotGrid} />
                            </div>
                            {!t.passed && t.expectedGrid && (
                              <div>
                                <span className="grid-label">Se esperaba</span>
                                <ResultGrid grid={t.expectedGrid} />
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            {!t.passed && (
                              <pre>
                                esperado: {t.expected}
                                {'\n'}obtenido: {t.got}
                              </pre>
                            )}
                            {t.passed && !challenge && <pre>{t.got}</pre>}
                          </>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* Análisis estilo chess.com: se revela al resolver el reto */}
        {challenge?.analysis && justSolved && (
          <div className="analysis-box">
            <b>🧠 Análisis de XARA</b>
            <p>{challenge.analysis}</p>
          </div>
        )}
      </section>
    </div>
  )
}

/** Muestra el resultado de una consulta SQL como una tabla real (no texto con barras). */
function ResultGrid({ grid }: { grid: Grid }) {
  if (!grid.columns.length) return <p className="grid-empty">(sin filas)</p>
  return (
    <div className="grid-scroll">
      <table className="sql-grid">
        <thead>
          <tr>
            {grid.columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.length === 0 ? (
            <tr>
              <td className="grid-empty" colSpan={grid.columns.length}>
                (0 filas)
              </td>
            </tr>
          ) : (
            grid.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell === null ? <span className="grid-null">NULL</span> : String(cell)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
