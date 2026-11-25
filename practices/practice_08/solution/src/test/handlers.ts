import { http, HttpResponse } from 'msw'
import { classifyFixture, makeTicket } from '@/test/fixtures'
import type { CreateTicketInput, MutableTicketStatus, Ticket } from '@/types'

export const apiHandlers = [
  http.get('/api/tickets', () => HttpResponse.json({ tickets: [] as Ticket[] })),

  http.post('/api/tickets', async ({ request }) => {
    const input = (await request.json()) as CreateTicketInput
    const ticket = makeTicket({
      title: input.title,
      description: input.description,
      author: input.author,
      ...classifyFixture(input),
    })
    return HttpResponse.json({ ticket }, { status: 201 })
  }),

  http.patch('/api/tickets/:id', async ({ request, params }) => {
    const body = (await request.json()) as { status: MutableTicketStatus }
    const ticket = makeTicket({ id: String(params.id), status: body.status })
    return HttpResponse.json({ ticket })
  }),
]
