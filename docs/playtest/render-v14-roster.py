#!/usr/bin/env python3
"""Render the 5 v1.4 builder-UX-validation playbooks."""
from __future__ import annotations

import json
import os
import pathlib

URL = os.environ["TESSERA_URL"]
CODE = os.environ["CODE"]
HOST_TOKEN = os.environ["HOST_TOKEN"]
COMPLEXITY = int(os.environ.get("COMPLEXITY", "3"))
DURATION_MIN = int(os.environ.get("DURATION_MIN", "7"))
OUT = pathlib.Path(os.environ["OUT"])
OUT.mkdir(parents=True, exist_ok=True)


GM_BODY = f"""You are the FACILITATOR for a v1.4 validation run at {URL} (code: {CODE}).

Host token: {HOST_TOKEN}

The recent ship:
  - PR #80: Builder UX foundation rework + R1/R3/R5/R7/R8
  - PR #79: ResetPairsModal + harder/easier persists complexity
  - PR #78: Builder Distracted brief
  - PR #77: Brief library v4 (29 briefs, no complexity bands)
  - PR #76: GameEndedView survey aggregate
  - PR #75: Round survey + reset pairs + mutation palette fix
  - PR #74: Live testing + always-visible brief

Your job is to walk the GM-side flows that gate / surface the
builder-side validation. Step-by-step, mark PASS / FAIL / N/A.

## Setup
1. `npx --yes playwright install chromium`
2. Open ONE Playwright browser context.
3. Navigate to {URL}/host-recover/{CODE} → recover host session →
   land on /g/{CODE}/master.
4. Wait until 4 players show in the lobby (Avery, Bri, Cameron, Drew).

## Phase A — pair players, then exercise the styled reset modal

5. Pair manually:
   - Avery (builder) ↔ Bri (guider) → pair 0
   - Cameron (builder) ↔ Drew (guider) → pair 1

6. Click ↺ reset pairs in the PairsPanel header. A STYLED MODAL
   should open (NOT the browser's native confirm()). Verify:
   - Title reads "Reset all 2 pairs?" (or "1 pair" if you reset
     after wiping one).
   - Two CTAs: "Keep pairs" (cancel) + "↺ Reset all pairs" (red, destructive).
   - Esc closes the modal without firing the action.
   - Backdrop click also closes.

7. After Esc-closing, click ↺ reset pairs again → click "Reset all
   pairs" in the modal → verify all pair allocations wipe + the
   players return to the lobby. Then re-pair them as in step 5.

## Phase B — start round 1 + fire harder

8. Click 'Start round 1' (complexity {COMPLEXITY}).

9. Fire 'Make it harder' (▲) on pair 0. Pre-PR-#79 the round's
   complexity stayed at {COMPLEXITY} even though the goal was
   regenerated at {COMPLEXITY + 1} — the builder's tray palette
   would lag the goal's palette and pieces could appear unplaceable.
   Now: confirm the change is consistent.
   - Open pair 0's focused-pair canvas.
   - The pair_round goal pattern should regenerate at {COMPLEXITY + 1}.
   - Network: round.complexity should now be {COMPLEXITY + 1} (you
     can verify via the lobby snapshot).

10. Fire 'Requirement change' (✎) on pair 0 a few times. Each
    mutation should pick a colour from the round's CURRENT palette
    (post-harder) — you should not see colours from outside the
    palette appear in the goal. Capture any exceptions.

## Phase C — let the round play out + observe the survey aggregate

11. Wait for round 1 to expire (or click 'End round' if needed).

12. Click 'End game'. The GameEndedView should now include a
    "Reflection roundup · per round" card showing anonymised counts +
    averages from the survey responses (assuming the players filled
    them out — verified separately by the player agents).
    - If at least one player submitted a survey, the card renders.
    - If none did, the card hides (server-side filter).

## Phase D — terminology + brief library checks

13. The whole run, scan for any user-visible "Pair call" string. The
    correct term is "Breakout room" everywhere. Capture violations.

14. The brief library is now v4 (29 briefs total, no complexity
    bands). Pair 0's builder brief should come from the curated v4
    set — flag any titles you don't recognise from the v4 list.

## Reporting

Output a JSON object as the LAST thing on stdout. The 'experience.summary'
field should contain one PASS/FAIL/N/A per numbered step (5–14).

```json
{{
  "scenario_id": "v14-targeted-gm",
  "outcome": "passed | failed | partial",
  "duration_sec": 0,
  "role": "gm",
  "name": "Facilitator",
  "pair_idx": null,
  "phases_completed": ["A", "B", "C", "D"],
  "experience": {{"summary": "ONE-LINE PASS/FAIL PER STEP", "most_engaging_moment": "", "most_confusing_moment": "", "would_use_for_real": "", "what_to_change": ""}},
  "findings": [
    {{"severity": "blocker | major | minor | nit", "area": "gm", "category": "bug | ux-confusion | copy", "title": "...", "detail": "...", "url_or_route": "/g/{CODE}/master", "evidence": "..."}}
  ],
  "console_errors": [],
  "network_errors": []
}}
```
"""


