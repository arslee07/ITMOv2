# Практика 6. Моделирование угроз и атаки с помощью LLM

## Что в PR

- **`THREAT_MODEL.md`** — модель угроз Mini Shop: активы, границы доверия,
  mermaid-диаграмма, STRIDE и OWASP LLM (prompt injection, excessive agency,
  confused deputy), меры и способ проверки.
- **`REPORT_01.md`** — 25 воспроизведённых атак на исходный сервис с запросами,
  фактическими ответами, влиянием и CWE/OWASP-категориями.
- **`judge-system-prompt.md`** — независимый LLM-судья: рубрика 0–10, формат
  ответа, запрет домысливать и защита от инъекций в проверяемом тексте.
- **`lab/service.py`** — исправления: параметризованный SQL, сессионная
  авторизация и RBAC, проверка владельца и канонизации путей, цена из каталога,
  экранирование HTML, redaction логов, allowlist инструментов, отключение
  `delete_tree`, TTL сессий и rate limit.
- **`lab/test_security.py`** — 22 регрессионных теста; на исходном коде падают,
  после фикса проходят.
- **`attacks/`** — воспроизводимые скрипты: `attack_suite.py`,
  `forced_decisions.py`, `log_redaction.py`, `injection_check.py`,
  `llm_experiment.py`.
- **`REPORT_02.md`** — повторные атаки после фикса и остаточные риски.
- **`evidence/`** — логи до/после, вывод LLM, diff, результаты `make test`.

`sandbox.py` не изменялся: физическая граница каталога и loopback-привязка
сохранены, RCE/shell/внешние URL не добавлены.

## Проверка

```bash
cd practices/practice_06/lab && python3 service.py --port 8066
cd practices/practice_06
python3 attacks/attack_suite.py --out evidence/after/attacks.json
python3 attacks/forced_decisions.py --out evidence/after/forced.json
python3 attacks/log_redaction.py --out evidence/after/log_redaction.json
python3 attacks/injection_check.py --out evidence/after/injection.json
python3 attacks/llm_experiment.py --outdir evidence/after --case both
cd ../.. && make step6 && make test
```

Результаты:

| Проверка | До | После |
|---|---:|---:|
| `attack_suite.py` | 25/25 уязвимо | **0/25** |
| `forced_decisions.py` | — | **7/7** |
| `log_redaction.py` | — | **7/7** |
| `injection_check.py` | — | **7/7** |
| `make step6` / `make test` | — | **38 tests OK** |

LLM-эксперимент (`gpt-5` и `deepseek-v4-pro`, отдельный процесс без инструментов):
обе модели отказались от инъекции в отзыве; после фикса корректно читают только
свой чек. Прямая передача опасного JSON в `/assistant/execute` блокируется
сервером независимо от ответа модели.

## Выводы

Главный результат практики — наглядная демонстрация того, что «модель послушалась /
не послушалась» не является мерой безопасности. В исходном сервисе анонимный клиент
мог выгрузить все профили, прочитать служебную заметку и удалить файлы через
`/assistant/execute`; SQL-инъекции и публичный журнал делали компрометацию полной.
При этом обе проверенные LLM отказались выполнять инъекцию из отзыва. Значит,
защита должна стоять на сервере: сессия, владелец, роль и допустимость инструмента
проверяются заново при каждом решении, а текст отзыва остаётся недоверенными
данными, а не полномочием.

После исправлений все 25 атак закрыты, 38 тестов проходят, а законные сценарии
(свой профиль и чек, покупка по цене каталога, отзыв, staff-экспорт по сессии)
сохранились. Самое полезное наблюдение — confused deputy: даже «честная» модель
может предложить опасный инструмент, поэтому `delete_tree` отключён для API,
`export_profiles` доступен только staff, а `read_file` ограничен каталогом
текущего пользователя.
