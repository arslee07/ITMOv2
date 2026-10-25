# vvmcp JSON-RPC reference

The server speaks newline-delimited JSON-RPC 2.0 over stdio. Requests have an
`id`; notifications do not. Every request with an `id` gets exactly one response
on stdout. Logs go to stderr so they never corrupt the protocol.

## Methods

### initialize

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"verify_mcp","version":"1.0"}}}
```

Result: `protocolVersion` (echoes the requested one), `capabilities.tools`, and
`serverInfo {name, version}`.

### notifications/initialized

```json
{"jsonrpc":"2.0","method":"notifications/initialized"}
```

No response.

### tools/list

```json
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
```

Result: `tools[]` where each entry has `name`, `description`, `inputSchema`.

### tools/call

```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"audit_templates","arguments":{"dir":"internal/web/templates"}}}
```

Result: `content[]` with a single `{type:"text", text}` item holding the JSON
report, plus `isError`. Tool failures (for example a missing directory) are
reported as `isError: true` with a human-readable message rather than a
JSON-RPC protocol error, so the agent can react to them.

### ping

```json
{"jsonrpc":"2.0","id":9,"method":"ping"}
```

Result: `{}`.

## Errors

- Parse failure: JSON-RPC error `-32700`.
- Unknown method: JSON-RPC error `-32601`.