def make_builder(name: str, pair_idx: int, lower: str) -> str:
    is_avery = name == "Avery"
    return f"""You are {name}, a BUILDER in pair {pair_idx} of a v1.4 validation run at {URL} (code: {CODE}).

PR #80 shipped a major builder UX rework. Your job is to validate the
single-target interaction model + R1/R3/R5/R7/R8 + the placement-loop
latency improvement. WALK THE FLOW LIKE A REAL PLAYER FIRST, THEN
REPORT.

## Setup
1. `npx --yes playwright install chromium`
2. Browser → {URL}/g/{CODE}/join. Display name = '{name}'. Save
   the recovery URL.

## Phase A — single-target model

3. After the GM starts round 1, you land on /play. Walk this:
   3a. The board is empty. Confirm the **R1 EMPTY HINT** is visible:
       a pulsing dashed orange "↖ start here" target on cell A1.
   3b. Click any empty cell (NOT A1 — try B2 or similar). The hint
       should disappear, and a **PHANTOM** appears at the clicked
       cell with the saved defaults. The dock chip (left side) reads
       "B2 · next piece" (or wherever you clicked).
   3c. Change the shape in the dock. The phantom on the canvas
       MUTATES IN PLACE (no commit yet, just the preview shifts).
   3d. Change the colour. Same — phantom updates in place.
   3e. Use the **R7 ROTATION RADIO** at the bottom of the dock —
       4 segments, each showing the tile rotated 0/90/180/270°.
       Click each segment; phantom rotation should match.
   3f. Click another empty cell. The first phantom COMMITS (you'll
       see the placed piece appear, possibly with a coloured wash).
       A new phantom arms at the new cell with the SAME defaults you
       just sculpted.

4. Click on a placed piece. It should enter EDIT MODE: the dock chip
   reads "X · this piece"; the dock controls now point at THAT
   piece's attributes. Change shape/colour/rotation in the dock —
   the piece mutates on the canvas.

5. Click an empty cell while editing. The piece MOVES to that cell
   (PATCH q,r). Capture if there's any visible flicker on move.

6. Click ⌫ Remove (or press Esc and re-enter edit mode). The piece
   disappears. Note any unwanted side-effects.

## Phase B — R3 wrong-because tooltip

7. Place ~5 pieces with intentionally wrong attributes — pick random
   shapes/colours/rotations. After each, the **CORRECTNESS WASH**
   should appear (red or green tint behind the tile) within ~1
   second of the click. Note the timing — does the wash + badge
   show up immediately on the temp piece, or wait for a noticeable
   delay?

8. Hover over a wrong (red-washed) piece. The **R3 WRONG TOOLTIP**
   should appear above the piece showing ✓/✕ for Shape, Colour,
   Rotation. Position should NEVER be flagged (would leak goal
   layout). Open dev console; if there's a console error here, this
   is a major issue.

9. Move your mouse off the wrong piece. Tooltip dismisses cleanly.

## Phase C — R5 rulers + R8 progress bar + latency feel

10. The **R5 RULERS** (A–E across the top, 1–N down the side) are
    always visible around the canvas. The current target's row +
    column should highlight. Confirm.

11. The **R8 PROGRESS BAR** above the canvas is tri-coloured:
    green for correct, red for wrong, gray for placed-but-pending.
    Confirm it ticks up as you place.

12. **PERCEIVED LATENCY** — fire 5 placements rapidly. Does the
    placement loop feel snappy? Specifically:
    - Click → temp piece appears: should be instant (<50ms).
    - Wash + badge under the temp: should appear within ~50–100ms
      after the click (PR #80 shipped server-side correctness on
      POST so the wash doesn't wait for the realtime broadcast).
    - Multi-piece flurry: are placements fluid or does anything
      hitch?

## Phase D — brief always-visible + survey

13. The brief panel on the right is always visible (no seal/minimize
    states). Confirm it stays open the entire round.

14. After round-end (GM ends it, or timer expires), the
    RoundEndedView should show a survey card with:
    - A slider asking who carried the communication (you ↔ partner)
    - A 4-way pick: me / partner / briefs / puzzle for "what made
      it harder"
    Fill it out + submit. {"Avery only" if is_avery else f"{name} just confirms the card appears + can be submitted"}.

## Reporting

```json
{{
  "scenario_id": "v14-targeted-builder-{lower}",
  "outcome": "passed | failed | partial",
  "duration_sec": 0,
  "role": "builder",
  "name": "{name}",
  "pair_idx": {pair_idx},
  "phases_completed": ["A", "B", "C", "D"],
  "experience": {{"summary": "ONE-LINE PASS/FAIL PER STEP (3a-14) + a sentence on latency feel", "most_engaging_moment": "", "most_confusing_moment": "", "would_use_for_real": "", "what_to_change": ""}},
  "findings": [],
  "console_errors": [],
  "network_errors": []
}}
```
"""


