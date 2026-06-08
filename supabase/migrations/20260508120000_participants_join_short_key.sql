-- Short, URL-safe per-participant key used in the CSV-issued recovery
-- URL in place of the 36-char UUID participant_id. Lets the upload
-- route produce links like
--   /recover/LEY-GW4?p=Ab3kQ9zP#<token>
-- instead of
--   /recover/LEY-GW4?p=60539efd-3cc2-4ceb-86a5-7f4624372833#<token>
-- saving ~28 chars per link, which matters when the GM is pasting
-- one per row into a calendar invite or email.
--
-- Nullable on purpose: only the CSV upload route mints a key (where
-- the link must be short and copy-pastable). Players who join via the
-- regular /join flow get an in-session cookie and never see a recovery
-- URL, so their row keeps join_short_key NULL.
--
-- The recover API checks if `participant_id` looks like a UUID and
-- falls back to a join_short_key lookup when it doesn't. Both code
-- paths read the same row.

alter table participants
  add column if not exists join_short_key text;

create unique index if not exists participants_join_short_key_uq
  on participants (join_short_key)
  where join_short_key is not null;
