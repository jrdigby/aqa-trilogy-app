-- Ask an expert: student feedback, archive, and readable response summaries

alter table public.expert_queries
  add column if not exists student_feedback text,
  add column if not exists student_feedback_at timestamptz,
  add column if not exists archived_at timestamptz;

alter table public.expert_queries
  drop constraint if exists expert_queries_feedback_check;

alter table public.expert_queries
  add constraint expert_queries_feedback_check
  check (
    student_feedback is null
    or student_feedback in ('understood', 'still_confused')
  );

-- ---------------------------------------------------------------------------
-- Readable response summaries (emails + stored snapshot text)
-- ---------------------------------------------------------------------------
create or replace function public._expert_pretty_number(p_text text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          coalesce(p_text, ''),
          '([0-9]+(?:\.[0-9]+)?)\s*[eE]\s*\+?([0-9]+)',
          '\1 × 10^\2',
          'g'
        ),
        '([0-9]+(?:\.[0-9]+)?)\s*[eE]\s*-([0-9]+)',
        '\1 × 10^-\2',
        'g'
      ),
      '([0-9]+(?:\.[0-9]+)?)\s*[xX×*]\s*10\s*\^\s*-([0-9]+)',
      '\1 × 10^-\2',
      'g'
    ),
    '([0-9]+(?:\.[0-9]+)?)\s*[xX×*]\s*10\s*\^\s*\+?([0-9]+)',
    '\1 × 10^\2',
    'g'
  );
$$;

