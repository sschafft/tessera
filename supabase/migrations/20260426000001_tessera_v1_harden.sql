-- Address the two security advisor warnings from the v1 schema:
-- 1. Pin search_path on bump_game_interaction.
-- 2. Revoke anon access (we don't use the public GraphQL endpoint; all
--    client traffic flows through our route handlers with the service role,
--    or through Realtime which we'll grant explicit privileges to in
--    milestone 4).

create or replace function public.bump_game_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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
    select r.game_id into gid from public.rounds r where r.id = new.round_id;
  elsif tg_table_name = 'placements' then
    select r.game_id into gid from public.pair_rounds pr
      join public.rounds r on r.id = pr.round_id
      where pr.id = new.pair_round_id;
  elsif tg_table_name = 'briefs' then
    select r.game_id into gid from public.pair_rounds pr
      join public.rounds r on r.id = pr.round_id
      where pr.id = new.pair_round_id;
  elsif tg_table_name = 'accelerant_events' then
    select r.game_id into gid from public.rounds r where r.id = new.round_id;
  end if;

  if gid is not null and (tg_op <> 'INSERT' or tg_table_name <> 'games') then
    update public.games set last_interaction_at = now() where id = gid;
  end if;
  return new;
end;
$$;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke usage on schema public from anon;
revoke usage on schema public from authenticated;

grant usage on schema public to authenticated;
