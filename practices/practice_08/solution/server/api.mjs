import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const TYPES = ['bug', 'task', 'feature', 'unknown']
const STATUSES = ['triaged', 'needs-triage', 'in-progress', 'closed']
const MAX_BODY_BYTES = 64 * 1024

const KEYWORDS = {
  bug: [
    'ошибк',
    'падает',
    'упал',
    'краш',
    'crash',
    'баг',
    'bug',
    'не работает',
    'сломал',
    'исключен',
    'exception',
    'stack trace',
    '500',
    'зависа',
    'тормоз',
    'регресс',
  ],
  feature: [
    'добав',
    'хочу',
    'фич',
    'feature',
    'интеграц',
    'поддержк',
    'новый функционал',
    'было бы здорово',
    'предлага',
    'хотелось бы',
    'enable',
  ],
  task: [
    'обнов',
    'рефактор',
    'документац',
    'task',
    'задач',
    'переименов',
    'улучш',
    'оптимиз',
    'тест',
    'миграц',
    'настро',
  ],
}

function classifierMode() {
  return (process.env.CLASSIFIER || 'heuristic').toLowerCase()
}

function dataFile() {
  return path.resolve(ROOT, process.env.DATA_FILE || 'var/tickets.json')
}

function json(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, x-simulate-error',
    'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
  })
  res.end(body)
}

export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Тело запроса слишком большое.'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) return resolve({})
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new HttpError(400, 'INVALID_JSON', 'Тело запроса должно быть корректным JSON.'))
      }
    })
    req.on('error', reject)
  })
}

export function validateTicketInput(input) {
  const fields = {}
  const title = typeof input?.title === 'string' ? input.title.trim() : ''
  const description = typeof input?.description === 'string' ? input.description.trim() : ''
  const author = typeof input?.author === 'string' ? input.author.trim() : ''

  if (!title) fields.title = 'Укажите заголовок обращения.'
  else if (title.length < 3) fields.title = 'Заголовок должен быть не короче 3 символов.'
  else if (title.length > 120) fields.title = 'Заголовок должен быть не длиннее 120 символов.'

  if (!description) fields.description = 'Опишите проблему или предложение.'
  else if (description.length < 10) fields.description = 'Описание должно быть не короче 10 символов.'
  else if (description.length > 4000) fields.description = 'Описание должно быть не длиннее 4000 символов.'

  if (!author) fields.author = 'Укажите, кто отправил обращение.'
  else if (author.length < 2) fields.author = 'Имя автора должно быть не короче 2 символов.'
  else if (author.length > 60) fields.author = 'Имя автора должно быть не длиннее 60 символов.'

  if (Object.keys(fields).length > 0) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Проверьте заполнение полей.', fields)
  }

  return { title, description, author }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function heuristicClassify(title, description) {
  const text = `${title} ${description}`.toLowerCase()
  const scores = { bug: 0, feature: 0, task: 0 }

  for (const [type, words] of Object.entries(KEYWORDS)) {
    for (const word of words) {
      if (!text.includes(word)) continue
      scores[type] += 1
      if (title.toLowerCase().includes(word)) scores[type] += 1
    }
  }

  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1])
  const [topType, topScore] = ranked[0]
  const total = ranked.reduce((sum, [, score]) => sum + score, 0)

  if (topScore === 0) {
    return { type: 'unknown', confidence: 0.45, classifier: 'heuristic' }
  }

  const share = topScore / total
  const confidence = clamp(0.5 + 0.48 * share * clamp(topScore / 2, 0.5, 1), 0.5, 0.97)

  return { type: topType, confidence: Number(confidence.toFixed(2)), classifier: 'heuristic' }
}

function parseClassification(raw) {
  const match = String(raw).match(/\{[\s\S]*\}/)
  const parsed = match ? JSON.parse(match[0]) : JSON.parse(String(raw))
  const type = TYPES.includes(parsed.type) ? parsed.type : 'unknown'
  const confidence = clamp(Number(parsed.confidence), 0, 1)
  return {
    type,
    confidence: Number((Number.isFinite(confidence) ? confidence : 0.4).toFixed(2)),
    classifier: 'llm',
  }
}

const SYSTEM_PROMPT = `Ты классификатор обращений в поддержку проекта.
Верни строго JSON без пояснений: {"type":"bug"|"task"|"feature"|"unknown","confidence":0..1}
bug — что-то сломано, ошибка, падение, регресс.
task — рефакторинг, документация, обновление, настройка, тесты.
feature — новая возможность, интеграция, расширение функционала.
unknown — непонятно или смешаны несколько типов.
confidence — насколько ты уверен в типе.`

