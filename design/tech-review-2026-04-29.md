# Tessera technical review · 2026-04-29

A robust, opinionated read of architectural decisions, pattern failures, code rot, inefficiencies, and simplification opportunities — grouped by **fix-now / fix-soon / live-with**.

---

## Top-level read

The codebase is in *good shape* for its age and pivot history. Strict TypeScript is honored (zero `any` outside two privacy/terms boilerplate words), strong separation of concerns (`app/` thin route handlers → `lib/<domain>/` business logic → repository pattern over Supabase), realtime + polling fallback is clean, and the test surface — while thin — is correctly placed (`scoring`, `superpowers/policy`, `briefs/orchestrator`).

The drag is concentrated in a few places: **two god components** (`BuilderView.tsx` 1486L, `MasterContent.tsx` 1080L), **a dead vestigial column** (`games.breakouts_enabled`), **three copies of the same placeholder-URL filter**, and **stale comments** referencing a 30-second polling cadence that is now 10s. These are *cheap* to fix and the codebase will read cleaner immediately.

---

## Fix-now (high signal, low cost)

### 1. Dead code: `breakouts_enabled` column + repository surface

The `games.breakouts_enabled` column is set on game-create (`provider !== "none"`), echoed into `GameRecord`, but **never read by any consumer**. The `setBreakoutsEnabled(game_id, enabled)` repository method has zero callers across the entire codebase. It's a vestige of the pre-`breakout_provider` era.

**Files**:
- `supabase/migrations/20260428100000_breakouts_and_google_tokens.sql:10` (column)
- `lib/game/repository.ts:42`, `:478` (`CreateGameInput.breakouts_enabled`, `setBreakoutsEnabled`)
- `lib/game/repository.supabase.ts:79`, `:130`, `:479-488`
- `lib/game/repository.memory.ts:90`, `:381`
- `lib/supabase/database.types.ts:148`, `:179`, `:210`
- `app/api/games/route.ts:179` (writes `breakouts_enabled: provider !== "none"`)

**Fix**: drop the field everywhere, write a migration to drop the column. Trivial diff, one less concept the next reader has to understand.

### 2. Three copies of the placeholder-URL filter

`PLACEHOLDER_HOSTS` + `isPlaceholderUrl` + `usable*Url` is duplicated in:
- `components/play/JoinCallCta.tsx:22-44`
- `components/play/PlayTopBar.tsx:106-126`
- `components/play/LobbyWaiting.tsx:17-32`

The most recent copy was added in PR #56 to fix a copy/CTA mismatch. Three copies means the next bug fix has three places to touch — and the prior round-3 bug was a divergence between two of the three.

**Fix**: extract to `lib/util/url.ts` (or `lib/google/urls.ts` since calls are the dominant URL surface). Single export, three import sites swap to it.

### 3. Stale comment: `30-second polling fallback`

`lib/realtime/publish.ts:12` claims the polling fallback is 30 seconds. It is **10 seconds** (`POLL_MS = 10_000` in both `PlayContent.tsx:158` and `MasterContent.tsx:110`). Comment last reflects the v1.0 rate; was tightened during the 2026-04-28 playtest cycle and the publish.ts comment didn't get the memo.

