import type { AiPolicy, ExerciseKind } from '../../core/academy/types'

export const KIND_LABELS: Record<ExerciseKind, string> = {
  guiado: 'Guiado',
  practica_autonoma: 'Práctica',
  reto: 'Reto',
  sintesis: 'Síntesis',
  aplicacion_real: 'Caso real',
  entrevista: 'Entrevista'
}

export const AI_POLICY_LABELS: Record<AiPolicy, string> = {
  sin_ia: 'Sin IA: demuestra que sabes hacerlo tú',
  ia_tutor: 'IA solo como tutor: pregunta dudas, la solución es tuya',
  ia_par: 'IA como compañera: puedes generar código, pero debes revisarlo, verificarlo y defenderlo'
}
