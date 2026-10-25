# Tasks: Экспорт видимых магазинов в CSV

**Input**: `ui-spec.md`, `logic-spec.md`, `contract.md`, `plan.md`

**Правило**: каждая задача проверяема командой или наблюдаемым результатом.
Порядок — зависимостный: сервер → маршрут → UI → сквозная проверка.

## Phase 1: Серверная сборка CSV

- [x] T001 Реализовать `filterShops` по правилам списка в `internal/web/export.go`; проверить `go test ./internal/web/ -run TestFilterShops`
- [x] T002 Реализовать `writeShopsCSV` (BOM, `;`, CRLF, экранирование, колонки, сортировка) в `internal/web/export.go`; проверить `go test ./internal/web/ -run TestWriteShopsCSV`
- [x] T003 Покрыть тестами экранирование (`;`, `"`, перевод строки), пустые значения и лимит 20 000 строк; `go test ./internal/web/`

## Phase 2: HTTP endpoint

- [x] T004 `HandleExportCSV`: валидация через `parseQueryParams`, ответ `400`/`413`, заголовки `Content-Type`, `Content-Disposition`, `Cache-Control`; `go test ./internal/web/ -run TestHandleExportCSV`
- [x] T005 Подключить маршрут `GET /api/export.csv` в `cmd/server/main.go`; `go build ./...`
- [x] T006 Тест: пустой кэш → `200` и файл из строки заголовка; некорректный параметр → `400` без обращений к MCP; `go test ./internal/web/`

## Phase 3: UI

- [x] T007 Добавить кнопку «Экспорт CSV» и `#export-status` в `shop_list.html` с `aria-label`, `focus-visible`, размером 44×44
- [x] T008 Реализовать `window.exportCsv()` в `app.js`: параметры из `currentFilters`, `fetch`, скачивание `Blob`, имя из `Content-Disposition`, состояния кнопки
- [ ] T009 Блокировать кнопку при пустом списке и разблокировать после ответа; проверить в браузере на пустом и заполненном списке

## Phase 4: Документация и сквозные проверки

- [x] T010 Описать endpoint и пример `curl` в `README.md`; воспроизвести пример
- [x] T011 Прогнать `make test`, `go vet ./...`, `make build`; проверить BOM через `hexdump -C` и открытие файла в LibreOffice
- [x] T012 Сквозной сценарий: фильтр по городу → экспорт → число строк совпадает с выборкой; `curl -D-` + сверка `wc -l`

## Phase 5: Приёмка

- [ ] T013 Показать diff и результаты проверок человеку, зафиксировать решение о приёмке
- [x] T014 Записать рефлексию `../homework/reflection.md` (что согласовали, где пришлось вмешаться)
