// ============================================================
// Función serverless de Vercel: recibe la foto de la pizarra y
// devuelve un resumen de texto generado por Gemini.
//
// Existe por una razón de seguridad: la API key NO puede vivir en
// el navegador. Si estuviera en el bundle, cualquiera que abra la
// app podría extraerla y gastar la cuota. Aquí vive del lado del
// servidor y el navegador nunca la ve.
// ============================================================

const MODEL = 'gemini-3.8-flash'
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions'

// Vercel corta las funciones a los 10s por defecto; analizar una
// imagen puede tardar más.
export const config = { maxDuration: 60 }

const MAX_ATTEMPTS = 3
const ATTEMPT_TIMEOUT_MS = 20000
const BACKOFF_MS = 1200
const MIN_ATTEMPT_MS = 6000 // no arrancar un intento que no alcance a terminar
const MAX_TOTAL_MS = 52000 // margen bajo el límite de 60s de Vercel

function buildPrompt(course, week) {
  return `Estás analizando la foto de una pizarra de una clase universitaria.

Curso: ${course}
Semana del ciclo: ${week}

Escribe un resumen BREVE en español del contenido de la pizarra, así:

- Primera línea: el tema principal, en pocas palabras.
- Luego entre 3 y 6 viñetas (empezando con "- ") con los puntos clave:
  definiciones, fórmulas, listas, pasos o relaciones que aparezcan.

Reglas importantes:
- Describe ÚNICAMENTE lo que realmente se ve en la imagen. No completes
  ni inventes contenido que "debería" estar ahí por el nombre del curso.
- Si hay partes borrosas o ilegibles, dilo en una viñeta final que
  empiece con "- No se pudo leer:". Es preferible admitirlo a adivinar.
- Si la imagen no es una pizarra o no tiene contenido académico legible,
  respóndelo en una sola frase y no inventes viñetas.
- Máximo 150 palabras. Texto plano, sin markdown ni asteriscos.`
}

/**
 * La respuesta trae `output_text` como atajo, pero si no viniera
 * recorremos los pasos para sacar el texto igual.
 */
function extractText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim()
  }

  const fromSteps = (data?.steps || [])
    .flatMap((step) => step?.content || step?.output || [])
    .map((part) => (typeof part === 'string' ? part : part?.text))
    .filter(Boolean)
    .join('\n')
    .trim()

  return fromSteps || null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo se aceptan peticiones POST.' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error:
        'Falta GEMINI_API_KEY en las variables de entorno de Vercel. ' +
        'Agrégala en Settings → Environment Variables y vuelve a desplegar.',
    })
  }

  const { imageBase64, mimeType = 'image/jpeg', course = '', week = '' } = req.body || {}

  if (!imageBase64) {
    return res.status(400).json({ error: 'No llegó la imagen.' })
  }

  const body = JSON.stringify({
    model: MODEL,
    input: [
      { type: 'text', text: buildPrompt(course, week) },
      { type: 'image', data: imageBase64, mime_type: mimeType },
    ],
  })

  // Los modelos gratuitos devuelven 503 ("sobrecargado") cada tanto, y casi
  // siempre el siguiente intento funciona. Reintentamos vigilando el reloj:
  // Vercel mata la función a los 60s, así que nunca empezamos un intento que
  // no alcance a terminar.
  const deadline = Date.now() + MAX_TOTAL_MS
  let lastStatus = null

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const remaining = deadline - Date.now()
    if (remaining < MIN_ATTEMPT_MS) break

    try {
      const upstream = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body,
        signal: AbortSignal.timeout(Math.min(ATTEMPT_TIMEOUT_MS, remaining)),
      })

      if (upstream.ok) {
        const summary = extractText(await upstream.json())
        if (summary) return res.status(200).json({ summary })
        console.error('Gemini respondió 200 pero sin texto')
        lastStatus = 'sin-texto'
      } else {
        lastStatus = upstream.status
        const detail = await upstream.text()
        console.error(`Gemini respondió ${upstream.status} (intento ${attempt})`, detail)

        // Cuota agotada: reintentar no ayuda, solo quema tiempo.
        if (upstream.status === 429) {
          return res.status(429).json({
            error:
              'Se agotó la cuota gratuita de Gemini por ahora. ' +
              'La foto sí se guardó; vuelve a intentar el resumen más tarde.',
          })
        }
        // Un 4xx distinto de 429 es culpa nuestra (petición mal formada):
        // reintentar daría el mismo resultado.
        if (upstream.status < 500) break
      }
    } catch (err) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError'
      lastStatus = timedOut ? 'timeout' : 'red'
      console.error(`Fallo de red en el intento ${attempt}:`, err?.message || err)
    }

    // Espera creciente entre intentos, sin pasarnos del presupuesto.
    const backoff = BACKOFF_MS * attempt
    if (attempt < MAX_ATTEMPTS && deadline - Date.now() > MIN_ATTEMPT_MS + backoff) {
      await new Promise((r) => setTimeout(r, backoff))
    }
  }

  return res.status(502).json({
    error:
      lastStatus === 'timeout'
        ? 'El análisis tardó demasiado. La foto sí se guardó.'
        : 'El servicio de resumen no respondió bien' +
          (lastStatus ? ` (${lastStatus})` : '') +
          '. Suele ser temporal; la foto sí se guardó.',
  })
}
