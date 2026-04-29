# Tessera — Technical Design Doc (TDD v1.1)

> **Status:** v1.1 shipped 2026-04-27. Schema migrations 1–11 applied
> to the live project. Section §15 documents implementation deltas
> vs the original plan; the v1.1 changelog directly below this
> summary covers the build-mode rewrite + scoring system at depth.
> **Reads alongside:** `./PRD.md`, `./tessera/` (Claude Design handoff bundle).

## v1.1 changelog (key technical changes from v1.0)

**New migrations (8–13):**
- `add_scoring_fields_to_games` — `games.scoring_correct_pts` (int
  default 10) + `games.scoring_wrong_pts` (int default 0).
- `add_change_builder_brief_accelerant` — adds the per-side brief
  swap kind to `accelerant_t` enum. `vocab_swap` retained as the
  historic guider-side equivalent.
- `add_harder_easier_accelerants` — adds `harder` + `easier` to
  `accelerant_t`.
- `add_pair_display_name` — `pairs.display_name` (text null) for
  pair self-naming.
- `add_player_recovery_token` — `participants.recovery_token_hash`
  text null. Hash of the player's one-shot recovery token; plain form
  is shown once in the join response. Mirrors `games.host_token_hash`
  for the GM. Verified by `POST /api/games/[code]/recover`.

**New endpoints:**
- `POST /api/games/[code]/recover` — exchanges
  `{participant_id, token}` for a fresh session cookie. Plain token
  in the request body (never the URL path/query) so it stays out of
  access logs and Referer headers; the `/recover/<code>` page reads
  it from the URL fragment + `?p=<participant_id>` query.
- `POST /api/games/[code]/test-solution` — builder-only, computes
  the score breakdown against the goal and flips test_enabled so
  per-piece highlights persist.
- `POST /api/games/[code]/scoring` — GM-only, patches
  `games.scoring_*` (correct_pts 1..100, wrong_pts -10..0).
- `POST /api/games/[code]/rounds/extend` — GM-only, adds 30..600
  seconds to the running round timer.
- `PATCH /api/games/[code]/pairs/[pair_id]/name` — anyone in the
  pair (or the GM) sets / clears `pairs.display_name`. 40-char cap.
- `DELETE /api/games/[code]/placements` — builder-only, wipes every
  placement on their pair_round (Clear all).

**Endpoint changes:**
- `POST /api/games/[code]/placements` is now upsert-by-cell — if a
  placement already exists at `(pair_round, q, r)`, it's deleted
  before the new one is inserted. Lets `tap-occupied-cell-with-shape`
  overwrite work both client-side and server-side.
- `PATCH /api/games/[code]/placements/[id]` accepts shape + color
  in addition to q / r / rot. Used by `tap-occupied-cell` convert-
  in-place when the builder wants to preserve piece identity.
- `POST /api/games/[code]/rounds/start` accepts `complexity` and
  `brief_source_override` in the body. Preflights every brief in
  memory before any DB write so a Gemini failure no longer leaves
  orphan rounds; returns 502 `gemini_failed` cleanly. Auto-deletes
  any leftover pending round before creating a new one.
- `/play` returns `goal_count` (always) so the builder progress
  counter has a denominator without leaking goal layout.
- `/lobby` returns `scoring: { correct_pts, wrong_pts }` for the
  GM scoring tile.
- `/summary` returns `total_score` per pair and a `rounds[]` array
  with per-round score breakdowns; sorts by score desc.

**Repository methods added:**
- `clearPlacements(pair_round_id) → number`
- `deleteRound(round_id)` (FK CASCADE handles dependents)
- `listRounds(game_id) → RoundRecord[]` (every round, ascending)
- `updateScoring(game_id, patch)`
- `setPairDisplayName(pair_id, name | null)`
- `updatePlacement` signature widened to accept `shape` + `color`.

**Grid + pattern generation:**
- `lib/grid/coords.ts` is now a square grid sized by complexity:
  `gridSizeFor(complexity) → {w, h}` (3..9). `MAX_GRID = 9` is the
  hard upper bound used by server input validators.
- `lib/pattern/palette.ts` (new) exports `BUILDER_SHAPES` (4 shapes)
  and `BUILDER_COLORS` (6 colors) plus `paletteColorsFor(complexity)`.
  Server + client both import this module so the goal generator and
  the builder palette never disagree.
- `generatePattern` accepts an optional `grid` parameter so the
  harder/easier super-powers can pin the round's grid envelope while
  shifting piece-density complexity ±1.
- Rotation is `0..3` rendered as `rot × 90°`.

**Client architecture:**
- BuilderView keeps `optimisticPatches: Map<id, Partial<PlacedPiece>>`
  on top of `state.placements + optimistic - pendingDeletes`. Patches
  are GC'd in an effect once `state.placements` echoes the value
  back, so move/rotate/convert all feel instant. Reconciliation is
  field-level: each user mutation registers a partial override that
  layers on top of the server state, then drops itself when the
  server agrees. New placements use temp `temp-<rand>` ids until the
  POST returns; subsequent operations on a temp id are local-only
  until the swap-in happens.
- `BriefGate` overlays the canvas until the player opens their
  envelope. Re-arms when the brief is re-rolled (super power).
- `PairNameBadge` is shared between BuilderView + GuiderView.
- `GeminiFallbackModal` surfaces Gemini failures with named recovery
  options instead of silent fallback.

**Sound:**
- `playLastTwoMinutes()` — single F5→D5 chime when the live timer
  first crosses below 120s.
- `playTestSolution(correctCount)` — arpeggio sized to correct count
  on the builder's "Test solution" tap.

**Other:**
- `@vercel/analytics` mounted in the root layout.
- `@keyframes tessera-jiggle` + `tessera-attention` added to
  `globals.css` for the timer pulse and brief-envelope emphasis.

---

## 1. Goals of this doc

- Lock the architecture, data model, and realtime topology before we start coding.
- Surface implementation decisions that are too granular for the PRD but too consequential to make ad-hoc.
- Enumerate the open implementation questions in §13 so a single review pass unblocks build.

---

