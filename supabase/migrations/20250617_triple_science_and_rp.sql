-- Triple science support + Required practicals catalog

-- ---------------------------------------------------------------------------
-- profiles: science path + per-subject tiers (triple)
-- ---------------------------------------------------------------------------
alter table profiles
  add column if not exists science_path text not null default 'combined';

alter table profiles drop constraint if exists profiles_science_path_check;
alter table profiles
  add constraint profiles_science_path_check
  check (science_path in ('combined', 'triple'));

alter table profiles
  add column if not exists subject_tiers jsonb;

update profiles set science_path = 'combined' where science_path is null;

-- ---------------------------------------------------------------------------
-- spec_points: combined vs triple syllabus tracks
-- ---------------------------------------------------------------------------
alter table spec_points
  add column if not exists course_track text not null default 'combined';

alter table spec_points drop constraint if exists spec_points_course_track_check;
alter table spec_points
  add constraint spec_points_course_track_check
  check (course_track in ('combined', 'triple'));

update spec_points set course_track = 'combined' where course_track is null;

create unique index if not exists spec_points_track_subject_paper_ref_idx
  on spec_points (course_track, subject, paper, spec_ref);

-- ---------------------------------------------------------------------------
-- spec_point_equivalences (shared nodes between combined and triple)
-- ---------------------------------------------------------------------------
create table if not exists spec_point_equivalences (
  id uuid primary key default gen_random_uuid(),
  combined_spec_point_id uuid not null references spec_points(id) on delete cascade,
  triple_spec_point_id uuid not null references spec_points(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (combined_spec_point_id),
  unique (triple_spec_point_id)
);

create index if not exists spec_point_equivalences_combined_idx
  on spec_point_equivalences (combined_spec_point_id);
create index if not exists spec_point_equivalences_triple_idx
  on spec_point_equivalences (triple_spec_point_id);

-- ---------------------------------------------------------------------------
-- questions: audience + dual spec linking + required practical FK
-- ---------------------------------------------------------------------------
alter table questions
  add column if not exists audience text not null default 'both';

alter table questions drop constraint if exists questions_audience_check;
alter table questions
  add constraint questions_audience_check
  check (audience in ('both', 'triple_only'));

alter table questions
  add column if not exists triple_spec_point_id uuid references spec_points(id) on delete set null;

update questions set audience = 'both' where audience is null;

-- ---------------------------------------------------------------------------
-- required_practicals reference catalog
-- ---------------------------------------------------------------------------
create table if not exists required_practicals (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject in ('biology', 'chemistry', 'physics')),
  course_track text not null default 'combined'
    check (course_track in ('combined', 'triple', 'both')),
  code text not null,
  title text not null,
  description text,
  sort_order smallint not null default 0,
  unique (subject, course_track, code)
);

alter table questions
  add column if not exists required_practical_id uuid references required_practicals(id) on delete set null;

create index if not exists questions_required_practical_id_idx
  on questions (required_practical_id);

