import { describe, expect, it } from 'vitest'
import { catalog, findExercise, stepsFor } from '../src/core/academy/catalog'
import { buildEvaluationMessage, extractJson, offlineEvaluation, parseEvaluation, parsePractical } from '../src/core/academy/evaluation'
import { computeLevel, effectiveScore, recommendNext } from '../src/core/academy/level'
import { PLACEMENT_BANK } from '../src/core/academy/placement-bank'
import { nextLesson } from '../src/core/academy/route'
import {
  areaLevel,
  buildPlacement,
  gradeAnswer,
  nextDifficulty,
  nextQuestion,
  PLACEMENT_POOL,
  QUESTIONS_PER_AREA,
  startModule
} from '../src/core/academy/placement'
import type { AcademyProgress, Attempt, Evaluation } from '../src/core/academy/types'

const empty = (): AcademyProgress => ({
  attempts: [],
  drafts: {},
  lessonsDone: [],
  challenges: {},
  exams: {},
  interviews: [],
  activity: []
})

function evaluation(score: number, level: Evaluation['level'] = score >= 70 ? 'bien_hecho' : 'parcial'): Evaluation {
  return {
    level,
    score,
    criteria: [],
    errorTypes: [],
    strengths: [],
    improve: [],
    nextStep: '',
    mode: 'ia'
  }
}

function attempt(exerciseId: string, score: number, at = '2026-10-01T10:00:00Z', extra: Partial<Attempt> = {}): Attempt {
  return {
    exerciseId,
    at,
    evaluation: evaluation(score),
    hintsUsed: 0,
    confidence: 3,
    ...extra
  }
}

