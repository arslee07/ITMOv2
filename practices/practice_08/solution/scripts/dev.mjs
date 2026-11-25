import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VAR = path.join(ROOT, 'var')
const PID_FILE = path.join(VAR, 'dev.pid')
const children = []
let shuttingDown = false

async function responds(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(700) })
    return response.ok
  } catch {
    return false
  }
}

async function preflight() {
  const [apiUp, viteUp] = await Promise.all([
    responds('http://127.0.0.1:8787/api/health'),
    responds('http://localhost:5173/'),
  ])

  if (apiUp && viteUp) {
    console.log('[dev] Уже запущено: http://localhost:5173')
    console.log('[dev] Остановить: make stop')
    process.exit(0)
  }

  if (apiUp) {
    console.error('[dev] Порт 8787 уже занят. Это старый API или другой процесс.')
    console.error('[dev] Остановите его: make stop, либо завершите процесс вручную.')
    process.exit(1)
  }

  if (viteUp) {
    console.error('[dev] Порт 5173 уже занят. Это старый Vite или другой процесс.')
    console.error('[dev] Остановите его: make stop, либо завершите процесс вручную.')
    process.exit(1)
  }
}

function writePid() {
  fs.mkdirSync(VAR, { recursive: true })
  fs.writeFileSync(PID_FILE, String(process.pid), 'utf8')
}

function removePid() {
  try {
    if (fs.readFileSync(PID_FILE, 'utf8').trim() === String(process.pid)) {
      fs.unlinkSync(PID_FILE)
    }
  } catch {
    // файла нет — уже удалён
  }
}

function start(label, args) {
  const child = spawn(process.execPath, args, {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
  })
  child.on('exit', (code) => {
    if (shuttingDown) return
    console.error(`[dev] ${label} завершился с кодом ${code}. Останавливаю остальные процессы.`)
    shutdown(code ?? 1)
  })
  children.push(child)
  return child
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  removePid()
  setTimeout(() => process.exit(code), 200)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
process.on('exit', removePid)

await preflight()
writePid()

start('api', ['server/server.mjs', '--api-only'])
start('vite', ['node_modules/vite/bin/vite.js'])

console.log('[dev] Vite: http://localhost:5173  ·  API: http://127.0.0.1:8787/api/health')
console.log('[dev] Остановить: make stop')
