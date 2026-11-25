import type { TicketClassifier, TicketStatus, TicketType } from '@/types'

export const TYPE_VARIANT: Record<TicketType, 'bug' | 'task' | 'feature' | 'neutral'> = {
  bug: 'bug',
  task: 'task',
  feature: 'feature',
  unknown: 'neutral',
}

export const TYPE_LABEL: Record<TicketType, string> = {
  bug: 'bug',
  task: 'task',
  feature: 'feature',
  unknown: 'unknown',
}

export const STATUS_LABEL: Record<TicketStatus, string> = {
  triaged: 'Новый',
  'needs-triage': 'На триаже',
  'in-progress': 'В работе',
  closed: 'Закрыт',
}

export const STATUS_VARIANT: Record<TicketStatus, 'info' | 'warning' | 'neutral'> = {
  triaged: 'info',
  'needs-triage': 'warning',
  'in-progress': 'info',
  closed: 'neutral',
}

const CLASSIFIER_LABEL: Record<TicketClassifier, string> = {
  llm: 'AI-классификатор',
  heuristic: 'эвристика',
  'heuristic-fallback': 'эвристика (fallback)',
}

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

export function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function formatTicketId(id: string): string {
  const tail = id.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase()
  return `TRI-${tail.padStart(4, '0')}`
}

export function classifierLabel(classifier: TicketClassifier): string {
  return CLASSIFIER_LABEL[classifier] ?? classifier
}

export function pluralizeTickets(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} обращение`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} обращения`
  return `${count} обращений`
}
