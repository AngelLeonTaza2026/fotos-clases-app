import { SEMESTER_START, TOTAL_WEEKS } from '../schedule.js'

const DAY_MS = 24 * 60 * 60 * 1000

// Devuelve la medianoche local de una fecha, para poder restar
// fechas en días completos sin que la hora del día afecte el cálculo.
function atMidnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * Calcula a qué semana del ciclo (1 a TOTAL_WEEKS) corresponde una fecha.
 * Devuelve null si la fecha es anterior al inicio del ciclo o posterior
 * a la semana 16 (fuera de rango).
 */
export function getWeekNumber(date = new Date()) {
  const start = new Date(SEMESTER_START + 'T00:00:00')
  const diffDays = Math.floor((atMidnight(date) - atMidnight(start)) / DAY_MS)

  if (diffDays < 0) return null

  const week = Math.floor(diffDays / 7) + 1
  if (week > TOTAL_WEEKS) return null

  return week
}