## 2. System overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Next.js client, RSC + client components)              │
│  ┌──────────┐  ┌────────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Landing  │  │ Lobby/Join │  │ Play      │  │ GM Dashboard │  │
│  └──────────┘  └────────────┘  └───────────┘  └──────────────┘  │
│       │              │                │             │           │
│       ▼              ▼                ▼             ▼           │
│  Zustand stores · React Query · Supabase JS Realtime client     │
└──────────────┬──────────────────────────────────┬───────────────┘
               │ HTTPS (REST + RPC)               │ wss (Realtime)
               ▼                                  ▼
        ┌──────────────────────┐          ┌────────────────────┐
        │ Next.js route        │          │ Supabase Realtime  │
        │ handlers (/api/*)    │          │ (Phoenix WS)       │
        │  - mint JWT          │          │  - broadcast       │
        │  - gemini proxy      │          │  - presence        │
        │  - pattern gen       │          │  - postgres-cdc    │
        └──────────┬───────────┘          └─────────┬──────────┘
                   │                                │
                   └─────────── Postgres ───────────┘
                              (Supabase, RLS)
```

- **Frontend** is a single Next.js app (App Router) deployed to Vercel.
- **Persistent state** lives in Supabase Postgres, gated by Row Level Security.
- **Realtime sync** uses Supabase Realtime — `broadcast` for ephemeral in-flight piece dragging and presence, `postgres_changes` for canonical state changes (placements, accelerant events, round transitions).
- **Server-only operations** (game create, JWT mint, Gemini calls, pattern generation) live in Next.js route handlers under `/app/api/*`. The browser never sees the Supabase service role key or the Gemini key.

---

## 3. Tech stack (locked)

| Layer | Choice | Notes |
| --- | --- | --- |
| Runtime | Node 20 LTS | Vercel default. |
| Framework | Next.js 16 (App Router) + TypeScript (strict) | What `create-next-app` shipped; App Router is mature. |
| Package manager | **pnpm 10+** | pnpm 7 has a Node 21 incompatibility (`ERR_INVALID_THIS`); upgrade with `npm i -g pnpm@latest`. |
| Styling | Tailwind CSS v4 + a `tessera.css` layer porting the design tokens | v4's CSS-first `@theme` directive maps cleanly to our token system. |
| State | Zustand for game-room state; `@tanstack/react-query` for server fetch | |
| DnD | `@dnd-kit/core` + `@dnd-kit/utilities` | Pointer + keyboard; we'll wire snap-to-grid via `modifiers`. |
| Canvas | Inline SVG (no Canvas, no Konva) | Pieces are tens of polygons; SVG is plenty. |
| DB / Realtime | Supabase (hosted free-tier project) | Postgres 15, Realtime. **No local Supabase stack** — dev points at a hosted project. Drops the Docker requirement and matches what runs in production exactly. |
| Auth | Anonymous JWT minted by our route handler; **Supabase Auth not used** | We carry only `{ game_id, participant_id, role, exp }` in the JWT. |
| AI brief router | `lib/briefs/router.ts` — calls **OpenAI `gpt-4o-mini`** (`openai` SDK) first, falls back to **Google `gemini-2.5-flash-lite`** (`@google/generative-ai` SDK), then drops through to the static library. All providers are server-side only. | OpenAI primary buys paid-tier RPM/RPD reliability for workshop traffic; Gemini fallback keeps the AI path live for free-tier deployments. Earlier passes used `gemini-2.0-flash` directly but its free-tier RPM/RPD bucket exhausted under workshop traffic; 2.5-flash-lite has a separate, looser bucket on free. The persisted `briefs.source` is always `"gemini"` regardless of provider — see §15.3. |
| Lint / format | ESLint (Next preset) + Prettier | |
| Testing | Vitest (unit) + Playwright (e2e, smoke only in v1) | |
| CI | GitHub Actions: typecheck, lint, vitest on PR | Playwright run on `main` only. |
| Hosting | Vercel | Edge runtime where reasonable; Node runtime for the AI brief router. |

---

## 4. Repo / project structure

```
tessera/
├── app/                          # Next.js App Router
│   ├── (marketing)/              # /  (landing)
│   ├── g/
│   │   └── [code]/
│   │       ├── join/             # role pick + display name
│   │       ├── play/             # builder | guider | observer (one route, role-switched)
│   │       └── master/           # GM dashboard
│   ├── api/
│   │   ├── games/                # POST create
│   │   ├── games/[code]/join/    # POST join → JWT
│   │   ├── games/[code]/host/    # POST recover host session
│   │   ├── rounds/[id]/...       # round lifecycle (start/end/shuffle)
│   │   ├── briefs/               # generate / re-roll
│   │   ├── accelerants/          # trigger
│   │   └── patterns/             # generate goal pattern (procedural)
│   └── layout.tsx
├── components/
│   ├── canvas/                   # SVG canvas, grid, tile, dnd hooks
│   ├── envelope/                 # BriefEnvelope sealed/open
│   ├── lobby/                    # GM lobby panel + auto-allocate
│   ├── accelerants/              # rail + buttons + scope toggle
│   ├── stamp/  card/  chip/  …   # primitives ported from tokens.css
│   └── topbar/
├── lib/
│   ├── auth/                     # JWT mint/verify, session cookie helpers
│   ├── supabase/                 # client + server factories
│   ├── realtime/                 # channel helpers
│   ├── pattern/                  # procedural generator (seeded)
│   ├── briefs/                   # library + Gemini prompt
│   └── grid/                     # triangular grid math + snap
├── design/                       # PRD, TDD, design handoff (this folder)
├── styles/
│   ├── globals.css
│   └── tessera.css               # ports tokens.css (envelope, stamp, chunky shadow)
├── supabase/
│   ├── migrations/               # SQL migrations (Supabase CLI managed)
│   └── seed.sql                  # brief library seed
├── tests/
│   ├── unit/                     # vitest
│   └── e2e/                      # playwright smoke
├── .env.example
├── package.json
└── README.md
```

---

## 5. Auth & sessions

We do not use Supabase Auth. Tessera has no accounts; we mint our own short-lived JWTs that Supabase RLS reads.

### 5.1 JWT

```jsonc
{
  "sub": "<participant_id>",        // uuid
  "game_id": "<uuid>",
  "role": "gm" | "builder" | "guider" | "observer" | "lobby",
  "code": "HEX-934",                // for routing convenience only
  "exp": 1735689600,                // 4 hours (covers a workshop; short enough to limit abuse)
  "iat": 1735646400,
  "iss": "tessera"
}
```

- Signed HS256 with `TESSERA_JWT_SECRET` (server env — never bundled into the client).
- The same secret is configured in Supabase as `JWT secret` so RLS policies can read claims via `auth.jwt() ->> 'game_id'` etc.
- Stored in an **HttpOnly, Secure, SameSite=Lax** cookie named `ts_<code>` (e.g. `ts_HEX934`) scoped to path `/`. Using a per-game name avoids collisions when a user has two games open in the same browser. Scoping to `/` (not `/g/<code>`) ensures it is actually sent to `/api/*` routes.

### 5.2 Flows

- **Host:** `POST /api/games` → sets the GM cookie, then redirects to `/g/<code>/master`. A **host recovery token** (24-byte / 192-bit random — overkill for unguessability, lives in `lib/auth/hostToken.ts`; same shape powers the player-recovery flow in `lib/auth/playerToken.ts`, both stored as `bcrypt` hashes) is shown **once** in a modal at create time. The modal copy says "save this URL". The recovery URL is `https://<host>/host-recover/<code>` — which is a page that prompts for the token; the token is submitted via `POST /api/games/<code>/host-recover` in the **request body**, never in a URL query string. This prevents it leaking via browser history, Vercel logs, or the `Referer` header sent to Meet/Miro when the GM clicks an external link while screen-sharing.
- **Join:** `POST /api/games/<code>/join { display_name, role? }` → mints a participant JWT, sets the `ts_<code>` cookie. Existing participant with matching cookie = reclaim seat.
- **Reconnect:** A participant returning within 5 min with the same `(code, display_name)` reclaims their seat and pair (PRD §6.1). After 5 min the slot is freed.
- **Role changes:** Any time the GM changes a participant's role in the lobby, the server re-issues that participant's JWT with the new role claim and sets an updated `ts_<code>` cookie. Stale JWTs with the wrong role therefore expire naturally within 4 hours, and RLS enforces the DB-level role at all times regardless.

### 5.3 Authorization split: server route handlers do the work; RLS is defence-in-depth

Tessera's mutations all flow through Next.js route handlers. Those handlers verify our JWT, then call Supabase **using the service role key** (server-only) to perform the write. Our app code is the source of truth for "is this participant allowed to do this?"; RLS is configured with a **deny-by-default** posture as defence-in-depth.

Why this split:

- It decouples our JWT signing key from Supabase's JWT secret. We can rotate `TESSERA_JWT_SECRET` independently.
- Validation (game_id matches, role allowed, cooldowns enforced) lives in TypeScript next to the rest of the business logic, not split between SQL policies and the route handler.
- The browser only ever holds the anon key. The service role key never leaves the server.

What runs against RLS:

- **Realtime postgres_changes subscriptions** (added in milestone 4) — these are evaluated against the connecting client's JWT. We configure narrow `select` policies that read `auth.jwt() ->> 'tessera_game_id'` and `auth.jwt() ->> 'tessera_role'` for those reads. We use *namespaced* claim names so Supabase's own `role` semantics (`anon` / `authenticated` / `service_role`) are untouched.
- **Realtime broadcast channels** — we use these for ephemeral piece drag and presence. They don't run RLS; we authorize the join via a server-issued channel token instead.

Until milestone 4 ships, RLS is `enable row level security` on every table with **no policies** — meaning anon clients can read/write nothing, only the service role can act. Our route handlers do the rest.

### 5.4 Sample RLS policy (for milestone 4)

```sql
-- placements: only the builder of the pair, the pair's guider (read-only),
-- the pair's observers (read-only), or the GM may see/write.
create policy placements_read on placements for select using (
  (auth.jwt() ->> 'role' = 'gm' and pair_id in (select id from pairs where game_id = (auth.jwt() ->> 'game_id')::uuid))
  or pair_id in (select pair_id from participants where id = (auth.jwt() ->> 'sub')::uuid)
);

create policy placements_write on placements for insert with check (
  auth.jwt() ->> 'role' = 'builder'
  and pair_id = (select pair_id from participants where id = (auth.jwt() ->> 'sub')::uuid)
);
```

(Full policy set lives in the first migration.)

---

## 6. Data model

Building on the PRD §8 sketch with implementation detail.

```sql
-- Enums
create type role_t          as enum ('gm','builder','guider','observer','lobby');
create type game_status_t   as enum ('lobby','running','ended','purged');
create type round_status_t  as enum ('pending','running','ended');
create type brief_source_t  as enum ('gm','library','gemini');
create type team_mode_t     as enum ('gm_picks','players_pick');
create type accelerant_t    as enum (
  'prototype','reveal_briefs','test_build','agile_share',
  'time_pressure','vocab_swap','randomizer','requirement_change'
);
create type accelerant_scope_t as enum ('pair','all');

-- Games
create table games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                    -- 'HEX-934'
  workshop_name text not null,
  video_call_url text not null,
  whiteboard_url text,
  team_mode team_mode_t not null,
  default_complexity int not null check (default_complexity between 1 and 8),
  builder_brief_on bool not null default true,
  guider_brief_on bool not null default true,
  builder_brief_source brief_source_t not null default 'library',
  guider_brief_source brief_source_t not null default 'library',
  round_count int not null check (round_count between 1 and 5),
  round_duration_seconds int not null default 900,
  participant_cap int not null check (participant_cap between 3 and 50),
  sound_on bool not null default true,
  status game_status_t not null default 'lobby',
  created_at timestamptz not null default now(),
  last_interaction_at timestamptz not null default now(),  -- drives auto-purge
  ended_at timestamptz,
  host_token_hash text not null,               -- bcrypt of recovery token
  gemini_calls_used int not null default 0     -- incremented per Gemini brief call; capped at 30
);

create unique index games_code_idx on games(code);
create index games_purge_idx on games(last_interaction_at)
  where status <> 'purged';

-- Participants
create table participants (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  display_name text not null,
  role role_t not null default 'lobby',
  pair_id uuid references pairs(id) on delete set null,
  color text not null,                          -- 'red' | 'orange' | …
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  released_at timestamptz                       -- set when seat freed
);

create unique index participants_unique_name on participants(game_id, lower(display_name))
  where released_at is null;

-- Pairs
create table pairs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  builder_id uuid references participants(id),
  guider_id uuid references participants(id)
);

-- Rounds
create table rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  index int not null,
  complexity int not null check (complexity between 1 and 8),
  duration_seconds int not null,
  status round_status_t not null default 'pending',
  started_at timestamptz,
  ended_at timestamptz,
  unique(game_id, index)
);

-- Per-pair, per-round goal pattern (so Randomizer/Requirement-change can mutate one pair)
create table pair_rounds (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  pair_id uuid not null references pairs(id) on delete cascade,
  goal_pattern jsonb not null,                  -- [{shape, color, q, r, rot}, ...]
  pattern_seed text not null,                   -- for re-derive / debugging
  unique(round_id, pair_id)
);

-- Builder placements (single writer per pair per round)
create table placements (
  id uuid primary key default gen_random_uuid(),
  pair_round_id uuid not null references pair_rounds(id) on delete cascade,
  shape text not null,
  color text not null,
  q int not null, r int not null,               -- square-grid cell coords, 0 ≤ q < grid.w
  rot smallint not null check (rot in (0,1,2,3)),  -- 90° steps (v1.1 swap from triangular grid)
  placed_by uuid not null references participants(id),
  placed_at timestamptz not null default now()
);

create unique index placements_one_per_cell on placements(pair_round_id, q, r);

-- Briefs (per pair per round)
create table briefs (
  id uuid primary key default gen_random_uuid(),
  pair_round_id uuid not null references pair_rounds(id) on delete cascade,
  role role_t not null check (role in ('builder','guider')),
  source brief_source_t not null,
  title text not null,
  rules jsonb not null,                         -- [{ kind, payload }, ...]
  revealed bool not null default false,
  created_at timestamptz not null default now(),
  unique(pair_round_id, role)
);

-- Accelerant log
create table accelerant_events (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  scope accelerant_scope_t not null,
  pair_id uuid references pairs(id) on delete cascade,
  kind accelerant_t not null,
  payload jsonb not null default '{}',
  triggered_by uuid not null references participants(id),
  triggered_at timestamptz not null default now()
);
```

-- Daily Gemini budget counter (one row per UTC day)
create table gemini_budget (
  day date primary key,
  calls_used int not null default 0
);

### Maintenance jobs (Supabase scheduled edge fn or pg_cron)

- `purge_stale_games` — every 10 min:
  - `update games set status = 'purged' where last_interaction_at < now() - interval '24 hours' and status <> 'purged'`
- `release_stale_seats` — every 30 s:
  - `update participants set released_at = now() where last_seen_at < now() - interval '5 minutes' and released_at is null and pair_id is null`
- `hard_delete_purged` — daily:
  - `delete from games where status = 'purged' and last_interaction_at < now() - interval '7 days'`
- `keepalive` — every 5 days via a Vercel cron (`vercel.json` cron job): makes a cheap read query (`select 1 from games limit 1`) so the Supabase free-tier project does not auto-pause after 1 week of inactivity.

Every write path bumps `games.last_interaction_at` via a trigger.

---

## 7. Grid & coordinate system

v1.1 ships a **square grid** that scales with complexity (3×3 at c=1 up to 9×9 at c=8). The original v1.0 triangular grid with 60° rotation steps was retired during alpha — square + 90° proved easier for guiders to describe over voice and gave the rotation tool a clearer purpose. Pieces are stored in **integer cell coordinates** (`q`, `r`) with `rot ∈ {0,1,2,3}` rendered as `rot × 90°`. The migration that tightened the DB check from `rot in (0..5)` to `rot in (0..3)` is `supabase/migrations/20260427000001_tighten_placements_rot_check.sql`.

### 7.1 Square grid

- Cells are indexed by `(q, r)` where `q` is the column (0-indexed from the left) and `r` is the row (0-indexed from the top). The active grid envelope per round is `gridSizeFor(round.complexity)` in `lib/grid/coords.ts` (3×3 at c=1 up to 9×9 at c=8).
- Each placement occupies one cell. The four shipped builder shapes are `sq`, `tri-up`, `rhomb`, `trap` (see `lib/pattern/palette.ts`). Hex was retired during v1.1 alpha because it rendered identically at every 90° rotation step, which made the rotation tool pointless for hex pieces.
- Rotation `rot ∈ {0,1,2,3}` × 90°. Pieces with 4-fold symmetry (`sq`) effectively look the same at every rotation; `rhomb` looks the same at 0°/180° and 90°/270°. `lib/scoring/score.ts`'s `normalizeRot` handles the symmetry classes when checking equality against the goal.

### 7.2 Snap

- The interactive canvas reports `(q, r)` directly (cells are buttons, not a pixel grid). No DnD library is needed because v1.1 ships **tap-to-place**, not drag — see design_patterns.md > "No drag-and-drop for placements".
- The unique constraint `(pair_round_id, q, r)` enforces one piece per cell at the DB level; the POST handler does an explicit overwrite (delete-then-insert) so a tap on an occupied cell with a fresh selection converts the piece in place instead of throwing 409.

### 7.3 Correctness check

Pure equality of multisets:

```ts
const correctSet = new Set(goal.map(p => `${p.shape}|${p.color}|${p.q},${p.r}|${p.rot}`));
const placedSet  = new Set(placed.map(...));
const correct    = [...placedSet].filter(k => correctSet.has(k)).length;
const accuracy   = correct / goal.length;
const complete   = accuracy === 1 && placed.length === goal.length;
```

This runs client-side for `Test build`. Server-side it runs on round end for the canonical record.

---

## 8. Realtime topology

We open exactly **two** realtime channels per session:

| Channel | Subscribers | Carries |
| --- | --- | --- |
| `game:<game_id>` | everyone in the game | presence, lobby changes, accelerant events, round status, timer ticks |
| `pair:<pair_id>` | the pair's builder + guider, observers of the pair, the GM | in-flight piece drag (`broadcast`), placement commits (`postgres_changes`), per-pair brief reveals |

**Why two channels:** observers and the GM watch *all* pairs but rarely subscribe to *all* pair channels; in practice the GM subscribes to the focused pair plus the game channel. This keeps Supabase Realtime fan-out manageable.

### 8.1 Message shapes

```ts
// game:<id>
type GameMsg =
  | { t: 'lobby_update' /* via postgres_changes */ }
  | { t: 'round_started', round_id: string, ends_at: string }
  | { t: 'round_ended',   round_id: string }
  | { t: 'time_pressure', delta_s: number, new_ends_at: string }
  | { t: 'accelerant',    event: AccelerantEvent };

