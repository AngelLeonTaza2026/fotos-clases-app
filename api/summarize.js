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

  try {
    const upstream = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { type: 'text', text: buildPrompt(course, week) },
          { type: 'image', data: imageBase64, mime_type: mimeType },
        ],
      }),
      signal: AbortSignal.timeout(50000),
    })

    if (!upstream.ok) {
      const detail = await upstream.text()
      console.error('Gemini respondió', upstream.status, detail)

      // El 429 es el caso realista: se agotó la cuota gratuita del día.
      if (upstream.status === 429) {
        return res.status(429).json({
          error: 'Se agotó la cuota gratuita de Gemini por ahora. Intenta más tarde.',
        })
      }
      return res.status(502).json({
        error: `El servicio de resumen falló (${upstream.status}).`,
      })
    }

    const data = await upstream.json()
    const summary = extractText(data)

    if (!summary) {
      return res.status(502).json({ error: 'El modelo no devolvió texto.' })
    }

    return res.status(200).json({ summary })
  } catch (err) {
    console.error(err)
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError'
    return res.status(504).json({
      error: timedOut
        ? 'El análisis tardó demasiado. Intenta de nuevo.'
        : 'No se pudo contactar al servicio de resumen.',
    })
  }
}
