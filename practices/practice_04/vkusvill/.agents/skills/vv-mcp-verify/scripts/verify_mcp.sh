#!/usr/bin/env bash
# End-to-end verification of the vvmcp MCP server over stdio.
#
# Usage:
#   scripts/verify_mcp.sh [TEMPLATES_DIR] [INVALID_DIR]
#
# Exit codes: 0 = all assertions passed, 1 = a response was wrong,
# 2 = the server or the tooling failed.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname -- "$(dirname -- "$(dirname -- "$(dirname -- "$SCRIPT_DIR")")")")"

DIR="${1:-internal/web/templates}"
BAD="${2:-missing-dir}"

payload() {
  printf '%s\n' \
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"verify_mcp","version":"1.0"}}}' \
    '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
    '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
    "{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"audit_templates\",\"arguments\":{\"dir\":\"${DIR}\"}}}" \
    "{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"audit_templates\",\"arguments\":{\"dir\":\"${BAD}\"}}}"
}

out="$(payload | go -C "$ROOT" run ./cmd/vvmcp)"

OUT="$out" python3 - <<'PY'
import json
import os
import sys

responses = {}
for line in os.environ["OUT"].splitlines():
    line = line.strip()
    if not line:
        continue
    message = json.loads(line)
    if "id" in message and message["id"] is not None:
        responses[message["id"]] = message

def fail(reason):
    print("FAIL:", reason)
    sys.exit(1)

init = responses.get(1, {}).get("result", {})
if init.get("serverInfo", {}).get("name") != "vvmcp":
    fail("initialize did not return serverInfo.name == vvmcp")

tools = responses.get(2, {}).get("result", {}).get("tools", [])
if not any(tool.get("name") == "audit_templates" for tool in tools):
    fail("tools/list did not advertise audit_templates")

ok = responses.get(3, {}).get("result", {})
if ok.get("isError") is not False:
    fail("successful tools/call should have isError=false")
report = json.loads(ok["content"][0]["text"])
if report["files_scanned"] <= 0:
    fail("successful tools/call scanned no files")

bad = responses.get(4, {}).get("result", {})
if bad.get("isError") is not True:
    fail("tools/call on an invalid dir should have isError=true")

print(f"PASS: {report['files_scanned']} files, {report['errors']} errors, {report['warnings']} warnings")
print(f"error-case message: {bad['content'][0]['text']}")
PY