// pair:<id> — broadcast (ephemeral)
type PairBroadcast =
  | { t: 'drag', piece_id: string, q: number, r: number, rot: number }   // in-flight
  | { t: 'select', piece_id: string | null };
// pair:<id> — postgres_changes on placements / briefs (canonical)
```

### 8.2 Authority model

- The **builder** is the single writer for placements in their pair. No conflict resolution needed.
- The GM can mutate goal patterns (Randomizer / Requirement change) by writing to `pair_rounds.goal_pattern`. Clients re-derive ghost piece + correctness on the next change event.
- The GM is the only writer for accelerant events and round transitions.

### 8.3 Timer

We don't run a server clock. The round row stores `started_at` and `duration_seconds`; clients compute `ends_at = started_at + duration`. Time pressure writes a new `duration_seconds` (decrement) and emits `time_pressure` over the game channel.

---

## 9. Brief generation pipeline

Single server-side path. **The browser never calls OpenAI or Gemini directly.** All AI spending flows through one router (`lib/briefs/router.ts`) that enforces multiple layers of limits before touching either provider.

```
client → POST /api/briefs
         { round_id, pair_id, role, source }
              │
              ▼
       [1] Validate JWT — must be gm role for this game
              │
              ▼
       [2] Check global daily cap (gemini_budget.calls_used ≤ 800)
              │
              ▼
       [3] Check per-game cap (games.gemini_calls_used ≤ 30)
              │
              ▼
       [4] AI provider router (lib/briefs/router.ts)
              │
              ▼
         try OpenAI gpt-4o-mini
              │ ok                   │ fail (auth, 429, schema, timeout)
              ▼                      ▼
         return brief        try Gemini gemini-2.5-flash-lite
                                     │ ok          │ fail
                                     ▼            ▼
                              return brief    AIBriefRouterError
                                                  │
                                                  ▼
                                  orchestrator catches → library
                                  fallback (or surfaces typed
                                  error to GM if
                                  allow_library_fallback=false)
              │
              ▼
       increment games.gemini_calls_used (per-game)
       + gemini_budget.calls_used (global daily)
       — counters bump regardless of which provider answered, since
         budget is enforced on the AI path overall
              │
              ▼
       insert into briefs(...) with source='gemini'
       (the storage enum is library|gm|gemini and we don't extend it;
        the answering provider is logged for observability via
        attempts[] in the router result)
              │
              ▼
   broadcast tessera:<game_id> → clients refetch
