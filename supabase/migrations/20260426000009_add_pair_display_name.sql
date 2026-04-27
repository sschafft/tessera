-- v1.1: Pair self-naming (PRD §6.10).
--
-- Pairs can pick a name ("The Pelicans"); falls back to
-- "<builder> ↔ <guider>" until set. Editable from BuilderView +
-- GuiderView via PATCH /api/games/[code]/pairs/[pair_id]/name.

alter table pairs
  add column if not exists display_name text;

comment on column pairs.display_name is
  'Pair-chosen display name. NULL until the pair sets it; surfaced on the leaderboard + observer pair-switcher. 40-char cap enforced server-side.';
