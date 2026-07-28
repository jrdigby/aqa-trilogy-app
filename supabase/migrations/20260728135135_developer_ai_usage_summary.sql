create or replace function public.developer_ai_usage_summary(p_days integer default 30)
returns table (
  user_id uuid,
  display_name text,
  feature text,
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
  v_days integer := greatest(coalesce(p_days, 30), 1);
begin
  if not public.is_developer() then
    raise exception 'Developer role required';
  end if;

  return query
  select
    e.user_id,
    coalesce(nullif(trim(p.display_name), ''), 'Unknown user') as display_name,
    e.feature,
    count(*)::bigint as calls,
    coalesce(sum(e.prompt_token_count), 0)::bigint as input_tokens,
    coalesce(sum(e.candidates_token_count), 0)::bigint as output_tokens,
    coalesce(sum(e.total_token_count), 0)::bigint as total_tokens,
    max(e.created_at) as last_used_at
  from public.ai_usage_events e
  left join public.profiles p on p.user_id = e.user_id
  where e.created_at >= now() - make_interval(days => v_days)
  group by e.user_id, coalesce(nullif(trim(p.display_name), ''), 'Unknown user'), e.feature
  order by total_tokens desc, calls desc, last_used_at desc;
end;
$$;

grant execute on function public.developer_ai_usage_summary(integer) to authenticated;
