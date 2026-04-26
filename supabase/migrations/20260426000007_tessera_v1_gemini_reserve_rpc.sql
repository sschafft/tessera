-- Atomic check-and-increment for the Gemini budget. Two caps:
--   per-game (games.gemini_calls_used)
--   per-day  (gemini_budget.calls_used for today)
-- Returns { reserved: bool, reason: text, per_game: int, per_day: int }.

create or replace function public.reserve_gemini_call(
  p_game_id uuid,
  p_per_game_max int,
  p_per_day_max int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  used_per_game int;
  used_per_day  int;
  today date := current_date;
begin
  select gemini_calls_used into used_per_game
    from public.games where id = p_game_id
    for update;
  if used_per_game is null then
    return jsonb_build_object('reserved', false, 'reason', 'per_game_cap');
  end if;
  if used_per_game >= p_per_game_max then
    return jsonb_build_object('reserved', false, 'reason', 'per_game_cap');
  end if;

  insert into public.gemini_budget (day, calls_used)
    values (today, 0)
    on conflict (day) do nothing;

  select calls_used into used_per_day
    from public.gemini_budget where day = today
    for update;
  if used_per_day >= p_per_day_max then
    return jsonb_build_object('reserved', false, 'reason', 'per_day_cap');
  end if;

  update public.games set gemini_calls_used = used_per_game + 1
    where id = p_game_id;
  update public.gemini_budget set calls_used = used_per_day + 1
    where day = today;

  return jsonb_build_object(
    'reserved', true,
    'per_game', used_per_game + 1,
    'per_day', used_per_day + 1
  );
end;
$$;

revoke all on function public.reserve_gemini_call(uuid, int, int)
  from anon, authenticated;
