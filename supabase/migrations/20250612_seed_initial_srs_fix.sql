-- Fix seed_initial_srs RPC (400 errors). Re-run if onboarding finish fails on seed_initial_srs.
-- Also grants execute to authenticated.

create or replace function public.seed_initial_srs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile profiles%rowtype;
  v_existing int;
  v_tier text;
  v_tiers text[];
  v_subjects text[] := array['biology', 'chemistry', 'physics'];
  v_subject text;
  v_rank int;
  v_diff text;
  v_count int;
  v_total int := 0;
  v_sp record;
  v_today date := current_date;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select count(*) into v_existing from srs_state where user_id = v_uid;
  if v_existing > 0 then
    return jsonb_build_object('seeded', 0, 'reason', 'already_has_srs');
  end if;

  select * into v_profile from profiles where user_id = v_uid;
  if not found then
    raise exception 'Profile not found';
  end if;

  v_tier := coalesce(v_profile.preferred_tier, 'FT');
  if v_tier = 'foundation' then v_tier := 'FT'; end if;
  if v_tier = 'higher' then v_tier := 'HT'; end if;
  v_tiers := case when v_tier = 'HT' then array['HT', 'both'] else array['FT', 'both'] end;

  for v_rank in 1..3 loop
    foreach v_subject in array v_subjects loop
      if coalesce((v_profile.subject_preference ->> v_subject)::int, 99) <> v_rank then
        continue;
      end if;

      v_diff := coalesce(v_profile.subject_difficulty ->> v_subject, 'medium');
      v_count := case v_diff
        when 'hardest' then 2
        when 'easiest' then 1
        else 1
      end;

      for v_sp in
        select sp.id
        from spec_points sp
        where sp.subject = v_subject
          and exists (
            select 1 from questions q
            where q.spec_point_id = sp.id
              and q.tier = any(v_tiers)
          )
          and not exists (
            select 1 from srs_state s
            where s.user_id = v_uid and s.spec_point_id = sp.id
          )
        order by case sp.paper when 'paper1' then 0 when 'paper2' then 1 else 2 end,
          sp.topic_number asc nulls last, sp.spec_ref asc
        limit v_count
      loop
        insert into srs_state (
          user_id, spec_point_id, due_date, interval_days,
          ease_factor, repetitions, lapses, last_quality
        ) values (
          v_uid, v_sp.id, v_today, 1, 2.5, 0, 0, 0
        );
        v_total := v_total + 1;
      end loop;
    end loop;
  end loop;

  return jsonb_build_object('seeded', v_total);
end;
$$;

grant execute on function public.seed_initial_srs() to authenticated;

-- Ensure users can insert own srs_state rows (client fallback)
drop policy if exists srs_state_insert_own on srs_state;
create policy srs_state_insert_own on srs_state
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists srs_state_select_own on srs_state;
create policy srs_state_select_own on srs_state
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists srs_state_update_own on srs_state;
create policy srs_state_update_own on srs_state
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
