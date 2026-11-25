import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { App } from '@/App'
import { server } from '@/test/server'
import { makeTicket } from '@/test/fixtures'
import type { MutableTicketStatus, Ticket } from '@/types'

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Заголовок/), 'Приложение падает при сохранении')
  await user.type(
    screen.getByLabelText(/^Описание/),
    'При сохранении профиля появляется ошибка 500',
  )
  await user.type(screen.getByLabelText(/^Автор/), 'Анна')
}

describe('App: полный сценарий', () => {
  it('от пустого списка до созданного тикета', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText('Пока нет обращений')).toBeInTheDocument()

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /Отправить обращение/ }))

    expect(
      await screen.findByText(/Тикет создан: bug, уверенность 94%/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Приложение падает при сохранении' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Пока нет обращений')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Заголовок/)).toHaveValue('')
    expect(screen.getByLabelText(/^Описание/)).toHaveValue('')
    expect(screen.getByLabelText(/^Автор/)).toHaveValue('')
  })

  it('показывает загрузку, пока список не пришёл', async () => {
    server.use(
      http.get('/api/tickets', async () => {
        await delay(120)
        return HttpResponse.json({ tickets: [] as Ticket[] })
      }),
    )

    render(<App />)

    expect(screen.getByText('Загружаем обращения…')).toBeInTheDocument()
    expect(await screen.findByText('Пока нет обращений')).toBeInTheDocument()
  })

  it('показывает ошибку загрузки и загружает список после повтора', async () => {
    const user = userEvent.setup()
    let attempt = 0

    server.use(
      http.get('/api/tickets', () => {
        attempt += 1
        if (attempt === 1) {
          return HttpResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Сервер не ответил.' } },
            { status: 500 },
          )
        }
        return HttpResponse.json({ tickets: [makeTicket({ title: 'Тикет после повтора' })] })
      }),
    )

    render(<App />)

    expect(await screen.findByText('Не удалось загрузить обращения')).toBeInTheDocument()
    expect(screen.getByText('Сервер не ответил.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Повторить/ }))

    expect(
      await screen.findByRole('heading', { name: 'Тикет после повтора' }),
    ).toBeInTheDocument()
  })

  it('сохраняет ввод при ошибке отправки и создаёт тикет после повтора', async () => {
    const user = userEvent.setup()
    let posts = 0

    server.use(
      http.post('/api/tickets', () => {
        posts += 1
        if (posts === 1) {
          return HttpResponse.json(
            {
              error: {
                code: 'CLASSIFIER_UNAVAILABLE',
                message: 'Классификатор недоступен.',
              },
            },
            { status: 503 },
          )
        }
        return HttpResponse.json({ ticket: makeTicket({ title: 'Тикет после повтора' }) }, { status: 201 })
      }),
    )

    render(<App />)
    await screen.findByText('Пока нет обращений')
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /Отправить обращение/ }))

    expect(await screen.findByText('Не удалось отправить обращение')).toBeInTheDocument()
    expect(screen.getByText('Классификатор недоступен.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Заголовок/)).toHaveValue(
      'Приложение падает при сохранении',
    )

    await user.click(screen.getByRole('button', { name: /^Повторить$/ }))

    expect(await screen.findByRole('heading', { name: 'Тикет после повтора' })).toBeInTheDocument()
    expect(screen.queryByText('Не удалось отправить обращение')).not.toBeInTheDocument()
  })

  it('во время ожидания не создаёт второй запрос при повторной отправке', async () => {
    const user = userEvent.setup()
    let posts = 0

    server.use(
      http.post('/api/tickets', async () => {
        posts += 1
        await delay(180)
        return HttpResponse.json({ ticket: makeTicket() }, { status: 201 })
      }),
    )

    render(<App />)
    await screen.findByText('Пока нет обращений')
    await fillForm(user)

    const form = screen.getByRole('button', { name: /Отправить обращение/ }).closest('form')
    if (!form) throw new Error('Форма не найдена')

    fireEvent.submit(form)
    expect(await screen.findByRole('button', { name: /Классифицируем/ })).toBeDisabled()

    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(await screen.findByText(/создан/)).toBeInTheDocument()
    expect(posts).toBe(1)
    expect(
      screen.getAllByRole('heading', { name: 'Приложение падает при сохранении' }),
    ).toHaveLength(1)
  })

  it('открывает диалог, меняет статус и закрывается по Escape', async () => {
    const user = userEvent.setup()
    const ticket = makeTicket({ id: 'tkt_dialog', title: 'Тикет в диалоге' })

    server.use(
      http.get('/api/tickets', () => HttpResponse.json({ tickets: [ticket] })),
      http.patch('/api/tickets/:id', async ({ request }) => {
        const body = (await request.json()) as { status: MutableTicketStatus }
        return HttpResponse.json({
          ticket: { ...ticket, status: body.status, updatedAt: '2026-11-25T10:00:00.000Z' },
        })
      }),
    )

    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Тикет в диалоге' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Подробнее/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Тикет в диалоге' })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: /Взять в работу/ }))

    const updatedDialog = await screen.findByRole('dialog')
    expect(await within(updatedDialog).findByText('В работе')).toBeInTheDocument()
    expect(within(updatedDialog).getByRole('button', { name: /Закрыть тикет/ })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
