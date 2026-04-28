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
MEETING_MODE = os.environ.get("MEETING_MODE", "remote")
BREAKOUT_PROVIDER = os.environ.get("BREAKOUT_PROVIDER", "none")

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

# Playtest framing — these prompts ask agents to play *as a person
# trying to learn or facilitate something*, not to QA a feature
# checklist. We do still need basic functionality verified, but the
# primary signal we're after is whether the experience HOLDS UP as
# a workshop tool: does the brief generate conversation, does the
# super-power feel earned, does winning feel like a payoff, would
# you spend an afternoon doing this. The setup steps stay specific
# (manual pairing, fixed roster) so the runtime is reproducible;
# the play loop opens up.

GM_PLAYBOOK = (
    "### GM playbook (Facilitator) — running a workshop\n\n"
    "You're the facilitator of a Tessera session. Your job is reading the room, deciding when a mechanic will *unstick* a pair vs when it'll just add noise, and using the game as a vehicle for the conversation that matters. Tessera's design promise is 'no logins, no install, real conversation' — judge whether the dashboard makes that promise feel kept.\n\n"
    "**Phase A — get set up (lobby + roster)**\n"
    "1. Navigate to {url}/host-recover/{code} and recover the host session. You should land on /g/{code}/master.\n"
    "2. Wait for 9 players to appear in the lobby panel.\n"
    "3. **Pair players manually by name** (auto-allocate is random and breaks the playtest's role expectations). For each pair: click both names → 'Pair selected · assign roles' → click the intended builder.\n"
    "   Pairings: Avery (builder) ↔ Bri (guider) → pair 0; Cameron ↔ Drew → pair 1; Ellis ↔ Finley → pair 2.\n"
    "4. Assign observers: Gray → pair 0, Harper → pair 1, Indigo → pair 2 (single-select → '👁 As observer to pair…' → pick the pair).\n"
    "5. While doing this, *notice how the dashboard feels*: did you have to hunt for anything? Did the lobby copy + accelerant rail telegraph what you were supposed to do next, or did you guess?\n\n"
    "**Phase B — facilitate round 1**\n"
    "6. Pick a complexity ({complexity}) and a duration ({duration_min} min) that feel right for a real workshop. Start round 1.\n"
    "7. Now your job is *facilitation*, not feature-QA. Watch the focused-pair canvas. Watch the score chips. Watch which pair seems stuck or in-flow. Fire super-powers when they'd actually serve the room — not on a timer:\n"
    "   - Use **Reveal briefs** when a pair has plateaued and the conversation has stalled. Did revealing them break the silence?\n"
    "   - Use **Prototype unlock** to give a struggling builder a 5s glimpse. Did the glimpse feel like a kindness or a cheat?\n"
    "   - Use **Agile share** so guiders can spot a misalignment. Did surfacing the snapshot trigger a course-correction or a 'wait, what?'\n"
    "   - Use **Change builder brief** or **Change guider brief** to mix up a pair that's coasting. Was the swap energising or disorienting?\n"
    "   - Use **Time pressure** if the room is too easy. Did the squeeze focus people or panic them?\n"
    "   - Tune the **Scoring** tile (per-correct + wrong-attempt penalty) at least once. Did changing it mid-round feel safe or wreckage-y?\n"
    "8. Try the timer extensions (+30s / +1m / +2m) at moments where the room is *almost* somewhere — give them the time to land it. Did extending feel like good facilitation?\n\n"
    "**Phase C — round transitions**\n"
    "9. After round 1 ends, *take a beat as the facilitator*. The transition to round 2 (or to 'all planned rounds done') should answer: 'what do I do next?' Did it? If you wanted to start a bonus round, was the path obvious?\n"
    "10. {round_2_action}\n\n"
    "**Phase D — close the session**\n"
    "11. End the game. Read the GameEndedView with a workshop-host's eye: do the debrief prompts feel like *useful conversation starters* or generic filler? Does the leaderboard surface the right things?\n"
    "12. Decide: would you actually run this for your team? Why or why not?\n\n"
    "Beyond bugs, capture the **dynamics**: which super-power generated the most conversation, which one felt like noise, which moment in the round felt the most alive, where the dashboard fought you, and whether scoring + briefs together actually shape behaviour or just keep score. If you ran this twice, what would you do differently?"
)

