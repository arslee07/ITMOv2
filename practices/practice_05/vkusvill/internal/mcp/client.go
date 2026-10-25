package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const defaultUserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

// Client communicates with the VkusVill MCP server over HTTP JSON-RPC 2.0.
type Client struct {
	endpoint   string
	httpClient *http.Client
	userAgent  string
}

// NewClient creates a new Client configured for the VkusVill MCP server.
func NewClient(endpoint string) *Client {
	return &Client{
		endpoint: endpoint,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
		userAgent: defaultUserAgent,
	}
}

// FetchShops calls the vkusvill_shops tool on the MCP server with the specified parameters.
func (c *Client) FetchShops(ctx context.Context, params QueryParams) (*ShopsResponse, error) {
	page := params.Page
	if page < 1 {
		page = 1
	}

	args := map[string]interface{}{
		"page": page,
	}
	if params.RegionID > 0 {
		args["id_region_filter"] = params.RegionID
	}
	if params.CityID > 0 {
		args["id_city_filter"] = params.CityID
	}
	if params.SubwayID > 0 {
		args["id_subway_filter"] = params.SubwayID
	}
	if params.FeatureID > 0 {
		args["id_feature_filter"] = params.FeatureID
	}

	rpcReq := jsonrpcRequest{
		JSONRPC: "2.0",
		ID:      1,
		Method:  "tools/call",
		Params: toolCallParams{
			Name:      "vkusvill_shops",
			Arguments: args,
		},
	}

	bodyBytes, err := json.Marshal(rpcReq)
	if err != nil {
		return nil, fmt.Errorf("marshal jsonrpc request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("create http request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("mcp server returned status %d: %s", resp.StatusCode, string(respBody))
	}

	var rpcResp jsonrpcResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return nil, fmt.Errorf("decode jsonrpc response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("mcp error: %v", rpcResp.Error)
	}

	if len(rpcResp.Result.Content) == 0 {
		return nil, fmt.Errorf("empty content in mcp response")
	}

	rawJSONText := rpcResp.Result.Content[0].Text
	var toolData ShopsResponse
	if err := json.Unmarshal([]byte(rawJSONText), &toolData); err != nil {
		return nil, fmt.Errorf("unmarshal shops payload: %w", err)
	}

	return &toolData, nil
}
