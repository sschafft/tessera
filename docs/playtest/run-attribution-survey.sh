#!/usr/bin/env bash
# Targeted Jetty playtest for the friction-attribution reflection
# survey shipped in PR #96.
#
# Cast: 1 GM + 2 builders + 2 guiders (2 pairs). Two-round game
# with a 3-minute round budget so the GM can comfortably walk:
#   - round 1 → end + ask reflection → both pairs submit sliders
#   - round 2 → end (skip reflection) → confirm card stays hidden
#   - end game → confirm "Where did the friction land?" card
#                renders for round 1 only with the asymmetry
#                callout when role-deltas exceed 15 points.
#
# Same coordination pattern as run-v14-targeted.sh — GM fires first,
# 45s sleep so the host session settles before the player tabs join.

set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
JETTY_API_KEY=$(grep '^JETTY_API_KEY=' "$REPO/.env.local" | cut -d= -f2)
TESSERA_URL="${TESSERA_URL:-https://tessera.schaffters.com}"
COMPLEXITY="${COMPLEXITY:-3}"
DURATION_MIN="${DURATION_MIN:-3}"

OUT_DIR="${OUT_DIR:-/tmp/orch-attribution-$(date +%s)}"
mkdir -p "$OUT_DIR/runs"

echo "=== 1. Create game (2 rounds, briefs on, breakouts off) ==="
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{
    "workshop_name": "PR #96 friction-attribution QA",
    "meeting_mode": "remote",
    "breakout_provider": "none",
    "video_call_url": "https://meet.example.com/attribution-test",
    "team_mode": "gm_picks",
    "default_complexity": '"$COMPLEXITY"',
    "round_count": 2,
    "round_duration_seconds": '"$((DURATION_MIN * 60))"',
    "participant_cap": 6,
    "builder_brief_on": true,
    "guider_brief_on": true,
    "builder_brief_source": "library",
    "guider_brief_source": "library",
    "sound_on": false
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
  python3 "$REPO/docs/playtest/render-attribution-survey.py"

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
echo "  ...sleeping 45s before player fan-out..."
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
