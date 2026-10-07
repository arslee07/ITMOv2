// Command vvmcp is VkusVill Radar's own MCP server. It speaks MCP over the
// stdio transport (newline-delimited JSON-RPC 2.0) and exposes the
// audit_templates tool, which checks Go html/template markup against the UI
// accessibility rules from AGENTS.md §4.
//
// Run it directly with `go run ./cmd/vvmcp` for manual probing, or let OpenCode
// start it from the `mcp.servers.vvmcp` entry in opencode.json.
package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"os"

	"vkusvill/internal/audit"
)

const (
	serverName     = "vvmcp"
	serverVersion  = "0.1.0"
	defaultProto   = "2024-11-05"
	toolName       = "audit_templates"
	maxMessageSize = 4 * 1024 * 1024
)

type rpcRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *rpcError       `json:"error,omitempty"`
}

type server struct{}

func main() {
	encoder := json.NewEncoder(os.Stdout)
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 0, 64*1024), maxMessageSize)

	srv := &server{}
	for scanner.Scan() {
		line := bytes.TrimSpace(scanner.Bytes())
		if len(line) == 0 {
			continue
		}

		var req rpcRequest
		if err := json.Unmarshal(line, &req); err != nil {
			writeResponse(encoder, &rpcResponse{
				JSONRPC: "2.0",
				ID:      json.RawMessage("null"),
				Error:   &rpcError{Code: -32700, Message: "parse error: " + err.Error()},
			})
			continue
		}

		if resp, ok := srv.handle(req); ok {
			writeResponse(encoder, resp)
		}
	}

	if err := scanner.Err(); err != nil {
		fmt.Fprintf(os.Stderr, "vvmcp: read stdin: %v\n", err)
	}
}

// handle turns a request into a response. The boolean reports whether a
// response should be written; notifications (and responses) get none.
func (s *server) handle(req rpcRequest) (*rpcResponse, bool) {
	if len(req.ID) == 0 || string(req.ID) == "null" {
		return nil, false
	}

	resp := &rpcResponse{JSONRPC: "2.0", ID: req.ID}

	switch req.Method {
	case "initialize":
		resp.Result = s.initialize(req.Params)
	case "ping":
		resp.Result = map[string]any{}
	case "tools/list":
		resp.Result = map[string]any{"tools": toolDefinitions()}
	case "tools/call":
		resp.Result = s.callTool(req.Params)
	default:
		resp.Error = &rpcError{Code: -32601, Message: "method not found: " + req.Method}
	}

	return resp, true
}

func (s *server) initialize(params json.RawMessage) any {
	protocol := defaultProto
	var probe struct {
		ProtocolVersion string `json:"protocolVersion"`
	}
	if len(params) > 0 && json.Unmarshal(params, &probe) == nil && probe.ProtocolVersion != "" {
		protocol = probe.ProtocolVersion
	}

	return map[string]any{
		"protocolVersion": protocol,
		"capabilities": map[string]any{
			"tools": map[string]any{"listChanged": false},
		},
		"serverInfo": map[string]any{
			"name":    serverName,
			"version": serverVersion,
		},
	}
}

// callTool always returns a valid MCP tool result. Tool failures, such as a
// missing directory, are reported with isError=true instead of a protocol
// error so the agent can read the message.
func (s *server) callTool(params json.RawMessage) map[string]any {
	var call struct {
		Name      string `json:"name"`
		Arguments struct {
			Dir string `json:"dir"`
		} `json:"arguments"`
	}
	if err := json.Unmarshal(params, &call); err != nil {
		return toolError(fmt.Errorf("invalid params: %w", err))
	}
	if call.Name != toolName {
		return toolError(fmt.Errorf("unknown tool %q", call.Name))
	}

	report, err := audit.AuditDir(call.Arguments.Dir)
	if err != nil {
		return toolError(err)
	}

	payload, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return toolError(fmt.Errorf("encode report: %w", err))
	}

	return map[string]any{
		"content": []map[string]string{{"type": "text", "text": string(payload)}},
		"isError": false,
	}
}

func toolError(err error) map[string]any {
	return map[string]any{
		"content": []map[string]string{{"type": "text", "text": err.Error()}},
		"isError": true,
	}
}

func toolDefinitions() []map[string]any {
	return []map[string]any{
		{
			"name":        toolName,
			"description": "Статически проверяет HTML-шаблоны на правила доступности из AGENTS.md §4: <svg> без aria-hidden, кнопка-иконка без доступного имени, сырые эмодзи. Возвращает JSON-отчёт с файлами, строками и типом нарушения.",
			"inputSchema": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"dir": map[string]any{
						"type":        "string",
						"description": "Каталог с HTML-шаблонами. По умолчанию — текущий каталог.",
					},
				},
				"additionalProperties": false,
			},
		},
	}
}

func writeResponse(encoder *json.Encoder, resp *rpcResponse) {
	if resp == nil {
		return
	}
	if err := encoder.Encode(resp); err != nil {
		fmt.Fprintf(os.Stderr, "vvmcp: encode response: %v\n", err)
	}
}