BUILDER_PLAYBOOK = (
    "### Builder playbook (name: {name}, pair {pair_idx}) — playing the game\n\n"
    "You're a participant in a workshop. You're paired with a guider you can't see the same picture as; they have the goal, you have a tray. You'll be talking on a (simulated) call — imagine talking to a real partner. Don't 'place pieces and verify state'; play to actually rebuild what they're describing. Your tab is one half of a relationship.\n\n"
    "**Phase A — join the room**\n"
    "1. Navigate to {url}/g/{code}/join, display name = '{name}', submit. Save the recovery URL when the modal pops.\n"
    "2. Land on /g/{code}/play. The pre-round 'waiting' state — does it feel like ready-to-go or is it an awkward beat?\n\n"
    "**Phase B — round 1, a builder's loop**\n"
    "3. Round starts. Your sealed brief is on the right. Open it. *Read it as guidance, not a constraint to QA.* Note: was the brief evocative? Funny? Did you want to share it with someone?\n"
    "4. Now play — the guider is describing a picture you can't see. Listen, ask yes/no questions in your head, place ~10-14 pieces using a mix of shapes + colours. Try to actually be useful as a partner; if a description is ambiguous, place tentatively and adjust.\n"
    "5. **Use the Test solution CTA** at least twice — once early (after ~5 placements) and once when you think you're done. Pay attention to the feedback moment: did getting some pieces right *feel like progress*? Did the partial-success confetti land or feel hollow? If you got everything right, did the 'you did it' celebration feel earned?\n"
    "6. **Use Share progress** at least once. Did sharing feel like a meaningful act of collaboration or a button you pressed because it was there?\n"
    "7. **Edit mode**: click an existing piece, rotate it, move it. Did it feel responsive? Did you ever lose your place?\n"
    "8. If a super-power fires (Reveal briefs, Change builder brief, Prototype glimpse) — does it feel like the GM is helping you, surprising you, or interrupting? Note the emotional shape, not just the visual.\n"
    "9. Spend a moment with the brief envelope: minimise it, re-seal it, re-open it. Is the envelope a thing you *like*, or is it ceremony in the way of doing the thing?\n\n"
    "**Phase C — recovery flow test (Avery only)**\n"
    "10. {recovery_test}\n\n"
    "**Phase D — round 2 (if planned)**\n"
    "11. Watch the RoundEndedView. Did the goal reveal feel cathartic or anticlimactic? Did you want to compare with your guider, or move on?\n"
    "12. Play round 2 lighter — ~5 pieces, one Test. Notice if the second round felt different from the first. Better, worse, more of the same?\n\n"
    "**Phase E — close**\n"
    "13. GameEndedView leaderboard — note your pair's standing. Did the score reflect the experience, or did you feel like the game was scoring something else?\n\n"
    "Capture the **feel** of being a builder: most-engaging moment, most-confusing moment, the place where the optimistic UI either delighted or stuttered, what you'd want a redesign to change, whether you'd play again."
)

GUIDER_PLAYBOOK = (
    "### Guider playbook (name: {name}, pair {pair_idx}) — describing what you can't show\n\n"
    "You see the goal. Your builder doesn't. You have to talk them into rebuilding it through whatever constraint your secret brief gives you. The challenge is *the conversation* — the tile-placement is just the substrate. Play to make your builder's experience interesting, not to win efficiency.\n\n"
    "**Phase A — join the room**\n"
    "1. Navigate to {url}/g/{code}/join, name = '{name}', submit. Save the recovery URL.\n"
    "2. Wait for round start.\n\n"
    "**Phase B — round 1, a guider's loop**\n"
    "3. Open your brief. *Sit with the constraint for a beat* — does it feel evocative, or like a tortured rule someone made up to be quirky? Note what your first instinct is: 'I can do something with this' or 'wait, how am I supposed to describe a square in nautical terms'?\n"
    "4. Look at the goal canvas. Imagine describing it through your brief's constraint to someone who can't see it. Was the goal *talkable*? Was the complexity ({complexity}) too easy / too hard for an interesting conversation? Notice if you feel the brief generates *humour* or *frustration*.\n"
    "5. **Name the pair** — click the PairNameBadge, set it to '{pair_name_suggestion}'. Did this small ritual feel like part of the game's identity, or a mandatory chore?\n"
    "6. Try minimising / re-sealing the brief while you read the goal. Does the right column feel like a stable reference or do you have to keep poking it?\n"
    "7. If a super-power fires (Agile share gives you the builder's snapshot, Reveal briefs unmasks both, Change guider brief swaps yours): pay attention to whether it changed the *conversation* you were having, not just whether the UI updated. The most important thing about Agile share is whether seeing the builder's progress made you say 'oh, they thought I meant…' — did it?\n"
    "8. As the round wraps, watch the score chip rise. Did watching them get pieces right feel rewarding (you helped) or distancing (you're just observing)?\n\n"
    "**Phase C — round transition**\n"
    "9. After round 1 ends, the RoundEndedView shows both sides. Did revealing the briefs to each other feel like the *real* moment of the round? Did you want more time to talk about it?\n"
    "10. Round 2 starts (if planned): new goal, new brief. Did the second round feel like a fresh game or a repeat?\n\n"
    "**Phase D — close**\n"
    "11. GameEndedView — read the debrief prompts as if you'd actually run them with a team. Are they good prompts?\n\n"
    "Capture: was the brief constraint *fun to embody* or did you spend the round wrestling it? Was your builder's progress visible enough to feel like collaboration? When the celebration fired, did it feel shared with your builder or like a thing happening in your tab? What would change if you played this with a real partner over Zoom?"
)

