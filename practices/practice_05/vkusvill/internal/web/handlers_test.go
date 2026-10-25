package web

import (
	"testing"

	"vkusvill/internal/mcp"
)

func TestMarshalASCII(t *testing.T) {
	tests := []struct {
		name  string
		input any
		want  string
	}{
		{
			name:  "cyrillic is escaped",
			input: map[string]string{"address": "пр-т Королёва, д. 20"},
			want:  `{"address":"\u043f\u0440-\u0442 \u041a\u043e\u0440\u043e\u043b\u0451\u0432\u0430, \u0434. 20"}`,
		},
		{
			name:  "ascii stays untouched",
			input: map[string]string{"a": "ok-123"},
			want:  `{"a":"ok-123"}`,
		},
		{
			name:  "emoji becomes a surrogate pair",
			input: map[string]string{"e": "\U0001F600"},
			want:  `{"e":"\ud83d\ude00"}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := marshalASCII(tt.input)
			if err != nil {
				t.Fatalf("marshalASCII() error = %v", err)
			}
			if string(got) != tt.want {
				t.Errorf("marshalASCII() = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestShopPoint(t *testing.T) {
	tests := []struct {
		name        string
		shop        mcp.Shop
		wantCity    string
		wantCityID  int
		wantAddress string
	}{
		{
			name:        "shop with city",
			shop:        mcp.Shop{ID: 1, Address: "ул. Тестовая, д. 1", City: &mcp.NamedItem{ID: 6423, Name: "г. Москва"}, Lat: 55.7, Lon: 37.6},
			wantCity:    "г. Москва",
			wantCityID:  6423,
			wantAddress: "ул. Тестовая, д. 1",
		},
		{
			name:        "shop without city",
			shop:        mcp.Shop{ID: 2, Address: "ул. Вторая, д. 2", Lat: 59.9, Lon: 30.3},
			wantCity:    "",
			wantCityID:  0,
			wantAddress: "ул. Вторая, д. 2",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			point := shopPoint(tt.shop)
			if point.ID != tt.shop.ID {
				t.Errorf("ID = %d, want %d", point.ID, tt.shop.ID)
			}
			if point.Address != tt.wantAddress {
				t.Errorf("Address = %q, want %q", point.Address, tt.wantAddress)
			}
			if point.City != tt.wantCity {
				t.Errorf("City = %q, want %q", point.City, tt.wantCity)
			}
			if point.CityID != tt.wantCityID {
				t.Errorf("CityID = %d, want %d", point.CityID, tt.wantCityID)
			}
			if point.Lat != tt.shop.Lat || point.Lon != tt.shop.Lon {
				t.Errorf("coords = (%v,%v), want (%v,%v)", point.Lat, point.Lon, tt.shop.Lat, tt.shop.Lon)
			}
		})
	}
}
