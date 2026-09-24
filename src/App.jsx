import { useEffect, useMemo, useRef, useState } from 'react'
import { COURSES, TOTAL_WEEKS } from './schedule.js'
import { getWeekNumber } from './utils/weekCalculator.js'
import { matchSchedule } from './utils/matchSchedule.js'
import {
  todayBlocks,
  blockState,
  blockProgress,
  minutesLeft,
  nextBlock,
  formatUntil,
} from './utils/agenda.js'
import { courseTheme, withAlpha } from './utils/courseTheme.js'
import { initGoogleAuth, requestAccessToken, uploadPhoto, createSummaryDoc } from './driveApi.js'
import { summarizePhoto } from './summaryApi.js'

const STATUS = {
  IDLE: 'idle',
  REVIEW: 'review',
  UPLOADING: 'uploading',
  SUMMARIZING: 'summarizing',
  DONE: 'done',
  ERROR: 'error',
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem('uploadHistory') || '[]')
  } catch {
    return []
  }
}

function saveHistory(history) {
  localStorage.setItem('uploadHistory', JSON.stringify(history.slice(0, 8)))
}

/* --------------------------------------------------------------- iconos */

const svgBase = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor' }

const IconCamera = (p) => (
  <svg {...svgBase} strokeWidth="1.8" {...p}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.8 7.2 8 5.2a1.4 1.4 0 0 1 1.2-.7h5.6a1.4 1.4 0 0 1 1.2.7l1.2 2h1.4A2.4 2.4 0 0 1 21 9.6v8A2.4 2.4 0 0 1 18.6 20H5.4A2.4 2.4 0 0 1 3 17.6v-8a2.4 2.4 0 0 1 2.4-2.4h1.4Z"
    />
    <circle cx="12" cy="13.2" r="3.4" strokeLinecap="round" />
  </svg>
)

const IconDrive = (p) => (
  <svg {...svgBase} strokeWidth="1.8" {...p}>
    <path strokeLinejoin="round" d="M20.4 16.1 13.2 3.6H8.4l7.2 12.5h4.8Z" />
    <path strokeLinejoin="round" d="M3.6 16.1 8.4 3.6l4.8 8.3-2.4 4.2H3.6Z" />
    <path strokeLinejoin="round" d="M3.6 16.1 6 20.4h12l2.4-4.3H3.6Z" />
  </svg>
)

const IconCheck = (p) => (
  <svg {...svgBase} strokeWidth="2.2" {...p}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.8 4.4 4.4L19 7.6" />
  </svg>
)

const IconAlert = (p) => (
  <svg {...svgBase} strokeWidth="1.8" {...p}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" d="M12 7.6v5.2" />
    <circle cx="12" cy="16.4" r="1" fill="currentColor" stroke="none" />
  </svg>
)

const IconCalendar = (p) => (
  <svg {...svgBase} strokeWidth="1.8" {...p}>
    <rect x="3.5" y="5.5" width="17" height="15" rx="3" />
    <path strokeLinecap="round" d="M8 3.5v4M16 3.5v4M3.5 10.5h17" />
  </svg>
)

function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" opacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

/* ------------------------------------------------------------ primitivas */

