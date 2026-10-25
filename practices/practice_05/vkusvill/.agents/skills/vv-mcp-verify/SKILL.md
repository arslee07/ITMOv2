---
name: Verify vvmcp MCP server
description: End-to-end verification of VkusVill Radar's own MCP server (cmd/vvmcp) over stdio — initialize, tools/list, a successful audit_templates call and the error case. Use after changing cmd/vvmcp, internal/audit, or the mcp.servers.vvmcp configuration, or whenever the own MCP must be proven to work.
---

# Verify the vvmcp MCP server

`cmd/vvmcp` is this project's **own** MCP server (stdio transport, JSON-RPC 2.0).
It exposes a single tool, `audit_templates`, which statically checks Go
`html/template` markup against the UI rules in `AGENTS.md §4`.

## When to use

- after editing `cmd/vvmcp/`, `internal/audit/`, or the `mcp.servers.vvmcp`
  entry in `opencode.json`;
- when asked whether the own MCP is still working or "connected but broken";
- before committing any change to the MCP surface.

## Workflow

1. Run the verification script from the project root:

   ```bash
   .agents/skills/vv-mcp-verify/scripts/verify_mcp.sh
   ```

   It starts the server with `go run ./cmd/vvmcp`, sends `initialize`,
   `tools/list`, a successful `tools/call`, and an error `tools/call`, then
   asserts every response. On the first broken expectation it prints
   `FAIL: ...` and exits non-zero.

2. Optionally override the target and the invalid directory:

   ```bash
   .agents/skills/vv-mcp-verify/scripts/verify_mcp.sh internal/web/templates missing-dir
   ```

3. On failure, read `cmd/vvmcp/main.go` and `internal/audit/audit.go`, fix the
   cause, re-run the script, then run `go test ./...` for the unit tests.

## Notes

- The script needs `bash`, `go`, and `python3`.
- The rules in `internal/audit` and the description in `toolDefinitions()` must
  stay in sync, because `AGENTS.md §4` is the source of truth for both.
- `references/jsonrpc.md` documents the exact request/response shapes this
  server speaks, which is handy when adding another tool.
