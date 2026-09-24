-- Constrain authenticated full-bank SELECT on questions.
-- Students receive stems only via short-lived session grants (next-N),
-- prior attempts (flashcards / resume), or teacher class-roster visibility.
-- Developers retain full SELECT. Pool assembly uses meta-only RPCs (no stems).

-- ---------------------------------------------------------------------------
-- Grants table
-- ---------------------------------------------------------------------------
create table if not exists public.question_delivery_grants (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  session_id uuid not null,
  mode text not null default 'practice',
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint question_delivery_grants_mode_len check (char_length(mode) <= 64)
);

create index if not exists question_delivery_grants_user_qid_exp_idx
  on public.question_delivery_grants (user_id, question_id, expires_at desc);

create index if not exists question_delivery_grants_user_granted_idx
  on public.question_delivery_grants (user_id, granted_at desc);

create index if not exists question_delivery_grants_session_idx
  on public.question_delivery_grants (session_id);

alter table public.question_delivery_grants enable row level security;

drop policy if exists question_delivery_grants_select_own on public.question_delivery_grants;
create policy question_delivery_grants_select_own on public.question_delivery_grants
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_developer());

-- No direct client INSERT/UPDATE/DELETE — grants go through RPCs only.
revoke all on table public.question_delivery_grants from anon;
grant select on table public.question_delivery_grants to authenticated;

-- ---------------------------------------------------------------------------
-- Access helper (also used by Edge Functions via RPC)
-- ---------------------------------------------------------------------------
create or replace function public.user_can_access_question(p_question_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    p_user_id is not null
    and p_question_id is not null
    and (
      exists (
        select 1 from public.profiles pr
        where pr.user_id = p_user_id and pr.role = 'developer'
      )
      or exists (
        select 1
        from public.question_delivery_grants g
        where g.user_id = p_user_id
          and g.question_id = p_question_id
          and g.expires_at > now()
      )
      or exists (
        select 1
        from public.attempts a
        where a.user_id = p_user_id
          and a.question_id = p_question_id
      )
      or exists (
        select 1
        from public.attempts a
        join public.profiles student on student.user_id = a.user_id
        join public.classes c on c.id = student.class_id
        where a.question_id = p_question_id
          and c.teacher_id = p_user_id
      )
    );
$$;

grant execute on function public.user_can_access_question(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- questions RLS: drop open authenticated SELECT
-- ---------------------------------------------------------------------------
drop policy if exists questions_authenticated_select on public.questions;
drop policy if exists questions_developer_select on public.questions;
drop policy if exists questions_granted_select on public.questions;
drop policy if exists questions_attempted_select on public.questions;
drop policy if exists questions_teacher_roster_select on public.questions;

create policy questions_developer_select on public.questions
  for select
  to authenticated
  using (public.is_developer());

create policy questions_granted_select on public.questions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.question_delivery_grants g
      where g.question_id = questions.id
        and g.user_id = auth.uid()
        and g.expires_at > now()
    )
  );

create policy questions_attempted_select on public.questions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.attempts a
      where a.question_id = questions.id
        and a.user_id = auth.uid()
    )
  );

create policy questions_teacher_roster_select on public.questions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.attempts a
      join public.profiles student on student.user_id = a.user_id
      join public.classes c on c.id = student.class_id
      where a.question_id = questions.id
        and c.teacher_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Meta-only pool listing (no prompt / options / hints / configs)
