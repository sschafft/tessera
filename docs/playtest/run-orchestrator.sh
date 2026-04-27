#!/usr/bin/env bash
# DIY fan-out orchestrator for the 10-role Tessera playtest.
#
# Why this script exists: Jetty's list_emit_await activity does not
# pass per-item values into child workflows' init_params (verified
# 2026-04-27 across three variants — see memory/reference_jetty.md).
# So instead of a Jetty workflow doing the fan-out, this script:
#
#   1. Creates a fresh game via POST /api/games (capturing code + host_token).
#   2. Calls render-roster.py to write 10 role-specific instructions
#      to /tmp/orch-runs/.
#   3. Fires 10 parallel curls to jettyio/tessera-playtest-scenario,
#      each with one rendered instruction. Each curl creates an
#      independent Daytona container with its own Playwright browser
#      and isolated cookies.
#   4. Polls all 10 trajectories until they complete.
#   5. Fetches each child's final JSON, aggregates into one report.
#
# Usage:
#   ./docs/playtest/run-orchestrator.sh
#
# Env overrides:
#   TESSERA_URL  — defaults to https://tessera.schaffters.com
#   COMPLEXITY   — defaults to 5
#   DURATION_MIN — defaults to 10
#
# Requires: curl, jq, python3, JETTY_API_KEY in .env.local at repo root.

set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
JETTY_API_KEY=$(grep '^JETTY_API_KEY=' "$REPO/.env.local" | cut -d= -f2)
TESSERA_URL="${TESSERA_URL:-https://tessera.schaffters.com}"
COMPLEXITY="${COMPLEXITY:-5}"
DURATION_MIN="${DURATION_MIN:-10}"

if [[ -z "$JETTY_API_KEY" ]]; then
  echo "JETTY_API_KEY not found in .env.local" >&2
  exit 1
fi

OUT_DIR="${OUT_DIR:-/tmp/orch-$(date +%s)}"
mkdir -p "$OUT_DIR"

echo "=== 1. Create a fresh game ==="
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{
    "workshop_name": "Orchestrator playtest",
    "video_call_url": "https://meet.example.com/orchestrator-playtest",
    "team_mode": "gm_picks",
    "default_complexity": '"$COMPLEXITY"',
    "round_count": 1,
    "round_duration_seconds": '"$((DURATION_MIN * 60))"',
    "participant_cap": 16,
    "builder_brief_on": true,
    "guider_brief_on": true,
    "builder_brief_source": "library",
    "guider_brief_source": "library",
    "sound_on": true
  }' \
  "$TESSERA_URL/api/games" -o "$OUT_DIR/game.json"
CODE=$(jq -r .code "$OUT_DIR/game.json")
HOST_TOKEN=$(jq -r .host_token "$OUT_DIR/game.json")
echo "  game: $CODE  host_token: ${HOST_TOKEN:0:8}…"

echo
echo "=== 2. Render 10 role instructions ==="
CODE="$CODE" HOST_TOKEN="$HOST_TOKEN" TESSERA_URL="$TESSERA_URL" \
  COMPLEXITY="$COMPLEXITY" DURATION_MIN="$DURATION_MIN" \
  python3 "$REPO/docs/playtest/render-roster.py"

