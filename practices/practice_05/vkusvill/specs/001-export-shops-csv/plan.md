# Implementation Plan: Экспорт видимых магазинов в CSV

**Branch**: `001-export-shops-csv` | **Date**: 2026-10-25 | **Spec**: `specs/001-export-shops-csv/ui-spec.md`, `logic-spec.md`, `contract.md`

**Input**: две согласованные спеки двух команд и общий контракт

## Summary

Сервер получает `GET /api/export.csv` с теми же параметрами, что и
`/api/shops/points`, фильтрует накопленный кэш по правилам списка, сортирует по
расстоянию или `ID` и отдаёт CSV (`;`, CRLF, UTF-8 BOM) с `Content-Disposition`.
Клиент добавляет кнопку в шапку списка, запрашивает файл через `fetch`, скачивает
`Blob` и показывает состояния «загрузка / готово / ошибка».

## Technical Context

**Language/Version**: Go 1.27 (только стандартная библиотека, `encoding/csv`)

**Primary Dependencies**: нет новых; фронтенд — существующий vanilla JS + HTMX

**Storage**: in-memory кэш `mcp.StoreCache` (источник данных), без обращений к MCP

**Testing**: `go test ./...`, табличные тесты, `httptest` + fake MCP endpoint

**Target Platform**: локальный веб-сервис Linux/macOS, браузер с поддержкой Blob

**Project Type**: web-service (Go backend + server-rendered shell, клиентский рендер списка)

**Performance Goals**: экспорт 1000 магазинов < 1 c, ответ стримится одним буфером

**Constraints**: без новых зависимостей, без изменений публичных JSON-ответов,
экспорт не тратит лимит MCP (60 req/min)

**Scale/Scope**: каталог — несколько тысяч магазинов, лимит экспорта 20 000 строк

## Constitution Check

*GATE: до начала реализации.*

- **Stdlib first** — CSV через `encoding/csv`, HTTP через `net/http`. Проходит.
- **Явная обработка ошибок** — валидация переиспользует `ValidationError` и
  `writeQueryError`. Проходит.
- **Табличные тесты** — тесты на фильтрацию, экранирование, лимит, заголовки.
  Проходит.
- **Без обращений к MCP в экспорте** — данные только из кэша. Проходит.
- **UI-правила из `AGENTS.md`** — `aria-label`, `focus-visible`, тач-таргет
  44×44, без эмодзи-иконок. Проходит.

Нарушений нет, отступления не требуются.

## Project Structure

### Documentation (this feature)

```text
specs/001-export-shops-csv/
├── ui-spec.md          # спека команды UI (после согласования)
├── logic-spec.md       # спека команды логики (после согласования)
├── contract.md         # общий контракт + история согласования
├── history/            # версии спек «до» согласования
├── plan.md             # этот файл
└── tasks.md            # задачи реализации
```

### Source Code

```text
internal/web/export.go          # handler, фильтрация, сборка CSV
internal/web/export_test.go     # табличные тесты и e2e через httptest
internal/web/handlers.go        # переиспользуемая валидация параметров
cmd/server/main.go              # маршрут GET /api/export.csv
internal/web/templates/partials/shop_list.html  # кнопка и статус
internal/web/static/js/app.js   # exportCsv(), состояния кнопки
README.md                       # описание endpoint и пример curl
```

## Phase 0 — Research

- `encoding/csv` с `Comma = ';'`, `UseCRLF = true` даёт RFC 4180-совместимый файл;
  BOM пишется вручную перед заголовком.
- `Content-Disposition` с кириллицей не нужен: имя файла латиницей.
- Расстояние форматируется так же, как в интерфейсе, чтобы файл и список совпадали.

## Phase 1 — Design

- Фильтрация повторяет `shopMatches` из `app.js`: город, удобство, поиск по
  адресу/метро без учёта регистра.
- Сортировка: `HasLocation` → расстояние, иначе `ID`.
- Лимит проверяется после фильтрации, до записи тела.
- Ответ формируется в `bytes.Buffer` (BOM + CSV) и отдаётся одним `Write`, чтобы
  при ошибке не отправить половину файла.

## Phase 2 — Implementation order

1. Серверная сборка CSV + unit-тесты.
2. Handler + маршрут + тесты кодов ответа.
3. Кнопка и состояния в UI.
4. Сквозная проверка: запуск сервиса, `curl` с фильтрами, открытие файла.

## Phase 3 — Verification

- `go test ./...`, `go vet ./...`, `make build`.
- `curl -D-` на успешный, пустой и ошибочный сценарии.
- Проверка BOM (`hexdump -C | head -1`), разделителя и экранирования.
- Ручная проверка кнопки в браузере: пустой список, загрузка, ошибка, успех.
