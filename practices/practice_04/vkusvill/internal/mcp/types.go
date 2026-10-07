package mcp

// NamedItem represents a general item with ID and Name.
type NamedItem struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// SubwayItem represents a metro station with line information.
type SubwayItem struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Line string `json:"line,omitempty"`
}

// Shop represents a VkusVill store entity.
type Shop struct {
	ID               int          `json:"id"`
	URL              string       `json:"url"`
	Region           *NamedItem   `json:"region"`
	City             *NamedItem   `json:"city"`
	Address          string       `json:"address"`
	Subway           []SubwayItem `json:"subway"`
	Phone            []string     `json:"phone"`
	Lat              float64      `json:"lat"`
	Lon              float64      `json:"lon"`
	Rating           float64      `json:"rating"`
	Schedule         string       `json:"schedule"`
	ScheduleHolidays *string      `json:"schedule_holidays"`
	Description      *string      `json:"description"`
	Features         []NamedItem  `json:"features"`
}

// FilterItem represents an item within a filter category (e.g. specific feature or city).
type FilterItem struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
	Line string `json:"line,omitempty"`
}

// FilterGroup represents a group of filters (e.g. "Регион", "Город", "Метро", "Особенность").
type FilterGroup struct {
	Name  string       `json:"name"`
	Items []FilterItem `json:"items"`
}

// FilterApplied represents an active applied filter.
type FilterApplied struct {
	Name  string      `json:"name"`
	Value interface{} `json:"value"`
}

// Meta represents metadata returned from vkusvill_shops tool.
type Meta struct {
	Limit          int             `json:"limit"`
	Total          int             `json:"total"`
	Page           int             `json:"page"`
	Pages          int             `json:"pages"`
	HasMore        bool            `json:"has_more"`
	Filters        []FilterGroup   `json:"filters"`
	FiltersApplied []FilterApplied `json:"filters_applied"`
}

// ShopsData is the inner data payload of vkusvill_shops.
type ShopsData struct {
	Meta  Meta   `json:"meta"`
	Items []Shop `json:"items"`
}

// ShopsResponse is the unmarshaled payload from the tool's text content.
type ShopsResponse struct {
	OK   bool      `json:"ok"`
	Data ShopsData `json:"data"`
}

// JSON-RPC protocol structures

type jsonrpcRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int         `json:"id"`
	Method  string      `json:"method"`
	Params  interface{} `json:"params"`
}

type toolCallParams struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

type toolContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type toolResult struct {
	Content []toolContent `json:"content"`
	IsError bool          `json:"isError"`
}

type jsonrpcResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int         `json:"id"`
	Result  toolResult  `json:"result"`
	Error   interface{} `json:"error"`
}

// QueryParams holds user-selected filters for shop querying.
type QueryParams struct {
	Page       int
	RegionID   int
	CityID     int
	SubwayID   int
	FeatureID  int
	SearchText string
	UserLat    float64
	UserLon    float64
}
