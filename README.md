# Tessera

> A no-login facilitation game for hybrid workshops. Pairs of **builders** and **guiders** collaborate over an off-platform video call to recreate a target geometric pattern they can't both see — while a **game master** triggers in-game mechanics that surface lessons about communication, prototyping, and shared context.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Status: pre-alpha](https://img.shields.io/badge/status-pre--alpha-orange)](#status)

Tessera is intentionally a *scaffold* for the conversation, not a chat tool. All voice, video, and whiteboarding happen off-platform (Meet, Zoom, Miro, etc.); Tessera links out to those.

---

## Status

🚧 **Pre-alpha.** Design and specs are in [`design/`](./design); implementation has not started. The PRD and TDD are open for review — see [`design/PRD.md`](./design/PRD.md) and [`design/TDD.md`](./design/TDD.md).

---

## Why

Workshops on remote teams keep relearning the same lesson: communication, shared context, and prototyping aren't soft skills — they're the work. Tessera turns those concepts into a 30-minute game where a facilitator can point at the artifact afterward and say *"this is what happened when you assumed your guider meant the same thing by 'left'."*

It's loosely inspired by the classic [Lego Game](https://www.psychologytoday.com/us/blog/digital-leaders/201209/the-lego-game), but rebuilt around tessellating polygons, secret briefs, and an in-game accelerant deck.

---

## Roles

- **Game master** — creates the game, allocates the lobby into pairs, runs the timer, triggers accelerants. Birds-eye view across all pairs.
- **Builder** — drags geometric tiles onto a canvas to recreate a target they cannot see. May have a secret "translation" brief.
- **Guider** — sees the goal and describes it to their builder over the off-platform call. May have a secret "constraint" brief.
- **Observer** *(optional)* — read-only spectator assigned to one pair; sees both the build and the goal.

Minimum viable game: 1 GM + 1 Builder + 1 Guider.

---

## Features

- **No accounts.** A 6-character game code (`HEX-934`) and a display name; that's it.
- **Live multi-pair dashboard.** GM sees every pair's progress at a glance and can drill into any one.
- **Sealed briefs.** Each player gets a private "translation" or "constraint" rule. Players can probe each other 20-questions-style but can't disclose their brief.
- **Eight accelerants.** Prototype unlock, reveal briefs, test build, agile share, time pressure, vocab swap, randomizer, requirement change — each a single-click GM mechanic that maps to a real-world facilitation lesson.
- **Multi-round.** Up to 5 rounds per game, complexity tunable per round, pairings persist unless the GM hits Shuffle.
- **Auto-purge.** Games are soft-deleted 24h after the last interaction, hard-deleted after 7 days.

---

## Tech stack

- **Next.js 15** (App Router) on **Vercel**
- **TypeScript** (strict)
- **Supabase** Postgres + Realtime, with Row Level Security
- **Tailwind CSS** + a small CSS layer porting the design tokens
- **dnd-kit** for the canvas, **inline SVG** for tiles
- **Gemini 1.5 Flash** for procedural brief generation (server-side only)

Full architecture is in [`design/TDD.md`](./design/TDD.md).

---

## Getting started

> Coming soon — the codebase doesn't exist yet. The steps below are the planned developer flow as documented in the TDD.

### Prerequisites

- Node 20+ (we develop on 21)
- pnpm 9+
- Supabase CLI (`brew install supabase/tap/supabase` or [other install methods](https://supabase.com/docs/guides/cli))
- A free [Supabase](https://supabase.com) account (we use one project for dev and one for prod)
- A free [Vercel](https://vercel.com) account (for deploys + previews)

> No Docker required — dev runs against a hosted Supabase project, which mirrors production exactly.

### Quickstart

```bash
git clone https://github.com/<your-fork>/tessera.git
cd tessera
pnpm install

# 1. Create a Supabase project at https://supabase.com (call it tessera-dev)
# 2. Copy its URL, anon key, service-role key, JWT secret into .env.local
cp .env.example .env.local

# 3. Link the CLI to your dev project and apply migrations
pnpm supabase link --project-ref <your-dev-project-ref>
pnpm supabase db push

# 4. Run the dev server
pnpm dev                     # http://localhost:3000
```

See [`design/TDD.md` §11](./design/TDD.md) for the full setup including Vercel env vars and the production deploy flow.

### Environment

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | RLS-protected, safe in browser |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Used by route handlers; bypasses RLS |
| `TESSERA_JWT_SECRET` | server | Signs our session JWTs (independent of Supabase's JWT secret) |
| `TESSERA_PUBLIC_URL` | server | Used in host-recovery URLs |
| `GEMINI_API_KEY` | server only | Procedural brief generation (Production only — preview/local fall back to library briefs) |

### Deploying to Vercel

1. Connect this GitHub repo to a new Vercel project (Add New… → Project → Import).
2. In the project's **Settings → Environment Variables**, add every row from the table above. Apply each to **Production**, **Preview**, and **Development** unless noted:
   - `GEMINI_API_KEY` — Production only.
   - `TESSERA_PUBLIC_URL` — set to your custom domain on Production, leave Preview unset (Vercel exposes `VERCEL_URL` for previews; we read this as a fallback).
3. Push to `main` → Vercel deploys to Production.
4. Push to a branch → Vercel deploys a preview against the same Supabase project.

Vercel's built-in cron runs the `/api/keepalive` endpoint daily to prevent Supabase from auto-pausing the project after a week of inactivity (see [`vercel.json`](./vercel.json) and TDD §13.3).

---

## Project structure

```
tessera/
├── app/                  # Next.js App Router (pages + API)
├── components/           # Canvas, envelope, lobby, accelerants, primitives
├── lib/                  # Auth, supabase clients, grid math, brief generator
├── styles/               # globals + tessera.css (design tokens)
├── supabase/migrations/  # SQL migrations
├── tests/                # vitest + playwright
└── design/               # PRD, TDD, Claude Design handoff bundle
```

---

## Contributing

Tessera is in pre-alpha and not yet accepting external contributions. If you'd like to follow along or share feedback, open an issue. Once we hit alpha we'll publish a `CONTRIBUTING.md` with the development flow.

---

## License

MIT — see [`LICENSE`](./LICENSE).
