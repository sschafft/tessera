# tessera-playtest-orchestrator — 10-player concurrent playtest

The orchestrator runs a full Tessera workshop end-to-end with **10 concurrent agents**: 1 GM + 3 builders + 3 guiders + 3 observers. Each agent has its own Daytona container + Playwright browser, so the run genuinely tests:

- **Concurrent UX** — does pair-rename propagate across tabs in real time? Do super-powers reach all observers? Does the agile-share thumbnail update on every guider screen?
- **Per-role experience** — what does it feel like to be the *third* builder when the GM is focused on pair 0?
- **Performance / scaling** — round-trip latency under 10 concurrent sockets, snapshot fetch p95, broadcast fan-out.

Single-agent multi-tab playtests miss all three. Use this when you've changed something system-level (realtime, scoring, layout) and want a real-load read before shipping.

---

## Architecture

```
tessera-playtest-orchestrator (parent workflow)
├─ create_game        runbook  → GM init agent: creates the game, returns
│                                {code, host_recover_url}, exits.
├─ extract_code       extract_from_trajectories → pulls code + recover url
├─ simulate           list_emit_await
│                       child_workflow = tessera-playtest-player
│                       items = [10 role assignments]
│                       max_concurrency = 10
│                       (each child opens a Playwright context and plays
│                        ONE role for the full session)
├─ collect            extract_from_trajectories → gathers all 10 child JSONs
└─ synthesize         simple_judge (or runbook) → produces unified report
```

Two workflows ship together: the orchestrator above, and `tessera-playtest-player` (the per-role child).

---

## Inputs (orchestrator init_params)

```json
{
  "tessera_url": "https://tessera.schaffters.com",
  "scenario": {
    "workshop_name": "Orchestrator playtest",
    "complexity": 5,
    "round_count": 1,
    "round_duration_sec": 600,
    "team_mode": "gm_picks",
    "builder_brief_source": "library",
    "guider_brief_source": "library",
    "scoring_correct_pts": 10,
    "scoring_wrong_pts": -1,
    "trigger_super_powers": [
      { "kind": "agile_share", "scope": "pair", "pair_idx": 0, "at_seconds": 120 },
      { "kind": "prototype",    "scope": "pair", "pair_idx": 1, "at_seconds": 180 },
      { "kind": "time_pressure","scope": "all",                 "at_seconds": 300 }
    ]
  },
  "roster": [
    { "role": "gm",       "name": "Facilitator", "pair_idx": null },
    { "role": "builder",  "name": "Avery",       "pair_idx": 0 },
    { "role": "guider",   "name": "Bri",         "pair_idx": 0 },
    { "role": "builder",  "name": "Cameron",     "pair_idx": 1 },
    { "role": "guider",   "name": "Drew",        "pair_idx": 1 },
    { "role": "builder",  "name": "Ellis",       "pair_idx": 2 },
    { "role": "guider",   "name": "Finley",      "pair_idx": 2 },
    { "role": "observer", "name": "Gray",        "pair_idx": 0 },
    { "role": "observer", "name": "Harper",      "pair_idx": 1 },
    { "role": "observer", "name": "Indigo",      "pair_idx": 2 }
  ]
}
```

Roster is a roster — roles + names + which pair each player belongs to. The orchestrator's `simulate` step turns it into 10 child trajectories, each receiving one assignment.

---

## Per-role child prompts (tessera-playtest-player)

The child workflow renders a different prompt depending on `assignment.role`. All children share:

- Same `tessera_url`, `code`, `scenario`.
- Each opens **one** Playwright browser context.
- Each captures latency samples (broadcast → UI update) at chosen instrumentation points.
- Each writes a final JSON to stdout matching the per-player output schema below.

### GM child
- Navigates to `{tessera_url}/host-recover/{code}` to claim the GM session created by `create_game`.
- Waits in lobby until **9 players** are in the lobby (poll the participants count).
- Auto-allocates: clicks "Create 3 pairs" then "Auto-assign 3 observers".
- Starts round 1 with the scenario's complexity + duration.
- Fires `trigger_super_powers` at the configured offsets, switching focused pair as needed.
- Toggles between focused pairs every ~90s to capture each pair's progress.
- When timer hits 0, observes round-end view; ends game; reports the leaderboard.
- **Findings rubric**: GM dashboard responsiveness with 3 active pairs; pair switching delay; super-power fan-out latency to "all" scope; allocation UX with 9 lobby members.

### Builder child
- Joins via `{tessera_url}/g/{code}/join` with the assigned name.
- Waits for GM to assign role + start round.
- Plays the round: opens brief, places ~10–14 pieces while talking through (simulated dialogue is OK), uses Test solution at least twice, attempts Clear-all once.
- **Findings rubric**: place-piece responsiveness (visible stutter? optimistic→server reconciliation gap?); test-solution feedback clarity; brief envelope dismissal flow; pair-name nudge UX.

### Guider child
- Joins, opens brief, observes goal.
- Renames the pair via PairNameBadge to "The Pelicans" within first 60s; verifies propagation to the GM and other tabs (samples timestamp diff via `console.time` if possible).
- If `agile_share` fires, taps the builder snapshot thumbnail and confirms full-screen modal works.
- **Findings rubric**: goal canvas readability at complexity 5; brief minimize/seal flow; pair-rename realtime delay; super-power notification clarity.

