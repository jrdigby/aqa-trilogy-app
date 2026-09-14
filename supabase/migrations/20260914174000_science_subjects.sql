-- Triple Science students may take one, two, or all three separate sciences.
-- Combined Science ignores this column and always uses all three.
-- Missing/null is treated as all three by the app; stored rows are backfilled.

alter table public.profiles
  add column if not exists science_subjects jsonb;

update public.profiles
set science_subjects = '["biology","chemistry","physics"]'::jsonb
where science_subjects is null;

alter table public.profiles
  alter column science_subjects set default '["biology","chemistry","physics"]'::jsonb;

alter table public.profiles
  alter column science_subjects set not null;

create or replace function public.science_subjects_valid(p jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(p) = 'array'
    and jsonb_array_length(p) between 1 and 3
    and p <@ '["biology","chemistry","physics"]'::jsonb
    and (
      select count(distinct value) = jsonb_array_length(p)
      from jsonb_array_elements_text(p)
    );
$$;

-- Callers must be able to execute this. The profiles check constraint runs as the
-- updating role; a missing EXECUTE grant surfaces as a 403 on profile PATCH.
grant execute on function public.science_subjects_valid(jsonb) to anon, authenticated;

alter table public.profiles drop constraint if exists profiles_science_subjects_check;
alter table public.profiles
  add constraint profiles_science_subjects_check
  check (public.science_subjects_valid(science_subjects));

-- Seed one starter topic per selected subject (study order). Combined always uses all three.
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
  v_path text;
  v_subjects text[] := array['biology', 'chemistry', 'physics'];
  v_subject text;
  v_rank int;
  v_total int := 0;
  v_sp record;
  v_today date := current_date;
  v_subject_tier text;
  v_tiers text[];
  v_selected text[];
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

  v_path := coalesce(v_profile.science_path, 'combined');

  if v_path = 'triple' and v_profile.science_subjects is not null then
    select coalesce(array_agg(s.subject order by s.ord), array['biology', 'chemistry', 'physics'])
    into v_selected
    from unnest(v_subjects) with ordinality as s(subject, ord)
    where s.subject in (
      select jsonb_array_elements_text(v_profile.science_subjects)
    );
  else
    v_selected := v_subjects;
  end if;

  if v_selected is null or coalesce(array_length(v_selected, 1), 0) = 0 then
    v_selected := v_subjects;
  end if;

  for v_rank in 1..3 loop
    foreach v_subject in array v_selected loop
      if coalesce((v_profile.subject_preference ->> v_subject)::int, 99) <> v_rank then
        continue;
      end if;

      if v_path = 'triple' then
        v_subject_tier := coalesce(v_profile.subject_tiers ->> v_subject, 'FT');
      else
        v_subject_tier := coalesce(v_profile.preferred_tier, 'FT');
      end if;
      v_tiers := tier_array_for_label(v_subject_tier);

      for v_sp in
        select sp.id
        from spec_points sp
        where sp.subject = v_subject
          and sp.course_track = v_path
          and exists (
            select 1 from questions q
            where (
              (q.spec_point_id = sp.id and q.audience in ('both', case when v_path = 'triple' then 'triple_only' else 'both' end))
              or (v_path = 'triple' and q.triple_spec_point_id = sp.id and q.audience = 'both')
            )
              and q.tier = any(v_tiers)
          )
          and not exists (
            select 1 from srs_state s
            where s.user_id = v_uid and s.spec_point_id = sp.id
          )
        order by case sp.paper when 'paper1' then 0 when 'paper2' then 1 else 2 end,
          sp.topic_number asc nulls last, sp.spec_ref asc
        limit 1
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

  -- Selected subjects with no study-order rank still get one starter topic.
  foreach v_subject in array v_selected loop
    if coalesce((v_profile.subject_preference ->> v_subject)::int, 99) between 1 and 3 then
      continue;
    end if;

    if v_path = 'triple' then
      v_subject_tier := coalesce(v_profile.subject_tiers ->> v_subject, 'FT');
    else
      v_subject_tier := coalesce(v_profile.preferred_tier, 'FT');
    end if;
    v_tiers := tier_array_for_label(v_subject_tier);

    for v_sp in
      select sp.id
      from spec_points sp
      where sp.subject = v_subject
        and sp.course_track = v_path
        and exists (
          select 1 from questions q
          where (
            (q.spec_point_id = sp.id and q.audience in ('both', case when v_path = 'triple' then 'triple_only' else 'both' end))
            or (v_path = 'triple' and q.triple_spec_point_id = sp.id and q.audience = 'both')
          )
            and q.tier = any(v_tiers)
        )
        and not exists (
          select 1 from srs_state s
          where s.user_id = v_uid and s.spec_point_id = sp.id
        )
      order by case sp.paper when 'paper1' then 0 when 'paper2' then 1 else 2 end,
        sp.topic_number asc nulls last, sp.spec_ref asc
      limit 1
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

  return jsonb_build_object('seeded', v_total);
end;
$$;
