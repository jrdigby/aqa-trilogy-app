-- Reliable provenance write path for developers (avoids RLS RETURNING edge cases)

create or replace function public.record_question_ingestion(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_question_id uuid;
  v_source text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_developer() then
    raise exception 'developer role required';
  end if;

  v_question_id := nullif(p_payload->>'published_question_id', '')::uuid;
  v_source := p_payload->>'source';

  if v_question_id is null then
    raise exception 'published_question_id is required';
  end if;

  if v_source is null or v_source = '' then
    raise exception 'source is required';
  end if;

  insert into public.generation_logs (
    actor_user_id,
    source,
    model,
    request_id,
    prompt_text,
    prompt_hash,
    raw_response,
    response_hash,
    parsed_output,
    input_meta,
    usage_meta,
    status,
    error_message,
    published_question_id,
    human_edited
  ) values (
    auth.uid(),
    v_source,
    nullif(p_payload->>'model', ''),
    nullif(p_payload->>'request_id', ''),
    p_payload->>'prompt_text',
    nullif(p_payload->>'prompt_hash', ''),
    p_payload->>'raw_response',
    nullif(p_payload->>'response_hash', ''),
    coalesce(p_payload->'parsed_output', 'null'::jsonb),
    coalesce(p_payload->'input_meta', '{}'::jsonb),
    p_payload->'usage_meta',
    coalesce(nullif(p_payload->>'status', ''), 'success'),
    nullif(p_payload->>'error_message', ''),
    v_question_id,
    coalesce((p_payload->>'human_edited')::boolean, false)
  )
  returning id into v_id;

  update public.questions
  set source_generation_log_id = v_id
  where id = v_question_id;

  return v_id;
end;
$$;

grant execute on function public.record_question_ingestion(jsonb) to authenticated;

comment on function public.record_question_ingestion(jsonb) is
  'Developer-only: insert generation_logs row and link questions.source_generation_log_id';
