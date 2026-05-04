#!/usr/bin/env python3
"""Render the 5 friction-attribution-survey QA playbooks (PR #96)."""
from __future__ import annotations

import json
import os
import pathlib

URL = os.environ["TESSERA_URL"]
CODE = os.environ["CODE"]
HOST_TOKEN = os.environ["HOST_TOKEN"]
COMPLEXITY = int(os.environ.get("COMPLEXITY", "3"))
DURATION_MIN = int(os.environ.get("DURATION_MIN", "3"))
OUT = pathlib.Path(os.environ["OUT"])
OUT.mkdir(parents=True, exist_ok=True)


GM_BODY = f"""You are the FACILITATOR validating PR #96 — the new
GM-triggered friction-attribution reflection survey.

Setup: 2-pair game at {URL} (code: {CODE}). Host token: {HOST_TOKEN}.

What's new + what we're checking:
  - When the GM clicks "End round", a styled modal opens asking
    whether to ask players a quick reflection survey before the
    debrief (Cancel / End round / End + ask reflection).
  - The "End + ask reflection" CTA only renders when there are at
    least 2 pairs in the room. (Solo-pair rooms shouldn't see it.)
  - Picking "End + ask reflection" flips
    `rounds.reflection_survey_requested` so the player tabs mount
    a slider survey on /play. Picking "End round" skips the
    survey entirely.
  - Auto timer expiry should NEVER pop the modal — it ends the
    round directly, no survey.
  - At game-end, the debrief view renders a "Where did the
    friction land?" card with a stacked self/partner/system bar
    per round + an "asymmetry" callout when the builder vs guider
    average diverges by 15+ points on any axis.

You are walking the GM-side flows. Step-by-step, mark PASS/FAIL/N/A.

## Setup
1. `npx --yes playwright install chromium`
2. Open ONE Playwright browser context.
3. Navigate to {URL}/host-recover/{CODE} → recover host session →
   land on /g/{CODE}/master.
4. Wait until 4 players show in the lobby (Avery, Bri, Cameron, Drew).

## Phase A — pair + start round 1

5. Pair manually:
   - Avery (builder) ↔ Bri (guider) → pair 0
   - Cameron (builder) ↔ Drew (guider) → pair 1

6. Click 'Start round 1' (complexity {COMPLEXITY}, ~{DURATION_MIN} min).
   Wait ~5 seconds for the round to settle.

## Phase B — End round 1 + ask reflection

7. Click 'End round'. The new EndRoundModal should open. Verify:
   - Three buttons: "Cancel", "End round" (gray), "End + ask
     reflection" (blue).
   - Body copy mentions splitting friction across self / partner
     / system.
   - Esc closes the modal without firing anything.

8. Click 'End + ask reflection'. The round should end and the
   master view should transition to the round-ended debrief area
   (per-pair recap or the like). The lobby/round status should
   show ended.

## Phase C — give the players ~30s to fill the survey

9. Wait ~30 seconds. The player agents are running their own
   playbooks; they'll submit their slider answers in this window.
   Don't click anything during this wait.

## Phase D — Start round 2 + skip the survey

10. Click 'Start round 2'. Wait ~5 seconds for it to land.
11. Click 'End round'. The modal opens again. This time click
    "End round" (the gray one — skip the survey).
12. The round should end without surfacing the survey card on
    either player tab. Confirm this is the expected behaviour
    (no survey card means PASS — the GM's choice was honoured).

## Phase E — End game + check the friction-aggregate card

13. Click 'End game'. Confirm the EndGameModal. Confirm again.
14. The dashboard should transition to the game-ended summary.
    Look for a card titled "Where did the friction land?".
    Verify:
    - At least round 1 shows a stacked bar (orange/blue/purple
      for self/partner/system).
    - Round 2 should NOT appear in the friction card (no
      survey was asked).
    - If the role-deltas are >= 15 points on any axis, an
      "asymmetry" callout appears beneath the bar with copy
      like "Builders rated themselves 70%; guiders rated them
      10%; 60-point gap. Worth a check."
    - If <4 responses landed in round 1 (e.g. one player tab
      bailed), the card should be EMPTY for that round
      (suppression floor).

## Phase F — UI hygiene check

15. Scan the GM dashboard for any user-visible reference to
    "what made it harder" or the old 4-way pick. The v1 strings
    should be gone everywhere — flag any survivors.

16. Check that the timer chip went through warning (≤2 min) →
    urgent (≤30s) → critical (≤10s) phases over the course of
    rounds 1 and 2 (visible escalation in colour + jiggle).

## Reporting

Output a JSON object as the LAST thing on stdout. The 'experience.summary'
field should contain one PASS/FAIL/N/A per numbered step (5–16).

```json
{{
  "scenario_id": "tl2-attribution-gm",
  "outcome": "passed | failed | partial",
  "duration_sec": 0,
  "role": "gm",
  "name": "Facilitator",
  "pair_idx": null,
  "phases_completed": ["A", "B", "C", "D", "E", "F"],
  "experience": {{"summary": "ONE-LINE PASS/FAIL PER STEP (5-16)", "most_engaging_moment": "", "most_confusing_moment": "", "would_use_for_real": "", "what_to_change": ""}},
  "findings": [
    {{"severity": "blocker | major | minor | nit", "area": "gm", "category": "bug | ux-confusion | copy", "title": "...", "detail": "...", "url_or_route": "/g/{CODE}/master", "evidence": "..."}}
  ],
  "console_errors": [],
  "network_errors": []
}}
```
"""


