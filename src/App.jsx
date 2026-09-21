import { useEffect, useRef, useState } from 'react'
import { COURSES, TOTAL_WEEKS } from './schedule.js'
import { getWeekNumber } from './utils/weekCalculator.js'
import { matchSchedule } from './utils/matchSchedule.js'
import { initGoogleAuth, requestAccessToken, uploadPhoto } from './driveApi.js'

const STATUS = {
  IDLE: 'idle',
  REVIEW: 'review',
  UPLOADING: 'uploading',
  DONE: 'done',
  ERROR: 'error',
}

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

/* ---------------------------------------------------------------- iconos */

function IconCamera(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.8 7.2 8 5.2a1.4 1.4 0 0 1 1.2-.7h5.6a1.4 1.4 0 0 1 1.2.7l1.2 2h1.4A2.4 2.4 0 0 1 21 9.6v8A2.4 2.4 0 0 1 18.6 20H5.4A2.4 2.4 0 0 1 3 17.6v-8a2.4 2.4 0 0 1 2.4-2.4h1.4Z"
      />
      <circle cx="12" cy="13.2" r="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconDrive(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.4 3.6 7.2 12.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.4 16.1 13.2 3.6H8.4l7.2 12.5h4.8Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 16.1 8.4 3.6l4.8 8.3-2.4 4.2H3.6Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 16.1 6 20.4h12l2.4-4.3H3.6Z" />
    </svg>
  )
}

function IconCheck(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.2" stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12.8 4.4 4.4L19 7.6" />
    </svg>
  )
}

function IconAlert(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 7.6v5.2" />
      <circle cx="12" cy="16.4" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" opacity="0.2" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* -------------------------------------------------------------- piezas UI */

function Card({ className = '', children }) {
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  )
}

const selectClass =
  'w-full appearance-none rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3.5 ' +
  'text-[15px] font-medium text-zinc-100 outline-none transition ' +
  'focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20'

function SelectWrap({ children }) {
  return (
    <div className="relative">
      {children}
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9.5 6 6 6-6" />
      </svg>
    </div>
  )
}

