package web

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"vkusvill/internal/mcp"
)

func TestParseQueryParams(t *testing.T) {
	tests := []struct {
		name         string
		query        string
		want         mcp.QueryParams
		wantErr      bool
		wantErrParam string
	}{
		{
			name:  "no parameters keeps defaults",
			query: "",
			want:  mcp.QueryParams{Page: 1},
		},
		{
			name:  "valid filters",
			query: "?page=2&city_id=6423&feature_id=7&region_id=1&subway_id=3",
			want:  mcp.QueryParams{Page: 2, CityID: 6423, FeatureID: 7, RegionID: 1, SubwayID: 3},
		},
		{
			name:  "empty values mean no filter",
			query: "?city_id=&feature_id=&region_id=&subway_id=&q=",
			want:  mcp.QueryParams{Page: 1},
		},
		{
			name:  "zero page becomes first page",
			query: "?page=0",
			want:  mcp.QueryParams{Page: 1},
		},
		{
			name:  "negative page becomes first page",
			query: "?page=-5",
			want:  mcp.QueryParams{Page: 1},
		},
		{
			name:         "non-numeric page is rejected",
			query:        "?page=abc",
			wantErr:      true,
			wantErrParam: "page",
		},
		{
			name:         "fractional page is rejected",
			query:        "?page=1.5",
			wantErr:      true,
			wantErrParam: "page",
		},
		{
			name:         "non-numeric feature is rejected",
			query:        "?feature_id=coffee",
			wantErr:      true,
			wantErrParam: "feature_id",
		},
		{
			name:         "negative city is rejected",
			query:        "?city_id=-5",
			wantErr:      true,
			wantErrParam: "city_id",
		},
		{
			name:         "fractional region is rejected",
			query:        "?region_id=1.5",
			wantErr:      true,
			wantErrParam: "region_id",
		},
		{
			name:  "coordinates pair enables location",
			query: "?lat=55.75&lon=37.62",
			want:  mcp.QueryParams{Page: 1, UserLat: 55.75, UserLon: 37.62, HasLocation: true},
		},
		{
			name:  "zero coordinates are a valid pair",
			query: "?lat=0&lon=0",
			want:  mcp.QueryParams{Page: 1, HasLocation: true},
		},
		{
			name:         "latitude without longitude is rejected",
			query:        "?lat=55.75",
			wantErr:      true,
			wantErrParam: "lat/lon",
		},
		{
			name:         "empty latitude with longitude is rejected",
			query:        "?lat=&lon=37.62",
			wantErr:      true,
			wantErrParam: "lat/lon",
		},
		{
			name:         "latitude out of range is rejected",
			query:        "?lat=95&lon=37.62",
			wantErr:      true,
			wantErrParam: "lat",
		},
		{
			name:         "longitude out of range is rejected",
			query:        "?lon=200",
			wantErr:      true,
			wantErrParam: "lon",
		},
		{
			name:         "NaN latitude is rejected",
			query:        "?lat=NaN&lon=37.62",
			wantErr:      true,
			wantErrParam: "lat",
		},
		{
			name:  "search query is trimmed",
			query: "?q=%20%20Пятёрочка%20",
			want:  mcp.QueryParams{Page: 1, SearchText: "Пятёрочка"},
		},
		{
			name:  "search query of exactly 100 runes is accepted",
			query: "?q=" + strings.Repeat("я", 100),
			want:  mcp.QueryParams{Page: 1, SearchText: strings.Repeat("я", 100)},
		},
		{
			name:         "search query over 100 runes is rejected",
			query:        "?q=" + strings.Repeat("я", 101),
			wantErr:      true,
			wantErrParam: "q",
		},
		{
			name:         "control characters are rejected",
			query:        "?q=a%09b",
			wantErr:      true,
			wantErrParam: "q",
		},
		{
			name:         "control-only search is rejected",
			query:        "?q=%09",
			wantErr:      true,
			wantErrParam: "q",
		},
		{
			name:  "zero subway is a wildcard",
			query: "?subway_id=0",
			want:  mcp.QueryParams{Page: 1},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/"+tt.query, nil)

			got, err := parseQueryParams(req)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("parseQueryParams() error = nil, want error for %q", tt.wantErrParam)
				}

				var validationErr *ValidationError
				if !errors.As(err, &validationErr) {
					t.Fatalf("parseQueryParams() error = %v, want *ValidationError", err)
				}
				if validationErr.Param != tt.wantErrParam {
					t.Errorf("ValidationError.Param = %q, want %q", validationErr.Param, tt.wantErrParam)
				}
				return
			}

			if err != nil {
				t.Fatalf("parseQueryParams() error = %v, want nil", err)
			}
			if got != tt.want {
				t.Errorf("parseQueryParams() = %+v, want %+v", got, tt.want)
			}
		})
	}
}