def make_player(name: str, pair_idx: int, role: str, lower: str) -> str:
    is_builder = role == "builder"
    role_label = "BUILDER" if is_builder else "GUIDER"
    role_specifics_a = (
        "Place 4-5 pieces with intentionally mixed correctness — try a couple of correct ones (matching the goal halos that pop on the guider) and a couple wrong shapes/colours/rotations. The point is to make the round feel like a real interaction, not to score perfectly."
        if is_builder
        else "Watch your goal canvas and verbally describe the picture (in your head — no audio actually flows). The builder will be placing pieces; you'll see green/red halos as they land."
    )
    return f"""You are {name}, a {role_label} in pair {pair_idx} of the
PR #96 friction-attribution-survey QA run at {URL} (code: {CODE}).

What you're validating:
  - The round ends, and a few seconds later your /play tab
    surfaces the new RoundSurvey card.
  - The card asks two questions: a "who carried the
    communication" slider (1 horizontal slider) AND a new
    forced-choice attribution split asking where the friction
    landed across THREE sliders (on you / on partner / on the
    game). The three sliders auto-rebalance so they always sum
    to 100. Submit is gated on the sum equalling 100.
  - After you submit, the card collapses to a "✓ Reflection
    saved" recap that shows your answers.
  - On round 2 the GM picks "End round" (no survey). The card
    should NOT appear on round 2.

## Setup
1. `npx --yes playwright install chromium`
2. Browser → {URL}/g/{CODE}/join. Display name = '{name}'. Save
   the recovery URL.

## Phase A — round 1 play

3. Wait for the GM to start round 1. You'll land on /play.
4. {role_specifics_a}

## Phase B — round 1 reflection survey

5. The GM will end round 1 and pick "End + ask reflection". A
   /play card should mount titled something like "Quick reflection
   · two questions". Verify:
   - First question: "Who carried the communication?" with a
     0..100 slider, anchors say "{name} did most" / "shared" /
     "your partner did most".
   - Second question: "Where did the friction land?" with three
     sliders (On {name} / On your partner / On the game). Each
     shows a percentage. Sub-counter shows "X / 100".

6. Move the FIRST slider on the friction question (On {name})
   from its default to {"70" if pair_idx == 0 and is_builder else "20" if pair_idx == 0 else "30"}%. Confirm the other two
   sliders auto-rebalanced and the sum-to-100 indicator stayed
   at "100 / 100" (green).

7. Move the SECOND slider (On your partner) to
   {"15" if pair_idx == 0 and is_builder else "55" if pair_idx == 0 else "40"}%.
   Confirm rebalance + sum stayed at 100.

8. The third slider (On the game) should be whatever's left.
   Don't touch it. Click 'Save reflection →'.

9. The card should collapse to a green "✓ Reflection saved"
   recap with your three percentages echoed back. The recap
   should NOT show the v1 4-way pick text ("me / partner /
   briefs / puzzle") — flag any survivor.

## Phase C — round 2 plays (no survey)

10. Wait for the GM to start round 2 and let it run for a bit.
    Place a couple of pieces (or just sit on the canvas for the
    guider).

11. The GM will end round 2 with "End round" (no survey). Your
    /play tab should transition to the round-ended view but NOT
    mount the reflection card. Confirm: no slider, no "Quick
    reflection" header.

## Phase D — game-end debrief

12. After the GM ends the game, your tab should transition to
    the GameEndedView. Scan it for:
    - A card titled "Where did the friction land?" (only
      visible if at least 4 v2 responses landed across the
      room).
    - Round 1 entry with a stacked self/partner/system bar.
    - Round 2 should NOT appear (no survey was asked).
    - No mention of "what made it harder" or the v1 4-way
      copy anywhere.

## Reporting

```json
{{
  "scenario_id": "tl2-attribution-{lower}",
  "outcome": "passed | failed | partial",
  "duration_sec": 0,
  "role": "{role}",
  "name": "{name}",
  "pair_idx": {pair_idx},
  "phases_completed": ["A", "B", "C", "D"],
  "experience": {{"summary": "ONE-LINE PASS/FAIL PER STEP (3-12) + a sentence on slider rebalance feel", "most_engaging_moment": "", "most_confusing_moment": "", "would_use_for_real": "", "what_to_change": ""}},
  "findings": [],
  "console_errors": [],
  "network_errors": []
}}
```
"""


ROSTER = [
    ("00-gm-facilitator", GM_BODY),
    ("01-builder-avery", make_player("Avery", 0, "builder", "avery")),
    ("02-guider-bri", make_player("Bri", 0, "guider", "bri")),
    ("03-builder-cameron", make_player("Cameron", 1, "builder", "cameron")),
    ("04-guider-drew", make_player("Drew", 1, "guider", "drew")),
]

for slug, body in ROSTER:
    p = OUT / f"{slug}.instruction.json"
    p.write_text(json.dumps({"instruction": body}))
    print(f"  wrote {p}  ({len(body)} chars)")