function Card({ className = '', style, children }) {
  return (
    <div
      style={style}
      className={`rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  )
}

function ProgressRing({ value, size = 104, stroke = 7, color }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
        style={{ transition: 'stroke-dashoffset 0.35s cubic-bezier(0.22,1,0.36,1)' }}
      />
    </svg>
  )
}

/* ------------------------------------------------------- tarjeta principal */

function HeroCard({ now }) {
  const live = matchSchedule(now)
  const week = getWeekNumber(now)
  const upcoming = useMemo(() => nextBlock(now), [now])

  const theme = courseTheme(live ? live.course : upcoming?.block.course)
  const progress = live ? blockProgress(live, now) : 0
  const restante = live ? minutesLeft(live, now) : 0

  return (
    <Card
      className="relative overflow-hidden"
      style={{
        backgroundImage: `radial-gradient(28rem 12rem at 85% -20%, ${withAlpha(
          theme.accent,
          0.16
        )}, transparent 70%)`,
      }}
    >
      <div className="p-5">
        <div className="flex items-center gap-2">
          {live && (
            <span className="relative flex h-2 w-2">
              <span
                className="ring-pulse absolute inline-flex h-full w-full rounded-full"
                style={{ backgroundColor: theme.accent }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ backgroundColor: theme.accent }}
              />
            </span>
          )}
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: live ? theme.accent : '#71717a' }}
          >
            {live ? 'Clase en curso' : 'Próxima clase'}
          </p>
        </div>

        {live ? (
          <>
            <h2 className="mt-2.5 text-[22px] font-semibold leading-tight tracking-tight text-zinc-50">
              {live.course}
            </h2>
            <p className="mt-1.5 text-sm text-zinc-400">
              {live.start}–{live.end} · NRC {live.nrc}
            </p>

            <div className="mt-4">
              <div className="relative h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="relative h-full rounded-full transition-all duration-700"
                  style={{ width: `${progress * 100}%`, backgroundColor: theme.accent }}
                >
                  <span className="animate-sheen absolute inset-y-0 w-8 bg-white/30 blur-[3px]" />
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {restante > 0 ? `Termina en ${restante} min` : 'Terminando'}
              </p>
            </div>
          </>
        ) : upcoming ? (
          <>
            <h2 className="mt-2.5 text-[22px] font-semibold leading-tight tracking-tight text-zinc-100">
              {upcoming.block.course}
            </h2>
            <p className="mt-1.5 text-sm text-zinc-400">
              <span className="capitalize">{DIAS[upcoming.block.day]}</span> {upcoming.block.start}{' '}
              · <span style={{ color: theme.accent }}>{formatUntil(upcoming.when, now)}</span>
            </p>
          </>
        ) : (
          <h2 className="mt-2.5 text-[22px] font-semibold tracking-tight text-zinc-300">
            Sin clases programadas
          </h2>
        )}
      </div>

      {week && (
        <div className="border-t border-white/[0.07] px-5 py-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-500">
              Semana <span className="font-semibold text-zinc-300">{week}</span> de {TOTAL_WEEKS}
            </span>
            <span className="tabular-nums text-zinc-600">
              {Math.round((week / TOTAL_WEEKS) * 100)}%
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-zinc-400/70 transition-all duration-700"
              style={{ width: `${(week / TOTAL_WEEKS) * 100}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  )
}

/* ------------------------------------------------------- agenda de hoy */

function TodayTimeline({ now }) {
  const blocks = todayBlocks(now)
  if (blocks.length === 0) {
    return (
      <Card className="flex items-center gap-3 px-5 py-4">
        <IconCalendar className="h-5 w-5 shrink-0 text-zinc-600" />
        <p className="text-sm text-zinc-500">
          Hoy <span className="capitalize text-zinc-400">{DIAS[now.getDay()]}</span> no tienes
          clases.
        </p>
      </Card>
    )
  }

  return (
    <section>
      <h2 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        Hoy · {DIAS[now.getDay()]}
      </h2>
      <Card className="overflow-hidden">
        {blocks.map((b, i) => {
          const state = blockState(b, now)
          const theme = courseTheme(b.course)
          const activo = state === 'enCurso'
          return (
            <div
              key={`${b.course}-${b.start}-${i}`}
              className={`flex items-center gap-3.5 px-4 py-3.5 ${
                i > 0 ? 'border-t border-white/[0.06]' : ''
              } ${state === 'pasado' ? 'opacity-45' : ''}`}
              style={activo ? { backgroundColor: withAlpha(theme.accent, 0.07) } : undefined}
            >
              <div className="w-[52px] shrink-0 text-right">
                <p
                  className={`text-[13px] font-semibold tabular-nums ${
                    activo ? 'text-zinc-100' : 'text-zinc-400'
                  }`}
                >
                  {b.start}
                </p>
                <p className="text-[11px] tabular-nums text-zinc-600">{b.end}</p>
              </div>

              <div
                className="w-[3px] shrink-0 self-stretch rounded-full"
                style={{
                  backgroundColor: activo ? theme.accent : withAlpha(theme.accent, 0.3),
                }}
              />

              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm ${
                    activo ? 'font-semibold text-zinc-50' : 'font-medium text-zinc-300'
                  }`}
                >
                  {b.course}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="text-[11px] text-zinc-600">NRC {b.nrc}</p>
                  {activo && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{
                        color: theme.accent,
                        backgroundColor: withAlpha(theme.accent, 0.14),
                      }}
                    >
                      Ahora
                    </span>
                  )}
                </div>
              </div>

              {state === 'pasado' && <IconCheck className="h-4 w-4 shrink-0 text-zinc-600" />}
            </div>
          )
        })}
      </Card>
    </section>
  )
}

/* ------------------------------------------------------ selector de curso */

function CoursePicker({ value, onChange }) {
  return (
    <div className="space-y-2">
      {COURSES.map((c) => {
        const theme = courseTheme(c)
        const selected = c === value
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition active:scale-[0.99] ${
              selected ? 'border-transparent' : 'border-white/10 bg-white/[0.03]'
            }`}
            style={
              selected
                ? {
                    backgroundColor: withAlpha(theme.accent, 0.13),
                    boxShadow: `inset 0 0 0 1.5px ${withAlpha(theme.accent, 0.5)}`,
                  }
                : undefined
            }
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor: selected ? theme.accent : withAlpha(theme.accent, 0.35),
              }}
            />
            <span
              className={`flex-1 text-[15px] ${
                selected ? 'font-semibold text-zinc-50' : 'font-medium text-zinc-400'
              }`}
            >
              {c}
            </span>
            {selected && (
              <IconCheck className="h-4 w-4 shrink-0" style={{ color: theme.accent }} />
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------ selector de semana */

function WeekPicker({ value, onChange, accent }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-selected="true"]')
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [value])

  return (
    <div ref={scrollRef} className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 py-1">
      {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((n) => {
        const selected = n === value
        return (
          <button
            key={n}
            data-selected={selected}
            onClick={() => onChange(n)}
            className={`h-12 w-12 shrink-0 rounded-2xl text-[15px] font-semibold tabular-nums transition active:scale-95 ${
              selected ? 'text-zinc-950' : 'border border-white/10 bg-white/[0.03] text-zinc-400'
            }`}
            style={selected ? { backgroundColor: accent } : undefined}
          >
            {n}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------- app */

export default function App() {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [status, setStatus] = useState(STATUS.IDLE)
  const [preview, setPreview] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [course, setCourse] = useState(COURSES[0])
  const [week, setWeek] = useState(1)
  const [progress, setProgress] = useState(0)
  const [driveLink, setDriveLink] = useState(null)
  const [docLink, setDocLink] = useState(null)
  const [summary, setSummary] = useState('')
  const [summaryError, setSummaryError] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [history, setHistory] = useState(loadHistory())
  const [now, setNow] = useState(() => new Date())
  const fileInputRef = useRef(null)

  const theme = courseTheme(course)

  useEffect(() => {
    initGoogleAuth().catch(() => {})
  }, [])

  // Mantiene viva la barra de progreso de la clase y la cuenta regresiva.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  async function handleConnect() {
    setConnecting(true)
    setErrorMsg('')
    try {
      await requestAccessToken({ interactive: true })
      setConnected(true)
    } catch (err) {
      console.error(err)
      setErrorMsg(`No se pudo conectar con Google Drive: ${err.message}`)
    } finally {
      setConnecting(false)
    }
  }

  function handleFileSelected(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const ahora = new Date()
    const match = matchSchedule(ahora)

    setNow(ahora)
    setPendingFile(file)
    setPreview(URL.createObjectURL(file))
    setCourse(match ? match.course : COURSES[0])
    setWeek(getWeekNumber(ahora) || 1)
    setDriveLink(null)
    setDocLink(null)
    setSummary('')
    setSummaryError('')
    setProgress(0)
    setStatus(STATUS.REVIEW)
    setErrorMsg('')
  }

  function resetFlow() {
    setPendingFile(null)
    setPreview(null)
    setDriveLink(null)
    setDocLink(null)
    setSummary('')
    setSummaryError('')
    setProgress(0)
    setStatus(STATUS.IDLE)
    setErrorMsg('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleConfirmUpload() {
    if (!pendingFile) return
    setProgress(0)
    setSummary('')
    setSummaryError('')
    setStatus(STATUS.UPLOADING)

    // Paso 1: subir la foto. Esto sí es crítico — si falla, error.
    let uploaded
    try {
      uploaded = await uploadPhoto({
        file: pendingFile,
        course,
        week,
        onProgress: setProgress,
      })
      setDriveLink(uploaded?.webViewLink || null)
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || 'Ocurrió un error al subir la foto.')
      setStatus(STATUS.ERROR)
      return
    }

    // Paso 2: el resumen. A partir de aquí la foto YA está guardada, así
    // que ningún fallo puede mandarnos a la pantalla de error: como mucho
    // avisamos que el resumen no salió.
    setStatus(STATUS.SUMMARIZING)
    let resumen = ''
    let enlaceDoc = null
    try {
      resumen = await summarizePhoto({ file: pendingFile, course, week })
      setSummary(resumen)

      const doc = await createSummaryDoc({
        summary: resumen,
        course,
        week,
        folderId: uploaded.folderId,
        photoName: uploaded.photoName,
        photoLink: uploaded.webViewLink,
      })
      enlaceDoc = doc?.webViewLink || null
      setDocLink(enlaceDoc)
    } catch (err) {
      console.error(err)
      setSummaryError(err.message || 'No se pudo generar el resumen.')
    }

    const entry = {
      course,
      week,
      date: new Date().toLocaleString('es-PE', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      link: uploaded?.webViewLink || null,
      docLink: enlaceDoc,
    }
    const newHistory = [entry, ...history]
    setHistory(newHistory)
    saveHistory(newHistory)
    setStatus(STATUS.DONE)
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="safe-top px-5 pb-5">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-semibold tracking-tight text-zinc-50">
              Fotos de Clases
            </h1>
            <p className="mt-0.5 text-[13px] text-zinc-500">Pizarra → Drive, ya ordenado</p>
          </div>
          <span
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
              connected
                ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                : 'border-white/10 bg-white/5 text-zinc-500'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-zinc-600'}`}
            />
            {connected ? 'Conectado' : 'Sin conexión'}
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5">
        {!connected ? (
          <div className="animate-rise">
            <Card className="p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <IconDrive className="h-7 w-7 text-amber-300" />
              </div>
              <h2 className="mt-4 text-lg font-semibold tracking-tight text-zinc-50">
                Conecta tu Google Drive
              </h2>
              <p className="mx-auto mt-2 max-w-[17rem] text-sm leading-relaxed text-zinc-400">
                La app solo podrá ver las carpetas que ella misma cree. El resto de tu Drive queda
                intacto.
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 py-4 text-[15px] font-semibold text-zinc-950 shadow-lg shadow-amber-500/20 transition active:scale-[0.98] disabled:opacity-60"
              >
                {connecting ? <Spinner /> : <IconDrive className="h-5 w-5" />}
                {connecting ? 'Conectando…' : 'Conectar con Google Drive'}
              </button>
            </Card>

            {errorMsg && (
              <div className="animate-rise mt-4 flex gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
                <IconAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                <p className="text-sm leading-relaxed text-red-200">{errorMsg}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="animate-rise" style={{ animationDelay: '0ms' }}>
              <HeroCard now={now} />
            </div>

            <div className="animate-rise" style={{ animationDelay: '60ms' }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-3 rounded-3xl py-5 text-[17px] font-semibold text-zinc-950 transition active:scale-[0.98]"
                style={{
                  background: `linear-gradient(180deg, ${theme.accent}, ${withAlpha(
                    theme.accent,
                    0.82
                  )})`,
                  boxShadow: `0 16px 40px -12px ${withAlpha(theme.accent, 0.55)}`,
                }}
              >
                <IconCamera className="h-6 w-6" />
                Tomar foto
              </button>
            </div>

            <div className="animate-rise" style={{ animationDelay: '120ms' }}>
              <TodayTimeline now={now} />
            </div>

            {history.length > 0 && (
              <section className="animate-rise pt-1" style={{ animationDelay: '180ms' }}>
                <h2 className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Últimas subidas
                </h2>
                <Card className="overflow-hidden">
                  {history.map((h, i) => {
                    const t = courseTheme(h.course)
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-3 px-4 py-3.5 ${
                          i > 0 ? 'border-t border-white/[0.06]' : ''
                        }`}
                      >
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{ backgroundColor: withAlpha(t.accent, 0.13) }}
                        >
                          <IconCheck className="h-4 w-4" style={{ color: t.accent }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-200">{h.course}</p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            Semana {h.week} · {h.date}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {h.link && (
                            <a
                              href={h.link}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg px-2 py-1 text-xs font-medium active:bg-white/5"
                              style={{ color: t.accent }}
                            >
                              Foto
                            </a>
                          )}
                          {h.docLink && (
                            <a
                              href={h.docLink}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 active:bg-white/5"
                            >
                              Resumen
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </Card>
              </section>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelected}
          className="hidden"
        />
      </main>

      <footer className="safe-bottom mx-auto w-full max-w-md px-5 pt-8">
        <p className="text-center text-[11px] text-zinc-600">
          Se guarda en <span className="text-zinc-500">Fotos Clases / Curso / Semana</span>
        </p>
      </footer>

      {/* ------------------------------------------------------- overlay */}
      {status !== STATUS.IDLE && (
        <div className="animate-fade fixed inset-0 z-50 flex flex-col bg-zinc-950/85 backdrop-blur-xl">
          <div className="safe-top safe-bottom flex-1 overflow-y-auto px-5">
            <div className="animate-sheet mx-auto w-full max-w-md">
              {status === STATUS.REVIEW && preview && (
                <>
                  <div className="flex items-center justify-between py-1">
                    <h2 className="text-lg font-semibold tracking-tight text-zinc-50">
                      Revisa y sube
                    </h2>
                    <button
                      onClick={resetFlow}
                      className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-zinc-400 active:bg-white/10"
                    >
                      Cancelar
                    </button>
                  </div>

                  <img
                    src={preview}
                    alt="Vista previa de la foto"
                    className="mt-4 w-full rounded-3xl border border-white/10 shadow-2xl"
                  />

                  <div className="mt-6">
                    <p className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      Curso
                    </p>
                    <CoursePicker value={course} onChange={setCourse} />
                  </div>

                  <div className="mt-6">
                    <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      Semana
                    </p>
                    <WeekPicker value={week} onChange={setWeek} accent={theme.accent} />
                  </div>

                  <button
                    onClick={handleConfirmUpload}
                    className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl py-4.5 text-[16px] font-semibold text-zinc-950 transition active:scale-[0.98]"
                    style={{
                      paddingTop: '1.05rem',
                      paddingBottom: '1.05rem',
                      background: `linear-gradient(180deg, ${theme.accent}, ${withAlpha(
                        theme.accent,
                        0.82
                      )})`,
                      boxShadow: `0 16px 40px -12px ${withAlpha(theme.accent, 0.55)}`,
                    }}
                  >
                    <IconDrive className="h-5 w-5" />
                    Subir a Drive
                  </button>
                </>
              )}

              {status === STATUS.UPLOADING && (
                <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
                  <div className="relative">
                    <ProgressRing value={progress} color={theme.accent} />
                    <span className="absolute inset-0 flex items-center justify-center text-[22px] font-semibold tabular-nums text-zinc-100">
                      {Math.round(progress * 100)}%
                    </span>
                  </div>
                  <p className="mt-6 text-[15px] font-medium text-zinc-200">
                    {progress < 1 ? 'Subiendo foto…' : 'Guardando en Drive…'}
                  </p>
                  <p className="mt-1.5 text-sm text-zinc-500">
                    {course} · Semana {week}
                  </p>
                </div>
              )}

              {status === STATUS.SUMMARIZING && (
                <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
                  <div className="relative flex h-20 w-20 items-center justify-center">
                    <span
                      className="ring-pulse absolute h-20 w-20 rounded-full"
                      style={{ backgroundColor: withAlpha(theme.accent, 0.2) }}
                    />
                    <Spinner className="relative h-9 w-9" />
                  </div>
                  <p className="mt-6 text-[15px] font-medium text-zinc-200">
                    Leyendo la pizarra…
                  </p>
                  <p className="mt-1.5 max-w-[15rem] text-sm text-zinc-500">
                    La foto ya está guardada. Esto solo genera el resumen.
                  </p>
                </div>
              )}

              {status === STATUS.DONE && (
                <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
                  <div className="relative flex h-20 w-20 items-center justify-center">
                    <span
                      className="ring-pulse absolute h-20 w-20 rounded-full"
                      style={{ backgroundColor: withAlpha(theme.accent, 0.25) }}
                    />
                    <span
                      className="absolute inset-0 rounded-full"
                      style={{
                        backgroundColor: withAlpha(theme.accent, 0.13),
                        boxShadow: `inset 0 0 0 1.5px ${withAlpha(theme.accent, 0.4)}`,
                      }}
                    />
                    <svg
                      viewBox="0 0 24 24"
                      className="relative h-9 w-9"
                      fill="none"
                      stroke={theme.accent}
                      strokeWidth="2.4"
                    >
                      <path
                        className="draw-check"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m5 12.8 4.4 4.4L19 7.6"
                      />
                    </svg>
                  </div>

                  <h2 className="mt-6 text-xl font-semibold tracking-tight text-zinc-50">
                    Foto guardada
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">{course}</p>
                  <p className="text-sm text-zinc-500">Semana {week}</p>

                  {summary && (
                    <Card className="mt-6 w-full p-4 text-left">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                        Resumen
                      </p>
                      <div className="space-y-1.5">
                        {summary
                          .split('\n')
                          .map((l) => l.trim())
                          .filter(Boolean)
                          .map((line, i) => {
                            const bullet = line.startsWith('- ') || line.startsWith('• ')
                            return (
                              <p
                                key={i}
                                className={`text-[13px] leading-relaxed ${
                                  bullet ? 'pl-3 text-zinc-400' : 'font-medium text-zinc-200'
                                }`}
                              >
                                {bullet ? `· ${line.slice(2).trim()}` : line}
                              </p>
                            )
                          })}
                      </div>
                    </Card>
                  )}

                  {summaryError && (
                    <div className="mt-6 flex w-full gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-left">
                      <IconAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                      <div>
                        <p className="text-sm font-medium text-amber-200">
                          La foto se guardó, pero el resumen no
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-amber-200/70">
                          {summaryError}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-9 w-full space-y-3">
                    <button
                      onClick={resetFlow}
                      className="w-full rounded-2xl py-4 text-[15px] font-semibold text-zinc-950 transition active:scale-[0.98]"
                      style={{
                        background: `linear-gradient(180deg, ${theme.accent}, ${withAlpha(
                          theme.accent,
                          0.82
                        )})`,
                      }}
                    >
                      Tomar otra foto
                    </button>
                    <div className="flex gap-3">
                      {driveLink && (
                        <a
                          href={driveLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-4 text-center text-[15px] font-medium text-zinc-300 transition active:scale-[0.98]"
                        >
                          Ver foto
                        </a>
                      )}
                      {docLink && (
                        <a
                          href={docLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-4 text-center text-[15px] font-medium text-zinc-300 transition active:scale-[0.98]"
                        >
                          Ver resumen
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {status === STATUS.ERROR && (
                <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10">
                    <IconAlert className="h-8 w-8 text-red-400" />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold tracking-tight text-zinc-50">
                    No se pudo subir
                  </h2>
                  <p className="mt-3 max-w-xs break-words text-sm leading-relaxed text-zinc-400">
                    {errorMsg}
                  </p>
                  <div className="mt-8 w-full space-y-3">
                    <button
                      onClick={handleConfirmUpload}
                      className="w-full rounded-2xl py-4 text-[15px] font-semibold text-zinc-950 transition active:scale-[0.98]"
                      style={{
                        background: `linear-gradient(180deg, ${theme.accent}, ${withAlpha(
                          theme.accent,
                          0.82
                        )})`,
                      }}
                    >
                      Reintentar
                    </button>
                    <button
                      onClick={resetFlow}
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 text-[15px] font-medium text-zinc-300 transition active:scale-[0.98]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
