drop function if exists public.developer_ai_usage_summary_range(date, date);

create function public.developer_ai_usage_summary_range(
  p_start_date date default null,
  p_end_date date default null
)
returns table (
  user_id uuid,
  display_name text,
  feature text,
  model text,
  calls bigint,
  input_tokens bigint,
  output_tokens bigint,
  total_tokens bigint,
  last_used_at timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_start_date date := coalesce(p_start_date, current_date - 29);
  v_end_date date := coalesce(p_end_date, current_date);
begin
  if not public.is_developer() then
    raise exception 'Developer role required';
  end if;

  if v_end_date < v_start_date then
    raise exception 'End date must be on or after start date';
  end if;

  return query
  select
    e.user_id,
    coalesce(nullif(trim(p.display_name), ''), 'Unknown user') as display_name,
    e.feature,
    coalesce(nullif(trim(e.model), ''), 'unknown') as model,
    count(*)::bigint as calls,
    coalesce(sum(e.prompt_token_count), 0)::bigint as input_tokens,
    coalesce(sum(e.candidates_token_count), 0)::bigint as output_tokens,
    coalesce(sum(e.total_token_count), 0)::bigint as total_tokens,
    max(e.created_at) as last_used_at
  from public.ai_usage_events e
  left join public.profiles p on p.user_id = e.user_id
  where e.created_at >= v_start_date::timestamptz
    and e.created_at < (v_end_date + 1)::timestamptz
  group by
    e.user_id,
    coalesce(nullif(trim(p.display_name), ''), 'Unknown user'),
    e.feature,
    coalesce(nullif(trim(e.model), ''), 'unknown')
  order by
    coalesce(nullif(trim(p.display_name), ''), 'Unknown user'),
    total_tokens desc,
    calls desc,
    last_used_at desc;
end;
$$;

grant execute on function public.developer_ai_usage_summary_range(date, date) to authenticated;