OBSERVER_PLAYBOOK = (
    "### Observer playbook (name: {name}, pair {pair_idx}) — watching the workshop\n\n"
    "You're the spectator role — fly on the wall for one pair. The product question this role answers is: *is watching Tessera interesting, or is it homework?* You're allowed to switch pairs to compare. Treat your tab as the camera the workshop facilitator might walk people past during a debrief.\n\n"
    "**Phase A — join + take your seat**\n"
    "1. Navigate to {url}/g/{code}/join, name = '{name}'. Save recovery URL. Wait for the GM to seat you on a pair as observer.\n\n"
    "**Phase B — round 1, watching**\n"
    "2. Round starts. Your view = builder canvas + goal side-by-side. *Watch your assigned pair* (pair {pair_idx}) for the first ~3 minutes without doing anything else. Note: was watching engaging or did you reach for another tab?\n"
    "3. As pieces land on the builder canvas, do you feel the pair's conversation happening through their actions? Are the placements telling a story or feeling like random clicks?\n"
    "4. **Switch pairs** once mid-round to compare another pair's progress. Does seeing a different pair illuminate something or feel redundant? **CRITICAL**: switch back to pair {pair_idx} before phase C — observer self-switching writes participants.pair_id, and leaving you on the wrong pair shows up as drift in the GM's dashboard.\n"
    "5. When the GM fires a super-power, watch what changes for the pair you're observing. Is the change visible enough that you understand what just happened, or does it pass without explanation?\n"
    "6. Read the briefs once they're revealed. Are they *fun to read as a third party* — would you want to share them in a debrief?\n"
    "7. Resize the browser briefly to a narrow width (~768px). Does the observer view stay usable or fall apart?\n\n"
    "**Phase C — round transition + close**\n"
    "8. Watch the round-end + game-end views. Do you feel like you're part of the workshop or like you've been doing busywork?\n\n"
    "Capture: did watching feel like *meaningful spectating* (you learned, you were entertained, you'd talk about it after) or *passive waiting*? What would give the observer role agency without breaking the asymmetry that makes Tessera Tessera (e.g. lightweight react-emoji, flag-this-moment for the debrief)? Is there a viewport size where the side-by-side stops working?"
)

PLAYBOOK = {
    "gm": GM_PLAYBOOK,
    "builder": BUILDER_PLAYBOOK,
    "guider": GUIDER_PLAYBOOK,
    "observer": OBSERVER_PLAYBOOK,
}

# ─── v1.3 dual-provider breakouts + meeting-mode snippets ──────────
# These segments render only when the orchestrator was invoked with
# MEETING_MODE/BREAKOUT_PROVIDER set on the game-create POST. Goal:
# capture experiential feedback on whether the new flow ADDS clarity
# (each pair has a private call) or noise (one more thing to tune).

