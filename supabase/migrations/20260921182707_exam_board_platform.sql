-- Phase 0: exam_board as a first-class dimension (default AQA; no new board content).
-- Mirrors the course_track pattern from triple science.

-- ---------------------------------------------------------------------------
-- Catalog (optional but useful for UI / future boards)
-- ---------------------------------------------------------------------------
create table if not exists public.exam_boards (
  id text primary key,
  display_name text not null,
  combined_label text not null,
  separate_label text not null,
  combined_spec_code text,
  grade_format text not null default 'aqa_dual_award'
    check (grade_format in ('aqa_dual_award', 'single_1_9')),
  is_active boolean not null default false,
  sort_order int not null default 100
);

insert into public.exam_boards (id, display_name, combined_label, separate_label, combined_spec_code, grade_format, is_active, sort_order)
values
  ('aqa', 'AQA', 'Combined Science (Trilogy)', 'Separate Sciences (Triple)', '8464', 'aqa_dual_award', true, 10),
  ('edexcel', 'Edexcel', 'Combined Science', 'Separate Sciences', '1SC0', 'single_1_9', false, 20),
  ('ocr_gateway', 'OCR Gateway', 'Combined Science A', 'Separate Sciences A', 'J250', 'single_1_9', false, 30),
  ('ocr_21c', 'OCR 21st Century', 'Combined Science B', 'Separate Sciences B', 'J260', 'single_1_9', false, 40)
on conflict (id) do update set
  display_name = excluded.display_name,
  combined_label = excluded.combined_label,
  separate_label = excluded.separate_label,
  combined_spec_code = excluded.combined_spec_code,
  grade_format = excluded.grade_format,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

alter table public.exam_boards enable row level security;
drop policy if exists exam_boards_read on public.exam_boards;
create policy exam_boards_read on public.exam_boards
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- profiles.exam_board
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists exam_board text;

update public.profiles
set exam_board = 'aqa'
where exam_board is null;

alter table public.profiles
  alter column exam_board set default 'aqa';

alter table public.profiles
  alter column exam_board set not null;

alter table public.profiles drop constraint if exists profiles_exam_board_check;
alter table public.profiles
  add constraint profiles_exam_board_check
  check (exam_board in ('aqa', 'edexcel', 'ocr_gateway', 'ocr_21c'));

-- ---------------------------------------------------------------------------
-- spec_points.exam_board + unique index
-- ---------------------------------------------------------------------------
alter table public.spec_points
  add column if not exists exam_board text;

update public.spec_points
set exam_board = 'aqa'
where exam_board is null;

alter table public.spec_points
  alter column exam_board set default 'aqa';

alter table public.spec_points
  alter column exam_board set not null;

alter table public.spec_points drop constraint if exists spec_points_exam_board_check;
alter table public.spec_points
  add constraint spec_points_exam_board_check
  check (exam_board in ('aqa', 'edexcel', 'ocr_gateway', 'ocr_21c'));

drop index if exists public.spec_points_track_subject_paper_ref_idx;
create unique index if not exists spec_points_board_track_subject_paper_ref_idx
  on public.spec_points (exam_board, course_track, subject, paper, spec_ref);

-- ---------------------------------------------------------------------------
-- required_practicals.exam_board
-- ---------------------------------------------------------------------------
alter table public.required_practicals
  add column if not exists exam_board text;

update public.required_practicals
set exam_board = 'aqa'
where exam_board is null;

alter table public.required_practicals
  alter column exam_board set default 'aqa';

alter table public.required_practicals
  alter column exam_board set not null;

alter table public.required_practicals drop constraint if exists required_practicals_exam_board_check;
alter table public.required_practicals
  add constraint required_practicals_exam_board_check
  check (exam_board in ('aqa', 'edexcel', 'ocr_gateway', 'ocr_21c'));

-- Drop legacy unique if present, then board-scoped unique
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'required_practicals_subject_course_track_code_key'
      and conrelid = 'public.required_practicals'::regclass
  ) then
    alter table public.required_practicals
      drop constraint required_practicals_subject_course_track_code_key;
  end if;
exception when undefined_table then
  null;
end $$;

drop index if exists public.required_practicals_subject_course_track_code_key;
create unique index if not exists required_practicals_board_subject_track_code_idx
  on public.required_practicals (exam_board, subject, course_track, code);

-- ---------------------------------------------------------------------------
-- equation_sheets.exam_board
-- ---------------------------------------------------------------------------
alter table public.equation_sheets
  add column if not exists exam_board text;

update public.equation_sheets
set exam_board = 'aqa'
where exam_board is null;

alter table public.equation_sheets
  alter column exam_board set default 'aqa';

alter table public.equation_sheets
  alter column exam_board set not null;

alter table public.equation_sheets drop constraint if exists equation_sheets_exam_board_check;
alter table public.equation_sheets
  add constraint equation_sheets_exam_board_check
  check (exam_board in ('aqa', 'edexcel', 'ocr_gateway', 'ocr_21c'));

-- ---------------------------------------------------------------------------
-- spec_point_equivalences.exam_board (within-board combined↔ triple)
-- ---------------------------------------------------------------------------
alter table public.spec_point_equivalences
  add column if not exists exam_board text;

update public.spec_point_equivalences
set exam_board = 'aqa'
where exam_board is null;

alter table public.spec_point_equivalences
  alter column exam_board set default 'aqa';

alter table public.spec_point_equivalences
  alter column exam_board set not null;

alter table public.spec_point_equivalences drop constraint if exists spec_point_equivalences_exam_board_check;
alter table public.spec_point_equivalences
  add constraint spec_point_equivalences_exam_board_check
  check (exam_board in ('aqa', 'edexcel', 'ocr_gateway', 'ocr_21c'));

create index if not exists spec_point_equivalences_board_idx
  on public.spec_point_equivalences (exam_board);

-- ---------------------------------------------------------------------------
-- seed_initial_srs — filter spec_points by profile exam_board
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
  v_board text;
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
  v_board := coalesce(v_profile.exam_board, 'aqa');

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
          and sp.exam_board = v_board
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
        and sp.exam_board = v_board
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

-- ---------------------------------------------------------------------------
-- migrate_srs_for_track_change — also scope equivalences by exam_board
-- ---------------------------------------------------------------------------
create or replace function public.migrate_srs_for_track_change(p_new_path text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_board text;
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

  select coalesce(exam_board, 'aqa') into v_board
  from profiles where user_id = v_uid;
  v_board := coalesce(v_board, 'aqa');

  for v_row in select * from srs_state where user_id = v_uid loop
    select * into v_sp from spec_points where id = v_row.spec_point_id;
    if not found then
      delete from srs_state where user_id = v_uid and spec_point_id = v_row.spec_point_id;
      v_deleted := v_deleted + 1;
      continue;
    end if;

    if v_sp.course_track = p_new_path and coalesce(v_sp.exam_board, 'aqa') = v_board then
      continue;
    end if;

    v_target_id := null;
    if p_new_path = 'triple' then
      select e.triple_spec_point_id into v_target_id
      from spec_point_equivalences e
      where e.combined_spec_point_id = v_sp.id
        and e.exam_board = v_board;
    else
      select e.combined_spec_point_id into v_target_id
      from spec_point_equivalences e
      where e.triple_spec_point_id = v_sp.id
        and e.exam_board = v_board;
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
