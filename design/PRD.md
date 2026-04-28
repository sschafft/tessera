# Tessera — Product Requirements (PRD v1.1)

> **Status:** v1.1 shipped 2026-04-27. Builder canvas rewritten on a
> complexity-scaled square grid, scoring system added, super-power
> deck reworked, brief-open gate, pair self-naming, GM debrief
> prompts, time extension + last-2-min drama. v1.0 highlights still
> apply: cookie-based resume on home, How-it-works + Facilitator-guide
> pages, GitHub link + OSS footer, custom briefs, Gemini brief
> generation, host recovery, role-pill palette, game-end leaderboard.
> **Sources:** User brief + Claude Design handoff bundle (`Tessera
> mockups.html`, 5-screen prototype) + chat transcript with the design
> assistant + v1.1 playtest follow-ups.

## v1.1 changelog (key product changes from v1.0)

- **Square grid scales with complexity.** 3×3 at c=1 up to 9×9 at
  c=8; replaces the fixed 9×7 envelope. (§6.4, §6.5)
- **Builder palette trimmed** to 4 fixed shapes (sq, tri-up, rhomb,
  trap) and a 3..6 colour set sized to complexity. Hex was dropped
  during v1.1 alpha — it rendered identically at every 90°
  rotation step on the square grid, so the rotation tool was a no-op
  for hex pieces. Same palette powers the goal generator. (§6.4)
- **Optimistic builder UI.** Local React state is the source of truth
  during a round; debounced server sync. Place / move / rotate /
  convert / delete all feel instant. (§6.4, TDD §X1)
- **Tap-cell flow with overwrite.** Tapping an occupied cell while a
  shape is selected converts the piece in place. Otherwise enters
  edit mode for that piece. (§6.4)
- **Rotation increments are 90° in 4 steps** (was 60° / 6 steps).
- **Test solution + scoring.** Builder-triggered "Test solution" CTA
  computes the score against the goal at any time. Default 10 pts
  per correct, 0 penalty; GM-tunable per-wrong penalty −10..0 (each
  wrong placement subtracts `wrong_pts` from the total — scores can
  go negative). Per-round scores sum into a game-end leaderboard.
  (§6.11)
- **Super-power deck reshaped.** Vocab swap → "Change guider brief";
  new "Change builder brief" mirror; both unlimited. New "Make it
  harder" / "Make it easier" — re-roll the goal at complexity ±1
  while pinning the round's grid. Scoring tile (per-correct stepper +
  Punish Wrong toggle). Prototype glimpse duration is now adjustable
  in 3s/5s/10s/15s. (§6.3)
- **Time extension.** GM gets +30s / +1m / +2m chip buttons next to
  the timer; new POST /rounds/extend endpoint. Last-two-minutes
  triggers a red timer pulse + a single warm chime. (§6.6)
- **Brief-open gate.** Builder + Guider canvases are gated behind a
  glassy overlay until the player taps their sealed envelope. The
  envelope itself pulses while the gate is up. The "don't disclose
  contents — answer Yes/No questions" framing is reinforced both on
  the gate and inside the open envelope. (§6.2, §6.9)
- **Pair self-naming.** Pairs can pick a name ("The Pelicans"); falls
  back to "<builder> ↔ <guider>" until set. Editable from BuilderView
  + GuiderView. (§6.10)
- **GM debrief prompts.** Game-end view ships with three suggested
  retro questions to seed the post-game conversation. (§5.6)
- **Surface failures with explicit recovery.** Gemini brief failures
  now show a modal with "Use preset briefs" / "Cancel" instead of
  500'ing. Orphan pending rounds auto-clean on retry. (§6.2)
- **Player recovery URLs.** Every join mints a one-shot recovery
  token (mirrors GM `host_token`). Plain token shown once in a "save
  this URL" modal post-join + saved to localStorage as a fallback.
  Players whose session cookie gets clobbered (multi-tab on shared
  devices, browser restart, mobile foreground swap) can paste the URL
  on `/recover/<code>` to reclaim their seat with the same display
  name + role. The `name_taken` join error also surfaces a CTA to the
  recovery page. (§6.1)
- **GM session-lost recovery banner.** `/api/games/[code]/lobby` now
  surfaces 401/403 to the GM dashboard as an explicit "your facilitator
  session was lost" banner with a one-click link to `/host-recover/<code>`,
  instead of silently rendering an empty lobby. The same pattern lights
  up on player views when /play 401/403s. (§6.13)
