-- Breakouts: per-pair Google Meet links generated via Calendar API.
-- The GM signs in with Google once per game; tokens are stored
-- encrypted on the server and used to mint a calendar event (with
-- conferenceData.createRequest) per pair. The Meet URL attached to
-- the event becomes the pair's breakout-call URL.

-- Game-level toggle. Hidden in the host form unless the
-- GOOGLE_OAUTH_CLIENT_ID env var is set on the deployment.
alter table games
  add column breakouts_enabled bool not null default false;

-- Per-pair breakout state. event_id is stored so the end-game cleanup
-- knows which calendar events to delete.
alter table pairs
  add column breakout_call_url text,
  add column breakout_event_id text;

-- GM Google OAuth tokens, one row per game. Tokens are encrypted at
-- rest with a key derived from TESSERA_JWT_SECRET via HKDF. The row
-- is removed on game cascade-delete, which also fires the
-- post-deletion calendar cleanup if any breakout events still exist
-- (handled in the end-game route, not here).
create table gm_google_tokens (
  game_id uuid primary key references games(id) on delete cascade,
  -- Encrypted access + refresh tokens (base64 of iv:authtag:ciphertext).
  access_token_enc text not null,
  refresh_token_enc text,
  -- When the access token expires. Refresh fires when within 60s.
  expires_at timestamptz not null,
  -- Granted scope string from Google (space-separated). Verifies the
  -- token actually has calendar.events before the route handler tries
  -- to use it.
  scope text not null,
  created_at timestamptz not null default now(),
  refreshed_at timestamptz
);

-- Service-role only (matches the rest of the schema's defence-in-depth
-- posture).
revoke all on gm_google_tokens from anon, authenticated;
