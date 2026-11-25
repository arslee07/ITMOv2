import type { CreateTicketInput, Ticket, TicketStatus, TicketType } from '@/types'

let counter = 0

export const FIXED_DATE = '2026-11-25T09:00:00.000Z'

export function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  counter += 1
  return {
    id: `tkt_test_${counter}`,
    title: 'Приложение падает при сохранении',
    description: 'При сохранении профиля появляется ошибка 500, данные не сохраняются.',
    author: 'Анна',
    type: 'bug',
    confidence: 0.94,
    classifier: 'llm',
    label: 'bug',
    status: 'triaged',
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  }
}

export function classifyFixture(input: CreateTicketInput): {
  type: TicketType
  confidence: number
  label: string
  status: TicketStatus
} {
  const text = `${input.title} ${input.description}`.toLowerCase()

  if (/падает|ошибк|не работает|баг|500/.test(text)) {
    return { type: 'bug', confidence: 0.94, label: 'bug', status: 'triaged' }
  }
  if (/добав|хочу|интеграц|фич/.test(text)) {
    return { type: 'feature', confidence: 0.9, label: 'feature', status: 'triaged' }
  }
  return { type: 'task', confidence: 0.86, label: 'task', status: 'triaged' }
}
