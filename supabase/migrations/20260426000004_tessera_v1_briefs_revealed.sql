-- Reveal-briefs accelerant: when triggered, both players in the pair
-- can see each other's brief for the rest of the round.
alter table pair_rounds
  add column briefs_revealed boolean not null default false;
