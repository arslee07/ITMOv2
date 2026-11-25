import { expect, test, type Page } from '@playwright/test'
import { resetTickets } from './reset'

test.beforeEach(() => {
  resetTickets()
})

async function fillForm(page: Page, title = 'Кнопка сохранения не отвечает') {
  await page.getByLabel(/^Заголовок/).fill(title)
  await page
    .getByLabel(/^Описание/)
    .fill('При нажатии на кнопку ничего не происходит. Ошибка повторяется после перезагрузки.')
  await page.getByLabel(/^Автор/).fill('Алексей')
}

function makeTicket(title: string) {
  const now = new Date().toISOString()
  return {
    id: `tkt_e2e_${Date.now()}`,
    title,
    description: 'При нажатии на кнопку ничего не происходит. Ошибка повторяется после перезагрузки.',
    author: 'Алексей',
    type: 'bug',
    confidence: 0.93,
    classifier: 'llm',
    label: 'bug',
    status: 'triaged',
    createdAt: now,
    updatedAt: now,
  }
}

test.describe('интеграция: состояния и защита формы', () => {
  test('валидация: пустая форма показывает ошибки полей', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Отправить обращение/ }).click()

    await expect(page.getByText('Укажите заголовок обращения.')).toBeVisible()
    await expect(page.getByText('Опишите проблему или предложение.')).toBeVisible()
    await expect(page.getByText('Укажите, кто отправил обращение.')).toBeVisible()
  })

  test('ошибка загрузки списка и повтор', async ({ page }) => {
    let fail = true
    await page.route('**/api/tickets', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }
      if (fail) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: { code: 'INTERNAL_ERROR', message: 'Сервер не ответил.' },
          }),
        })
        return
      }
      await route.continue()
    })

    await page.goto('/')
    await expect(page.getByText('Не удалось загрузить обращения')).toBeVisible()
    await expect(page.getByText('Сервер не ответил.')).toBeVisible()

    fail = false
    await page.getByRole('button', { name: /^Повторить$/ }).click()
    await expect(page.getByText('Пока нет обращений')).toBeVisible()
  })

  test('ошибка отправки сохраняет ввод и повтор создаёт тикет', async ({ page }) => {
    let posts = 0
    await page.route('**/api/tickets', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      posts += 1
      if (posts === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'CLASSIFIER_UNAVAILABLE',
              message: 'Классификатор временно недоступен.',
            },
          }),
        })
        return
      }
      const body = route.request().postDataJSON() as { title: string }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ticket: makeTicket(body.title) }),
      })
    })

    await page.goto('/')
    await expect(page.getByText('Пока нет обращений')).toBeVisible()
    await fillForm(page)
    await page.getByRole('button', { name: /Отправить обращение/ }).click()

    await expect(page.getByText('Не удалось отправить обращение')).toBeVisible()
    await expect(page.getByLabel(/^Заголовок/)).toHaveValue('Кнопка сохранения не отвечает')

    await page.getByRole('button', { name: /^Повторить$/ }).click()
    await expect(page.getByRole('heading', { name: 'Кнопка сохранения не отвечает' })).toBeVisible()
  })

  test('повторная отправка во время ожидания не создаёт второй POST', async ({ page }) => {
    let posts = 0
    await page.route('**/api/tickets', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      posts += 1
      const body = route.request().postDataJSON() as { title: string }
      await new Promise((resolve) => setTimeout(resolve, 700))
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ticket: makeTicket(body.title) }),
      })
    })

    await page.goto('/')
    await expect(page.getByText('Пока нет обращений')).toBeVisible()
    await fillForm(page)

    await page.getByRole('button', { name: /Отправить обращение/ }).click()
    await expect(page.getByRole('button', { name: /Классифицируем/ })).toBeDisabled()

    await page.locator('form').evaluate((form) => {
      const element = form as HTMLFormElement
      element.requestSubmit()
      element.requestSubmit()
    })

    await expect(page.getByText(/Тикет создан:/)).toBeVisible()
    expect(posts).toBe(1)
    await expect(page.getByRole('heading', { name: 'Кнопка сохранения не отвечает' })).toHaveCount(1)
  })
})
