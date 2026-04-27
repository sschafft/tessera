# Tessera — Design Patterns

Living canon of architectural patterns we've committed to in this codebase. Read this *before* introducing a new approach in an unfamiliar area; if you do introduce one, propose it here as part of the same PR. The `tessera-tl` adversarial review reads this file as the source of truth for "intended design" and flags drift.

---

## Status legend

- **canonical** — used in 3+ places, verified by playtests, do not deviate without consensus.
- **emerging** — pattern is forming, used in 1–2 places. Confirm before extending.
- **deprecated** — kept here so reviewers know to *replace* code that still uses it.

---

## Client-server data flow

### Optimistic UI with server reconciliation — *canonical*

For builder placements, brief envelopes, scoring tweaks, and other interactive primitives, the client never blocks on a roundtrip. The pattern:

1. Apply the change locally immediately (push onto an `optimistic` array, or merge into an `optimisticPatches: Map<id, Partial<T>>`).
2. Fire the API call.
3. On the broadcast / poll that follows, the GC effect drops the optimistic entry once `state.placements` (or whatever shape) echoes the same q/r/shape/color/etc.

**Why GC by content match, not by `tempId`:** removing the optimistic piece on POST-success leaves a flicker gap before the broadcast lands. Keeping it until the server-state visibly contains the new piece eliminates the gap. See `components/play/BuilderView.tsx` `place()` + the GC `useEffect` for the canonical implementation.

**Don't:** clear the optimistic state inside the `try` block. Don't apply optimistic state with `setState({...current, x})` — use functional updaters so you don't lose interleaved updates.

### Realtime broadcast triggers refetch — *canonical*

`publishGameEvent(game_id, kind, payload?)` fires from any mutating route (`placements`, `accelerants`, `scoring`, etc.). Clients subscribe via `useGameEvents(game_id, fetchSnapshot)`. The handler is a refetch, not a patch — broadcasts only carry the *fact that* state changed; the client refetches the canonical snapshot.

**Why refetch instead of carrying payloads:** every consumer (builder, guider, observer, GM) materializes a different view of the same game state. A snapshot endpoint per role keeps role-specific filtering server-side; the broadcast is just an "invalidate" signal.

**Polling fallback** at 30s catches dropped sockets / backgrounded tabs (browsers pause sockets aggressively). Don't poll faster — that defeats the realtime path.

### Single source of truth for scoring — *canonical*

`lib/scoring/score.ts` is the only scorer. Every consumer (`/api/games/[code]/test-solution`, `/api/games/[code]/play`, `/api/games/[code]/summary`) imports `scorePlacements` and uses `breakdown.score / .correct / .placements / .penaltyApplied`.

**Don't:** inline a duplicate scoring loop on a route "for performance". The scorer is O(N) and the goal pattern is bounded by complexity. The play route used to inline a copy of the scoring loop and silently diverged from the canonical formula — that was a bug.

### Rotation normalisation by shape symmetry — *canonical*

The goal generator produces `rot: 0..3` for every shape. Squares (and hexagons) look identical at every rotation; rhombi have 2-fold symmetry. The scorer's goalKey normalises rotation per shape so a "correct" placement isn't marked wrong because the goal happened to seed `rot: 2` and the builder placed `rot: 0`. See `normalizeRot()` in `lib/scoring/score.ts`.

If you add a new shape, add an entry to `normalizeRot` *before* it ships in the builder palette or goal generator.

---

## Component composition

### View / Panel / Modal / CTA / Bar / Badge suffixes — *canonical*

Names communicate role:
- `*View` — top-level role-scoped layout (`BuilderView`, `GuiderView`, `ObserverView`, `MasterPairView`).
- `*Panel` — secondary surface inside a view (`PairsPanel`, `BriefEnvelope`, `AccelerantsRail`).
- `*Modal` — overlay that takes the full screen with a focus trap (`EndGameModal`, `GeminiFallbackModal`, `PairNameModal`).
- `*CTA` — a single primary action surface (`JoinCallCta`, `TestSolutionCTA`).
- `*Bar` — horizontal control row (`PlayTopBar`, `EditingActionBar`, `TopBarControls`).
- `*Badge` — small inline pill (`PairNameBadge`, `RoleChip`).

Don't conflate. A modal with no overlay is a panel. A CTA that takes 8 inputs is a panel.

### Empty-state copy adapts — *canonical*

Empty / pre-event UI never uses generic "Loading…" or "No data". Copy speaks to *why* and *what comes next*:
- `LobbyWaiting` adapts based on whether a round is already in flight (`roundInFlight` prop).
- `RoundEndedView` differs from `GameEndedView` even though they share visual treatment.
- The MasterContent grid widens the lobby column when no participants exist so the share-link CTA dominates.

**Don't** ship a `Loading…` spinner where you can ship a message that explains the wait.

### Two-step destructive confirmations — *canonical*

For destructive actions (Clear all, End game, etc.), the first tap arms; the second tap commits, with a 3s timeout that disarms. See `BuilderView.tsx` `clearAll`. Keeps a single primary button visible on screen — no nested modals for trivial confirmations.

---

## State persistence

### SessionStorage for one-shot per-entity dismissals — *emerging*

PairNameModal uses `tessera_pair_name_dismissed_${pairId}` to remember "this player skipped naming this pair in this tab". Pattern:

```ts
const key = `tessera_<feature>_dismissed_${entityId}`;
if (window.sessionStorage.getItem(key) === "1") return;
// ... show
// on dismiss:
window.sessionStorage.setItem(key, "1");
```

Use sessionStorage (not localStorage) so a fresh-tab GM doesn't carry a previous workshop's dismissals.

