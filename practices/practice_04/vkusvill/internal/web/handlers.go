package web

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"unicode/utf8"
	"vkusvill/internal/mcp"
)

// Handler handles HTTP requests for the application.
type Handler struct {
	cache  *mcp.StoreCache
	client *mcp.Client
	view   *ViewManager
}

// NewHandler creates a new HTTP Handler instance.
func NewHandler(cache *mcp.StoreCache, client *mcp.Client, view *ViewManager) *Handler {
	return &Handler{
		cache:  cache,
		client: client,
		view:   view,
	}
}

// ShopPoint is a lightweight payload for map markers.
type ShopPoint struct {
	ID          int              `json:"id"`
	Address     string           `json:"address"`
	City        string           `json:"city"`
	CityID      int              `json:"city_id"`
	Lat         float64          `json:"lat"`
	Lon         float64          `json:"lon"`
	Rating      float64          `json:"rating"`
	Schedule    string           `json:"schedule"`
	DistanceStr string           `json:"distance_str,omitempty"`
	Features    []mcp.NamedItem  `json:"features"`
	Subway      []mcp.SubwayItem `json:"subway"`
}

var presetChips = []QuickChip{
	{ID: 36178, Name: "Кафе", IconType: "coffee"},
	{ID: 7491, Name: "Сокомат", IconType: "orange"},
	{ID: 7488, Name: "Пекарня", IconType: "croissant"},
	{ID: 5048867, Name: "Винный отдел", IconType: "wine"},
	{ID: 5048869, Name: "Батарейки", IconType: "battery"},
	{ID: 5048868, Name: "Крышечки", IconType: "recycle"},
	{ID: 44806, Name: "Рыбная витрина", IconType: "fish"},
	{ID: 7740, Name: "Мясная витрина", IconType: "meat"},
	{ID: 5048870, Name: "Сбор вещей", IconType: "shirt"},
	{ID: 90760, Name: "ВкусВилл Айс", IconType: "ice"},
}

func parseQueryParams(r *http.Request) mcp.QueryParams {
	q := r.URL.Query()

	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}

	cityID, _ := strconv.Atoi(q.Get("city_id"))
	featureID, _ := strconv.Atoi(q.Get("feature_id"))
	regionID, _ := strconv.Atoi(q.Get("region_id"))
	subwayID, _ := strconv.Atoi(q.Get("subway_id"))

	userLat, _ := strconv.ParseFloat(q.Get("lat"), 64)
	userLon, _ := strconv.ParseFloat(q.Get("lon"), 64)

	return mcp.QueryParams{
		Page:       page,
		CityID:     cityID,
		FeatureID:  featureID,
		RegionID:   regionID,
		SubwayID:   subwayID,
		SearchText: strings.TrimSpace(q.Get("q")),
		UserLat:    userLat,
		UserLon:    userLon,
	}
}

func (h *Handler) buildPageData(r *http.Request, params mcp.QueryParams) (PageData, []ShopPoint, error) {
	ctx := r.Context()

	// 1. Get or fetch filters
	filters, err := h.cache.GetOrFetchFilters(ctx, h.client)
	if err != nil {
		log.Printf("Warning: failed to load filters: %v", err)
	}

	var cities []mcp.FilterItem
	var features []mcp.FilterItem
	for _, fg := range filters {
		if strings.EqualFold(fg.Name, "Город") || strings.EqualFold(fg.Name, "cities") {
			cities = fg.Items
		}
		if strings.EqualFold(fg.Name, "Особенность") || strings.EqualFold(fg.Name, "features") {
			features = fg.Items
		}
	}

	// 2. Fetch shops for given query
	resp, err := h.cache.GetOrFetchShops(ctx, h.client, params)
	if err != nil {
		return PageData{}, nil, fmt.Errorf("fetch shops: %w", err)
	}

	// 3. Process items, filter by search text if specified, and compute distances
	shops := resp.Data.Items
	var viewModels []ShopViewModel
	var points []ShopPoint

	for _, s := range shops {
		// Filter by search query if present (address or subway name)
		if params.SearchText != "" {
			searchLower := strings.ToLower(params.SearchText)
			addrMatch := strings.Contains(strings.ToLower(s.Address), searchLower)
			subwayMatch := false
			for _, sub := range s.Subway {
				if strings.Contains(strings.ToLower(sub.Name), searchLower) {
					subwayMatch = true
					break
				}
			}
			if !addrMatch && !subwayMatch {
				continue
			}
		}

		var distStr string
		var distKm float64
		if params.UserLat != 0 && params.UserLon != 0 && s.Lat != 0 && s.Lon != 0 {
			distKm = mcp.DistanceKm(params.UserLat, params.UserLon, s.Lat, s.Lon)
			if distKm < 1.0 {
				distStr = fmt.Sprintf("%d м", int(distKm*1000))
			} else {
				distStr = fmt.Sprintf("%.1f км", distKm)
			}
		}

		var subwayNames []string
		for _, sub := range s.Subway {
			subwayNames = append(subwayNames, sub.Name)
		}

		vm := ShopViewModel{
			Shop:        s,
			DistanceStr: distStr,
			SubwayNames: strings.Join(subwayNames, ", "),
			IsOpen:      true,
		}
		viewModels = append(viewModels, vm)

		point := shopPoint(s)
		point.DistanceStr = distStr
		points = append(points, point)
	}

	// If coordinates are provided, sort view models by distance
	if params.UserLat != 0 && params.UserLon != 0 {
		sort.Slice(viewModels, func(i, j int) bool {
			d1 := mcp.DistanceKm(params.UserLat, params.UserLon, viewModels[i].Lat, viewModels[i].Lon)
			d2 := mcp.DistanceKm(params.UserLat, params.UserLon, viewModels[j].Lat, viewModels[j].Lon)
			return d1 < d2
		})
	}

	// Quick chips copy with active state
	chips := make([]QuickChip, len(presetChips))
	for i, c := range presetChips {
		chips[i] = c
		if c.ID == params.FeatureID {
			chips[i].Active = true
		}
	}

	page := resp.Data.Meta.Page
	pages := resp.Data.Meta.Pages
	if pages < 1 {
		pages = 1
	}

	data := PageData{
		Shops:          viewModels,
		TotalShops:     resp.Data.Meta.Total,
		CurrentPage:    page,
		TotalPages:     pages,
		HasPrev:        page > 1,
		HasNext:        resp.Data.Meta.HasMore,
		PrevPage:       page - 1,
		NextPage:       page + 1,
		Features:       features,
		Cities:         cities,
		SelectedCity:   params.CityID,
		SelectedFeat:   params.FeatureID,
		SearchQuery:    params.SearchText,
		QuickChips:     chips,
		ActiveFilterID: params.FeatureID,
	}

	return data, points, nil
}

