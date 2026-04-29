#!/usr/bin/env bash
# Targeted orchestrator run focused on TWO UX paths shipped in PR #66:
#
#   1. **Swap-roles button** (pre-round) — GM clicks ⇄ swap on a pair
#      before round 1; participants' roles swap in the lobby.
#      Refused mid-round (returns 409 round_running) — UI hides the
#      pill while a round is running.
#
#   2. **Briefs OFF → triggered mid-round** — game created with
#      builder_brief_on=false, guider_brief_on=false. GM uses ✦ Change
#      builder brief / ✦ Change guider brief mid-round; this doubles
#      as "Add brief" — flips game.builder_brief_on=true and persists
#      a fresh brief on the running round.
#
# Smaller cast (1 GM + 2 builders + 2 guiders = 5 tabs, 2 pairs).
#
# Bash composes only the API call + fan-out + aggregation. Playbook
# composition is pure Python (no nested heredoc / bash quoting hell).

set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
JETTY_API_KEY=$(grep '^JETTY_API_KEY=' "$REPO/.env.local" | cut -d= -f2)
TESSERA_URL="${TESSERA_URL:-https://tessera.schaffters.com}"
COMPLEXITY="${COMPLEXITY:-4}"
DURATION_MIN="${DURATION_MIN:-6}"

OUT_DIR="${OUT_DIR:-/tmp/orch-targeted-$(date +%s)}"
mkdir -p "$OUT_DIR/runs"

echo "=== 1. Create game with briefs OFF ==="
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{
    "workshop_name": "Targeted: swap-roles + add-brief",
    "meeting_mode": "remote",
    "breakout_provider": "none",
    "video_call_url": "https://meet.example.com/targeted-playtest",
    "team_mode": "gm_picks",
    "default_complexity": '"$COMPLEXITY"',
    "round_count": 1,
    "round_duration_seconds": '"$((DURATION_MIN * 60))"',
    "participant_cap": 8,
    "builder_brief_on": false,
    "guider_brief_on": false,
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
  python3 "$REPO/docs/playtest/render-targeted-roster.py"

echo
echo "=== 3. Fan out — 5 parallel curls to tessera-playtest-scenario ==="
> "$OUT_DIR/trajs.txt"
for f in "$OUT_DIR/runs/"*.instruction.json; do
  R=$(curl -sS -X POST -H "Authorization: Bearer $JETTY_API_KEY" \
    -F "init_params=<$f" \
    "https://flows-api.jetty.io/api/v1/run/jettyio/tessera-playtest-scenario")
  TRAJ=$(echo "$R" | jq -r '.workflow_id // ""' | sed 's/.*--//')
  NAME=$(basename "$f" .instruction.json)
  echo "  $NAME -> $TRAJ"
  echo "$NAME=$TRAJ" >> "$OUT_DIR/trajs.txt"
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