# GM-side: fires when provider != none. Drives Step 4 of the setup
# flow (the BreakoutsPanel) and asks the GM to read it as a
# facilitator deciding whether per-pair calls earn their complexity.
gm_breakouts_segment_jitsi = (
    "\n\n**Phase B.5 — per-pair breakout calls (Jitsi)**\n"
    "After all 9 players are seated and pairs are allocated, scroll to **Step 4 · Per-pair breakout calls** in the setup flow. The header should read 'Jitsi — generate when pairs are ready.' (no Google sign-in CTA). Notes for your run:\n"
    "- Click **Generate breakout calls** for the 3 pairs. There's no confirmation modal in Jitsi mode — calls should mint immediately, no API spinner.\n"
    "- Verify the panel transitions to 'X of Y breakout calls ready' (green ✓) within ~1s.\n"
    "- Open the focused-pair canvas and confirm the per-pair link is visible somewhere on the player surface (top bar / call CTA).\n"
    "- *Read the affordance as a facilitator*: Did 'Jitsi · Free, no sign-in' framing earn its place vs. just using one main video call? Was clicking Generate a clear act, or did it feel like another button to press?\n"
    "- Once pairs are running, try **Clear breakouts** mid-round and observe what happens to the per-pair links in player tabs. Did the cleanup feel safe or destructive?\n"
)
gm_breakouts_segment_google = (
    "\n\n**Phase B.5 — per-pair breakout calls (Google Meet)**\n"
    "Step 4 should show 'Sign in with Google to mint Meet links per pair.' DO NOT actually sign in (the orchestrator agent has no Google account). Instead:\n"
    "- Note whether the Step 4 affordance is *clear* without signing in. Does the copy explain what would happen?\n"
    "- Try clicking 'Sign in with Google' and observe the redirect. Cancel out of the consent screen and confirm the dashboard recovers gracefully.\n"
    "- *Read as a facilitator*: would you have clicked sign-in if you didn't already know what was about to happen? What's missing from the panel copy?\n"
)
gm_breakouts_segment_none_remote = (
    "\n\n**Phase B.5 — verify breakouts step is hidden**\n"
    "Step 4 (per-pair breakout calls) should NOT be visible — this game was created with breakout_provider='none'. Confirm the setup flow only shows steps 1, 2, 3.\n"
)
gm_inperson_segment = (
    "\n\n**Phase B.0 — verify in-person UX**\n"
    "This game was created with meeting_mode='in_person'. The dashboard should show:\n"
    "- NO 'Join the workshop call' CTA in the GM top bar.\n"
    "- NO Step 4 (per-pair breakout calls).\n"
    "- The lobby invite affordance should still surface the game code + join URL normally.\n"
    "Confirm both. *Read as a facilitator running an in-person workshop*: does the dashboard feel right-sized for the room, or are there phantom remote-only affordances cluttering it?\n"
)

# Player-side (builder/guider/observer): shorter snippets asking them
# to look for the per-pair breakout link and report on whether the
# top-bar hierarchy (workshop call vs pair call) makes sense.
player_breakouts_check_jitsi = (
    "\n\n**Per-pair breakout call check**\n"
    "After pairs are allocated and the GM clicks Generate breakouts, your top bar should surface a 'Join your pair's call' CTA pointing at a meet.jit.si URL. Click it and confirm a new tab opens (you can close it immediately). Was the relationship between the workshop call and your pair call obvious, or did you have to guess which to click?\n"
)
player_inperson_check = (
    "\n\n**In-person UX check**\n"
    "This game was created in-person mode. Your top bar should NOT show any 'Join the call' CTAs (no workshop call, no pair call). Confirm. Did the absence feel right for a co-located workshop, or did the surface feel weirdly empty?\n"
)
player_googlemeet_check = (
    "\n\n**Per-pair breakout call check (Google Meet)**\n"
    "The GM probably did not actually sign in with Google (orchestrator-only constraint), so you may not see a per-pair breakout CTA. If you do, it points at meet.google.com. Either way, note whether the absence of a working pair-call link confused you mid-round.\n"
)

if BREAKOUT_PROVIDER == "jitsi":
    gm_breakouts_segment = gm_breakouts_segment_jitsi
    player_breakouts_check = player_breakouts_check_jitsi
elif BREAKOUT_PROVIDER == "google_meet":
    gm_breakouts_segment = gm_breakouts_segment_google
    player_breakouts_check = player_googlemeet_check
