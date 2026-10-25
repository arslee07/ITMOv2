# Практика 5 — Spec-driven development

Материалы задания: [`prenetation.pdf`](prenetation.pdf).
Проект для работы: [`vkusvill/`](vkusvill/) — brownfield из практики 4
(Go + HTMX + MCP ВкусВилл).

## Что сделано

| Часть | Где | Итог |
|---|---|---|
| Часть 1 — полный цикл OpenSpec | `vkusvill/openspec/`, [`part1/`](part1/) | change `validate-filter-input` прошёл explore → propose → review → apply → verify → sync → archive; main spec `shop-filtering` (7 требований) |
| Часть 2 — настройка OpenSpec | [`part2/`](part2/) | правило `rules.design: Mermaid` в `openspec/config.yaml`, diff «до/после» на одном фрагменте |
| ДЗ 5 — две команды, одна фича | [`homework/`](homework/), `vkusvill/specs/001-export-shops-csv/` | две согласованные спеки (UI + логика), контракт, реализация экспорта CSV, Spec Kit 1.1.3, рефлексия |

План работ и обоснование выбора фич: [`PLAN.md`](PLAN.md).

## Быстрый запуск

```bash
cd vkusvill
make build && make test
PORT=8099 WARM_MAX_PAGES=1 ./bin/vkusvill
# http://localhost:8099 — карта и список магазинов
# http://localhost:8099/api/export.csv?city_id=6423 — CSV
```

## Где смотреть доказательства

- `part1/review-01.md` — ревью спеки отдельным чатом и решения человека.
- `part1/verify-01.md` — независимая проверка на запущенном сервисе.
- `part2/design.diff` + `instructions-*.json` — правило действительно попадает в
  инструкции OpenSpec.
- `homework/README.md` — факты прогона и что осталось показать вживую.
- `homework/comparison.md` — Spec Kit против OpenSpec.
- `homework/reflection.md` — каркас: факты и вопросы, ответы пишешь сам.
