-- v1.1: Three new super-power kinds.
--
-- Postgres enum additions are NOT transactional unless inside a
-- single migration — Postgres requires the new value to be committed
-- before it can be used. We use `ADD VALUE IF NOT EXISTS` so a
-- re-run against a live DB that already has these is a no-op.
--
-- - `change_builder_brief` (PRD §6.3): builder-side mirror of the
--   guider-side `vocab_swap`. Both unlimited per round.
-- - `harder` / `easier` (PRD §6.3): re-roll the goal at complexity ±1
--   while pinning the round's grid envelope.
--
-- `vocab_swap` is retained as the historic guider-side equivalent
-- (renamed in the UI to "Change guider brief" but the enum value
-- stays for backwards compatibility with stored events).

alter type accelerant_t add value if not exists 'change_builder_brief';
alter type accelerant_t add value if not exists 'harder';
alter type accelerant_t add value if not exists 'easier';
