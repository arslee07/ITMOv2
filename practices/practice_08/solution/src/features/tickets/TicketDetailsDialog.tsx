import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { errorMessage } from '@/api/tickets'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  classifierLabel,
  formatConfidence,
  formatDate,
  formatTicketId,
  STATUS_LABEL,
  STATUS_VARIANT,
  TYPE_LABEL,
  TYPE_VARIANT,
} from '@/features/tickets/presentation'
import type { MutableTicketStatus, Ticket } from '@/types'

interface TicketDetailsDialogProps {
  ticket: Ticket
  open: boolean
  onOpenChange: (open: boolean) => void
  onStatusChange: (status: MutableTicketStatus) => Promise<void>
}

export function TicketDetailsDialog({
  ticket,
  open,
  onOpenChange,
  onStatusChange,
}: TicketDetailsDialogProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSaving(false)
    setError(null)
  }, [ticket.id, open])

  const nextAction: { status: MutableTicketStatus; label: string } | null =
    ticket.status === 'closed'
      ? null
      : ticket.status === 'in-progress'
        ? { status: 'closed', label: 'Закрыть тикет' }
        : { status: 'in-progress', label: 'Взять в работу' }

  async function handleStatusChange(status: MutableTicketStatus) {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await onStatusChange(status)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 rounded-xl border-border p-0 sm:max-w-[540px]">
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <div className="mb-2 flex items-center gap-2">
            <span className="mono-label">{formatTicketId(ticket.id)}</span>
            <span className="text-border" aria-hidden="true">
              /
            </span>
            <span className="mono-label">Полное обращение</span>
          </div>
          <DialogTitle className="pr-6 text-xl tracking-tight">{ticket.title}</DialogTitle>
          <DialogDescription>Детали обращения и результат классификации</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div>
            <span className="mono-label">Описание</span>
            <p className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-secondary-foreground">
              {ticket.description}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-accent p-3.5">
            <div>
              <dt className="mono-label">Тип</dt>
              <dd className="mt-1.5">
                <Badge
                  variant={TYPE_VARIANT[ticket.type]}
                  className="font-mono text-[10px] uppercase tracking-[0.06em]"
                >
                  {TYPE_LABEL[ticket.type]}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="mono-label">Уверенность</dt>
              <dd className="mt-1.5 text-sm font-medium">{formatConfidence(ticket.confidence)}</dd>
            </div>
            <div>
              <dt className="mono-label">Автор</dt>
              <dd className="mt-1.5 text-sm">{ticket.author}</dd>
            </div>
            <div>
              <dt className="mono-label">Статус</dt>
              <dd className="mt-1.5">
                <Badge variant={STATUS_VARIANT[ticket.status]} className="text-[10px]">
                  {STATUS_LABEL[ticket.status]}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="mono-label">Классификатор</dt>
              <dd className="mt-1.5 text-sm">{classifierLabel(ticket.classifier)}</dd>
            </div>
            <div>
              <dt className="mono-label">Обновлён</dt>
              <dd className="mt-1.5 text-sm">{formatDate(ticket.updatedAt)}</dd>
            </div>
          </dl>

          {error ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Не удалось изменить тикет</AlertTitle>
              <AlertDescription>
                <p>{error}</p>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <DialogClose asChild>
            <Button variant="outline" className="rounded-lg">
              Закрыть
            </Button>
          </DialogClose>
          {nextAction ? (
            <Button
              type="button"
              onClick={() => handleStatusChange(nextAction.status)}
              disabled={saving}
              className="rounded-lg"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Сохраняем…
                </>
              ) : (
                <>
                  <CheckCircle2 aria-hidden="true" />
                  {nextAction.label}
                </>
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
