-- RPCs for atomic pair operations. We can't do multi-row updates +
-- inserts in a single PostgREST call, so these wrap them in a single
-- DB transaction.

create or replace function public.create_pair_with_roles(
  p_game_id uuid,
  p_builder_id uuid,
  p_guider_id uuid
)
returns public.pairs
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_pair public.pairs;
  builder_game uuid;
  guider_game uuid;
begin
  select game_id into builder_game from public.participants where id = p_builder_id;
  select game_id into guider_game from public.participants where id = p_guider_id;
  if builder_game is null or builder_game <> p_game_id then
    raise exception 'builder_not_in_game';
  end if;
  if guider_game is null or guider_game <> p_game_id then
    raise exception 'guider_not_in_game';
  end if;

  insert into public.pairs (game_id, builder_id, guider_id)
    values (p_game_id, p_builder_id, p_guider_id)
    returning * into new_pair;

  update public.participants
    set role = 'builder', pair_id = new_pair.id
    where id = p_builder_id;
  update public.participants
    set role = 'guider', pair_id = new_pair.id
    where id = p_guider_id;

  return new_pair;
end;
$$;

create or replace function public.clear_allocations(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.participants
    set role = 'lobby', pair_id = null
    where game_id = p_game_id and role <> 'gm';
  delete from public.pairs where game_id = p_game_id;
end;
$$;

revoke all on function public.create_pair_with_roles(uuid, uuid, uuid)
  from anon, authenticated;
revoke all on function public.clear_allocations(uuid)
  from anon, authenticated;
