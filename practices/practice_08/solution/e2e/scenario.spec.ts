import { expect, test } from '@playwright/test'
import { resetTickets } from './reset'

test.beforeEach(() => {
  resetTickets()
})

test.describe('интеграция: реальный API', () => {
  test('полный сценарий: форма → классификация → тикет → в работе', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Пока нет обращений')).toBeVisible()

    await page.getByLabel(/^Заголовок/).fill('Приложение падает при сохранении профиля')
    await page
      .getByLabel(/^Описание/)
      .fill('После нажатия «Сохранить» появляется ошибка 500, изменения не применяются.')
    await page.getByLabel(/^Автор/).fill('Анна')

    await page.getByRole('button', { name: /Отправить обращение/ }).click()
    await expect(page.getByRole('button', { name: /Классифицируем/ })).toBeVisible()
    await expect(page.getByText(/Тикет создан:/)).toBeVisible({ timeout: 90_000 })

    const card = page
      .getByRole('heading', { name: 'Приложение падает при сохранении профиля' })
      .first()
    await expect(card).toBeVisible()
    await expect(page.getByLabel(/^Заголовок/)).toHaveValue('')

    await page.getByRole('button', { name: /Подробнее/ }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Приложение падает при сохранении профиля' })).toBeVisible()

    await dialog.getByRole('button', { name: /Взять в работу/ }).click()
    await expect(dialog.getByRole('button', { name: /Закрыть тикет/ })).toBeVisible()
    await expect(dialog.getByText('В работе')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
  })
})
