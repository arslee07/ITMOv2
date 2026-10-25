package web

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"vkusvill/internal/mcp"
)

func shop(id int, cityID int, cityName, address string, rating float64, lat, lon float64, features []mcp.NamedItem, subway []mcp.SubwayItem) mcp.Shop {
	var city *mcp.NamedItem
	if cityID > 0 {
		city = &mcp.NamedItem{ID: cityID, Name: cityName}
	}
	var region *mcp.NamedItem
	if cityID > 0 {
		region = &mcp.NamedItem{ID: cityID, Name: "регион"}
	}
	return mcp.Shop{
		ID:       id,
		Region:   region,
		City:     city,
		Address:  address,
		Rating:   rating,
		Lat:      lat,
		Lon:      lon,
		Features: features,
		Subway:   subway,
	}
}

func exportTestShops() []mcp.Shop {
	return []mcp.Shop{
		shop(1, 6423, "г. Москва", `ул. Мира, 1; корпус "А"`, 4.5, 55.76, 37.62,
			[]mcp.NamedItem{{ID: 10, Name: "Кафе"}, {ID: 11, Name: "Пекарня"}},
			[]mcp.SubwayItem{{ID: 1, Name: "Тверская"}}),
		shop(2, 6431, "г. Санкт-Петербург", "Невский пр., 2", 0, 59.93, 30.33, nil, nil),
		shop(3, 6423, "г. Москва", "Арбат, 3", 4.9, 55.75, 37.59, nil,
			[]mcp.SubwayItem{{ID: 2, Name: "Арбатская"}}),
	}
}

func TestFilterShops(t *testing.T) {
	tests := []struct {
		name   string
		params mcp.QueryParams
		want   []int
	}{
		{name: "no filters keeps everything", params: mcp.QueryParams{}, want: []int{1, 2, 3}},
		{name: "city filter", params: mcp.QueryParams{CityID: 6423}, want: []int{1, 3}},
		{name: "feature filter", params: mcp.QueryParams{FeatureID: 10}, want: []int{1}},
		{name: "region filter", params: mcp.QueryParams{RegionID: 6423}, want: []int{1, 3}},
		{name: "subway filter", params: mcp.QueryParams{SubwayID: 2}, want: []int{3}},
		{name: "search by address ignores case", params: mcp.QueryParams{SearchText: "арбат"}, want: []int{3}},
		{name: "search by subway", params: mcp.QueryParams{SearchText: "тверская"}, want: []int{1}},
		{name: "no matches", params: mcp.QueryParams{SearchText: "ничего"}, want: []int{}},
		{name: "city and search", params: mcp.QueryParams{CityID: 6431, SearchText: "москва"}, want: []int{}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := filterShops(exportTestShops(), tt.params)
			ids := make([]int, 0, len(got))
			for _, s := range got {
				ids = append(ids, s.ID)
			}
			if fmt.Sprint(ids) != fmt.Sprint(tt.want) {
				t.Errorf("filterShops() ids = %v, want %v", ids, tt.want)
			}
		})
	}
}

func readExport(t *testing.T, body []byte) [][]string {
	t.Helper()
	if !bytes.HasPrefix(body, []byte(utf8BOM)) {
		t.Fatalf("export does not start with UTF-8 BOM: %q", body[:min(len(body), 8)])
	}
	reader := csv.NewReader(bytes.NewReader(body[len(utf8BOM):]))
	reader.Comma = exportDelimiter

	records, err := reader.ReadAll()
	if err != nil {
		t.Fatalf("parse csv: %v", err)
	}
	return records
}

