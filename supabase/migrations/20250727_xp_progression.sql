-- XP progression rewards: milestones, streak freeze tokens, country discoveries

alter table profiles add column if not exists xp_rewards jsonb not null default '{
  "streak_freeze_tokens": 0,
  "milestones_claimed": [],
  "last_level_seen": 1,
  "countries_discovered": [],
  "lap_count": 0,
  "current_location_id": "london",
  "visited": ["london"],
  "path": ["london"],
  "distance_travelled": 0,
  "pending_destination_id": null,
  "km_toward_pending": 0
}'::jsonb;

create or replace function public.claim_xp_milestone(p_milestone_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rewards jsonb;
  v_claimed jsonb;
  v_tokens integer;
begin
  if auth.uid() is null or p_milestone_id is null or length(trim(p_milestone_id)) = 0 then
    return '{"claimed": false}'::jsonb;
  end if;

  select xp_rewards into v_rewards
  from profiles
  where user_id = auth.uid()
  for update;

  if v_rewards is null then
    v_rewards := '{
      "streak_freeze_tokens": 0,
      "milestones_claimed": [],
      "last_level_seen": 1,
      "countries_discovered": [],
      "lap_count": 0
    }'::jsonb;
  end if;

  v_claimed := coalesce(v_rewards->'milestones_claimed', '[]'::jsonb);
  if v_claimed @> to_jsonb(p_milestone_id) then
    return jsonb_build_object('claimed', false, 'xp_rewards', v_rewards);
  end if;

  v_claimed := v_claimed || to_jsonb(p_milestone_id);
  v_rewards := jsonb_set(v_rewards, '{milestones_claimed}', v_claimed);
  v_tokens := coalesce((v_rewards->>'streak_freeze_tokens')::integer, 0);

  if p_milestone_id in ('500_xp', '2500_xp', '10000_xp') then
    v_tokens := least(2, v_tokens + 1);
    v_rewards := jsonb_set(v_rewards, '{streak_freeze_tokens}', to_jsonb(v_tokens));
  elsif p_milestone_id like 'full_lap_%' then
    v_rewards := jsonb_set(
      v_rewards,
      '{lap_count}',
      to_jsonb(coalesce((v_rewards->>'lap_count')::integer, 0) + 1)
    );
  end if;

  update profiles
  set xp_rewards = v_rewards
  where user_id = auth.uid();

  return jsonb_build_object('claimed', true, 'xp_rewards', v_rewards);
end;
$$;

create or replace function public.consume_streak_freeze()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rewards jsonb;
  v_tokens integer;
begin
  if auth.uid() is null then
    return '{"consumed": false}'::jsonb;
  end if;

  select xp_rewards into v_rewards
  from profiles
  where user_id = auth.uid()
  for update;

  v_tokens := coalesce((v_rewards->>'streak_freeze_tokens')::integer, 0);
  if v_tokens < 1 then
    return jsonb_build_object('consumed', false, 'xp_rewards', v_rewards);
  end if;

  v_rewards := jsonb_set(
    v_rewards,
    '{streak_freeze_tokens}',
    to_jsonb(v_tokens - 1)
  );

  update profiles
  set xp_rewards = v_rewards
  where user_id = auth.uid();

  return jsonb_build_object('consumed', true, 'xp_rewards', v_rewards);
end;
$$;

create or replace function public.discover_country(p_country text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rewards jsonb;
  v_countries jsonb;
begin
  if auth.uid() is null or p_country is null or length(trim(p_country)) = 0 then
    return '{"discovered": false}'::jsonb;
  end if;

  select xp_rewards into v_rewards
  from profiles
  where user_id = auth.uid()
  for update;

  if v_rewards is null then
    v_rewards := '{
      "streak_freeze_tokens": 0,
      "milestones_claimed": [],
      "last_level_seen": 1,
      "countries_discovered": [],
      "lap_count": 0
    }'::jsonb;
  end if;

  v_countries := coalesce(v_rewards->'countries_discovered', '[]'::jsonb);
  if v_countries @> to_jsonb(p_country) then
    return jsonb_build_object('discovered', false, 'xp_rewards', v_rewards);
  end if;

  v_countries := v_countries || to_jsonb(p_country);
  v_rewards := jsonb_set(v_rewards, '{countries_discovered}', v_countries);

  update profiles
  set xp_rewards = v_rewards
  where user_id = auth.uid();

  return jsonb_build_object('discovered', true, 'xp_rewards', v_rewards);
end;
$$;

grant execute on function public.claim_xp_milestone(text) to authenticated;
grant execute on function public.consume_streak_freeze() to authenticated;
grant execute on function public.discover_country(text) to authenticated;
