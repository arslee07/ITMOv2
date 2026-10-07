package web

import (
	"bytes"
	"strings"
	"testing"
	"vkusvill/internal/mcp"
)

func TestViewManagerRender(t *testing.T) {
	vm, err := NewViewManager()
	if err != nil {
		t.Fatalf("NewViewManager() error = %v", err)
	}

	sampleShops := []ShopViewModel{
		{
			Shop: mcp.Shop{
				ID:       1001,
				Address:  "г. Москва, ул. Арбат, д. 1",
				Lat:      55.7512,
				Lon:      37.5982,
				Rating:   4.9,
				City:     &mcp.NamedItem{ID: 6423, Name: "г. Москва"},
				Schedule: "08:00 - 22:00",
				Features: []mcp.NamedItem{
					{ID: 36178, Name: "Кафе"},
				},
			},
			DistanceStr: "250 м",
			SubwayNames: "Арбатская",
			IsOpen:      true,
		},
	}

	pageData := PageData{
		Shops:       sampleShops,
		TotalShops:  1,
		CurrentPage: 1,
		TotalPages:  1,
		QuickChips:  presetChips,
	}

	var buf bytes.Buffer
	if err := vm.RenderIndex(&buf, pageData); err != nil {
		t.Fatalf("RenderIndex() error = %v", err)
	}

	html := buf.String()
	if !strings.Contains(html, "ВкусВилл Радар") {
		t.Errorf("expected html to contain 'ВкусВилл Радар'")
	}
	if !strings.Contains(html, `id="shops-cards"`) {
		t.Errorf("expected html to contain the client-rendered list container")
	}

	// The list is filled by app.js, so the partial carries only the container
	// and the total count, not individual shop cards.
	var partialBuf bytes.Buffer
	if err := vm.RenderShopsList(&partialBuf, pageData); err != nil {
		t.Fatalf("RenderShopsList() error = %v", err)
	}
	partialHTML := partialBuf.String()
	if !strings.Contains(partialHTML, `id="shops-cards"`) {
		t.Errorf("expected partial to contain the list container")
	}
	if !strings.Contains(partialHTML, `id="shops-count"`) {
		t.Errorf("expected partial to contain the count badge")
	}
	if !strings.Contains(partialHTML, ">1<") {
		t.Errorf("expected partial to show the total count")
	}
}