// HandleIndex serves the initial full HTML page.
func (h *Handler) HandleIndex(w http.ResponseWriter, r *http.Request) {
	params := parseQueryParams(r)
	data, _, err := h.buildPageData(r, params)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error loading page: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := h.view.RenderIndex(w, data); err != nil {
		log.Printf("render index error: %v", err)
	}
}

// HandleShops serves the HTMX partial for the shops list with updated map markers.
func (h *Handler) HandleShops(w http.ResponseWriter, r *http.Request) {
	params := parseQueryParams(r)
	data, points, err := h.buildPageData(r, params)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error loading shops: %v", err), http.StatusInternalServerError)
		return
	}

	// Send trigger for Leaflet to immediately update map markers
	type triggerPayload struct {
		Points []ShopPoint `json:"points"`
		Count  int         `json:"count"`
	}
	trigData := map[string]triggerPayload{
		"shopsLoaded": {
			Points: points,
			Count:  len(points),
		},
	}
	if trigJSON, err := marshalASCII(trigData); err == nil {
		w.Header().Set("HX-Trigger", string(trigJSON))
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := h.view.RenderShopsList(w, data); err != nil {
		log.Printf("render shops list error: %v", err)
	}
}

// marshalASCII marshals v to JSON with every non-ASCII rune written as a
// \uXXXX escape. HTTP header values are ISO-8859-1, so raw UTF-8 bytes (for
// example Cyrillic addresses sent via HX-Trigger) would otherwise reach the
// browser as mojibake.
func marshalASCII(v any) ([]byte, error) {
	raw, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}

	var b strings.Builder
	b.Grow(len(raw))
	for _, r := range string(raw) {
		switch {
		case r < utf8.RuneSelf:
			b.WriteRune(r)
		case r > 0xFFFF:
			r -= 0x10000
			fmt.Fprintf(&b, `\u%04x\u%04x`, 0xD800+(r>>10), 0xDC00+(r&0x3FF))
		default:
			fmt.Fprintf(&b, `\u%04x`, r)
		}
	}
	return []byte(b.String()), nil
}

// shopPoint converts a store into the map payload without a distance.
func shopPoint(s mcp.Shop) ShopPoint {
	city := ""
	cityID := 0
	if s.City != nil {
		city = s.City.Name
		cityID = s.City.ID
	}
	return ShopPoint{
		ID:       s.ID,
		Address:  s.Address,
		City:     city,
		CityID:   cityID,
		Lat:      s.Lat,
		Lon:      s.Lon,
		Rating:   s.Rating,
		Schedule: s.Schedule,
		Features: s.Features,
		Subway:   s.Subway,
	}
}

// handleAllPoints returns every shop accumulated in the cache so far, together
// with background warm-up progress. The map polls this endpoint so markers keep
// appearing while the catalog is filled incrementally.
func (h *Handler) handleAllPoints(w http.ResponseWriter) {
	shops := h.cache.GetAllCachedShops()
	warmedPages, totalPages, shopsCount := h.cache.WarmStats()

	points := make([]ShopPoint, 0, len(shops))
	for _, s := range shops {
		points = append(points, shopPoint(s))
	}
	sort.Slice(points, func(i, j int) bool { return points[i].ID < points[j].ID })

	payload := map[string]any{
		"points": points,
		"stats": map[string]any{
			"shops":        shopsCount,
			"warmed_pages": warmedPages,
			"total_pages":  totalPages,
			"done":         totalPages > 0 && warmedPages >= totalPages,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("encode all points error: %v", err)
	}
}

// HandleShopsPoints returns JSON array of points for the map markers. With
// ?scope=all it returns every accumulated shop instead of the current page.
func (h *Handler) HandleShopsPoints(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("scope") == "all" {
		h.handleAllPoints(w)
		return
	}

	params := parseQueryParams(r)
	_, points, err := h.buildPageData(r, params)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error loading points: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(points); err != nil {
		log.Printf("encode points error: %v", err)
	}
}
