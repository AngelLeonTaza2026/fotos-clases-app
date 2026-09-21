// ============================================================
// CONFIGURACIÓN DEL CICLO ACADÉMICO
// Si el horario cambia, solo hay que editar este archivo.
// ============================================================

// Lunes de la semana 1 del ciclo (formato YYYY-MM-DD)
export const SEMESTER_START = '2026-08-17'

// Número total de semanas del ciclo
export const TOTAL_WEEKS = 16

// Minutos de tolerancia antes/después de un bloque para seguir
// contando como "dentro" de esa clase (por si tomas la foto un
// poco antes de que empiece o después de que termine).
export const TOLERANCE_MINUTES = 20

// day: 0 = Domingo, 1 = Lunes, 2 = Martes, 3 = Miércoles,
//      4 = Jueves, 5 = Viernes, 6 = Sábado
// (mismo criterio que usa JavaScript en Date.getDay())
export const SCHEDULE = [
  { day: 2, course: 'Arquitectura Empresarial', nrc: '47070', start: '07:00', end: '08:29' },
  { day: 2, course: 'Arquitectura Empresarial', nrc: '47070', start: '08:40', end: '10:09' },
  { day: 2, course: 'Taller de Investigación 2', nrc: '30135', start: '17:20', end: '18:49' },
  { day: 2, course: 'Taller de Investigación 2', nrc: '30136', start: '19:00', end: '21:59' },

  { day: 3, course: 'Taller de Proyectos 2', nrc: '30139', start: '14:00', end: '15:29' },
  { day: 3, course: 'Arquitectura Empresarial', nrc: '47071', start: '17:20', end: '18:49' },

  { day: 5, course: 'Taller de Proyectos 2', nrc: '36189', start: '17:20', end: '18:49' },
  { day: 5, course: 'Taller de Proyectos 2', nrc: '36189', start: '19:00', end: '20:29' },

  { day: 6, course: 'Simulación', nrc: '50131', start: '17:10', end: '18:39' },
  { day: 6, course: 'Simulación', nrc: '50131', start: '18:50', end: '21:49' },
]

// Lista de cursos únicos, usada para el selector manual en caso
// de que la detección automática falle o quieras corregirla.
export const COURSES = [...new Set(SCHEDULE.map((b) => b.course))]
