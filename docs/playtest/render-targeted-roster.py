#!/usr/bin/env python3
"""Render the 5 targeted-run playbooks (swap-roles + add-briefs)."""
from __future__ import annotations

import json
import os
import pathlib

URL = os.environ["TESSERA_URL"]
CODE = os.environ["CODE"]
HOST_TOKEN = os.environ["HOST_TOKEN"]
COMPLEXITY = int(os.environ.get("COMPLEXITY", "4"))
DURATION_MIN = int(os.environ.get("DURATION_MIN", "6"))
OUT = pathlib.Path(os.environ["OUT"])
OUT.mkdir(parents=True, exist_ok=True)


GM_BODY = f"""You are the FACILITATOR running a Tessera workshop at {URL} (code: {CODE}).

Host token: {HOST_TOKEN}

This is a TARGETED REGRESSION RUN focused on TWO specific surfaces shipped in the latest deploy:

  (A) Pre-round ⇄ swap button on each pair row — flips builder ↔ guider before any round starts; refused or hidden once a round is running.

  (B) Briefs were OFF at game create. When you fire 'Change builder brief' / 'Change guider brief' mid-round, the super-power doubles as 'Add brief' — flips builder_brief_on / guider_brief_on to true AND seeds a fresh brief on the round so the affected pair sees a NEW envelope. Subsequent rounds also generate briefs for that side.

## Setup
1. `npx --yes playwright install chromium`
2. Open ONE Playwright browser context (Chromium).
3. Navigate to {URL}/host-recover/{CODE} — recover host session, land on /g/{CODE}/master.
4. Wait until 4 players show in the lobby (Avery, Bri, Cameron, Drew).

## Phase A — pair, then exercise SWAP-ROLES (the new button)

5. Pair manually:
   - Avery (intended builder) ↔ Bri (intended guider) → pair 0
   - Cameron (intended builder) ↔ Drew (intended guider) → pair 1
   For each pair: click both names → 'Pair selected · assign roles' → click intended builder.

6. CRITICAL — DO NOT SKIP. Exercise the new ⇄ swap button on pair 0 (twice). This is the primary regression target of this run; failing to do this fails the run. The button is a small ⇄ swap pill in the PairsPanel pair row, between the builder name label and the guider name label, in the row footer. It only shows when no round is running.

   6a. First swap (Avery -> guider, Bri -> builder): Locate the ⇄ swap pill on pair 0's row. Click it. Confirm:
       - Network: POST /api/games/{CODE}/pairs/<pair0_id>/swap-roles returns 200.
       - DOM: The row's name labels swap. Avery is now on the guider side; Bri is now on the builder side.
       - Realtime: a 'lobby_changed' event publishes (player tabs reflect the swap).
   6b. Second swap (back to original): Click ⇄ swap on pair 0 AGAIN. Confirm Avery is back on builder, Bri back on guider.
   6c. If you cannot find the ⇄ swap pill: report this as a bug and capture a screenshot. Do not proceed past step 6 without exercising it.

7. Leave pair 0 in original assignment (Avery=builder, Bri=guider) for Phase B.

## Phase B — start round 1 + verify swap is gated mid-round

8. Click 'Start round 1'. (Complexity {COMPLEXITY}, duration {DURATION_MIN} min.)

9. Check the swap button while a round is running. Look at pair 0's row in PairsPanel during the running round:
   - Either the ⇄ swap pill should hide entirely, OR
   - It should be visible but disabled, OR
   - Clicking it should show a toast/error like 'round is running'.
   Whichever path the UI takes, capture it. Try clicking it; if a network call fires, expect a 409 with error='round_running'. If clicking does nothing visible, that's also acceptable (button gate). DO NOT report this as a bug — capture which gating mechanism the UI used.

## Phase C — add briefs MID-ROUND (the second feature path)

10. Confirm initial state for pair 0: open the focused-pair canvas (click pair 0 in PairsPanel sidebar). The brief envelope on each side should NOT exist yet (game was created with briefs off; no brief was seeded at round start).

11. Fire 'Change builder brief' on pair 0. This is in the super-powers rail; if it's not in the inline 5, click 'More super-powers' and find it.
    - Confirm POST /api/games/{CODE}/superpowers returns 200.
    - In the focused-pair canvas, the BUILDER side should now show a sealed brief envelope WITHIN ~2 SECONDS of the click. Capture exact lag.
    - If the envelope does not appear within 5 seconds: this is a BUG (severity: major). Capture as a finding.

12. Fire 'Change guider brief' on pair 0. Same expectations — the GUIDER side should now show a sealed brief envelope within ~2s.

13. Fire 'Change builder brief' AGAIN on pair 0. Now there's already a brief — this should re-roll it. Capture whether the experience reads as 'changed' vs 'added' given the same button label.

14. Pair 1 should still be brief-less. Click pair 1 in the sidebar; verify focused-pair view for pair 1 still shows no brief envelope.

## Phase D — close

15. Wait for round 1 to expire (or click 'End round') and let GameEndedView load.

16. Open the round 1 brief reveal section in GameEndedView — pair 0 should show briefs (the ones added mid-round), pair 1 should show 'no brief assigned' or equivalent.

## Reporting

Output a single JSON object as the LAST thing on stdout matching this schema. The 'experience' block should be empty strings — this is QA. In 'experience.summary', list one PASS/FAIL/N/A line per numbered step (5–16) so we can read the regression checklist directly.

```json
{{
  "scenario_id": "targeted-gm-swap-and-addbriefs",
  "outcome": "passed | failed | partial",
  "duration_sec": 0,
  "role": "gm",
  "name": "Facilitator",
  "pair_idx": null,
  "phases_completed": ["A", "B", "C", "D"],
  "experience": {{"summary": "ONE-LINE PASS/FAIL PER STEP HERE", "most_engaging_moment": "", "most_confusing_moment": "", "would_use_for_real": "", "what_to_change": ""}},
  "findings": [
    {{"severity": "blocker | major | minor | nit", "area": "gm", "category": "bug | ux-confusion | copy", "title": "...", "detail": "...", "url_or_route": "/g/{CODE}/master", "evidence": "..."}}
  ],
  "console_errors": [],
  "network_errors": []
}}
```
"""


