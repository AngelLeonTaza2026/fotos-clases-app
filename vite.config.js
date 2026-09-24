import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * En producción Vercel sirve la carpeta /api automáticamente, pero
 * `vite dev` no sabe nada de ella: cualquier llamada a /api/summarize
 * devolvería el index.html. Este plugin la monta en local para poder
 * probar el resumen sin tener que desplegar en cada cambio.
 */
function apiDevServer() {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use('/api/summarize', async (req, res) => {
        try {
          const { default: handler } = await server.ssrLoadModule('/api/summarize.js')

          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          req.body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}

          // Imitamos la interfaz de respuesta que espera Vercel.
          res.status = (code) => {
            res.statusCode = code
            return res
          }
          res.json = (obj) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(obj))
            return res
          }

          await handler(req, res)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: String(err?.message || err) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // GEMINI_API_KEY no lleva el prefijo VITE_ a propósito (así nunca llega
  // al navegador), pero el plugin de arriba sí la necesita en local.
  const env = loadEnv(mode, process.cwd(), '')
  if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY

  return { plugins: [react(), apiDevServer()] }
})
