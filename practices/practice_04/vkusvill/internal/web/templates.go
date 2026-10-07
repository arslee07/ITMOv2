package web

import (
	"embed"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"strings"
	"vkusvill/internal/mcp"
)

//go:embed templates/*
var templatesFS embed.FS

//go:embed static/*
var staticFS embed.FS

// StaticFS returns the embedded filesystem for static assets.
func StaticFS() embed.FS {
	return staticFS
}

// ViewManager handles template rendering.
type ViewManager struct {
	tmpl *template.Template
}

// ShopViewModel is enhanced shop data for template display.
type ShopViewModel struct {
	mcp.Shop
	DistanceStr string
	SubwayNames string
	IsOpen      bool
}

// PageData represents the context passed to the main page template.
type PageData struct {
	Shops          []ShopViewModel
	TotalShops     int
	CurrentPage    int
	TotalPages     int
	HasPrev        bool
	HasNext        bool
	PrevPage       int
	NextPage       int
	Features       []mcp.FilterItem
	Cities         []mcp.FilterItem
	SelectedCity   int
	SelectedFeat   int
	SearchQuery    string
	QuickChips     []QuickChip
	ActiveFilterID int
}

// QuickChip represents a convenient preset filter button with an icon.
type QuickChip struct {
	ID       int
	Name     string
	IconType string
	Active   bool
}

// NewViewManager initializes and parses HTML templates.
func NewViewManager() (*ViewManager, error) {
	funcMap := template.FuncMap{
		"contains": strings.Contains,
		"formatRating": func(r float64) string {
			if r <= 0 {
				return "—"
			}
			return fmt.Sprintf("%.1f", r)
		},
		"hasFeature": func(shop mcp.Shop, featureID int) bool {
			for _, f := range shop.Features {
				if f.ID == featureID {
					return true
				}
			}
			return false
		},
		"joinPhones": func(phones []string) string {
			return strings.Join(phones, ", ")
		},
		// toJSON safely marshals a value to JSON for embedding into <script type="application/json"> blocks.
		"toJSON": func(v any) (template.JS, error) {
			b, err := json.Marshal(v)
			if err != nil {
				return "", err
			}
			return template.JS(string(b)), nil
		},
	}

	tmpl, err := template.New("").Funcs(funcMap).ParseFS(templatesFS, "templates/*.html", "templates/partials/*.html")
	if err != nil {
		return nil, fmt.Errorf("parse templates: %w", err)
	}

	return &ViewManager{tmpl: tmpl}, nil
}

// RenderIndex renders the full home page.
func (vm *ViewManager) RenderIndex(w io.Writer, data PageData) error {
	return vm.tmpl.ExecuteTemplate(w, "index.html", data)
}

// RenderShopsList renders the partial shops list for HTMX updates.
func (vm *ViewManager) RenderShopsList(w io.Writer, data PageData) error {
	return vm.tmpl.ExecuteTemplate(w, "shop_list.html", data)
}
