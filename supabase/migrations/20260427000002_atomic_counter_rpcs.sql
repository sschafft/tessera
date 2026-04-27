-- Atomic counter RPCs for shares_remaining + round duration.
--
-- Both endpoints used to do read-then-write in JS, which is racy at
-- the documented free-tier scale: two concurrent /agile-share POSTs
-- (multi-tab builder, broadcast retry) each read shares_remaining=3
-- and each write 2, so the snapshot was captured twice but the
-- counter only dropped by 1. Same shape on /accelerants
-- time_pressure firing twice in a row before the first UPDATE lands.
--
-- Mirrors the existing reserve_gemini_call pattern (see
-- 20260426000007_tessera_v1_gemini_reserve_rpc.sql): SECURITY DEFINER
-- + FOR UPDATE row lock on the canonical row, returns jsonb so the
-- repository can read both the new counter value and the gate result
-- ("did this attempt actually decrement, or was the bucket already
-- empty?").

create or replace function public.capture_builder_snapshot(
  p_pair_round_id uuid,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur int;
begin
  select shares_remaining into cur
    from public.pair_rounds where id = p_pair_round_id
    for update;
  if cur is null then
    return jsonb_build_object('captured', false, 'reason', 'pair_round_not_found');
  end if;
  if cur <= 0 then
    return jsonb_build_object('captured', false, 'reason', 'no_shares_remaining', 'shares_remaining', 0);
  end if;
  update public.pair_rounds
    set builder_snapshot = p_snapshot,
        shares_remaining = cur - 1
    where id = p_pair_round_id;
  return jsonb_build_object(
    'captured', true,
    'shares_remaining', cur - 1
  );
end;
$$;

revoke all on function public.capture_builder_snapshot(uuid, jsonb)
  from anon, authenticated;

-- Decrement (or extend) the round's effective remaining time without
-- racing the wall clock. Computes elapsed at the row-locked moment so
-- two concurrent triggers can't each observe the same "remaining"
-- and double-spend it.
--
-- p_delta_seconds may be negative (extension) or positive (Time
-- Pressure subtracts time). Floors at 30 seconds remaining so a
-- spammed Time Pressure can't drop the round below the safety floor.

create or replace function public.adjust_round_duration(
  p_round_id uuid,
  p_delta_seconds int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  started timestamptz;
  dur int;
  elapsed int;
  remaining int;
  new_remaining int;
  new_duration int;
begin
  select started_at, duration_seconds into started, dur
    from public.rounds where id = p_round_id
    for update;
  if dur is null then
    return jsonb_build_object('ok', false, 'reason', 'round_not_found');
  end if;
  elapsed := greatest(
    0,
    floor(extract(epoch from (now() - coalesce(started, now()))))::int
  );
  remaining := dur - elapsed;
  new_remaining := greatest(30, remaining - p_delta_seconds);
  new_duration := elapsed + new_remaining;
  update public.rounds set duration_seconds = new_duration
    where id = p_round_id;
  return jsonb_build_object(
    'ok', true,
    'duration_seconds', new_duration,
    'remaining_seconds', new_remaining
  );
end;
$$;

revoke all on function public.adjust_round_duration(uuid, int)
  from anon, authenticated;
