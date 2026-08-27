-- Ask an expert: student flags on questions → developer inbox + one reply

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------
create table if not exists public.expert_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  attempt_id uuid references public.attempts (id) on delete set null,
  category text not null,
  student_message text,
  snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  admin_reply text,
  replied_at timestamptz,
  replied_by uuid references public.profiles (user_id) on delete set null,
  student_seen_at timestamptz,
  created_at timestamptz not null default now(),
  constraint expert_queries_category_check check (
    category in (
      'confused_question',
      'confused_feedback',
      'suspect_question_error',
      'suspect_answer_error',
      'other'
    )
  ),
  constraint expert_queries_status_check check (
    status in ('open', 'replied', 'dismissed')
  ),
  constraint expert_queries_message_len check (
    student_message is null or char_length(student_message) <= 1000
  ),
  constraint expert_queries_reply_len check (
    admin_reply is null or char_length(admin_reply) <= 4000
  )
);

create index if not exists expert_queries_status_created_idx
  on public.expert_queries (status, created_at desc);

create index if not exists expert_queries_user_id_idx
  on public.expert_queries (user_id, created_at desc);

create index if not exists expert_queries_question_id_idx
  on public.expert_queries (question_id);

create unique index if not exists expert_queries_one_open_per_user_question
  on public.expert_queries (user_id, question_id)
  where status = 'open';

alter table public.expert_queries enable row level security;

drop policy if exists expert_queries_student_select_own on public.expert_queries;
create policy expert_queries_student_select_own on public.expert_queries
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_developer());

drop policy if exists expert_queries_student_insert_own on public.expert_queries;
create policy expert_queries_student_insert_own on public.expert_queries
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- No broad student/developer UPDATE policies — replies & seen flags go through RPCs.

grant select, insert on public.expert_queries to authenticated;

