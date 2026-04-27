#!/usr/bin/env python3
"""
Render 10 role-specific playtest instructions for run-orchestrator.sh.

Reads CODE / HOST_TOKEN / TESSERA_URL / COMPLEXITY / DURATION_MIN
/ ROUND_COUNT from the environment (with fallbacks), generates one
instruction string per role using the hard-coded roster, and writes
them as separate JSON payload files into
/tmp/orch-runs/<idx>-<role>-<name>.instruction.json ready to be
POSTed via `curl -F "init_params=<file"`.

Each role's playbook now exercises a richer slice of the application
than the v1 roster: super-powers, scoring tile, time extension,
multi-round, end-game leaderboard, and the player-recovery flow.

Usage:
    CODE=ABC-123 HOST_TOKEN=xxx python3 render-roster.py
"""
from __future__ import annotations

import json
import os
import pathlib
import sys

CODE = os.environ.get("CODE", "")
HOST_TOKEN = os.environ.get("HOST_TOKEN", "")
if not CODE and len(sys.argv) > 1:
    CODE = sys.argv[1]
TESSERA_URL = os.environ.get("TESSERA_URL", "https://tessera.schaffters.com")
COMPLEXITY = int(os.environ.get("COMPLEXITY", "5"))
DURATION_MIN = int(os.environ.get("DURATION_MIN", "8"))
ROUND_COUNT = int(os.environ.get("ROUND_COUNT", "2"))

if not CODE or not HOST_TOKEN:
    print("CODE and HOST_TOKEN env vars are required", file=sys.stderr)
    sys.exit(2)

ROSTER = [
    {"role": "gm", "name": "Facilitator", "pair_idx": None},
    {"role": "builder", "name": "Avery", "pair_idx": 0},
    {"role": "guider", "name": "Bri", "pair_idx": 0},
    {"role": "builder", "name": "Cameron", "pair_idx": 1},
    {"role": "guider", "name": "Drew", "pair_idx": 1},
    {"role": "builder", "name": "Ellis", "pair_idx": 2},
    {"role": "guider", "name": "Finley", "pair_idx": 2},
    {"role": "observer", "name": "Gray", "pair_idx": 0},
    {"role": "observer", "name": "Harper", "pair_idx": 1},
    {"role": "observer", "name": "Indigo", "pair_idx": 2},
]

# Activity targets per role. The roster doesn't dictate exact sequencing —
# the agent multiplexes its attention as time allows. Calls out specific
# UI surfaces to exercise, with explicit instructions to capture findings
# on each.

GM_PLAYBOOK = (
    "### GM playbook (Facilitator)\n\n"
    "**Phase A — claim host session + manual pairing**\n"
    "1. Navigate to {url}/host-recover/{code}; paste the host token in the form, submit. Land on /g/{code}/master.\n"
    "2. Wait until 9 players appear in the lobby panel.\n"
    "3. **Manually pair players by name** so each agent gets the role its playbook expects (auto-allocate is random, which has consistently broken the playtest by handing builder agents the guider role and vice versa). For each pair, in the Lobby sidebar:\n"
    "   a. Click the checkbox next to the two intended players to select them. The 'Pair selected · assign roles' button appears.\n"
    "   b. Click 'Pair selected · assign roles' — the 'Who builds?' picker opens with two buttons (one per selected player).\n"
    "   c. Click the player who should be the BUILDER. The pair is created.\n"
    "   d. Repeat for the other pairs.\n"
    "   Pairings: **Avery (builder) + Bri (guider) → pair 0**, **Cameron (builder) + Drew (guider) → pair 1**, **Ellis (builder) + Finley (guider) → pair 2**.\n"
    "4. **Manually assign observers**:\n"
    "   a. Click the Gray checkbox (single-select). The '👁 As observer to pair…' button appears.\n"
    "   b. Click it; the pair list opens. Click 'Avery ↔ Bri' to assign Gray to pair 0.\n"
    "   c. Repeat: Harper → pair 1 (Cameron ↔ Drew), Indigo → pair 2 (Ellis ↔ Finley).\n"
    "5. Open the AccelerantsRail's fullscreen modal (⤢ button top-right) and confirm all 10 super-powers render. Close it.\n"
    "6. **Tune scoring** in the rail's Scoring tile: bump per-correct +1 (10→11), then step the wrong-attempt penalty down twice (0 → -2). Verify each click updates the displayed value instantly (no flicker, no rollback).\n\n"
    "**Phase B — run round 1**\n"
    "7. Set complexity to {complexity}, duration to {duration_min} minutes (free-text), click Start round 1.\n"
    "8. While round 1 runs, fire these super-powers at staggered moments (use the segmented control to switch between 'this pair' and 'All pairs'):\n"
    "   - At ~30s into the round: focus pair 0, fire **Reveal briefs**.\n"
    "   - At ~75s: focus pair 1, fire **Prototype unlock** (5s glimpse).\n"
    "   - At ~120s: scope=all, fire **Agile share** so each guider gets a snapshot.\n"
    "   - At ~180s: focus pair 2, fire **Change builder brief**, observe brief swap.\n"
    "   - At ~240s: scope=all, fire **Time pressure** (subtracts 3 min). Watch the timer turn red + jiggle.\n"
    "9. Click +1m on the round timer (extends round). Confirm the timer adds 60s correctly.\n"
    "10. As round 1 wraps, observe the leaderboard chip + per-pair score updates.\n\n"
    "**Phase C — round 2 transition**\n"
    "11. After round 1 ends, the dashboard should show round controls for round 2 (or 'all rounds done' if {round_count}=1). Verify which copy renders.\n"
    "12. {round_2_action}\n\n"
    "**Phase D — end game + debrief**\n"
    "13. Click 'End game' (or use the 'all rounds done' CTA). Confirm GameEndedView renders with debrief prompts + per-pair leaderboard sorted by total score.\n"
    "14. Capture the leaderboard order; note any pair names visible.\n\n"
    "Findings to capture: dashboard responsiveness with 9 active sockets, scoring tile click-feel (instant or laggy?), AccelerantsRail fullscreen modal UX, super-power broadcast latency to player tabs (best-effort estimate), time-extension click feel, round 1→2 transition clarity, leaderboard ordering correctness, debrief prompt copy."
)

