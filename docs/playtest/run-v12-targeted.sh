#!/usr/bin/env bash
# Targeted single-GM orchestrator focused on v1.2 surfaces:
#
#   - ⇄ Swap-all-pairs button (pre-round only)
#   - ⛶ Fullscreen pair-management modal + search
#   - Inline pair-name badge → PairNameModal with 🎲 again re-roll
#   - Breakout-room terminology (no "pair call" anywhere)
#   - Grid closing border (no clipping at right + bottom edges)
#
# Single GM scenario keeps the run cheap (~10 min) and avoids the
# parallel-fan-out seat conflicts we hit on the prior targeted runs.

set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
JETTY_API_KEY=$(grep '^JETTY_API_KEY=' "$REPO/.env.local" | cut -d= -f2)
TESSERA_URL="${TESSERA_URL:-https://tessera.schaffters.com}"
COMPLEXITY="${COMPLEXITY:-5}"

OUT_DIR="${OUT_DIR:-/tmp/orch-v12-$(date +%s)}"
mkdir -p "$OUT_DIR/runs"

echo "=== 1. Create game (briefs on, library, no breakouts) ==="
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{
    "workshop_name": "v1.2 targeted regression",
    "meeting_mode": "remote",
    "breakout_provider": "jitsi",
    "video_call_url": "https://meet.example.com/v12-test",
    "team_mode": "gm_picks",
    "default_complexity": '"$COMPLEXITY"',
    "round_count": 1,
    "round_duration_seconds": 600,
    "participant_cap": 10,
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
echo "=== 2. Render GM playbook ==="
TESSERA_URL="$TESSERA_URL" CODE="$CODE" HOST_TOKEN="$HOST_TOKEN" \
  COMPLEXITY="$COMPLEXITY" OUT="$OUT_DIR/runs" \
  python3 "$REPO/docs/playtest/render-v12-roster.py"

echo
echo "=== 3. Fire GM trajectory ==="
F="$OUT_DIR/runs/00-gm-v12.instruction.json"
R=$(curl -sS -X POST -H "Authorization: Bearer $JETTY_API_KEY" \
  -F "init_params=<$F" \
  "https://flows-api.jetty.io/api/v1/run/jettyio/tessera-playtest-scenario")
TRAJ=$(echo "$R" | jq -r '.workflow_id // ""' | sed 's/.*--//')
echo "  GM -> $TRAJ"

echo
echo "=== 4. Wait for completion ==="
while true; do
  STATUS=$(curl -sS -H "Authorization: Bearer $JETTY_API_KEY" \
    "https://flows-api.jetty.io/api/v1/db/trajectory/jettyio/tessera-playtest-scenario/$TRAJ" \
    | jq -r '.status // "running"')
  if [[ "$STATUS" == "completed" || "$STATUS" == "failed" || "$STATUS" == "cancelled" ]]; then
    break
  fi
  sleep 60
done
echo "  status: $STATUS"

echo
echo "=== 5. Aggregate ==="
JETTY_API_KEY="$JETTY_API_KEY" TRAJ_ID="$TRAJ" \
  python3 "$REPO/docs/playtest/aggregate-v12.py" "$OUT_DIR"

echo
echo "Done. Aggregate: $OUT_DIR/aggregate.json"