-- Seed AQA required practicals (Combined Trilogy + Triple separate sciences)
insert into required_practicals (subject, course_track, code, title, sort_order) values
  ('biology', 'combined', 'RP1', 'Use a light microscope to observe, draw and label plant and animal cells', 1),
  ('biology', 'combined', 'RP2', 'Food tests', 2),
  ('biology', 'combined', 'RP3', 'Investigate the effect of pH on amylase activity', 3),
  ('biology', 'combined', 'RP4', 'Investigate the effect of light intensity on photosynthesis', 4),
  ('biology', 'combined', 'RP5', 'Investigate the effect of sugar concentration on the mass of plant tissue', 5),
  ('biology', 'combined', 'RP6', 'Investigate the effect of exercise on breathing rate and heart rate', 6),
  ('biology', 'combined', 'RP7', 'Plan and carry out an investigation into the effect of a factor on human reaction times', 7),
  ('biology', 'combined', 'RP8', 'Investigate the effect of light intensity on the distribution of clover or another plant', 8),
  ('biology', 'combined', 'RP9', 'Investigate the effect of antiseptics on bacterial growth using agar plates', 9),
  ('biology', 'combined', 'RP10', 'Investigate the effect of osmosis on potato tissue', 10),
  ('chemistry', 'combined', 'RP1', 'Make up a volumetric solution and use it to carry out a simple acid–alkali titration', 1),
  ('chemistry', 'combined', 'RP2', 'Investigate the composition of inks using chromatography', 2),
  ('chemistry', 'combined', 'RP3', 'Investigate the change in pH on adding a base to an acid', 3),
  ('chemistry', 'combined', 'RP4', 'Investigate the variables that affect temperature change in chemical reactions', 4),
  ('chemistry', 'combined', 'RP5', 'Investigate the effect of concentration on the rate of reaction', 5),
  ('chemistry', 'combined', 'RP6', 'Investigate the effect of surface area on the rate of reaction', 6),
  ('chemistry', 'combined', 'RP7', 'Identify ions in unknown salts', 7),
  ('chemistry', 'combined', 'RP8', 'Analysis and purification of water samples from different sources', 8),
  ('physics', 'combined', 'RP1', 'Investigate the I–V characteristics of circuit elements', 1),
  ('physics', 'combined', 'RP2', 'Investigate the effectiveness of different materials as thermal insulators', 2),
  ('physics', 'combined', 'RP3', 'Investigate the density of regular and irregular solid objects', 3),
  ('physics', 'combined', 'RP4', 'Investigate the acceleration of a trolley down a ramp', 4),
  ('physics', 'combined', 'RP5', 'Investigate the relationship between force and extension for a spring', 5),
  ('physics', 'combined', 'RP6', 'Investigate the reflection of light by different types of surface', 6),
  ('physics', 'combined', 'RP7', 'Investigate the frequency of a sound wave using an oscilloscope', 7),
  ('physics', 'combined', 'RP8', 'Investigate the effectiveness of different materials as absorbers of ionising radiation', 8),
  ('biology', 'triple', 'RP1', 'Use a light microscope to observe, draw and label plant and animal cells', 1),
  ('biology', 'triple', 'RP2', 'Food tests', 2),
  ('biology', 'triple', 'RP3', 'Investigate the effect of pH on amylase activity', 3),
  ('biology', 'triple', 'RP4', 'Investigate the effect of light intensity on photosynthesis', 4),
  ('biology', 'triple', 'RP5', 'Investigate the effect of sugar concentration on the mass of plant tissue', 5),
  ('biology', 'triple', 'RP6', 'Investigate the effect of exercise on breathing rate and heart rate', 6),
  ('biology', 'triple', 'RP7', 'Plan and carry out an investigation into the effect of a factor on human reaction times', 7),
  ('biology', 'triple', 'RP8', 'Investigate the effect of light intensity on the distribution of clover or another plant', 8),
  ('biology', 'triple', 'RP9', 'Investigate the effect of antiseptics on bacterial growth using agar plates', 9),
  ('biology', 'triple', 'RP10', 'Investigate the effect of osmosis on potato tissue', 10),
  ('chemistry', 'triple', 'RP1', 'Make up a volumetric solution and use it to carry out a simple acid–alkali titration', 1),
  ('chemistry', 'triple', 'RP2', 'Investigate the composition of inks using chromatography', 2),
  ('chemistry', 'triple', 'RP3', 'Investigate the change in pH on adding a base to an acid', 3),
  ('chemistry', 'triple', 'RP4', 'Investigate the variables that affect temperature change in chemical reactions', 4),
  ('chemistry', 'triple', 'RP5', 'Investigate the effect of concentration on the rate of reaction', 5),
  ('chemistry', 'triple', 'RP6', 'Investigate the effect of surface area on the rate of reaction', 6),
  ('chemistry', 'triple', 'RP7', 'Identify ions in unknown salts', 7),
  ('chemistry', 'triple', 'RP8', 'Analysis and purification of water samples from different sources', 8),
  ('physics', 'triple', 'RP1', 'Investigate the I–V characteristics of circuit elements', 1),
  ('physics', 'triple', 'RP2', 'Investigate the effectiveness of different materials as thermal insulators', 2),
  ('physics', 'triple', 'RP3', 'Investigate the density of regular and irregular solid objects', 3),
  ('physics', 'triple', 'RP4', 'Investigate the acceleration of a trolley down a ramp', 4),
  ('physics', 'triple', 'RP5', 'Investigate the relationship between force and extension for a spring', 5),
  ('physics', 'triple', 'RP6', 'Investigate the reflection of light by different types of surface', 6),
  ('physics', 'triple', 'RP7', 'Investigate the frequency of a sound wave using an oscilloscope', 7),
  ('physics', 'triple', 'RP8', 'Investigate the effectiveness of different materials as absorbers of ionising radiation', 8)
on conflict (subject, course_track, code) do nothing;

-- ---------------------------------------------------------------------------
-- equation_sheets: course track for combined vs triple physics
-- ---------------------------------------------------------------------------
alter table equation_sheets
  add column if not exists course_track text not null default 'combined';

