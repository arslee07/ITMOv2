import { useId } from 'react'
import { ChevronRight, CircleDot, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  formatConfidence,
  formatDate,
  formatTicketId,
  STATUS_LABEL,
  TYPE_LABEL,
  TYPE_VARIANT,
} from '@/features/tickets/presentation'
import type { Ticket } from '@/types'

interface TicketCardProps {
  ticket: Ticket
  onOpen: (ticket: Ticket) => void
}

export function TicketCard({ ticket, onOpen }: TicketCardProps) {
  const titleId = useId()

  return (
    <article
      aria-labelledby={titleId}
      className="rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:border-muted-foreground/30 sm:px-5 sm:py-[18px]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="mono-label">{formatTicketId(ticket.id)}</span>
            <span className="text-border" aria-hidden="true">
              /
            </span>
            <time className="mono-label" dateTime={ticket.createdAt}>
              {formatDate(ticket.createdAt)}
            </time>
          </div>
          <h3 id={titleId} className="text-[15px] font-semibold tracking-[-0.015em]">
            {ticket.title}
          </h3>
        </div>
        <span className="hidden shrink-0 rounded-md border border-border bg-accent px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground sm:inline-flex">
          AI · {formatConfidence(ticket.confidence)}
        </span>
      </div>

      <p className="mt-2 line-clamp-2 max-w-3xl text-[13px] leading-[1.65] text-muted-foreground">
        {ticket.description}
      </p>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border/70 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={TYPE_VARIANT[ticket.type]} className="font-mono text-[10px] uppercase tracking-[0.06em]">
            {TYPE_LABEL[ticket.type]}
          </Badge>
          <Badge variant="outline" className="gap-1 px-2 py-0.5 text-[10px] font-normal">
            <CircleDot className="size-2.5" aria-hidden="true" />
            {STATUS_LABEL[ticket.status]}
          </Badge>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground sm:hidden">
            AI · {formatConfidence(ticket.confidence)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
            <User className="size-3.5" aria-hidden="true" />
            {ticket.author}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpen(ticket)}
            className="h-7 gap-1 rounded-md px-2 text-xs"
          >
            Подробнее
            <ChevronRight aria-hidden="true" />
            <span className="sr-only">о тикете «{ticket.title}»</span>
          </Button>
        </div>
      </div>
    </article>
  )
}