-- ---------------------------------------------------------------------------
-- Snapshot helpers
-- ---------------------------------------------------------------------------
create or replace function public._expert_query_summarise_key(p_key_type text, p_payload jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_correct text;
begin
  if p_payload is null then
    return null;
  end if;

  if p_key_type = 'mcq' then
    v_correct := coalesce(p_payload->>'correct', p_payload->>'answer');
    if v_correct is not null then
      return 'MCQ correct option: ' || v_correct;
    end if;
  end if;

  if p_key_type = 'numeric' then
    return coalesce(
      p_payload->>'final_answer',
      p_payload->>'answer',
      p_payload->>'expected',
      p_payload::text
    );
  end if;

  if p_key_type = 'keywords' then
    return left(coalesce(p_payload::text, ''), 500);
  end if;

  if p_key_type = 'ai_rubric' then
    return left(coalesce(p_payload->>'level_descriptors', p_payload::text, ''), 500);
  end if;

  return left(coalesce(p_payload::text, ''), 500);
end;
$$;

create or replace function public._expert_query_summarise_response(p_payload jsonb)
returns text
language plpgsql
immutable
as $$
begin
  if p_payload is null then
    return null;
  end if;
  if p_payload ? 'answer' then
    return left(coalesce(p_payload->>'answer', ''), 800);
  end if;
  if p_payload ? 'text' then
    return left(coalesce(p_payload->>'text', ''), 800);
  end if;
  if p_payload ? 'selected' then
    return left(coalesce(p_payload->>'selected', ''), 800);
  end if;
  return left(p_payload::text, 800);
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_expert_query
-- ---------------------------------------------------------------------------
create or replace function public.submit_expert_query(
  p_question_id uuid,
  p_category text,
  p_student_message text default null,
  p_attempt_id uuid default null,
  p_client_response jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_open_for_q int;
  v_open_total int;
  v_created_today int;
  v_msg text;
  v_q public.questions%rowtype;
  v_key_type text;
  v_key_payload jsonb;
  v_attempt public.attempts%rowtype;
  v_attempt_id uuid := p_attempt_id;
  v_spec_subject text;
  v_spec_paper text;
  v_spec_ref text;
  v_spec_topic text;
  v_snapshot jsonb;
  v_row public.expert_queries%rowtype;
  v_student_response_summary text;
  v_correct_summary text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select role into v_role from public.profiles where user_id = v_uid;
  if v_role is distinct from 'student' then
    return jsonb_build_object('ok', false, 'reason', 'students_only');
  end if;

  if p_category is null or p_category not in (
    'confused_question',
    'confused_feedback',
    'suspect_question_error',
    'suspect_answer_error',
    'other'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'invalid_category');
  end if;

  v_msg := nullif(trim(coalesce(p_student_message, '')), '');
  if v_msg is not null and char_length(v_msg) > 1000 then
    return jsonb_build_object('ok', false, 'reason', 'message_too_long');
  end if;

  select count(*) into v_open_for_q
  from public.expert_queries
  where user_id = v_uid and question_id = p_question_id and status = 'open';
  if v_open_for_q > 0 then
    return jsonb_build_object('ok', false, 'reason', 'already_open_for_question');
  end if;

  select count(*) into v_open_total
  from public.expert_queries
  where user_id = v_uid and status = 'open';
  if v_open_total >= 5 then
    return jsonb_build_object('ok', false, 'reason', 'too_many_open');
  end if;

  select count(*) into v_created_today
  from public.expert_queries
  where user_id = v_uid
    and created_at >= (timezone('utc', now())::date)::timestamptz;
  if v_created_today >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'daily_cap');
  end if;

  select * into v_q from public.questions where id = p_question_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'question_not_found');
  end if;

  select key_type, key_payload
  into v_key_type, v_key_payload
  from public.answer_keys
  where question_id = p_question_id;

  if v_attempt_id is not null then
    select * into v_attempt
    from public.attempts
    where id = v_attempt_id and user_id = v_uid and question_id = p_question_id;
    if not found then
      v_attempt_id := null;
    end if;
  end if;

  if v_attempt_id is null then
    select * into v_attempt
    from public.attempts
    where user_id = v_uid and question_id = p_question_id
    order by submitted_at desc nulls last
    limit 1;
    if found then
      v_attempt_id := v_attempt.id;
    end if;
  end if;

  select sp.subject, sp.paper, sp.spec_ref, sp.topic_name
  into v_spec_subject, v_spec_paper, v_spec_ref, v_spec_topic
  from public.spec_points sp
  where sp.id = coalesce(v_q.spec_point_id, v_q.triple_spec_point_id);

  v_correct_summary := public._expert_query_summarise_key(v_key_type, v_key_payload);
  if v_attempt_id is not null then
    v_student_response_summary := public._expert_query_summarise_response(v_attempt.response_payload);
  elsif p_client_response is not null then
    v_student_response_summary := public._expert_query_summarise_response(p_client_response);
  else
    v_student_response_summary := null;
  end if;

  v_snapshot := jsonb_build_object(
    'prompt', v_q.prompt,
    'options', v_q.options,
    'question_type', v_q.question_type,
    'tier', v_q.tier,
    'audience', v_q.audience,
    'max_marks', v_q.max_marks,
    'image_url', v_q.image_url,
    'subject', v_spec_subject,
    'paper', v_spec_paper,
    'spec_ref', v_spec_ref,
    'topic_name', v_spec_topic,
    'key_type', v_key_type,
    'correct_answer_summary', v_correct_summary,
    'student_response_summary', v_student_response_summary,
    'client_response', p_client_response,
    'score_total', case when v_attempt_id is not null then v_attempt.score_total else null end,
    'score_max', case when v_attempt_id is not null then v_attempt.score_max else null end,
    'attempt_id', v_attempt_id
  );

  insert into public.expert_queries (
    user_id,
    question_id,
    attempt_id,
    category,
    student_message,
    snapshot,
    status
  )
  values (
    v_uid,
    p_question_id,
    v_attempt_id,
    p_category,
    v_msg,
    v_snapshot,
    'open'
  )
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'created_at', v_row.created_at,
    'snapshot', v_row.snapshot,
    'category', v_row.category,
    'student_message', v_row.student_message,
    'question_id', v_row.question_id
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'already_open_for_question');
end;
$$;

