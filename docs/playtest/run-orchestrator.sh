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
DURATION_MIN="${DURATION_MIN:-8}"
ROUND_COUNT="${ROUND_COUNT:-2}"
# Meeting mode + breakout provider exercise the v1.3 dual-provider
# flow. Defaults: remote + jitsi, since jitsi is the most-changed
# autonomous-friendly code path (no Google OAuth needed, no real
# Calendar pollution). Override to "in_person" / "none" to test the
# in-person flow.
MEETING_MODE="${MEETING_MODE:-remote}"
BREAKOUT_PROVIDER="${BREAKOUT_PROVIDER:-jitsi}"

if [[ -z "$JETTY_API_KEY" ]]; then
  echo "JETTY_API_KEY not found in .env.local" >&2
  exit 1
fi

OUT_DIR="${OUT_DIR:-/tmp/orch-$(date +%s)}"
mkdir -p "$OUT_DIR"

echo "=== 1. Create a fresh game (meeting_mode=$MEETING_MODE, breakout_provider=$BREAKOUT_PROVIDER) ==="
# In-person workshops null out the video call URL — the host form
# would; mirror that here so the orchestrator's game state matches
# the in-person UX path.
if [[ "$MEETING_MODE" == "in_person" ]]; then
  VIDEO_URL="null"
else
  VIDEO_URL='"https://meet.example.com/orchestrator-playtest"'
fi
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{
    "workshop_name": "Orchestrator playtest",
    "meeting_mode": "'"$MEETING_MODE"'",
    "breakout_provider": "'"$BREAKOUT_PROVIDER"'",
    "video_call_url": '"$VIDEO_URL"',
    "team_mode": "gm_picks",
    "default_complexity": '"$COMPLEXITY"',
    "round_count": '"$ROUND_COUNT"',
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
  ROUND_COUNT="$ROUND_COUNT" \
  MEETING_MODE="$MEETING_MODE" BREAKOUT_PROVIDER="$BREAKOUT_PROVIDER" \
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


def fetch_codex_log(traj):
    """Codex's log file index isn't fixed — sometimes .0000., sometimes
    .0001., depending on whether other artifacts (sqlite, jsonl)
    happened to write first. The trajectory record lists the exact
    paths under steps.play.outputs.files; pick whichever ends in
    `.agent_codex.txt`."""
    meta = subprocess.run(
        ["curl", "-sS", "-H", f"Authorization: Bearer {api_key}",
         f"https://flows-api.jetty.io/api/v1/db/trajectory/jettyio/tessera-playtest-scenario/{traj}"],
        capture_output=True, text=True,
    ).stdout
    try:
        files = json.loads(meta)["steps"]["play"]["outputs"]["files"]
    except Exception:
        files = []
    log_path = next(
        (
            f["path"]
            for f in files
            if (
                f.get("path", "").endswith("agent_codex.txt")
                or f.get("path", "").endswith("agent--codex.txt")
            )
        ),
        None,
    )
    if not log_path:
        return ""
    return subprocess.run(
        ["curl", "-sS", "-H", f"Authorization: Bearer {api_key}",
         f"https://flows-api.jetty.io/api/v1/file/{log_path}"],
        capture_output=True, text=True,
    ).stdout


def find_last_agent_message_json(log):
    """Walk the line-delimited codex log from the END looking for the
    final `item.completed` event of type `agent_message`. Its
    `item.text` field IS the report (a JSON object string) — no
    further fence stripping needed because the playbook tells the
    agent to print bare JSON."""
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
        # The text might be the bare JSON, or might have surrounding
        # commentary. Walk it the same way we used to walk the
        # claude-code result string: balanced-brace scan from the end
        # for the last parseable {…}.
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
                    candidate = text[i:end + 1]
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
        # Last agent_message reached without a parseable JSON — bail
        # without scanning earlier messages (those would be
        # mid-session reasoning, not the final report).
        return None
    return None


results = []
for name, traj in trajs.items():
    log = fetch_codex_log(traj)
    parsed = find_last_agent_message_json(log)
    results.append({"name": name, "trajectory_id": traj, "report": parsed})

with open(f"{out_dir}/aggregate.json", "w") as fh:
    json.dump({"trajectories": results}, fh, indent=2)

print()
print("=== Orchestrator outcome + findings ===")
total_findings = 0
by_sev = {"blocker": 0, "major": 0, "minor": 0, "nit": 0}
would_use = {"yes": 0, "no": 0, "maybe": 0, "unknown": 0}
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
    exp = rep.get("experience") or {}
    use = (exp.get("would_use_for_real") or "unknown").split()[0].lower()
    would_use[use if use in would_use else "unknown"] += 1
    print(f"  {r['name']:30}  ({r['trajectory_id']})  outcome={rep.get('outcome', '?'):8}  {len(findings)} findings  use={use}")

# Experience block — the headline signal of the rewritten playbook.
print()
print("=== Experiential read ===")
for r in results:
    rep = r["report"]
    if not rep: continue
    exp = rep.get("experience") or {}
    if not exp: continue
    print(f"\n  --- {r['name']} ---")
    summary = (exp.get("summary") or "").strip()
    if summary:
        print(f"  summary: {summary}")
    for k in ("most_engaging_moment", "most_confusing_moment", "what_to_change"):
        v = (exp.get(k) or "").strip()
        if v:
            print(f"  {k}: {v}")

print()
print(f"Total findings: {total_findings}  (blocker={by_sev['blocker']}, major={by_sev['major']}, minor={by_sev['minor']}, nit={by_sev['nit']})")
print(f"Would-use-for-real: yes={would_use['yes']}  maybe={would_use['maybe']}  no={would_use['no']}  unknown={would_use['unknown']}")
print(f"Aggregate JSON: {out_dir}/aggregate.json")
PY

echo
echo "Done. Aggregate: $OUT_DIR/aggregate.json"
