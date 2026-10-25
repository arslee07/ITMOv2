# Практика 5 + ДЗ 5 — рабочий план

Проект: `practices/practice_05/vkusvill` (перенесён из ветки `practice_04`, brownfield).
Проверка проекта: `go build ./...`, `go test ./...` (Makefile: `make test`).
OpenSpec: 1.14.1, `openspec init --profile core --tools opencode`.

## Часть 1 — практика (OpenSpec, полный цикл)

Фича: **валидация параметров фильтра** (`validate-filter-input`).

Почему: маленькая, затрагивает существующий `parseQueryParams` в
`internal/web/handlers.go`, проверяется настоящими Go-тестами, не требует
нового backend и не ломает текущее поведение для валидных запросов.

Цикл: explore → propose → review (отдельный агент) → update → apply →
verify (отдельный агент) → sync → archive.

Артефакты: `practices/practice_05/vkusvill/openspec/changes/validate-filter-input/`.

## Часть 2 — практика (настройка OpenSpec)

1. Сохранить фрагмент design «до» (без правила).
2. Добавить постоянное правило в `openspec/config.yaml`:

   ```yaml
   rules:
     design:
       - Объясни взаимодействие диаграммой Mermaid.
   ```

3. Проверить, что правило попадает в `openspec instructions design ... --json`.
4. Применить правило к тому же фрагменту и показать diff «до/после».

## ДЗ 5 — две команды, одна фича (10 баллов)

Фича: **экспорт видимых магазинов в CSV** (`export-shops-csv`).
Фреймворк сравнения: **GitHub Spec Kit 1.1.3** (из лекции 5).

- Команда 1 — спека UI: кнопка экспорта, состояния (idle/loading/empty/error),
  имя файла, доступность, обратная связь.
- Команда 2 — спека логики: endpoint `/api/export.csv`, набор фильтров,
  колонки и их порядок, экранирование, кодировка, сортировка, лимиты.
- Общий контракт: параметры запроса, ответ, ошибки, совместимость.
- Реализация + сквозная проверка (Go httptest + запуск сервиса и curl).
- `reflection.md`.

Артефакты ДЗ: `practices/practice_05/homework/`.

## Сдача

- Спеки до/после (OpenSpec — часть 1, Spec Kit — ДЗ).
- Общий контракт двух команд.
- Код + `go test ./...` + демо.
- Рефлексия.
