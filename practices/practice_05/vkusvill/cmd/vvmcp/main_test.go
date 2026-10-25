package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"vkusvill/internal/audit"
)

func mustParams(t *testing.T, v any) json.RawMessage {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal params: %v", err)
	}
	return b
}

func TestServerHandle(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<svg></svg>\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	missing := filepath.Join(t.TempDir(), "nope")

	tests := []struct {
		name        string
		req         rpcRequest
		wantRespond bool
		check       func(t *testing.T, resp *rpcResponse)
	}{
		{
			name:        "initialize echoes protocol version and metadata",
			req:         rpcRequest{ID: json.RawMessage("1"), Method: "initialize", Params: mustParams(t, map[string]any{"protocolVersion": "2025-06-18"})},
			wantRespond: true,
			check: func(t *testing.T, resp *rpcResponse) {
				if resp.Error != nil {
					t.Fatalf("unexpected error: %+v", resp.Error)
				}
				result := resp.Result.(map[string]any)
				if got := result["protocolVersion"]; got != "2025-06-18" {
					t.Errorf("protocolVersion = %v, want 2025-06-18", got)
				}
				info := result["serverInfo"].(map[string]any)
				if info["name"] != serverName {
					t.Errorf("serverInfo.name = %v, want %q", info["name"], serverName)
				}
			},
		},
		{
			name:        "notification gets no response",
			req:         rpcRequest{Method: "notifications/initialized"},
			wantRespond: false,
		},
		{
			name:        "tools/list advertises audit_templates",
			req:         rpcRequest{ID: json.RawMessage("2"), Method: "tools/list"},
			wantRespond: true,
			check: func(t *testing.T, resp *rpcResponse) {
				tools := resp.Result.(map[string]any)["tools"].([]map[string]any)
				if len(tools) != 1 || tools[0]["name"] != toolName {
					t.Fatalf("tools = %+v, want single %q", tools, toolName)
				}
				if _, ok := tools[0]["inputSchema"]; !ok {
					t.Error("tool is missing inputSchema")
				}
			},
		},
		{
			name:        "tools/call success returns a report",
			req:         rpcRequest{ID: json.RawMessage("3"), Method: "tools/call", Params: mustParams(t, map[string]any{"name": toolName, "arguments": map[string]any{"dir": dir}})},
			wantRespond: true,
			check: func(t *testing.T, resp *rpcResponse) {
				result := resp.Result.(map[string]any)
				if result["isError"] != false {
					t.Fatalf("isError = %v, want false", result["isError"])
				}
				content := result["content"].([]map[string]string)
				var report audit.Report
				if err := json.Unmarshal([]byte(content[0]["text"]), &report); err != nil {
					t.Fatalf("report is not JSON: %v", err)
				}
				if report.FilesScanned != 1 || report.Warnings != 1 {
					t.Errorf("report = %+v, want 1 file / 1 warning", report)
				}
			},
		},
		{
			name:        "tools/call on missing dir sets isError",
			req:         rpcRequest{ID: json.RawMessage("4"), Method: "tools/call", Params: mustParams(t, map[string]any{"name": toolName, "arguments": map[string]any{"dir": missing}})},
			wantRespond: true,
			check: func(t *testing.T, resp *rpcResponse) {
				if resp.Error != nil {
					t.Fatalf("protocol error leaked: %+v", resp.Error)
				}
				result := resp.Result.(map[string]any)
				if result["isError"] != true {
					t.Errorf("isError = %v, want true", result["isError"])
				}
			},
		},
		{
			name:        "tools/call with unknown tool sets isError",
			req:         rpcRequest{ID: json.RawMessage("5"), Method: "tools/call", Params: mustParams(t, map[string]any{"name": "nope", "arguments": map[string]any{}})},
			wantRespond: true,
			check: func(t *testing.T, resp *rpcResponse) {
				if resp.Result.(map[string]any)["isError"] != true {
					t.Error("isError = false, want true for unknown tool")
				}
			},
		},
		{
			name:        "unknown method returns protocol error",
			req:         rpcRequest{ID: json.RawMessage("6"), Method: "bogus/method"},
			wantRespond: true,
			check: func(t *testing.T, resp *rpcResponse) {
				if resp.Error == nil || resp.Error.Code != -32601 {
					t.Fatalf("error = %+v, want code -32601", resp.Error)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := &server{}
			resp, ok := srv.handle(tt.req)
			if ok != tt.wantRespond {
				t.Fatalf("respond = %v, want %v", ok, tt.wantRespond)
			}
			if !ok {
				return
			}
			if tt.check != nil {
				tt.check(t, resp)
			}
		})
	}
}
