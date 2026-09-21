import { SCHEDULE } from '../schedule.js'

const DAY_MS = 24 * 60 * 60 * 1000

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Convierte "07:00" de un bloque en una fecha real sobre el día dado. */
function blockDate(block, day, which = 'start') {
  const [h, m] = block[which].split(':').map(Number)
  const d = new Date(day)
  d.setHours(h, m, 0, 0)
  return d
}

/** Los bloques del día de la fecha dada, ordenados por hora de inicio. */
export function todayBlocks(date = new Date()) {
  return SCHEDULE.filter((b) => b.day === date.getDay()).sort(
    (a, b) => toMinutes(a.start) - toMinutes(b.start)
  )
}

/** 'pasado' | 'enCurso' | 'porVenir' — sin tolerancia, es solo visual. */
export function blockState(block, date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes()
  if (minutes < toMinutes(block.start)) return 'porVenir'
  if (minutes > toMinutes(block.end)) return 'pasado'
  return 'enCurso'
}

/** Qué tan avanzado va el bloque, de 0 a 1. */
export function blockProgress(block, date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60
  const start = toMinutes(block.start)
  const end = toMinutes(block.end)
  if (end === start) return 0
  return Math.min(1, Math.max(0, (minutes - start) / (end - start)))
}

/** Minutos que faltan para que termine el bloque en curso. */
export function minutesLeft(block, date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes()
  return Math.max(0, toMinutes(block.end) - minutes)
}

/**
 * La siguiente clase a partir de ahora, buscando hasta una semana hacia
 * adelante. Devuelve null si el horario está vacío.
 */
export function nextBlock(date = new Date()) {
  for (let offset = 0; offset <= 7; offset++) {
    const day = new Date(startOfDay(date).getTime() + offset * DAY_MS)
    const blocks = SCHEDULE.filter((b) => b.day === day.getDay()).sort(
      (a, b) => toMinutes(a.start) - toMinutes(b.start)
    )
    for (const block of blocks) {
      const when = blockDate(block, day)
      if (when > date) return { block, when }
    }
  }
  return null
}

/** "en 25 min", "en 3 h 10 min", "en 2 días" */
export function formatUntil(when, now = new Date()) {
  const totalMin = Math.round((when - now) / 60000)
  if (totalMin < 1) return 'ahora'
  if (totalMin < 60) return `en ${totalMin} min`

  const hours = Math.floor(totalMin / 60)
  if (hours < 24) {
    const rest = totalMin % 60
    return rest ? `en ${hours} h ${rest} min` : `en ${hours} h`
  }

  const days = Math.round(hours / 24)
  return days === 1 ? 'mañana' : `en ${days} días`
}
