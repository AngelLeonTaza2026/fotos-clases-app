import { COURSES } from '../schedule.js'

// Cada curso recibe un color propio, asignado por su posición en COURSES.
// Al ser automático, agregar un curso nuevo a schedule.js no obliga a tocar
// este archivo: simplemente toma el siguiente color de la paleta.
const PALETTE = [
  { accent: '#fbbf24', name: 'ámbar' },
  { accent: '#a78bfa', name: 'violeta' },
  { accent: '#38bdf8', name: 'celeste' },
  { accent: '#34d399', name: 'esmeralda' },
  { accent: '#fb7185', name: 'rosa' },
  { accent: '#f97316', name: 'naranja' },
]

export function courseTheme(course) {
  const i = COURSES.indexOf(course)
  return PALETTE[(i < 0 ? 0 : i) % PALETTE.length]
}

/** Devuelve el color con transparencia, para fondos y bordes suaves. */
export function withAlpha(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
