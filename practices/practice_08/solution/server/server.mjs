import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleApi } from './api.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const API_ONLY = process.argv.includes('--api-only')
const PORT = Number(process.env.PORT || 8787)

try {
  process.loadEnvFile(path.join(ROOT, '.env'))
} catch {
  // .env не обязателен
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

async function sendFile(req, res, file) {
  const data = await fs.readFile(file)
  res.writeHead(200, {
    'content-type': MIME[path.extname(file)] || 'application/octet-stream',
    'content-length': data.length,
    'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
  })
  res.end(req.method === 'HEAD' ? undefined : data)
}

async function serveStatic(req, res) {
  const url = new URL(req.url || '/', 'http://localhost')
  let pathname

  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    res.writeHead(400).end('Bad request')
    return
  }

  if (pathname === '/') pathname = '/index.html'

  const file = path.join(DIST, pathname)
  if (!file.startsWith(DIST + path.sep)) {
    res.writeHead(403).end('Forbidden')
    return
  }

  try {
    const stat = await fs.stat(file)
    if (stat.isDirectory()) {
      await sendFile(req, res, path.join(file, 'index.html'))
      return
    }
    await sendFile(req, res, file)
  } catch {
    if (path.extname(pathname)) {
      res.writeHead(404).end('Not found')
      return
    }
    try {
      await sendFile(req, res, path.join(DIST, 'index.html'))
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('Сборка не найдена. Запустите npm run build или npm run dev.')
    }
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url?.startsWith('/api')) {
    await handleApi(req, res)
    return
  }

  if (API_ONLY) {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Только API.' } }))
    return
  }

  await serveStatic(req, res)
})

server.listen(PORT, '127.0.0.1', () => {
  const scope = API_ONLY ? 'API' : 'API + статика'
  console.log(`[triage] ${scope} на http://127.0.0.1:${PORT}`)
  console.log(`[triage] классификатор: ${(process.env.CLASSIFIER || 'heuristic').toLowerCase()}`)
})
