# Tessera — Multi-Role Playtest Runbook

Each Jetty `runbook` agent spawned for this runbook plays **one scenario**
end-to-end against `https://tessera.schaffters.com` using Playwright MCP.
Inside the agent's container, the agent opens 4–5 Playwright browser
contexts (one per role) and drives them simultaneously, narrating
observations as it goes.

**Inputs the agent receives** (via `template_variables` → `init_params.scenario`):

```json
{
  "scenario_id": "happy-path-c5",
  "complexity": 5,
  "round_count": 1,
  "team_mode": "gm_picks",
  "builder_brief_source": "library",
  "guider_brief_source": "library",
  "scoring_penalty": false,
  "trigger_at_seconds": null,
  "trigger_super_powers": [],
  "expected_anomalies": [],
  "extra_notes": ""
}
```

**Output the agent writes** (returned as the runbook step's stdout, JSON):

```json
{
  "scenario_id": "happy-path-c5",
  "outcome": "passed | failed | partial",
  "duration_sec": 312,
  "findings": [
    {
      "severity": "blocker | major | minor | nit",
      "area": "builder | guider | observer | gm | shared",
      "category": "bug | ux-confusion | slowness | copy | accessibility | visual",
      "title": "Short headline",
      "detail": "Markdown description with what the agent observed and where",
      "url_or_route": "/g/MJP-89H/play",
      "evidence": "screenshot path or console excerpt"
    }
  ],
  "console_errors": ["..."],
  "network_errors": ["..."]
}
```

The parent workflow aggregates `findings[]` from every scenario and runs
`simple_judge` to distill them into a prioritized improvement list.

---

## Role tab playbook

For every scenario the agent opens these tabs in order. Each tab is a
fresh Playwright `BrowserContext` so cookies don't bleed.

### Tab 0 — GM
1. Navigate to `{tessera_url}` (landing).
2. Click "Host a game", fill: workshop name "Playtest <scenario_id>",
   video call URL `https://meet.example.com/playtest`, whiteboard left
   blank, team mode = scenario, complexity = scenario, builder + guider
   briefs both ON, brief sources per scenario, round count per scenario,
   sound on.
3. Submit. Capture the 6-char game code from the redirected URL
   (`/g/{CODE}/master`).
4. Wait until 4 players have joined (the lobby table fills).
5. Auto-allocate the lobby into pairs (or use scenario-specific pair
   moves).
6. Click `Start round 1` with the scenario's complexity in the dial.
7. While the round runs, fire any `trigger_super_powers` at the
   `trigger_at_seconds` mark.
8. When round timer hits 0, observe the round-ended view.
9. If `round_count > 1`, click "Start another round" and repeat.
10. End the game; capture the leaderboard.

### Tab 1 — Builder ("Avery")
1. From a fresh context, go to `{tessera_url}/`.
2. Use the join form: enter the game code from Tab 0, name "Avery".
3. Submit; auto-redirected to `/g/{CODE}/play`.
4. After the GM starts the round:
   - Tap the sealed brief envelope (or ignore it once and confirm the
     gate is enforced — see scenario `brief-gate-enforcement`).
   - Place tiles on the canvas while the guider talks.
   - Try **tap-occupied-cell-with-shape-selected** to confirm overwrite.
   - Try **rotate** (R key) and confirm 90° increments.
   - Tap **Test solution** at least twice during the round (early +
     late) and capture the celebration animation + score change.
   - At end of round, observe transition to RoundEndedView.

### Tab 2 — Guider ("Bri")
1. Join with name "Bri". The GM should pair her with Avery.
2. After round start: open her brief envelope, observe the goal
   pattern.
3. Verify pair-name badge is visible, click to rename to "The
   Pelicans"; confirm the new name propagates to GM and observer tabs
   within ~2s.
4. If the agile-share super-power triggers, tap the builder's progress
   thumbnail and confirm full-screen modal.
5. Esc the modal; verify it closes.

### Tab 3 — Observer ("Casey")
1. Join with name "Casey". GM assigns to a pair as observer.
2. After round start: confirm side-by-side builder+goal view.
3. Verify the pair-name change from Tab 2 is reflected.
4. If `available_pairs.length > 1`, switch pairs at least once.

### Tab 4 — Second pair (only when `pair_count >= 2`)
- Avery2 + Bri2 mirroring Tab 1 + Tab 2 for the second pair so the GM
  has two pairs to observe.

---

## Observation rubric

The agent must specifically attempt and **report findings against**:

### Builder canvas
- [ ] Tap-cell-with-no-selection arms a cell (or no — current build:
      shape-first only). Note which behaviour ships.
- [ ] Tap-occupied-cell with shape selected ⇒ overwrite/convert in
      place. Confirm piece identity preserved.
- [ ] Tap-occupied-cell with no selection ⇒ enter edit mode.
- [ ] Rotation moves in 90° increments (4 states).
- [ ] **Clear all** is two-tap confirm; the second tap completes
      within 3s.
- [ ] Progress counter "X / Y placed" stays visible.
- [ ] Add-mode ↔ Edit-mode toggle in sidebar reflects current state.

### Brief flow
- [ ] Builder + Guider canvases are gated until envelope is opened.
      Confirm gate copy mentions "don't share contents" and "20-questions".
- [ ] Open envelope dismisses gate. New brief (super-power) re-arms it.
- [ ] Yellow note inside the open envelope reinforces "don't read aloud".

### Test solution + scoring
- [ ] Builder's `Test solution` CTA is disabled when 0 placements.
- [ ] After tapping, score breakdown banner appears with pulse.
- [ ] Per-piece green/red highlights persist (test_enabled stays on).
- [ ] Score updates correctly when placements change + re-test.
- [ ] When GM toggles "Punish wrong attempts", score drops by 1 if any
      wrong placements exist.
- [ ] Game-end leaderboard ranks by total score; per-round chips
      readable.

### Super powers
- [ ] **Prototype unlock** with 3s / 5s / 10s / 15s respects the
      duration knob.
- [ ] **Reveal briefs** flips both players' opposite-side envelope to
      open with no further click.
- [ ] **Test build** (GM-fired) flips per-piece highlights for builder
      + observer.
- [ ] **Agile share** decrements `shares_remaining` and pushes a
      snapshot to the guider's thumbnail.
- [ ] **Time pressure** subtracts time AND triggers the
      `playTimePressure` chime.
- [ ] **Change builder/guider brief** swaps just that side and
      re-arms the gate for the affected player. Unlimited.
- [ ] **Randomizer** redraws the goal at the same complexity.
- [ ] **Requirement change** mutates exactly one cell of the goal.
- [ ] **Make it harder** redraws at +1 complexity but keeps the round
      grid envelope (no off-grid pieces).
- [ ] **Make it easier** mirrors at −1.

### Time controls
- [ ] +30s / +1m / +2m chip buttons add the named amount.
- [ ] Timer pill turns red and runs the jiggle animation under 2:00.
- [ ] `playLastTwoMinutes` chime fires once per round at the 2:00
      threshold.

### Pair self-naming
- [ ] Default pair name renders as `<me> ↔ <partner>`.
- [ ] Editing from Builder or Guider tab propagates within ~2s to the
      other tabs (realtime).
- [ ] 41-char input is rejected with `name_too_long`.
- [ ] Empty save reverts to the default.

### Failures + recovery
- [ ] When `brief_source = "gemini"` and Gemini env is missing, the
      Start click yields the `GeminiFallbackModal` with "Use preset
      briefs" + "Cancel" — NOT a 500 toast.
- [ ] Tapping "Use preset briefs" succeeds and starts the round.
- [ ] If a round is left in `pending` (force-close mid-Start), the
      next Start click cleans it up and creates a fresh round (no
      "Start unavailable" hang).

### Realtime
- [ ] Builder placement appears on Observer / GM tabs within ~500ms.
- [ ] Pair rename appears on all tabs within ~2s.
- [ ] `solution_tested` broadcast updates the GM's pair view.

---

## Scenario matrix (initial)

| ID | Complexity | Rounds | Brief sources | Penalty | Triggers (at sec) | Expected anomalies |
|----|------------|--------|---------------|---------|-------------------|---------------------|
| `happy-path-c5` | 5 | 1 | library / library | off | — | none |
| `low-complexity-c2` | 2 | 1 | library / library | off | — | tray squeezes onto small grid |
| `high-complexity-c8` | 8 | 1 | library / library | on | — | 9×9 grid, 6-color palette |
| `multi-round-c3-c5-c7` | 3 → 5 → 7 | 3 | library / library | off | — | complexity dial bumps each round |
| `gm-custom-briefs` | 5 | 1 | gm / gm | off | — | brief title from custom payload |
| `gemini-failure` | 5 | 1 | gemini / gemini | off | — | GeminiFallbackModal at Start |
| `players-pick` | 5 | 1 | library / library | off | — | join page shows role picker |
| `harder-mid-round` | 4 | 1 | library / library | off | harder@60 | grid stays; piece count +1 |
| `easier-mid-round` | 7 | 1 | library / library | off | easier@90 | grid stays; piece count -1 |
| `randomizer-then-test` | 5 | 1 | library / library | off | randomizer@45 | new pattern + score recomputes |
| `time-pressure-into-last-2min` | 5 | 1 | library / library | off | time_pressure@(start+5min) | jiggle + chime fire |
| `change-builder-brief-x3` | 5 | 1 | library / library | off | change_builder_brief×3 | unlimited swap holds |
| `agile-share-cap` | 5 | 1 | library / library | off | builder shares×4 | 4th share blocked client-side |
| `brief-gate-enforcement` | 5 | 1 | library / library | off | — | canvas blocked until envelope opened |
| `pair-rename-realtime` | 5 | 1 | library / library | off | — | name propagates across tabs |
| `clear-all-recovery` | 5 | 1 | library / library | off | builder Clear-All@30 | wipe → new placements work |
| `scoring-tile-tune` | 5 | 1 | library / library | off→on | GM toggles penalty mid-round | leaderboard reflects toggle |
| `replay-after-end` | 5 | 1 | library / library | off | end@120 then replay | "Start another round" works |
| `host-recover` | 5 | 1 | library / library | off | GM tab refresh@60 | session reclaim succeeds |
| `concurrent-3-pairs` | 5 | 1 | library / library | off | — | 6 builder/guider tabs + observer |

---

## Output requirements (JSON contract)

The runbook agent's final action MUST be a single JSON object printed
to stdout matching the schema in the header, with at minimum:
- `scenario_id` (echoes input)
- `outcome` ("passed" if all expected behaviour observed and no blockers)
- `findings[]` (zero or more, severity-tagged)

Anything else (notes, internal scratchpad) goes above this line; the
parser reads only the **last** valid JSON object.

The synthesizer step then receives a list of these objects and emits:

```json
{
  "summary": "<one paragraph executive summary>",
  "blockers": ["..."],
  "majors": ["..."],
  "minors": ["..."],
  "quick_wins": ["..."],
  "design_calls": ["items needing user input before implementing"],
  "suggested_patches": [
    { "file": "components/play/...", "rationale": "...", "diff": "<unified diff>" }
  ]
}
```

`suggested_patches` is best-effort; the agent only suggests patches
where the fix is unambiguous (copy tweaks, missing aria labels,
obviously-wrong CSS values). Anything that affects mechanics goes to
`design_calls` for human review.
