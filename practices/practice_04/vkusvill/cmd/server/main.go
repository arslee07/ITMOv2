package main

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	"vkusvill/internal/config"
	"vkusvill/internal/mcp"
	"vkusvill/internal/web"
)

func main() {
	if err := run(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func run() error {
	cfg := config.Load()

	log.Printf("Starting VkusVill Radar...")
	log.Printf("Configured MCP endpoint: %s", cfg.MCPURL)

	// 1. Initialize MCP client and cache
	mcpClient := mcp.NewClient(cfg.MCPURL)
	storeCache := mcp.NewStoreCache()

	// 2. Pre-warm initial filters and first page of shops in background
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		log.Printf("Pre-fetching initial filters and shops from VkusVill MCP...")
		if _, err := storeCache.GetOrFetchFilters(ctx, mcpClient); err != nil {
			log.Printf("Background pre-fetch warning: %v", err)
		} else {
			log.Printf("Initial filters and stores cached successfully")
		}
	}()

	// 2b. Warm the whole catalog in the background, incrementally and within
	// the VkusVill rate limit (see AGENTS.md §5). The map accumulates markers
	// as pages arrive instead of showing a single page.
	warmCtx, warmCancel := context.WithCancel(context.Background())
	defer warmCancel()
	go func() {
		log.Printf("Warming shop catalog in background (this can take a few minutes)...")
		storeCache.WarmCatalog(warmCtx, mcpClient, mcp.WarmOptions{MaxPages: cfg.WarmMaxPages})
		if warmCtx.Err() == nil {
			log.Printf("Catalog warm-up finished")
		}
	}()

	// 3. Initialize Template View Manager
	viewMgr, err := web.NewViewManager()
	if err != nil {
		return fmt.Errorf("init view manager: %w", err)
	}

	// 4. Setup HTTP Handlers
	handler := web.NewHandler(storeCache, mcpClient, viewMgr)

	mux := http.NewServeMux()

	// Static assets handler
	staticSubFS, err := fs.Sub(web.StaticFS(), "static")
	if err != nil {
		return fmt.Errorf("create static sub filesystem: %w", err)
	}
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServer(http.FS(staticSubFS))))

	// Web Routes (Go 1.22+ routing patterns)
	mux.HandleFunc("GET /{$}", handler.HandleIndex)
	mux.HandleFunc("GET /shops", handler.HandleShops)
	mux.HandleFunc("GET /api/shops/points", handler.HandleShopsPoints)

	// 5. Setup HTTP Server with timeouts
	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           loggingMiddleware(mux),
		ReadHeaderTimeout: 5 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// 6. Graceful shutdown
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	serverErr := make(chan error, 1)
	go func() {
		log.Printf("VkusVill Radar running on http://localhost:%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
	}()

	select {
	case <-ctx.Done():
		log.Println("Shutting down gracefully...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return server.Shutdown(shutdownCtx)
	case err := <-serverErr:
		return fmt.Errorf("listen and serve: %w", err)
	}
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}
