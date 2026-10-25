#!/usr/bin/env python3
"""Check that the debug log keeps secrets out even for an authorized staff user.

Usage:
    python3 attacks/log_redaction.py --out evidence/after/log_redaction.json
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
        raise SystemExit(f"login failed: {status} {raw}")
    return payload["token"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://127.0.0.1:8066")
    parser.add_argument("--out", default="")
    args = parser.parse_args()
    base = args.base.rstrip("/")

    alice = login(base, "alice", "learn-alice")
    staff = login(base, "staff", "learn-staff")
    # Put a live token and a password into the log.
    call(base, "GET", "/profile?id=1", headers={"X-Token": alice})
    login(base, "bob", "learn-bob")

    anonymous_status, _, _ = call(base, "GET", "/debug/logs")
    customer_status, _, _ = call(base, "GET", "/debug/logs",
                                 headers={"X-Token": alice})
    status, logs, raw = call(base, "GET", "/debug/logs",
                             headers={"X-Token": staff})
    text = json.dumps(logs, ensure_ascii=False) if logs is not None else raw

    checks = {
        "anonymous_is_denied": anonymous_status == 401,
        "customer_is_denied": customer_status == 403,
        "staff_is_allowed": status == 200,
        "alice_token_is_redacted": alice not in text,
        "bob_password_is_redacted": "learn-bob" not in text,
        "staff_token_is_redacted": staff not in text,
        "redaction_marker_present": "[redacted]" in text,
    }
    for name, ok in checks.items():
        print(f"[{'PASS' if ok else 'FAIL'}] {name}")
    print(f"log entries: {len(logs) if isinstance(logs, list) else 'n/a'}")
    failed = [name for name, ok in checks.items() if not ok]
    print(f"{len(checks) - len(failed)}/{len(checks)} passed")
    if args.out:
        with open(args.out, "w", encoding="utf-8") as handle:
            json.dump({"checks": checks, "failed": failed}, handle,
                      ensure_ascii=False, indent=2)
        print(f"saved: {args.out}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
