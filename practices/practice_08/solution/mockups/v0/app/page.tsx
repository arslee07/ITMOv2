'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, ArrowDownUp, Check, ChevronRight, CircleDot, Clock3, Inbox, RotateCw, Send, Sparkles, TicketCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

type Ticket = { id: string; title: string; description: string; author: string; type: 'bug' | 'task' | 'feature'; confidence: number; status: string; time: string }
type FormValues = { title: string; description: string; author: string }
const samples: Ticket[] = [
  { id: 'TRI-1048', title: 'Не сохраняются настройки уведомлений', description: 'После отключения писем о новых комментариях и сохранения настроек переключатель снова включён при повторном входе. Воспроизводится в Chrome и Firefox.', author: 'Анна К.', type: 'bug', confidence: 94, status: 'Новый', time: '2 мин назад' },
  { id: 'TRI-1047', title: 'Добавить фильтр по дате создания', description: 'Нужен выбор диапазона дат в очереди обращений, чтобы быстрее находить старые тикеты.', author: 'Михаил Р.', type: 'feature', confidence: 89, status: 'В работе', time: '18 мин назад' },
  { id: 'TRI-1046', title: 'Обновить текст подсказки в форме', description: 'Заменить короткую подсказку под полем описания на более ясный пример.', author: 'Ирина С.', type: 'task', confidence: 97, status: 'Новый', time: '43 мин назад' },
]
const initialValues: FormValues = { title: '', description: '', author: '' }
const modes = ['Исходное', 'Ввод', 'Загрузка', 'Результат', 'Ошибка'] as const

type Mode = (typeof modes)[number]
function classify(text: string): Ticket['type'] {
  if (/добавить|нужен|новая функция|возможность/i.test(text)) return 'feature'
  if (/обновить|изменить|настроить|задач/i.test(text)) return 'task'
  return 'bug'
}

