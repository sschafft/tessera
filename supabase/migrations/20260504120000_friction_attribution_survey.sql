-- Friction-attribution reflection survey (replaces the v1 4-way pick).
--
-- The 2026-05-04 design pass evolved the round-end reflection from a
-- single 4-way "what made it harder" enum into a forced-choice
-- attribution slider that splits 100 points across self / partner /
-- system. The richer data lets the aggregator surface the magnitude
-- of friction *and* the directional asymmetry between builders and
-- guiders — that's what the facilitator can actually start a
-- conversation around at the debrief.
--
-- Two changes:
--
-- 1. round_surveys schema:
--    - add attr_self, attr_partner, attr_system int columns
--      (each 0..100; sum to 100 by CHECK so the orchestrator can
--      trust the values without re-validating)
--    - drop what_made_harder (forward-only — v1-alpha row count is
--      tiny; the dashboard never depended on it once the new
--      aggregate ships)
--    - comm_balance unchanged
--
-- 2. rounds.reflection_survey_requested boolean default false:
--    - GMs now opt-in to the survey per round at end-round time
--      (previously it fired for every round). Players only see the
--      RoundSurvey card when this flag is true on the round they
--      just played.
--
-- Backfill: existing round_surveys rows lose the v1 what_made_harder
-- value; attr_* are nullable for those rows so the aggregator can
-- distinguish v1 responses (no attribution) from v2 (with).

alter table rounds
  add column if not exists reflection_survey_requested boolean
    not null default false;

-- attr_* columns nullable so the surface is forward-compatible: the
-- aggregator filters to rows where all three are present, ignoring
-- v1 rows. Sum-to-100 + per-axis bound is enforced via a row-level
-- check that allows three nulls but requires the constraints when
-- any are set.
alter table round_surveys
  add column if not exists attr_self int,
  add column if not exists attr_partner int,
  add column if not exists attr_system int;

alter table round_surveys
  add constraint round_surveys_attr_bounds_chk
  check (
    (attr_self is null and attr_partner is null and attr_system is null)
    or (
      attr_self between 0 and 100
      and attr_partner between 0 and 100
      and attr_system between 0 and 100
      and attr_self + attr_partner + attr_system = 100
    )
  );

-- Drop the v1 4-way pick. Forward-only — the v1 column was only
-- consumed by the summary aggregator's `harder_reasons` block which
-- the v2 aggregator replaces.
alter table round_surveys
  drop column if exists what_made_harder;