### Observer child
- Joins, GM assigns to a pair as observer.
- Verifies side-by-side builder + goal layout renders within ~3s of round start.
- Switches to a different pair at least once (if more than one available).
- **Findings rubric**: observer view scaling at complexity 5; pair-switcher UX; missing affordances (does observer have any agency or are they passive?).

---

## Per-player output (each child returns)

```json
{
  "role": "builder",
  "name": "Avery",
  "pair_idx": 0,
  "joined_at": "2026-04-27T14:02:11.412Z",
  "round_started_at": "2026-04-27T14:03:55.001Z",
  "session_duration_sec": 612,
  "interactions": {
    "placements_attempted": 14,
    "placements_succeeded": 14,
    "test_solution_taps": 3,
    "score_final": 110
  },
  "latency_samples_ms": {
    "place_to_visible": [42, 38, 51, 47, 39],
    "broadcast_to_ui_update": [180, 165, 192]
  },
  "findings": [
    {
      "severity": "minor",
      "category": "ux-confusion | bug | slowness | copy | accessibility | visual | performance",
      "title": "Short headline",
      "detail": "What happened, when, why it matters.",
      "evidence": "screenshot path | console excerpt | url"
    }
  ],
  "console_errors": [],
  "network_errors": []
}
```

---

## Orchestrator final report (synthesize step output)

```json
{
  "scenario_id": "orchestrator-c5-1round",
  "duration_sec": 712,
  "outcome": "passed | partial | failed",
  "executive_summary": "<one paragraph>",
  "per_role_summary": {
    "gm":       "...",
    "builder":  "...",
    "guider":   "...",
    "observer": "..."
  },
  "concurrency_findings": [
    "Realtime broadcast latency p95 = 245ms (across 30 samples).",
    "Pair rename propagation = 1.2s p95 to GM, 1.8s p95 to other-pair observers."
  ],
  "scaling_findings": [
    "Snapshot endpoint p95 with 10 active sockets = 380ms (acceptable).",
    "Goal canvas mounting time on observer joins mid-round = 2.1s."
  ],
  "blockers":     [ ],
  "majors":       [ "..." ],
  "minors":       [ "..." ],
  "quick_wins":   [ "..." ],
  "design_calls": [ "items needing user input before implementing" ],
  "tech_debt":    [ ]
}
```

---

## How to invoke

```sh
JETTY_API_KEY=$(grep '^JETTY_API_KEY=' /Users/schaffter/www/tessera/.env.local | cut -d= -f2)

cat > /tmp/orch-init.json <<'EOF'
{
  "init_params": {
    "tessera_url": "https://tessera.schaffters.com",
    "scenario": {
      "workshop_name": "Orchestrator playtest",
      "complexity": 5,
      "round_count": 1,
      "round_duration_sec": 600,
      "team_mode": "gm_picks",
      "builder_brief_source": "library",
      "guider_brief_source": "library",
      "scoring_correct_pts": 10,
      "scoring_wrong_pts": -1,
      "trigger_super_powers": []
    },
    "roster": [
      {"role": "gm",       "name": "Facilitator", "pair_idx": null},
      {"role": "builder",  "name": "Avery",       "pair_idx": 0},
      {"role": "guider",   "name": "Bri",         "pair_idx": 0},
      {"role": "builder",  "name": "Cameron",     "pair_idx": 1},
      {"role": "guider",   "name": "Drew",        "pair_idx": 1},
      {"role": "builder",  "name": "Ellis",       "pair_idx": 2},
      {"role": "guider",   "name": "Finley",      "pair_idx": 2},
      {"role": "observer", "name": "Gray",        "pair_idx": 0},
      {"role": "observer", "name": "Harper",      "pair_idx": 1},
      {"role": "observer", "name": "Indigo",      "pair_idx": 2}
    ]
  }
}
EOF

curl -X POST -H "Authorization: Bearer $JETTY_API_KEY" \
  -F "init_params=<@/tmp/orch-init.json" \
  https://flows-api.jetty.io/api/v1/run/jettyio/tessera-playtest-orchestrator
```

A run takes ~12–15 minutes (round_duration_sec + setup + synthesis). Watch the parent trajectory; the 10 child trajectories appear under it as they spawn.

---

## Cost expectations

10 concurrent Daytona containers running for ~12 minutes each, plus an Opus synthesis pass at the end. Don't run for trivial changes — reserve for milestone playtests and post-major-refactor verification.

---

## Known limitations / future work

- **Voice channel is mocked.** The agents don't talk to each other; the guider doesn't actually describe the goal. Currently each child plays its role mechanically (placements per-builder are random within constraints; renames happen on schedule). Real linguistic UX is not measured here. This is fine for layout / latency / pair-rename / super-power testing; **not** fine for "does the brief make sense" testing — use a single-tab `tessera-playtest-scenario` for that.
- **Pair self-naming nudge timing** assumes the brief is opened once; a child that never opens the brief won't trigger the modal. The runbook expects every child to open + close their brief once.
- **Cookie isolation** is per-container (each Daytona has its own cookies), so the cookie-collision bug from earlier single-agent multi-tab playtests is gone here.
- **No replay step** — the synth report doesn't (yet) include "rerun the failing scenario with single-tab runbook to confirm reproducibility". File that as `tech_debt` for the next iteration.
