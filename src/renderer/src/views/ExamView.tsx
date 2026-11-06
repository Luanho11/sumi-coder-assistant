import { useState } from 'react'
import { findTrack, moduleExtra } from '../../../core/academy/catalog'
import type { AcademyView, ExamResult } from '../../../main/academy'
import { InlineCode } from '../components/Markdown'
import { playFinish } from '../feedback'
import './ExamView.css'

interface Props {
  trackId: string
  moduleId: string
  onBack: () => void
  onUpdate: (view: AcademyView) => void
}

export function ExamView({ trackId, moduleId, onBack, onUpdate }: Props) {
  const track = findTrack(trackId)
  const module = track?.modules.find((m) => m.id === moduleId)
  const extra = moduleExtra(moduleId)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [result, setResult] = useState<{ score: number; correct: number; total: number; results: ExamResult[] } | null>(null)
  const [busy, setBusy] = useState(false)

  if (!track || !module || !extra) return null
  const questions = extra.exam
  const allAnswered = questions.every((_, i) => answers[i] !== undefined)

  const submit = async () => {
    setBusy(true)
    try {
      const res = await window.copilot.submitExam(moduleId, questions.map((_, i) => answers[i] ?? -1))
      setResult(res)
      onUpdate(res)
      playFinish()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="exam-view">
      <button className="back" onClick={onBack}>
        ‹ Academia
      </button>
      <span className="tag">{module.title}</span>
      <h2>
        {extra.emoji} Examen del módulo
      </h2>
      {!result && <p className="muted-text">Responde las {questions.length} preguntas y pulsa Corregir. Necesitas 70 para aprobarlo.</p>}

      {result && (
        <div className={`exam-score ${result.score >= 70 ? 'pass' : 'fail'}`}>
          <b>{result.score}/100</b>
          <span>
            {result.correct} de {result.total} correctas · {result.score >= 70 ? '¡Aprobado! 🎉' : 'Repásalo y vuelve a intentarlo'}
          </span>
        </div>
      )}

      <ol className="exam-q-list">
        {questions.map((q, qi) => {
          const picked = answers[qi]
          const res = result?.results[qi]
          return (
            <li key={qi}>
              <p className="exam-q">
                <InlineCode text={q.question} />
              </p>
              <div className="quiz-options">
                {q.options.map((o, i) => {
                  let cls = picked === i ? 'sel' : ''
                  if (res) cls = i === res.correctIndex ? 'right fb-correct' : i === picked ? 'wrong fb-wrong' : ''
                  return (
                    <button key={o} className={cls} disabled={!!result} onClick={() => setAnswers((a) => ({ ...a, [qi]: i }))}>
                      <InlineCode text={o} />
                    </button>
                  )
                })}
              </div>
              {res && (
                <p className="muted-text">
                  <InlineCode text={res.explanation} />
                </p>
              )}
            </li>
          )
        })}
      </ol>

      {!result ? (
        <button className="primary" disabled={!allAnswered || busy} onClick={submit}>
          {busy ? 'Corrigiendo…' : allAnswered ? 'Corregir examen' : `Responde todas (${Object.keys(answers).length}/${questions.length})`}
        </button>
      ) : (
        <div className="exam-actions">
          <button
            onClick={() => {
              setResult(null)
              setAnswers({})
            }}
          >
            Intentar de nuevo
          </button>
          <button className="primary" onClick={onBack}>
            Volver a la academia
          </button>
        </div>
      )}
    </div>
  )
}