else:
    gm_breakouts_segment = gm_breakouts_segment_none_remote
    player_breakouts_check = ""

if MEETING_MODE == "in_person":
    # In-person overrides any breakout segment — the host form drops
    # them entirely.
    gm_breakouts_segment = gm_inperson_segment
    player_breakouts_check = player_inperson_check

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

    # Append per-role v1.3 flow check (breakouts / in-person) when
    # the orchestrator was invoked with the relevant flags.
    if role == "gm":
        body += gm_breakouts_segment
    else:
        body += player_breakouts_check

    setup = (
        f"You are playing one role in a live Tessera workshop running at {TESSERA_URL} (code: {CODE}).\n\n"
        f"Your role: {role}\n"
        f"Your display name: {entry['name']}\n"
        f"Pair index: {pair_idx_str}\n"
        f"Host token (only used if role == gm): {HOST_TOKEN}\n"
        f"Round count: {ROUND_COUNT}\n"
        f"Round duration: {DURATION_MIN} min\n"
        f"Complexity: {COMPLEXITY}\n"
        f"Meeting mode: {MEETING_MODE}\n"
        f"Breakout provider: {BREAKOUT_PROVIDER}\n\n"
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
        '\n'
        '  // EXPERIENTIAL — the primary signal we want from this run.\n'
        '  // Write as a player/facilitator, not as a QA. 1-3 sentences each.\n'
        '  "experience": {\n'
        '    "summary": "Overall, did this feel like a workshop tool you\'d use? Or pre-prod toy? Be specific.",\n'
        '    "most_engaging_moment": "The single moment in the run where you were most absorbed. What made it work?",\n'
        '    "most_confusing_moment": "The single moment you stopped and went \'wait, what?\'. What were you trying to do, what happened?",\n'
        '    "would_use_for_real": "yes | no | maybe — and why in one sentence.",\n'
        '    "what_to_change": "If you had a single design lever, what would you turn?"\n'
        '  },\n'
        '\n'
        '  // FINDINGS — keep tracking concrete bugs + UX issues, but only flag\n'
        '  // things that actually hurt the experience or break a user path. Don\'t pad.\n'
        '  "findings": [\n'
        '    {"severity": "blocker | major | minor | nit", "area": "' + role + '", "category": "bug | ux-confusion | slowness | copy | accessibility | visual | performance | dynamics", "title": "...", "detail": "...", "url_or_route": "/g/' + CODE + '/play", "evidence": "..."}\n'
        "  ],\n"
        '  "console_errors": [],\n'
        '  "network_errors": []\n'
        "}\n"
        "```\n\n"
        "The `experience` block is the new headline; `findings` is now secondary. We're testing whether Tessera is a *good workshop tool*, not whether each button works in isolation. If something feels off in a way you can't quite name, write that — naming the smell IS the finding.\n\n"
        "Track which phases you completed in `phases_completed` (A/B/C/D/E). If you bail mid-phase, set `outcome: \"partial\"` and explain why in `experience.summary`."
    )

    full = (
        setup
        + body
        + "\n\n## How to think about this run\n"
        "You're not validating a feature spec — you're **playing the game** (or facilitating it) and reporting what the experience was like. Tessera is supposed to be a workshop tool that makes communication, asymmetry, and scaffolded iteration *felt* through play. The metric we care about is whether that worked.\n\n"
        "- Speak as a player. \"The brief made me laugh\" is more useful than \"the brief envelope rendered.\"\n"
        "- Notice silences. If you stalled or zoned out at a particular moment, that's signal — say where.\n"
        "- Don't force findings. If the round felt good and nothing broke, the run is a success — write a thoughtful `experience` block and ship a short `findings` list.\n"
        "- Real bugs (button does nothing, modal won't dismiss, value won't save, console error storms) still go in `findings` as `blocker` or `major`. Those gate ship-readiness.\n"
        "- Capture console + network errors in the dedicated arrays even if they didn't break your run — they tell us about back-end health.\n"
        + output_schema
    )

    p = out_dir / f"{i:02d}-{role}-{name_slug}.instruction.json"
    p.write_text(json.dumps({"instruction": full}))
    print(f"  {i:02d} {role:9} {entry['name']:12} pair={pair_idx_str}  {len(full)} chars  -> {p.name}")

print(f"\nWrote {len(ROSTER)} instruction files to {out_dir}/")