```

### Budget layers

The budget protects free-tier quota across the AI path overall, not per-provider — counters bump on success regardless of which provider answered.

| Layer | Cap | Scope | Action on breach |
| --- | --- | --- | --- |
| Global daily | 800 calls | All games, resets midnight UTC | Fall back to library; no error shown |
| Per-game | 30 calls | One game's lifetime | Fall back to library; no error shown |
| Per-minute (client-side) | Re-roll button disabled for 4s after press | UX only | Button greyed out |
| Provider-level retry | OpenAI: 1 retry on transient errors. Gemini: 1 retry on transient errors (`timeout`, `invalid_json`, `schema_violation`, 5xx, `ECONNRESET`). 6s timeout per call. | One call | Move to next provider in router order |
| Router cascade | OpenAI → Gemini → library. Each provider is tried at most once after its retry. | One call | Throw `AIBriefRouterError`; orchestrator falls through to library unless caller passed `allow_library_fallback: false` |

### Storage

- **`briefs_library` table:** seeded at migration — ~15 builder briefs + ~15 guider briefs bucketed by complexity (1–3, 4–6, 7–8). Same `{title, rules}` shape as live briefs.
- **`gemini_budget` table** (one row per UTC day):
  ```sql
  create table gemini_budget (
    day date primary key,
    calls_used int not null default 0
  );
  ```
  Incremented via `update gemini_budget set calls_used = calls_used + 1 where day = current_date` inside a transaction with the `briefs` insert. The server reads and checks the value before calling Gemini; if ≥ 800 it skips straight to library fallback.
- **`games.gemini_calls_used`** — per-game counter column (added to the data model in §6).
- **In-process LRU cache** (size 50, keyed by `sha256(complexity + role + rules_version)`): brief results are reusable across games. A 50-slot cache covers all 16 `(complexity 1-8) × (role builder|guider)` combos with plenty of room for re-rolls.

### Prompt template (sketch)

```
System: Return ONLY valid JSON matching the schema below. No prose.
Schema: { "title": string (max 60 chars), "rules": array of 1-3 strings (max 80 chars each) }
User: Generate a secret {{role}} brief for a facilitation game.
      Complexity level: {{complexity}}/8.
      Exclude these titles: [{{excluded}}].
      The brief should be a playful communication constraint (translation, vocab swap, inversion, etc.).
