import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TicketList } from '@/features/tickets/TicketList'
import { makeTicket } from '@/test/fixtures'

const noop = () => {}

describe('TicketList', () => {
  it('показывает скелетоны и статус загрузки', () => {
    render(
      <TicketList tickets={[]} state="loading" error="" onRetry={noop} onOpen={noop} />,
    )

    expect(screen.getByText('Загружаем обращения…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Обновить/ })).toBeDisabled()
  })

  it('показывает пустое состояние, когда тикетов нет', () => {
    render(<TicketList tickets={[]} state="ready" error="" onRetry={noop} onOpen={noop} />)

    expect(screen.getByText('Пока нет обращений')).toBeInTheDocument()
    expect(screen.getByText('0 обращений')).toBeInTheDocument()
  })

  it('показывает ошибку загрузки и повторяет запрос по кнопке', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(
      <TicketList
        tickets={[]}
        state="error"
        error="Сервер не ответил."
        onRetry={onRetry}
        onOpen={noop}
      />,
    )

    expect(screen.getByText('Не удалось загрузить обращения')).toBeInTheDocument()
    expect(screen.getByText('Сервер не ответил.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Повторить/ }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('переключает порядок сортировки по кнопке', async () => {
    const user = userEvent.setup()
    const onToggleSort = vi.fn()
    render(
      <TicketList
        tickets={[makeTicket()]}
        state="ready"
        error=""
        sortOrder="new"
        onToggleSort={onToggleSort}
        onRetry={noop}
        onOpen={noop}
      />,
    )

    await user.click(screen.getByRole('button', { name: /Сначала новые/ }))
    expect(onToggleSort).toHaveBeenCalledTimes(1)
  })

  it('рисует карточку тикета и открывает детали по кнопке', async () => {
    const user = userEvent.setup()
    const onOpen = vi.fn()
    const ticket = makeTicket({ title: 'Падает сохранение' })
    render(
      <TicketList tickets={[ticket]} state="ready" error="" onRetry={noop} onOpen={onOpen} />,
    )

    expect(screen.getByRole('heading', { name: 'Падает сохранение' })).toBeInTheDocument()
    expect(screen.getByText(ticket.description)).toBeInTheDocument()
    expect(screen.getByText('bug')).toBeInTheDocument()
    expect(screen.getAllByText('AI · 94%').length).toBeGreaterThan(0)
    expect(screen.getByText('1 обращение')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Подробнее/ }))
    expect(onOpen).toHaveBeenCalledWith(ticket)
  })
})
