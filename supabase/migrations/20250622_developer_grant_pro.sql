-- Developer-only manual Pro override for pilot schools (before Stripe Phase 3)

create or replace function public.developer_set_subscription_by_email(p_email text, p_tier text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text;
  v_user_id uuid;
  v_display_name text;
  v_old_tier text;
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

  select u.id, p.display_name, p.subscription_tier
  into v_user_id, v_display_name, v_old_tier
  from auth.users u
  join profiles p on p.user_id = u.id
  where lower(u.email) = lower(trim(p_email));

  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'user_not_found');
  end if;

  update profiles
  set subscription_tier = p_tier
  where user_id = v_user_id;

  return jsonb_build_object(
    'ok', true,
    'user_id', v_user_id,
    'display_name', v_display_name,
    'subscription_tier', p_tier,
    'previous_tier', v_old_tier
  );
end;
$$;

grant execute on function public.developer_set_subscription_by_email(text, text) to authenticated;
