import { REVIEW_DAYS } from './constants'
import type { ProgressV2, ReviewState } from './types'

const DAY = 86_400_000

/** Al dominar una clase se programa su primer repaso a 1 día. */
export function scheduleReview(p: ProgressV2, lessonId: string, now = new Date()): void {
  if (!p.reviews[lessonId]) p.reviews[lessonId] = { stage: 0, dueAt: new Date(now.getTime() + REVIEW_DAYS[0] * DAY).toISOString() }
}

export function dueReviews(p: ProgressV2, now = new Date()): string[] {
  return Object.entries(p.reviews)
    .filter(([, r]) => new Date(r.dueAt).getTime() <= now.getTime())
    .map(([id]) => id)
}

/** Acierto: pasa a la siguiente etapa (o termina). Fallo: vuelve a empezar. Nunca bloquea nada. */
export function gradeReview(p: ProgressV2, lessonId: string, ok: boolean, now = new Date()): ReviewState | null {
  const r = p.reviews[lessonId]
  if (!r) return null
  const stage = ok ? r.stage + 1 : 0
  if (stage >= REVIEW_DAYS.length) {
    delete p.reviews[lessonId]
    return null
  }
  p.reviews[lessonId] = { stage, dueAt: new Date(now.getTime() + REVIEW_DAYS[stage] * DAY).toISOString() }
  return p.reviews[lessonId]
}
