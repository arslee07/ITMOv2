import { AlertCircle, ArrowDownUp, Clock3, Inbox, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { pluralizeTickets } from '@/features/tickets/presentation'
import { TicketCard } from '@/features/tickets/TicketCard'
import type { Ticket } from '@/types'

type ListState = 'loading' | 'ready' | 'error'

interface TicketListProps {
  tickets: Ticket[]
  state: ListState
  error: string
  sortOrder?: 'new' | 'old'
  onToggleSort?: () => void
  onRetry: () => void
  onOpen: (ticket: Ticket) => void
}

function LoadingState() {
  return (
    <div className="grid gap-3" aria-busy="true">
      <span className="sr-only" role="status">
        Загружаем обращения…
      </span>
      {[0, 1, 2].map((index) => (
        <div key={index} className="rounded-xl border border-border bg-card px-5 py-[18px]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2.5 h-5 w-2/3" />
            </div>
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-4/5" />
          <div className="mt-4 flex gap-2 border-t border-border/70 pt-3">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      <div>
        <Inbox className="mx-auto size-6 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium">Пока нет обращений</p>
      </div>
    </div>
  )
}

export function TicketList({
  tickets,
  state,
  error,
  sortOrder = 'new',
  onToggleSort,
  onRetry,
  onOpen,
}: TicketListProps) {
  return (
    <section aria-labelledby="tickets-heading" className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="mono-label">INBOX / TRIAGE</span>
            <span className="size-1 rounded-full bg-border" aria-hidden="true" />
            <span className="mono-label">LIVE QUEUE</span>
          </div>
          <div className="flex items-center gap-2.5">
            <h2 id="tickets-heading" className="text-xl font-semibold tracking-tight">
              Очередь обращений
            </h2>
            <Badge variant="secondary" className="rounded-md px-2 py-0.5 font-mono text-[11px]">
              {state === 'ready' ? tickets.length : '…'}
            </Badge>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={state === 'loading'}
          className="h-9 rounded-lg bg-card px-3 text-xs"
        >
          <RefreshCw className={state === 'loading' ? 'animate-spin' : undefined} aria-hidden="true" />
          Обновить
        </Button>
      </div>

      {state === 'loading' ? <LoadingState /> : null}

      {state === 'error' ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Не удалось загрузить обращения</AlertTitle>
          <AlertDescription>
            <p>{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw aria-hidden="true" />
              Повторить
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {state === 'ready' && tickets.length === 0 ? <EmptyState /> : null}

      {state === 'ready' && tickets.length > 0 ? (
        <ul className="grid gap-3">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <TicketCard ticket={ticket} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      ) : null}

      {state === 'ready' ? (
        <div className="mt-3 flex items-center justify-between px-1">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock3 className="size-3" aria-hidden="true" />
            Обновлено только что
          </span>
          <div className="flex items-center gap-3">
            <span className="mono-label">{pluralizeTickets(tickets.length)}</span>
            <button
              type="button"
              onClick={onToggleSort}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ArrowDownUp className="size-3" aria-hidden="true" />
              {sortOrder === 'new' ? 'Сначала новые' : 'Сначала старые'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
