-- Drop the vestigial games.breakouts_enabled column. Was added in
-- migration 16 (`breakouts_and_google_tokens`) but was always read +
-- written without ever gating any code path. The canonical check is
-- `games.breakout_provider != 'none'`, introduced in migration 18.
--
-- Tech-review 2026-04-29 confirmed zero callers of `setBreakoutsEnabled`
-- across the codebase and no read-side consumers downstream.

alter table games drop column if exists breakouts_enabled;
