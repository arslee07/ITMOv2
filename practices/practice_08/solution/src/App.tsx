import { useCallback, useEffect, useState } from 'react'
import { Inbox, Sparkles } from 'lucide-react'
import { createTicket, errorMessage, listTickets, updateTicketStatus } from '@/api/tickets'
import { Badge } from '@/components/ui/badge'
import { TicketDetailsDialog } from '@/features/tickets/TicketDetailsDialog'
import { TicketForm } from '@/features/tickets/TicketForm'
import { TicketList } from '@/features/tickets/TicketList'
import { formatConfidence } from '@/features/tickets/presentation'
import type { CreateTicketInput, MutableTicketStatus, Ticket } from '@/types'

type ListState = 'loading' | 'ready' | 'error'

export function App() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [listState, setListState] = useState<ListState>('loading')
  const [listError, setListError] = useState('')
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'new' | 'old'>('new')

  const load = useCallback(async (signal?: AbortSignal) => {
    setListState('loading')
    setListError('')
    try {
      const nextTickets = await listTickets(signal)
      setTickets(nextTickets)
      setListState('ready')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setListError(errorMessage(error))
      setListState('error')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  async function handleCreate(input: CreateTicketInput) {
    const ticket = await createTicket(input)
    setTickets((current) => [ticket, ...current.filter((item) => item.id !== ticket.id)])
    setListState('ready')
    setListError('')
    setSuccess(
      `Тикет создан: ${ticket.type}, уверенность ${formatConfidence(ticket.confidence)}, метка ${ticket.label}`,
    )
  }

  const selectedTicket = selectedId ? (tickets.find((ticket) => ticket.id === selectedId) ?? null) : null
  const visibleTickets = sortOrder === 'new' ? tickets : [...tickets].reverse()

  async function handleStatusChange(status: MutableTicketStatus) {
    if (!selectedTicket) return
    const updated = await updateTicketStatus(selectedTicket.id, status)
    setTickets((current) => current.map((ticket) => (ticket.id === updated.id ? updated : ticket)))
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-4 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-8">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg border border-border bg-card">
                <Inbox className="size-4 text-primary" aria-hidden="true" />
              </span>
              <span className="mono-label">SUPPORT / INTAKE</span>
            </div>
            <h1 className="text-[27px] font-semibold tracking-[-0.04em] sm:text-[32px]">
              Триаж обращений
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Баг-репорты в тикеты: тип, уверенность, очередь
            </p>
          </div>
          <Badge variant="outline" className="w-fit gap-1.5 rounded-full bg-card px-3 py-1.5 font-normal">
            <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
            AI-классификация
          </Badge>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1320px] gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <TicketForm
          onSubmit={handleCreate}
          success={success}
          onDismissSuccess={() => setSuccess(null)}
        />
        <TicketList
          tickets={visibleTickets}
          state={listState}
          error={listError}
          sortOrder={sortOrder}
          onToggleSort={() => setSortOrder((current) => (current === 'new' ? 'old' : 'new'))}
          onRetry={() => void load()}
          onOpen={(ticket) => setSelectedId(ticket.id)}
        />
      </main>

      <footer className="mx-auto w-full max-w-[1320px] px-4 pb-10 text-[11px] text-muted-foreground sm:px-8">
        API: POST /api/tickets · GET /api/tickets · PATCH /api/tickets/:id. Данные — в
        var/tickets.json.
      </footer>

      {selectedTicket ? (
        <TicketDetailsDialog
          ticket={selectedTicket}
          open={Boolean(selectedId)}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null)
          }}
          onStatusChange={handleStatusChange}
        />
      ) : null}
    </div>
  )
}
