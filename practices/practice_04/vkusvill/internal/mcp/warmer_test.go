package mcp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

// fakeShopsServer answers tools/call for vkusvill_shops with a synthetic,
// paginated catalog, so warming can be tested without the network.
func fakeShopsServer(t *testing.T, totalPages, perPage, regions int) (*httptest.Server, *int32) {
	t.Helper()

	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)

		var req jsonrpcRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}

		page := 1
		if params, ok := req.Params.(map[string]any); ok {
			if args, ok := params["arguments"].(map[string]any); ok {
				if p, ok := args["page"].(float64); ok {
					page = int(p)
				}
			}
		}

		regionItems := make([]FilterItem, 0, regions)
		for i := 0; i < regions; i++ {
			regionItems = append(regionItems, FilterItem{ID: i + 1, Name: "region"})
		}

		items := make([]Shop, 0, perPage)
		for i := 0; i < perPage; i++ {
			items = append(items, Shop{
				ID:      (page-1)*perPage + i + 1,
				Address: "addr",
				Lat:     55.7,
				Lon:     37.6,
			})
		}

		payload := ShopsResponse{OK: true, Data: ShopsData{
			Meta: Meta{
				Page:    page,
				Pages:   totalPages,
				Total:   totalPages * perPage,
				Filters: []FilterGroup{{Name: "Регион", Items: regionItems}},
			},
			Items: items,
		}}
		inner, err := json.Marshal(payload)
		if err != nil {
			http.Error(w, "marshal", http.StatusInternalServerError)
			return
		}

		resp := jsonrpcResponse{
			JSONRPC: "2.0",
			ID:      1,
			Result:  toolResult{Content: []toolContent{{Type: "text", Text: string(inner)}}},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	t.Cleanup(srv.Close)

	return srv, &calls
}

func TestWarmCatalogSweepsAllPages(t *testing.T) {
	totalPages, perPage, regions := 3, 4, 2
	srv, _ := fakeShopsServer(t, totalPages, perPage, regions)
	cache := NewStoreCache()
	client := NewClient(srv.URL)

	cache.WarmCatalog(context.Background(), client, WarmOptions{Delay: time.Millisecond})

	want := totalPages * perPage
	if got := len(cache.GetAllCachedShops()); got != want {
		t.Fatalf("cached shops = %d, want %d", got, want)
	}

	warmedPages, total, shops := cache.WarmStats()
	if total != totalPages {
		t.Errorf("total pages = %d, want %d", total, totalPages)
	}
	if warmedPages != totalPages {
		t.Errorf("warmed pages = %d, want %d", warmedPages, totalPages)
	}
	if shops != want {
		t.Errorf("stats shops = %d, want %d", shops, want)
	}
}

func TestWarmCatalogHonoursMaxPages(t *testing.T) {
	tests := []struct {
		name     string
		maxPages int
		want     int
	}{
		{name: "cap below total", maxPages: 2, want: 10},
		{name: "cap above total clamps to total", maxPages: 99, want: 15},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv, _ := fakeShopsServer(t, 3, 5, 0)
			cache := NewStoreCache()
			client := NewClient(srv.URL)

			cache.WarmCatalog(context.Background(), client, WarmOptions{Delay: time.Millisecond, MaxPages: tt.maxPages})

			if got := len(cache.GetAllCachedShops()); got != tt.want {
				t.Fatalf("cached shops = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestWarmCatalogStopsWhenCancelled(t *testing.T) {
	srv, _ := fakeShopsServer(t, 100, 10, 0)
	cache := NewStoreCache()
	client := NewClient(srv.URL)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	cache.WarmCatalog(ctx, client, WarmOptions{Delay: time.Millisecond})

	if got := len(cache.GetAllCachedShops()); got != 0 {
		t.Fatalf("cancelled warm cached %d shops, want 0", got)
	}
}
