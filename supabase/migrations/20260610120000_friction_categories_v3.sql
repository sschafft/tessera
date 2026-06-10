-- Friction reflection v3 — five independent category sliders.
--
-- The 2026-05-04 forced-choice attribution slider (self / partner /
-- system) was useful for the GM debrief but the categories rolled too
-- much under one bucket: "the game" included puzzle complexity, brief
-- mismatches, time pressure, AND mid-round GM adjustments. The 2026-
-- 06-10 redesign breaks those out into named categories and drops
-- the forced-choice constraint:
--
--   fric_puzzle             0..100
--   fric_communication      0..100
--   fric_time_pressure      0..100
--   fric_game_adjustments   0..100
--   fric_other              0..100
--   fric_other_text         text (free-form, only meaningful when
--                                 fric_other > 0)
--
-- Each slider is independent (no sum-to-100 constraint). A player
-- can rate every axis high, every axis low, or anywhere in between
-- — the relative magnitudes ARE the signal. The "anonymised
-- share-back" GameEndedView card is removed in the same pass, so
-- there's no aggregator to keep happy; the data is stored for
-- post-hoc analysis only.
--
-- The legacy columns (comm_balance, attr_self/partner/system) are
-- dropped forward-only — v2 aggregator code is gone, and these
-- columns would otherwise loom as a confusing "what does this still
-- mean?" residue at the schema level.

alter table round_surveys
  drop column if exists comm_balance,
  drop column if exists attr_self,
  drop column if exists attr_partner,
  drop column if exists attr_system,
  drop constraint if exists round_surveys_attr_bounds_chk;

alter table round_surveys
  add column if not exists fric_puzzle int,
  add column if not exists fric_communication int,
  add column if not exists fric_time_pressure int,
  add column if not exists fric_game_adjustments int,
  add column if not exists fric_other int,
  add column if not exists fric_other_text text;

-- Per-column 0..100 bound. Each axis is independent so we don't add
-- a sum constraint. NULL is allowed for forward-compatibility with
-- backfilled rows from before this migration ran.
alter table round_surveys
  add constraint round_surveys_fric_bounds_chk
  check (
    (fric_puzzle is null or fric_puzzle between 0 and 100)
    and (fric_communication is null or fric_communication between 0 and 100)
    and (fric_time_pressure is null or fric_time_pressure between 0 and 100)
    and (fric_game_adjustments is null or fric_game_adjustments between 0 and 100)
    and (fric_other is null or fric_other between 0 and 100)
    and (fric_other_text is null or length(fric_other_text) <= 280)
  );
