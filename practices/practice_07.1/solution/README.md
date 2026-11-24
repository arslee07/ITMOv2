# ДЗ 7.1 — отчёт

Сценарий в n8n делает ревью PR. `/make_ai_review` → `openai/gpt-5.2`, `/make_other_ai_review` → `anthropic/claude-sonnet-4.5`. Отревьюенные PR пишутся в Data Table `PR Reviews`, повторный `/make_ai_review` к тому же PR блокируется. Замечания публикуются точечно к строкам изменённого кода.

- **PR:** https://github.com/arslee07/sample-python-project/pull/3
- **Сценарий:** `workflows/workflow_export.json`
- **Data Table:** `PR Reviews` (`pr_id`: Number, `repo`: String, `model`: String, `reviewed_at`: Date)

## Критерии

| # | Критерий | Доказательство |
|---|---|---|
| 1 | `/make_other_ai_review` → ревью второй моделью | Exec **8846** (`AI review (secondary)`), summary-комментарий в PR · `screenshots/step1-secondary.jpg` |
| 2 | Data Table, `pr_id` сохраняется | 2 строки `pr_id=3` (primary, secondary) · `screenshots/step2-data-table.jpg` |
| 3 | Повторный `/make_ai_review` не запускает ревью | Exec **8843** (запуск) → Exec **8845** (`Already reviewed (stop)`) · `screenshots/step3-dedup.jpg` |
| 4 | Точечные комментарии по блокам diff | Комментарии на `blog/models.py:25`, `blog/views.py:17/18` · `screenshots/step4-files-changed.jpg` |

## Как проверить

1. Импортировать `workflows/workflow_export.json`.
2. Создать credential GitHub API и OpenAI (Base URL VseLLM), выбрать их в нодах.
3. Создать Data Table `PR Reviews` с колонками из шапки, выбрать её в нодах `Check reviewed` и `Save reviewed PR`.
4. Publish, написать в PR `/make_ai_review`, затем `/make_other_ai_review`, затем `/make_ai_review` ещё раз.
