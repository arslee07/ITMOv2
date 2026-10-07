package mcp

import (
	"math"
	"testing"
)

func TestDistanceKm(t *testing.T) {
	tests := []struct {
		name      string
		lat1      float64
		lon1      float64
		lat2      float64
		lon2      float64
		expected  float64
		tolerance float64
	}{
		{
			name:      "Same point",
			lat1:      55.7558,
			lon1:      37.6173,
			lat2:      55.7558,
			lon2:      37.6173,
			expected:  0.0,
			tolerance: 0.001,
		},
		{
			name:      "Moscow to Saint Petersburg",
			lat1:      55.7558,
			lon1:      37.6173,
			lat2:      59.9343,
			lon2:      30.3351,
			expected:  634.0, // Approximately 634 km
			tolerance: 10.0,
		},
		{
			name:      "Short distance in Moscow",
			lat1:      55.7558,
			lon1:      37.6173,
			lat2:      55.7600,
			lon2:      37.6200,
			expected:  0.5,
			tolerance: 0.2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DistanceKm(tt.lat1, tt.lon1, tt.lat2, tt.lon2)
			diff := math.Abs(got - tt.expected)
			if diff > tt.tolerance {
				t.Errorf("DistanceKm() = %v, expected ~%v (tolerance: %v, diff: %v)", got, tt.expected, tt.tolerance, diff)
			}
		})
	}
}

func TestStoreCacheFeaturesAndCities(t *testing.T) {
	cache := NewStoreCache()

	cache.filters = []FilterGroup{
		{
			Name: "Особенность",
			Items: []FilterItem{
				{ID: 36178, Name: "Кафе"},
				{ID: 7488, Name: "Пекарня"},
			},
		},
		{
			Name: "Город",
			Items: []FilterItem{
				{ID: 6423, Name: "г. Москва"},
				{ID: 6424, Name: "г. Санкт-Петербург"},
			},
		},
	}

	feats := cache.GetFeatureFilters()
	if len(feats) != 2 {
		t.Fatalf("expected 2 feature filters, got %d", len(feats))
	}
	if feats[0].Name != "Кафе" {
		t.Errorf("expected first feature to be Кафе, got %s", feats[0].Name)
	}

	cities := cache.GetCityFilters()
	if len(cities) != 2 {
		t.Fatalf("expected 2 city filters, got %d", len(cities))
	}
	if cities[0].Name != "г. Москва" {
		t.Errorf("expected first city to be г. Москва, got %s", cities[0].Name)
	}
}