async function classifyWithLlm(title, description) {
  const key = process.env.VSELLM_API_KEY
  if (!key) throw new Error('VSELLM_API_KEY is not set')

  const base = (process.env.VSELLM_BASE_URL || 'https://litellm.data-light.ru/v1').replace(/\/$/, '')
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.VSELLM_MODEL || 'openai/gpt-5.2',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Заголовок: ${title}\nОписание: ${description}` },
      ],
    }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) throw new Error(`LLM responded with ${response.status}`)
  const data = await response.json()
  return parseClassification(data?.choices?.[0]?.message?.content ?? '{}')
}

async function classifyWithN8n(title, description) {
  const url = process.env.N8N_WEBHOOK_URL
  if (!url) throw new Error('N8N_WEBHOOK_URL is not set')

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title, body: description }),
    signal: AbortSignal.timeout(25_000),
  })

  if (!response.ok) throw new Error(`n8n responded with ${response.status}`)
  return parseClassification(await response.text())
}

export async function classify(title, description) {
  const mode = classifierMode()

  if (mode === 'llm' || mode === 'n8n') {
    try {
      return mode === 'llm'
        ? await classifyWithLlm(title, description)
        : await classifyWithN8n(title, description)
    } catch (error) {
      const fallback = heuristicClassify(title, description)
      return {
        ...fallback,
        classifier: 'heuristic-fallback',
        fallbackReason: error instanceof Error ? error.message : String(error),
      }
    }
  }

  return heuristicClassify(title, description)
}

function buildTicket(input, classification) {
  const now = new Date().toISOString()
  const triaged = classification.type !== 'unknown' && classification.confidence >= 0.8

  return {
    id: `tkt_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`,
    title: input.title,
    description: input.description,
    author: input.author,
    type: classification.type,
    confidence: classification.confidence,
    classifier: classification.classifier,
    label: triaged ? classification.type : 'needs-triage',
    status: triaged ? 'triaged' : 'needs-triage',
    createdAt: now,
    updatedAt: now,
  }
}

async function readTickets() {
  try {
    const raw = await fs.readFile(dataFile(), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

let storeLock = Promise.resolve()

function withStoreLock(task) {
  const run = storeLock.then(task, task)
  storeLock = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function writeTickets(tickets) {
  const file = dataFile()
  await fs.mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  await fs.writeFile(tmp, `${JSON.stringify(tickets, null, 2)}\n`, 'utf8')
  await fs.rename(tmp, file)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function simulatedFailure(req) {
  return process.env.SIMULATE_ERROR === '1' || req.headers['x-simulate-error'] === '1'
}

function apiErrorMessage(error) {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      payload: { error: { code: error.code, message: error.message, fields: error.fields } },
    }
  }

  return {
    status: 500,
    payload: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Не удалось обработать запрос. Попробуйте ещё раз.',
      },
    },
  }
}

export async function handleApi(req, res) {
  if (req.method === 'OPTIONS') {
    json(res, 204, {})
    return
  }

  const url = new URL(req.url || '/', 'http://localhost')
  const route = url.pathname.replace(/^\/api/, '') || '/'
  const delayMs = Number(process.env.API_DELAY_MS || 0)

  try {
    if (route === '/health' && req.method === 'GET') {
      json(res, 200, { ok: true, classifier: classifierMode() })
      return
    }

    if (route === '/tickets' && req.method === 'GET') {
      if (delayMs > 0) await sleep(Math.min(delayMs, 200))
      const tickets = await readTickets()
      json(res, 200, { tickets })
      return
    }

    if (route === '/tickets' && req.method === 'POST') {
      const payload = await readBody(req)
      const input = validateTicketInput(payload)

      if (simulatedFailure(req)) {
        throw new HttpError(
          503,
          'CLASSIFIER_UNAVAILABLE',
          'Классификатор временно недоступен. Проверьте ввод и повторите попытку.',
        )
      }

      if (delayMs > 0) await sleep(Math.min(delayMs, 5000))
      const classification = await classify(input.title, input.description)
      const ticket = buildTicket(input, classification)

      await withStoreLock(async () => {
        const tickets = await readTickets()
        await writeTickets([ticket, ...tickets])
      })

      json(res, 201, { ticket })
      return
    }

    const patchMatch = route.match(/^\/tickets\/([^/]+)$/)
    if (patchMatch && req.method === 'PATCH') {
      const id = decodeURIComponent(patchMatch[1])
      const payload = await readBody(req)
      const nextStatus = payload?.status

      if (!STATUSES.includes(nextStatus) || nextStatus === 'triaged' || nextStatus === 'needs-triage') {
        throw new HttpError(422, 'INVALID_STATUS', 'Недопустимый статус тикета.')
      }

      const updated = await withStoreLock(async () => {
        const tickets = await readTickets()
        const index = tickets.findIndex((ticket) => ticket.id === id)
        if (index === -1) throw new HttpError(404, 'NOT_FOUND', 'Тикет не найден.')
        if (tickets[index].status === 'closed') {
          throw new HttpError(409, 'ALREADY_CLOSED', 'Закрытый тикет нельзя изменить.')
        }
        tickets[index] = {
          ...tickets[index],
          status: nextStatus,
          updatedAt: new Date().toISOString(),
        }
        await writeTickets(tickets)
        return tickets[index]
      })

      json(res, 200, { ticket: updated })
      return
    }

    throw new HttpError(404, 'NOT_FOUND', 'Маршрут не найден.')
  } catch (error) {
    const { status, payload } = apiErrorMessage(error)
    json(res, status, payload)
  }
}
