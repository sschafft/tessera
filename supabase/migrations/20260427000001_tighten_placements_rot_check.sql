-- v1.1 follow-up: shrink the `placements.rot` check from 0..5 to 0..3.
--
-- The original schema (migration 1) was written for a triangular grid
-- with 60° rotation steps (six positions). v1.1 moved to a square
-- grid with 90° steps (four positions) — every code path now assumes
-- 0..3:
--
--   - lib/grid/coords.ts: `rot` documented as 0..3
--   - app/api/games/[code]/placements/route.ts: validator rejects rot>3
--   - app/api/games/[code]/placements/[id]/route.ts: same
--   - lib/scoring/score.ts normaliseRot: clamps to 0..3 / parity
--   - lib/pattern/generator.ts: `pickInt(rng, 0, 3)`
--
-- The DB CHECK was the only place 0..5 still survived. A buggy or
-- malicious client that bypassed the route validator could store
-- rot=4/5 — the row would land but the scorer would never match it.
-- Tighten the constraint so the DB itself rejects.
--
-- We drop and re-add (rather than ALTER ... USING since CHECK
-- constraints don't support that syntax). No-op against the live DB
-- if the constraint already matches; safe re-run.

alter table placements drop constraint if exists placements_rot_check;
alter table placements add constraint placements_rot_check check (rot in (0, 1, 2, 3));