```

Output is validated against the schema; malformed → retry once → library fallback. Brief `title` and `rules` strings are plain text; any HTML/script tags are stripped server-side before storage as a defence-in-depth measure.

### Default source

**Library is the default source on game create.** AI generation is explicitly opt-in (GM selects "AI-generated" for builder and/or guider briefs at the create form). This means paid OpenAI quota and free Gemini quota are only consumed when the GM actively asks for it — most games won't spend a single AI call. When neither AI key is configured (`OPENAI_API_KEY` and `GEMINI_API_KEY` both unset), the router silently degrades to the library path on every "AI-generated" request.

---

## 10. Accelerant engine

A single route handler accepts a trigger, validates GM ownership + cooldowns, persists an `accelerant_events` row, and lets clients react via realtime.

```
POST /api/accelerants
  { round_id, scope: 'pair'|'all', pair_id?, kind, payload? }

→ insert accelerant_events
→ side-effect (optional, server-side):
   - prototype:           no DB side-effect; clients render the timed glimpse
   - reveal_briefs:       update briefs.revealed = true
   - test_build:          flip a per-pair flag on pair_rounds.test_enabled
   - agile_share:         decrement pair_rounds.shares_remaining
   - time_pressure:       update rounds.duration_seconds
   - vocab_swap:          regenerate guider brief via lib/briefs
   - randomizer:          regenerate goal_pattern for affected pair(s)
   - requirement_change:  mutate one piece in goal_pattern
→ broadcast on game:<id>
```

Cooldowns and per-round caps live in a `lib/accelerants/policy.ts` module and are enforced both server-side and (for UX) client-side.

---

## 11. Local dev & deployment

We use **two hosted Supabase projects** on the free tier — one for prod, one for dev — and Vercel for hosting both production and per-PR previews. There is **no local Supabase stack**; this drops the Docker dependency and ensures dev runs against the same Postgres + Realtime stack that ships to prod.

> The Supabase free tier allows two active projects, which is exactly what we use. We stay inside the free tier with `tessera-prod` and `tessera-dev`. Pause one if you ever need a third slot.

### 11.1 One-time project setup (you do this once)

1. **Supabase:** Create two projects at https://supabase.com — `tessera-dev` and `tessera-prod`. Note each project's URL, anon key, service-role key, and JWT secret.
2. **Vercel:** Create a project at https://vercel.com, link it to the GitHub repo. Add env vars (table below) for both **Production** and **Preview** environments — Production points at `tessera-prod`, Preview points at `tessera-dev`.
3. **Local:** `cp .env.example .env.local`, fill with the `tessera-dev` values. The same `TESSERA_JWT_SECRET` value goes in your Supabase project under Settings → API → JWT Settings → JWT Secret (replacing the auto-generated one) so RLS can verify our claims.
4. **AI providers:** Add an OpenAI API key (primary) and/or a Google AI Studio API key (fallback) to Vercel — Production only is recommended (previews fall back to library briefs to avoid burning paid OpenAI quota or the free Gemini RPD bucket). Setting both is the recommended posture: OpenAI handles workshop volume, Gemini covers OpenAI outages without billing impact.

### 11.2 Local development

```bash
pnpm install
pnpm supabase link --project-ref <tessera-dev-ref>     # one-time
pnpm supabase db push                                  # applies migrations to tessera-dev
pnpm dev                                               # http://localhost:3000
```

Local dev points at the hosted `tessera-dev` project. Realtime, RLS, JWT verification, and all migration behaviour are identical to prod.

For a clean slate during development, `pnpm db:reset:dev` (alias to `supabase db reset --linked`) wipes and re-applies migrations against `tessera-dev`. Never run this against prod.

### 11.3 Vercel environment variables

| Var | Production | Preview | Local | Notes |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | prod URL | dev URL | dev URL | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod anon | dev anon | dev anon | RLS-protected, safe in browser |
| `SUPABASE_SERVICE_ROLE_KEY` | prod sr | dev sr | dev sr | Server-only, never bundled into the client |
| `TESSERA_JWT_SECRET` | prod | dev | dev | Must match the Supabase project's JWT secret |
| `OPENAI_API_KEY` | set | unset | unset | Primary AI brief provider (`gpt-4o-mini`). Previews + local fall back to Gemini if set, else library. Optional. |
| `GEMINI_API_KEY` | set | unset | unset | Fallback AI brief provider (`gemini-2.5-flash-lite`). Previews + local fall back to library when unset. Optional. |
| `TESSERA_PUBLIC_URL` | https://tessera.app | preview URL | http://localhost:3000 | Used in host recovery URLs |

### 11.4 Deployment flow

- `git push` to a branch → Vercel preview deployment against `tessera-dev`.
- Merge to `main` → Vercel production deployment against `tessera-prod`.
- **Migrations are not auto-applied to prod.** A maintainer runs `pnpm supabase link --project-ref <tessera-prod-ref> && pnpm supabase db push` against prod after a release is verified on preview. (CI may automate this in v1.x.)

### 11.5 Implications for the architecture

Three things change because we run on hosted Supabase instead of a local stack:

- **Schema migration tests must run against `tessera-dev`.** Vitest integration tests (TDD §12) connect to the dev project; CI runs them against the same dev project, which means PRs share dev state. This is acceptable for a solo / small-team workflow; if it becomes painful we add a CI-only third project later.
- **Migrations are linear and forward-only in dev.** `supabase db push` is the source of truth; `db reset` is allowed but coordinates with anyone else on the team.
- **Realtime & RLS behaviour are validated continuously.** Because dev is the same Postgres edition as prod, we no longer need a "feature works locally but not on Supabase free tier" debugging step.

---

## 12. Testing strategy

| Layer | Tool | Scope |
| --- | --- | --- |
| Unit | Vitest | Grid math, correctness check, brief library sampling, accelerant policy. |
| Component | Vitest + Testing Library | Envelope open/close, accelerant button states, lobby selection logic. |
| Integration | Vitest + supabase-js against local stack | RLS denies cross-game access, JWT mint/verify, brief insert flow. |
| E2E (smoke) | Playwright | "Host → join → place a piece → see it on observer" happy path on `main`. |

Coverage target for v1: 70% unit, smoke-only e2e.

---

## 13. Free-tier guardrails

This section documents explicit hard limits that protect the three billed services from cost overruns and quota exhaustion. The adversarial model here is **accidental abuse** (a busy workshop day) and **incidental abuse** (a bot hitting unauthenticated endpoints) — not a targeted attack.

### 13.1 AI brief generation (OpenAI primary + Gemini fallback)

The AI path crosses two providers; budget is enforced once across the whole router.

| Guard | Implementation | Where |
| --- | --- | --- |
| Global daily cap | `gemini_budget.calls_used ≤ 800` checked transactionally before each AI call (name kept for backward-compat with the existing migration; the counter now bounds OpenAI **and** Gemini calls combined) | `/rounds/start` + `/briefs/reroll` via `repo.reserveGeminiCall` |
| Per-game cap | `games.gemini_calls_used ≤ 30` (same caveat as above — counts across both providers) | same |
| In-process cache | LRU(50) keyed by `sha256(complexity‖role‖rules_version)` | `lib/briefs/cache.ts`, process lifetime |
| Provider router | Tries OpenAI `gpt-4o-mini` first, falls back to Gemini `gemini-2.5-flash-lite`. Each provider gets one retry on transient failure (timeout, 5xx, malformed JSON). | `lib/briefs/router.ts` |
| Per-call timeout | 6s wall-clock per provider call to bound the per-pair budget on `/rounds/start` (which has `maxDuration=30` and processes pairs sequentially) | `lib/briefs/openai.ts`, `lib/briefs/gemini.ts` |
| Library-as-default | `source = 'library'` at game create; AI is explicit opt-in | landing form |
| `maxDuration` | `export const maxDuration = 30` on `/rounds/start` (multiple briefs in parallel during round start), 15 on `/briefs/reroll` and `/accelerants` (single calls) | route files |

**Free-tier sanity check.** Worst case with guards: 800 AI calls/day × ~500 tokens/call = 400K tokens/day. Well under the 1M TPM free tier on Gemini; OpenAI is paid, but the same 800/day cap bounds spend (~$0.30/day at `gpt-4o-mini` rates as of 2026-04). RPM is managed by the 4s client-side re-roll debounce and the global daily cap preventing a single workshop from consuming the budget.

**Why a router and not just one provider.** During v1.1 alpha the Gemini free-tier daily and per-minute quotas exhausted on `gemini-2.0-flash` under workshop traffic — every parallel pair brief request burned the per-minute bucket and threw 429s. Switching the model to `gemini-2.5-flash-lite` (separate, looser bucket on free) bought breathing room, and adding OpenAI as the primary buys redundancy when one provider is rate-limited or down. The `briefs.source` enum stays `library | gm | gemini` for backward compatibility — see §15.3.

### 13.2 Supabase Realtime (200 concurrent WS / 2M messages/month free)

| Guard | Implementation | Where |
| --- | --- | --- |
| Drag broadcast throttle | Builder emits drag events at ≤10 Hz (100 ms debounce in the DnD modifier) | `components/canvas/useDragBroadcast.ts` |
| Concurrent-game cap | `POST /api/games` returns **429** if `count(*) from games where status in ('lobby','running') ≥ 40` (40 games × 5 avg users = 200 WS connections) | `/api/games` route |
| Two channels max | Each client subscribes to `game:<id>` + at most one `pair:<id>` — never all pair channels | `lib/realtime/` |
| Observer channel switching | Observer unsubscribes from old pair channel before subscribing to new one | `components/observer/PairSwitcher` |

**Message budget math:** 10 Hz × 60s round × 2 active builders × 20 avg subscribers = 24,000 messages/round. A busy month of 80 rounds = 1.92M — just under the cap with room for other messages.

### 13.3 Vercel (100 GB-hrs function execution / Hobby 10s timeout)

| Guard | Implementation | Where |
| --- | --- | --- |
| Rate limit: game create | Edge Middleware: 10 req/min per IP, sliding window in Vercel KV (or Supabase `rate_limits` table as fallback) | `middleware.ts` path `/api/games` |
| Rate limit: join | Edge Middleware: 30 req/min per IP | `middleware.ts` path `/api/games/*/join` |
| Rate limit: accelerants | 60 req/min per `game_id` claim from JWT (server-side, Supabase counter) | `/api/accelerants` route |
| `maxDuration` on AI routes | `export const maxDuration = 30` on `/rounds/start` (parallel briefs); 15 on `/briefs/reroll` and `/accelerants` (single calls). Each provider call inside the router caps at 6s wall-clock so a hung provider can't gobble the whole budget. | route files; `lib/briefs/router.ts` |
| Edge runtime for read routes | `export const runtime = 'edge'` on `/api/games/[code]` (GET), join page loader — eliminates cold-start for read-heavy paths | those route files |
| Keepalive cron | `vercel.json`: `{ "crons": [{ "path": "/api/keepalive", "schedule": "0 12 */4 * *" }] }` — lightweight GET, no AI calls | `app/api/keepalive/route.ts` |

