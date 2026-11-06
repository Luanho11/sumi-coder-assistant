import { useState } from 'react'
import { findCourse, findLessonV2, findModuleV2 } from '../../../core/academy/v2/courses'
import { gradeAnswers } from '../../../core/academy/v2/engine'
import type { Answer } from '../../../core/academy/v2/grading'
import { scoreAttempt } from '../../../core/academy/v2/grading'
import type { Item } from '../../../core/academy/v2/types'
import type { VoiceSettings } from '../../../core/types'
import type { AcademyView } from '../../../main/academy'
import { CourseV2, type Screen } from './CourseV2'
import { LessonPlayerV2 } from './LessonPlayerV2'
import { PracticeV2 } from './PracticeV2'
import { ProjectV2 } from './ProjectV2'
import { QuizFlowV2, type Outcome } from './QuizFlowV2'

interface Props {
  courseId: string
  initial?: Screen
  view: AcademyView
  voiceSettings: VoiceSettings
  onClose: () => void
  onUpdate: (v: AcademyView) => void
}

/** Contenedor de la academia v2: el mapa del curso y, encima, la clase, la práctica, el dominio, los exámenes y el proyecto. */
export function V2Shell({ courseId, initial, view, voiceSettings, onClose, onUpdate }: Props) {
  const [screen, setScreen] = useState<Screen>(initial ?? { kind: 'map' })
  const course = findCourse(courseId)
  if (!course) return null
  const map = () => setScreen({ kind: 'map' })

  if (screen.kind === 'map')
    return <CourseV2 courseId={courseId} view={view} onOpen={setScreen} onClose={onClose} />

  if (screen.kind === 'lesson')
    return (
      <LessonPlayerV2
        key={`${screen.lessonId}-${screen.partId ?? ''}`}
        lessonId={screen.lessonId}
        startPartId={screen.partId}
        view={view}
        voiceSettings={voiceSettings}
        onBack={map}
        onUpdate={onUpdate}
        onPractice={() => setScreen({ kind: 'practice', lessonId: screen.lessonId, tier: 'A' })}
      />
    )

  if (screen.kind === 'practice')
    return (
      <PracticeV2
        key={`${screen.lessonId}-${screen.tier}`}
        lessonId={screen.lessonId}
        tier={screen.tier}
        view={view}
        voiceSettings={voiceSettings}
        onBack={() => setScreen({ kind: 'lesson', lessonId: screen.lessonId })}
        onUpdate={onUpdate}
        onOpenPart={(partId) => setScreen({ kind: 'lesson', lessonId: screen.lessonId, partId })}
        onTier={(tier) => setScreen({ kind: 'practice', lessonId: screen.lessonId, tier })}
        onMastery={() => setScreen({ kind: 'mastery', lessonId: screen.lessonId })}
      />
    )

  if (screen.kind === 'mastery') {
    const ref = findLessonV2(screen.lessonId)
    if (!ref) return null
    const objectives = Object.fromEntries(ref.lesson.objectives.map((o) => [o.id, o.text.replace(/^Podrás /, '')]))
    return (
      <QuizFlowV2
        key={`m-${screen.lessonId}`}
        title={`Comprobación de la clase: ${ref.lesson.title}`}
        intro="Preguntas sobre lo que escuchaste y practicaste. Se aprueba con 80 %. Si falla algo, te decimos qué parte repasar."
        color={course.color}
        passPct={80}
        load={async () => ({ items: await window.copilot.v2.masteryStart(screen.lessonId) })}
        submit={async (items, answers, external) => (await window.copilot.v2.masterySubmit(screen.lessonId, items.map((i) => i.id), answers, external)) as Outcome}
        objectives={objectives}
        onBack={() => setScreen({ kind: 'practice', lessonId: screen.lessonId, tier: 'C' })}
        onUpdate={onUpdate}
        onOpenPart={(partId) => setScreen({ kind: 'lesson', lessonId: screen.lessonId, partId })}
        doneLabel="Volver al mapa del curso"
        onDone={map}
      />
    )
  }

  if (screen.kind === 'moduleExam') {
    const f = findModuleV2(screen.moduleId)
    if (!f) return null
    const objectives = Object.fromEntries(f.module.lessons.flatMap((l) => l.objectives.map((o) => [o.id, `${l.title}: ${o.text.replace(/^Podrás /, '')}`])))
    return (
      <QuizFlowV2
        key={`e-${screen.moduleId}`}
        title={`Examen del módulo «${f.module.title}»`}
        intro={`Preguntas mezcladas de todo el módulo, sorteadas de un banco. Se aprueba con ${f.module.exam.passPct} % sin bajar de ${f.module.exam.minPerObjectivePct} % en ningún objetivo. Si ya dominas el tema, aprobarlo da por dominadas las clases del módulo.`}
        color={course.color}
        passPct={f.module.exam.passPct}
        load={() => window.copilot.v2.examStart('module', screen.moduleId)}
        submit={async (items, answers, external, written) => (await window.copilot.v2.examSubmit('module', screen.moduleId, items.map((i) => i.id), answers, external, written)) as Outcome}
        objectives={objectives}
        onBack={map}
        onUpdate={onUpdate}
        doneLabel="Volver al mapa del curso"
        onDone={map}
      />
    )
  }

  if (screen.kind === 'levelExam') {
    const level = course.levels.find((l) => l.id === screen.levelId)
    if (!level) return null
    const id = `${course.id}:${level.id}`
    const objectives = Object.fromEntries(level.modules.flatMap((m) => m.lessons.flatMap((l) => l.objectives.map((o) => [o.id, `${l.title}: ${o.text.replace(/^Podrás /, '')}`]))))
    return (
      <QuizFlowV2
        key={`le-${id}`}
        title={`Examen del nivel ${level.id}`}
        intro={`Preguntas de todo el nivel y tareas escritas. Se aprueba con ${level.exam.passPct} % sin bajar de ${level.exam.minPerObjectivePct} % en ningún objetivo, y con las tareas escritas aprobadas. Si ya dominas el nivel, aprobarlo da por dominadas sus clases y módulos.`}
        color={course.color}
        passPct={level.exam.passPct}
        load={() => window.copilot.v2.examStart('level', id)}
        submit={async (items, answers, external, written) => (await window.copilot.v2.examSubmit('level', id, items.map((i) => i.id), answers, external, written)) as Outcome}
        objectives={objectives}
        onBack={map}
        onUpdate={onUpdate}
        doneLabel="Ir al proyecto del nivel"
        onDone={() => setScreen({ kind: 'project', levelId: level.id })}
      />
    )
  }

  if (screen.kind === 'project') return <ProjectV2 courseId={courseId} levelId={screen.levelId} view={view} onBack={map} onUpdate={onUpdate} />

  // Preguntas de entrada de un nivel y repaso espaciado: se corrigen aquí, sin compuerta.
  const local = (items: Item[], answers: Record<string, Answer>, external: Record<string, boolean>) => {
    const results = gradeAnswers(items, answers, external)
    return { results, report: scoreAttempt(items, results.map((r) => r.ok)) }
  }
  if (screen.kind === 'entry') {
    const level = course.levels.find((l) => l.id === screen.levelId)
    if (!level) return null
    return (
      <QuizFlowV2
        key={`en-${level.id}`}
        title={`Diagnóstico de entrada: nivel ${level.id}`}
        intro="Estas preguntas no cuentan para nada. Sirven para saber si te falta algún punto de partida del nivel anterior."
        color={course.color}
        passPct={80}
        informative
        load={async () => ({ items: level.entryCheck ?? [] })}
        submit={async (items, answers, external) => {
          const v = await window.copilot.v2.entryDone(courseId, level.id)
          const r = local(items, answers, external)
          return { ...r, passed: r.report.pct >= 80, view: v }
        }}
        objectives={{}}
        onBack={map}
        onUpdate={onUpdate}
        doneLabel="Volver al mapa del curso"
        onDone={map}
      />
    )
  }

  const ref = findLessonV2(screen.lessonId)
  if (!ref) return null
  return (
    <QuizFlowV2
      key={`r-${screen.lessonId}`}
      title={`Repaso: ${ref.lesson.title}`}
      intro="Unas pocas preguntas sobre una clase que ya dominas. Si fallas, se repite pronto; si aciertas, se espacia más."
      color={course.color}
      passPct={80}
      informative
      load={async () => ({ items: ref.lesson.review })}
      submit={async (items, answers, external) => {
        const r = local(items, answers, external)
        const v = await window.copilot.v2.reviewSubmit(screen.lessonId, r.report.pct >= 80)
        return { ...r, passed: r.report.pct >= 80, view: v }
      }}
      objectives={Object.fromEntries(ref.lesson.objectives.map((o) => [o.id, o.text.replace(/^Podrás /, '')]))}
      onBack={map}
      onUpdate={onUpdate}
      doneLabel="Volver al mapa del curso"
      onDone={map}
    />
  )
}
