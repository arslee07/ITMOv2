# ДЗ 5 — две команды, одна фича

**Фича**: экспорт видимых магазинов в CSV.
**Проект**: `practices/practice_05/vkusvill` (brownfield, перенесён из `practice_04`).
**SDD-фреймворк сравнения**: GitHub Spec Kit 1.1.3.

## Что где лежит

```text
practices/practice_05/
├── PLAN.md                      # план работ по практике и ДЗ
├── part1/                       # практика на OpenSpec
│   ├── explore.md               # шаг 1: что уже есть, baseline, границы
│   ├── review-01.md             # ревью спеки отдельным чатом + решения
│   └── verify-01.md             # независимая проверка фичи
├── part2/                       # настройка OpenSpec (правило для design)
│   ├── config-before.yaml / config-after.yaml
│   ├── instructions-before.json / instructions-after.json
│   ├── design-before.md / design-after.md / design.diff
│   └── README.md
├── homework/
│   ├── README.md                # этот файл
│   ├── comparison.md            # Spec Kit vs OpenSpec
│   ├── reviews.md               # переговорный чат двух команд
│   └── reflection.md            # рефлексия
└── vkusvill/
    ├── openspec/                # OpenSpec: конфиг, main spec, архив change
    ├── .specify/                # Spec Kit: конституция, шаблоны, команды
    └── specs/001-export-shops-csv/
        ├── ui-spec.md           # спека команды UI
        ├── logic-spec.md        # спека команды логики
        ├── contract.md          # общий контракт + история согласования
        ├── history/             # версии спек «до» согласования
        ├── plan.md
        └── tasks.md
```

## Как проверять

```bash
cd practices/practice_05/vkusvill
make build && make test        # go build + go test ./...
PORT=8099 WARM_MAX_PAGES=1 ./bin/vkusvill   # http://localhost:8099

curl -s -D- "http://localhost:8099/api/export.csv?city_id=6423" -o shops.csv
head -2 shops.csv               # BOM + заголовок + данные
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:8099/api/export.csv?city_id=abc"  # 400
```

В браузере: открыть список магазинов → кнопка «CSV» в шапке списка.

## Доказательства (факты прогона)

- `go test ./...` — все пакеты зелёные; `internal/web` включает табличные тесты
  фильтрации, CSV, заголовков, лимита и отказа до MCP.
- `curl` на запущенном сервисе:
  - `200`, `Content-Type: text/csv; charset=utf-8`,
    `Content-Disposition: attachment; filename="vkusvill-shops-…csv"`,
    `Cache-Control: no-store`;
  - файл начинается с `ef bb bf`, колонки `ID;Адрес;Город;Рейтинг;Широта;Долгота;Метро;Удобства;Расстояние`;
  - фильтр `city_id=6423` → 6 строк данных + заголовок, все «г. Москва»;
  - пустой результат по `q=zzzzz` → 1 строка (заголовок), код `200`;
  - `city_id=abc` → `400` с текстом «некорректный параметр city_id».
- Лимит: тест `TestHandleExportCSVLimit` — 20 000 строк `200`, 20 001 → `413`.

## Что осталось человеку

- Демо в браузере: пустой список → кнопка недоступна; нажатие → скачивание;
  ошибка сети → сообщение в области списка (пункт T009 в `tasks.md`).
- Приёмка diff (пункт T013) и защита решения.