def make_player(role: str, name: str, pair_idx: int, lower: str) -> str:
    role_chip = "BUILDER" if role == "builder" else "GUIDER"
    flip_to = "guider" if role == "builder" else "builder"
    sp_name = "Change builder brief" if role == "builder" else "Change guider brief"
    other_role_in_pair_0 = "Bri" if name == "Avery" else "Avery" if name == "Bri" else "—"
    is_pair_0 = pair_idx == 0
    pair_observation = (
        f"You are in pair 0 (the targeted pair). The GM will exercise the swap button on YOUR pair and fire {sp_name} on you mid-round."
        if is_pair_0
        else f"You are in pair 1 (the control pair). The GM will NOT swap your role and will NOT fire any super-powers on your pair. Your job is to confirm pair 1 stays brief-less and your role stays stable."
    )

    return f"""You are {name}, a {role_chip} in pair {pair_idx} of a targeted Tessera regression run at {URL} (code: {CODE}).

{pair_observation}

This run tests TWO paths:
  (A) The GM may swap your role before the round starts using the new ⇄ swap button. If they do, your role indicator should flip from '{role}' to '{flip_to}' (or vice versa) in the lobby and on /play.
  (B) The game was created with briefs OFF. The GM will fire {sp_name} MID-round on pair 0; the targeted player should see a brief envelope appear on their screen within ~2 seconds.

## Setup
1. `npx --yes playwright install chromium`
2. Open ONE Playwright browser context. Navigate to {URL}/g/{CODE}/join.
3. Display name = '{name}'. Submit. Save the recovery URL when the modal pops.
4. You should land on /g/{CODE}/play in lobby/waiting state.

## Phase A — observe the swap-roles flow
5. While in lobby, watch your role badge / assignment text. The GM is going to:
   - Pair you with your partner (your role chip updates to '{role}').
   - {'Then click ⇄ swap on your pair row TWICE (once flipping your role to ' + flip_to + ', then back to ' + role + ').' if is_pair_0 else 'NOT swap your pair (you should remain ' + role + ' the whole time).'}

6. {'After the second swap completes, your role should be back to ' + role + '. Confirm. Capture: did your role chip update SMOOTHLY without a manual refresh? Did the lobby waiting copy still make sense after the swap (no stuck "you are the ' + role + '" copy when you were briefly flipped)?' if is_pair_0 else 'Confirm your role chip stayed at ' + role + ' the entire pre-round window.'}

## Phase B — round starts, no brief
7. Once the GM clicks Start round 1, you'll be on the play surface. Confirm there is NO brief envelope on your screen (game was created with {role}_brief_on=false).
8. Place ~3 pieces normally to confirm the play loop works without a brief.

## Phase C — brief-appears-mid-round path
9. {'Watch for a brief envelope to appear on your screen. The GM will fire ' + sp_name + ' on pair 0. When it lands:' if is_pair_0 else 'You should NOT see any brief envelope appear on your screen — pair 1 is the control. If a brief envelope appears, that is a BUG.'}
{'   - Capture exact timing: how many seconds between the GM trigger and the envelope showing on your tab? If you cannot tell, capture how long until you saw ANY visual change.' if is_pair_0 else ''}
{'   - Did anything visible signal that a brief just arrived? A SuperPowerToast banner should appear briefly at the top.' if is_pair_0 else ''}
{'   - Open the brief. Did its title + rules render correctly? Was there any stale state from the no-brief path (placeholder text bleeding through)?' if is_pair_0 else ''}
{'   - Place ~3 more pieces with the brief in mind, hit Test solution once.' if is_pair_0 else '   - Continue placing ~3 more pieces normally; nothing should change visually.'}

## Phase D — close
10. Wait for round end. Goal reveal screen — {'your pair should show the brief that was added mid-round in the brief reveal section.' if is_pair_0 else 'your pair (pair 1) should show no brief in the reveal section.'}

## Reporting
Output the JSON block as the LAST thing on stdout. 'experience.summary' = one PASS/FAIL/N/A per numbered step (5–10). The other experience fields can be empty strings.

```json
{{
  "scenario_id": "targeted-{role}-{lower}",
  "outcome": "passed | failed | partial",
  "duration_sec": 0,
  "role": "{role}",
  "name": "{name}",
  "pair_idx": {pair_idx},
  "phases_completed": ["A", "B", "C", "D"],
  "experience": {{"summary": "PASS/FAIL PER STEP HERE", "most_engaging_moment": "", "most_confusing_moment": "", "would_use_for_real": "", "what_to_change": ""}},
  "findings": [],
  "console_errors": [],
  "network_errors": []
}}
```
"""


ROSTER = [
    ("00-gm-facilitator", GM_BODY),
    ("01-builder-avery", make_player("builder", "Avery", 0, "avery")),
    ("02-guider-bri", make_player("guider", "Bri", 0, "bri")),
    ("03-builder-cameron", make_player("builder", "Cameron", 1, "cameron")),
    ("04-guider-drew", make_player("guider", "Drew", 1, "drew")),
]

for slug, body in ROSTER:
    p = OUT / f"{slug}.instruction.json"
    p.write_text(json.dumps({"instruction": body}))
    print(f"  wrote {p}  ({len(body)} chars)")
