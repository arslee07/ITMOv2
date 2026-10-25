#!/usr/bin/env python3
"""Forced decision replay: server-side authorization independent of the model.

Sends crafted `decision` objects straight to /assistant/execute with a real
session. This is the access-control test from the lab README, not a proof of
prompt injection: the model is not asked anything here.

Usage:
    python3 attacks/forced_decisions.py --out evidence/after/forced.json
"""

import argparse
import json
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def call(base, method, path, body=None, headers=None):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = Request(base + path, data=data,
                      headers={"Content-Type": "application/json", **(headers or {})},
                      method=method)
    try:
        response = urlopen(request, timeout=5)
    except HTTPError as exc:
        response = exc
    with response:
        raw = response.read().decode("utf-8", "replace")
        try:
            return response.status, json.loads(raw), raw
        except json.JSONDecodeError:
            return response.status, None, raw


def login(base, username, password):
    status, payload, raw = call(base, "POST", "/login",
                                {"username": username, "password": password})
    if status != 200:
        raise SystemExit(f"login failed for {username}: {status} {raw}")
    return payload["token"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:8066")
    parser.add_argument("--out", default="")
    args = parser.parse_args()
    base = args.base.rstrip("/")

    tokens = {
        "customer": login(base, "alice", "learn-alice"),
        "staff": login(base, "staff", "learn-staff"),
    }
    cases = [
        ("customer", "export_profiles", {}, 403),
        ("customer", "delete_tree", {"path": "files/bob"}, 403),
        ("customer", "read_file", {"path": "files/bob/receipt.txt"}, 403),
        ("customer", "read_file", {"path": "private/operator-note.txt"}, 400),
        ("customer", "read_file", {"path": "files/alice/receipt.txt"}, 200),
        ("staff", "export_profiles", {}, 200),
    ]
    results = []
    for who, tool, arguments, expected in cases:
        status, payload, raw = call(
            base, "POST", "/assistant/execute",
            {"decision": {"tool": tool, "arguments": arguments}},
            {"X-Token": tokens[who]})
        ok = status == expected
        results.append({"actor": who, "tool": tool, "arguments": arguments,
                        "expected": expected, "status": status, "ok": ok,
                        "body": payload if payload is not None else raw})
        print(f"[{'PASS' if ok else 'FAIL'}] {who:8} {tool:16} "
              f"expected {expected}, got {status}")

    # Bob's fixture must still exist after the blocked delete.
    status, payload, raw = call(base, "GET", "/files?user=bob&path=receipt.txt",
                                headers={"X-Token": tokens["staff"]})
    intact = status == 200 and "TEST_BOB" in raw
    results.append({"check": "fixture_intact", "ok": intact, "status": status,
                    "body": payload if payload is not None else raw})
    print(f"[{'PASS' if intact else 'FAIL'}] bob receipt intact: {status}")

    failed = [item for item in results if not item["ok"]]
    print(f"{len(results) - len(failed)}/{len(results)} passed")
    if args.out:
        with open(args.out, "w", encoding="utf-8") as handle:
            json.dump({"results": results, "failed": len(failed)},
                      handle, ensure_ascii=False, indent=2)
        print(f"saved: {args.out}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
