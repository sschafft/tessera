-- Rename `accelerant_events` table → `super_power_events` and the
-- companion enums `accelerant_t` / `accelerant_scope_t` →
-- `super_power_kind` / `super_power_scope`.
--
-- The user-visible product has been called 'super powers' since
-- v1.1; the database still carried the original 'accelerant'
-- terminology, which compounded as cognitive cost on every grep
-- (half the codebase says one word, half the other).
--
-- Postgres lets us:
--   - `ALTER TABLE … RENAME TO` (cheap; rewrites pg_catalog only)
--   - `ALTER TYPE … RENAME TO` (cheap; same)
--   - `ALTER TYPE … RENAME VALUE` to also fix `vocab_swap` →
--     `change_guider_brief`, which has been the user-visible label
--     for the action since v1.1.
--
-- Triggers / RLS / foreign keys follow the table automatically.
-- This migration is a pure rename — no data movement.

alter table accelerant_events rename to super_power_events;
alter type accelerant_t rename to super_power_kind;
alter type accelerant_scope_t rename to super_power_scope;
alter type super_power_kind rename value 'vocab_swap' to 'change_guider_brief';

-- Update trigger names that mention the old word so future readers
-- aren't searching twice.
alter trigger bump_after_accelerants on super_power_events
  rename to bump_after_super_powers;
