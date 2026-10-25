# Tasks

## 1. Валидация параметров

- [x] 1.1 Завести `ValidationError` и хелперы разбора параметра (`parseIntParam`, `parseCoordParam`) в `internal/web`; проверить `go build ./...`
- [x] 1.2 Перевести `parseQueryParams` на возврат ошибки: id, page, координаты (пара + конечность), `q`; добавить `HasLocation` в `mcp.QueryParams`; проверить `go vet ./...`
- [x] 1.3 Добавить табличные тесты на все сценарии из `specs/shop-filtering/spec.md` и убедиться, что `go test ./internal/web/` зелёный

## 2. Обработчики

- [x] 2.1 Возвращать `400` с текстом ошибки в `HandleIndex`, `HandleShops`, `HandleShopsPoints`; проверить `go build ./...`
- [x] 2.2 Тест «MCP не вызван»: клиент смотрит на `httptest`-счётчик, невалидный запрос даёт `400` и ноль обращений — `go test ./internal/web/`
- [x] 2.3 Тест совместимости: запрос без параметров, `page=0`, `city_id=`, `scope=all&lon=200` дают прежние успешные ответы — `go test ./internal/web/`
- [x] 2.4 Тест `lat=0&lon=0`: сортировка по расстоянию включена (`HasLocation`) — `go test ./internal/web/`

## 3. Документация и интеграция

- [x] 3.1 Дописать в `README.md` раздел про параметры фильтра, коды ответов и пример `curl`; проверить, что пример воспроизводится на запущенном сервисе
- [x] 3.2 Прогнать `make test` и `go build ./...` на чистом дереве

## Workflow follow-up

- Показать diff человеку, получить приёмку.
- Обновить main specs (`openspec sync`) и заархивировать change.