export default function Home() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [values, setValues] = useState<FormValues>(initialValues)
  const [errors, setErrors] = useState<Partial<FormValues>>({})
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<Mode>('Исходное')
  const [errorMessage, setErrorMessage] = useState('')
  const [success, setSuccess] = useState('')
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [sortNew, setSortNew] = useState(true)
  const sortedTickets = useMemo(() => sortNew ? tickets : [...tickets].reverse(), [tickets, sortNew])
  const setField = (key: keyof FormValues, value: string) => { setValues((current) => ({ ...current, [key]: value })); setSuccess(''); if (mode !== 'Ошибка') setMode('Ввод') }
  const validate = () => {
    const next: Partial<FormValues> = {}
    if (!values.title.trim()) next.title = 'Введите заголовок обращения.'
    if (!values.description.trim()) next.description = 'Добавьте описание проблемы.'
    if (!values.author.trim()) next.author = 'Укажите имя автора.'
    setErrors(next)
    return Object.keys(next).length === 0
  }
  const send = (simulateError = false) => {
    if (!validate()) return
    setLoading(true); setMode('Загрузка'); setErrorMessage(''); setSuccess('')
    window.setTimeout(() => {
      setLoading(false)
      if (simulateError) { setErrorMessage('Сервер временно недоступен. Текст обращения сохранён.'); setMode('Ошибка'); return }
      const type = classify(`${values.title} ${values.description}`)
      const ticket: Ticket = { ...values, id: `TRI-${1049 + tickets.length - samples.length}`, type, confidence: type === 'bug' ? 94 : type === 'task' ? 91 : 89, status: 'Новый', time: 'только что' }
      setTickets((current) => [ticket, ...current]); setValues(initialValues); setErrors({}); setMode('Результат'); setSuccess(`Тикет создан: ${ticket.type}, уверенность ${ticket.confidence}%, метка ${ticket.type}`)
    }, 1150)
  }
  const setPreview = (nextMode: Mode) => {
    setErrorMessage(''); setSuccess(''); setLoading(false); setErrors({})
    if (nextMode === 'Исходное') { setTickets([]); setValues(initialValues); setMode(nextMode); return }
    if (nextMode === 'Ввод') { setTickets(samples); setValues({ title: 'Кнопка сохранения не отвечает', description: 'При нажатии на кнопку ничего не происходит. Ошибка повторяется после перезагрузки страницы.', author: 'Алексей П.' }); setMode(nextMode); return }
    if (nextMode === 'Загрузка') { setTickets(samples); setValues({ title: 'Кнопка сохранения не отвечает', description: 'При нажатии на кнопку ничего не происходит.', author: 'Алексей П.' }); setLoading(true); setMode(nextMode); return }
    if (nextMode === 'Результат') { const ticket: Ticket = { id: 'TRI-1049', title: 'Кнопка сохранения не отвечает', description: 'При нажатии на кнопку ничего не происходит. Ошибка повторяется после перезагрузки страницы.', author: 'Алексей П.', type: 'bug', confidence: 94, status: 'Новый', time: 'только что' }; setTickets([ticket, ...samples]); setValues(initialValues); setMode(nextMode); setSuccess('Тикет создан: bug, уверенность 94%, метка bug'); return }
    setTickets(samples); setValues({ title: 'Не открывается страница профиля', description: 'После входа страница профиля остаётся пустой.', author: 'Алексей П.' }); setErrorMessage('Сервер временно недоступен. Текст обращения сохранён.'); setMode(nextMode)
  }
  const retry = () => send(false)
  return (
    <main className="min-h-screen bg-[#f7f6f3] px-4 pb-12 pt-6 text-[#1c1b19] sm:px-8 sm:pt-8">
      <div className="mx-auto max-w-[1320px]">
        <section aria-label="Состояния интерфейса" className="mb-7 flex flex-wrap items-center gap-2 rounded-xl border border-[#e7e5df] bg-[#fbfaf8] px-3 py-2.5">
          <span className="mono-label mr-2">Состояния</span>
          {modes.map((item) => <Button key={item} variant={mode === item ? 'secondary' : 'ghost'} size="sm" onClick={() => setPreview(item)} aria-pressed={mode === item} className="h-8 rounded-lg px-3 text-xs">{item}</Button>)}
          <span className="mx-1 hidden h-5 border-l border-[#e7e5df] sm:block" />
          <button type="button" onClick={() => { if (validate()) send(true) }} className="rounded-md px-2 py-1 text-xs text-[#77736b] underline decoration-[#c9c5bd] underline-offset-4 hover:text-[#b42318] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600">Смоделировать ошибку</button>
        </section>

        <header className="mb-8 flex flex-col gap-5 border-b border-[#e4e1da] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="mb-3 flex items-center gap-2"><div className="grid size-8 place-items-center rounded-lg border border-[#e4e1da] bg-white"><Inbox className="size-4 text-[#4f46e5]" /></div><span className="mono-label">SUPPORT / INTAKE</span></div><h1 className="text-[27px] font-semibold tracking-[-0.04em] sm:text-[32px]">Триаж обращений</h1><p className="mt-1.5 text-sm text-[#77736b]">Баг-репорты в тикеты: тип, уверенность, очередь</p></div>
          <Badge variant="outline" className="w-fit gap-1.5 rounded-full border-[#dedbd3] bg-white px-3 py-1.5 font-normal text-[#5f5b54]"><Sparkles className="size-3.5 text-[#4f46e5]" />AI-классификация</Badge>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-8">
          <Card className="rounded-xl border-[#e5e2db] bg-white shadow-none">
            <CardHeader className="border-b border-[#efede8] px-5 pb-4 pt-5"><div className="flex items-start justify-between"><div><span className="mono-label">НОВОЕ ОБРАЩЕНИЕ</span><h2 className="mt-1.5 text-lg font-semibold tracking-tight">Баг-репорт</h2></div><div className="grid size-8 place-items-center rounded-lg bg-[#f5f4f1] text-[#77736b]"><Send className="size-4" /></div></div></CardHeader>
            <CardContent className="px-5 pb-5 pt-5">
              {success && <div role="status" className="mb-4 flex gap-2.5 rounded-lg border border-[#b8dec5] bg-[#f1faf4] px-3 py-3 text-sm text-[#25613b]"><Check className="mt-0.5 size-4 shrink-0" /><span>{success}</span></div>}
              {errorMessage && <div role="alert" className="mb-4 rounded-lg border border-[#f0c3bd] bg-[#fff6f4] p-3.5 text-sm text-[#a52b20]"><div className="flex gap-2"><AlertCircle className="mt-0.5 size-4 shrink-0" /><div><p className="font-medium">Не удалось отправить обращение</p><p className="mt-1 text-xs leading-relaxed text-[#8e423a]">{errorMessage}</p></div></div><Button type="button" variant="outline" size="sm" onClick={retry} disabled={loading} className="mt-3 h-8 border-[#e8b7b0] bg-white text-[#95372e] hover:bg-[#fff0ed]"><RotateCw className="mr-1.5 size-3.5" />Повторить</Button></div>}
              <form onSubmit={(event) => { event.preventDefault(); if (!loading) send(false) }} noValidate className="space-y-4">
                <div className="space-y-1.5"><Label htmlFor="title" className="text-[13px]">Заголовок <span className="text-[#b42318]">*</span></Label><Input id="title" value={values.title} onChange={(event) => setField('title', event.target.value)} disabled={loading} placeholder="Например: не сохраняются настройки" aria-invalid={!!errors.title} aria-describedby={errors.title ? 'title-error' : undefined} className="h-10 rounded-lg border-[#e5e2db] text-[13px] focus-visible:ring-indigo-600" />{errors.title && <p id="title-error" role="alert" className="text-xs text-[#b42318]">{errors.title}</p>}</div>
                <div className="space-y-1.5"><Label htmlFor="description" className="text-[13px]">Описание <span className="text-[#b42318]">*</span></Label><Textarea id="description" value={values.description} onChange={(event) => setField('description', event.target.value)} disabled={loading} placeholder="Что произошло? Как повторить проблему?" aria-invalid={!!errors.description} aria-describedby={errors.description ? 'description-error' : undefined} className="min-h-[128px] resize-y rounded-lg border-[#e5e2db] text-[13px] leading-relaxed focus-visible:ring-indigo-600" />{errors.description && <p id="description-error" role="alert" className="text-xs text-[#b42318]">{errors.description}</p>}<p className="text-[11px] text-[#96928a]">Укажите шаги для воспроизведения</p></div>
                <div className="space-y-1.5"><Label htmlFor="author" className="text-[13px]">Автор <span className="text-[#b42318]">*</span></Label><Input id="author" value={values.author} onChange={(event) => setField('author', event.target.value)} disabled={loading} placeholder="Имя или команда" aria-invalid={!!errors.author} aria-describedby={errors.author ? 'author-error' : undefined} className="h-10 rounded-lg border-[#e5e2db] text-[13px] focus-visible:ring-indigo-600" />{errors.author && <p id="author-error" role="alert" className="text-xs text-[#b42318]">{errors.author}</p>}</div>
                <Button type="submit" disabled={loading} className="mt-1 h-10 w-full rounded-lg bg-[#4f46e5] text-sm font-medium text-white hover:bg-[#4338ca] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">{loading ? <><Spinner className="mr-2 size-4" />Классифицируем…</> : <><Send className="mr-2 size-3.5" />Отправить обращение</>}</Button>
              </form>
              <p className="mt-3 text-center text-[11px] text-[#99958d]">Тип обращения определится автоматически</p>
            </CardContent>
          </Card>

          <section aria-labelledby="queue-title" className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-3"><div><div className="mb-1.5 flex items-center gap-2"><span className="mono-label">INBOX / TRIAGE</span><span className="size-1 rounded-full bg-[#c5c1b8]" /><span className="mono-label">LIVE QUEUE</span></div><div className="flex items-center gap-2.5"><h2 id="queue-title" className="text-xl font-semibold tracking-tight">Очередь обращений</h2><Badge variant="secondary" className="rounded-md bg-[#eeece7] px-2 py-0.5 font-mono text-[11px] text-[#625e56]">{tickets.length}</Badge></div></div><Button variant="outline" size="sm" onClick={() => { setSortNew(!sortNew); setTickets((current) => [...current]) }} className="h-9 rounded-lg border-[#e5e2db] bg-white px-3 text-xs"><RotateCw className="mr-2 size-3.5" />Обновить</Button></div>
            {sortedTickets.length === 0 ? <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-[#dedbd3] bg-white/60"><div className="text-center"><Inbox className="mx-auto mb-3 size-6 text-[#aaa69d]" /><p className="text-sm text-[#77736b]">Пока нет обращений</p></div></div> : <div className="space-y-3">{sortedTickets.map((ticket) => <article key={ticket.id} className="rounded-xl border border-[#e5e2db] bg-white px-4 py-4 shadow-[0_1px_2px_rgba(28,27,25,0.025)] transition-colors hover:border-[#d5d1c8] sm:px-5 sm:py-[18px]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="mb-1.5 flex items-center gap-2"><span className="mono-label">{ticket.id}</span><span className="text-[#c6c2ba]">/</span><span className="mono-label">{ticket.time}</span></div><h3 className="truncate text-[15px] font-semibold tracking-[-0.015em]">{ticket.title}</h3></div><span className="hidden shrink-0 rounded-md border border-[#e8e5df] bg-[#faf9f7] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#77736b] sm:inline-flex">AI · {ticket.confidence}%</span></div><p className="mt-2 line-clamp-2 max-w-3xl text-[13px] leading-[1.65] text-[#77736b]">{ticket.description}</p><div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[#f0eee9] pt-3"><div className="flex flex-wrap items-center gap-2"><Badge className={`rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] ${ticket.type === 'bug' ? 'bg-[#fcebe8] text-[#a64034] hover:bg-[#fcebe8]' : ticket.type === 'feature' ? 'bg-[#eeecff] text-[#5146a5] hover:bg-[#eeecff]' : 'bg-[#f1efe9] text-[#686354] hover:bg-[#f1efe9]'}`}>{ticket.type}</Badge><Badge variant="outline" className="gap-1 rounded-md border-[#e8e5df] px-2 py-0.5 text-[10px] font-normal text-[#77736b]"><CircleDot className="size-2.5" />{ticket.status}</Badge><span className="flex items-center gap-1 font-mono text-[10px] text-[#77736b] sm:hidden"><Sparkles className="size-3" />{ticket.confidence}%</span></div><div className="flex items-center gap-3"><span className="hidden text-xs text-[#77736b] sm:inline">{ticket.author}</span><Button variant="ghost" size="sm" onClick={() => setSelected(ticket)} className="h-7 gap-1 rounded-md px-2 text-xs text-[#514d46] hover:bg-[#f5f4f1]">Подробнее<ChevronRight className="size-3.5" /></Button></div></div></article>)}</div>}
            <div className="mt-3 flex items-center justify-between px-1"><span className="flex items-center gap-1.5 text-[11px] text-[#99958d]"><Clock3 className="size-3" />Обновлено только что</span><button type="button" onClick={() => setSortNew(!sortNew)} className="flex items-center gap-1 text-[11px] text-[#77736b] hover:text-[#1c1b19] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"><ArrowDownUp className="size-3" />Сортировка</button></div>
          </section>
        </div>
      </div>
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null) }}><DialogContent className="rounded-xl border-[#e5e2db] p-0 sm:max-w-[540px]"><DialogHeader className="border-b border-[#efede8] px-6 pb-4 pt-6"><div className="mb-2 flex items-center gap-2"><span className="mono-label">{selected?.id}</span><span className="text-[#c6c2ba]">/</span><span className="mono-label">ПОЛНОЕ ОБРАЩЕНИЕ</span></div><DialogTitle className="pr-6 text-xl tracking-tight">{selected?.title}</DialogTitle><DialogDescription>Детали обращения и результат классификации</DialogDescription></DialogHeader><div className="space-y-5 px-6 py-5"><div><span className="mono-label">ОПИСАНИЕ</span><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#514d46]">{selected?.description}</p></div><div className="grid grid-cols-2 gap-4 rounded-lg border border-[#efede8] bg-[#faf9f7] p-3.5"><div><span className="mono-label">ТИП</span><p className="mt-1.5"><Badge className="rounded-md bg-[#fcebe8] font-mono text-[10px] uppercase text-[#a64034] hover:bg-[#fcebe8]">{selected?.type}</Badge></p></div><div><span className="mono-label">УВЕРЕННОСТЬ</span><p className="mt-1.5 text-sm font-medium">{selected?.confidence}%</p></div><div><span className="mono-label">АВТОР</span><p className="mt-1.5 text-sm">{selected?.author}</p></div><div><span className="mono-label">СТАТУС</span><p className="mt-1.5 text-sm">{selected?.status}</p></div></div></div><DialogFooter className="border-t border-[#efede8] px-6 py-4"><Button variant="outline" onClick={() => setSelected(null)} className="rounded-lg border-[#e5e2db]">Закрыть</Button><Button onClick={() => { if (selected) setTickets((current) => current.map((ticket) => ticket.id === selected.id ? { ...ticket, status: 'В работе' } : ticket)); setSelected((current) => current ? { ...current, status: 'В работе' } : null) }} className="rounded-lg bg-[#4f46e5] text-white hover:bg-[#4338ca]">Взять в работу</Button></DialogFooter></DialogContent></Dialog>
    </main>
  )
}
