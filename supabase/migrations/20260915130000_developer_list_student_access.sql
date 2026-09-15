-- Developer Pilot Pro: list students with access status + bulk tier updates

create or replace function public.developer_list_student_access()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_rows jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select role into v_caller_role from profiles where user_id = auth.uid();
  if v_caller_role <> 'developer' then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  select coalesce(jsonb_agg(row_data order by lower(row_data->>'email')), '[]'::jsonb)
  into v_rows
  from (
    select jsonb_build_object(
      'user_id', p.user_id,
      'email', u.email,
      'display_name', p.display_name,
      'subscription_tier', coalesce(p.subscription_tier, 'free'),
      'trial_ends_at', p.trial_ends_at,
      'access_status', case
        when coalesce(p.subscription_tier, 'free') = 'paid' then 'pro'
        when p.trial_ends_at is not null and p.trial_ends_at > now() then 'trial'
        else 'locked'
      end,
      'trial_days_left', case
        when p.trial_ends_at is not null and p.trial_ends_at > now()
          then greatest(0, ceil(extract(epoch from (p.trial_ends_at - now())) / 86400.0)::int)
        else 0
      end
    ) as row_data
    from profiles p
    join auth.users u on u.id = p.user_id
    where p.role = 'student'
  ) s;

  return jsonb_build_object('ok', true, 'students', v_rows);
end;
$$;

grant execute on function public.developer_list_student_access() to authenticated;

create or replace function public.developer_set_subscription_bulk(
  p_user_ids uuid[],
  p_tier text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_updated int := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select role into v_caller_role from profiles where user_id = auth.uid();
  if v_caller_role <> 'developer' then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if p_tier not in ('free', 'paid') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_tier');
  end if;

  if p_user_ids is null or cardinality(p_user_ids) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'no_users');
  end if;

  update profiles
  set subscription_tier = p_tier
  where user_id = any(p_user_ids)
    and role = 'student';

  get diagnostics v_updated = row_count;

  return jsonb_build_object(
    'ok', true,
    'subscription_tier', p_tier,
    'updated', v_updated
  );
end;
$$;

grant execute on function public.developer_set_subscription_bulk(uuid[], text) to authenticated;
