# Fotos de Clases

App para el curso de Arquitectura Empresarial (puntos extra). Toma una foto
de la pizarra desde el celular y la sube automáticamente a Google Drive,
organizada en `Fotos Clases / <Curso> / Semana <n>`, detectando el curso y
la semana según tu horario y la fecha/hora en que tomas la foto.

## 1. Terminar de configurar Google Cloud Console

Ya creaste el proyecto y habilitaste la API de Drive. Ahora:

1. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de
   cliente de OAuth**.
2. Tipo de aplicación: **Aplicación web**.
3. En **Orígenes de JavaScript autorizados** agrega:
   - `http://localhost:5173` (para probar en tu compu)
   - `https://TU-PROYECTO.vercel.app` (la URL que te dé Vercel en el paso 3)
4. No hace falta configurar "URIs de redireccionamiento" (esta app usa el
   flujo de token de Google Identity Services, no redirección).
5. Copia el **Client ID** que te genera (termina en
   `.apps.googleusercontent.com`).
6. En **Pantalla de consentimiento OAuth**, en la sección "Usuarios de
   prueba", agrega tu propio correo de Google (el que uses para el Drive
   donde quieres que se guarden las fotos). Mientras la app esté en modo
   "Prueba" solo funcionará para los correos que agregues ahí — está bien,
   es de uso personal.

## 2. Probar en tu compu

```bash
npm install
cp .env.example .env
# pega tu Client ID en .env
npm run dev
```

Abre `http://localhost:5173`. Como es solo para probar en la compu, la
cámara no se abrirá directo (no hay cámara en la laptop probablemente),
pero puedes seleccionar una foto de prueba desde tus archivos para
verificar que la conexión con Drive y la subida funcionan.

## 3. Desplegar en Vercel

1. Sube esta carpeta a un repositorio de GitHub (nuevo repo, `git init`,
   `git add .`, `git commit`, `git push`).
2. En Vercel: **Add New → Project**, importa ese repositorio.
3. En **Environment Variables**, agrega:
   - `VITE_GOOGLE_CLIENT_ID` = tu Client ID de Google.
4. Deploy. Vercel te da una URL tipo `https://fotos-clases-app.vercel.app`.
5. Vuelve al paso 1 y agrega esa URL exacta a los "Orígenes de JavaScript
   autorizados" en Google Cloud Console (si no la habías puesto ya).

## 4. Usar desde el celular

1. Abre la URL de Vercel en Chrome/Safari de tu celular.
2. Opcional: en el menú del navegador elige "Agregar a pantalla de inicio"
   para que quede como un ícono más, como una app.
3. Toca "Conectar con Google Drive" la primera vez (te va a pedir permiso;
   como está en modo prueba, si Google muestra una advertencia de "app no
   verificada", dale a "Avanzado → Ir a Fotos de Clases (no seguro)" — es
   normal para apps personales que no se han publicado).
4. Toca "Tomar foto", se abre la cámara, tomas la foto de la pizarra.
5. La app detecta el curso y la semana automáticamente. Revisa que estén
   bien (puedes corregirlos con los selectores) y toca "Subir a Drive".

## Si el horario cambia

Todo el horario está en `src/schedule.js`. Es una lista simple de bloques
(día, curso, hora de inicio, hora de fin) — solo edita esa lista, no hace
falta tocar el resto del código.
