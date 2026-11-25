import type { CreateTicketInput, ValidationErrors } from '@/types'

export const LIMITS = {
  title: { min: 3, max: 120 },
  description: { min: 10, max: 4000 },
  author: { min: 2, max: 60 },
} as const

export function validateTicketForm(values: CreateTicketInput): ValidationErrors {
  const errors: ValidationErrors = {}
  const title = values.title.trim()
  const description = values.description.trim()
  const author = values.author.trim()

  if (!title) errors.title = 'Укажите заголовок обращения.'
  else if (title.length < LIMITS.title.min)
    errors.title = `Заголовок должен быть не короче ${LIMITS.title.min} символов.`
  else if (title.length > LIMITS.title.max)
    errors.title = `Заголовок должен быть не длиннее ${LIMITS.title.max} символов.`

  if (!description) errors.description = 'Опишите проблему или предложение.'
  else if (description.length < LIMITS.description.min)
    errors.description = `Описание должно быть не короче ${LIMITS.description.min} символов.`
  else if (description.length > LIMITS.description.max)
    errors.description = `Описание должно быть не длиннее ${LIMITS.description.max} символов.`

  if (!author) errors.author = 'Укажите, кто отправил обращение.'
  else if (author.length < LIMITS.author.min)
    errors.author = `Имя автора должно быть не короче ${LIMITS.author.min} символов.`
  else if (author.length > LIMITS.author.max)
    errors.author = `Имя автора должно быть не длиннее ${LIMITS.author.max} символов.`

  return errors
}

export function firstErrorField(errors: ValidationErrors): keyof ValidationErrors | null {
  for (const field of ['title', 'description', 'author'] as const) {
    if (errors[field]) return field
  }
  return null
}
