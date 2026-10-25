package mcp

import (
	"context"
	"log"
	"strings"
	"time"
)

// WarmOptions configures the background catalog warmer.
type WarmOptions struct {
	// Delay between requests. Keep it under the VkusVill rate limit of
	// 60 requests/minute; the default of 1100ms yields roughly 54/min.
	Delay time.Duration
	// MaxPages caps the full unfiltered sweep (0 = every page the API advertises).
	MaxPages int
}

// delay returns the effective inter-request delay.
func (o WarmOptions) delay() time.Duration {
	if o.Delay > 0 {
		return o.Delay
	}
	return 1100 * time.Millisecond
}

// WarmCatalog fills the cache with the whole shop catalog incrementally and
// within the API rate limit. It first fetches one page per region so the map
// gains geographic diversity quickly, then sweeps the unfiltered catalog page
// by page. It returns when the sweep finishes or ctx is cancelled.
func (sc *StoreCache) WarmCatalog(ctx context.Context, client *Client, opts WarmOptions) {
	delay := opts.delay()

	sc.seedRegions(ctx, client, delay)
	if ctx.Err() != nil {
		return
	}

	resp, err := sc.GetOrFetchShops(ctx, client, QueryParams{Page: 1})
	if err != nil {
		log.Printf("warm: fetch first page: %v", err)
		return
	}

	total := resp.Data.Meta.Pages
	if total < 1 {
		total = 1
	}
	last := total
	if opts.MaxPages > 0 && opts.MaxPages < last {
		last = opts.MaxPages
	}
	sc.setWarmProgress(1, total)

	for page := 2; page <= last; page++ {
		if !waitDelay(ctx, delay) {
			return
		}
		if _, err := sc.GetOrFetchShops(ctx, client, QueryParams{Page: page}); err != nil {
			log.Printf("warm: fetch page %d: %v", page, err)
			continue
		}
		sc.setWarmProgress(page, total)
	}
}

// seedRegions fetches the first page of every region filter.
func (sc *StoreCache) seedRegions(ctx context.Context, client *Client, delay time.Duration) {
	groups, err := sc.GetOrFetchFilters(ctx, client)
	if err != nil {
		log.Printf("warm: load filters: %v", err)
		return
	}

	var regions []FilterItem
	for _, group := range groups {
		if strings.EqualFold(group.Name, "Регион") || strings.EqualFold(group.Name, "regions") {
			regions = group.Items
			break
		}
	}

	for _, region := range regions {
		if !waitDelay(ctx, delay) {
			return
		}
		if _, err := sc.GetOrFetchShops(ctx, client, QueryParams{Page: 1, RegionID: region.ID}); err != nil {
			log.Printf("warm: region %d: %v", region.ID, err)
		}
	}
}

// waitDelay sleeps for d, returning false if ctx is cancelled first.
func waitDelay(ctx context.Context, d time.Duration) bool {
	select {
	case <-ctx.Done():
		return false
	case <-time.After(d):
		return true
	}
}
