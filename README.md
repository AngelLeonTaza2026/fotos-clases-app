# Fotos de Clases

App web para el curso de Arquitectura Empresarial. Tomas una foto de la
pizarra desde el celular y se sube sola a Google Drive, ya organizada en
`Fotos Clases / <Curso> / Semana <n>` — detectando el curso y la semana
según el horario y la fecha/hora en que tomaste la foto.

**En vivo:** https://fotos-clases-app.vercel.app

## Cómo funciona

Cuando eliges una foto, la app lee la fecha y hora del momento y:

1. **Detecta el curso** — busca en el horario (`src/schedule.js`) el bloque
   que corresponde al día y la hora actual, con 20 minutos de tolerancia
   antes y después, por si tomas la foto justo al empezar o al terminar.
2. **Calcula la semana** — cuenta los días transcurridos desde el lunes de
   la semana 1 del ciclo y los divide entre 7.
3. **Crea las carpetas que falten** en Drive y sube la foto ahí.
4. **Genera un resumen** del contenido de la pizarra con Gemini y lo guarda
   como Google Doc en la misma carpeta, junto a la foto.

El resumen nunca bloquea la foto: primero se sube la imagen y solo después
se analiza. Si la IA falla o se agota la cuota, la foto ya quedó guardada y
la app solo avisa que el resumen no salió.

Ambos valores se muestran antes de subir y se pueden corregir a mano si la
detección falla (por ejemplo, si tomas la foto en la noche).

## Stack

React + Vite + Tailwind, desplegado en Vercel. El navegador habla directo con
la API de Drive usando Google Identity Services.

Hay una única función de servidor, `api/summarize.js`, y existe por seguridad:
la clave de Gemini no puede vivir en el navegador, donde cualquiera podría
extraerla del bundle. El Client ID de Google sí puede, porque es público por
diseño; la clave de Gemini no lo es.

El permiso que pide es `drive.file`, el más acotado que existe: la app solo
puede ver y modificar los archivos y carpetas **que ella misma crea**. No
tiene acceso al resto del Drive.

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/schedule.js` | El horario del ciclo. **Es el único archivo que hay que editar si cambia el horario.** |
| `src/utils/matchSchedule.js` | Encuentra qué clase corresponde a una fecha/hora. |
| `src/utils/weekCalculator.js` | Calcula el número de semana del ciclo. |
| `src/utils/agenda.js` | Clases del día, progreso de la clase en curso, cuenta regresiva a la siguiente. |
| `src/utils/courseTheme.js` | Asigna un color a cada curso automáticamente. |
| `src/driveApi.js` | Autenticación con Google, subida de la foto y creación del Doc del resumen. |
| `src/summaryApi.js` | Reduce la foto y pide el resumen al servidor. |
| `api/summarize.js` | Función serverless: llama a Gemini con la clave secreta. |
| `src/App.jsx` | Interfaz. |

## Correr en local

```bash
npm install
cp .env.example .env   # pega tu Client ID de Google dentro
npm run dev
```

Abre `http://localhost:5173`. En la laptop el botón "Tomar foto" abre el
selector de archivos en vez de la cámara; desde el celular sí abre la cámara.

## Si el horario cambia

Edita la lista `SCHEDULE` en `src/schedule.js` y, si es un ciclo nuevo,
actualiza también `SEMESTER_START` (el lunes de la semana 1). No hace falta
tocar nada más: los colores de curso se asignan solos y los selectores se
arman desde esa misma lista.

Al hacer `git push`, Vercel vuelve a desplegar automáticamente.

## Configuración (ya hecha, como referencia)

- **Google Cloud** — API de Drive habilitada, pantalla de consentimiento en
  modo *Interno*, y un ID de cliente OAuth tipo "Aplicación web" con estos
  orígenes de JavaScript autorizados:
  - `http://localhost:5173`
  - `https://fotos-clases-app.vercel.app`
- **Vercel** — dos variables de entorno:
  - `VITE_GOOGLE_CLIENT_ID` — el Client ID de Google (público).
  - `GEMINI_API_KEY` — la clave de Google AI Studio (secreta). Sin el
    prefijo `VITE_` a propósito: así Vite nunca la incluye en el bundle.

Al estar en modo *Interno*, solo funciona con cuentas de la institución.
