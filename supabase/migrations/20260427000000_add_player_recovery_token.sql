-- 2026-04-27: Player recovery tokens.
--
-- Mirrors the host recovery flow: when a participant joins a game, the
-- server mints a one-shot recovery token, returns it once in the join
-- response (which the UI surfaces as a "save this URL" affordance),
-- and stores the bcrypt hash on the row. /api/games/[code]/recover
-- exchanges {participant_id, token} for a fresh session cookie.
--
-- Nullable so existing rows + the GM seat (which uses host_token_hash
-- on games) stay valid without backfill.

alter table participants
  add column recovery_token_hash text;

comment on column participants.recovery_token_hash is
  'bcrypt hash of the participant''s one-shot recovery token. Set at create time, verified by /api/games/[code]/recover. Plain token is shown once in the join response and never persisted.';