### 13.4 Rate limit implementation

We avoid adding a Redis/KV dependency by using a simple Supabase table for durable counters and Vercel Edge Middleware's in-process `Map` for the short-window IP limits (acceptable: per-instance reset on cold start only broadens the window slightly, it does not eliminate the limit):

```sql
create table rate_limits (
  key text primary key,            -- 'create:<ip>', 'accelerant:<game_id>'
  count int not null default 0,
  window_start timestamptz not null default now()
);
```

Edge middleware for the two unauthenticated endpoints uses an in-memory sliding window (warm instances share nothing, so the effective cap is `10 × num_instances / minute`, which is still a large multiplier over no limit at all). For the authenticated accelerant endpoint the Supabase `rate_limits` table is authoritative.

### 13.5 What we are NOT protecting against

- Targeted DoS (needs a WAF / Vercel DDoS protection — out of scope for Hobby).
- Cross-game impersonation / data exfiltration — RLS handles DB-level, but we have not hardened API route-level cross-game checks beyond JWT `game_id` claim. Acceptable for a closed-audience workshop tool.
- Brief content moderation beyond the 280-char cap + obscenity-list pass.

---

## 14. Decisions (locked)

| # | Decision |
| --- | --- |
| 1 | **Grid:** ~~triangular, axial coords `(q, r)`, 60° rotation steps throughout v1.~~ Superseded by v1.1: **square grid scaling 3×3..9×9 with complexity, integer cell coords `(q, r)`, 90° rotation steps**. |
| 2 | **Piece tray:** shape-only grid + separate colour palette; selected colour tints the next drop. |
| 3 | **Builder piece count:** unlimited; Test build marks extras wrong. |
| 4 | **Host recovery:** modal at create time + persistent banner on GM dashboard; token submitted in request body (never in URL). |
| 5 | **Brief moderation:** 280-char cap + npm obscenity-list pass; no LLM moderation. |
| 6 | **Time pressure:** fixed −3:00 per press, capped to leave ≥ 30s on clock. |
| 7 | **Sound:** Tone.js synth, no binary assets. |
| 8 | **Migrations:** Supabase CLI, checked into `supabase/migrations`. |
| 9 | **CI:** GH Actions: typecheck + lint + vitest on PR; Playwright smoke on `main` only. |
| 10 | **Telemetry:** Vercel request logs only (geo + path + status code). No additional analytics SDK; no personally identifiable data stored beyond what Vercel captures by default. |
| 11 | **Branding:** text `Tessera` wordmark in Fraunces; mono SVG favicon matching the design system. |
| 12 | **AI default source:** library. AI generation is explicit opt-in at game create; see §13.1 for the OpenAI+Gemini router and budget guardrails. |
| 13 | **JWT expiry:** 4h (down from initial 12h sketch). |
| 14 | **Cookie:** `HttpOnly`, `Secure`, `SameSite=Lax`, path `/`, named `ts_<code>` per game. |

---

## 15. Implementation deltas (post-launch)

The architecture below differs from the original plan in a handful of
small, deliberate ways. Every delta below is in the shipped code.

### 15.1 Authorization model

The original plan in §5.1 had the JWT's `role` claim as authoritative
for non-GM routes. That broke the moment the GM allocates someone in
the lobby — a participant who joined as `observer` and got promoted to
`builder` in the DB still carried `role: observer` in their JWT, so
`POST /placements` rejected them.

Fix: routes that gate on non-GM roles call `readSessionAndParticipant(code)`
instead of `readSessionForGame(code)`. That helper verifies the JWT for
identity, then loads the live `participants.role` from the DB. The JWT
is treated as a pure identity token; current role lives in Postgres.

