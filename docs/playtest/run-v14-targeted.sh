#!/usr/bin/env bash
# Targeted orchestrator run for v1.4 builder UX foundation (PR #80).
# Validates the single-target model + R1/R3/R5/R7/R8 plus the recent
# shipped work (round survey, reset-pairs modal, harder/easier
# complexity persistence, brief always-visible). Also asks the
# builder agent to comment on the perceived placement-loop snappiness
# (temp→real swap, wash + badge timing) since v1.4 also shipped
# server-side correctness on the POST /placements response.
#
# Cast: 1 GM + 2 builders + 2 guiders (2 pairs). Same coordination
# pattern as run-targeted-swap-and-addbriefs.sh — GM fires first,
# 45s sleep so the host session settles before player tabs join.

set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
JETTY_API_KEY=$(grep '^JETTY_API_KEY=' "$REPO/.env.local" | cut -d= -f2)
TESSERA_URL="${TESSERA_URL:-https://tessera.schaffters.com}"
COMPLEXITY="${COMPLEXITY:-3}"
DURATION_MIN="${DURATION_MIN:-7}"

OUT_DIR="${OUT_DIR:-/tmp/orch-v14-$(date +%s)}"
mkdir -p "$OUT_DIR/runs"

echo "=== 1. Create game (briefs on, library, breakouts off) ==="
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{
    "workshop_name": "v1.4 builder UX validation",
    "meeting_mode": "remote",
    "breakout_provider": "none",
    "video_call_url": "https://meet.example.com/v14-test",
    "team_mode": "gm_picks",
    "default_complexity": '"$COMPLEXITY"',
    "round_count": 1,
    "round_duration_seconds": '"$((DURATION_MIN * 60))"',
    "participant_cap": 8,
    "builder_brief_on": true,
    "guider_brief_on": true,
    "builder_brief_source": "library",
    "guider_brief_source": "library",
    "sound_on": true
  }' \
  "$TESSERA_URL/api/games" -o "$OUT_DIR/game.json"
CODE=$(jq -r .code "$OUT_DIR/game.json")
HOST_TOKEN=$(jq -r .host_token "$OUT_DIR/game.json")
echo "  game: $CODE  host_token: ${HOST_TOKEN:0:8}..."

echo
echo "=== 2. Render 5 instructions ==="
TESSERA_URL="$TESSERA_URL" CODE="$CODE" HOST_TOKEN="$HOST_TOKEN" \
  COMPLEXITY="$COMPLEXITY" DURATION_MIN="$DURATION_MIN" \
  OUT="$OUT_DIR/runs" \
  python3 "$REPO/docs/playtest/render-v14-roster.py"

echo
echo "=== 3. Fan out — GM first, then 45s, then players ==="
> "$OUT_DIR/trajs.txt"
fire_one() {
  local f="$1"
  local R
  R=$(curl -sS -X POST -H "Authorization: Bearer $JETTY_API_KEY" \
    -F "init_params=<$f" \
    "https://flows-api.jetty.io/api/v1/run/jettyio/tessera-playtest-scenario")
  local TRAJ
  TRAJ=$(echo "$R" | jq -r '.workflow_id // ""' | sed 's/.*--//')
  local NAME
  NAME=$(basename "$f" .instruction.json)
  echo "  $NAME -> $TRAJ"
  echo "$NAME=$TRAJ" >> "$OUT_DIR/trajs.txt"
}

fire_one "$OUT_DIR/runs/00-gm-facilitator.instruction.json"
echo "  …sleeping 45s before player fan-out…"
sleep 45
for f in "$OUT_DIR/runs/01-builder-avery.instruction.json" \
         "$OUT_DIR/runs/02-guider-bri.instruction.json" \
         "$OUT_DIR/runs/03-builder-cameron.instruction.json" \
         "$OUT_DIR/runs/04-guider-drew.instruction.json"; do
  fire_one "$f"
done

echo
echo "=== 4. Wait for all 5 to complete ==="
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
echo "=== 5. Aggregate ==="
JETTY_API_KEY="$JETTY_API_KEY" python3 "$REPO/docs/playtest/aggregate-targeted.py" "$OUT_DIR"

echo
echo "Done. Aggregate: $OUT_DIR/aggregate.json"