-- ---------------------------------------------------------------------------
create or replace function public.list_question_pool_meta(
  p_spec_point_ids uuid[],
  p_tiers text[] default null,
  p_q_type text default null
)
returns table (
  id uuid,
  spec_point_id uuid,
  triple_spec_point_id uuid,
  audience text,
  tier text,
  difficulty integer,
  demand_level text,
  ao1_marks smallint,
  ao2_marks smallint,
  ao3_marks smallint,
  is_maths_skill boolean,
  is_required_practical boolean,
  required_practical_id uuid,
  question_type text,
  marking_method text,
  max_marks integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_ids uuid[];
  v_tiers text[];
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_ids := array(select distinct x from unnest(coalesce(p_spec_point_ids, '{}'::uuid[])) as x where x is not null);
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return;
  end if;

  -- Cap filter fan-out to keep meta listing bounded per call.
  if array_length(v_ids, 1) > 200 then
    raise exception 'too_many_spec_points';
  end if;

  v_tiers := nullif(p_tiers, '{}'::text[]);

  return query
  select
    q.id,
    q.spec_point_id,
    q.triple_spec_point_id,
    q.audience,
    q.tier,
    q.difficulty,
    q.demand_level,
    q.ao1_marks,
    q.ao2_marks,
    q.ao3_marks,
    q.is_maths_skill,
    q.is_required_practical,
    q.required_practical_id,
    q.question_type,
    q.marking_method,
    q.max_marks
  from public.questions q
  where (
      q.spec_point_id = any (v_ids)
      or q.triple_spec_point_id = any (v_ids)
    )
    and (v_tiers is null or q.tier = any (v_tiers))
    and (p_q_type is null or p_q_type = '' or q.question_type = p_q_type);
end;
$$;

grant execute on function public.list_question_pool_meta(uuid[], text[], text) to authenticated;

-- Meta for an explicit id list (skill practice / resume planning).
create or replace function public.list_question_meta_by_ids(
  p_question_ids uuid[]
)
returns table (
  id uuid,
  spec_point_id uuid,
  triple_spec_point_id uuid,
  audience text,
  tier text,
  difficulty integer,
  demand_level text,
  ao1_marks smallint,
  ao2_marks smallint,
  ao3_marks smallint,
  is_maths_skill boolean,
  is_required_practical boolean,
  required_practical_id uuid,
  question_type text,
  marking_method text,
  max_marks integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_ids := array(select distinct x from unnest(coalesce(p_question_ids, '{}'::uuid[])) as x where x is not null);
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return;
  end if;
  if array_length(v_ids, 1) > 200 then
    raise exception 'too_many_question_ids';
  end if;

  return query
  select
    q.id,
    q.spec_point_id,
    q.triple_spec_point_id,
    q.audience,
    q.tier,
    q.difficulty,
    q.demand_level,
    q.ao1_marks,
    q.ao2_marks,
    q.ao3_marks,
    q.is_maths_skill,
    q.is_required_practical,
    q.required_practical_id,
    q.question_type,
    q.marking_method,
    q.max_marks
  from public.questions q
  where q.id = any (v_ids);
end;
$$;

grant execute on function public.list_question_meta_by_ids(uuid[]) to authenticated;

-- Lightweight coverage rows for due-queue / onboarding (no stems).
create or replace function public.list_question_coverage(
  p_spec_point_ids uuid[],
  p_tiers text[] default null
)
returns table (
  spec_point_id uuid,
  triple_spec_point_id uuid,
  audience text,
  tier text,
  demand_level text
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_ids uuid[];
  v_tiers text[];
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_ids := array(select distinct x from unnest(coalesce(p_spec_point_ids, '{}'::uuid[])) as x where x is not null);
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return;
  end if;
  if array_length(v_ids, 1) > 400 then
    raise exception 'too_many_spec_points';
  end if;

  v_tiers := nullif(p_tiers, '{}'::text[]);

  return query
  select
    q.spec_point_id,
    q.triple_spec_point_id,
    q.audience,
    q.tier,
    q.demand_level
  from public.questions q
  where (
      q.spec_point_id = any (v_ids)
      or q.triple_spec_point_id = any (v_ids)
    )
    and (v_tiers is null or q.tier = any (v_tiers));
end;
$$;

grant execute on function public.list_question_coverage(uuid[], text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Open next-N practice session: grant stems for selected IDs only
-- ---------------------------------------------------------------------------
create or replace function public.open_practice_session(
  p_question_ids uuid[],
  p_mode text default 'practice'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
  v_mode text;
  v_session_id uuid := gen_random_uuid();
  v_expires_at timestamptz := now() + interval '24 hours';
  v_recent_opens int;
  v_recent_grants int;
  v_qid uuid;
  v_granted int := 0;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  -- Teachers / developers do not need student session grants for bank work.
  if exists (
    select 1 from public.profiles p
    where p.user_id = v_uid and p.role in ('teacher', 'developer')
  ) then
    return jsonb_build_object(
      'ok', true,
      'session_id', null,
      'question_ids', coalesce(
        (select jsonb_agg(x) from (
          select distinct unnest(coalesce(p_question_ids, '{}'::uuid[])) as x
          where x is not null
        ) s),
        '[]'::jsonb
      ),
      'granted', 0,
      'skipped_role', true
    );
  end if;

  v_mode := left(coalesce(nullif(trim(p_mode), ''), 'practice'), 64);
  v_ids := array(
    select distinct x
    from unnest(coalesce(p_question_ids, '{}'::uuid[])) as x
    where x is not null
  );

  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'empty_question_ids');
  end if;

  if array_length(v_ids, 1) > 70 then
    return jsonb_build_object('ok', false, 'reason', 'too_many_questions', 'max', 70);
  end if;

  -- Rate limits: blunt scrape throttle (not a substitute for edge rate limits).
  select count(*)::int into v_recent_opens
  from (
    select g.session_id
    from public.question_delivery_grants g
    where g.user_id = v_uid
      and g.granted_at > now() - interval '1 hour'
    group by g.session_id
  ) s;

  if v_recent_opens >= 40 then
    return jsonb_build_object('ok', false, 'reason', 'session_rate_limited');
  end if;

  select coalesce(sum(cnt), 0)::int into v_recent_grants
  from (
    select count(*)::int as cnt
    from public.question_delivery_grants g
    where g.user_id = v_uid
      and g.granted_at > now() - interval '1 hour'
  ) t;

  if v_recent_grants + array_length(v_ids, 1) > 400 then
    return jsonb_build_object('ok', false, 'reason', 'grant_rate_limited');
  end if;

  -- Single active delivery window per student.
  delete from public.question_delivery_grants
  where user_id = v_uid;

  -- Re-insert only the requested set (single active session).
  foreach v_qid in array v_ids
  loop
    if exists (select 1 from public.questions q where q.id = v_qid) then
      insert into public.question_delivery_grants (user_id, question_id, session_id, mode, expires_at)
      values (v_uid, v_qid, v_session_id, v_mode, v_expires_at);
      v_granted := v_granted + 1;
    end if;
  end loop;

  if v_granted = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_matching_questions');
  end if;

  return jsonb_build_object(
    'ok', true,
    'session_id', v_session_id,
    'expires_at', v_expires_at,
    'mode', v_mode,
    'granted', v_granted,
    'question_ids', (
      select coalesce(jsonb_agg(g.question_id order by g.id), '[]'::jsonb)
      from public.question_delivery_grants g
      where g.session_id = v_session_id
    )
  );
end;
$$;

grant execute on function public.open_practice_session(uuid[], text) to authenticated;

-- Batch access check for Edge prefetch / mark paths
create or replace function public.filter_accessible_question_ids(p_question_ids uuid[])
returns uuid[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    array(
      select distinct x
      from unnest(coalesce(p_question_ids, '{}'::uuid[])) as x
      where x is not null
        and public.user_can_access_question(x, auth.uid())
    ),
    '{}'::uuid[]
  );
$$;

grant execute on function public.filter_accessible_question_ids(uuid[]) to authenticated;
