import { SCHEDULE, TOLERANCE_MINUTES } from '../schedule.js'

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Busca el bloque de horario que corresponde a una fecha/hora dada.
 * Aplica una tolerancia de TOLERANCE_MINUTES antes/después de cada bloque.
 * Devuelve el bloque encontrado, o null si la foto no cae en ningún curso.
 * Si hay más de un bloque que calza (no debería pasar con este horario,
 * pero por seguridad), devuelve el primero.
 */
export function matchSchedule(date = new Date()) {
  const day = date.getDay()
  const minutes = date.getHours() * 60 + date.getMinutes()

  const candidates = SCHEDULE.filter((block) => {
    if (block.day !== day) return false
    const start = toMinutes(block.start) - TOLERANCE_MINUTES
    const end = toMinutes(block.end) + TOLERANCE_MINUTES
    return minutes >= start && minutes <= end
  })

  return candidates[0] || null
}
