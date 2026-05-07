-- Per-pair brief overrides set at game-create time (typically via the
-- CSV upload flow). When the GM pre-writes briefs for specific pairs,
-- the orchestrator consumes them on round 1 and then clears the
-- columns so round 2+ revert to the game-level brief source. This
-- keeps the override semantics narrow: "seed this pair's first round
-- with the brief I wrote" — not a permanent pin.
--
-- Shape: { title: string; rules: string[] } | null. Validation lives
-- at the API boundary (sanitiseCustom in /api/games and the upload
-- route) so the storage layer trusts the value here.

alter table pairs
  add column if not exists builder_brief_override jsonb,
  add column if not exists guider_brief_override jsonb;
