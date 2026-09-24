-- Cross-board syllabus equivalence map (AQA ↔ Edexcel ↔ OCR…).
-- Distinct from spec_point_equivalences (within-board combined↔triple).
-- Spec refs are first-class so maps can be imported before target-board
-- spec_points exist; FKs are resolved when both sides are present.
-- Idempotent / empty seed: do NOT invent or claim verified Edexcel/OCR content.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.cross_board_spec_equivalences (
  id uuid primary key default gen_random_uuid(),

  source_exam_board text not null
    check (source_exam_board in ('aqa', 'edexcel', 'ocr_gateway', 'ocr_21c')),
  source_course_track text not null
    check (source_course_track in ('combined', 'triple')),
  source_subject text not null
    check (source_subject in ('biology', 'chemistry', 'physics')),
  source_spec_ref text not null,
  source_spec_point_id uuid references public.spec_points(id) on delete set null,

  target_exam_board text not null
    check (target_exam_board in ('aqa', 'edexcel', 'ocr_gateway', 'ocr_21c')),
  target_course_track text not null
    check (target_course_track in ('combined', 'triple')),
  target_subject text not null
    check (target_subject in ('biology', 'chemistry', 'physics')),
  target_spec_ref text not null,
  target_spec_point_id uuid references public.spec_points(id) on delete set null,

  -- Human sign-off gate. Imports default to unverified; validated_at is set only
  -- after an explicit developer confirm (never auto-claimed as verified).
  match_quality text not null default 'unverified'
    check (match_quality in ('exact', 'partial', 'broader', 'narrower', 'unverified', 'none')),
  notes text,
  validated_at timestamptz,
  validated_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cross_board_equiv_distinct_boards
    check (source_exam_board <> target_exam_board),
  constraint cross_board_equiv_unique_pair unique (
    source_exam_board,
    source_course_track,
    source_subject,
    source_spec_ref,
    target_exam_board,
    target_course_track
  )
);

create index if not exists cross_board_equiv_source_idx
  on public.cross_board_spec_equivalences (
    source_exam_board, source_course_track, source_subject, source_spec_ref
  );

create index if not exists cross_board_equiv_target_idx
  on public.cross_board_spec_equivalences (
    target_exam_board, target_course_track, target_subject, target_spec_ref
  );

create index if not exists cross_board_equiv_source_sp_idx
  on public.cross_board_spec_equivalences (source_spec_point_id)
  where source_spec_point_id is not null;

create index if not exists cross_board_equiv_target_sp_idx
  on public.cross_board_spec_equivalences (target_spec_point_id)
  where target_spec_point_id is not null;

create index if not exists cross_board_equiv_unvalidated_idx
  on public.cross_board_spec_equivalences (source_exam_board, target_exam_board)
  where validated_at is null;

comment on table public.cross_board_spec_equivalences is
  'Cross-board syllabus equivalence map (AQA↔Edexcel↔OCR). Refs first; FKs optional until syllabus rows exist. validated_at is the human sign-off gate — do not treat rows as verified content without it.';

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.cross_board_equiv_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cross_board_equiv_updated_at on public.cross_board_spec_equivalences;
create trigger cross_board_equiv_updated_at
  before update on public.cross_board_spec_equivalences
  for each row execute function public.cross_board_equiv_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: authenticated read; developer write
-- ---------------------------------------------------------------------------
alter table public.cross_board_spec_equivalences enable row level security;

drop policy if exists cross_board_equiv_read on public.cross_board_spec_equivalences;
create policy cross_board_equiv_read on public.cross_board_spec_equivalences
  for select to authenticated using (true);

drop policy if exists cross_board_equiv_developer_write on public.cross_board_spec_equivalences;
create policy cross_board_equiv_developer_write on public.cross_board_spec_equivalences
  for all to authenticated
  using (public.is_developer())
  with check (public.is_developer());

