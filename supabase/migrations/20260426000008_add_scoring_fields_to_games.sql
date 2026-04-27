-- v1.1: Test solution + scoring config (PRD §6.11).
--
-- Two int columns on `games` so the GM can tune correct-pts (1..100)
-- and the per-wrong penalty (-10..0). Defaults preserve v1 behaviour
-- (10 / 0 = no penalty); the GM bumps wrong_pts down via the Scoring
-- super-power tile to make wrong placements actually cost.
--
-- Idempotent — `add column if not exists` so re-running this migration
-- against a DB that already has it (i.e. the live tessera-dev project)
-- is a safe no-op.

alter table games
  add column if not exists scoring_correct_pts integer not null default 10;

alter table games
  add column if not exists scoring_wrong_pts integer not null default 0;

comment on column games.scoring_correct_pts is
  'Points awarded per correct placement on Test solution. GM-tunable 1..100 (default 10).';
comment on column games.scoring_wrong_pts is
  'Per-wrong-placement penalty applied at Test solution. GM-tunable -10..0 (default 0 = no penalty). Scores can go negative.';