func TestWriteShopsCSV(t *testing.T) {
	tests := []struct {
		name      string
		params    mcp.QueryParams
		shops     []mcp.Shop
		wantIDs   []string
		wantFirst []string
	}{
		{
			name:    "sorted by id without coordinates",
			params:  mcp.QueryParams{},
			shops:   exportTestShops(),
			wantIDs: []string{"1", "2", "3"},
			wantFirst: []string{
				"1", `ул. Мира, 1; корпус "А"`, "г. Москва", "4.5", "55.760000", "37.620000",
				"Тверская", "Кафе, Пекарня", "",
			},
		},
		{
			name:    "sorted by distance with coordinates",
			params:  mcp.QueryParams{UserLat: 55.76, UserLon: 37.62, HasLocation: true},
			shops:   exportTestShops(),
			wantIDs: []string{"1", "3", "2"},
		},
		{
			name:    "shops without coordinates go last",
			params:  mcp.QueryParams{UserLat: 55.76, UserLon: 37.62, HasLocation: true},
			shops:   []mcp.Shop{shop(5, 0, "", "Без координат", 0, 0, 0, nil, nil), shop(6, 0, "", "Рядом", 0, 55.761, 37.621, nil, nil)},
			wantIDs: []string{"6", "5"},
		},
		{
			name:    "empty selection still has a header",
			params:  mcp.QueryParams{},
			shops:   nil,
			wantIDs: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var buf bytes.Buffer
			if err := writeShopsCSV(&buf, tt.shops, tt.params); err != nil {
				t.Fatalf("writeShopsCSV() error = %v", err)
			}

			records := readExport(t, buf.Bytes())
			if len(records) == 0 {
				t.Fatal("csv has no header")
			}
			if fmt.Sprint(records[0]) != fmt.Sprint(exportColumns) {
				t.Errorf("header = %v, want %v", records[0], exportColumns)
			}

			ids := make([]string, 0, len(records)-1)
			for _, row := range records[1:] {
				ids = append(ids, row[0])
				if len(row) != len(exportColumns) {
					t.Errorf("row %v has %d columns, want %d", row, len(row), len(exportColumns))
				}
			}
			if fmt.Sprint(ids) != fmt.Sprint(tt.wantIDs) {
				t.Errorf("row ids = %v, want %v", ids, tt.wantIDs)
			}

			if tt.wantFirst != nil {
				if len(records) < 2 {
					t.Fatal("expected at least one data row")
				}
				if fmt.Sprint(records[1]) != fmt.Sprint(tt.wantFirst) {
					t.Errorf("first row = %v, want %v", records[1], tt.wantFirst)
				}
			}
		})
	}
}

func TestWriteShopsCSVRawFormat(t *testing.T) {
	var buf bytes.Buffer
	if err := writeShopsCSV(&buf, exportTestShops(), mcp.QueryParams{}); err != nil {
		t.Fatalf("writeShopsCSV() error = %v", err)
	}
	raw := buf.String()

	if !strings.Contains(raw, "\r\n") {
		t.Error("rows are not terminated with CRLF")
	}
	if !strings.Contains(raw, `"ул. Мира, 1; корпус ""А"""`) {
		t.Errorf("semicolon/quote escaping is wrong:\n%s", raw)
	}
	if strings.Contains(raw, "\n\n") {
		t.Error("unexpected blank line")
	}
}

func TestWriteShopsCSVDistanceFormat(t *testing.T) {
	shops := []mcp.Shop{
		shop(1, 0, "", "Близкий", 0, 55.7605, 37.6205, nil, nil),
		shop(2, 0, "", "Далёкий", 0, 56.0, 38.0, nil, nil),
	}
	params := mcp.QueryParams{UserLat: 55.76, UserLon: 37.62, HasLocation: true}

	var buf bytes.Buffer
	if err := writeShopsCSV(&buf, shops, params); err != nil {
		t.Fatalf("writeShopsCSV() error = %v", err)
	}

	if !strings.Contains(buf.String(), " м") || !strings.Contains(buf.String(), " км") {
		t.Errorf("distance column does not use list format:\n%s", buf.String())
	}
}

func exportMCP(t *testing.T, shops []mcp.Shop) *httptest.Server {
	t.Helper()

	payload, err := json.Marshal(mcp.ShopsResponse{
		OK: true,
		Data: mcp.ShopsData{
			Meta:  mcp.Meta{Page: 1, Pages: 1, Total: len(shops)},
			Items: shops,
		},
	})
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := map[string]any{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]any{
				"content": []map[string]string{{"type": "text", "text": string(payload)}},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}))
}

// seededHandler primes the cache through the MCP stub and returns a handler
// whose export reads only the accumulated cache.
func seededHandler(t *testing.T, server *httptest.Server) *Handler {
	t.Helper()

	cache := mcp.NewStoreCache()
	client := mcp.NewClient(server.URL)
	if _, err := cache.GetOrFetchShops(t.Context(), client, mcp.QueryParams{Page: 1}); err != nil {
		t.Fatalf("seed cache: %v", err)
	}
	return NewHandler(cache, client, nil)
}

