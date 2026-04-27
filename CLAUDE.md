# Tessera — Claude project guide

This file is read at the top of every Claude Code session for this repo. Keep it short, actionable, and current. If you find yourself documenting "what we did", that goes in `design/PRD.md` or `design/TDD.md` instead.

---

## What this is

Tessera is a no-login facilitation game (Next.js 16 App Router, Supabase, Vercel, Tailwind v4). Pairs of **builders** and **guiders** rebuild a target geometric pattern they can't both see while a **game master** runs the room from a dashboard. All voice/video/whiteboard happens off-platform.

See `design/PRD.md` (intent) and `design/TDD.md` (architecture). Read those first if you're new.

---

## Where things live

```
app/                     # Next.js routes (pages + API)
components/              # React components, organised by surface
  canvas/                # Tile / PlayCanvas / InteractiveCanvas
  play/                  # BuilderView, GuiderView, ObserverView, etc.
  master/                # GM dashboard pieces
  primitives/            # Reusable atoms (Field, Avatar, Wordmark, etc.)
  landing/               # Home + tabs
lib/
  game/                  # Repository pattern (memory + supabase impls)
  pattern/               # Goal generator + palette + types
  scoring/               # scorePlacements (single source of truth)
  briefs/                # Gemini + library + orchestrator
  realtime/              # publishGameEvent + useGameEvents
  auth/                  # Cookie session + JWT signing
  grid/                  # Coordinate helpers (gridSizeFor, etc.)
  sound/                 # Tone.js helpers
design/
  PRD.md                 # Product requirements
  TDD.md                 # Technical design
  design_patterns.md     # Canonical / emerging / deprecated patterns ⭐
docs/
  playtest/
    runbook.md           # Multi-role playtest scenario runbook
    tessera-tl.md        # Adversarial tech-lead review runbook
```

⭐ **Read `design/design_patterns.md` before introducing a new architecture pattern.** If you do introduce one, propose it as a new entry there in the same PR.

---

## Workflow expectations

### Bundle work into a PR — don't push to `main`

All non-trivial work lands via pull request. Reasons:

- The `tessera-tl` GitHub Action (`.github/workflows/tessera-tl.yml`) auto-runs the adversarial review on every PR `opened` / `synchronize` and posts findings as a PR comment. Pushing straight to main bypasses it.
- A PR concentrates the diff so the review has a focused surface area; review-on-main would re-scan the whole codebase every commit.
- It also concentrates *your* attention: bundle related changes (e.g. "scoring + brief envelope + GM polish") rather than landing them as 8 separate commits on main.

When you start a substantial change: `git checkout -b <slug>`, make commits, open a PR. Skip the review on a specific PR by including `[skip-tl]` in the PR title or marking the PR as draft (good for WIP / spike PRs).

### After a major refactor or system-level change

1. **Refresh `design/PRD.md` + `design/TDD.md`.** If a behaviour changed, the PRD must reflect it. If the implementation diverged from TDD, update the TDD and note the why. Stale design docs are how drift starts.
2. **Open a PR.** The tessera-tl action runs automatically and comments on the PR. Address blockers + majors before merging; minors / nits land as follow-up issues.
3. **Update `design/design_patterns.md`** with any new pattern this change introduces, or any pattern that just hit its third use (promote `emerging` → `canonical`). Patterns the action proposes (`patterns_to_add`) need a human decision before they're added.

Skip the action for: copy edits, single-component CSS tweaks, bug fixes with a clear root cause and a test plan, routine dep bumps. Use `[skip-tl]` in the PR title for these.

### Manual tessera-tl runs

You can trigger a one-off review against any branch via the workflow's `workflow_dispatch` trigger (Actions → tessera-tl review → Run workflow). Useful for ad-hoc audits without opening a PR.

### After a playtest reveals UX issues

1. Apply fixes in the same PR as the playtest report.
2. If the finding is structural (not just a copy nit), pair the playtest with a tessera-tl run focused on the affected area.
3. Update `design/design_patterns.md` if the fix codifies a new pattern.

### When introducing optimistic UI / realtime / scoring code

Read `design/design_patterns.md` sections "Optimistic UI with server reconciliation" and "Realtime broadcast triggers refetch" first. The patterns there were paid for in stutter bugs and race conditions; please don't reinvent them.

---

## Build + verify commands

```sh
npm run dev          # next dev — local server on :3000
npm run build        # next build — production build (run before commits that touch routes)
npm run lint         # eslint
npx tsc --noEmit     # type-check (no formal `check` script yet)
```

There is no unit/integration test suite. UX verification flows through:
- `tessera-playtest-scenario` (single-scenario, multi-role browser playtest via Jetty)
- `tessera-playtest-orchestrator` (10-player concurrent simulation)
- `tessera-tl` (codebase review)

Adding a real `vitest` suite is on the tech-debt register; if you touch `lib/scoring`, `lib/pattern`, or `lib/grid`, those are the highest-leverage places to start.

---

## Jetty (playtest automation + PR review)

- **Local API key:** `JETTY_API_KEY` in `.env.local`. Read with `grep '^JETTY_API_KEY=' .env.local | cut -d= -f2`.
- **CI secret:** GitHub repo secret `JETTY_API_TOKEN` (same value as the local key) is used by `.github/workflows/tessera-tl.yml` to trigger the review on PRs. Add it under repo Settings → Secrets and variables → Actions.
- **Collection:** `jettyio` (account id 29037).
- **Tasks:**
  - `tessera-playtest-scenario` — runs one scenario across role tabs in Playwright. See `docs/playtest/runbook.md`.
  - `tessera-playtest-orchestrator` — fan-out runner that simulates 10 concurrent players + GM, aggregates per-player UX feedback, measures scaling. See `docs/playtest/orchestrator.md`.
  - `tessera-tl` — adversarial code review. See `docs/playtest/tessera-tl.md`.
- **Trigger pattern:**
  ```sh
  curl -X POST -H "Authorization: Bearer $JETTY_API_KEY" \
    -F "init_params=<@/tmp/init.json" \
    https://flows-api.jetty.io/api/v1/run/jettyio/<task-name>
  ```
- **Read trajectory:**
  ```sh
  curl -H "Authorization: Bearer $JETTY_API_KEY" \
    https://flows-api.jetty.io/api/v1/db/trajectory/jettyio/<task-name>/<TRAJ_ID>
  ```

The Playwright snapshot's Chromium binary is missing — agents must run `npx --yes playwright install chromium` before any browser tool, and pass `--browser chromium` to the Playwright MCP server.

---

## Style conventions

- TypeScript strict mode is on. No `any` unless commented why.
- Tailwind v4 with `@theme` tokens. **Use CSS variables (`var(--color-t-red)`) not hex codes** in component styles.
- Component naming follows the `*View / *Panel / *Modal / *CTA / *Bar / *Badge` taxonomy in `design/design_patterns.md`.
- Default to no comments. Add one only when *why* is non-obvious.
- Keep route handlers thin: validate, dispatch to a `lib/` function, broadcast, return.
- Shared types live in `lib/<domain>/types.ts` or co-located with the route they belong to.

---

## When in doubt

- Pattern questions → `design/design_patterns.md`.
- "What does X do?" → `design/TDD.md` then the source.
- "Why X?" → `design/PRD.md` + git log.
- UX verification → run a playtest scenario, not assumptions.
