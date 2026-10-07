> **⚠️ Этот файл сгенерирован AI-агентом (OpenCode), а не студентом.**
> Это вспомогательный индекс артефактов и подтверждений для ревьювера, а не обязательная часть сдачи.
> Единственный документ, написанный самим студентом, — [`reflection.md`](reflection.md).

---

# Отчёт агента по практике 4 — что сдаётся и как проверено

Домашка выполнена на собственном проекте **«ВкусВилл Радар»**, перенесённом в
`practices/practice_04/vkusvill/` (файлы проекта, без `.git`; ключ VseLLM в
`opencode.json` заменён на `{env:VSELLM_API_KEY}`).

## Артефакты среды

| Требование | Файл |
|---|---|
| Правила для агента | `vkusvill/AGENTS.md` (§1 периметр, §3 Go, §4 UI/a11y, §5 внешний MCP, §6 проверки, §7 свой MCP) |
| Skill + ресурсы | `vkusvill/.agents/skills/vv-mcp-verify/{SKILL.md,scripts/verify_mcp.sh,references/jsonrpc.md}` |
| MCP-конфигурация | `vkusvill/opencode.json` → `mcp.servers.vvmcp` (`go run ./cmd/vvmcp`), `formatter: true` |
| Hook (автопроверка после правки) | `vkusvill/.opencode/plugins/vv-checks/index.ts` (`tool.execute.after`) |
| Runner | `make test` (`go test ./...`); git-хуки `vkusvill/.githooks/{pre-commit,commit-msg}` |
| Собственный MCP | `vkusvill/cmd/vvmcp/main.go` + тест; логика `vkusvill/internal/audit/` + тест |

## Подтверждения

### 1. Среда: агент читает правила, грузит skill, вызывает MCP

- `opencode mcp list` → `✓ vvmcp  connected`.
- Реальный вызов tool из агента (Code Mode):
  `tools["vvmcp"]["audit_templates"]({dir:"internal/web/templates"})` →
  `Просканировано: 4 файла. Предупреждений: 16. Правила: svg-missing-aria-hidden.`

### 2. Собственный MCP: успешный и ошибочный вход

Прямая проверка по stdio (`initialize` → `tools/list` → два `tools/call`):

- успех → `isError: false`, отчёт: 4 файла, 16 warnings (`svg-missing-aria-hidden`);
- ошибка → `isError: true`, `audit dir "no/such/dir": stat no/such/dir: no such file or directory`.

То же самое проверяет skill:

```
$ vkusvill/.agents/skills/vv-mcp-verify/scripts/verify_mcp.sh
PASS: 4 files, 0 errors, 16 warnings
error-case message: audit dir "missing-dir": stat missing-dir: no such file or directory
```

### 3. Hook: результат после правки возвращается агенту

После `write`/`edit` `.go`-файла в результат инструмента добавляется блок
(проверено через `opencode run --format json`):

```
[vv-checks] Автопроверка после правки …
Итог: есть проблемы.
✅ gofmt -l .
❌ go vet ./...
# vkusvill
vet: ./probe_tmp.go:3:8: …
```

Модель получила этот блок и сообщила, что проверки падают.

### 4. Тесты проекта

```
$ cd vkusvill && go test ./... && gofmt -l .
ok  vkusvill/cmd/vvmcp
ok  vkusvill/internal/audit
ok  vkusvill/internal/mcp
ok  vkusvill/internal/web
```

## Запуск

```bash
cd practices/practice_04/vkusvill
make test                                   # go test ./...
go run ./cmd/vvmcp                          # ручной прогон MCP-сервера
.agents/skills/vv-mcp-verify/scripts/verify_mcp.sh
```
