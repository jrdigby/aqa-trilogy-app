-- 14-day full-access trial on student signup, then hard paywall (no freemium).
-- Admin Pilot Pro (subscription_tier = 'paid') and class licences still grant full access.

-- ---------------------------------------------------------------------------
-- Column
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists trial_ends_at timestamptz;

comment on column profiles.trial_ends_at is
  'End of free full-access trial. Null for teachers/developers or accounts without a trial.';

-- ---------------------------------------------------------------------------
-- Signup: students get 14-day trial
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
  v_display_name text := nullif(trim(new.raw_user_meta_data->>'display_name'), '');
  v_trial_ends timestamptz := null;
begin
  if v_role not in ('student', 'teacher') then
    v_role := 'student';
  end if;

  if v_role = 'student' then
    v_trial_ends := now() + interval '14 days';
  end if;

  insert into public.profiles (
    user_id,
    preferred_tier,
    subscription_tier,
    role,
    display_name,
    trial_ends_at
  )
  values (
    new.id,
    'FT',
    'free',
    v_role,
    v_display_name,
    v_trial_ends
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Access: developer | paid | class licence | active trial
-- ---------------------------------------------------------------------------
create or replace function public.user_has_pro_access(p_user_id uuid default auth.uid())
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_tier text;
  v_role text;
  v_trial_ends timestamptz;
  v_class_paid boolean;
  v_paid_until timestamptz;
begin
  if p_user_id is null then
    return false;
  end if;

  select
    p.subscription_tier,
    p.role,
    p.trial_ends_at,
    coalesce(c.is_paid, false),
    c.paid_until
  into v_tier, v_role, v_trial_ends, v_class_paid, v_paid_until
  from profiles p
  left join classes c on c.id = p.class_id
  where p.user_id = p_user_id;

  if not found then
    return false;
  end if;

  if v_role = 'developer' then
    return true;
  end if;

  if v_tier = 'paid' then
    return true;
  end if;

  if v_class_paid and (v_paid_until is null or v_paid_until > now()) then
    return true;
  end if;

  if v_trial_ends is not null and v_trial_ends > now() then
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.user_has_pro_access(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Quotas: Pro/trial = unlimited; otherwise locked (no freemium allowances)
-- ---------------------------------------------------------------------------
create or replace function public.get_plan_quotas()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('is_pro', false, 'has_access', false);
  end if;

  if public.user_has_pro_access(v_uid) then
    return jsonb_build_object('is_pro', true, 'has_access', true);
  end if;

  return jsonb_build_object(
    'is_pro', false,
    'has_access', false,
    'ai_used', 0,
    'ai_limit', 0,
    'half_paper_used', 0,
    'half_paper_limit', 0
  );
end;
$$;

grant execute on function public.get_plan_quotas() to authenticated;

create or replace function public.try_consume_ai_mark()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  end if;

  if public.user_has_pro_access(v_uid) then
    return jsonb_build_object('allowed', true, 'is_pro', true, 'used', 0, 'limit', null);
  end if;

  return jsonb_build_object(
    'allowed', false,
    'is_pro', false,
    'used', 0,
    'limit', 0,
    'reason', 'subscription_required'
  );
end;
$$;

grant execute on function public.try_consume_ai_mark() to authenticated;

create or replace function public.try_consume_half_paper()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  end if;

  if public.user_has_pro_access(v_uid) then
    return jsonb_build_object('allowed', true, 'is_pro', true, 'used', 0, 'limit', null);
  end if;

  return jsonb_build_object(
    'allowed', false,
    'is_pro', false,
    'used', 0,
    'limit', 0,
    'reason', 'subscription_required'
  );
end;
$$;

grant execute on function public.try_consume_half_paper() to authenticated;

-- ---------------------------------------------------------------------------
-- Backfill: trial window from auth signup time (profiles has no created_at)
-- ---------------------------------------------------------------------------
update public.profiles p
set trial_ends_at = coalesce(u.created_at, now()) + interval '14 days'
from auth.users u
where p.user_id = u.id
  and p.role = 'student'
  and coalesce(p.subscription_tier, 'free') <> 'paid'
  and p.trial_ends_at is null;