-- ---------------------------------------------------------------------------
-- Resolve optional FKs from refs when both boards' spec_points exist.
-- Safe to re-run; never invents rows or marks validated_at.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_cross_board_equiv_fks(
  p_source_board text default null,
  p_target_board text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int := 0;
begin
  if not public.is_developer() then
    raise exception 'Developer role required';
  end if;

  update public.cross_board_spec_equivalences e
  set source_spec_point_id = sp.id
  from public.spec_points sp
  where e.source_spec_point_id is null
    and sp.exam_board = e.source_exam_board
    and sp.course_track = e.source_course_track
    and sp.subject = e.source_subject
    and sp.spec_ref = e.source_spec_ref
    and (p_source_board is null or e.source_exam_board = p_source_board)
    and (p_target_board is null or e.target_exam_board = p_target_board);

  get diagnostics v_updated = row_count;

  update public.cross_board_spec_equivalences e
  set target_spec_point_id = sp.id
  from public.spec_points sp
  where e.target_spec_point_id is null
    and sp.exam_board = e.target_exam_board
    and sp.course_track = e.target_course_track
    and sp.subject = e.target_subject
    and sp.spec_ref = e.target_spec_ref
    and (p_source_board is null or e.source_exam_board = p_source_board)
    and (p_target_board is null or e.target_exam_board = p_target_board);

  return jsonb_build_object(
    'source_fks_set', v_updated,
    'note', 'FK resolution only; validated_at is unchanged'
  );
end;
$$;

grant execute on function public.resolve_cross_board_equiv_fks(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Developer upsert of one mapping row (import / admin edit).
-- Does not auto-set validated_at unless p_mark_validated is true.
-- ---------------------------------------------------------------------------
create or replace function public.developer_upsert_cross_board_equiv(p_row jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_mark_validated boolean := coalesce((p_row ->> 'mark_validated')::boolean, false);
begin
  if not public.is_developer() then
    raise exception 'Developer role required';
  end if;

  insert into public.cross_board_spec_equivalences (
    source_exam_board,
    source_course_track,
    source_subject,
    source_spec_ref,
    source_spec_point_id,
    target_exam_board,
    target_course_track,
    target_subject,
    target_spec_ref,
    target_spec_point_id,
    match_quality,
    notes,
    validated_at,
    validated_by
  ) values (
    lower(trim(p_row ->> 'source_exam_board')),
    lower(trim(p_row ->> 'source_course_track')),
    lower(trim(p_row ->> 'source_subject')),
    trim(p_row ->> 'source_spec_ref'),
    nullif(p_row ->> 'source_spec_point_id', '')::uuid,
    lower(trim(p_row ->> 'target_exam_board')),
    lower(trim(p_row ->> 'target_course_track')),
    lower(trim(p_row ->> 'target_subject')),
    trim(p_row ->> 'target_spec_ref'),
    nullif(p_row ->> 'target_spec_point_id', '')::uuid,
    coalesce(nullif(lower(trim(p_row ->> 'match_quality')), ''), 'unverified'),
    nullif(trim(p_row ->> 'notes'), ''),
    case when v_mark_validated then now() else null end,
    case when v_mark_validated then auth.uid() else null end
  )
  on conflict (
    source_exam_board,
    source_course_track,
    source_subject,
    source_spec_ref,
    target_exam_board,
    target_course_track
  ) do update set
    target_subject = excluded.target_subject,
    target_spec_ref = excluded.target_spec_ref,
    source_spec_point_id = coalesce(
      excluded.source_spec_point_id,
      public.cross_board_spec_equivalences.source_spec_point_id
    ),
    target_spec_point_id = coalesce(
      excluded.target_spec_point_id,
      public.cross_board_spec_equivalences.target_spec_point_id
    ),
    match_quality = excluded.match_quality,
    notes = coalesce(excluded.notes, public.cross_board_spec_equivalences.notes),
    validated_at = case
      when v_mark_validated then now()
      else public.cross_board_spec_equivalences.validated_at
    end,
    validated_by = case
      when v_mark_validated then auth.uid()
      else public.cross_board_spec_equivalences.validated_by
    end,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.developer_upsert_cross_board_equiv(jsonb) to authenticated;