func TestHandleExportCSV(t *testing.T) {
	t.Run("successful export", func(t *testing.T) {
		server := exportMCP(t, exportTestShops())
		defer server.Close()

		handler := seededHandler(t, server)
		recorder := httptest.NewRecorder()
		handler.HandleExportCSV(recorder, httptest.NewRequest(http.MethodGet, "/api/export.csv", nil))

		if recorder.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200 (body: %s)", recorder.Code, recorder.Body.String())
		}
		if got := recorder.Header().Get("Content-Type"); got != "text/csv; charset=utf-8" {
			t.Errorf("Content-Type = %q", got)
		}
		if got := recorder.Header().Get("Cache-Control"); got != "no-store" {
			t.Errorf("Cache-Control = %q", got)
		}
		disposition := recorder.Header().Get("Content-Disposition")
		if !strings.HasPrefix(disposition, `attachment; filename="vkusvill-shops-`) {
			t.Errorf("Content-Disposition = %q", disposition)
		}

		records := readExport(t, recorder.Body.Bytes())
		if len(records) != 4 {
			t.Errorf("rows = %d, want header + 3 shops", len(records))
		}
	})

	t.Run("city filter", func(t *testing.T) {
		server := exportMCP(t, exportTestShops())
		defer server.Close()

		handler := seededHandler(t, server)
		recorder := httptest.NewRecorder()
		handler.HandleExportCSV(recorder, httptest.NewRequest(http.MethodGet, "/api/export.csv?city_id=6423", nil))

		records := readExport(t, recorder.Body.Bytes())
		if len(records) != 3 {
			t.Errorf("rows = %d, want header + 2 Moscow shops", len(records))
		}
	})

	t.Run("empty cache returns header only", func(t *testing.T) {
		var calls atomic.Int32
		server := countingMCP(&calls)
		defer server.Close()

		handler := NewHandler(mcp.NewStoreCache(), mcp.NewClient(server.URL), nil)
		recorder := httptest.NewRecorder()
		handler.HandleExportCSV(recorder, httptest.NewRequest(http.MethodGet, "/api/export.csv", nil))

		if recorder.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", recorder.Code)
		}
		records := readExport(t, recorder.Body.Bytes())
		if len(records) != 1 {
			t.Errorf("rows = %d, want header only", len(records))
		}
		if calls.Load() != 0 {
			t.Errorf("MCP calls = %d, export must not call MCP", calls.Load())
		}
	})

	t.Run("coordinates without pair are rejected", func(t *testing.T) {
		var calls atomic.Int32
		server := countingMCP(&calls)
		defer server.Close()

		handler := NewHandler(mcp.NewStoreCache(), mcp.NewClient(server.URL), nil)
		recorder := httptest.NewRecorder()
		handler.HandleExportCSV(recorder, httptest.NewRequest(http.MethodGet, "/api/export.csv?lon=37.62", nil))

		if recorder.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", recorder.Code)
		}
		if !strings.Contains(recorder.Body.String(), "lat") {
			t.Errorf("body does not mention coordinates: %q", recorder.Body.String())
		}
	})

	t.Run("invalid parameter returns 400 before MCP", func(t *testing.T) {
		var calls atomic.Int32
		server := countingMCP(&calls)
		defer server.Close()

		handler := NewHandler(mcp.NewStoreCache(), mcp.NewClient(server.URL), nil)
		recorder := httptest.NewRecorder()
		handler.HandleExportCSV(recorder, httptest.NewRequest(http.MethodGet, "/api/export.csv?city_id=abc", nil))

		if recorder.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", recorder.Code)
		}
		if !strings.Contains(recorder.Body.String(), "city_id") {
			t.Errorf("body does not name the parameter: %q", recorder.Body.String())
		}
		if calls.Load() != 0 {
			t.Errorf("MCP calls = %d, want 0", calls.Load())
		}
	})
}

func TestHandleExportCSVLimit(t *testing.T) {
	tests := []struct {
		name       string
		count      int
		wantStatus int
	}{
		{name: "limit is inclusive", count: maxExportRows, wantStatus: http.StatusOK},
		{name: "over the limit", count: maxExportRows + 1, wantStatus: http.StatusRequestEntityTooLarge},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			shops := make([]mcp.Shop, tt.count)
			for i := range shops {
				shops[i] = mcp.Shop{ID: i + 1, Address: "адрес", Lat: 55.7, Lon: 37.6}
			}

			server := exportMCP(t, shops)
			defer server.Close()

			handler := seededHandler(t, server)
			recorder := httptest.NewRecorder()
			handler.HandleExportCSV(recorder, httptest.NewRequest(http.MethodGet, "/api/export.csv", nil))

			if recorder.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d (body: %.200s)", recorder.Code, tt.wantStatus, recorder.Body.String())
			}
			if tt.wantStatus == http.StatusRequestEntityTooLarge && !strings.Contains(recorder.Body.String(), "лимит") {
				t.Errorf("413 body does not explain the limit: %q", recorder.Body.String())
			}
		})
	}
}
