# Журнал экспериментов Практики 2

- Выбранный слабый артефакт Практики 1: practices/practice_01/adr.md (раздел санитизации секретов SEC-1)
- Что в нём нужно улучшить: Уточнить правила санитизации секретов: сейчас там лишь общее упоминание [REDACTED], нет чётких паттернов (API-токены, приватные ключи) и есть риск ложного маскирования git commit sha.
- Как поймём, что изменение полезно: В adr.md появятся однозначные правила и примеры, исключающие порчу diff и утечку реальных ключей.

| Техника | Файл эксперимента | Изменённый файл Практики 1 | Конкретное изменение | Проверка | Что отклонили |
|---|---|---|---|---|---|
| Few-shot | [`few_shot/experiment.md`](few_shot/experiment.md) | practices/practice_01/adr.md | Добавлены паттерны для токенов и исключение git sha (40 hex) из маскирования | Юнит-тест diff с ghp_ токеном и git sha | Отказ от энтропийной маскировки >4.5 |
| R.C.T.F. | [`rctf/experiment.md`](rctf/experiment.md) | practices/practice_01/adr.md | Спецификация пула соединений и параметров Circuit Breaker при таймаутах REL-1 | Нагрузочный тест k6 test_timeout_storm.js | Экспоненциальные повторы (retries) при таймаутах |
| Chain of Verification | [`chain_of_verification/experiment.md`](chain_of_verification/experiment.md) | practices/practice_01/tests_unit.md | Отсечение непроверяемых требований (авторизация, стиль) и фиксация граничного теста API-1 (20 001 символ) | Тест test_diff_size_limit_exceeded | Неподтверждённые замечания по аутентификации и стилю кода |
| RAG | [`rag/experiment.md`](rag/experiment.md) | practices/practice_01/adr.md | Фиксация политики логирования OBS-1 (запрет логирования diff и ответов) на основе точных ссылок на CASE.md | Ручная сверка цитат с правилами OUT-1 и OBS-1 в CASE.md | Неподтверждённые предложения по внешним системам мониторинга (ELK, Prometheus) |
| Tree of Thoughts | [`tree_of_thoughts/experiment.md`](tree_of_thoughts/experiment.md) | practices/practice_01/adr.md | Сравнение 3 стратегий санитизации секретов (ML vs Regex vs DLP) и фиксация выбора Regex-first в ADR | Бенчмарк времени санитизации diff 20k символов (<5 мс) | ML-сканер секретов и внешние DLP API |
| ReAct | [`react/experiment.md`](react/experiment.md) | practices/practice_01/prompts.md | Лимит 5 шагов и немедленная остановка при 3 рисках | Лог шагов агента в react/experiment.md | Поиск дополнительных замечаний сверх лимита |
| Chain of Verification | [`chain_of_verification/experiment.md`](chain_of_verification/experiment.md) |  |  |  |  |
| Tree of Thoughts | [`tree_of_thoughts/experiment.md`](tree_of_thoughts/experiment.md) |  |  |  |  |
| RAG | [`rag/experiment.md`](rag/experiment.md) |  |  |  |  |
| ReAct | [`react/experiment.md`](react/experiment.md) |  |  |  |  |

## Независимое ревью

| Замечание другой команды | Где исправили | Evidence |
|---|---|---|
| Двусмысленность: в adr.md фраза «diff очищается от секретов» не определяла регистрозависимость префиксов токенов и обработку многострочных блоков | practices/practice_01/adr.md, подраздел «2. Санитизация» | Добавлено требование case-insensitive сопоставления префиксов (ghp_, glpat_) и обработка многострочных блоков BEGIN/END PRIVATE KEY |
| Непроверяемое требование: требование «LLM-клиент не должен зависать» не содержало точного таймаута и статуса ошибки | practices/practice_01/adr.md (подраздел 3) и practices/practice_01/tests_integration.md | Установлен жесткий лимит 10.0 с, возврат HTTP 503 и добавлен тест test_api_reviews_llm_timeout_handled с проверкой времени прерывания |
| Пропущенный риск: не была учтена деградация сервиса при таймаут-шторме (исчерпание пула воркеров/соединений) | practices/practice_01/adr.md и practices/practice_01/tests_load.md | Спроектирован Circuit Breaker (5 таймаутов подряд -> статус OPEN на 30с с отдачей 503 без сетевых вызовов) и тест test_timeout_storm.js |