echo
echo "=== 3. Fan out — 10 parallel curls to tessera-playtest-scenario ==="
> "$OUT_DIR/trajs.txt"
for f in /tmp/orch-runs/*.instruction.json; do
  R=$(curl -sS -X POST -H "Authorization: Bearer $JETTY_API_KEY" \
    -F "init_params=<$f" \
    "https://flows-api.jetty.io/api/v1/run/jettyio/tessera-playtest-scenario")
  TRAJ=$(echo "$R" | jq -r '.workflow_id // ""' | sed 's/.*--//')
  NAME=$(basename "$f" .instruction.json)
  echo "  $NAME -> $TRAJ"
  echo "$NAME=$TRAJ" >> "$OUT_DIR/trajs.txt"
done

echo
echo "=== 4. Wait for all 10 to complete (~10-15 min each, parallel) ==="
ALL_DONE=0
while [[ "$ALL_DONE" -eq 0 ]]; do
  ALL_DONE=1
  for line in $(cat "$OUT_DIR/trajs.txt"); do
    NAME="${line%=*}"
    TRAJ="${line#*=}"
    STATUS=$(curl -sS -H "Authorization: Bearer $JETTY_API_KEY" \
      "https://flows-api.jetty.io/api/v1/db/trajectory/jettyio/tessera-playtest-scenario/$TRAJ" \
      | jq -r '.status // "running"')
    if [[ "$STATUS" != "completed" && "$STATUS" != "failed" && "$STATUS" != "cancelled" ]]; then
      ALL_DONE=0
      break
    fi
  done
  [[ "$ALL_DONE" -eq 0 ]] && sleep 60
done

echo
echo "=== 5. Aggregate findings ==="
JETTY_API_KEY="$JETTY_API_KEY" python3 - "$OUT_DIR" <<'PY'
import json, os, subprocess, sys
out_dir = sys.argv[1]
trajs = {}
with open(f"{out_dir}/trajs.txt") as fh:
    for line in fh:
        line = line.strip()
        if not line: continue
        name, traj = line.split("=", 1)
        trajs[name] = traj

api_key = os.environ["JETTY_API_KEY"]
results = []
for name, traj in trajs.items():
    log_path = f"jettyio/tessera-playtest-scenario/0000/{traj}.runbook.0000.agent_claude-code.txt"
    log = subprocess.run(
        ["curl", "-sS", "-H", f"Authorization: Bearer {api_key}",
         f"https://flows-api.jetty.io/api/v1/file/{log_path}"],
        capture_output=True, text=True,
    ).stdout
    parsed = None
    for line in reversed(log.splitlines()):
        if not line.strip(): continue
        try:
            ev = json.loads(line)
        except Exception: continue
        if ev.get("type") == "result":
            text = ev.get("result") or ""
            depth = 0; end = -1; in_str = False; esc = False
            for i in range(len(text) - 1, -1, -1):
                c = text[i]
                if esc: esc = False; continue
                if c == "\\" and i + 1 < len(text): esc = True; continue
                if c == '"' and not esc: in_str = not in_str; continue
                if in_str: continue
                if c == "}":
                    if depth == 0: end = i
                    depth += 1
                elif c == "{":
                    depth -= 1
                    if depth == 0 and end != -1:
                        try:
                            parsed = json.loads(text[i:end + 1])
                            break
                        except Exception:
                            end = -1; depth = 0
            break
    results.append({"name": name, "trajectory_id": traj, "report": parsed})

with open(f"{out_dir}/aggregate.json", "w") as fh:
    json.dump({"trajectories": results}, fh, indent=2)

print()
print("=== Orchestrator findings ===")
total_findings = 0
by_sev = {"blocker": 0, "major": 0, "minor": 0, "nit": 0}
for r in results:
    rep = r["report"]
    if not rep:
        print(f"  {r['name']:30}  ({r['trajectory_id']})  NO PARSEABLE REPORT")
        continue
    findings = rep.get("findings", []) or []
    total_findings += len(findings)
    for f in findings:
        sev = f.get("severity", "unknown")
        if sev in by_sev: by_sev[sev] += 1
    print(f"  {r['name']:30}  ({r['trajectory_id']})  outcome={rep.get('outcome', '?'):8}  {len(findings)} findings")

print()
print(f"Total findings: {total_findings}  (blocker={by_sev['blocker']}, major={by_sev['major']}, minor={by_sev['minor']}, nit={by_sev['nit']})")
print(f"Aggregate JSON: {out_dir}/aggregate.json")
PY

echo
echo "Done. Aggregate: $OUT_DIR/aggregate.json"
