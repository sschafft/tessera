# tessera-tl — Adversarial Tech-Lead Review (runbook)

`tessera-tl` is the Jetty workflow that runs an opinionated tech-lead /
architecture review of the Tessera codebase. It does **not** drive a
browser; it clones the repo, reads the canonical design docs (PRD, TDD,
`design/design_patterns.md`), then walks the code looking for drift,
hot spots, and tech debt.

Run it after **major refactors**, **architectural changes**, or before
significant feature batches — anything that might introduce drift from
the patterns in `design/design_patterns.md`. Light bug fixes and copy
tweaks don't need it.

The agent is briefed to be *adversarial*: it should call out problems,
not pat us on the back.

---

## Inputs (init_params)

```json
{
  "branch": "main",
  "focus_areas": ["scoring", "realtime", "builder canvas"],
  "include_tests": false,
  "max_findings": 25
}
```

- **branch** — git ref to check out (default: `main`).
- **focus_areas** — optional hint list. Empty array = whole codebase.
  If specified, the agent prioritises but does not skip everything else.
- **include_tests** — when true, the agent runs `npm run lint` +
  `npx tsc --noEmit` + the build and includes their output in findings.
- **max_findings** — caps the output array length (default 25). Lower
  to force the agent to triage; higher for a deep dive.

---

## Output (stdout JSON, last block parsed)

```json
{
  "branch": "main",
  "commit_sha": "3d929c3...",
  "summary": "<one paragraph executive summary>",
  "findings": [
    {
      "severity": "critical | major | minor | nit",
      "category": "architecture | performance | testing | security | code-smell | docs-drift",
      "title": "Short headline",
      "files": ["lib/scoring/score.ts:42-58"],
      "detail": "What's wrong and why it matters.",
      "violation_of": "design_patterns.md > Optimistic UI",
      "suggestion": "Concrete change to make. Inline a unified diff if obvious.",
      "diff": "<unified diff or null>"
    }
  ],
  "patterns_to_promote": [
    { "name": "...", "from": "emerging", "to": "canonical", "rationale": "..." }
  ],
  "patterns_to_add": [
    { "name": "...", "where_used": ["file:line"], "rationale": "..." }
  ],
  "tech_debt_register": [
    { "title": "No test suite", "owner": "open", "estimated_effort": "L" }
  ]
}
```

- **violation_of** — required when category is `architecture` or
  `code-smell`. Must reference a section in `design/design_patterns.md`.
  If the pattern doesn't yet exist there, file it under
  `patterns_to_add` instead.
- **diff** — optional unified diff. Only fill it for unambiguous fixes
  (typos, missing memoisation, redundant validation). Architectural
  changes go to `suggestion` text + the GM decides.

---

## Setup steps the agent runs

```sh
git clone https://github.com/sschafft/tessera.git /tmp/repo
cd /tmp/repo
git checkout {{branch}}
npm install --no-audit --no-fund
# only if include_tests=true:
npx tsc --noEmit > /tmp/tsc.log 2>&1 || true
npm run lint > /tmp/lint.log 2>&1 || true
npx next build > /tmp/build.log 2>&1 || true
```

The agent treats lint / tsc / build output as evidence, not as gating —
findings are reported with severity tags regardless of pass/fail.

---

## Agent prompt (rendered into the workflow `instruction`)

```
You are an adversarial principal-level tech lead reviewing the Tessera
codebase. Your goal is to surface real problems — architectural drift,
performance hot spots, testing gaps, security smells — that the team
won't catch through normal PR review. Do NOT pad the review with
"looks good" notes; if a section is clean, skip it.

Inputs you have:
- Repo cloned at /tmp/repo on branch `{{branch}}`.
- Focus hints: {{focus_areas}} (empty means whole codebase).
- include_tests = {{include_tests}}; lint/tsc/build logs at
  /tmp/lint.log /tmp/tsc.log /tmp/build.log when applicable.

Required reading (do this first):
1. /tmp/repo/design/PRD.md — what we're trying to build.
2. /tmp/repo/design/TDD.md — how we said we'd build it.
3. /tmp/repo/design/design_patterns.md — canonical / emerging /
   deprecated patterns. This is your "source of truth" for what counts
   as drift. Cite section names when calling out violations.

Walk the codebase. Categories to target, in priority order:
1. Architecture drift — code that violates a canonical pattern.
2. Performance — N+1 queries, unmemoised hot loops, unnecessary
   re-renders, oversized payloads, missing DB indices.
3. Realtime correctness — race conditions, stale-state UI, broadcast
   misses, optimistic state that won't reconcile.
4. Security — input validation gaps, XSS via dangerouslySetInnerHTML,
   missing role checks on routes, SSRF in URL fields.
5. Testing gaps — features without verification paths. The codebase
   currently has zero unit/integration tests; flag the highest-leverage
   places to add them first.
6. Code smell — duplicated logic across files, dead code,
   inconsistent naming, leaky abstractions.
7. Docs drift — TDD/PRD claims that no longer match shipped code.

For each finding:
- Be specific. "components/play/BuilderView.tsx:177-216" beats
  "Builder logic could be cleaner".
- Cite the design_patterns.md section the code violates (or propose
  a new pattern in patterns_to_add[]).
- Mark severity honestly. Most findings will be minor / nit. Reserve
  critical for things that could cause data loss, security breach,
  or "this will fall over with > 4 concurrent pairs".
- If the fix is unambiguous, include a unified diff. Otherwise leave
  diff null and write the change as plain text in suggestion.

Cap your output at {{max_findings}} findings. If you have more, triage
to the highest-impact ones and note "additional findings omitted —
re-run with higher max_findings" in summary.

The final action of your run MUST be a single JSON object printed to
stdout matching the output schema below. Anything else (notes, scratch
work) goes above the JSON. The parser reads only the LAST valid JSON
object.

[output schema as above]
```

---

## How to invoke

```sh
JETTY_API_KEY=$(grep '^JETTY_API_KEY=' /Users/schaffter/www/tessera/.env.local | cut -d= -f2)

cat > /tmp/tessera-tl-init.json <<'EOF'
{
  "init_params": {
    "branch": "main",
    "focus_areas": [],
    "include_tests": true,
    "max_findings": 30
  }
}
EOF

curl -X POST \
  -H "Authorization: Bearer $JETTY_API_KEY" \
  -F "init_params=<@/tmp/tessera-tl-init.json" \
  https://flows-api.jetty.io/api/v1/run/jettyio/tessera-tl
```

Read the trajectory:

```sh
curl -H "Authorization: Bearer $JETTY_API_KEY" \
  https://flows-api.jetty.io/api/v1/db/trajectory/jettyio/tessera-tl/<TRAJ_ID> | jq .
```

The agent's full claude-code log is at:

```
https://flows-api.jetty.io/api/v1/file/jettyio/tessera-tl/0000/<TRAJ_ID>.runbook.0000.agent_claude-code.txt
```

---

## When to run

- **After major refactors** that touch a system-level concern (auth,
  scoring, realtime, layout). The PR description should note that a
  tessera-tl run was performed and link the trajectory.
- **Before a milestone bundle** lands on prod — last-line-of-defence
  for drift between what the PRD/TDD claim and what's shipped.
- **When a playtest finding is structural**, not just a UX nit — pair
  the playtest report with a tessera-tl run focused on the affected
  area.

Don't run for:
- Single-component CSS tweaks.
- Pure copy edits.
- Bug fixes with a clear root cause + test plan.
- Routine dep bumps.
