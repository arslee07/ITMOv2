package web

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"vkusvill/internal/mcp"
)

const (
	// maxExportRows protects the service from building a huge response in memory.
	maxExportRows = 20000
	// exportDelimiter is a semicolon so Excel with a Russian locale opens the
	// file in columns without a manual import step.
	exportDelimiter = ';'
	utf8BOM         = "\ufeff"
)

var exportColumns = []string{
	"ID", "Адрес", "Город", "Рейтинг", "Широта", "Долгота", "Метро", "Удобства", "Расстояние",
}

// filterShops applies the same rules as the client-side list: city, feature and
// a case-insensitive search over the address and metro stations.
func filterShops(shops []mcp.Shop, params mcp.QueryParams) []mcp.Shop {
	search := strings.ToLower(strings.TrimSpace(params.SearchText))

	matched := make([]mcp.Shop, 0, len(shops))
	for _, shop := range shops {
		if params.CityID > 0 && (shop.City == nil || shop.City.ID != params.CityID) {
			continue
		}
		if params.RegionID > 0 && (shop.Region == nil || shop.Region.ID != params.RegionID) {
			continue
		}
		if params.SubwayID > 0 && !shopHasSubway(shop, params.SubwayID) {
			continue
		}
		if params.FeatureID > 0 {
			hasFeature := false
			for _, feature := range shop.Features {
				if feature.ID == params.FeatureID {
					hasFeature = true
					break
				}
			}
			if !hasFeature {
				continue
			}
		}
		if search != "" && !shopMatchesSearch(shop, search) {
			continue
		}
		matched = append(matched, shop)
	}

	return matched
}

func shopHasSubway(shop mcp.Shop, subwayID int) bool {
	for _, subway := range shop.Subway {
		if subway.ID == subwayID {
			return true
		}
	}
	return false
}

func shopMatchesSearch(shop mcp.Shop, search string) bool {
	if strings.Contains(strings.ToLower(shop.Address), search) {
		return true
	}
	for _, subway := range shop.Subway {
		if strings.Contains(strings.ToLower(subway.Name), search) {
			return true
		}
	}
	return false
}

// sortShops orders the export by distance when coordinates are known and by ID
// otherwise. Ties are broken by ID so the file is stable between runs.
func sortShops(shops []mcp.Shop, params mcp.QueryParams) {
	if params.HasLocation {
		sort.SliceStable(shops, func(i, j int) bool {
			di := sortableDistance(params, shops[i])
			dj := sortableDistance(params, shops[j])
			if di == dj {
				return shops[i].ID < shops[j].ID
			}
			return di < dj
		})
		return
	}

	sort.SliceStable(shops, func(i, j int) bool { return shops[i].ID < shops[j].ID })
}

// sortableDistance puts shops without coordinates at the end of the file
// instead of measuring from the origin.
func sortableDistance(params mcp.QueryParams, shop mcp.Shop) float64 {
	if shop.Lat == 0 || shop.Lon == 0 {
		return math.MaxFloat64
	}
	return mcp.DistanceKm(params.UserLat, params.UserLon, shop.Lat, shop.Lon)
}

// writeShopsCSV renders the export file: BOM, header row, then one row per shop.
func writeShopsCSV(dst io.Writer, shops []mcp.Shop, params mcp.QueryParams) error {
	ordered := make([]mcp.Shop, len(shops))
	copy(ordered, shops)
	sortShops(ordered, params)

	if _, err := io.WriteString(dst, utf8BOM); err != nil {
		return fmt.Errorf("write bom: %w", err)
	}

	writer := csv.NewWriter(dst)
	writer.Comma = exportDelimiter
	writer.UseCRLF = true

	if err := writer.Write(exportColumns); err != nil {
		return fmt.Errorf("write header: %w", err)
	}

	for _, shop := range ordered {
		if err := writer.Write(exportRow(shop, params)); err != nil {
			return fmt.Errorf("write shop %d: %w", shop.ID, err)
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return fmt.Errorf("flush csv: %w", err)
	}
	return nil
}

func exportRow(shop mcp.Shop, params mcp.QueryParams) []string {
	city := ""
	if shop.City != nil {
		city = shop.City.Name
	}

	rating := ""
	if shop.Rating > 0 {
		rating = strconv.FormatFloat(shop.Rating, 'f', 1, 64)
	}

	subway := make([]string, 0, len(shop.Subway))
	for _, item := range shop.Subway {
		subway = append(subway, item.Name)
	}

	features := make([]string, 0, len(shop.Features))
	for _, item := range shop.Features {
		features = append(features, item.Name)
	}

	return []string{
		strconv.Itoa(shop.ID),
		shop.Address,
		city,
		rating,
		strconv.FormatFloat(shop.Lat, 'f', 6, 64),
		strconv.FormatFloat(shop.Lon, 'f', 6, 64),
		strings.Join(subway, ", "),
		strings.Join(features, ", "),
		exportDistance(shop, params),
	}
}

// exportDistance mirrors the distance format used by the shop list.
func exportDistance(shop mcp.Shop, params mcp.QueryParams) string {
	if !params.HasLocation || shop.Lat == 0 || shop.Lon == 0 {
		return ""
	}

	km := mcp.DistanceKm(params.UserLat, params.UserLon, shop.Lat, shop.Lon)
	if km < 1 {
		return fmt.Sprintf("%d м", int(math.Round(km*1000)))
	}
	return fmt.Sprintf("%.1f км", km)
}

// HandleExportCSV serves the current shop selection as a CSV file. The data
// comes from the accumulated cache only: the export never calls MCP.
func (h *Handler) HandleExportCSV(w http.ResponseWriter, r *http.Request) {
	params, err := parseQueryParams(r)
	if err != nil {
		writeQueryError(w, err)
		return
	}

	shops := filterShops(h.cache.GetAllCachedShops(), params)
	if len(shops) > maxExportRows {
		http.Error(w, fmt.Sprintf("Слишком много магазинов для экспорта: %d (лимит %d)", len(shops), maxExportRows), http.StatusRequestEntityTooLarge)
		return
	}

	var body bytes.Buffer
	if err := writeShopsCSV(&body, shops, params); err != nil {
		log.Printf("export csv error: %v", err)
		http.Error(w, "Не удалось сформировать файл", http.StatusInternalServerError)
		return
	}

	filename := fmt.Sprintf("vkusvill-shops-%s.csv", time.Now().Format("2006-01-02-1504"))
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	w.Header().Set("Cache-Control", "no-store")

	if _, err := w.Write(body.Bytes()); err != nil {
		log.Printf("write export response: %v", err)
	}
}