def make_guider(name: str, pair_idx: int, lower: str) -> str:
    return f"""You are {name}, a GUIDER in pair {pair_idx} of a v1.4 validation run at {URL} (code: {CODE}).

Your job is lighter — confirm the always-visible brief, the goal
correctness halos mirror as the builder places, and the round-end
survey card renders for you.

## Setup
1. `npx --yes playwright install chromium`
2. Browser → {URL}/g/{CODE}/join. Display name = '{name}'. Save
   the recovery URL.

## Phase A — always-visible brief
3. After round starts, your guider brief panel is on the right and
   ALWAYS VISIBLE. No seal, no minimize. Confirm it stays open the
   whole round. The brief title is from the v4 library (29 briefs;
   no complexity bands).

## Phase B — goal correctness mirroring
4. Watch the goal canvas as your builder places pieces. Each correct
   placement lights up a green halo + ✓ badge mirrored on your goal
   canvas. Wrong placements show red. Confirm the lights track the
   builder's actions in real time (within ~100ms of their click,
   thanks to the PR #72 fast-lane debounce).

## Phase C — round-end survey
5. After round-end, the survey card renders for you too (you're a
   builder/guider role; observers don't get it). Fill it out +
   submit. The card should collapse to a "Reflection saved" recap.

## Reporting

```json
{{
  "scenario_id": "v14-targeted-guider-{lower}",
  "outcome": "passed | failed | partial",
  "duration_sec": 0,
  "role": "guider",
  "name": "{name}",
  "pair_idx": {pair_idx},
  "phases_completed": ["A", "B", "C"],
  "experience": {{"summary": "ONE-LINE PASS/FAIL PER STEP (3-5)", "most_engaging_moment": "", "most_confusing_moment": "", "would_use_for_real": "", "what_to_change": ""}},
  "findings": [],
  "console_errors": [],
  "network_errors": []
}}
```
"""


ROSTER = [
    ("00-gm-facilitator", GM_BODY),
    ("01-builder-avery", make_builder("Avery", 0, "avery")),
    ("02-guider-bri", make_guider("Bri", 0, "bri")),
    ("03-builder-cameron", make_builder("Cameron", 1, "cameron")),
    ("04-guider-drew", make_guider("Drew", 1, "drew")),
]

for slug, body in ROSTER:
    p = OUT / f"{slug}.instruction.json"
    p.write_text(json.dumps({"instruction": body}))
    print(f"  wrote {p}  ({len(body)} chars)")
