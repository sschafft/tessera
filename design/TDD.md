# Tessera — Technical Design Doc (TDD v0.1)

> **Status:** Draft for review. Open implementation questions in §13.
> **Reads alongside:** `./PRD.md`, `./tessera/` (Claude Design handoff bundle).

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
| Gemini | `@google/generative-ai` SDK, server-side only | `gemini-1.5-flash` (free tier). |
| Lint / format | ESLint (Next preset) + Prettier | |
| Testing | Vitest (unit) + Playwright (e2e, smoke only in v1) | |
| CI | GitHub Actions: typecheck, lint, vitest on PR | Playwright run on `main` only. |
| Hosting | Vercel | Edge runtime where reasonable; Node runtime for Gemini proxy. |

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

- **Host:** `POST /api/games` → sets the GM cookie, then redirects to `/g/<code>/master`. A **host recovery token** (32-byte random, stored as `bcrypt` hash in `games.host_token_hash`) is shown **once** in a modal at create time. The modal copy says "save this URL". The recovery URL is `https://<host>/host-recover/<code>` — which is a page that prompts for the token; the token is submitted via `POST /api/games/<code>/host` in the **request body**, never in a URL query string. This prevents it leaking via browser history, Vercel logs, or the `Referer` header sent to Meet/Miro when the GM clicks an external link while screen-sharing.
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
  q int not null, r int not null,               -- axial coords on triangular grid
  rot smallint not null check (rot in (0,1,2,3,4,5)),  -- 60° steps
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

We use a **triangular grid** as the default (PRD §6.4); a square grid is an alternate render. Either way pieces are stored in **integer cell coordinates**, never pixels — keeps correctness checks trivial.

### 7.1 Triangular grid

- Cells are indexed by axial coords `(q, r)` where each integer pair is one upward or downward triangle determined by `(q + r) mod 2`.
- Pieces occupy 1+ cells:
  - `tri-up` / `tri-dn` — 1 cell, rotation has no effect (rot=0).
  - `rhomb` — 2 cells (one up + one down).
  - `sq` — 2 cells, rotated.
  - `trap` — 3 cells.
  - `hex` — 6 cells (canonical hex of 6 triangles).
- Rotation `rot ∈ {0..5}` × 60°. For 1-cell pieces it's a no-op.

### 7.2 Snap

- DnD library reports a pixel position; a `closestTriangleCell(point) → (q, r)` helper snaps.
- Drop is invalid if any of the piece's occupied cells is already taken. We highlight conflict in red and reject the placement.

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

Single server-side path. **The browser never calls Gemini directly.** All Gemini spending flows through one route handler that enforces multiple layers of limits before touching the API.

```
client → POST /api/briefs
         { round_id, pair_id, role, source }
              │
              ▼
       [1] Validate JWT — must be gm role for this game
              │
              ▼
       [2] Check global daily cap (games.gemini_calls_global_today ≤ 800)
              │
              ▼
       [3] Check per-game cap (games.gemini_calls_used ≤ 30)
              │
              ▼
       [4] Check in-process cache keyed by hash(complexity, role, rules_version)
              │ HIT                │ MISS
              ▼                   ▼
         return cached      gemini SDK call
         result             with retry + 429 backoff
                                  │ fail after 2 retries
                                  ▼
                             fall back to library
              │
              ▼
       increment games.gemini_calls_used (per-game)
       + games.gemini_calls_global_today via daily counter row
              │
              ▼
       insert into briefs(...)
              │
              ▼
   postgres_changes → pair channel
```

### Budget layers

| Layer | Cap | Scope | Action on breach |
| --- | --- | --- | --- |
| Global daily | 800 calls | All games, resets midnight UTC | Fall back to library; no error shown |
| Per-game | 30 calls | One game's lifetime | Fall back to library; no error shown |
| Per-minute (client-side) | Re-roll button disabled for 4s after press | UX only | Button greyed out |
| Gemini 429 retry | 2 retries, exponential 2s/4s backoff | One call | Fall back to library after final retry |

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

**Library is the default source on game create.** Gemini is explicitly opt-in (GM selects "AI-generated" for builder and/or guider briefs at the create form). This means the free tier is only consumed when the GM actively asks for it — most games won't spend a single Gemini call.

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
4. **Gemini:** Add a Google AI Studio API key to Vercel (Production only — previews fall back to library briefs to avoid billing surprises).

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
| `GEMINI_API_KEY` | set | unset | unset | Previews + local fall back to library briefs |
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

### 13.1 Gemini (15 RPM / 1,500 RPD free)

| Guard | Implementation | Where |
| --- | --- | --- |
| Global daily cap | `gemini_budget.calls_used ≤ 800` checked transactionally before each call | `/api/briefs` route handler |
| Per-game cap | `games.gemini_calls_used ≤ 30` | same route handler |
| In-process cache | LRU(50) keyed by `sha256(complexity‖role‖rules_version)` | `lib/briefs/cache.ts`, process lifetime |
| 429 backoff | Retry at 2s, then 4s; fall back to library on second failure | `lib/briefs/gemini.ts` |
| Library-as-default | `source = 'library'` at game create; Gemini is explicit opt-in | landing form |
| `maxDuration` | `export const maxDuration = 8` on `/api/briefs` (under Vercel Hobby 10s cap, leaves retry budget) | route file |

**Worst case with guards:** 800 calls/day × ~500 tokens/call = 400K tokens/day. Well under the 1M TPM free tier; RPM is managed by the 4s client-side re-roll debounce and the global daily cap preventing a single workshop from consuming them all.

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
| `maxDuration` on Gemini routes | `export const maxDuration = 8` | `/api/briefs`, `/api/accelerants` |
| Edge runtime for read routes | `export const runtime = 'edge'` on `/api/games/[code]` (GET), join page loader — eliminates cold-start for read-heavy paths | those route files |
| Keepalive cron | `vercel.json`: `{ "crons": [{ "path": "/api/keepalive", "schedule": "0 12 */4 * *" }] }` — lightweight GET, no Gemini | `app/api/keepalive/route.ts` |

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
| 1 | **Grid:** triangular, axial coords `(q, r)`, 60° rotation steps throughout v1. |
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
| 12 | **Gemini default source:** library. Gemini is explicit opt-in at game create; see §13 for budget guardrails. |
| 13 | **JWT expiry:** 4h (down from initial 12h sketch). |
| 14 | **Cookie:** `HttpOnly`, `Secure`, `SameSite=Lax`, path `/`, named `ts_<code>` per game. |

---

*End of TDD.*