BUILDER_PLAYBOOK = (
    "### Builder playbook (name: {name}, pair {pair_idx})\n\n"
    "**Phase A — join + save recovery**\n"
    "1. Navigate to {url}/g/{code}/join. Display name = '{name}'. Submit.\n"
    "2. **CRITICAL**: a 'Save your recovery URL' modal should appear. Click 'copy' (verify clipboard write); copy the URL into your scratch notes. Click 'Got it · take me to the game'.\n"
    "3. Land on /g/{code}/play. Note `joined_at` timestamp.\n\n"
    "**Phase B — round 1 builder loop**\n"
    "4. Wait for the GM to start round 1.\n"
    "5. The brief envelope should pulse with attention animation. Verify: animation runs ~5 cycles then stops (not infinite).\n"
    "6. Tap the sealed envelope to open the brief. Read it. The gate overlay should drop.\n"
    "7. **Pair-name nudge**: a 'name your pair' modal may appear. Click 'skip for now' (or accept the random suggestion).\n"
    "8. Place ~10–14 pieces using a mix of shapes (sq, tri-up, rhomb, trap) and colors. Sample latency on 5 placements (click→visible).\n"
    "9. **Test 'Share progress' button**: with at least one piece placed, click 'Share progress with guider · 3 left'. Verify counter decrements to 2. Then place no more pieces and click again — verify it works (counter→1).\n"
    "10. **Edit mode**: click an existing piece (in Edit mode), use the rotate ↻ button, then move it to an adjacent empty cell.\n"
    "11. **Test solution** twice — once early (after ~5 placements), once near round end. Capture the celebratory animation + score change.\n"
    "12. **Brief minimise**: tap the `−` button on your brief. Verify it collapses to just the seal circle. Verify the pair-name modal does NOT pop again. Click the seal circle to re-expand.\n"
    "13. **Clear all** mid-round: tap 'Clear all' once, observe arming, tap again. Confirm canvas wipes. Place a few new pieces.\n"
    "14. If your guider triggered a 'Reveal briefs' super-power, observe their brief now visible to you.\n"
    "15. If your GM fired 'Change builder brief', observe the brief swap in your envelope (gate may re-arm).\n\n"
    "**Phase C — recovery flow test (one builder per pair only — Avery)**\n"
    "16. {recovery_test}\n\n"
    "**Phase D — round 2 (if applicable)**\n"
    "17. After round 1 ends, observe RoundEndedView. Wait for the GM to start round 2.\n"
    "18. Round 2: place ~5 pieces, hit Test solution once. Then end naturally.\n\n"
    "**Phase E — game end**\n"
    "19. Observe the final GameEndedView leaderboard. Note your pair's rank.\n\n"
    "Findings: place-piece responsiveness (any visible stutter? optimistic→server gap?), test-solution feedback clarity, brief envelope dismissal flow, pair-name nudge UX (does it pop on close vs minimize?), Clear-all confirm safety, recovery-URL flow if you tested it, score going negative if penalty bit, round 2 transition feel."
)

