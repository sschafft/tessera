# Tessera

> A no-login facilitation game for hybrid workshops. Pairs of **builders** and **guiders** collaborate over an off-platform video call to recreate a target geometric pattern they can't both see — while a **game master** triggers in-game mechanics that surface lessons about communication, prototyping, and shared context.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Status: v1 alpha](https://img.shields.io/badge/status-v1%20alpha-green)](#status)

Tessera is intentionally a *scaffold* for the conversation, not a chat tool. All voice, video, and whiteboarding happen off-platform (Meet, Zoom, Miro, etc.); Tessera links out to those.

---

## Status

✅ **v1 alpha — playable end-to-end** on the live deployment. The full game loop ships: host → join → allocate pairs → start round → place pieces → trigger accelerants → end round → debrief → start another round. Polling fallback paired with Supabase Realtime broadcast for sub-second placement sync.

Spec lives in [`design/PRD.md`](./design/PRD.md) and [`design/TDD.md`](./design/TDD.md). Both docs include "implementation deltas" sections (PRD §10b, TDD §15) noting where the shipped behaviour diverges from the original plan.

---

## Why

Workshops on remote teams keep relearning the same lesson: communication, shared context, and prototyping aren't soft skills — they're the work. Tessera turns those concepts into a 30-minute game where a facilitator can point at the artifact afterward and say *"this is what happened when you assumed your guider meant the same thing by 'left'."*

It's loosely inspired by the classic [Lego Game](https://www.psychologytoday.com/us/blog/digital-leaders/201209/the-lego-game), but rebuilt around tessellating polygons, secret briefs, and an in-game accelerant deck.

---

## Roles

- **Game master** — creates the game, allocates the lobby into pairs, runs the timer, triggers accelerants. Birds-eye view across all pairs.
- **Builder** — places geometric tiles on a canvas to recreate a target they cannot see. Click an empty cell to add; click an existing piece to enter Edit mode (move with another click, rotate, delete). May have a secret "translation" brief.
- **Guider** — sees the goal and describes it to their builder over the off-platform call. May have a secret "constraint" brief.
- **Observer** *(optional)* — read-only spectator assigned to one pair; sees both the build and the goal. Can switch pairs from a bottom strip.

Minimum viable game: 1 GM + 1 Builder + 1 Guider.

---

## Features

