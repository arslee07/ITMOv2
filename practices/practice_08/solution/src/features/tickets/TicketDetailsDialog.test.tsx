import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/tickets'
import { TicketDetailsDialog } from '@/features/tickets/TicketDetailsDialog'
import { makeTicket } from '@/test/fixtures'

describe('TicketDetailsDialog', () => {
  it('показывает данные тикета и меняет статус на «в работе»', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi.fn().mockResolvedValue(undefined)
    const ticket = makeTicket({ title: 'Тикет в диалоге' })

    render(
      <TicketDetailsDialog
        ticket={ticket}
        open
        onOpenChange={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    )

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Тикет в диалоге' })).toBeInTheDocument()
    expect(within(dialog).getByText(ticket.description)).toBeInTheDocument()
    expect(within(dialog).getByText(/Анна/)).toBeInTheDocument()
    expect(within(dialog).getByText('94%')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /Взять в работу/ }))
    expect(onStatusChange).toHaveBeenCalledWith('in-progress')
  })

  it('закрывается кнопкой и по Escape', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <TicketDetailsDialog
        ticket={makeTicket()}
        open
        onOpenChange={onOpenChange}
        onStatusChange={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Закрыть' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)

    await user.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('для закрытого тикета не показывает действий', () => {
    render(
      <TicketDetailsDialog
        ticket={makeTicket({ status: 'closed' })}
        open
        onOpenChange={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: /Взять в работу/ })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /Закрыть тикет/ })).not.toBeInTheDocument()
  })

  it('показывает ошибку смены статуса и оставляет диалог открытым', async () => {
    const user = userEvent.setup()
    const onStatusChange = vi
      .fn()
      .mockRejectedValue(new ApiError(500, 'INTERNAL_ERROR', 'Сервер не ответил.'))

    render(
      <TicketDetailsDialog
        ticket={makeTicket()}
        open
        onOpenChange={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    )

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /Взять в работу/ }))

    expect(await within(dialog).findByText('Не удалось изменить тикет')).toBeInTheDocument()
    expect(within(dialog).getByText('Сервер не ответил.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('блокирует действие, пока статус сохраняется', async () => {
    const user = userEvent.setup()
    let resolve!: () => void
    const pending = new Promise<void>((done) => {
      resolve = done
    })
    const onStatusChange = vi.fn().mockReturnValue(pending)

    render(
      <TicketDetailsDialog
        ticket={makeTicket()}
        open
        onOpenChange={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    )

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /Взять в работу/ }))

    expect(within(dialog).getByRole('button', { name: /Сохраняем/ })).toBeDisabled()

    resolve()
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /Взять в работу/ })).toBeEnabled(),
    )
  })
})
