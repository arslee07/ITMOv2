.PHONY: build run test clean

build:
	@mkdir -p bin
	go build -o bin/vkusvill cmd/server/main.go

run:
	go run cmd/server/main.go

test:
	go test -v ./...

init-hooks:
	@git config core.hooksPath .githooks
	@chmod +x .githooks/*
	@echo "Git hooks configured successfully in .githooks/"

clean:
	rm -rf bin
