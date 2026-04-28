-- Add meeting mode + breakout provider to support the new game-create
-- flow:
--
--   In-person workshops skip the video-call / whiteboard / breakouts
--     surface entirely (everyone's in the same room).
--   Remote workshops can optionally turn on automated per-pair
--     breakout calls. Two providers ship:
--       - 'google_meet': mints a Calendar event per pair via the
--         existing arctic-based OAuth flow. Adds participant emails
--         as event attendees so they bypass Meet's knock screen.
--       - 'jitsi': constructs a deterministic meet.jit.si URL per
--         pair. No OAuth, no API call, no calendar pollution.
--
-- The legacy `breakouts_enabled` boolean stays on the row but is now
-- redundant with `breakout_provider != 'none'`. Code paths reference
-- `breakout_provider` going forward.
--
-- `participants.email` is collected at join time only when the game
-- has `breakout_provider = 'google_meet'` (so we can include the
-- email as a calendar event attendee). Optional in the schema —
-- the join route enforces presence based on the live game's provider.

alter table games
  add column meeting_mode text not null default 'remote'
    check (meeting_mode in ('in_person', 'remote')),
  add column breakout_provider text not null default 'none'
    check (breakout_provider in ('none', 'google_meet', 'jitsi'));

alter table participants
  add column email text;
