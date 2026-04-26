# Tessera — Product Requirements (PRD v0.1)

> **Status:** Decisions locked. See TDD §13–14 for free-tier guardrails and security hardening.
> **Sources:** User brief + Claude Design handoff bundle (`Tessera mockups.html`, 5-screen prototype) + chat transcript with the design assistant.

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
  - **Right rail (360px):** **Accelerants** panel — segmented control to scope a trigger to *this pair* or *all pairs*, then a vertical scrollable list of 8 chunky toy-button accelerants:
    1. **🔮 Prototype unlock** — 5-second glimpse of the goal for the builder.
    2. **📖 Reveal briefs** — both players see each other's brief.
    3. **✓ Test build** — builder sees per-piece correctness + accuracy %.
    4. **↻ Agile share** — surface 3 builder previews to the guider.
    5. **⏱ Time pressure** — subtract 3:00 from the round timer (with a sting sound).
    6. **✦ Vocab swap** — force the guider's brief to a new constraint mid-round.
    7. **🎲 Randomizer** — reset the goal pattern for the pair (or all pairs).
    8. **✎ Requirement change** — mutate one element (color/position/shape) in the goal pattern.

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
- Brief sources, in priority order: (a) **GM free-text** authored at create-time or via Re-roll, (b) **curated library** — the default at game create (a ~30-brief set shipped with the app, covering all complexity buckets), (c) **Gemini-generated** server-side — explicit opt-in only, never the default. The GM picks the source per side (Builder / Guider) at create-time and can change it any time via Re-roll.
- The Gemini key is owner-provided as a Vercel server env var; the client never sees it. Multiple layers of rate limits protect the free-tier quota — see TDD §13.1.

### 6.3 Accelerants (full spec)

| Accelerant | Trigger scope | Effect | Cooldown / cap (default) |
| --- | --- | --- | --- |
| Prototype unlock | per-pair or all | Builder sees a degraded preview of the goal: portions in grayscale, ~10–20% wrong pieces, "PROTOTYPE — not 100% accurate" banner. Lasts 5s by default. | 4 uses / round, 12s cooldown |
| Reveal briefs | per-pair or all | Both players in the pair see each other's brief. **Irreversible** within the round. | 1 use / round |
| Test build | per-pair or all | Toggles per-piece correctness highlights for the builder + a "% accurate" gauge. Stays on once enabled. | ∞ |
| Agile share | per-pair or all | Builder gets a "Share progress" button; uses are limited (default 3). Each share pushes a snapshot to the guider's preview thumbnail. | 3 uses / round |
| Time pressure | per-pair or all | Subtracts a configurable amount (default 3:00) from the round timer. Plays an optional sting. | 2 uses / round |
| Vocab swap | per-pair or all | Re-rolls **just** the guider's brief mid-round (Gemini-generated). | 1 use / round |
| Randomizer | per-pair or all | Resets that pair's (or all pairs') goal pattern. | unbounded |
| Requirement change | per-pair or all | Mutates **one** element in the target pattern (color, position, or shape). | unbounded |

> Note: the prototype's "Whisper to pair" accelerant was removed during design iteration ("no on-platform communication"). All eight accelerants are first-class buttons in the right-rail; the rail is vertically scrollable.

### 6.4 Canvas, pieces, and "correctness"
- **Pieces:** tri-up, tri-dn, square, hexagon, rhombus, trapezoid (7 shapes incl. variants).
- **Colors:** the 8 brand primaries from the token palette.
- **Grid:** triangular by default (matches the "tessellation" framing). Square/hex selectable as tweaks.
- **Placement model:** snap-to-grid. A piece's position is `(grid_cell_x, grid_cell_y, rotation_step, color, shape)`. This makes correctness a pure equality check, no tolerance heuristics.
- **Goal pattern** is generated server-side from a complexity input (§6.6) and stored on the round record. The Guider gets the full pattern; the Builder gets an empty canvas (or a Prototype-modified version under accelerant).
- **Per-piece "correct"** = a goal piece exists at the same `(x, y, rotation, color, shape)`. **Round complete** = builder has placed exactly the goal pieces with no extras.
- **Test build** accelerant toggles a green check / red dot on each placed piece + a `% correct = correct_pieces / total_goal_pieces` gauge.

