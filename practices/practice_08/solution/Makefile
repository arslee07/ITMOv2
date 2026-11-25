SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help install setup dev stop status api test test-watch typecheck build start e2e e2e-headed e2e-debug e2e-report check clean

help: ## Показать доступные команды
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z0-9_-]+:.*## / {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Установить зависимости
	npm install

setup: install ## Создать .env из примера, если файла ещё нет
	@if [ -f .env ]; then echo ".env уже есть"; else cp .env.example .env && echo "Создан .env — заполните VSELLM_API_KEY, если нужен режим llm"; fi

dev: ## Запустить Vite и API вместе
	npm run dev

stop: ## Остановить dev-сервер, запущенный через make dev
	@if [ -f var/dev.pid ]; then \
		pid=$$(cat var/dev.pid); \
		if kill -0 $$pid 2>/dev/null; then kill $$pid; echo "Остановлено: PID $$pid"; else echo "PID $$pid уже не работает"; fi; \
		rm -f var/dev.pid; \
	else \
		found=0; \
		for pid in $$(pgrep -f "^node scripts/dev.mjs$$" || true); do \
			if [ "$$(readlink /proc/$$pid/cwd 2>/dev/null)" = "$(CURDIR)" ]; then \
				kill $$pid; echo "Остановлено: PID $$pid"; found=1; \
			fi; \
		done; \
		if [ $$found -eq 0 ]; then \
			echo "dev-сервер не найден. Если порт занят, смотрите:"; \
			echo "  ss -ltnp | grep -E ':5173|:8787'"; \
		fi; \
	fi

status: ## Проверить, отвечают ли API и Vite
	@body=$$(curl -s --max-time 2 http://127.0.0.1:8787/api/health || true); \
	if [ -n "$$body" ]; then echo "API:  $$body"; else echo "API:  не отвечает"; fi
	@code=$$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://localhost:5173/ || true); \
	if [ "$$code" = "200" ]; then echo "Vite: 200"; else echo "Vite: не отвечает ($$code)"; fi

api: ## Запустить только API на 8787
	npm run api

test: ## Прогнать все клиентские тесты
	npm test

test-watch: ## Тесты в watch-режиме
	npm run test:watch

typecheck: ## Проверить типы
	npx tsc --noEmit

build: ## Собрать production-версию
	npm run build

start: ## API и статика из dist на 8787 (сначала build)
	npm start

e2e: ## Интеграционные тесты в реальном браузере (headless)
	npx playwright test

e2e-headed: ## Интеграционные тесты с видимым браузером
	PW_SLOWMO=400 npx playwright test --headed --workers=1

e2e-debug: ## Пошаговый прогон с Playwright Inspector
	npx playwright test --debug --workers=1

e2e-report: ## Открыть HTML-отчёт последнего прогона
	npx playwright show-report

check: test build ## Проверка перед сдачей: тесты и сборка

clean: ## Удалить сборку, локальные данные и отчёты
	rm -rf dist var coverage test-results playwright-report
