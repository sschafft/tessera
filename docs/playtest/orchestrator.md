# tessera orchestrator — 10-role concurrent playtest

The orchestrator runs a full Tessera workshop with **10 isolated Daytona sandboxes** (1 GM + 3 builders + 3 guiders + 3 observers), each with its own Playwright browser and its own session cookie. Each sandbox plays one role; findings get aggregated client-side.

**What it tests:**
- **Per-role UX** — what each role experiences during a round, captured as a per-role JSON report.
- **Concurrency / realtime** — pair-rename propagation, super-power broadcast, agile-share thumbnail updates with all 10 sockets active.
- **Server-side load** — round-trip latency under 10 concurrent players, snapshot fetch p95.
- **Cookie isolation correctness** — each role really is a separate browser; multi-context bleeding (the bug that blocked the single-agent multi-tab orchestrator) is gone.

Use this when you've changed something system-level (realtime, scoring, layout) and want a real read before shipping. For a single-scenario quick playtest (one pair, one role focus), use `tessera-playtest-scenario` directly.

---

## Architecture

The orchestration happens in `docs/playtest/run-orchestrator.sh` rather than as a single Jetty workflow. Why: Jetty's `list_emit_await` activity does not pass per-item values into child workflows' `init_params` (verified across three variants 2026-04-27 — see `memory/reference_jetty.md`). Until Jetty fixes that, fan-out lives client-side.

```
run-orchestrator.sh
├─ 1. POST /api/games on tessera.schaffters.com   → code + host_token
├─ 2. render-roster.py                            → 10 rendered instructions
├─ 3. for each instruction: curl POST /api/v1/run/jettyio/tessera-playtest-scenario
│       ↳ each Jetty child = 1 Daytona container
│         + 1 Playwright browser
│         + isolated cookies
├─ 4. poll all 10 trajectories until completed
└─ 5. fetch each child's stdout JSON → aggregate.json
```

Child workflow used: `tessera-playtest-scenario` (existing, proven). Each child receives one rendered instruction via `init_params.instruction` and runs ~10–15 minutes.

There IS a `tessera-playtest-orchestrator` task deployed on Jetty too, but it currently does nothing useful (parents 10 children that all get empty `init_params.instruction`). Kept around as a placeholder until `list_emit_await` is fixed; do not call it.

---

## How to invoke

```sh
./docs/playtest/run-orchestrator.sh
```

Env overrides:
- `TESSERA_URL` — defaults to `https://tessera.schaffters.com`
- `COMPLEXITY` — defaults to 5
- `DURATION_MIN` — defaults to 10

The script fires the 10 curls in sequence (each one returns immediately with a trajectory_id), then polls all 10 in parallel until they complete. Total wall-clock ≈ 15–20 min. Findings aggregated into `/tmp/orch-<timestamp>/aggregate.json`.

For a one-off run with a custom scenario:

```sh
TESSERA_URL=https://your-preview.vercel.app COMPLEXITY=8 DURATION_MIN=5 \
  ./docs/playtest/run-orchestrator.sh
```

---

## Output (`aggregate.json`)

Each child's JSON output is collected:

```json
{
  "trajectories": [
    {
      "name": "00-gm-facilitator",
      "trajectory_id": "abc12345",
      "report": {
        "scenario_id": "orchestrator-gm-facilitator",
        "outcome": "passed | partial | failed",
        "duration_sec": 720,
        "role": "gm",
        "name": "Facilitator",
        "pair_idx": null,
        "findings": [
          {
            "severity": "blocker | major | minor | nit",
            "area": "gm",
            "category": "bug | ux-confusion | slowness | copy | accessibility | visual",
            "title": "...",
            "detail": "...",
            "url_or_route": "/g/<CODE>/play",
            "evidence": "..."
          }
        ],
        "console_errors": [],
        "network_errors": []
      }
    }
  ]
}
```

The script also prints a console summary with finding counts grouped by severity.

---

## Cost expectations

Ten Sonnet containers running ~10–15 min each in parallel. Compute is the bulk of the cost; model usage is ten parallel agent sessions. Significantly more expensive than `tessera-playtest-scenario` solo runs — reserve for milestone playtests and post-major-refactor verification.

---

## When to use vs alternatives

| Need | Use |
|---|---|
| Real load + cookie-isolated 10-role test | `run-orchestrator.sh` (this) |
| Single scenario, quick iterate on copy / one bug | `tessera-playtest-scenario` directly |
| Adversarial code review | `tessera-tl` (auto-fires on PR open) |

---

## Known limitations

- **Voice channel is mocked.** Agents don't talk to each other; the guider doesn't actually describe the goal. The agents play their roles mechanically (placements per builder are random within constraints). Fine for layout / latency / pair-rename / super-power testing — **not** fine for "does the brief make sense" testing.
- **Jetty `list_emit_await` is broken** for our use case. Tracked in `memory/reference_jetty.md`. Until Jetty fixes the per-item value pass-through, fan-out has to live client-side.
- **No streaming aggregation.** The script waits for all 10 children to finish before aggregating, so total wall-clock is governed by the slowest child. A streaming variant (aggregate as each child finishes) would shave 2–3 min on average.
