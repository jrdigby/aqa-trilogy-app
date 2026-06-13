-- Onboarding: profiles extensions, classes, RLS, join_class_by_code + seed_initial_srs

-- ---------------------------------------------------------------------------
-- profiles extensions
-- ---------------------------------------------------------------------------
alter table profiles
  add column if not exists role text not null default 'student';

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles
  add constraint profiles_role_check
  check (role in ('student', 'teacher', 'developer'));

alter table profiles
  add column if not exists subscription_tier text not null default 'free';

alter table profiles drop constraint if exists profiles_subscription_tier_check;
alter table profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in ('free', 'paid'));

alter table profiles
  add column if not exists onboarding_completed_at timestamptz;

alter table profiles
  add column if not exists subject_preference jsonb;

alter table profiles
  add column if not exists subject_difficulty jsonb;

-- class_id added after classes table exists

-- Ensure new signups get a profile row with defaults
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, preferred_tier, subscription_tier, role)
  values (new.id, 'FT', 'free', 'student')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------------
create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(user_id) on delete cascade,
  name text not null,
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists classes_teacher_id_idx on classes(teacher_id);
create index if not exists classes_join_code_idx on classes(join_code);

alter table profiles
  add column if not exists class_id uuid references classes(id) on delete set null;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create or replace function public.generate_join_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
  attempts int := 0;
begin
  loop
    result := '';
    for i in 1..6 loop
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from classes where join_code = result);
    attempts := attempts + 1;
    if attempts > 50 then
      raise exception 'Could not generate unique join code';
    end if;
  end loop;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_class_by_code
-- ---------------------------------------------------------------------------
create or replace function public.join_class_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_class classes%rowtype;
  v_normalized text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_normalized := upper(trim(p_code));
  if length(v_normalized) < 4 then
    raise exception 'Invalid class code';
  end if;

  select * into v_class
  from classes
  where join_code = v_normalized;

  if not found then
    raise exception 'Invalid class code';
  end if;

  update profiles
  set class_id = v_class.id
  where user_id = v_uid;

  return jsonb_build_object(
    'class_id', v_class.id,
    'class_name', v_class.name
  );
end;
$$;

grant execute on function public.join_class_by_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- seed_initial_srs (idempotent; uses profile rankings)
-- ---------------------------------------------------------------------------
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
grant execute on function public.generate_join_code() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table classes enable row level security;

drop policy if exists classes_teacher_select on classes;
create policy classes_teacher_select on classes
  for select to authenticated
  using (teacher_id = auth.uid());

drop policy if exists classes_teacher_insert on classes;
create policy classes_teacher_insert on classes
  for insert to authenticated
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.role = 'teacher'
    )
  );

drop policy if exists classes_teacher_update on classes;
create policy classes_teacher_update on classes
  for update to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

drop policy if exists classes_teacher_delete on classes;
create policy classes_teacher_delete on classes
  for delete to authenticated
  using (teacher_id = auth.uid());

-- Profile RLS: own row + teachers read students in their classes
alter table profiles enable row level security;

drop policy if exists profiles_select_own on profiles;
create policy profiles_select_own on profiles
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists profiles_insert_own on profiles;
create policy profiles_insert_own on profiles
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists profiles_teacher_read_students on profiles;
create policy profiles_teacher_read_students on profiles
  for select to authenticated
  using (
    class_id is not null
    and exists (
      select 1 from classes c
      where c.id = profiles.class_id
        and c.teacher_id = auth.uid()
    )
  );

-- Teachers read SRS + attempts for students in their classes (summary stats)
-- Assumes RLS is already enabled on these tables for student self-access.
drop policy if exists srs_state_teacher_read on srs_state;
create policy srs_state_teacher_read on srs_state
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from profiles p
      join classes c on c.id = p.class_id
      where p.user_id = srs_state.user_id
        and c.teacher_id = auth.uid()
    )
  );

drop policy if exists attempts_teacher_read on attempts;
create policy attempts_teacher_read on attempts
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from profiles p
      join classes c on c.id = p.class_id
      where p.user_id = attempts.user_id
        and c.teacher_id = auth.uid()
    )
  );