describe('catálogo', () => {
  it('une la ruta de IA y las rutas del proyecto base sin ids repetidos', () => {
    expect(catalog.tracks[0].id).toBe('ingenieria-ia')
    expect(catalog.tracks.length).toBe(21)
    const ids = catalog.exercises.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('cada ejercicio apunta a una clase que lo lista', () => {
    const lessons = new Map(catalog.tracks.flatMap((t) => t.modules.flatMap((m) => m.lessons.map((l) => [l.id, l]))))
    for (const e of catalog.exercises) expect(lessons.get(e.lessonId)?.exerciseIds).toContain(e.id)
  })

  it('los ejercicios propios tienen pistas en 5 peldaños, criterios y recursos', () => {
    for (const e of catalog.exercises.filter((x) => x.trackId === 'ingenieria-ia')) {
      expect(e.hints).toHaveLength(5)
      expect(e.criteria.length).toBeGreaterThanOrEqual(4)
      expect(e.resources.length).toBeGreaterThan(0)
      for (const r of e.resources) expect(r.url).toMatch(/^https:\/\//)
    }
  })

  it('genera cinco pasos guiados cuando el ejercicio no trae los suyos', () => {
    const base = catalog.exercises.find((e) => e.trackId === 'react' && !e.steps)!
    const steps = stepsFor(base)
    expect(steps.map((s) => s.id)).toEqual(['entender', 'plan', 'construir', 'verificar', 'defender'])
    if (base.interviewQuestion) expect(steps[4].prompt).toContain(base.interviewQuestion)
  })
})

describe('examen de nivel', () => {
  it('el banco cubre cada área con dos preguntas por dificultad y respuestas válidas', () => {
    const areas = new Set(PLACEMENT_BANK.map((q) => q.area))
    expect(areas.size).toBe(9)
    for (const area of areas) {
      for (const d of ['principiante', 'intermedio', 'avanzado']) {
        expect(PLACEMENT_BANK.filter((q) => q.area === area && q.difficulty === d)).toHaveLength(2)
      }
    }
    for (const q of PLACEMENT_POOL) expect(q.options[q.correctIndex]).toBeDefined()
  })

  it('la respuesta correcta no cae siempre en la misma posición', () => {
    const positions = new Set(PLACEMENT_BANK.map((q) => q.correctIndex))
    expect(positions.size).toBeGreaterThanOrEqual(3)
  })

  it('escalera adaptativa: empieza en intermedio, sube al acertar y baja al fallar', () => {
    expect(nextDifficulty([])).toBe('intermedio')
    expect(nextDifficulty([{ area: 'backend', difficulty: 'intermedio', correct: true }])).toBe('avanzado')
    expect(nextDifficulty([{ area: 'backend', difficulty: 'intermedio', correct: false }])).toBe('principiante')
    expect(nextDifficulty([{ area: 'backend', difficulty: 'avanzado', correct: true }])).toBe('avanzado')
  })

  it('hace tres preguntas por área sin repetir y luego termina', () => {
    const answers: { questionId: string; choice: number }[] = []
    for (let i = 0; i < QUESTIONS_PER_AREA; i++) {
      const q = nextQuestion('datos', answers)!
      expect(answers.some((a) => a.questionId === q.id)).toBe(false)
      answers.push({ questionId: q.id, choice: q.correctIndex })
    }
    expect(nextQuestion('datos', answers)).toBeNull()
    expect(answers.map((a) => PLACEMENT_POOL.find((q) => q.id === a.questionId)!.difficulty)).toEqual(['intermedio', 'avanzado', 'avanzado'])
  })

  it('calcula el nivel del área con la evidencia de cada dificultad', () => {
    expect(
      areaLevel([
        { area: 'ia', difficulty: 'intermedio', correct: true },
        { area: 'ia', difficulty: 'avanzado', correct: true }
      ])
    ).toBe('avanzado')
    expect(
      areaLevel([
        { area: 'ia', difficulty: 'intermedio', correct: true },
        { area: 'ia', difficulty: 'avanzado', correct: false }
      ])
    ).toBe('intermedio')
    expect(
      areaLevel([
        { area: 'ia', difficulty: 'intermedio', correct: false },
        { area: 'ia', difficulty: 'principiante', correct: true }
      ])
    ).toBe('principiante')
  })

  it('un examen perfecto no pasa de semi-senior y recomienda la ruta de IA y las áreas flojas', () => {
    const perfect = PLACEMENT_BANK.filter((q) => q.difficulty !== 'principiante').map((q) => ({ questionId: q.id, choice: q.correctIndex }))
    const result = buildPlacement(perfect, { score: 100, summary: '', mode: 'ia' }, new Date('2026-10-24T00:00:00Z'))
    expect(result.overall).toBe('semi_senior')
    expect(result.recommendedTrackIds[0]).toBe('ingenieria-ia')

    const allWrong = PLACEMENT_BANK.map((q) => ({
      questionId: q.id,
      choice: (q.correctIndex + 1) % q.options.length
    }))
    const beginner = buildPlacement(allWrong, undefined)
    expect(beginner.overall).toBe('inicial')
    expect(beginner.recommendedTrackIds.slice(0, 2)).toEqual(['javascript', 'ingenieria-ia'])
    const firstLevels = beginner.recommendedTrackIds.map((id) => catalog.tracks.find((t) => t.id === id)!.modules[0].level)
    expect(firstLevels.every((l) => l === 'principiante')).toBe(true)
    // Aunque acierte alguna pregunta difícil de un área, quien empieza de cero va a la primera clase.
    const p = empty()
    p.placement = { ...beginner, areas: { ...beginner.areas, fundamentos: { correct: 1, total: 3, level: 'intermedio' } } }
    expect(nextLesson(p)?.lessonId).toBe(catalog.tracks.find((t) => t.id === 'javascript')!.modules[0].lessons[0].id)
  })

  it('ignora preguntas desconocidas y empieza la ruta en el módulo de su nivel', () => {
    expect(gradeAnswer({ questionId: 'no-existe', choice: 0 })).toBeUndefined()
    const react = catalog.tracks.find((t) => t.id === 'react')!
    expect(startModule(react, undefined)).toBe(react.modules[0].id)
    expect(react.modules.find((m) => m.id === startModule(react, 'intermedio'))?.level).toBe('intermedio')
  })
})

describe('nivel y recomendaciones', () => {
  it('las pistas y no poder defenderlo restan evidencia', () => {
    expect(effectiveScore(attempt('xa-1-1', 90, undefined, { hintsUsed: 3 }))).toBe(80)
    expect(
      effectiveScore({
        ...attempt('xa-1-1', 90),
        evaluation: evaluation(90, 'no_defendible')
      })
    ).toBe(40)
  })

  it('sin intentos ni examen el nivel es inicial y explica qué falta', () => {
    const r = computeLevel(empty())
    expect(r.overall).toBe('inicial')
    expect(r.limitingFactor).toContain('Junior')
  })

  it('el examen da un punto de partida y los ejercicios bien hechos suman evidencia', () => {
    const p = empty()
    p.placement = {
      at: '',
      areas: { ia: { correct: 3, total: 3, level: 'intermedio' } },
      overall: 'junior',
      recommendedTrackIds: []
    }
    expect(computeLevel(p).areas.find((a) => a.area === 'ia')?.level).toBe('junior')
    expect(computeLevel(p).overall).toBe('junior')
    expect(computeLevel({ ...p, placement: { ...p.placement, overall: 'inicial' } }).overall).toBe('inicial')
    p.attempts = ['xa-3-1', 'xa-3-2', 'xa-4-1', 'xa-5-1'].map((id) => attempt(id, 90))
    const r = computeLevel(p)
    expect(r.areas[0].area).toBe('ia')
    expect(r.areas[0].level).toBe('junior_plus')
    expect(r.evidence).toHaveLength(4)
  })

  it('senior exige al menos tres ejercicios avanzados bien hechos', () => {
    const p = empty()
    p.attempts = catalog.exercises.filter((e) => e.trackId === 'ingenieria-ia' && e.difficulty !== 'avanzado').map((e) => attempt(e.id, 95))
    p.attempts.push(...['xa-5-1', 'xa-5-2'].map((id) => attempt(id, 95)))
    expect(computeLevel(p).areas[0].level).not.toBe('senior')
  })

  it('cuenta la calibración y marca para repaso lo suspendido hace más de un día', () => {
    const p = empty()
    p.attempts = [attempt('xa-1-1', 30, '2026-10-01T00:00:00Z', { confidence: 5 })]
    const r = computeLevel(p, new Date('2026-10-03T00:00:00Z'))
    expect(r.pendingReview).toEqual(['xa-1-1'])
    expect(r.calibration).toBe(0.7)
  })

  it('recomienda repasos primero, guiados si cuesta y retos si va muy bien', () => {
    const now = new Date('2026-10-10T00:00:00Z')
    const p = empty()
    expect(recommendNext(p, 'ingenieria-ia', now)?.exercise.id).toBe('xa-1-1')
    p.attempts = [attempt('xa-1-1', 20, '2026-10-01T00:00:00Z')]
    expect(recommendNext(p, 'ingenieria-ia', now)?.reason).toMatch(/Repaso/)
    p.attempts = [attempt('xa-1-1', 90, '2026-10-09T23:00:00Z'), attempt('xa-1-2', 95, '2026-10-09T23:30:00Z')]
    const flying = recommendNext(p, 'ingenieria-ia', now)!
    expect(flying.exercise.kind === 'reto' || flying.exercise.difficulty === 'avanzado').toBe(true)
  })
})

describe('evaluación', () => {
  const e = findExercise('xa-3-1')!

  it('el mensaje incluye criterios, política de IA, pistas usadas y las respuestas por paso', () => {
    const msg = buildEvaluationMessage(e, {
      answers: { construir: 'Inyección SQL en la consulta' },
      hintsShown: 2,
      updatedAt: ''
    })
    expect(msg).toContain('Detecta la inyección SQL')
    expect(msg).toContain('Sin IA')
    expect(msg).toContain('Pistas usadas por el alumno: 2')
    expect(msg).toContain('### Hallazgos\nInyección SQL en la consulta')
    expect(msg).toContain('### Leer\n(sin respuesta)')
  })

  it('lee el JSON aunque venga dentro de un bloque y descarta valores no válidos', () => {
    const text =
      '```json\n{"level":"parcial","score":"64.6","criteria":[{"criterion":"A","met":"quizá","evidence":"x"}],"errorTypes":["omision","inventado"],"strengths":["bien"],"improve":[],"nextStep":"Revisa la autorización"}\n```'
    const ev = parseEvaluation(text)!
    expect(ev).toMatchObject({
      level: 'parcial',
      score: 65,
      errorTypes: ['omision'],
      mode: 'ia'
    })
    expect(ev.criteria[0].met).toBe('no')
    expect(parseEvaluation('{"level":"genial","score":90}')).toBeUndefined()
    expect(extractJson('sin json')).toBeUndefined()
  })

  it('la estimación sin IA nunca aprueba y señala los pasos vacíos', () => {
    const draft = {
      answers: {
        construir:
          'Hay inyección SQL porque se concatena userId en la consulta: usar consultas parametrizadas. Falta autorización: el userId viene del cliente (IDOR). El bucle hace N+1 consultas: usar JOIN.',
        plan: 'Revisaré seguridad, autorización, rendimiento, manejo de errores y contrato del endpoint con paginación.'
      },
      hintsShown: 0,
      updatedAt: ''
    }
    const ev = offlineEvaluation(e, draft)
    expect(ev.mode).toBe('offline')
    expect(ev.score).toBeLessThan(70)
    expect(ev.level).not.toBe('bien_hecho')
    expect(ev.criteria.find((c) => c.criterion.includes('inyección'))?.met).toBe('si')
    expect(ev.errorTypes).toContain('omision')
    expect(
      offlineEvaluation(e, {
        answers: { construir: 'no sé' },
        hintsShown: 0,
        updatedAt: ''
      }).level
    ).toBe('falta_evidencia')
  })

  it('lee la nota de la parte práctica del examen', () => {
    expect(parsePractical('{"score":72,"summary":"Bien"}')).toEqual({
      score: 72,
      summary: 'Bien',
      mode: 'ia'
    })
    expect(parsePractical('nada')).toBeUndefined()
  })
})
