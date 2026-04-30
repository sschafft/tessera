#!/usr/bin/env python3
"""Render the v1.2 GM-only targeted regression playbook."""
from __future__ import annotations

import json
import os
import pathlib

URL = os.environ["TESSERA_URL"]
CODE = os.environ["CODE"]
HOST_TOKEN = os.environ["HOST_TOKEN"]
COMPLEXITY = int(os.environ.get("COMPLEXITY", "5"))
OUT = pathlib.Path(os.environ["OUT"])
OUT.mkdir(parents=True, exist_ok=True)


GM_BODY = f"""You are the FACILITATOR running a Tessera workshop at {URL} (code: {CODE}).

Host token: {HOST_TOKEN}

This is a TARGETED REGRESSION RUN focused on the v1.2 surfaces shipped
2026-04-30 (PR #68). Walk the items in order and report PASS / FAIL /
N/A for each step in the JSON output.

## Setup
1. `npx --yes playwright install chromium`
2. Open ONE Playwright browser context (Chromium).
3. Navigate to {URL}/host-recover/{CODE} — recover host session, land
   on /g/{CODE}/master.
4. Self-seat 4 player tabs in this same browser context (open 4 new
   tabs, navigate each to {URL}/g/{CODE}/join, submit names: Avery,
   Bri, Cameron, Drew). Return to the master tab.

## Phase A — Pair management rail labels + ⛶ expand

5. Look at the pair sidebar header. There should be NO text reading
   "Pair call" or "Pair calls" anywhere. The breakouts strip header
   reads "Breakout rooms · Jitsi" once pairs are minted.

6. Pair manually:
   - Avery (builder) ↔ Bri (guider) → pair 0
   - Cameron (builder) ↔ Drew (guider) → pair 1

7. Locate the ⛶ button at the top-right of the pair sidebar header.
   Click it. A FULLSCREEN MODAL should open with:
   - Title "Roster · 5 players" (4 + the GM facilitator).
   - Search input (placeholder "Search by name, team name, or partner…").
   - Table with columns: Name, Role, Team, Partner / observing, Actions.
   - Two rows for Avery + Bri pointing at each other; two rows for
     Cameron + Drew pointing at each other; one Facilitator row in
     lobby.
   - "⇄ Swap all pairs" CTA above the table (pre-round, 2 pairs).

8. In the search input, type "Avery". The table filters to just
   Avery's row. Clear the search; the full table returns.

9. Click "× Close" or hit Esc. The modal closes; you're back on the
   sidebar.

## Phase B — ⇄ Swap all pairs (pre-round)

10. Locate the ⇄ swap-all pill on the pair sidebar header. Click it.
    Confirm:
    - Network: POST /api/games/{CODE}/pairs/swap-all returns 200.
    - Both pairs flip: Avery is now the GUIDER, Bri the BUILDER for
      pair 0; same flip for Cameron ↔ Drew on pair 1.
    - Realtime: a single 'lobby_changed' event publishes (one refetch,
      not N).

11. Click ⇄ swap-all AGAIN to flip them back to the original assignment.

## Phase C — Pair-name modal (random + 🎲 again)

12. Open the focused-pair canvas for pair 0 (click pair 0 in sidebar).
    Locate the pair-name badge — a yellow pill labeled "name your
    pair" with the default builder ↔ guider text. Click it.

13. A MODAL should pop up (NOT an inline edit form) with:
    - Title "Name your pair · What should we call you two?"
    - An input pre-filled with a random "The Adjective Noun" (e.g.
      "The Cosmic Pelicans").
    - A "🎲 again" button next to the input.
    - A "skip for now" link + "Save name →" primary button.

14. Click "🎲 again" 2-3 times — confirm the input value changes each
    time to a new random suggestion.

15. Click "Save name →". The modal closes; the pair-name badge now
    shows the saved name.

## Phase D — Start round + verify mid-round gating

16. Click 'Start round 1'. Once the round is running:

17. Look at the pair sidebar — the ⇄ swap pill on each pair row should
    HIDE (not be disabled, not error on click — the prop just stops
    rendering it). The ⇄ swap-all pill on the header should also hide.

18. Click ⛶ to open the fullscreen modal mid-round. Confirm:
    - Title still says "Roster · 5 players".
    - The swap-all CTA above the table is HIDDEN (canSwapAll is
      false during a round).
    - Per-row "⇄ swap pair" buttons in the Actions column are HIDDEN.

19. Close the modal.

## Phase E — Grid render (clipping fix)

20. With the round running, focus pair 0 (or any pair). Look at the
    builder canvas + guider canvas. The grid should render as a
    CLOSED rectangle — top, right, bottom, AND left edges all visible.
    There should be NO appearance of the rightmost column "extending
    past" the card edge or the bottom row "running off" the canvas.
    This was a bug in v1.1 (CanvasGridBg pattern only emitted top +
    left) and v1.2 added an explicit closing rect.

## Phase F — Pre-built game upload affordance

21. Open a NEW BROWSER TAB (still in the same Playwright context).
    Navigate to {URL}/. On the Host tab, scroll to the bottom of the
    Create-game form. You should see a SECONDARY CTA next to the
    primary "Create game · get code →" button:
    `⬆ upload pre-built game (CSV)`

22. Click it. A modal opens titled "Pre-built game — Upload a roster
    CSV." with:
    - A description blurb.
    - A "⬇ Download CSV template" link (test that it triggers a
      download, then close the download tab).
    - Workshop name input, complexity input, briefs checkboxes.
    - File picker accepting .csv only.
    - "Cancel" + "Create game from CSV →" buttons.

23. Close the modal without submitting.

## Reporting

Output a single JSON object as the LAST thing on stdout matching this
schema. The 'experience' block should be empty strings — this is QA.
In 'experience.summary', list one PASS/FAIL/N/A line per numbered step
(5–23).

```json
{{
  "scenario_id": "v12-targeted-gm",
  "outcome": "passed | failed | partial",
  "duration_sec": 0,
  "role": "gm",
  "name": "Facilitator",
  "pair_idx": null,
  "phases_completed": ["A", "B", "C", "D", "E", "F"],
  "experience": {{"summary": "ONE-LINE PASS/FAIL PER STEP HERE", "most_engaging_moment": "", "most_confusing_moment": "", "would_use_for_real": "", "what_to_change": ""}},
  "findings": [
    {{"severity": "blocker | major | minor | nit", "area": "gm", "category": "bug | ux-confusion | copy", "title": "...", "detail": "...", "url_or_route": "/g/{CODE}/master", "evidence": "..."}}
  ],
  "console_errors": [],
  "network_errors": []
}}
```
"""

p = OUT / "00-gm-v12.instruction.json"
p.write_text(json.dumps({"instruction": GM_BODY}))
print(f"  wrote {p} ({len(GM_BODY)} chars)")
