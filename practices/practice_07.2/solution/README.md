# ДЗ 7.2 — отчёт

Автоматизация GitHub Issues: классификация новых обращений через LLM и еженедельная статистика с письмом на почту.

- **Тестовый репозиторий:** https://github.com/arslee07/sample-python-project
- **Сценарии:** `workflows/wf1_issue_classifier.json`, `workflows/subworkflow_classifier.json`, `workflows/weekly_stats.json`
- **Data Table:** `weekly_stats` (`week_start`: Date, `issues_opened`, `issues_closed`, `prs_opened`, `prs_merged` — Number, `by_type`, `by_author` — String)

## Часть 1. Классификация Issues

```
GitHub Trigger (issues) → Is opened? → Build classifier input → Run classifier (sub-workflow)
 → Route by type → bug / task / feature / needs-triage
```

Классификатор живёт в отдельном сценарии `subworkflow_classifier.json`: `Execute Workflow Trigger` принимает `title` и `body`, внутри Basic LLM Chain + Structured Output Parser (`type`, `confidence`).

## Часть 2. Недельная статистика

```
Cron (0 9 * * MON) → Issues created / Issues closed / PRs opened / PRs merged (GitHub API)
 → Group stats (Code: по типу и автору) → Get previous week → Compute delta
 → AI annotation → Build email → Save weekly stats → Send weekly email (Gmail, HTML)
```

## Критерии

| # | Критерий | Доказательство |
|---|---|---|
| 1 | Issue классифицируется, лейбл проставлен | #10 → `bug`, #11 → `feature-request`, #14 → `task`; exec 9022 (`Run classifier` → `type: bug`, 0.95 → `Label bug` → `Comment bug`) · `screenshots/step1-classification.jpg` |
| 2 | `confidence < 0.8` → `needs-triage` без комментария | #12 (`task` 0.74), #13 (`unknown` 0.55) · `screenshots/step2-needs-triage.jpg` |
| 3 | Sub-workflow для классификатора | Exec 8950 (`mode: integrated`) — вызов из WF1 через `Run classifier` · `screenshots/step3-subworkflow.jpg` |
| 4 | Cron-триггер, 4 запроса за неделю | `0 9 * * MON`, Exec 8991 · `screenshots/step4-cron-queries.jpg` |
| 5 | Code группирует по типу и автору | таблицы «По типам» / «По авторам» в письме · `screenshots/step5-email.jpg` |
| 6 | HTML-письмо через Gmail | `screenshots/step5-email.jpg` |
| 7 | Статистика сохраняется в Data Table | 2 строки в `weekly_stats` · `screenshots/step6-data-table.jpg` |
| 8 | Δ к прошлой неделе по данным таблицы | колонка «Δ к прошлой» в письме · `screenshots/step5-email.jpg` |
| 9 | Блок «AI-комментарий недели» | блок в письме · `screenshots/step5-email.jpg` |

## Как проверить

1. Импортировать три JSON.
2. Создать credential GitHub API и OpenAI (Base URL VseLLM), Gmail OAuth2; выбрать их в нодах.
3. Создать Data Table `weekly_stats` с колонками из шапки.
4. В `Run classifier` выбрать sub-workflow `hw7.2_classifier`.
5. Создать Issue → проверить лейбл и комментарий.
6. Запустить weekly-сценарий вручную (cron ждать не обязательно) → письмо на почту.