### 15.2 RPCs

Three SECURITY DEFINER RPCs ship as of v1:

- `create_pair_with_roles(p_game_id, p_builder_id, p_guider_id)` —
  atomic pair creation + role assignment.
- `clear_allocations(p_game_id)` — wipes pairs + resets participants
  to `role='lobby'` (used by Auto-allocate's idempotency).
- `reserve_gemini_call(p_game_id, p_per_game_max, p_per_day_max)` —
  atomic check-and-increment for both the per-game (`games.gemini_calls_used`)
  and global daily (`gemini_budget`) caps, with row-level locking.

All three are revoked from anon/authenticated; the service role is the
only caller.

### 15.3 Brief orchestration

Original §9 sketched the brief pipeline as a single endpoint. Shipped
shape: `lib/briefs/orchestrator.ts` chooses a source per call, and the
`gemini` source delegates to a runtime provider router
(`lib/briefs/router.ts`):

- `gm` source uses the `games.${role}_brief_custom` jsonb. Falls back
  to library if the column is null.
- `gemini` source reserves via `reserve_gemini_call` first; on success
  it calls `generateBriefViaAI` which tries OpenAI `gpt-4o-mini`,
  then Gemini `gemini-2.5-flash-lite`, then throws
  `AIBriefRouterError`. On any AI failure (router error, reservation
  cap, schema/timeout), the orchestrator falls back to library by
  default; `/rounds/start` passes `allow_library_fallback: false` so
  it can surface a typed `GeminiBriefFailedError` to the GM and let
  them choose between &ldquo;Use preset briefs&rdquo; / Cancel via
  the `GeminiFallbackModal`. The reservation isn't refunded on
  failure because failures are rare and refunds add complexity.
- `library` source is the default and the universal fallback.

The persisted `briefs.source` is always `"gemini"` regardless of which
AI provider answered — the storage enum is `library | gm | gemini` and
we don't extend it. The actual provider is reported via
`router.attempts[]` in the orchestrator's observability log.

`maxDuration` set to 30s on `/rounds/start` (multiple AI calls in
parallel during round start), 15s on `/briefs/reroll` and
`/accelerants` (single calls). Each provider call inside the router
has its own 6s wall-clock timeout so one hung provider can't gobble
the whole `/rounds/start` budget.

### 15.4 Schema migrations applied

In dependency order (17 total as of 2026-04-28):
1. `tessera_v1_schema` — initial tables.
2. `tessera_v1_harden` — pinned search_path, anon revoke.
3. `tessera_v1_seed_brief_library` — 33-entry library.
4. `tessera_v1_pair_rpcs` — RPCs above.
5. `tessera_v1_briefs_revealed` — Reveal-briefs state.
6. `tessera_v1_prototype_and_snapshot` — Prototype + Agile-share state.
7. `tessera_v1_custom_briefs` — GM free-text brief storage.
8. `tessera_v1_gemini_reserve_rpc` — atomic budget reservation
   (now also bounds OpenAI calls via the AI router; name kept for
   backward compatibility).
9. `add_scoring_fields_to_games` — `scoring_correct_pts` /
   `scoring_wrong_pts` for the v1.1 Test-solution scoring tile.
10. `add_pair_display_name` — `pairs.display_name` for pair self-naming.
11. `add_v11_accelerant_kinds` — extends `accelerant_t` with
    `change_builder_brief`, `harder`, `easier` (Vocab swap was already
    `vocab_swap` in the v1.0 enum and is reused for &ldquo;Change
    guider brief&rdquo;).
12. `add_player_recovery_token` — bcrypt hash + plain-token shadow for
    the player recovery flow.
13. `tighten_placements_rot_check` — narrows the `rot` check
    constraint to `0..3` (square grid only takes 90° increments).
14. `atomic_counter_rpcs` — race-safe `increment_*` RPCs replacing
    read-modify-write on counter columns.
15. `video_call_url_optional` — drops `NOT NULL` from
    `games.video_call_url`. Workshops that coordinate the call link
    out-of-band shouldn't be forced to paste a URL into the host
    form; the player views skip the "Join the video call" CTA when
    null.
16. `breakouts_and_google_tokens` — adds `games.breakouts_enabled`
    (vestigial — superseded by `breakout_provider` in migration 18;
    current code paths gate on `provider !== 'none'`),
    `pairs.{breakout_call_url, breakout_event_id}`, and a new
    `gm_google_tokens` table (encrypted access + refresh tokens,
    expiry, scope) for the per-pair Meet breakouts feature.
17. `agile_share_default_off` — flips
    `pair_rounds.shares_remaining` default from 3 → 0. The Agile
    share super-power now grants +1 share per fire instead of
    starting at 3 unconditionally.
18. `meeting_mode_and_breakout_provider` — adds
    `games.meeting_mode` (`remote`|`in_person`, default `remote`)
    and `games.breakout_provider` (`none`|`google_meet`|`jitsi`,
    default `none`), plus `participants.email` (nullable, populated
    only when the game's provider is `google_meet`). Backs the
    in-person/remote toggle and the Jitsi provider option in the
    host form.
20. `drop_breakouts_enabled` — drops the vestigial
    `games.breakouts_enabled` column. Was set on game-create but
    never read; canonical check is `breakout_provider != 'none'`.
21. `rename_accelerant_to_super_power` — renames the
    `accelerant_events` table → `super_power_events`, the enums
    `accelerant_t` → `super_power_kind` and `accelerant_scope_t` →
    `super_power_scope`, and the enum value `vocab_swap` →
    `change_guider_brief`. Pure rename — no data motion. Aligns the
    schema with the user-visible product terminology that's been in
    place since v1.1.

(legacy entries below kept for context — counts haven't shifted.)
19. `brief_library_v2` — adds 8 briefs in the styles surfaced by
    the 2026-04-28 playtest (silly invented vocabularies, acronym
    shorthand, themed jargon — pirate's log, star captain, cooking
    show host, telegraph operator, plus compass swap + diagonal
    logic builder briefs) and softens two over-stacked existing
    briefs (`Three-step delay` and `Reverse perspective`) from four
    simultaneous transformations to two. The library now has ~35
    entries spanning the three complexity buckets.

### 15.5 New routes shipped beyond §10

- `POST /api/games/[code]/host-recover` — bcrypt verify + JWT mint for
  bookmark-recovery.
- `POST /api/games/[code]/agile-share` — builder-triggered snapshot.
- `POST /api/games/[code]/observe` — observer pair switcher.
- `POST /api/games/[code]/end` — end game.
- `POST /api/games/[code]/rounds/end` — end round.
- `POST /api/games/[code]/briefs/reroll` — re-roll a single brief.
- `GET  /api/games/[code]/summary` — per-pair final accuracy.
- `GET  /api/games/[code]/play` — role-aware play state (this was
  always planned, listing for completeness).
- `GET  /api/me/active-games` — cookie-driven resume-games list.
- `GET  /api/keepalive` — Vercel cron + Supabase pause prevention.

### 15.6 Realtime topology — broadcast on a single per-game topic

§8 sketched a postgres_changes + broadcast topology with per-pair
channels and Realtime RLS. The shipped v1.1 implementation is leaner:

- One broadcast topic per game (`tessera:<game_id>`, see
  `lib/realtime/topic.ts`). All mutations on that game publish to it.
- Server-side publisher: `lib/realtime/publish.ts`'s
  `publishGameEvent(game_id, kind, payload)` posts to Supabase's
  `/realtime/v1/api/broadcast` REST endpoint with the service-role
  key and a 2s timeout. Failure is logged + swallowed (the polling
  fallback below covers it).
- Client subscriber: `lib/realtime/useGameEvents` joins the topic via
  the public anon key, listens for any event (`event: "*"`), and
  debounces a caller-provided refetch by 200ms. Consumers (PlayContent,
  MasterPairView, etc.) re-fetch the relevant API endpoint when the
  hook fires — see design_patterns.md > "Realtime broadcast triggers
  refetch".
- **Polling fallback** lives at `POLL_MS = 10_000` in
  `components/play/PlayContent.tsx`. It catches the ~1% of cases where
  realtime drops (NEXT_PUBLIC_SUPABASE_ANON_KEY missing in a deploy,
  WS pause when a tab is backgrounded, edge networks blocking WS).

Deliberately **not** done from the original §8 sketch: per-pair
channels, Realtime RLS, postgres_changes triggers. The single-topic
shape is cheap to reason about and the JWT/anon-key story is "the
topic name is keyed by an unguessable game_id" rather than RLS-on-
realtime. If we ever need to scope updates more tightly (e.g. so
MasterPairView's focused-pair refetch isn't triggered by every
unrelated pair's placements), the next move is per-pair topics or a
filter on the broadcast payload's `pair_id` rather than introducing
postgres_changes.

### 15.7 Marketing surface

Not in the original spec but shipped:
- `/how-it-works` and `/facilitator-guide` content pages, sharing a
  `ContentLayout` shell + `OssFooter`.
- "Resume game" banner on the home page, driven by the new
  `/api/me/active-games` endpoint that reads every `ts_*` cookie and
  filters out invalid/ended/purged sessions.
- Game-over screen now renders a per-pair leaderboard with final
  accuracy + a CTA back to the home page.

### 15.8 Meeting mode + per-pair breakouts (optional feature)

Two related game-create knobs control how the workshop conducts its
audio:

- `games.meeting_mode` — `remote` (default) or `in_person`. In-person
  drops video / whiteboard / breakout UI from the host form and the
  player views entirely; the URLs are stored as null.
- `games.breakout_provider` — `none` (default), `google_meet`, or
  `jitsi`. Picked at game-create from a radio inside the host form's
  remote-only block. Each pair gets one breakout link; `pairs.{breakout_call_url, breakout_event_id}` carry the pair-side state.

Provider behaviour:

#### `none`
Players use the workshop-level `video_call_url` only (or no video at
all if that's null). No Step 4 panel on the dashboard.

#### `jitsi`
- **No OAuth, no API call, no email collection.** The
  `/api/games/[code]/breakouts/generate` route computes
  `https://meet.jit.si/tessera-<gameCode>-<pairId>` for each pair via
  `lib/breakouts/jitsi.ts:jitsiUrlForPair`. Idempotent — already-set
  pairs are skipped.
- `pairs.breakout_event_id` is stored as a sentinel (`jitsi:<pairId>`)
  so the cleanup loops can identify these rows and skip the Calendar
  API. Rooms on `meet.jit.si` are stateless, so there's nothing to
  delete server-side.
- `/breakouts/clear` and `/end` clear the local pair URLs only.
  `/end` also skips the OAuth-token revocation step.
- Available on every deployment with no extra config.

#### `google_meet`
- Only lights up when `GOOGLE_OAUTH_CLIENT_ID` + `_CLIENT_SECRET` are
  configured on the deployment. The host-form picker renders the
  Google Meet option in a disabled state ("Not configured on this
  deployment") when those env vars are absent — the GM falls back to
  Jitsi or None by picking one of the other rows.
- **OAuth via [`arctic`](https://arcticjs.dev)** — small, audited
  library that wraps Google's authorization code + PKCE flow. We
  ship a thin layer around `arctic.Google` in `lib/google/oauth.ts`
  that adds a signed-JWT state parameter (binds the OAuth roundtrip
  to a specific `game_id`, carries the PKCE verifier, and records
  the request origin so the callback's redirect URI matches the one
  Google saw on the start hop — important for preview deploys with
  hosts that change per-PR).
- **Routes:**
  - `GET /api/auth/google/start?code=<game-code>` — GM-session-gated.
    Redirects to Google's consent screen with `scope=calendar.events`
    + `access_type=offline` + `prompt=consent`.
  - `GET /api/auth/google/callback` — verifies state JWT, exchanges
    code for tokens via arctic, persists encrypted tokens, redirects
    back to `/g/<code>/master?google_connected=1`.
- **Token storage** — `gm_google_tokens` table (one row per game).
  Tokens are AES-256-GCM encrypted at rest; the key is derived from
  `TESSERA_JWT_SECRET` via HKDF with a "tokens" info string so the
  JWT-signing path and the encryption path use independent material.
  `lib/google/tokenStore.ts` exposes `upsertTokens`,
  `getValidAccessToken` (auto-refreshes within 60s of expiry),
  `getSession` (presence check for the dashboard), and
  `revokeAndDelete` (game-end cleanup).
- **Per-pair link minting** — `POST /api/games/[code]/breakouts/generate`
  iterates pairs sequentially (1-25 pairs, well under Calendar API
  rate limits), calling `createBreakoutEvent` per pair. Each event is
  set to private visibility, anchored 1 hour in the past, 5 minutes
  long, with `conferenceData.createRequest` to attach a Meet link.
  Pair participants are added as Calendar event attendees (built
  from `participants.email`) so signed-in joiners bypass Meet's
  knock screen — that's the reason the join form requires email
  when this provider is selected. Persists `breakout_call_url` +
  `breakout_event_id` on the pair row. Idempotent: pairs that
  already have a link are skipped.
- **Cleanup** — `/end` calls `deleteBreakoutEvent` per pair, then
  `revokeAndDelete` to invalidate the OAuth grant. Best-effort:
  failures don't block game-end (orphaned events are GM-visible only
  and easy to bulk-delete by searching "Tessera breakout").

Cross-provider:

- **Email at join time** — `participants.email` is nullable. The join
  API requires + lowercases + length-limits it only when
  `game.breakout_provider === 'google_meet'`. Stored only for the
  duration of the game (the row is dropped along with everything
  else at game-end purge). Never used outside Calendar attendee
  attachment.
- **Player surface** — `JoinCallCta` accepts an optional
  `breakoutCallUrl` prop, regardless of provider. When set, primary
  CTA = breakout (purple badge, "Join your pair's call · breakout");
  workshop-level `video_call_url` demotes to a small `↗ Main room`
  secondary link. `PlayTopBar`'s LinksBar mirrors the same hierarchy.
- **Diagnostic** — `GET /api/diag/env` returns env-var presence (not
  values) so a maintainer can verify Vercel scope settings without
  exposing secrets.

Free-tier impact: zero. Google Meet path: Calendar API has 1M
queries/day; Tessera generates ≤2 per pair (create + delete) so
workshop scale (~25 pairs/game) sits at 0.005% of quota. Jitsi path:
no metered API at all.

Known caveat (Google Meet only): Meet's join flow can still gate
non-signed-in joiners on a knock-to-join confirmation despite the
attendee attachment — when the joiner isn't signed in to Google at
all, attendee status doesn't help. Workspace + the Meet REST API
(`spaces.create` with `accessType: OPEN`) is the only path to a
fully no-account join experience on Google's side. The Jitsi
provider sidesteps this entirely.

---

*End of TDD.*