### 6.5 Complexity scale (1–8)
Reconciled with the design (`max=8`); user brief's 1–10 collapses to this. Complexity drives:

| Lv | Pieces in goal | Distinct shapes | Distinct colors | Notes |
| --- | --- | --- | --- | --- |
| 1 | 3 | 1 | 1 | Single-shape stack |
| 2 | 4 | 2 | 2 | Mock from design |
| 3 | 5 | 2 | 3 | |
| 4 | 6–7 | 3 | 3 | |
| 5 | 8 | 3 | 4 | Default |
| 6 | 10 | 4 | 5 | |
| 7 | 12 | 5 | 6 | First true tessellation |
| 8 | 14–16 | 6 | 7 | Edge piece logic, max diversity |

Brief complexity scales similarly (e.g. complexity 1–2 = single rule, 7–8 = three+ rules with cross-effects).

### 6.6 Timer
- GM sets a per-round duration (default 15:00). Counts down at the top of every screen.
- At 0 the round ends and (optionally) plays a "time's up" sting.
- The **Time pressure** accelerant subtracts time mid-round.

### 6.7 Team assignment
- **Game master picks:** GM uses the Lobby's manual controls and Auto-allocate.
- **Players pick:** on join, the player chooses Builder / Guider / Observer themselves; GM still curates pairs from the lobby.

### 6.8 Capacity
- Soft cap: **50 participants per game** (GM-configurable down to fewer at create-time, never up).
- The cap exists to stay inside Supabase free-tier connection limits and to keep the GM dashboard usable.

---

## 7. Tech stack

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend framework | **Next.js 15 (App Router) + TypeScript** | First-class on Vercel; React server components; route handlers for our Gemini proxy. |
| Styling | **Tailwind CSS** + a small `tessera.css` layer that ports `tokens.css` (envelope, stamp, chunky shadow utilities) | Tokens-first, keeps the design's distinctive components straightforward. |
| State (client) | **Zustand** for local game state; **`@tanstack/react-query`** for server state. | Lightweight; avoids Redux ceremony. |
| Realtime + DB | **Supabase** (Postgres + Realtime + Storage if needed) | Free tier covers our scale; Realtime channels for canvas/lobby/timer; RLS keeps private brief content private. |
| Drag-and-drop | **dnd-kit** | Pointer/keyboard/touch support; works well with snap grids. |
| Canvas rendering | **SVG** (not Canvas/WebGL) | Pieces are simple polygons, designs already in SVG, easy to debug + accessibility. |
| Brief generation | **Gemini API** (`gemini-flash`) via a Next.js route handler | Free tier; key never leaves the server. |
| Hosting | **Vercel** | Native Next.js. |
| Auth model | **Anonymous JWTs minted server-side** (game-scoped); **Supabase RLS** uses claims `{ game_id, role, participant_id }` | No accounts needed, but every realtime/db op is authorized. |

---

## 8. Data model (initial)

```
games          (id pk, code unique, host_workshop_name, video_call_url, whiteboard_url,
                team_mode enum('gm_picks','players_pick'),
                complexity int, builder_brief_on bool, guider_brief_on bool,
                round_duration_seconds int, sound_on bool,
                status enum('lobby','running','ended'),
                created_at, ended_at, gm_session_id)

participants   (id pk, game_id fk, display_name, role enum('gm','builder','guider','observer','unallocated'),
                pair_id fk null, color, joined_at, last_seen_at)

pairs          (id pk, game_id fk, builder_id fk, guider_id fk)

rounds         (id pk, game_id fk, index int, started_at, ended_at, status,
                duration_seconds, goal_pattern jsonb)
                -- goal_pattern: [{shape, color, x, y, rot}, ...]

placements     (id pk, round_id fk, pair_id fk, shape, color, x, y, rot, placed_by fk, placed_at)

briefs         (id pk, round_id fk, pair_id fk, role enum('builder','guider'),
                content jsonb, source enum('gm','gemini'), revealed bool default false)

accelerant_events (id pk, round_id fk, scope enum('pair','all'), pair_id fk null,
                   kind, payload jsonb, triggered_by fk, triggered_at)
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
| 14 | Brief sources: GM free-text, curated library, or Gemini-generated. GM picks per side at create-time and can re-roll any time. |


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
