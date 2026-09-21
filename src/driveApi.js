// ============================================================
// Integración con Google Drive.
// Usa el scope "drive.file", que solo da acceso a los archivos
// y carpetas que esta app crea (no a todo tu Drive).
// ============================================================

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const ROOT_FOLDER_NAME = 'Fotos Clases'
const SCOPE = 'https://www.googleapis.com/auth/drive.file'

let tokenClient = null
let accessToken = null
let tokenExpiresAt = 0
let googleReady = null

// El script de Google Identity Services se carga con "async defer" en
// index.html, así que normalmente TODAVÍA no ha terminado de cargar cuando
// React monta la app. Esperamos a que window.google exista en vez de
// rendirnos en el primer intento.
function waitForGoogle(timeoutMs = 10000) {
  if (googleReady) return googleReady

  googleReady = new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const check = () => {
      if (window.google?.accounts?.oauth2) {
        resolve(window.google)
        return
      }
      if (Date.now() - startedAt > timeoutMs) {
        googleReady = null // permite reintentar en el siguiente clic
        reject(
          new Error(
            'No se pudo cargar el script de Google (accounts.google.com). ' +
              'Revisa tu conexión o si alguna extensión/bloqueador lo está bloqueando.'
          )
        )
        return
      }
      setTimeout(check, 100)
    }
    check()
  })

  return googleReady
}

/**
 * Inicializa el cliente de Google Identity Services, esperando a que el
 * script de GIS termine de cargar (ver index.html).
 */
export async function initGoogleAuth() {
  if (tokenClient) return tokenClient

  if (!CLIENT_ID) {
    throw new Error(
      'Falta VITE_GOOGLE_CLIENT_ID. Crea un archivo .env con tu Client ID ' +
        'de Google Cloud Console y reinicia el servidor (npm run dev).'
    )
  }

  const google = await waitForGoogle()

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: () => {}, // se sobreescribe en cada requestAccessToken()
  })

  return tokenClient
}

function hasValidToken() {
  return accessToken && Date.now() < tokenExpiresAt
}

/**
 * Pide (o reutiliza) un access token válido. Si ya hay uno vigente,
 * no vuelve a mostrar la ventana de Google.
 */
export async function requestAccessToken({ interactive = true } = {}) {
  if (hasValidToken()) return accessToken

  const client = await initGoogleAuth()

  return new Promise((resolve, reject) => {
    client.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error_description || response.error))
        return
      }
      accessToken = response.access_token
      // expires_in viene en segundos; restamos un margen de seguridad de 60s
      tokenExpiresAt = Date.now() + (response.expires_in - 60) * 1000
      resolve(accessToken)
    }

    // Sin esto, si cierras la ventana de Google la promesa se queda colgada
    // para siempre y el botón deja de responder.
    client.error_callback = (err) => {
      reject(new Error(err?.type || 'Se cerró la ventana de Google sin autorizar.'))
    }

    client.requestAccessToken({ prompt: interactive ? 'consent' : '' })
  })
}

export function isConnected() {
  return hasValidToken()
}

async function driveFetch(url, options = {}) {
  const token = await requestAccessToken({ interactive: false })
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Error de Drive (${res.status}): ${text}`)
  }
  return res.json()
}

// Cache local de IDs de carpetas ya creadas/encontradas, para no
// tener que buscarlas en Drive cada vez (persiste entre sesiones).
function getFolderCache() {
  try {
    return JSON.parse(localStorage.getItem('driveFolderCache') || '{}')
  } catch {
    return {}
  }
}

function saveFolderCache(cache) {
  localStorage.setItem('driveFolderCache', JSON.stringify(cache))
}

/**
 * Busca una carpeta por nombre dentro de un padre dado. Si no existe,
 * la crea. Usa un cache en localStorage para evitar búsquedas repetidas.
 */
async function getOrCreateFolder(name, parentId) {
  const cache = getFolderCache()
  const cacheKey = `${parentId || 'root'}/${name}`
  if (cache[cacheKey]) return cache[cacheKey]

  const parentClause = parentId ? `'${parentId}' in parents` : "'root' in parents"
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and ${parentClause} and trashed=false`
  )

  const searchResult = await driveFetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`
  )

  let folderId
  if (searchResult.files && searchResult.files.length > 0) {
    folderId = searchResult.files[0].id
  } else {
    const metadata = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    }
    const created = await driveFetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    })
    folderId = created.id
  }

  cache[cacheKey] = folderId
  saveFolderCache(cache)
  return folderId
}

/**
 * La cámara del iPhone entrega todas las fotos llamadas "image.jpg", así que
 * en Drive quedarían todas con el mismo nombre. Les armamos uno legible:
 * "Semana 6 - 2026-09-21 14.30.jpg".
 */
function buildFileName(file, week) {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}`
  const ext = file.name?.match(/\.[a-z0-9]+$/i)?.[0] || '.jpg'
  return `Semana ${week} - ${stamp}${ext}`
}

/**
 * Sube una foto a Drive dentro de "Fotos Clases/<curso>/Semana <n>",
 * creando las carpetas que hagan falta.
 */
export async function uploadPhoto({ file, course, week, onProgress = () => {} }) {
  const rootId = await getOrCreateFolder(ROOT_FOLDER_NAME, null)
  const courseId = await getOrCreateFolder(course, rootId)
  const weekId = await getOrCreateFolder(`Semana ${week}`, courseId)

  const token = await requestAccessToken({ interactive: false })

  const metadata = {
    name: buildFileName(file, week),
    parents: [weekId],
  }

  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', file)

  // Usamos XMLHttpRequest en vez de fetch porque es la única forma de leer
  // el progreso real de una subida en el navegador: fetch no expone eventos
  // de progreso al enviar el cuerpo.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(
      'POST',
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink'
    )
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1)
        try {
          resolve(JSON.parse(xhr.responseText))
        } catch {
          resolve({})
        }
      } else {
        reject(new Error(`Error subiendo la foto (${xhr.status}): ${xhr.responseText}`))
      }
    }

    xhr.onerror = () =>
      reject(new Error('Se perdió la conexión mientras se subía la foto. Revisa tu internet.'))
    xhr.ontimeout = () => reject(new Error('La subida tardó demasiado. Intenta de nuevo.'))

    xhr.send(form)
  })
}