- **GM-on-/play graceful redirect.** When a GM session cookie hits
  the player URL (e.g. shared-cookie tooling, GM bookmarks the player
  link by mistake), the polling loop now follows the typed
  `gm_should_use_master` error to push the GM into `/master` instead
  of looping silently on 400s. (§6.13)
- **Vercel Analytics** mounted in the root layout.

---

## 1. One-line pitch

Tessera is a no-login facilitation game for hybrid workshops. Pairs of **builders** and **guiders** collaborate over an off-platform video call to recreate a target geometric pattern they can't both see — while a **game master** observes the room and triggers in-game mechanics that surface lessons about communication, prototyping, and shared context.

The platform is intentionally a *scaffold* for the conversation, not a chat tool. All voice/video/whiteboard happens off-platform (Meet, Zoom, Miro, etc.); Tessera links out to those.

---

## 2. Goals & non-goals

### Goals
- Make it trivial to start and join a game (no accounts, just a 6-char code + display name).
- Give a game master a single dashboard to run the room: lobby, allocation, briefs, mechanics, timing.
- Make the build interaction tactile and forgiving — drag pieces onto a grid, snap into place, see what's "correct" only when the GM enables it.
- Use the game's mechanics (briefs, accelerants) to make agile/communication concepts *felt* rather than lectured.