GUIDER_PLAYBOOK = (
    "### Guider playbook (name: {name}, pair {pair_idx})\n\n"
    "**Phase A — join + save recovery**\n"
    "1. Navigate to {url}/g/{code}/join. Name = '{name}'. Submit.\n"
    "2. The 'Save your recovery URL' modal should appear. Click copy, then 'Got it'.\n"
    "3. Land on /play. Wait for round start.\n\n"
    "**Phase B — round 1 guider loop**\n"
    "4. Tap your sealed brief (seal animation should stop after ~5 cycles). Read the brief.\n"
    "5. Observe the goal canvas pattern — note readability at complexity {complexity}.\n"
    "6. **Rename the pair**: click the PairNameBadge (yellow when unnamed). Set to '{pair_name_suggestion}'. **CRITICAL**: verify the badge updates IMMEDIATELY in your tab (no waiting for refetch). Before this fix, the first save returned 200 but the badge stayed stale.\n"
    "7. **Brief minimise**: tap the `−` button. Verify the brief collapses to just the seal circle and stays out of the canvas. Click the seal to re-expand.\n"
    "8. **Brief re-seal**: tap the `×` button. Verify it goes back to the sealed state.\n"
    "9. If your GM fires 'Agile share', observe the 'Builder shared progress' panel appear in the bottom-right. Click it; verify full-screen modal opens. Press Esc; verify it closes.\n"
    "10. If your GM fires 'Change guider brief', observe your envelope re-arming (gate overlay returns).\n\n"
    "**Phase C — round 2 (if applicable)**\n"
    "11. After round 1 ends, observe RoundEndedView. Compare your goal pattern to the builder's final placements (if visible).\n"
    "12. Round 2 starts: open new brief, observe new goal.\n\n"
    "**Phase D — game end**\n"
    "13. Observe GameEndedView + leaderboard. Note your pair's rank.\n\n"
    "Findings: goal canvas readability at complexity {complexity}, brief minimise/seal flow (does the brief overlay the goal canvas? if so, FLAG), pair-rename instant-update (was a known bug), super-power notifications visibility, round 2 transition."
)

OBSERVER_PLAYBOOK = (
    "### Observer playbook (name: {name}, pair {pair_idx})\n\n"
    "**Phase A — join + save recovery**\n"
    "1. Navigate to {url}/g/{code}/join. Name = '{name}'. Submit.\n"
    "2. Save the recovery URL via the post-join modal.\n"
    "3. Wait for the GM to assign you to a pair as observer.\n\n"
    "**Phase B — observe round 1**\n"
    "4. Confirm side-by-side builder + goal canvas layout renders within ~3s of round start. Time it.\n"
    "5. Watch the builder canvas update in (near-)realtime as pieces are placed. Capture latency from 'piece placed' (you can't see exactly when, but estimate from rate of change).\n"
    "6. **Switch pairs**: if `available_pairs` shows other pairs, click a different pair from the bottom strip. Verify the layout updates to the new pair. **CRITICAL**: switch back to your originally-assigned pair (pair {pair_idx}) before phase C. Observer self-switching mutates `participants.pair_id` — the GM dashboard will read whatever pair you last selected as your 'home', which surfaces as cross-pair drift in the lobby sidebar if you forget to switch back.\n"
    "7. When a super-power fires (e.g. Reveal briefs, Prototype unlock), observe whether the observer view reflects it.\n"
    "8. Read both pair-side briefs if revealed.\n"
    "9. **Test view scaling**: try resizing the browser to a narrower width (1024px) — does the layout adapt or break?\n\n"
    "**Phase C — round 2 + game end**\n"
    "10. Observe round transitions. After game ends, see the leaderboard.\n\n"
    "Findings: observer view scaling at complexity {complexity}, pair-switcher UX (or absence — if available_pairs is null AND you were assigned observer, that's a bug), missing affordances (does observer have any agency or are they purely passive?), realtime updates lag from builder activity, layout breakage on narrow viewports."
)

PLAYBOOK = {
    "gm": GM_PLAYBOOK,
    "builder": BUILDER_PLAYBOOK,
    "guider": GUIDER_PLAYBOOK,
    "observer": OBSERVER_PLAYBOOK,
}

# Per-role conditional snippets
recovery_test_avery = (
    "**You are Avery — the recovery flow test runner.** After ~3 minutes of normal play and ~5 placements, simulate a session loss:\n"
    "    a. Open browser devtools → Application → Cookies → delete the `ts_{code}` cookie for this origin.\n"
    "    b. Refresh the /play page. Confirm the page shows a 'session lost' banner with a CTA back to /join (or auto-redirects).\n"
    "    c. Paste the recovery URL you copied at join (Phase A step 2) into the address bar. Confirm /recover/{code}?p=<id>#<token> auto-recovers and lands you back on /play with the SAME role + pair assignment.\n"
    "    d. Verify your previous placements are still on the canvas."
).format(code=CODE)

