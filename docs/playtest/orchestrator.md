# tessera-playtest-orchestrator — 10-role concurrent playtest

The orchestrator runs a full Tessera workshop end-to-end with **one agent driving 10 Playwright browser contexts** (1 GM + 3 builders + 3 guiders + 3 observers). Each context is an isolated cookie jar so role sessions don't bleed; the agent multiplexes its attention across them while the round runs.

**What it tests:**
- **Per-role UX** — what each role experiences during a round, captured as a per-role summary in the final JSON.
- **Concurrency / realtime** — pair-rename propagation, super-power broadcast, agile-share thumbnail updates across tabs.
- **Server-side load** — round-trip latency with 10 active sockets, snapshot fetch p95, broadcast fan-out timings (sampled in the agent's `latency_samples_ms`).

Use this when you've changed something system-level (realtime, scoring, layout) and want a real read before shipping. For a single-scenario quick playtest (one pair, one role focus), use `tessera-playtest-scenario` instead — it's lighter.

---

## Architecture

One step. One agent. One trajectory. No fan-out.

```
tessera-playtest-orchestrator
└─ play   runbook  → claude-sonnet-4-6 in a prism-playwright container with
                     8GB / 4 CPUs and Playwright MCP. The agent:
                       1. POSTs /api/games to create the workshop (no UI),
                          captures code + host_token from the response.
                       2. Opens 10 browser contexts, navigates each to its
                          role-specific page (host-recover for GM, /join
                          for the 9 players).
                       3. GM allocates 3 pairs + 3 observers, starts the round.
                       4. Drives all 10 tabs through their playbooks during
                          the round.
                       5. Aggregates per-role findings, console errors,
                          network errors, latency samples into ONE JSON
                          object on stdout.
```

Earlier iterations tried a multi-step fan-out via `list_emit_await` + a separate `tessera-playtest-player` child task. That design hit several Jetty quirks (`child_init_params` path expressions don't resolve at parent runtime, `extract_from_trajectories` schema-vs-runtime drift, `simple_judge` parameter name drift, etc.). Collapsing into one self-contained agent sidesteps all of them.

---

## Inputs (orchestrator init_params)

The deployed task has sensible defaults — you can fire it with `init_params={}`:

```json
{
  "tessera_url": "https://tessera.schaffters.com",
  "complexity": 5,
  "round_duration_sec": 600,
  "scoring_correct_pts": 10,
  "scoring_wrong_pts": -1,
  "workshop_name": "Orchestrator playtest",
  "max_roles": 10
}
```

The roster is hard-coded into the agent's instruction (1 GM + 3 builders + 3 guiders + 3 observers). The agent generates display names. If you want a custom roster, edit the instruction in `tessera-playtest-orchestrator.json` and re-deploy via PUT.

---

## Output (final stdout JSON)

```json
{
  "scenario_id": "orchestrator-c5-1round-10roles",
  "game_code": "ABC-123",
  "duration_sec": 720,
  "outcome": "passed | partial | failed",
  "executive_summary": "<one paragraph>",
  "per_role_summary": {
    "gm": "...",
    "builder": "...",
    "guider": "...",
    "observer": "..."
  },
  "latency_samples_ms": {
    "place_to_visible": [42, 38, 51, 47, 39],
    "broadcast_to_ui_update": [180, 165, 192],
    "pair_rename_propagation": [1180, 1240]
  },
  "concurrency_findings": [ "<latency or fan-out observation>" ],
  "scaling_findings": [ "<server-side perf observation>" ],
  "findings": [
    {
      "severity": "blocker | major | minor | nit",
      "role": "gm | builder | guider | observer | shared",
      "category": "bug | ux-confusion | slowness | copy | accessibility | visual | performance",
      "title": "...",
      "detail": "...",
      "corroborators": 2,
      "evidence": "screenshot path or console excerpt"
    }
  ],
  "console_errors": [],
  "network_errors": []
}
```

**Outcome rules:**
- `passed` — no blockers, ≤2 majors.
- `partial` — no blockers, 3+ majors OR any console error.
- `failed` — ≥1 blocker OR the agent did not complete the round.

---

## How to invoke

```sh
JETTY_API_KEY=$(grep '^JETTY_API_KEY=' /Users/schaffter/www/tessera/.env.local | cut -d= -f2)

# Fire with defaults — agent picks everything from its hard-coded scenario.
curl -X POST -H "Authorization: Bearer $JETTY_API_KEY" \
  -F 'init_params={}' \
  https://flows-api.jetty.io/api/v1/run/jettyio/tessera-playtest-orchestrator

# Or override defaults — write a JSON file, pass it via the `<file` form syntax.
echo '{"complexity": 7, "round_duration_sec": 900}' > /tmp/orch.json
curl -X POST -H "Authorization: Bearer $JETTY_API_KEY" \
  -F "init_params=</tmp/orch.json" \
  https://flows-api.jetty.io/api/v1/run/jettyio/tessera-playtest-orchestrator
```

**Curl form syntax matters.** Use `-F "init_params=<file"` (less-than only, no `@`). The `<@file` and `--form-string` variants silently fail to set init_params on Jetty's API — see `memory/reference_jetty.md`.

A run takes ~30–45 minutes (round_duration + setup + writeup). Watch the trajectory:

```sh
TRAJ=$(echo "$RESPONSE" | jq -r '.workflow_id' | sed 's/.*--//')
until [[ "$(curl -sS -H "Authorization: Bearer $JETTY_API_KEY" \
  https://flows-api.jetty.io/api/v1/db/trajectory/jettyio/tessera-playtest-orchestrator/$TRAJ \
  | jq -r .status)" =~ ^(completed|failed|cancelled)$ ]]; do sleep 60; done
```

The agent's stdout JSON is in the trajectory's agent log file:

```
https://flows-api.jetty.io/api/v1/file/jettyio/tessera-playtest-orchestrator/0000/<TRAJ>.runbook.0000.agent_claude-code.txt
```

Parse line-delimited JSON; the LAST `result` event holds the final aggregated JSON.

---

## Cost expectations

One Sonnet container running ~30–45 minutes. Compute is the bulk of the cost (8GB / 4 CPUs); model usage is moderate (one long agent session, not 10 parallel ones). Significantly cheaper than the original 11-container fan-out design, in exchange for less true-concurrent server load.

---

## Known limitations

- **Voice channel is mocked.** Agents don't talk to each other; the guider doesn't actually describe the goal. The agent plays each role mechanically (placements per builder are random within constraints). This is fine for layout / latency / pair-rename / super-power testing — **not** fine for "does the brief make sense" testing. Use `tessera-playtest-scenario` with a single-tab linguistic playtest for that.
- **Single-agent attention multiplexing.** The agent driving 10 tabs is faster than 10 humans but slower than 10 truly-parallel agents. Server load measurements are approximate, not stress-test grade.
- **Pair-name nudge timing** assumes the agent opens + closes each brief once; if the agent skips that on a tab, the modal won't fire there.