### Non-goals (v1)
- **No on-platform chat, voice, or video.** External links only.
- **No accounts, no email, no SSO, no password reset.** Participation is per-game and ephemeral.
- **No mobile.** Desktop-first at 1440px (design's target). Tablet may work but is unsupported.
- **No persistent game history / replay.** A finished game can be re-entered briefly but is auto-purged (see §6.5).
- **No native app, no offline.** Web only.

---

## 3. Personas & roles

| Role | Required? | What they see / do |
| --- | --- | --- |
| **Game master** | Always 1 per game | Creates the game; sets complexity, briefs, optional mechanics; allocates lobby into pairs and observers; triggers accelerants per pair or globally; controls the timer and ends rounds. Birds-eye view across all pairs. **GM is GM only — cannot also fill a Builder/Guider/Observer slot.** |
| **Builder** | ≥1 per game (always paired) | Drags geometric tiles onto a canvas to recreate a target they cannot see. May have a secret "translation" brief. |
| **Guider** | ≥1 per game (always paired with a Builder) | Sees the goal pattern; describes it to their builder over the off-platform call. May have a secret "constraint" brief (e.g. nautical vocab only). |
| **Observer** *(optional)* | 0..N per pair | Read-only spectator assigned to one pair; sees both the builder canvas and the goal. Can switch between pairs from a bottom strip. |

**Minimum viable game:** 1 GM + 1 Builder + 1 Guider (3 people).
**Pairing rule:** Builders and Guiders must be even — every Builder has exactly one Guider partner.

---

## 4. Visual design system

The design is locked-in via the Claude Design handoff. Implementation must match it pixel-faithfully.

- **Name & tone:** Tessera — playful, toy-like, "game first."
- **Palette:** Warm paper surfaces (`#fbf6ed`) with bright primaries — red `#ee3a3a`, orange `#ff8a1f`, yellow `#f5c518`, green `#46b86a`, blue `#2c7be8`, purple `#7e54d8`, pink, teal. Soft tints for cards/chips.
- **Type:** Fraunces (display, large headlines), DM Sans (UI body), JetBrains Mono (codes, timers, brief metadata).
- **Shape language:** Chunky radii (8–32px), soft layered shadows plus a "chunky" 4px-offset toy-button shadow (`--sh-chunky`).
- **Distinctive components:**
  - **Sealed envelope** (`.t-envelope`) — used to present a player's secret brief; tap to open.
  - **Stamp** (`.t-stamp`) — rotated mono badge for "● THE GOAL" etc.
  - **Hatched / dotted backgrounds** for canvases.
  - **Accelerant buttons** — chunky toy-button style only (other variants in the design were dropped).
- **Tessellation grid** background under canvases (triangular by default; square/hex are tweaks).

Tokens live in `./tessera/project/tokens.css` (alongside this PRD) — port these into our Tailwind config + a small layer of bespoke CSS for envelope/stamp/chunky-shadow utilities.

---

## 5. Screens (from the handoff bundle)

### 5.1 Landing (`/`)
Two-tab card: **Host a game** | **Join a game**.
- Host: workshop name, video call link (required), whiteboard link (optional), team-assignment mode (`Game master picks` | `Players pick`), complexity slider 1–8 with a complexity-hint string, builder-brief on/off, guider-brief on/off → button "Create game · get code →".
- Join: 6-char game code (auto-uppercased, e.g. `HEX-934`), display name (must be unique within the game).
- Decorative tiles scattered around the hero, big "no logins!" sticker, 4-step process strip below.

### 5.2 Builder (`/g/<code>/play`)
- Top bar: wordmark, game code, role chip, timer (`⏱ 14:22`), partner pill (name · role), Leave button.
- Left tray (280px): shape grid (3×3 of polygons), color palette (4×2), tools (Rotate `R`, Resize `S`, Remove `⌫`, Undo `⌘Z`).
- Center canvas: tessellation grid background, placed tiles, a ghost suggestion for the next obvious piece, selected-piece dashed bounds with 4 corner handles. Top-overlay: undo/redo + zoom card on the left, **LinksBar** (Video call + Whiteboard external links) and **BriefEnvelope** on the right.
- Bottom dock (only when accelerants are active): pill row with status (e.g. "Prototype unlocked"), `👁 Glimpse goal · 5s`, `✓ Test build`.
- Bottom-left presence card: "Paired with Jules · guiding · off-platform call."

### 5.3 Guider (`/g/<code>/play`, role=guider)
- Same top bar.
- Single canvas with **the goal pattern** + a small "● THE GOAL · read-only" stamp.
- Top-overlay right: LinksBar + BriefEnvelope (Guider).
- A *Builder preview thumbnail* in the bottom-right that shows the partner's WIP, gated by the **Agile share** accelerant — annotated with hint text ("⚠ Green square is on the wrong side").
- Bottom-left presence pill ("Paired with Sam · building").

### 5.4 Observer (`/g/<code>/play`, role=observer)
- 3-column layout: builder canvas (read-only) | goal canvas | right rail with pair-status numbers (% accuracy, pieces placed, misplaced), round info (title, round, complexity, time left), and the observer's own role card.
- Bottom strip: "Other pairs" — pill switcher across all pairs the observer is allowed to view.

### 5.5 Game master (`/g/<code>/master`)
- Top bar: wordmark, workshop name, code, round indicator, role chip, big timer pill, Pause / End round buttons.
- Three columns:
  - **Left sidebar (320px):** **Lobby** panel up top (unallocated people with avatars; selectable rows; smart action bar — pair-selected when 2 picked, "→ existing pair" / "👁 as observer" when 1 or 3+, plus "🎲 Auto-allocate all" with rule chips: pairs of 2 / mix teams / 1 observer per 2 pairs). Below: **Pairs list** with progress bars, "% / placed / off / status" line, footer with `+ add pair` and `shuffle`.
  - **Center column:** Focused pair detail — pair name, **Send accelerant** button, builder canvas + goal canvas side by side, then a **Briefs in play** card showing both briefs (only the GM sees both) with a **Re-roll briefs** button.
  - **Right rail (360px):** **Accelerants** panel — segmented control to scope a trigger to *this pair* or *all pairs*, then 10 chunky toy-button super-powers plus an inline scoring tile. The full canonical list (kinds + per-pair / per-game caps + cooldowns) lives in §6.3; the rail surfaces those buttons in the order: **🔮 Prototype unlock**, **📖 Reveal briefs**, **✓ Test build**, **↻ Agile share**, **⏱ Time pressure**, **✦ Change builder brief**, **🎲 Randomizer**, **✎ Requirement change**, **+ Make it harder**, **− Make it easier**.

---

## 6. Game mechanics & rules

### 6.1 Game lifecycle
1. **Created** — GM has filled the host form; a game code + GM session token exist; no players yet.
2. **Lobby** — GM is on the master screen; players join via code + display name. GM allocates manually or runs Auto-allocate. **Reconnect rule:** within 5 minutes, a player rejoining the same code with the same display name reclaims their seat (role + pair + placements). After 5 minutes the slot is released and they re-enter the lobby as a new participant.
3. **Round in progress** — Timer running; pieces moving; GM can trigger accelerants.
4. **Round ended** — Either the timer hit zero, the GM clicked End round, or all pairs reported "complete." Per-pair stats are frozen.
5. **Game closed** — GM ends the game, or the auto-purge window expires. Code becomes invalid.
6. **Auto-purge** — A game is soft-deleted **24 hours after the last user interaction** (any participant action, not just `ended_at`). Soft-deleted rows are hard-deleted by a daily job after 7 days.

### 6.1.1 Multi-round support
- GM picks a **round count** at game create (1–5; default 1).
- **Pairings persist** across rounds unless the GM hits **Shuffle** between rounds.
- **Complexity is per-round.** GM sets a default complexity at create-time; can override before each subsequent round starts.
- Each round generates fresh goal patterns and fresh briefs (briefs can be re-used or re-rolled).
- Rounds are started manually by the GM ("Start round 2") — never auto-advance.

### 6.2 Briefs
- **Builder brief** examples: "swap left/right," "use complement of stated color," "halve any number."
- **Guider brief** examples: "use only nautical terms," "no plain shape names."
- Briefs are confidential to their owner (sealed envelope). Players **cannot tell** their partner the contents — they may *only* infer them via 20-questions-style probing during the off-platform call.
- The GM sees both briefs and can **re-roll** them per pair.
- Brief sources, in priority order: (a) **GM free-text** authored at create-time or via Re-roll, (b) **curated library** — the default at game create (a ~33-brief set shipped with the app, covering all complexity buckets), (c) **AI-generated** server-side — explicit opt-in only, never the default. The GM picks the source per side (Builder / Guider) at create-time and can change it any time via Re-roll.
- AI-generated briefs flow through a server-side **provider router** (`lib/briefs/router.ts`): OpenAI `gpt-4o-mini` is the primary, Gemini `gemini-2.5-flash-lite` is the fallback, library is the final fallback. Both AI keys are optional and owner-provided as Vercel server env vars; the client never sees either. Multiple layers of rate limits protect the free-tier quotas — see TDD §13.1. The persisted `briefs.source` is `"gemini"` regardless of which provider answered (the storage enum is `library | gm | gemini` and we don't extend it); the actual provider is logged in the orchestrator&apos;s observability output.

### 6.3 Super powers (full spec)

The right rail is now labelled "Super powers" in the UI (was
"Accelerants" in v1.0; the underlying type names + table still use
the historic name).

| Super power | Trigger scope | Effect | Cooldown / cap (default) |
| --- | --- | --- | --- |
| Prototype unlock | per-pair or all | Builder sees a degraded preview of the goal: portions in grayscale, ~10–20% wrong pieces, "PROTOTYPE — not 100% accurate" banner. **Duration is GM-adjustable**: 3s / 5s / 10s / 15s; 5s default. | 4 uses / round, 12s cooldown |
| Reveal briefs | per-pair or all | Both players in the pair see each other's brief. **Irreversible** within the round. | 1 use / round |
| Test build | per-pair or all | GM-side counterpart to the builder's "Test solution" CTA — flips per-piece correctness highlights + accuracy gauge. Stays on once enabled. | ∞ |
| Agile share | per-pair or all | Builder gets a "Share progress" button; uses are limited (default 3). Each share pushes a snapshot to the guider's preview thumbnail. **Guider can now full-screen the snapshot** (§6.7). | 3 uses / round |
| Time pressure | per-pair or all | Subtracts a configurable amount (default 3:00) from the round timer. Plays an optional sting. | 2 uses / round |
| Change guider brief *(historic name: vocab swap)* | per-pair or all | Re-rolls **just** the guider's brief mid-round. | ∞ |
| Change builder brief | per-pair or all | Mirror of the above for the builder side. | ∞ |
| Randomizer | per-pair or all | Resets that pair's (or all pairs') goal pattern at the same complexity. | ∞ |
| Requirement change | per-pair or all | Mutates **one** element in the target pattern (color, position, shape, rotation). | ∞ |
| Make it harder | per-pair or all | Re-rolls the goal at +1 complexity while keeping the round's grid envelope intact. | ∞ |
| Make it easier | per-pair or all | Re-rolls the goal at −1 complexity, same grid. | ∞ |

In addition to triggered super powers, the rail has a **Scoring tile**
that lives at the top: a stepper for points-per-correct (1..100,
default 10) and a "Punish wrong attempts" toggle that flips the
flat-wrong penalty between 0 and −1. Changes apply game-wide and
recompute every visible / cumulative score immediately.

### 6.4 Canvas, pieces, and "correctness"
- **Pieces:** the builder picks from a fixed set of 4 shapes —
  **square, triangle, rhombus, trapezoid**. v1.1 swapped hexagon out
  for trapezoid: hexagons render visually identically at 0/90/180/270°
  on the square grid, so rotation never told the builder anything new
  about a hex piece. The Tile component still supports the original 7
  shapes for any historic data; new patterns use only these 4.
- **Colors:** sized to complexity — 2 at c=1 up to 6 at c=8, drawn
  from `red / blue / yellow / green / orange / purple` in that order.
  The same set powers the goal generator and the builder palette.
- **Grid:** **square**, sized to complexity. 3×3 at c=1 up to 9×9 at
  c=8 (see §6.5 table). One shape per cell; the cell is the position
  unit.
- **Placement model:** tap-cell-with-shape-selected places; tap an
  occupied cell with a shape selected **converts in place** to the
  new shape/colour/rotation; tap an occupied cell with no selection
  enters edit mode (rotate, delete, drag-to-move). Position is
  `(q, r, rot, color, shape)` with `rot ∈ {0..3}` rendered as
  `rot × 90°`.
- **Optimistic UI.** Every mutation updates local React state
  immediately and fires the server call in the background; field-
  level patches are GC'd once the server echoes back. The builder
  never waits on a roundtrip mid-place. (TDD §X1 covers reconciliation.)
- **Goal pattern** is generated server-side from a complexity input
  (§6.5) and stored on the round record. The Guider gets the full
  pattern; the Builder gets the goal piece *count* (for the progress
  counter) but never the layout.
- **Per-piece "correct"** = a goal piece exists at the same
  `(q, r, rot, color, shape)`. **Round complete** = the builder has
  placed exactly the goal pieces with no extras.
- **Test solution** (builder-fired) and **Test build** (GM-fired)
  both surface per-piece green/red highlights + an accuracy gauge.
  Test solution additionally returns the score breakdown — see §6.11.
- **Clear all** wipes every placement on the builder's canvas
  (builder-only, two-tap confirm).
- **Progress counter.** "X / Y placed" sits above the canvas hint
  row at all times during a running round, exposing only the count
  to avoid leaking the layout.

### 6.5 Complexity scale (1–8)
Complexity drives the grid envelope, piece count, and the size of the
shape + colour pools the builder works with. Both the goal generator
and the builder palette share these numbers.

| Lv | Grid | Pieces in goal | Distinct shapes | Distinct colors | Notes |
| --- | --- | --- | --- | --- | --- |
| 1 | 3×3 | 3 | 1 | 2 | Single-shape stack |
| 2 | 4×4 | 4 | 2 | 3 | |
| 3 | 4×4 | 5 | 2 | 3 | |
| 4 | 5×5 | 6–7 | 3 | 3 | |
| 5 | 6×6 | 8 | 3 | 4 | Default |
| 6 | 7×7 | 9–10 | 4 | 4 | |
| 7 | 8×8 | 11–12 | 4 | 5 | |
| 8 | 9×9 | 13–16 | 4 | 6 | Edge piece logic, max diversity |

The shape pool maxes at 4 (sq, tri-up, rhomb, trap) at every
complexity above 5; complexity scales colour variety + grid + piece
count rather than shape count, so the builder's tray stays scannable.

Brief complexity scales similarly (e.g. complexity 1–2 = single rule,
7–8 = three+ rules with cross-effects). The GM picks complexity at
game-create as the default and can override with the inline stepper
on the Start button each round.

### 6.6 Timer
- GM sets a per-round duration (default 15:00). Counts down at the
  top of every screen.
- At 0 the round ends and (optionally) plays a "time's up" sting.
- **Time pressure** super power subtracts time mid-round.
- **GM time extension.** While a round is running the GM has +30s /
  +1m / +2m chip buttons next to the timer. POST /rounds/extend with
  delta_seconds 30..600. Reuses the existing duration adjuster (the
  30s floor only applies when shrinking, so extending is unbounded
  upward up to 10 minutes per click).
- **Last two minutes** drama: when remaining ≤ 2:00 the timer pill
  turns red and runs a subtle jiggle keyframe in every role's top
  bar. Players hear a single warm "F5 → D5" chime once per round
  when the live remaining first crosses into the last two minutes.

### 6.7 Team assignment
- **Game master picks:** GM uses the Lobby's manual controls and Auto-allocate.
- **Players pick:** on join, the player chooses Builder / Guider / Observer themselves; GM still curates pairs from the lobby.

### 6.8 Capacity
- Soft cap: **50 participants per game** (GM-configurable down to fewer at create-time, never up).
- The cap exists to stay inside Supabase free-tier connection limits and to keep the GM dashboard usable.

### 6.9 Brief-open gate
- When the round starts and a player has a confidential brief, the
  builder canvas (or guider goal canvas) is gated behind a glassy
  overlay until they tap their sealed envelope. The envelope itself
  pulses in a red ring while the gate is up.
- Once they open it, the gate lifts permanently for that brief. If
  the GM re-rolls (Change builder/guider brief super power), the gate
  re-arms with the new brief.
- The "don't disclose contents — answer Yes/No questions like 20-
  questions" framing lives both on the gate and inside the open
  envelope so players see it twice.

### 6.10 Pair self-naming
- Pairs can pick a custom display name like "The Pelicans" (40-char
  cap, free-form). Falls back to "<my-name> ↔ <partner-name>" until
  set, where my-name and partner-name are the player's perspective.
- Editable from BuilderView (sidebar badge above the mode toggle) and
  GuiderView (top-left badge). Anyone in the pair, plus the GM, can
  rename. Empty / whitespace clears the name back to the default.
- New pair_name event broadcasts to all participants on save so the
  badge updates everywhere immediately.

### 6.11 Test solution + scoring
- The builder has a primary "Test solution" CTA at the bottom of the
  canvas. Tapping it computes the score against the goal pattern at
  any time during a running round. No cap on uses.
- Score formula:
  - `score = correct_pts × correct_count + wrong_pts × wrong_count`
  - `correct_pts` defaults to 10 (GM-tunable 1..100 in the Scoring
    tile).
  - `wrong_pts` defaults to 0 — wrong placements just don't earn
    points. The GM steps `wrong_pts` down (range −10..0) to apply a
    per-wrong penalty. The penalty is **per wrong placement**, not a
    flat one-shot, so blanketing the canvas costs more than placing
    carefully. Scores are intentionally not clamped at 0 — aggressive
    guessing can drop a pair into negative territory; the live-score
    chip turns red. Examples (correct_pts=10, wrong_pts=−1):
    - 1 right, 3 wrong → `10 − 3 = 7`
    - 0 right, 5 wrong → `0 − 5 = −5`
    - 4 right, 6 wrong with `wrong_pts=−2` → `40 − 12 = 28`
- Test solution flips `pair_round.test_enabled = true` so green/red
  per-piece highlights persist for the rest of the round, and a
  celebratory tone (Tone.js arpeggio sized to the correct count)
  plays for the builder + a pulse animation on the result banner.
- The guider, observers, and GM all see the result via realtime
  broadcast — the builder is the only writer but the score is shared.
- The game-end leaderboard ranks pairs by **total score across every
  round**, with per-round score chips ("R1 · 5/8 · 50") below each
  pair row for the debrief.

### 6.12 GM debrief prompts
- The game-end view (shared between players + GM) ships with a
  "Debrief prompts" card containing three suggested retro questions
  to seed the conversation on the call.

---

## 7. Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend framework | **Next.js 16 (App Router) + TypeScript** | First-class on Vercel; React server components; route handlers for our Gemini proxy. |
| Styling | **Tailwind CSS v4** with `@theme` tokens, plus a small `tessera.css` layer for the envelope / stamp / chunky shadow utilities | Tokens-first, keeps the design's distinctive components straightforward. |
| State (client) | **Local React state** for game state; hand-rolled fetch + setInterval for the polling fallback alongside Supabase Realtime broadcast for instant updates. No Zustand or react-query — the lifecycle is short enough that a per-route `useState` + the broadcast-triggers-refetch pattern (design_patterns.md) covers it without a global store. |
| Realtime + DB | **Supabase** (Postgres + Realtime). Free tier covers our scale; we publish to a per-game broadcast topic via the REST endpoint and consume it from the browser client. RLS isn't currently used on broadcast — the topic is keyed by an unguessable `game_id`. |
| Placement input | **Tap-to-place** (no DnD library). Drag-and-drop was prototyped but felt heavy on a touch device; tap-cell + a tap-to-edit affordance is the canon. See design_patterns.md > "No drag-and-drop for placements". |
| Canvas rendering | **SVG** (not Canvas/WebGL) | Pieces are simple polygons, designs already in SVG, easy to debug + accessibility. |
| Brief generation | **Gemini 2.0 Flash** via a Next.js route handler. (1.5-flash was deprecated in late 2025.) | Free tier; key never leaves the server. |
| Hosting | **Vercel** | Native Next.js. |
| Auth model | **Anonymous JWTs minted server-side** (game-scoped) using **jose** + HS256; bcryptjs hashes the host- and player-recovery tokens. **Supabase RLS** uses claims `{ game_id, role, participant_id }` for the (planned) DB-direct paths. | No accounts needed, but every realtime/db op is authorized. |

---

## 8. Data model (initial)

```
games          (id pk, code unique, host_workshop_name, video_call_url, whiteboard_url,
                team_mode enum('gm_picks','players_pick'),
                complexity int, builder_brief_on bool, guider_brief_on bool,
                round_duration_seconds int, sound_on bool,
                status enum('lobby','running','ended','purged'),
                scoring_correct_pts int default 10,    -- v1.1
                scoring_wrong_pts int default 0,       -- v1.1
                created_at, ended_at, gm_session_id)

participants   (id pk, game_id fk, display_name, role enum('gm','builder','guider','observer','lobby'),
                pair_id fk null, color, joined_at, last_seen_at)

pairs          (id pk, game_id fk, builder_id fk, guider_id fk,
                display_name text null)                 -- v1.1

rounds         (id pk, game_id fk, index int, started_at, ended_at, status,
                duration_seconds)

pair_rounds    (id pk, round_id fk, pair_id fk,
                goal_pattern jsonb, pattern_seed text,
                test_enabled bool, briefs_revealed bool,
                shares_remaining int default 3,
                prototype_until timestamptz null,
                builder_snapshot jsonb null)
                -- goal_pattern: [{shape, color, q, r, rot}, ...]

placements     (id pk, pair_round_id fk, shape, color, q, r, rot, placed_by fk, placed_at)
                -- unique (pair_round_id, q, r) — one shape per cell

briefs         (id pk, pair_round_id fk, role enum('builder','guider'),
                source enum('gm','library','gemini'), title text, rules jsonb,
                revealed bool default false)

accelerant_events (id pk, round_id fk, scope enum('pair','all'), pair_id fk null,
                   kind, payload jsonb, triggered_by fk, triggered_at)
                -- v1.1 enum kinds: prototype, reveal_briefs, test_build,
                -- agile_share, time_pressure, vocab_swap (historic
                -- "change guider brief"), change_builder_brief,
                -- randomizer, requirement_change, harder, easier
```

All write paths go through Supabase Row Level Security checks against the JWT's `game_id` and `role`. Realtime channels are scoped per game (`game:<id>`) and per pair (`pair:<id>`) so observers and GMs subscribe to the right slices.

---

## 9. Out-of-scope explicit list

- Email / password / OAuth.
- Persistent user profiles, history, or replay.
- In-app chat / voice / video.
- Mobile/responsive layout.
- Asynchronous (non-realtime) play.
- Custom shape or color authoring by players.
- Internationalization (English only in v1).

---

## 10. Decisions (locked)

| # | Decision |
| --- | --- |
| 1 | Ship `chunky` accelerant button style only; no GM toggle for variants. |
| 2 | **Randomizer** and **Requirement change** are first-class accelerant buttons (rail grows to 8, scrollable). |
| 3 | Multi-round games supported. Round count 1–5 (GM picks at create). Pairings persist unless GM hits Shuffle. Complexity is per-round; GM can override before each round. Rounds advance manually. |
| 4 | Complexity scale is **1–8**. |
| 5 | Game code format: `XXX-NNN` — 3 letters, hyphen, 3 alphanumerics. Excludes ambiguous chars (`0`, `O`, `1`, `I`). |
| 6 | Auto-purge **24h after the last user interaction** (any participant action, not just `ended_at`). Soft-delete first, hard-delete after 7 days. |
| 7 | Reconnect: same code + same display name within **5 min** reclaims seat. After 5 min, the slot is released. |
| 8 | Soft cap **50 participants** per game; GM can configure lower at create-time, never higher. |
| 9 | Single owner-provided Gemini API key as a Vercel server env var; per-game rate limit. |
| 10 | "Time's up" sound is a single GM toggle for the whole game; default on. |
| 11 | Goal patterns are procedural at all complexities, seeded by `(complexity, round_id, pair_id)` so Randomizer never repeats. |
| 12 | Color-blind accessibility deferred — v1 ignores. (Logged in §12 follow-ups.) |
| 13 | GM is GM only — cannot fill a Builder/Guider/Observer slot. |
| 14 | Brief sources: GM free-text, curated library, or AI-generated (server-side provider router: OpenAI primary, Gemini fallback, library final fallback). GM picks per side at create-time and can re-roll any time. |


---

## 10b. Implementation deltas vs the locked decisions

A few small adjustments surfaced during implementation; they're folded
into the live build and listed here so the PRD stays honest.

- **Brief sources expanded.** Decision #14 said "library OR Gemini OR
  free text"; all three ship. The Host form has a per-side `Library /
  AI / Custom` segmented picker. Library is still the default at game
  create.
- **AI provider router replaces single-vendor Gemini call.** The
  &ldquo;AI&rdquo; brief source is no longer a direct Gemini call; it
  routes through `lib/briefs/router.ts` which tries OpenAI
  `gpt-4o-mini` first (paid tier, more reliable quota at workshop
  scale), then falls back to Gemini `gemini-2.5-flash-lite` (free
  tier), then falls through to the static library. Background: during
  v1.1 alpha workshops the Gemini free-tier daily and per-minute
  quotas exhausted on `gemini-2.0-flash`; switching to
  `gemini-2.5-flash-lite` (separate, looser bucket) bought breathing
  room, and adding OpenAI as primary buys redundancy when one provider
  is rate-limited or down. The `briefs.source` enum stays as
  `library | gm | gemini` for backward compatibility — the answering
  provider is logged for observability rather than stored on the row.
- **Player-selected role visibility.** `team_mode='players_pick'` now
  shows ALL unallocated players (not just `role='lobby'`) in the GM's
  Lobby panel. Self-selected role appears as "picked builder/guider/
  observer" on the row so the GM can pair sympathetically.
- **Authorization in route handlers consults the live DB role.** The
  JWT carries an initial role at join time but isn't re-minted when
  the GM allocates someone in the lobby. To fix the "Sam joined as
  observer, GM promoted to builder, can't actually place tiles" bug,
  every non-GM-gated route resolves the requester's current role from
  `participants.role` rather than trusting the JWT claim. JWT is
  identity-only.
- **Resume games via cookie.** Home page reads every `ts_*` cookie,
  filters out invalid/ended/purged, and renders a banner of in-flight
  games to jump back into.
- **Game-end pair leaderboard.** Game-over screen shows per-pair final
  accuracy + a complete/incomplete badge; sorted complete-first then
  by ratio. Plus a CTA back to the home page.
- **Marketing pages.** Added `/how-it-works` and `/facilitator-guide`
  long-form content. The "Examples" nav item from the design was
  dropped — there are no public examples in v1.
- **Open-source footer.** Footer on landing + content pages calls out
  that Tessera is open source on free-tier infra; for production,
  fork and self-host. GitHub link in the nav.

---

## 11. Follow-ups parked for v1.x

- Color-blind / high-contrast mode (re-open §10 #12): exclude color-swap brief rules + add shape patterns to tiles.
- Persistent game replay / export.
- Mobile responsive layout for observers (read-only, lower stakes).

---

## 12. Rough milestones (placeholder — finalize in TDD)

1. **Skeleton:** Next.js + Supabase + Tailwind; tokens.css ported; landing page; create-game flow writes a game row.
2. **Join + lobby:** Join flow; participants table; GM lobby UI with Auto-allocate.
3. **Canvas v1:** SVG canvas, snap grid, dnd-kit drag, no realtime — solo build experience for a builder.
4. **Realtime sync:** Supabase Realtime; builder ↔ GM ↔ observer canvas mirroring.
5. **Briefs + Gemini proxy:** envelope UI; route handler; library fallback; rerolls.
6. **Accelerants:** all six rail buttons + the two GM-only overflow tools; per-pair vs all-pairs scoping.
7. **Timer & rounds:** timer, time pressure, multi-round support, end/pause flow.
8. **Polish:** observer view, sounds, empty/edge states, copy review.

---

*End of PRD draft.*