/* Tarjeta principal: qué clase detecta la app en este momento. */
function NowCard({ now }) {
  const block = matchSchedule(now)
  const week = getWeekNumber(now)
  const hora = now.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const dia = now.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Clase detectada
          </p>
          {block ? (
            <>
              <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight text-zinc-50">
                {block.course}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                {block.start}–{block.end} · NRC {block.nrc}
              </p>
            </>
          ) : (
            <>
              <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight text-zinc-300">
                Sin clase ahora
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Podrás elegir el curso al revisar la foto.
              </p>
            </>
          )}
        </div>

        {week && (
          <div className="shrink-0 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3.5 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
              Semana
            </p>
            <p className="text-2xl font-semibold leading-none tabular-nums text-amber-300">
              {week}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-white/[0.07] px-5 py-3">
        <span className={`h-1.5 w-1.5 rounded-full ${block ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
        <p className="text-xs text-zinc-500 first-letter:uppercase">
          {dia} · {hora}
        </p>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------- app */

export default function App() {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [status, setStatus] = useState(STATUS.IDLE)
  const [preview, setPreview] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [course, setCourse] = useState('')
  const [week, setWeek] = useState(1)
  const [driveLink, setDriveLink] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [history, setHistory] = useState(loadHistory())
  const [now, setNow] = useState(() => new Date())
  const fileInputRef = useRef(null)

  useEffect(() => {
    // Precalienta el cliente de Google apenas carga el script, para que el
    // primer toque en "Conectar" no tenga que esperar. Si falla, no
    // mostramos nada todavía: el error real aparece al tocar el botón.
    initGoogleAuth().catch(() => {})
  }, [])

  // Mantiene fresca la tarjeta de "clase detectada" sin recargar la página.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  // Libera la URL del preview para no filtrar memoria al tomar varias fotos.
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

  function handlePickPhoto() {
    fileInputRef.current?.click()
  }

  function handleFileSelected(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const ahora = new Date()
    const match = matchSchedule(ahora)
    const weekNumber = getWeekNumber(ahora)

    setNow(ahora)
    setPendingFile(file)
    setPreview(URL.createObjectURL(file))
    setCourse(match ? match.course : COURSES[0])
    setWeek(weekNumber || 1)
    setDriveLink(null)
    setStatus(STATUS.REVIEW)
    setErrorMsg('')
  }

  function resetFlow() {
    setPendingFile(null)
    setPreview(null)
    setDriveLink(null)
    setStatus(STATUS.IDLE)
    setErrorMsg('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleConfirmUpload() {
    if (!pendingFile) return
    setStatus(STATUS.UPLOADING)
    try {
      const result = await uploadPhoto({ file: pendingFile, course, week })
      const entry = {
        course,
        week,
        date: new Date().toLocaleString('es-PE', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
        link: result?.webViewLink || null,
      }
      const newHistory = [entry, ...history]
      setHistory(newHistory)
      saveHistory(newHistory)
      setDriveLink(result?.webViewLink || null)
      setStatus(STATUS.DONE)
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || 'Ocurrió un error al subir la foto.')
      setStatus(STATUS.ERROR)
    }
  }

  const overlayOpen = status !== STATUS.IDLE

  return (
    <div className="flex min-h-full flex-col">
      {/* ------------------------------------------------------ encabezado */}
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
              className={`h-1.5 w-1.5 rounded-full ${
                connected ? 'bg-emerald-400' : 'bg-zinc-600'
              }`}
            />
            {connected ? 'Conectado' : 'Sin conexión'}
          </span>
        </div>
      </header>

      {/* --------------------------------------------------------- cuerpo */}
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
                La app solo podrá ver las carpetas que ella misma cree. El resto de tu Drive
                queda intacto.
              </p>
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 py-4 text-[15px] font-semibold text-zinc-950 shadow-lg shadow-amber-500/20 transition active:scale-[0.98] active:from-amber-400 active:to-amber-500 disabled:opacity-60"
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
          <div className="animate-rise space-y-5">
            <NowCard now={now} />

            <button
              onClick={handlePickPhoto}
              className="group flex w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-b from-amber-300 to-amber-400 py-5 text-[17px] font-semibold text-zinc-950 shadow-xl shadow-amber-500/25 transition active:scale-[0.98] active:from-amber-400 active:to-amber-500"
            >
              <IconCamera className="h-6 w-6" />
              Tomar foto
            </button>

            {history.length > 0 && (
              <section className="pt-2">
                <h2 className="mb-3 px-1 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Últimas subidas
                </h2>
                <Card className="divide-y divide-white/[0.07] overflow-hidden">
                  {history.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                        <IconCheck className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-200">{h.course}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Semana {h.week} · {h.date}
                        </p>
                      </div>
                      {h.link && (
                        <a
                          href={h.link}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-amber-300/90 active:bg-white/5"
                        >
                          Ver
                        </a>
                      )}
                    </div>
                  ))}
                </Card>
              </section>
            )}
          </div>
        )}

        {/* El input vive siempre montado para que la referencia sea estable. */}
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
      {overlayOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/80 backdrop-blur-md">
          <div className="safe-top flex-1 overflow-y-auto px-5 pb-6">
            <div className="animate-rise mx-auto w-full max-w-md">
              {status === STATUS.REVIEW && preview && (
                <>
                  <h2 className="mb-4 text-lg font-semibold tracking-tight text-zinc-50">
                    Revisa antes de subir
                  </h2>

                  <img
                    src={preview}
                    alt="Vista previa de la foto"
                    className="w-full rounded-3xl border border-white/10 object-cover shadow-2xl"
                  />

                  <div className="mt-5 space-y-4">
                    <Field label="Curso">
                      <SelectWrap>
                        <select
                          value={course}
                          onChange={(e) => setCourse(e.target.value)}
                          className={selectClass}
                        >
                          {COURSES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </SelectWrap>
                    </Field>

                    <Field label="Semana">
                      <SelectWrap>
                        <select
                          value={week}
                          onChange={(e) => setWeek(Number(e.target.value))}
                          className={selectClass}
                        >
                          {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              Semana {n}
                            </option>
                          ))}
                        </select>
                      </SelectWrap>
                    </Field>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={resetFlow}
                      className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-4 text-[15px] font-medium text-zinc-300 transition active:scale-[0.98] active:bg-white/10"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleConfirmUpload}
                      className="flex-[1.4] rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 py-4 text-[15px] font-semibold text-zinc-950 shadow-lg shadow-amber-500/20 transition active:scale-[0.98] active:from-amber-400 active:to-amber-500"
                    >
                      Subir a Drive
                    </button>
                  </div>
                </>
              )}

              {status === STATUS.UPLOADING && (
                <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
                  <Spinner className="h-9 w-9 text-amber-300" />
                  <p className="mt-5 text-[15px] font-medium text-zinc-200">Subiendo foto…</p>
                  <p className="mt-1.5 text-sm text-zinc-500">
                    {course} · Semana {week}
                  </p>
                </div>
              )}

              {status === STATUS.DONE && (
                <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10">
                    <IconCheck className="h-8 w-8 text-emerald-400" />
                  </div>
                  <h2 className="mt-5 text-xl font-semibold tracking-tight text-zinc-50">
                    Foto guardada
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {course}
                    <br />
                    <span className="text-zinc-500">Semana {week}</span>
                  </p>

                  <div className="mt-8 w-full space-y-3">
                    <button
                      onClick={resetFlow}
                      className="w-full rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 py-4 text-[15px] font-semibold text-zinc-950 shadow-lg shadow-amber-500/20 transition active:scale-[0.98]"
                    >
                      Tomar otra foto
                    </button>
                    {driveLink && (
                      <a
                        href={driveLink}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-full rounded-2xl border border-white/10 bg-white/5 py-4 text-center text-[15px] font-medium text-zinc-300 transition active:scale-[0.98]"
                      >
                        Ver en Drive
                      </a>
                    )}
                  </div>
                </div>
              )}

              {status === STATUS.ERROR && (
                <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
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
                      className="w-full rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 py-4 text-[15px] font-semibold text-zinc-950 shadow-lg shadow-amber-500/20 transition active:scale-[0.98]"
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