**Fix**: one-line edit. Same with `middleware.ts:21` if it references the old rate (didn't dig — worth checking).

### 4. CLAUDE.md stale claim about tests

CLAUDE.md says *"There is no unit/integration test suite."* But there ARE three vitest specs (`lib/scoring/score.test.ts`, `lib/superpowers/policy.test.ts`, `lib/briefs/orchestrator.test.ts`) and the `package.json` exposes `npm run test` / `test:watch` / `test:coverage`. The CLAUDE.md framing turns into an excuse to not write tests when one DOES exist.

**Fix**: rewrite that paragraph to reflect the real state — "vitest is set up; coverage is currently small (3 specs) but the hooks are there."

### 5. Diagnostic route still named `clerk`

`/api/diag/clerk/route.ts` reports env-var presence and is named `clerk` from a since-reverted Clerk pivot. The TDD calls this out as "kept for stable deeplinks" — but those deeplinks aren't external; they're test scripts the author maintains. Renaming `diag/clerk` → `diag/env` (or just `diag`) costs one path change and removes a confusing breadcrumb to a feature that no longer exists.

**Fix**: rename the route folder, update any internal references (none in the product code path; just in CLAUDE.md and TDD).

---

## Fix-soon (worth the effort, plan for it)

### 6. `BuilderView.tsx` is a 1486-line god component

51 hook calls, 13 inline sub-components (`TestSolutionCTA`, `ModeBanner`, `ModeButton`, `EditingActionBar`, `Tray`, `Palette`, `Tools`, `PrototypeOverlay`, `WaitingForRound`, `PartnerReadyChip`, etc.). Half of these don't depend on Builder-specific state and could move out:

- `Tray`, `Palette`, `Tools` → `components/play/builder/Tray.tsx` (or shared with the play flow)
- `TestSolutionCTA` → standalone (already passing in props; trivial extract)
- `WaitingForRound`, `PartnerReadyChip` → `components/play/lobby/` or near `LobbyWaiting`
- `PrototypeOverlay` → near the canvas primitives

**Why it matters**: the file is the dominant complexity sink in the codebase. Compile times, IDE navigation, and the cognitive cost of touching builder logic all degrade with it. Decomposition has zero behavior risk; it's pure file-level reshuffle.

### 7. `MasterContent.tsx` is the GM-side mirror of the same problem

1080 lines, 38 hooks, but only 3 inline sub-components (`SetupStep`, `FocusedPairPlaceholder`, the main export). The bulk of the bloat is *callbacks* — `allocate`, `triggerAccelerant`, `clearBreakouts`, `generateBreakouts`, `updateScoring`, `confirmEndGame`, `dismissOauthBanner`, etc. These are all "send a POST then refetch" — a near-perfect candidate for a `useGameAction(code, fetchSnapshot)` hook that takes endpoint + body and handles the busy/error/refetch ceremony.

**Refactor sketch**:
```ts
const action = useGameAction(code, fetchSnapshot);
const allocate = (body) => action.post('/lobby/allocate', body);
const triggerAccelerant = (kind, scope, pairId, payload) =>
  action.post('/superpowers', { kind, scope, pair_id: pairId, payload });
```
Cuts ~200 lines, clarifies the action shape across the whole file.

### 8. Type drift between the lobby route and `MasterContent`

`MasterContent.tsx:22-98` defines `LobbyParticipant`, `LobbyPair`, `LobbyResponse`, `SuperPowerEvent` — the *client-side* shape of the `/api/games/[code]/lobby` response. The route handler at `app/api/games/[code]/lobby/route.ts:135-200` constructs this same shape inline. **Two definitions, no shared types.** If the route adds a field, client must remember to mirror — or vice versa.

**Fix**: extract to `lib/game/lobby-response.ts` (or `app/api/games/[code]/lobby/types.ts`). Both sides import. Compile-time safety reappears.

Same pattern likely exists for other mutation endpoints' response shapes.

### 9. Repository interface is too wide (50 methods)

`lib/game/repository.ts` has ~50 methods spanning game, participant, pair, round, pair_round, placement, brief, super-power, library, scoring, breakouts, gemini-budget. It IS the database surface, but a 50-method interface is hard to keep two backends in sync (memory + supabase) — and several recent additions (e.g., `setPairBreakout`, `setPrototypeUntil`, `captureBuilderSnapshot`) have already shipped with thin "just-the-supabase-impl" calls and a memory equivalent that's mechanical-mirror.

**Sketch**: split into sub-repositories that GameRepository composes:
```ts
interface GameRepository {
  games: GameStore;
  participants: ParticipantStore;
  pairs: PairStore;
  rounds: RoundStore;
  briefs: BriefStore;
  superPowers: SuperPowerStore;
  // …
}
```
Each store gets ~5–8 methods and is independently mockable. Decomposition is mechanical (most methods are independent).

### 10. `accelerant_events` table + `accelerant_t` enum naming holdover

The table is `accelerant_events`, the enum is `accelerant_t`, but the UI and TypeScript layer have been called `super_powers` for many milestones. The TDD §15.4 explains the holdover ("renaming the DB table would require a migration we've decided not to ship"), but this is the kind of name-skew that lands a bug every time someone greps for one term and misses the other:

```
$ grep -rn "accelerant\|super.power" lib/ components/ app/
[hundreds of results, half each, must read both]
```

A migration `rename table accelerant_events to super_power_events` + `rename type accelerant_t to super_power_kind` is a one-time cost that pays back forever. Same vintage as `vocab_swap` (the enum value that's labeled "Change guider brief" everywhere user-visible).

### 11. All 30 API routes pin `runtime = "nodejs"`

Many of these routes don't use Node-specific APIs:
- `lobby`, `play`, `summary`, `briefs/reroll`, `placements`, `lobby/allocate`, etc. don't import `bcryptjs`, `crypto.randomUUID()` (Edge has it), or anything filesystem.

Moving them to the Edge runtime would cut cold-start latency materially on Vercel free-tier. The auth flows (`host-recover`, `recover`, `auth/google/*`) DO need node (bcryptjs, jose with HS256 is OK on Edge actually but `arctic` may not be). Worth an audit.

**Note**: this is a perf optimization, not pure rot. Defer until you see a perf regression.

---

## Live-with (acknowledge but don't fix yet)

### 12. Brief-source labels don't always match enum values

Database enum: `('library', 'gm', 'gemini')`. UI labels: "Library", "Custom", "AI". The `brief_source = 'gemini'` label is the umbrella for OpenAI OR Gemini (with the router preferring OpenAI, fallback to Gemini, fallback to library). The TDD calls this out as intentional. Documented = OK.

### 13. The lobby route does N+1 queries inside `Promise.all`

Lines 80-118 do `pairs.map(async (pair) => { ... await repo.findPairRound(...); await repo.listPlacements(...) })`. For 5 pairs × 1 round, that's 10 round trips. The repository.supabase backend doesn't appear to batch these.

For workshop scale (~3-5 pairs, polled every 10s) this is fine — well under the connection pool. For a future "tournament" workshop with 25 pairs it'd warrant a single-query JOIN. **Not blocking now**; flag for the day someone runs a 50-player game.

### 14. `bonus rounds` past `round_count` cap

The DB constrains `round_count between 1 and 5` (seed migration). The TopBarControls UI happily runs `Start bonus round 6 →` after the planned count, creating new `rounds` rows. The constraint is on the original **plan**, not the actual ceiling. Slightly counterintuitive to read on the games table — `round_count = 3` but six rounds exist on the rounds table. Consider renaming `round_count` → `planned_round_count` in a future migration if the bonus path stays.

### 15. Marketing pages use raw color tokens via inline `style={{}}`

The `marketing/ContentLayout.tsx` uses `style={{ background: "var(--color-paper)" }}` etc. Tailwind v4's `@theme` token system can express the same with a class, but the inline-style approach is consistent with the rest of the codebase's "design-token discipline." Not pretty, but OK.

---

## Specific opportunities (more granular than the above)

| # | Path | What | Why |
|---|---|---|---|
| A | `lib/realtime/publish.ts:12` | Stale "30-second polling" comment | Misinformation in the only file that documents the fallback strategy |
| B | `app/api/games/route.ts:179` | `breakouts_enabled: provider !== "none"` | Dead-write |
| C | `lib/game/repository.ts:42`, `:478` | `breakouts_enabled` field + `setBreakoutsEnabled` method | Dead-read |
| D | Three placeholder-URL filters | Triple-implementation | DRY violation |
| E | `MasterContent.tsx:22-98` | LobbyResponse/Participant/Pair re-defined client-side | Type drift risk |
| F | `BuilderView.tsx:1177`, `:1242`, `:1288` | `Tray`, `Palette`, `Tools` inline | Decomposition target |
| G | `app/api/diag/clerk/` | Path named after a removed integration | Confusing for new readers |
| H | CLAUDE.md "no test suite" claim | Wrong | Active disincentive to add tests |
| I | `BuilderView.tsx:48` `cellLabel` | One-off helper inside a 1500-line file | Should live with `lib/grid/coords.ts` |
| J | `setBreakoutsEnabled` repo method | Zero callers | Pure dead method |
| K | `accelerant_events` table | 18-month-old naming holdover | Cognitive cost compounds |

---

## Things the codebase gets right (worth preserving)

- **Repository pattern**, even if interface is wide, gives the memory backend that's been useful for tests + dev environments.
- **`server-only` imports** on every server-side module — solid hygiene, prevents leaking server modules to client bundles.
- **Strict type safety** — zero `any`, all enum-like states are union types or DB enums.
- **Realtime + polling-fallback** is the correct shape. Topic name keyed on unguessable `game_id` is the right call vs. RLS-on-realtime.
- **Repository signatures use named-arg objects** for multi-arg operations (`createPlacement({ pair_round_id, shape, color, q, r, ... })`), which makes call sites self-documenting and migrations safer.
- **Atomic counter RPCs** for race-prone increments (`reserveGeminiCall`, `incrementSharesRemaining`) — read-modify-write was avoided where it would matter.
- **Fixed `runtime = "nodejs"` declaration on every route** is verbose, but it makes the runtime explicit and prevents accidental Edge deployment of an Edge-incompatible route.
- **No drag-and-drop for placements**. Codified in `design_patterns.md`. Right call — touch + tap-to-place is faster and works on every device.

---

## Recommended PR sequence

If you want to tackle the fix-now items, here's a low-risk order:

1. **PR-A**: rip `breakouts_enabled` (column + repo surface + DB migration). Mechanical diff, ~10 file touches.
2. **PR-B**: extract `lib/util/url.ts` with the placeholder filter; update three call sites. Trivial.
3. **PR-C**: stale-comment sweep (`publish.ts`, `middleware.ts`, CLAUDE.md). 5-line PR.
4. **PR-D**: rename `diag/clerk` → `diag/env`, update internal refs.
5. **PR-E**: extract `LobbyResponse` types from `MasterContent.tsx` to a shared module, import on both sides. Single PR, breaks the type-drift risk.

Items 6-11 (god components, repo split, table rename, runtime audit) are bigger and benefit from dedicated PRs. Worth scheduling as a "tech debt sprint" rather than slipping into feature work.

---

*Generated by Claude — 2026-04-29 review. Cross-reference with `design/design_patterns.md` before promoting any pattern from "emerging" to "canonical".*
