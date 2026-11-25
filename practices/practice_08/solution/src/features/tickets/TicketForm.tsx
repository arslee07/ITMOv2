import { useId, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Send, X } from 'lucide-react'
import { ApiError, errorMessage } from '@/api/tickets'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { firstErrorField, LIMITS, validateTicketForm } from '@/features/tickets/validation'
import type { CreateTicketInput, ValidationErrors } from '@/types'

const EMPTY: CreateTicketInput = { title: '', description: '', author: '' }

interface TicketFormProps {
  onSubmit: (input: CreateTicketInput) => Promise<void>
  success?: string | null
  onDismissSuccess?: () => void
}

export function TicketForm({ onSubmit, success, onDismissSuccess }: TicketFormProps) {
  const baseId = useId()
  const titleId = `${baseId}-title`
  const descriptionId = `${baseId}-description`
  const authorId = `${baseId}-author`

  const [values, setValues] = useState<CreateTicketInput>(EMPTY)
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const inFlight = useRef(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const authorRef = useRef<HTMLInputElement>(null)

  function update(field: keyof CreateTicketInput, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
    if (formError) setFormError(null)
    onDismissSuccess?.()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return

    const nextErrors = validateTicketForm(values)
    setErrors(nextErrors)

    const invalidField = firstErrorField(nextErrors)
    if (invalidField) {
      if (invalidField === 'title') titleRef.current?.focus()
      if (invalidField === 'description') descriptionRef.current?.focus()
      if (invalidField === 'author') authorRef.current?.focus()
      return
    }

    inFlight.current = true
    setSubmitting(true)
    setFormError(null)
    onDismissSuccess?.()

    try {
      await onSubmit({
        title: values.title.trim(),
        description: values.description.trim(),
        author: values.author.trim(),
      })
      setValues(EMPTY)
      setErrors({})
    } catch (error) {
      setFormError(errorMessage(error))
      if (error instanceof ApiError && error.fields) setErrors(error.fields)
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  const titleErrorId = `${titleId}-error`
  const descriptionErrorId = `${descriptionId}-error`
  const authorErrorId = `${authorId}-error`

  return (
    <Card className="gap-0 rounded-xl border-border bg-card shadow-none lg:sticky lg:top-6">
      <CardHeader className="gap-1 border-b border-border px-5 py-4">
        <span className="mono-label">Новое обращение</span>
        <CardTitle className="text-lg leading-tight">Баг-репорт</CardTitle>
        <CardDescription className="sr-only">
          Опишите проблему — AI определит тип и уверенность, а тикет попадёт в очередь.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-5">
        {success ? (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 flex gap-2.5 rounded-lg border border-success-border bg-success-soft px-3 py-3 text-sm text-success"
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="flex-1">{success}</span>
            {onDismissSuccess ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-my-1 -mr-1 size-7 text-success hover:bg-success-soft hover:text-success"
                onClick={onDismissSuccess}
                aria-label="Скрыть сообщение об успехе"
              >
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        ) : null}

        <form noValidate onSubmit={handleSubmit} aria-busy={submitting} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={titleId} className="text-[13px]">
              Заголовок
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <Input
              id={titleId}
              ref={titleRef}
              value={values.title}
              onChange={(event) => update('title', event.target.value)}
              placeholder="Например: не сохраняются настройки"
              autoComplete="off"
              maxLength={LIMITS.title.max}
              required
              aria-required="true"
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? titleErrorId : undefined}
              disabled={submitting}
              className="h-10 rounded-lg text-[13px]"
            />
            {errors.title ? (
              <p id={titleErrorId} role="alert" className="text-xs font-medium text-destructive">
                {errors.title}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Коротко: что случилось.</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={descriptionId} className="text-[13px]">
              Описание
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <Textarea
              id={descriptionId}
              ref={descriptionRef}
              value={values.description}
              onChange={(event) => update('description', event.target.value)}
              placeholder="Что произошло? Как повторить проблему?"
              rows={4}
              maxLength={LIMITS.description.max}
              required
              aria-required="true"
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? descriptionErrorId : undefined}
              disabled={submitting}
              className="min-h-[128px] resize-y rounded-lg text-[13px] leading-relaxed"
            />
            {errors.description ? (
              <p id={descriptionErrorId} role="alert" className="text-xs font-medium text-destructive">
                {errors.description}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Укажите шаги для воспроизведения.</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={authorId} className="text-[13px]">
              Автор
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
            </Label>
            <Input
              id={authorId}
              ref={authorRef}
              value={values.author}
              onChange={(event) => update('author', event.target.value)}
              placeholder="Имя или команда"
              autoComplete="name"
              maxLength={LIMITS.author.max}
              required
              aria-required="true"
              aria-invalid={Boolean(errors.author)}
              aria-describedby={errors.author ? authorErrorId : undefined}
              disabled={submitting}
              className="h-10 rounded-lg text-[13px]"
            />
            {errors.author ? (
              <p id={authorErrorId} role="alert" className="text-xs font-medium text-destructive">
                {errors.author}
              </p>
            ) : null}
          </div>

          {formError ? (
            <Alert variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Не удалось отправить обращение</AlertTitle>
              <AlertDescription>
                <p>{formError}</p>
                <p className="text-xs">Введённые данные сохранены — исправьте их или повторите отправку.</p>
                <Button type="submit" variant="outline" size="sm" disabled={submitting}>
                  <RotateCcw aria-hidden="true" />
                  Повторить
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" size="lg" disabled={submitting} className="mt-1 h-10 w-full rounded-lg">
            {submitting ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Классифицируем…
              </>
            ) : formError ? (
              <>
                <RotateCcw aria-hidden="true" />
                Повторить отправку
              </>
            ) : (
              <>
                <Send aria-hidden="true" />
                Отправить обращение
              </>
            )}
          </Button>
          <p className="sr-only" role="status" aria-live="polite">
            {submitting ? 'Отправляем обращение и классифицируем его.' : ''}
          </p>
        </form>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Тип обращения определится автоматически
        </p>
      </CardContent>
    </Card>
  )
}
