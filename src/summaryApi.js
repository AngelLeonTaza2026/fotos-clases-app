// ============================================================
// Genera el resumen de la foto llamando a /api/summarize.
// La API key vive en el servidor; aquí nunca aparece.
// ============================================================

// Las fotos del iPhone pesan 3-5 MB y Vercel corta las peticiones a
// 4.5 MB (y base64 las infla un 33% más). Además los modelos de visión
// no ganan nada con más de ~1568px de lado. Reducimos SOLO la copia que
// se manda a analizar: la que se sube a Drive sigue siendo la original.
const MAX_SIDE = 1568
const JPEG_QUALITY = 0.85

async function downscaleToJpeg(file) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  )
  if (!blob) throw new Error('No se pudo procesar la imagen.')
  return blob
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.onload = () => {
      // readAsDataURL devuelve "data:image/jpeg;base64,XXXX";
      // la API espera solo la parte de después de la coma.
      const result = String(reader.result)
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.readAsDataURL(blob)
  })
}

/**
 * Devuelve el texto del resumen, o lanza un error con un mensaje
 * legible. Quien llama decide si eso es fatal (no lo es: la foto ya
 * se subió antes de llegar aquí).
 */
export async function summarizePhoto({ file, course, week }) {
  const small = await downscaleToJpeg(file)
  const imageBase64 = await blobToBase64(small)

  const res = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType: 'image/jpeg', course, week }),
  })

  let payload = null
  try {
    payload = await res.json()
  } catch {
    // Si la respuesta no es JSON (por ejemplo, en `npm run dev` donde
    // /api no existe y Vite devuelve el index.html), lo decimos claro.
    throw new Error(
      res.status === 404
        ? 'El generador de resúmenes solo funciona en la versión desplegada, no en localhost.'
        : 'Respuesta inesperada del servidor.'
    )
  }

  if (!res.ok) throw new Error(payload?.error || 'No se pudo generar el resumen.')
  return payload.summary
}
