-- End-of-round 2-question reflection survey. Each participant
-- answers per round; per-round responses are unique by participant.
--
-- Question 1 (comm_balance, 0..100):
--   Slider asking who carried the communication. 0 = "I did most of
--   it", 100 = "my partner did most of it", 50 = "we shared evenly".
--
-- Question 2 (what_made_harder, 4-way enum):
--   What made the round hard. me / partner / briefs / puzzle.
--
-- Both questions are required (the modal won't submit without an
-- answer to each). On_delete cascade on round + participant so the
-- 7-day game purge sweeps the survey rows automatically.

create table if not exists round_surveys (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  comm_balance int not null check (comm_balance between 0 and 100),
  what_made_harder text not null check (
    what_made_harder in ('me', 'partner', 'briefs', 'puzzle')
  ),
  submitted_at timestamptz not null default now(),
  unique (round_id, participant_id)
);

create index if not exists round_surveys_round_idx
  on round_surveys (round_id);

-- RLS: locked down. Routes use the service role; client writes go
-- through the API.
alter table round_surveys enable row level security;
