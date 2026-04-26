-- Tessera v1 schema. See design/TDD.md §6 for the model + §13 for the
-- guard tables (gemini_budget, rate_limits).

-- ─── Enums ─────────────────────────────────────────────────────────────
create type role_t          as enum ('gm','builder','guider','observer','lobby');
create type game_status_t   as enum ('lobby','running','ended','purged');
create type round_status_t  as enum ('pending','running','ended');
create type brief_source_t  as enum ('gm','library','gemini');
create type team_mode_t     as enum ('gm_picks','players_pick');
create type accelerant_t    as enum (
  'prototype','reveal_briefs','test_build','agile_share',
  'time_pressure','vocab_swap','randomizer','requirement_change'
);
create type accelerant_scope_t as enum ('pair','all');

-- ─── Games ─────────────────────────────────────────────────────────────
create table games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  workshop_name text not null,
  video_call_url text not null,
  whiteboard_url text,
  team_mode team_mode_t not null,
  default_complexity int not null check (default_complexity between 1 and 8),
  builder_brief_on bool not null default true,
  guider_brief_on bool not null default true,
  builder_brief_source brief_source_t not null default 'library',
  guider_brief_source brief_source_t not null default 'library',
  round_count int not null check (round_count between 1 and 5),
  round_duration_seconds int not null default 900,
  participant_cap int not null check (participant_cap between 3 and 50),
  sound_on bool not null default true,
  status game_status_t not null default 'lobby',
  created_at timestamptz not null default now(),
  last_interaction_at timestamptz not null default now(),
  ended_at timestamptz,
  host_token_hash text not null,
  gm_participant_id uuid not null,
  gemini_calls_used int not null default 0
);

create index games_purge_idx on games(last_interaction_at)
  where status <> 'purged';

-- ─── Participants & Pairs (resolve circular FK after creation) ─────────
create table participants (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  display_name text not null,
  role role_t not null default 'lobby',
  pair_id uuid,
  color text not null,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  released_at timestamptz
);

create unique index participants_unique_name on participants(game_id, lower(display_name))
  where released_at is null;

create table pairs (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  builder_id uuid references participants(id) on delete set null,
  guider_id uuid references participants(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table participants
  add constraint participants_pair_id_fkey
  foreign key (pair_id) references pairs(id) on delete set null;

-- ─── Rounds ────────────────────────────────────────────────────────────
create table rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  index int not null,
  complexity int not null check (complexity between 1 and 8),
  duration_seconds int not null,
  status round_status_t not null default 'pending',
  started_at timestamptz,
  ended_at timestamptz,
  unique(game_id, index)
);

create table pair_rounds (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  pair_id uuid not null references pairs(id) on delete cascade,
  goal_pattern jsonb not null,
  pattern_seed text not null,
  test_enabled bool not null default false,
  shares_remaining int not null default 3,
  unique(round_id, pair_id)
);

-- ─── Placements ────────────────────────────────────────────────────────
create table placements (
  id uuid primary key default gen_random_uuid(),
  pair_round_id uuid not null references pair_rounds(id) on delete cascade,
  shape text not null,
  color text not null,
  q int not null,
  r int not null,
  rot smallint not null check (rot in (0,1,2,3,4,5)),
  placed_by uuid not null references participants(id) on delete cascade,
  placed_at timestamptz not null default now()
);

create unique index placements_one_per_cell on placements(pair_round_id, q, r);

-- ─── Briefs ────────────────────────────────────────────────────────────
create table briefs (
  id uuid primary key default gen_random_uuid(),
  pair_round_id uuid not null references pair_rounds(id) on delete cascade,
  role role_t not null check (role in ('builder','guider')),
  source brief_source_t not null,
  title text not null,
  rules jsonb not null,
  revealed bool not null default false,
  created_at timestamptz not null default now(),
  unique(pair_round_id, role)
);

-- ─── Accelerant log ────────────────────────────────────────────────────
create table accelerant_events (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  scope accelerant_scope_t not null,
  pair_id uuid references pairs(id) on delete cascade,
  kind accelerant_t not null,
  payload jsonb not null default '{}',
  triggered_by uuid not null references participants(id) on delete cascade,
  triggered_at timestamptz not null default now()
);

-- ─── Brief library (seeded; see seed_brief_library migration) ──────────
create table briefs_library (
  id uuid primary key default gen_random_uuid(),
  role role_t not null check (role in ('builder','guider')),
  complexity_min int not null check (complexity_min between 1 and 8),
  complexity_max int not null check (complexity_max between 1 and 8),
  title text not null,
  rules jsonb not null
);

-- ─── Free-tier guardrails (TDD §13) ────────────────────────────────────
create table gemini_budget (
  day date primary key,
  calls_used int not null default 0
);

create table rate_limits (
  key text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);

-- ─── last_interaction_at trigger on every game-scoped write ────────────
-- (final version with pinned search_path applied in 20260426000001_harden.sql)
create or replace function bump_game_interaction()
returns trigger language plpgsql as $$
declare
  gid uuid;
begin
  if tg_table_name = 'games' then
    gid := new.id;
  elsif tg_table_name = 'participants' then
    gid := new.game_id;
  elsif tg_table_name = 'pairs' then
    gid := new.game_id;
  elsif tg_table_name = 'rounds' then
    gid := new.game_id;
  elsif tg_table_name = 'pair_rounds' then
    select r.game_id into gid from rounds r where r.id = new.round_id;
  elsif tg_table_name = 'placements' then
    select r.game_id into gid from pair_rounds pr
      join rounds r on r.id = pr.round_id
      where pr.id = new.pair_round_id;
  elsif tg_table_name = 'briefs' then
    select r.game_id into gid from pair_rounds pr
      join rounds r on r.id = pr.round_id
      where pr.id = new.pair_round_id;
  elsif tg_table_name = 'accelerant_events' then
    select r.game_id into gid from rounds r where r.id = new.round_id;
  end if;

  if gid is not null and (tg_op <> 'INSERT' or tg_table_name <> 'games') then
    update games set last_interaction_at = now() where id = gid;
  end if;
  return new;
end;
$$;

create trigger bump_after_participants
  after insert or update on participants
  for each row execute function bump_game_interaction();
create trigger bump_after_pairs
  after insert or update on pairs
  for each row execute function bump_game_interaction();
create trigger bump_after_rounds
  after insert or update on rounds
  for each row execute function bump_game_interaction();
create trigger bump_after_pair_rounds
  after insert or update on pair_rounds
  for each row execute function bump_game_interaction();
create trigger bump_after_placements
  after insert or update on placements
  for each row execute function bump_game_interaction();
create trigger bump_after_briefs
  after insert or update on briefs
  for each row execute function bump_game_interaction();
create trigger bump_after_accelerants
  after insert or update on accelerant_events
  for each row execute function bump_game_interaction();

-- ─── RLS: deny-by-default everywhere ───────────────────────────────────
-- Service role bypasses RLS automatically. Anon clients can do nothing
-- until we add narrow read policies in milestone 4 for Realtime.
alter table games enable row level security;
alter table participants enable row level security;
alter table pairs enable row level security;
alter table rounds enable row level security;
alter table pair_rounds enable row level security;
alter table placements enable row level security;
alter table briefs enable row level security;
alter table accelerant_events enable row level security;
alter table briefs_library enable row level security;
alter table gemini_budget enable row level security;
alter table rate_limits enable row level security;
