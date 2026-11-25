import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/tickets'
import { TicketForm } from '@/features/tickets/TicketForm'

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^Заголовок/), 'Приложение падает при сохранении')
  await user.type(screen.getByLabelText(/^Описание/), 'При сохранении профиля появляется ошибка 500')
  await user.type(screen.getByLabelText(/^Автор/), 'Анна')
}

function submitForm() {
  const button = screen.getByRole('button', { name: /Отправить обращение/ })
  const form = button.closest('form')
  if (!form) throw new Error('Форма не найдена')
  return form
}

describe('TicketForm', () => {
  it('показывает подписи и обязательные поля', () => {
    render(<TicketForm onSubmit={vi.fn()} />)

    expect(screen.getByLabelText(/^Заголовок/)).toBeRequired()
    expect(screen.getByLabelText(/^Описание/)).toBeRequired()
    expect(screen.getByLabelText(/^Автор/)).toBeRequired()
    expect(screen.getByRole('button', { name: /Отправить обращение/ })).toBeEnabled()
  })

  it('проходит поля и кнопку отправки с клавиатуры', async () => {
    const user = userEvent.setup()
    render(<TicketForm onSubmit={vi.fn()} />)

    await user.tab()
    expect(screen.getByLabelText(/^Заголовок/)).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText(/^Описание/)).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText(/^Автор/)).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: /Отправить обращение/ })).toHaveFocus()
  })

  it('не отправляет пустую форму и показывает ошибки обязательных полей', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TicketForm onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: /Отправить обращение/ }))

    expect(screen.getByText('Укажите заголовок обращения.')).toBeInTheDocument()
    expect(screen.getByText('Опишите проблему или предложение.')).toBeInTheDocument()
    expect(screen.getByText('Укажите, кто отправил обращение.')).toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(3)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('проверяет минимальную длину и переводит фокус на первое неверное поле', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TicketForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/^Заголовок/), 'ab')
    await user.type(screen.getByLabelText(/^Описание/), 'коротко')
    await user.type(screen.getByLabelText(/^Автор/), 'a')
    await user.click(screen.getByRole('button', { name: /Отправить обращение/ }))

    expect(screen.getByText('Заголовок должен быть не короче 3 символов.')).toBeInTheDocument()
    expect(screen.getByText('Описание должно быть не короче 10 символов.')).toBeInTheDocument()
    expect(screen.getByText('Имя автора должно быть не короче 2 символов.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Заголовок/)).toHaveFocus()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('убирает сообщение об ошибке, когда пользователь исправляет поле', async () => {
    const user = userEvent.setup()
    render(<TicketForm onSubmit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Отправить обращение/ }))
    expect(screen.getByText('Укажите заголовок обращения.')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^Заголовок/), 'Ошибка')

    expect(screen.queryByText('Укажите заголовок обращения.')).not.toBeInTheDocument()
  })

  it('отправляет обрезанные значения и очищает форму после успеха', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<TicketForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/^Заголовок/), '  Приложение падает  ')
    await user.type(screen.getByLabelText(/^Описание/), '  При сохранении появляется ошибка  ')
    await user.type(screen.getByLabelText(/^Автор/), '  Анна  ')
    await user.click(screen.getByRole('button', { name: /Отправить обращение/ }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Приложение падает',
      description: 'При сохранении появляется ошибка',
      author: 'Анна',
    })

    await waitFor(() => expect(screen.getByLabelText(/^Заголовок/)).toHaveValue(''))
    expect(screen.getByLabelText(/^Описание/)).toHaveValue('')
    expect(screen.getByLabelText(/^Автор/)).toHaveValue('')
  })

  it('блокирует поля и кнопку, пока идёт отправка', async () => {
    const user = userEvent.setup()
    let resolve!: () => void
    const pending = new Promise<void>((done) => {
      resolve = done
    })
    const onSubmit = vi.fn().mockReturnValue(pending)
    render(<TicketForm onSubmit={onSubmit} />)

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /Отправить обращение/ }))

    expect(screen.getByRole('button', { name: /Классифицируем/ })).toBeDisabled()
    expect(screen.getByLabelText(/^Заголовок/)).toBeDisabled()
    expect(screen.getByLabelText(/^Описание/)).toBeDisabled()
    expect(screen.getByLabelText(/^Автор/)).toBeDisabled()

    resolve()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Отправить обращение/ })).toBeEnabled(),
    )
  })

  it('не отправляет второй запрос при повторной отправке во время ожидания', async () => {
    const user = userEvent.setup()
    const pending = new Promise<void>(() => {})
    const onSubmit = vi.fn().mockReturnValue(pending)
    render(<TicketForm onSubmit={onSubmit} />)

    await fillValidForm(user)
    const form = submitForm()

    fireEvent.submit(form)
    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('сохраняет введённый текст и показывает ошибку сервера с возможностью повтора', async () => {
    const user = userEvent.setup()
    const onSubmit = vi
      .fn()
      .mockRejectedValue(
        new ApiError(503, 'CLASSIFIER_UNAVAILABLE', 'Классификатор временно недоступен.', {
          title: 'Сервер отклонил заголовок.',
        }),
      )
    render(<TicketForm onSubmit={onSubmit} />)

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /Отправить обращение/ }))

    expect(await screen.findByText('Не удалось отправить обращение')).toBeInTheDocument()
    expect(screen.getByText('Классификатор временно недоступен.')).toBeInTheDocument()
    expect(screen.getByText('Сервер отклонил заголовок.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Заголовок/)).toHaveValue('Приложение падает при сохранении')
    expect(screen.getByRole('button', { name: /Повторить отправку/ })).toBeEnabled()
  })
})
