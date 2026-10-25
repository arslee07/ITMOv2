package mcp

import (
	"context"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"
)

type cacheEntry struct {
	response  *ShopsResponse
	createdAt time.Time
}

// StoreCache manages thread-safe caching of shops, filters, and query results.
type StoreCache struct {
	mu           sync.RWMutex
	queryCache   map[string]cacheEntry
	allShops     map[int]Shop
	filters      []FilterGroup
	filtersTTL   time.Duration
	queryTTL     time.Duration
	filtersSaved time.Time
	warmPages    int
	warmTotal    int
}

// NewStoreCache creates a new StoreCache.
func NewStoreCache() *StoreCache {
	return &StoreCache{
		queryCache: make(map[string]cacheEntry),
		allShops:   make(map[int]Shop),
		filtersTTL: 24 * time.Hour,
		queryTTL:   15 * time.Minute,
	}
}

func queryKey(params QueryParams) string {
	return fmt.Sprintf("p%d_r%d_c%d_s%d_f%d",
		params.Page, params.RegionID, params.CityID, params.SubwayID, params.FeatureID)
}

// GetOrFetchShops retrieves shop data from cache or calls the MCP client.
func (sc *StoreCache) GetOrFetchShops(ctx context.Context, client *Client, params QueryParams) (*ShopsResponse, error) {
	key := queryKey(params)

	sc.mu.RLock()
	entry, exists := sc.queryCache[key]
	sc.mu.RUnlock()

	if exists && time.Since(entry.createdAt) < sc.queryTTL {
		return entry.response, nil
	}

	resp, err := client.FetchShops(ctx, params)
	if err != nil {
		return nil, fmt.Errorf("fetch shops via client: %w", err)
	}

	sc.mu.Lock()
	defer sc.mu.Unlock()

	sc.queryCache[key] = cacheEntry{
		response:  resp,
		createdAt: time.Now(),
	}

	for _, shop := range resp.Data.Items {
		sc.allShops[shop.ID] = shop
	}

	if len(resp.Data.Meta.Filters) > 0 && len(sc.filters) == 0 {
		sc.filters = resp.Data.Meta.Filters
		sc.filtersSaved = time.Now()
	}

	return resp, nil
}

// GetOrFetchFilters returns the cached filter groups or queries page 1 to populate them.
func (sc *StoreCache) GetOrFetchFilters(ctx context.Context, client *Client) ([]FilterGroup, error) {
	sc.mu.RLock()
	hasFilters := len(sc.filters) > 0 && time.Since(sc.filtersSaved) < sc.filtersTTL
	filters := sc.filters
	sc.mu.RUnlock()

	if hasFilters {
		return filters, nil
	}

	// Fetch page 1 to retrieve filters
	resp, err := sc.GetOrFetchShops(ctx, client, QueryParams{Page: 1})
	if err != nil {
		return nil, fmt.Errorf("fetch initial filters: %w", err)
	}

	sc.mu.RLock()
	defer sc.mu.RUnlock()
	return resp.Data.Meta.Filters, nil
}

// filterItems returns the items of the first filter group matching any of the
// given names (case-insensitive, supports English aliases).
func (sc *StoreCache) filterItems(names ...string) []FilterItem {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	for _, group := range sc.filters {
		for _, name := range names {
			if strings.EqualFold(group.Name, name) {
				return group.Items
			}
		}
	}
	return nil
}

// GetFeatureFilters returns the list of feature filter items.
func (sc *StoreCache) GetFeatureFilters() []FilterItem {
	return sc.filterItems("Особенность", "features")
}

// GetCityFilters returns the list of city filter items.
func (sc *StoreCache) GetCityFilters() []FilterItem {
	return sc.filterItems("Город", "cities")
}

// GetRegionFilters returns the list of region filter items.
func (sc *StoreCache) GetRegionFilters() []FilterItem {
	return sc.filterItems("Регион", "regions")
}

func (sc *StoreCache) setWarmProgress(page, total int) {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	sc.warmPages = page
	sc.warmTotal = total
}

// WarmStats reports background warm-up progress: pages fetched so far, total
// pages advertised by the API, and the number of distinct cached shops.
func (sc *StoreCache) WarmStats() (warmedPages, totalPages, shops int) {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	return sc.warmPages, sc.warmTotal, len(sc.allShops)
}

// GetAllCachedShops returns all distinct shops collected so far.
func (sc *StoreCache) GetAllCachedShops() []Shop {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	shops := make([]Shop, 0, len(sc.allShops))
	for _, s := range sc.allShops {
		shops = append(shops, s)
	}
	return shops
}

// DistanceKm calculates geographical distance between two coordinates in kilometers using Haversine formula.
func DistanceKm(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadiusKm = 6371.0

	dLat := (lat2 - lat1) * (math.Pi / 180.0)
	dLon := (lon2 - lon1) * (math.Pi / 180.0)

	lat1Rad := lat1 * (math.Pi / 180.0)
	lat2Rad := lat2 * (math.Pi / 180.0)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Sin(dLon/2)*math.Sin(dLon/2)*math.Cos(lat1Rad)*math.Cos(lat2Rad)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return earthRadiusKm * c
}
