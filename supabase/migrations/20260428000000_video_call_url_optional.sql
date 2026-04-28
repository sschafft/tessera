-- Drop the NOT NULL constraint on games.video_call_url. Workshops that
-- coordinate the call link out-of-band (Slack DM, calendar invite,
-- already on the call) shouldn't be forced to paste a URL into the
-- host form. Existing rows are unaffected.
alter table games alter column video_call_url drop not null;