// countingMCP is an MCP endpoint stub that counts calls. It never answers with
// a valid payload: handler tests only need to know whether it was reached.
func countingMCP(calls *atomic.Int32) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		http.Error(w, "unexpected call", http.StatusInternalServerError)
	}))
}

func TestHandlersRejectInvalidInputBeforeMCP(t *testing.T) {
	tests := []struct {
		name   string
		target string
		handle func(*Handler, http.ResponseWriter, *http.Request)
	}{
		{name: "index city", target: "/?city_id=abc", handle: (*Handler).HandleIndex},
		{name: "index page", target: "/?page=1.5", handle: (*Handler).HandleIndex},
		{name: "shops coordinates", target: "/shops?lat=95&lon=37", handle: (*Handler).HandleShops},
		{name: "shops feature", target: "/shops?feature_id=coffee", handle: (*Handler).HandleShops},
		{name: "points longitude", target: "/api/shops/points?lon=200", handle: (*Handler).HandleShopsPoints},
		{name: "points search", target: "/api/shops/points?q=a%09b", handle: (*Handler).HandleShopsPoints},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var calls atomic.Int32
			server := countingMCP(&calls)
			defer server.Close()

			handler := NewHandler(mcp.NewStoreCache(), mcp.NewClient(server.URL), nil)
			recorder := httptest.NewRecorder()

			tt.handle(handler, recorder, httptest.NewRequest(http.MethodGet, tt.target, nil))

			if recorder.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want %d (body: %s)", recorder.Code, http.StatusBadRequest, recorder.Body.String())
			}
			if got := recorder.Header().Get("Content-Type"); !strings.HasPrefix(got, "text/plain") {
				t.Errorf("Content-Type = %q, want text/plain", got)
			}
			if calls.Load() != 0 {
				t.Errorf("MCP calls = %d, want 0 for rejected request", calls.Load())
			}
		})
	}
}

func TestHandleShopsPointsScopeAllSkipsValidation(t *testing.T) {
	var calls atomic.Int32
	server := countingMCP(&calls)
	defer server.Close()

	handler := NewHandler(mcp.NewStoreCache(), mcp.NewClient(server.URL), nil)
	recorder := httptest.NewRecorder()

	handler.HandleShopsPoints(recorder, httptest.NewRequest(http.MethodGet, "/api/shops/points?scope=all&lon=200", nil))

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d (body: %s)", recorder.Code, http.StatusOK, recorder.Body.String())
	}
	if calls.Load() != 0 {
		t.Errorf("MCP calls = %d, want 0 for scope=all on empty cache", calls.Load())
	}
}

const shopsPayload = `{"ok":true,"data":{"meta":{"page":1,"pages":1,"total":2,"has_more":false,"filters":[]},` +
	`"items":[{"id":1,"address":"Далёкий","lat":59.9,"lon":30.3,"rating":4.5},` +
	`{"id":2,"address":"Ближний","lat":55.76,"lon":37.62,"rating":4.0}]}}`

// healthyMCP answers like the VkusVill MCP server with a fixed shop payload.
func healthyMCP() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := map[string]any{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]any{
				"content": []map[string]string{{"type": "text", "text": shopsPayload}},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}))
}

func TestHandleShopsPointsKeepsValidRequestsWorking(t *testing.T) {
	tests := []struct {
		name             string
		target           string
		wantDistanceInfo bool
	}{
		{name: "no filters", target: "/api/shops/points"},
		{name: "zero coordinates still sort", target: "/api/shops/points?lat=0&lon=0", wantDistanceInfo: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := healthyMCP()
			defer server.Close()

			handler := NewHandler(mcp.NewStoreCache(), mcp.NewClient(server.URL), nil)
			recorder := httptest.NewRecorder()

			handler.HandleShopsPoints(recorder, httptest.NewRequest(http.MethodGet, tt.target, nil))

			if recorder.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d (body: %s)", recorder.Code, http.StatusOK, recorder.Body.String())
			}

			var points []ShopPoint
			if err := json.Unmarshal(recorder.Body.Bytes(), &points); err != nil {
				t.Fatalf("decode points: %v", err)
			}
			if len(points) != 2 {
				t.Fatalf("points = %d, want 2", len(points))
			}

			for _, point := range points {
				if hasDistance := point.DistanceStr != ""; hasDistance != tt.wantDistanceInfo {
					t.Errorf("point %d distance = %q, wantDistanceInfo = %v", point.ID, point.DistanceStr, tt.wantDistanceInfo)
				}
			}
		})
	}
}
