#!/usr/bin/env python3
"""Aggregate the single-GM v1.2 trajectory into a focused report."""
from __future__ import annotations

import json
import os
import subprocess
import sys

out_dir = sys.argv[1]
api_key = os.environ["JETTY_API_KEY"]
traj = os.environ["TRAJ_ID"]


def fetch_codex_log(traj):
    meta = subprocess.run(
        [
            "curl",
            "-sS",
            "-H",
            f"Authorization: Bearer {api_key}",
            f"https://flows-api.jetty.io/api/v1/db/trajectory/jettyio/tessera-playtest-scenario/{traj}",
        ],
        capture_output=True,
        text=True,
    ).stdout
    try:
        files = json.loads(meta)["steps"]["play"]["outputs"]["files"]
    except Exception:
        files = []
    log_path = next(
        (f["path"] for f in files if f.get("path", "").endswith("agent_codex.txt")),
        None,
    )
    if not log_path:
        return ""
    return subprocess.run(
        [
            "curl",
            "-sS",
            "-H",
            f"Authorization: Bearer {api_key}",
            f"https://flows-api.jetty.io/api/v1/file/{log_path}",
        ],
        capture_output=True,
        text=True,
    ).stdout


def find_last_agent_message_json(log):
    for line in reversed(log.splitlines()):
        line = line.strip()
        if not line:
            continue
        try:
            ev = json.loads(line)
        except Exception:
            continue
        if ev.get("type") != "item.completed":
            continue
        item = ev.get("item") or {}
        if item.get("type") != "agent_message":
            continue
        text = (item.get("text") or "").strip()
        depth = 0
        end = -1
        in_str = False
        esc = False
        for i in range(len(text) - 1, -1, -1):
            c = text[i]
            if esc:
                esc = False
                continue
            if c == "\\" and i + 1 < len(text):
                esc = True
                continue
            if c == '"' and not esc:
                in_str = not in_str
                continue
            if in_str:
                continue
            if c == "}":
                if depth == 0:
                    end = i
                depth += 1
            elif c == "{":
                depth -= 1
                if depth == 0 and end != -1:
                    candidate = text[i : end + 1]
                    try:
                        obj = json.loads(candidate)
                        if isinstance(obj, dict) and (
                            "experience" in obj or "findings" in obj
                        ):
                            return obj
                    except Exception:
                        pass
                    end = -1
                    depth = 0
        return None
    return None


log = fetch_codex_log(traj)
parsed = find_last_agent_message_json(log)
result = {"trajectory_id": traj, "report": parsed}
with open(f"{out_dir}/aggregate.json", "w") as fh:
    json.dump(result, fh, indent=2)

print()
print("=== v1.2 targeted run outcome ===")
if not parsed:
    print(f"  ({traj})  NO PARSEABLE REPORT")
    sys.exit(0)
findings = parsed.get("findings", []) or []
sev_counts = {}
for f in findings:
    s = f.get("severity", "?") if isinstance(f, dict) else "?"
    sev_counts[s] = sev_counts.get(s, 0) + 1
sev_str = " ".join(f"{k}={v}" for k, v in sev_counts.items())
print(
    f"  outcome={parsed.get('outcome', '?'):8}  findings={len(findings)} {sev_str}"
)
print()
print("=== Step-by-step PASS/FAIL ===")
summary = (parsed.get("experience", {}) or {}).get("summary", "").strip()
if summary:
    print(summary)
print()
print("=== Findings ===")
for f in findings:
    if isinstance(f, str):
        print(f"  [str] {f[:200]}")
        continue
    if not isinstance(f, dict):
        continue
    sev = f.get("severity", "?")
    title = f.get("title", "?")
    print(f"  [{sev}] {title}")
    detail = (f.get("detail") or "").strip() if isinstance(f.get("detail"), str) else ""
    if detail:
        print(f"      {detail[:240]}")
print()
print(f"Aggregate JSON: {out_dir}/aggregate.json")