grant execute on function public.submit_expert_query(uuid, text, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- developer_reply_expert_query
-- ---------------------------------------------------------------------------
create or replace function public.developer_reply_expert_query(
  p_id uuid,
  p_status text,
  p_reply text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_reply text;
  v_row public.expert_queries%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;
  if not public.is_developer() then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if p_status not in ('replied', 'dismissed') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;

  v_reply := nullif(trim(coalesce(p_reply, '')), '');
  if p_status = 'replied' and v_reply is null then
    return jsonb_build_object('ok', false, 'reason', 'reply_required');
  end if;
  if v_reply is not null and char_length(v_reply) > 4000 then
    return jsonb_build_object('ok', false, 'reason', 'reply_too_long');
  end if;

  update public.expert_queries
  set
    status = p_status,
    admin_reply = case when p_status = 'replied' then v_reply else admin_reply end,
    replied_at = timezone('utc', now()),
    replied_by = v_uid,
    student_seen_at = case when p_status = 'dismissed' then student_seen_at else null end
  where id = p_id
  returning * into v_row;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'status', v_row.status,
    'replied_at', v_row.replied_at
  );
end;
$$;

grant execute on function public.developer_reply_expert_query(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- mark_expert_query_seen
-- ---------------------------------------------------------------------------
create or replace function public.mark_expert_query_seen(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.expert_queries%rowtype;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  update public.expert_queries
  set student_seen_at = coalesce(student_seen_at, timezone('utc', now()))
  where id = p_id
    and user_id = v_uid
    and status = 'replied'
  returning * into v_row;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object('ok', true, 'id', v_row.id, 'student_seen_at', v_row.student_seen_at);
end;
$$;

grant execute on function public.mark_expert_query_seen(uuid) to authenticated;

-- Developer list helper: include student display name (email via edge/admin client as needed)
create or replace function public.developer_list_expert_queries(
  p_status text default 'open',
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := greatest(1, least(coalesce(p_limit, 50), 100));
  v_offset int := greatest(0, coalesce(p_offset, 0));
  v_rows jsonb;
begin
  if not public.is_developer() then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if p_status is not null and p_status not in ('open', 'replied', 'dismissed', 'all') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;

  select coalesce(jsonb_agg(row_data order by created_at desc), '[]'::jsonb)
  into v_rows
  from (
    select jsonb_build_object(
      'id', eq.id,
      'user_id', eq.user_id,
      'question_id', eq.question_id,
      'attempt_id', eq.attempt_id,
      'category', eq.category,
      'student_message', eq.student_message,
      'snapshot', eq.snapshot,
      'status', eq.status,
      'admin_reply', eq.admin_reply,
      'replied_at', eq.replied_at,
      'replied_by', eq.replied_by,
      'student_seen_at', eq.student_seen_at,
      'created_at', eq.created_at,
      'student_display_name', p.display_name
    ) as row_data,
    eq.created_at
    from public.expert_queries eq
    left join public.profiles p on p.user_id = eq.user_id
    where (
      p_status is null
      or p_status = 'all'
      or eq.status = p_status
    )
    order by eq.created_at desc
    offset v_offset
    limit v_limit
  ) t;

  return jsonb_build_object('ok', true, 'rows', v_rows);
end;
$$;

grant execute on function public.developer_list_expert_queries(text, int, int) to authenticated;

create or replace function public.developer_expert_query_open_count()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_developer() then
    return 0;
  end if;
  return (
    select count(*)::integer from public.expert_queries where status = 'open'
  );
end;
$$;

grant execute on function public.developer_expert_query_open_count() to authenticated;