create or replace function public._expert_step_text(p_value jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_key text;
  v_part text;
  v_parts text[] := '{}';
begin
  if p_value is null or p_value = 'null'::jsonb then
    return null;
  end if;

  if jsonb_typeof(p_value) in ('string', 'number', 'boolean') then
    return nullif(trim(p_value #>> '{}'), '');
  end if;

  if jsonb_typeof(p_value) = 'object' then
    if nullif(trim(coalesce(p_value->>'text', '')), '') is not null then
      return trim(p_value->>'text');
    end if;
    if p_value ? 'numerator' or p_value ? 'denominator' then
      return nullif(trim(both ' /' from
        coalesce(public._expert_step_text(p_value->'numerator'), '')
        || ' / '
        || coalesce(public._expert_step_text(p_value->'denominator'), '')
      ), '');
    end if;
    if p_value ? 'left' or p_value ? 'right' then
      return nullif(trim(both ' ,' from
        coalesce(public._expert_step_text(p_value->'left'), '')
        || ', '
        || coalesce(public._expert_step_text(p_value->'right'), '')
      ), '');
    end if;
    for v_key in select k from jsonb_object_keys(p_value) as k loop
      v_part := public._expert_step_text(p_value->v_key);
      if v_part is not null then
        v_parts := array_append(v_parts, v_key || ': ' || v_part);
      end if;
    end loop;
    if cardinality(v_parts) = 0 then
      return null;
    end if;
    return array_to_string(v_parts, ', ');
  end if;

  if jsonb_typeof(p_value) = 'array' then
    for v_part in
      select public._expert_step_text(elem)
      from jsonb_array_elements(p_value) as elem
    loop
      if v_part is not null then
        v_parts := array_append(v_parts, v_part);
      end if;
    end loop;
    if cardinality(v_parts) = 0 then
      return null;
    end if;
    return array_to_string(v_parts, ', ');
  end if;

  return null;
end;
$$;

create or replace function public._expert_query_summarise_response(p_payload jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_type text;
  v_raw jsonb;
  v_steps jsonb;
  v_key text;
  v_line text;
  v_lines text[] := '{}';
  v_final text;
  v_unit text;
  v_order text[] := array[
    'equation_select',
    'substitution',
    'conversion',
    'element_mass',
    'mass_ratio',
    'insert_values',
    'mole_table',
    'mole_ratio',
    'limiting_select',
    'rearrangement',
    'balance_coeffs',
    'working_1',
    'working_2',
    'sig_figs'
  ];
  v_labels jsonb := jsonb_build_object(
    'equation_select', 'Equation',
    'substitution', 'Substitution',
    'conversion', 'Unit conversion',
    'element_mass', 'Element mass',
    'mass_ratio', 'Mass ratio',
    'insert_values', 'Substituted values',
    'mole_table', 'Mole table',
    'mole_ratio', 'Mole ratio',
    'limiting_select', 'Limiting reactant',
    'rearrangement', 'Rearrangement',
    'balance_coeffs', 'Balanced equation',
    'working_1', 'Working',
    'working_2', 'Further working',
    'sig_figs', 'Significant figures'
  );
  v_seen text[] := '{}';
begin
  if p_payload is null then
    return null;
  end if;

  v_type := p_payload->>'type';

  if v_type = 'numeric'
    or (p_payload ? 'stepRaw' and (p_payload ? 'value' or p_payload ? 'steps'))
  then
    v_raw := coalesce(p_payload->'stepRaw', '{}'::jsonb);
    v_steps := coalesce(p_payload->'steps', '{}'::jsonb);

    foreach v_key in array v_order loop
      v_line := public._expert_step_text(coalesce(v_raw->v_key, v_steps->v_key));
      if v_line is not null then
        v_lines := array_append(
          v_lines,
          coalesce(v_labels->>v_key, v_key) || ': ' || public._expert_pretty_number(v_line)
        );
        v_seen := array_append(v_seen, v_key);
      end if;
    end loop;

    for v_key in
      select k
      from (
        select jsonb_object_keys(v_raw) as k
        union
        select jsonb_object_keys(v_steps) as k
      ) keys
    loop
      if v_key = 'calculate' or v_key = any (v_seen) then
        continue;
      end if;
      v_line := public._expert_step_text(coalesce(v_raw->v_key, v_steps->v_key));
      if v_line is not null then
        v_lines := array_append(v_lines, v_key || ': ' || public._expert_pretty_number(v_line));
      end if;
    end loop;

    v_final := public._expert_step_text(v_raw->'calculate');
    if v_final is null then
      v_final := public._expert_step_text(p_payload->'value');
    end if;
    v_unit := nullif(trim(coalesce(p_payload->>'unit', '')), '');
    if v_final is not null then
      v_lines := array_append(
        v_lines,
        'Final answer: ' || public._expert_pretty_number(v_final)
          || case when v_unit is not null then ' ' || v_unit else '' end
      );
    end if;

    if cardinality(v_lines) > 0 then
      return left(array_to_string(v_lines, E'\n'), 800);
    end if;
  end if;

  if v_type = 'mcq' or (p_payload ? 'answer' and v_type is distinct from 'numeric') then
    if nullif(trim(coalesce(p_payload->>'answer', '')), '') is not null then
      return left('Selected: ' || trim(p_payload->>'answer'), 800);
    end if;
  end if;

  if v_type in ('short_text', 'extended_response') or p_payload ? 'text' then
    if nullif(trim(coalesce(p_payload->>'text', '')), '') is not null then
      return left(trim(p_payload->>'text'), 800);
    end if;
  end if;

  if v_type in ('chemistry', 'circuit', 'equipment') then
    v_lines := array[initcap(replace(coalesce(v_type, 'interactive'), '_', ' '))];
    if nullif(trim(coalesce(p_payload->>'kind', '')), '') is not null then
      v_lines := array_append(v_lines, 'Kind: ' || replace(p_payload->>'kind', '_', ' '));
    end if;
    if nullif(trim(coalesce(p_payload->>'selectedType', p_payload->>'selectedId', '')), '') is not null then
      v_lines := array_append(
        v_lines,
        'Selected: ' || coalesce(p_payload->>'selectedType', p_payload->>'selectedId')
      );
    end if;
    return left(array_to_string(v_lines, E'\n'), 800);
  end if;

  if p_payload ? 'selected' then
    return left(coalesce(p_payload->>'selected', ''), 800);
  end if;

  return left(p_payload::text, 800);
end;
$$;

-- ---------------------------------------------------------------------------
-- Student feedback (does not reopen the expert thread)
-- ---------------------------------------------------------------------------
create or replace function public.set_expert_query_feedback(
  p_id uuid,
  p_feedback text
)
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

  if p_feedback is null or p_feedback not in ('understood', 'still_confused') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_feedback');
  end if;

  update public.expert_queries
  set
    student_feedback = p_feedback,
    student_feedback_at = timezone('utc', now()),
    student_seen_at = coalesce(student_seen_at, timezone('utc', now()))
  where id = p_id
    and user_id = v_uid
    and status = 'replied'
  returning * into v_row;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'status', v_row.status,
    'student_feedback', v_row.student_feedback,
    'student_feedback_at', v_row.student_feedback_at,
    'student_seen_at', v_row.student_seen_at,
    'archived_at', v_row.archived_at
  );
end;
$$;

grant execute on function public.set_expert_query_feedback(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Archive / unarchive (student inbox only; admin status unchanged)
-- ---------------------------------------------------------------------------
create or replace function public.set_expert_query_archived(
  p_id uuid,
  p_archived boolean
)
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

  if p_archived is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_archived');
  end if;

  select * into v_row
  from public.expert_queries
  where id = p_id and user_id = v_uid;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_row.status not in ('replied', 'dismissed') then
    return jsonb_build_object('ok', false, 'reason', 'not_ready');
  end if;

  if p_archived and v_row.status = 'replied' and v_row.student_seen_at is null then
    return jsonb_build_object('ok', false, 'reason', 'not_seen');
  end if;

  update public.expert_queries
  set archived_at = case
    when p_archived then coalesce(archived_at, timezone('utc', now()))
    else null
  end
  where id = p_id and user_id = v_uid
  returning * into v_row;

  return jsonb_build_object(
    'ok', true,
    'id', v_row.id,
    'status', v_row.status,
    'student_feedback', v_row.student_feedback,
    'student_seen_at', v_row.student_seen_at,
    'archived_at', v_row.archived_at
  );
end;
$$;

grant execute on function public.set_expert_query_archived(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Developer list includes student feedback so the inbox can show it
-- ---------------------------------------------------------------------------
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
      'student_feedback', eq.student_feedback,
      'student_feedback_at', eq.student_feedback_at,
      'archived_at', eq.archived_at,
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
