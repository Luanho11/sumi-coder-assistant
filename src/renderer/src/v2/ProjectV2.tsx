import { useState } from 'react'
import { findCourse } from '../../../core/academy/v2/courses'
import { rubricScore, type RubricGrade, type RubricLevel } from '../../../core/academy/v2/ai-hooks'
import type { AcademyView } from '../../../main/academy'
import { Markdown } from '../components/Markdown'
import { playFinish } from '../feedback'
import { GradeView } from './PracticeV2'
import './v2.css'

interface Props {
  courseId: string
  levelId: string
  view: AcademyView
  onBack: () => void
  onUpdate: (v: AcademyView) => void
}

export function ProjectV2({ courseId, levelId, view, onBack, onUpdate }: Props) {
  const course = findCourse(courseId)
  const level = course?.levels.find((l) => l.id === levelId)
  const key = `${courseId}:${levelId}`
  const done = view.progress.v2?.levels[key]
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [grade, setGrade] = useState<RubricGrade | null>(null)
  const [needsSelf, setNeedsSelf] = useState(false)
  const [levels, setLevels] = useState<RubricLevel[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  if (!course || !level) return null
  const p = level.project

  const send = async () => {
    setBusy(true)
    setMsg(null)
    try {
      const r = await window.copilot.v2.projectSubmit(courseId, levelId, text)
      onUpdate(r.view)
      setGrade(r.grade)
      if (r.needsSelfCheck) {
        setNeedsSelf(true)
        setLevels(p.rubric.map(() => 'parcial'))
      } else if (r.tooShort) setMsg('Describe tu entrega con más detalle: qué hiciste, cómo y con qué resultado.')
      if (r.passed) playFinish()
    } catch (e) {
      setMsg(String((e as Error).message).replace(/^Error invoking remote method '[^']+': Error: /, ''))
    } finally {
      setBusy(false)
    }
  }
  const self = async () => {
    setBusy(true)
    try {
      const r = await window.copilot.v2.projectSelfCheck(courseId, levelId, levels)
      onUpdate(r.view)
      setNeedsSelf(false)
      setMsg(r.passed ? `Proyecto aprobado de forma provisional (${r.score}).` : `Con ${r.score} todavía no llegas a ${p.passScore}. Mejora la entrega y vuelve a enviarla.`)
      if (r.passed) playFinish()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="x2-project" style={{ ['--track' as string]: course.color }}>
      <button className="back" onClick={onBack}>‹ {course.title}</button>
      <h2 className="x2-title">{p.title}</h2>
      {done?.projectPassedAt && <p className="x2-feedback">Proyecto aprobado{done.projectProvisional ? ' (provisional: se confirmará con la corrección de XARA)' : ''}. Nota: {done.projectScore}.</p>}
      <section className="x2-card"><Markdown text={p.brief} /></section>
      <section className="x2-card">
        <h3>Qué debes entregar</h3>
        <ul>{p.deliverables.map((d) => <li key={d}>{d}</li>)}</ul>
        {p.milestones.length > 0 && (<><h3>Por etapas</h3><ol>{p.milestones.map((m) => <li key={m.title}><b>{m.title}.</b> {m.tasks.join(' · ')}</li>)}</ol></>)}
        <h3>Cómo se valora</h3>
        <ul>{p.rubric.map((r) => <li key={r.criterion}><b>{r.criterion}</b> <span className="x2-muted">Bien: {r.levels.bien}</span></li>)}</ul>
        {p.portfolioEntry && <p className="x2-muted"><b>Para tu portafolio:</b> {p.portfolioEntry}</p>}
      </section>
      <section className="x2-card">
        <h3>Tu entrega</h3>
        <p className="x2-muted">Pega el enlace a tu repositorio y describe qué hiciste y cómo lo comprobaste, o pega tu documento.</p>
        <textarea className="x2-textarea big" rows={12} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="x2-row"><button className="x2-btn primary" disabled={busy || text.trim().length < 50} onClick={send}>{busy ? 'Revisando…' : 'Enviar el proyecto'}</button></div>
        {msg && <p className="x2-feedback">{msg}</p>}
        {grade && <GradeView grade={grade} />}
        {needsSelf && (
          <>
            <p>Sin conexión con la corrección de XARA: valora tu proyecto con la rúbrica. Quedará <b>provisional</b>.</p>
            <ul className="x2-rubric">
              {p.rubric.map((r, i) => (
                <li key={r.criterion}>
                  <b>{r.criterion}</b>
                  <div className="x2-seg">
                    {(['bien', 'parcial', 'falta'] as RubricLevel[]).map((l) => (
                      <button key={l} aria-pressed={levels[i] === l} onClick={() => setLevels((s) => s.map((x, k) => (k === i ? l : x)))}>{l === 'bien' ? 'Bien' : l === 'parcial' ? 'A medias' : 'Falta'}</button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <button className="x2-btn primary" disabled={busy} onClick={self}>Registrar mi valoración ({rubricScore(levels)})</button>
          </>
        )}
      </section>
    </div>
  )
}
