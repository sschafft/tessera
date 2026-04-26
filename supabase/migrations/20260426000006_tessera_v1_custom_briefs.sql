-- Free-text brief authoring (TDD locked decision #14): GMs can write
-- their own briefs at game create. Stored as { title, rules } per role.
alter table games
  add column builder_brief_custom jsonb,
  add column guider_brief_custom jsonb;
