import type { ApiErrorBody, CreateTicketInput, MutableTicketStatus, Ticket, ValidationErrors } from '@/types'

const API_BASE = `${import.meta.env.VITE_API_BASE ?? ''}/api`

export class ApiError extends Error {
  status: number
  code: string
  fields?: ValidationErrors

  constructor(status: number, code: string, message: string, fields?: ValidationErrors) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...init?.headers,
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'NETWORK_ERROR', 'Нет связи с сервером. Проверьте подключение и повторите попытку.')
  }

  const data = (await response.json().catch(() => ({}))) as T & ApiErrorBody

  if (!response.ok) {
    const body = data as ApiErrorBody
    throw new ApiError(
      response.status,
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'Не удалось выполнить запрос. Попробуйте ещё раз.',
      body.error?.fields,
    )
  }

  return data
}

export async function listTickets(signal?: AbortSignal): Promise<Ticket[]> {
  const data = await request<{ tickets: Ticket[] }>('/tickets', { signal })
  return data.tickets
}

export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const data = await request<{ ticket: Ticket }>('/tickets', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.ticket
}

export async function updateTicketStatus(id: string, status: MutableTicketStatus): Promise<Ticket> {
  const data = await request<{ ticket: Ticket }>(`/tickets/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
  return data.ticket
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return 'Не удалось выполнить запрос. Попробуйте ещё раз.'
}