recovery_test_other = (
    "Skip the recovery test (only Avery runs that flow per round)."
)

round_2_action_multi = (
    "Set complexity for round 2 (try {complexity_plus} for harder), then click 'Start round 2'."
).format(complexity_plus=min(COMPLEXITY + 1, 8))

# Per-pair name suggestion so the leaderboard ends up with three
# distinguishable team names instead of three "The Pelicans". Surfaces
# the per-pair display_name plumbing on the GameEndedView.
PAIR_NAME_SUGGESTIONS = {
    0: "The Pelicans",
    1: "The Foxes",
    2: "The Otters",
}

round_2_action_single = (
    "(round_count=1, so no round 2 — observe that the start button is hidden / replaced with End game)"
)

out_dir = pathlib.Path("/tmp/orch-runs")
out_dir.mkdir(exist_ok=True)
for f in out_dir.glob("*.json"):
    f.unlink()

for i, entry in enumerate(ROSTER):
    role = entry["role"]
    pair_idx_str = "null" if entry["pair_idx"] is None else str(entry["pair_idx"])
    name_slug = entry["name"].lower().replace(" ", "-")

    # Resolve role-specific conditionals.
    fmt_args = dict(
        url=TESSERA_URL,
        code=CODE,
        name=entry["name"],
        pair_idx=entry["pair_idx"],
        complexity=COMPLEXITY,
        duration_min=DURATION_MIN,
        round_count=ROUND_COUNT,
        round_2_action=(
            round_2_action_multi if ROUND_COUNT > 1 else round_2_action_single
        ),
        recovery_test=(
            recovery_test_avery if entry["name"] == "Avery" else recovery_test_other
        ),
        pair_name_suggestion=PAIR_NAME_SUGGESTIONS.get(
            entry["pair_idx"], "The Crew"
        ),
    )
    body = PLAYBOOK[role].format(**fmt_args)

    setup = (
        f"You are playing one role in a live Tessera workshop running at {TESSERA_URL} (code: {CODE}).\n\n"
        f"Your role: {role}\n"
        f"Your display name: {entry['name']}\n"
        f"Pair index: {pair_idx_str}\n"
        f"Host token (only used if role == gm): {HOST_TOKEN}\n"
        f"Round count: {ROUND_COUNT}\n"
        f"Round duration: {DURATION_MIN} min\n"
        f"Complexity: {COMPLEXITY}\n\n"
        "## Setup\n"
        "1. `npx --yes playwright install chromium` (the prism-playwright snapshot is missing the binary).\n"
        "2. Open ONE Playwright browser context.\n"
        "3. Note wall-clock time when you start (joined_at).\n\n"
    )

    output_schema = (
        "\n## Final output (stdout JSON)\n\n"
        "The LAST thing you print MUST be a single JSON object matching this schema. Anything else (narrative, scratch) goes ABOVE it.\n\n"
        "```json\n"
        "{\n"
        f'  "scenario_id": "orchestrator-{role}-{name_slug}",\n'
        '  "outcome": "passed | failed | partial",\n'
        '  "duration_sec": 0,\n'
        f'  "role": "{role}",\n'
        f'  "name": "{entry["name"]}",\n'
        f'  "pair_idx": {pair_idx_str},\n'
        '  "phases_completed": ["A", "B", "C", "D"],\n'
        '  "findings": [\n'
        '    {"severity": "blocker | major | minor | nit", "area": "' + role + '", "category": "bug | ux-confusion | slowness | copy | accessibility | visual | performance", "title": "...", "detail": "...", "url_or_route": "/g/' + CODE + '/play", "evidence": "..."}\n'
        "  ],\n"
        '  "console_errors": [],\n'
        '  "network_errors": []\n'
        "}\n"
        "```\n\n"
        "Track which phases you completed in `phases_completed` (A/B/C/D/E as listed in your playbook). If you bail mid-phase, set `outcome: \"partial\"` and explain why in a finding."
    )

    full = (
        setup
        + body
        + "\n\n## Universal observations\n"
        "Note console errors, network errors, and general UX surprises (confusing copy, missing affordances, rough transitions, slow API calls > 1s, animations that block interaction, layout breakage). If something looks BROKEN (a button does nothing, a modal won't dismiss, a value won't save) record a `blocker` or `major` — those are what we ship for.\n"
        + output_schema
    )

    p = out_dir / f"{i:02d}-{role}-{name_slug}.instruction.json"
    p.write_text(json.dumps({"instruction": full}))
    print(f"  {i:02d} {role:9} {entry['name']:12} pair={pair_idx_str}  {len(full)} chars  -> {p.name}")

print(f"\nWrote {len(ROSTER)} instruction files to {out_dir}/")