alter table equation_sheets drop constraint if exists equation_sheets_course_track_check;
alter table equation_sheets
  add constraint equation_sheets_course_track_check
  check (course_track in ('combined', 'triple'));

update equation_sheets set course_track = 'combined' where course_track is null;

-- ---------------------------------------------------------------------------
-- Helper: tier arrays for seed / question lookup
-- ---------------------------------------------------------------------------
create or replace function public.tier_array_for_label(p_tier text)
returns text[]
language plpgsql
immutable
as $$
declare
  v_tier text := upper(trim(coalesce(p_tier, 'FT')));
begin
  if v_tier in ('HT', 'HIGHER') then
    return array['HT', 'ht', 'both', 'Both', 'higher', 'foundation'];
  end if;
  return array['FT', 'ft', 'both', 'Both', 'foundation', 'higher'];
end;
$$;

-- ---------------------------------------------------------------------------
-- seed_initial_srs (course track + per-subject tiers)
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
  v_path text;
  v_subjects text[] := array['biology', 'chemistry', 'physics'];
  v_subject text;
  v_rank int;
  v_diff text;
  v_count int;
  v_total int := 0;
  v_sp record;
  v_today date := current_date;
  v_subject_tier text;
  v_tiers text[];
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

  for v_rank in 1..3 loop
    foreach v_subject in array v_subjects loop
      if coalesce((v_profile.subject_preference ->> v_subject)::int, 99) <> v_rank then
        continue;
      end if;

      v_diff := coalesce(v_profile.subject_difficulty ->> v_subject, 'medium');
      v_count := case v_diff
        when 'hardest' then 2
        else 1
      end;

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

-- ---------------------------------------------------------------------------
-- migrate_srs_for_track_change — preserve mappable SRS rows
-- ---------------------------------------------------------------------------
create or replace function public.migrate_srs_for_track_change(p_new_path text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row srs_state%rowtype;
  v_sp spec_points%rowtype;
  v_target_id uuid;
  v_migrated int := 0;
  v_deleted int := 0;
  v_existing srs_state%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_new_path not in ('combined', 'triple') then
    raise exception 'Invalid science path';
  end if;

  for v_row in select * from srs_state where user_id = v_uid loop
    select * into v_sp from spec_points where id = v_row.spec_point_id;
    if not found then
      delete from srs_state where user_id = v_uid and spec_point_id = v_row.spec_point_id;
      v_deleted := v_deleted + 1;
      continue;
    end if;

    if v_sp.course_track = p_new_path then
      continue;
    end if;

    v_target_id := null;
    if p_new_path = 'triple' then
      select e.triple_spec_point_id into v_target_id
      from spec_point_equivalences e
      where e.combined_spec_point_id = v_sp.id;
    else
      select e.combined_spec_point_id into v_target_id
      from spec_point_equivalences e
      where e.triple_spec_point_id = v_sp.id;
    end if;

    if v_target_id is null then
      delete from srs_state where user_id = v_uid and spec_point_id = v_row.spec_point_id;
      v_deleted := v_deleted + 1;
      continue;
    end if;

    select * into v_existing
    from srs_state
    where user_id = v_uid and spec_point_id = v_target_id;

    if found then
      update srs_state set
        repetitions = greatest(v_existing.repetitions, v_row.repetitions),
        due_date = least(v_existing.due_date, v_row.due_date),
        ease_factor = greatest(v_existing.ease_factor, v_row.ease_factor),
        lapses = greatest(v_existing.lapses, v_row.lapses),
        updated_at = now()
      where user_id = v_uid and spec_point_id = v_target_id;
      delete from srs_state where user_id = v_uid and spec_point_id = v_row.spec_point_id;
    else
      update srs_state set spec_point_id = v_target_id, updated_at = now()
      where user_id = v_uid and spec_point_id = v_row.spec_point_id;
    end if;

    v_migrated := v_migrated + 1;
  end loop;

  return jsonb_build_object('migrated', v_migrated, 'deleted', v_deleted);
end;
$$;

grant execute on function public.migrate_srs_for_track_change(text) to authenticated;
grant execute on function public.tier_array_for_label(text) to authenticated;

-- RLS for required_practicals (read-only for authenticated)
alter table required_practicals enable row level security;

drop policy if exists required_practicals_read on required_practicals;
create policy required_practicals_read on required_practicals
  for select to authenticated using (true);

drop policy if exists spec_point_equivalences_read on spec_point_equivalences;
create policy spec_point_equivalences_read on spec_point_equivalences
  for select to authenticated using (true);

alter table spec_point_equivalences enable row level security;