- **No accounts.** A six-character game code (`HEX-934`) and a display name; that's it.
- **Resume any in-flight game** from the home page — every browser tab with a live session cookie shows up as a "resume" pill.
- **Player recovery URLs.** Every join returns a recovery URL stored in localStorage and shown as a "save this" affordance after success. If your cookie gets clobbered (multi-tab, browser crash, mobile foreground swap), paste the URL on `/recover/<code>` to reclaim your seat with the same name + role. Stays valid for the life of the game.
- **Square cell grid that scales with complexity** (3×3 at c=1 up to 9×9 at c=8). Optional letter+number coordinate labels (A1, B2, …) on low complexities so guider+builder can speak in coordinates on the call.
- **Tap-to-place builder canvas with edit mode.** Tap an empty cell to drop the selected shape; tap an existing piece to enter Edit mode (move with another click, rotate, delete). Optimistic UI keeps every action snappy — placements echo back to all connected clients within ~200ms via Supabase Realtime.
- **Test solution + scoring.** Builder hits a "Test solution" CTA at any time; the round computes correct/wrong against the goal pattern and lights green/red highlights per piece. Per-wrong penalty is GM-tunable; scores can go negative.
- **Pair self-naming.** A modal nudges each pair to name themselves after they read the brief. Falls back to "<builder> ↔ <guider>" if skipped. Editable inline at any time.
- **Live multi-pair dashboard.** GM sees every pair's progress at a glance, drills into any one, fires accelerants per-pair or globally, and can re-roll briefs per-side.
- **Sealed briefs from three sources.** Pre-seeded library (~33 entries), GM free-text custom briefs, or AI-generated via a **provider router** that tries OpenAI (`gpt-4o-mini`) first for paid-tier reliability, falls back to Gemini (`gemini-2.5-flash-lite`) when OpenAI is unconfigured or down, and finally drops to the library if both AI providers fail. Atomic per-game / global daily caps protect free-tier quotas and the orchestrator surfaces a "use preset briefs" recovery modal to the GM if the AI path fails on round start.
- **Curated super-powers rail.** The GM dashboard surfaces the **top 5** mechanics inline — prototype unlock, reveal briefs, requirement change, time pressure, randomizer — with a **More super powers** CTA that opens a fullscreen grid for the rest (agile share, test build, change builder/guider brief, make it harder/easier). Every super-power is a single-click GM mechanic that maps to a real-world facilitation lesson. Prototype + agile share are uncapped; everything else has small per-round caps. The rail also has an inline scoring tile (per-correct stepper + per-wrong penalty toggle, with a confirm modal when changing penalties mid-round).
- **In-person vs remote mode.** At game-create the GM picks "remote" (default) or "in-person." In-person hides the video / whiteboard / breakouts UI entirely — everyone is in the same room, so the off-platform call CTAs would just be noise.
- **Optional per-pair breakouts (Google Meet or Jitsi).** Remote games can opt into per-pair breakouts via one of two providers:
  - **Google Meet** — GM signs in with Google from Step 4; Tessera mints one private calendar event per pair via the Google Calendar API, attaches the participant emails as attendees so they bypass Meet's knock screen, and surfaces the auto-attached Meet link as that pair's "Join your pair's call" CTA. Events are anchored 1 hour in the past, marked private, and deleted automatically when the GM ends the game. OAuth is built on [`arctic`](https://arcticjs.dev). Tokens are AES-256-GCM encrypted at rest. *Players are asked for an email at join time only when this provider is selected.*
  - **Jitsi** — free, no sign-in for anyone. Tessera generates a deterministic `meet.jit.si/tessera-<code>-<pair>` URL per pair with no API calls and no calendar pollution. Rooms are stateless on the public Jitsi server; nothing to delete at game-end.
  When breakouts are active, the workshop-level video link demotes to a small "main room ↗" secondary link.
- **Add briefs mid-game via super-powers.** When a GM creates a game with one or both briefs off, the rail relabels "Change builder/guider brief" to "Add builder/guider brief" — firing it both flips the side on for future rounds and mints a fresh brief for the current pair_round. Reveal Briefs disables itself when there's nothing to reveal.
- **Brief envelope with minimise.** Players can minimise their brief to just the seal circle so it doesn't overlay the canvas, expand it again with one click, or re-seal it.
- **Realtime updates.** Supabase Realtime broadcast keeps every connected client in sync within ~200ms; a 10-second polling loop is the fallback when sockets drop. Players see a "session lost" recovery banner when their cookie is invalidated mid-round instead of an empty canvas.
- **Mirrored correctness for the guider.** When a builder hits "Test solution," the guider's goal canvas lights up the same green halos and ✓ badges, plus a live "X/Y placed" chip — so the guider can see at a glance whether the directions they're giving are landing.
- **Stepped GM setup flow.** Pre-round, the master view collapses to a single column with three numbered cards (1. Invite players, 2. Pairs + observers, 3. Game settings). Once a round starts, the dashboard expands to the three-column layout with the focused-pair canvas and Super powers rail.
- **Pre-built game from CSV upload.** Already know the roster? The home page surfaces an *upload pre-built game* affordance — drop in a CSV with `name, email, team_name, role`, Tessera mints the game + all pairs in one shot and hands you back the same CSV with a `join_url` column you can paste into a calendar invite or email.
- **Pair management at scale.** The pair sidebar has a `⛶` expand button that opens a fullscreen modal with a participant table + roster search (by name, team, or partner). Pre-round, a `⇄ swap all pairs` CTA flips builder ↔ guider for every fully-paired team in one click — useful for round 2 when you want everyone to feel the other side of the asymmetry.
- **GM per-pair progress chips.** Pair rows on the dashboard show a live progress bar + completion %; pairs that have solved their puzzle render in green. The GM can spot which pair to nudge without drilling in.
- **Celebration UX.** Pairs that complete a round see a "Solved!" banner + confetti burst; super-power triggers fire a momentary `SuperPowerToast` for the affected pair so the change is felt rather than missed.
- **Multi-round + replay.** GM-configurable round count (1–5); after a game ends, the GM can launch a fresh round with the same players from the summary screen.
- **GM debrief prompts + leaderboard.** Game-end view ships with three retro questions to seed the post-game conversation, plus a pair leaderboard ranked by total score.
- **Tone.js sound effects.** Synthesised round-end ding, last-two-minutes warning, time-pressure sting, game-end fanfare. Respects the GM's per-game `sound_on` toggle.
- **Host recovery.** Bookmark URL with a recovery token in the fragment so the GM never gets locked out of their own dashboard if their tab dies. Stays valid for the life of the game.
- **Game lifecycle.** A `bump_game_interaction` trigger maintains `last_interaction_at` so a future scheduled job can soft-delete games 24h after last activity and hard-delete after 7 days. The schema + status enum are in place; the cron is on the tech-debt register, not yet wired.

---

## Tech stack

- **Next.js 16** (App Router) on **Vercel**
- **TypeScript** (strict)
- **Supabase** Postgres + Realtime, with Row Level Security
- **Tailwind CSS v4** + a small CSS layer porting the design tokens
- **Inline SVG** for tiles (no Konva or Canvas2D)
- **AI brief router** — OpenAI `gpt-4o-mini` (primary) → Google `gemini-2.5-flash-lite` (fallback) → static library (final fallback). All AI calls are server-side only.
- **Tone.js** for synthesised sound effects (no audio assets)
- **jose** for HS256 JWTs, **bcryptjs** for the host-recovery token

Full architecture is in [`design/TDD.md`](./design/TDD.md).

---

## Getting started

### Prerequisites

- Node 20+ (we develop on 21)
- pnpm 10+ (the older pnpm 7 has a Node 21 incompatibility — `npm i -g pnpm@latest`)
- Supabase CLI (`brew install supabase/tap/supabase` or [other install methods](https://supabase.com/docs/guides/cli))
- A free [Supabase](https://supabase.com) account
- A free [Vercel](https://vercel.com) account (for deploys + previews)

> No Docker required — dev runs against a hosted Supabase project, which mirrors production exactly.

### Quickstart

```bash
git clone https://github.com/sschafft/tessera.git
cd tessera
pnpm install

# 1. Create a Supabase project at https://supabase.com (call it tessera-dev)
# 2. Copy its URL + anon key + service-role key into .env.local; generate
#    a TESSERA_JWT_SECRET with `openssl rand -base64 32`.
cp .env.example .env.local

# 3. Link the CLI to your project and apply migrations
pnpm supabase link --project-ref <your-dev-project-ref>
pnpm supabase db push

# 4. Run the dev server
pnpm dev                     # http://localhost:3000
```

See [`design/TDD.md` §11](./design/TDD.md) for the full setup including Vercel env vars and the production deploy flow.

### Environment

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Browser uses it as the Realtime endpoint; server uses it for service-role REST calls (broadcast publish, repository queries) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | Browser uses it for Realtime broadcast subscriptions |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Used by route handlers; bypasses RLS |
| `TESSERA_JWT_SECRET` | server | Signs our session JWTs (independent of Supabase's JWT secret) |
| `TESSERA_PUBLIC_URL` | server | Used in host-recovery URLs |
| `OPENAI_API_KEY` | server only | Optional. Primary AI provider for brief generation (`gpt-4o-mini`). When set, the AI brief router prefers OpenAI over Gemini for higher-volume workshops where the free Gemini tier exhausts. |
| `GEMINI_API_KEY` | server only | Optional. Free-tier fallback AI provider for brief generation (`gemini-2.5-flash-lite`). When neither AI key is set, every "AI-generated" brief is silently library-sourced. |
| `GOOGLE_OAUTH_CLIENT_ID` | server only | Optional. Required only for the **Google Meet** breakout provider. Set both this and `GOOGLE_OAUTH_CLIENT_SECRET` to enable the Google Meet option in the host form's breakout-provider picker; the OAuth client must list `<host>/api/auth/google/callback` in its Authorized redirect URIs. The Jitsi provider needs no env vars. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | server only | Optional. Paired with `GOOGLE_OAUTH_CLIENT_ID`. |

### Deploying to Vercel

1. Connect this GitHub repo to a new Vercel project (Add New… → Project → Import).
2. In **Settings → Environment Variables**, add every row from the table above. Apply each to **Production**, **Preview**, and **Development** unless noted:
   - `OPENAI_API_KEY` — Production only is recommended (the paid OpenAI quota is shared across previews and could burn through unexpectedly during PR work).
   - `GEMINI_API_KEY` — Production only is recommended (previews fall back to library to avoid burning the free-tier quota).
   - `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` — Production only is recommended, and only needed if you want to offer the Google Meet breakout provider. The redirect URI is derived from the request's origin at runtime, so each Vercel preview host you want to test Google Meet breakouts on (e.g. `tessera-git-foo.vercel.app`) needs its `/api/auth/google/callback` URL added to the OAuth client's Authorized redirect URIs in Google Cloud Console. The Jitsi provider works on every deployment with no extra config.
   - `TESSERA_PUBLIC_URL` — set to your custom domain on Production.
3. Push to `main` → Vercel deploys to Production.
4. Push to a branch → Vercel deploys a preview against the same Supabase project.

Vercel's built-in cron runs the `/api/keepalive` endpoint daily to prevent Supabase from auto-pausing the project after a week of inactivity (see [`vercel.json`](./vercel.json) and TDD §13.3).

---

## Project structure

```
tessera/
├── app/                       # Next.js App Router pages + API routes
│   ├── (marketing)            # /, /how-it-works, /facilitator-guide
│   ├── api/                   # All mutation + read endpoints
│   ├── g/[code]/              # /play (builder/guider/observer/lobby) + /master + /join
│   └── host-recover/[code]/   # Bookmark-recovery flow for the GM
├── components/
│   ├── canvas/                # SVG canvas, grid, tiles, coordinate labels, interactive canvas
│   ├── landing/               # Home hero + tabs + resume-games strip
│   ├── master/                # GM dashboard (lobby, pairs, accelerant rail, end-game summary)
│   ├── play/                  # Per-role views, brief envelope, round-ended + game-ended views
│   ├── marketing/             # ContentLayout + OssFooter for the long-form pages
│   └── primitives/            # Shared UI atoms (Wordmark, RoleChip, Avatar, Field…)
├── lib/
│   ├── auth/                  # JWT mint/verify, cookie helpers, host-token bcrypt, AES-GCM token encryption
│   ├── briefs/                # Library picker, AI router (OpenAI + Gemini), orchestrator
│   ├── game/                  # Repository (in-memory + Supabase backends)
│   ├── google/                # arctic-based OAuth helpers + Calendar API wrapper + token store
│   ├── grid/                  # Cell↔pixel math + canvas constants
│   ├── pattern/               # Deterministic procedural goal-pattern generator
│   ├── realtime/              # Server publish + client subscribe hook
│   ├── sound/                 # Tone.js wrappers
│   └── superpowers/           # Per-super-power policy + cooldown enforcement
├── styles/                    # globals.css + tessera.css design tokens
├── supabase/migrations/       # 21 SQL migrations applied to tessera-dev
├── public/                    # Static assets
└── design/                    # PRD, TDD, design_patterns, Claude Design handoff bundle
```

---

## Open-source / scaling note

Tessera runs on the **Vercel + Supabase free tier** and is built around those constraints — see TDD §13 for the per-service guardrails (AI per-game + per-day caps, Realtime drag-broadcast throttle, concurrent-game cap, Vercel `maxDuration`). It's plenty for facilitator workshops with up to ~50 participants per game.

For production-scale or commercial use, fork and self-host: drop your own Supabase project + Vercel team in, raise the caps, and you're off. The AI provider router makes it cheap to swap providers — drop in a paid OpenAI key for high-traffic workshops, leave the Gemini key set as a free fallback, and the orchestrator handles the rest.

---

## Contributing

Tessera is in v1 alpha. External contributions welcome via PR — please open an issue first to discuss anything bigger than a polish change. A formal `CONTRIBUTING.md` lands when we hit beta.

---

## License

MIT — see [`LICENSE`](./LICENSE).
