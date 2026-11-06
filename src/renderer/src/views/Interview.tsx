import { useState } from 'react'
import { AREA_LABELS } from '../../../core/academy/level'
import type { Area, InterviewQuestion, InterviewReport } from '../../../core/academy/types'
import type { AcademyView } from '../../../main/academy'
import { Loading } from '../components/Loading'
import './Interview.css'

const GRADING_TIPS = [
  'XARA está leyendo tus respuestas como un entrevistador con experiencia.',
  'Valora que expliques tu razonamiento, no solo que digas la respuesta.',
  'En tu informe verás qué cubriste bien, qué faltó y un veredicto honesto.',
  'Equivocarse en una entrevista de práctica es justo para lo que sirve.'
]

interface Props {
  view: AcademyView
  onUpdate: (view: AcademyView) => void
  autoStart?: boolean
}

const AREAS: (Area | 'mixta')[] = ['mixta', 'fundamentos', 'frontend', 'backend', 'datos', 'calidad', 'seguridad', 'devops', 'ia']
const KIND: Record<InterviewQuestion['kind'], string> = { tecnica: 'Técnica', conductual: 'Conductual', diseno: 'Diseño', codigo: 'Código' }

export function Interview({ view, onUpdate, autoStart }: Props) {
  const [stage, setStage] = useState<'setup' | 'doing' | 'report'>(autoStart ? 'setup' : 'setup')
  const [area, setArea] = useState<Area | 'mixta'>('mixta')
  const [questions, setQuestions] = useState<InterviewQuestion[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [idx, setIdx] = useState(0)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<InterviewReport | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const start = async () => {
    setBusy(true)
    try {
      const qs = await window.copilot.interviewStart(area, 5)
      setQuestions(qs)
      setAnswers(qs.map(() => ''))
      setIdx(0)
      setStage('doing')
    } finally {
      setBusy(false)
    }
  }

  const finish = async () => {
    setBusy(true)
    setNotice(null)
    try {
      const res = await window.copilot.interviewGrade(questions.map((q, i) => ({ id: q.id, answer: answers[i] })))
      setReport(res.interview)
      setNotice(res.notice ?? null)
      setStage('report')
      onUpdate(res)
    } finally {
      setBusy(false)
    }
  }

  if (stage === 'setup') {
    return (
      <div className="interview setup">
        <h2>🎤 Simulador de entrevista</h2>
        <p className="muted-text">
          Cinco preguntas como en una entrevista real de 2026. Responde con tus palabras, sin prisa. Al final XARA te da una nota, qué cubriste, qué faltó y un veredicto honesto.
        </p>
        <label className="field">
          <span>Área</span>
          <select value={area} onChange={(e) => setArea(e.target.value as Area | 'mixta')}>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a === 'mixta' ? 'Mixta (de todo)' : AREA_LABELS[a]}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" onClick={start} disabled={busy}>
          {busy ? 'Preparando…' : 'Empezar entrevista'}
        </button>
        {view.progress.interviews.length > 0 && (
          <p className="muted-text">Entrevistas hechas: {view.progress.interviews.length} · mejor nota {Math.max(...view.progress.interviews.map((i) => i.score))}/100</p>
        )}
      </div>
    )
  }

  if (stage === 'doing' && busy) {
    return (
      <div className="interview">
        <Loading message="XARA está evaluando tu entrevista…" tips={GRADING_TIPS} />
      </div>
    )
  }

  if (stage === 'doing') {
    const q = questions[idx]
    const last = idx === questions.length - 1
    return (
      <div className="interview doing">
        <div className="iv-progress">
          Pregunta {idx + 1} de {questions.length}
          <span className="iv-dots">
            {questions.map((_, i) => (
              <i key={i} className={i <= idx ? 'on' : ''} />
            ))}
          </span>
        </div>
        <div className="iv-card">
          <span className="tag">{KIND[q.kind]}</span> <span className="tag">{AREA_LABELS[q.area]}</span>
          <h3>{q.question}</h3>
          <textarea
            autoFocus
            value={answers[idx]}
            onChange={(e) => setAnswers((a) => a.map((v, i) => (i === idx ? e.target.value : v)))}
            placeholder="Responde como lo harías en voz alta…"
            rows={7}
          />
        </div>
        <div className="iv-nav">
          <button disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>
            Anterior
          </button>
          {last ? (
            <button className="primary" onClick={finish} disabled={busy}>
              {busy ? 'Corrigiendo…' : 'Terminar y ver mi informe'}
            </button>
          ) : (
            <button className="primary" onClick={() => setIdx((i) => i + 1)}>
              Siguiente
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="interview report">
      <div className="iv-score" data-pass={report!.score >= 70}>
        <b>{report!.score}</b>
        <span>/100</span>
      </div>
      <p className="iv-verdict">{report!.verdict}</p>
      {notice && <p className="muted-text">{notice}</p>}
      {report!.grades.map((g, i) => {
        const q = questions.find((x) => x.id === g.questionId)
        return (
          <details key={g.questionId} className="iv-grade" open={i === 0}>
            <summary>
              <span className={`g-score ${g.score >= 70 ? 'ok' : g.score >= 40 ? 'mid' : 'low'}`}>{g.score}</span>
              {q?.question}
            </summary>
            <p>{g.feedback}</p>
            {g.covered.length > 0 && <p className="muted-text">✅ Cubriste: {g.covered.join(', ')}</p>}
            {g.missing.length > 0 && <p className="muted-text">➕ Faltó: {g.missing.join(', ')}</p>}
            {q && <p className="muted-text">↪ Repregunta típica: {q.followUp}</p>}
          </details>
        )
      })}
      <button className="primary" onClick={() => setStage('setup')}>
        Otra entrevista
      </button>
    </div>
  )
}