### No localStorage for game state — *canonical*

Game state always comes from the server; the client is a view. The single exception is the player's session cookie (signed JWT), set by the join API.

---

## API surface

### Validation at boundaries, trust internal code — *canonical*

Server routes validate every field (shape ∈ enum, q/r in range, rot ∈ 0..3, code is alphanumeric, etc.). Once data is past the route handler, internal libs (`lib/scoring`, `lib/pattern`, `lib/game/repository`) trust their inputs.

**Don't** layer redundant validation across function calls. Don't add nullish guards on params your TypeScript types already say are non-null.

### Repository pattern with two backends — *canonical*

`lib/game/repository.ts` defines the interface; `repository.memory.ts` is the in-memory test double; `repository.supabase.ts` is the prod backend. `getRepository()` picks based on env. Routes never import a backend directly.

When you add a new mutation, update both implementations in the same PR.

### Surface failures with explicit recovery — *canonical*

When an external dependency (Gemini, Supabase, an external link) fails, return a typed error and let the UI offer named choices, not a 500 toast. `GeminiFallbackModal` is the reference implementation: failed_role + "Use preset briefs" / "Cancel" buttons.

Storage layer: do NOT swallow Supabase errors. Throw a typed error class; let the route map it to a 4xx/5xx with a stable error code.

### Allocation routes are kind-tagged unions — *canonical*

`POST /api/games/[code]/lobby/allocate` accepts a discriminated union: `{kind: "auto" | "auto_pairs" | "auto_observers" | "pair" | "observer", ...}`. Adding a new allocation strategy means a new `kind`, not a new endpoint. The `isAllocatePayload` type guard centralises validation per kind.

---

## Styling

### CSS variables via Tailwind v4 `@theme` — *canonical*

Color, spacing, and radius tokens come from `styles/tessera.css`'s `@theme` block: `var(--color-t-red)`, `var(--color-tint-red)`, `var(--color-paper)`, `var(--color-paper-2)`, `var(--color-line)`, etc.

**Don't** hard-code hex codes in component styles when a token exists. If you need a new token, add it once to `@theme` and re-use.

### Tint families for status — *canonical*

For each accent color the system has a `t-<color>` (the strong primary) and a `tint-<color>` (the tinted background). Status surfaces (success, warning, error) use the matching pair: `background: var(--color-tint-green); color: var(--color-t-green); boxShadow: inset 0 0 0 1.5px var(--color-t-green)`.

The negative-score live chip uses red; positive uses green; zero uses paper-2/ink-2/line. See `BuilderView.tsx` and `GuiderView.tsx` for the canonical derivation.

### Layout containers use flex with explicit `flex-shrink-0` for fixed columns — *canonical*

Right-rail columns (`BriefEnvelope` aside, AccelerantsRail) use `flex-shrink-0` with an explicit `width` so the canvas / main column gets `flex-1`. Don't use grid for two-column layouts where one column has variable content height — flex handles it more predictably.

---

## Sound

### Sound is opt-in and event-driven — *canonical*

`lib/sound.ts` exposes a small set of named sound functions (`playRoundEnd`, `playLastTwoMinutes`, etc). All audio fires through Tone.js after a single user-gesture-armed `enableAudio()` call. The first `pointerdown` arms it; subsequent calls are idempotent.

`PlayContent.tsx` watches state diffs (round status transitions, duration drops, game-end) and fires the matching sound. Sounds never fire from a route handler or as a side effect of a render.

If `state.sound_on === false`, every sound caller no-ops at the call site (not inside the function). The toggle should always feel instant.

---

## Realtime / concurrency

### Optimistic moves use field-level patches — *canonical*

`optimisticPatches: Map<id, Partial<PlacedPiece>>` lets us layer rotation, move, and convert mutations on a confirmed piece without losing identity. See BuilderView's `rotateEditing`, `moveEditingTo`, `convertPiece`.

The GC effect drops a patch entry once `state.placements[i]` has all the patched fields equal — i.e., the server caught up.

### Cookies are per-game, scoped by code — *canonical*

Each game's session lives in a cookie keyed by code (`tessera_session_${code}`). Multiple games can be active in the same browser. The home page reads "active games" via `/api/me/active-games` to show resume cards.

**Don't** store anything beyond the signed session JWT in cookies. Profile-style state goes through the server.

---

## Things we've deliberately *not* done

These are choices the playtests and tech-lead reviews keep nudging toward; we've rejected each and recorded *why*. If you're tempted to revisit, talk to the user first.

- **No on-platform voice/video.** External links only. (PRD §2 non-goals.)
- **No drag-and-drop for placements.** Tap-to-place is faster on a call where both hands are on a keyboard. Drag was tried and felt slow.
- **No accounts.** Cookie-only sessions per game. Persistent identity is out of scope.
- **No GraphQL / tRPC.** REST routes per `/api/games/[code]/<feature>` are easier to reason about and audit; we have ~25 routes, not 250.
- **No global state library (Redux / Zustand).** Each `*View` owns its slice; cross-view sync goes through the server. Prop-drilling tops out at depth 3.
- **No automated test suite (yet).** Tracked as tech debt by `tessera-tl`. Playtest agents currently fill the gap.

---

## How this doc evolves

- Anyone landing a structural change adds or amends an entry here in the same PR.
- `tessera-tl` (the adversarial review runbook) reads this doc as input. It surfaces deltas — new code that violates a canonical pattern, or new code introducing a fifth instance of an emerging pattern (which graduates to canonical).
- Promote `emerging` → `canonical` once the pattern has 3+ uses and a playtest has confirmed it. Demote to `deprecated` only when there's a written replacement.
