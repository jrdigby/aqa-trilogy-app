-- Free vs Pro feature gates: AI weekly quota, monthly half-paper quota, billing columns

-- ---------------------------------------------------------------------------
-- Usage tracking
-- ---------------------------------------------------------------------------
create table if not exists weekly_ai_usage (
  user_id uuid not null references profiles(user_id) on delete cascade,
  week_start date not null,
  ai_marks_used int not null default 0,
  primary key (user_id, week_start)
);

create table if not exists monthly_paper_usage (
  user_id uuid not null references profiles(user_id) on delete cascade,
  month_start date not null,
  half_papers_used int not null default 0,
  primary key (user_id, month_start)
);

alter table weekly_ai_usage enable row level security;
alter table monthly_paper_usage enable row level security;

drop policy if exists weekly_ai_usage_select_own on weekly_ai_usage;
create policy weekly_ai_usage_select_own on weekly_ai_usage
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists monthly_paper_usage_select_own on monthly_paper_usage;
create policy monthly_paper_usage_select_own on monthly_paper_usage
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Billing columns (Stripe later; manual override works now)
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists stripe_customer_id text;
alter table profiles add column if not exists stripe_subscription_id text;
alter table profiles add column if not exists subscription_status text default 'none';

alter table profiles drop constraint if exists profiles_subscription_status_check;
alter table profiles
  add constraint profiles_subscription_status_check
  check (subscription_status in ('none', 'active', 'past_due', 'canceled'));

alter table classes add column if not exists is_paid boolean not null default false;
alter table classes add column if not exists paid_until timestamptz;
alter table classes add column if not exists stripe_subscription_id text;

-- ---------------------------------------------------------------------------
-- Helpers
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
  v_class_paid boolean;
  v_paid_until timestamptz;
begin
  if p_user_id is null then
    return false;
  end if;

  select p.subscription_tier, p.role, coalesce(c.is_paid, false), c.paid_until
  into v_tier, v_role, v_class_paid, v_paid_until
  from profiles p
  left join classes c on c.id = p.class_id
  where p.user_id = p_user_id;

  if v_role = 'developer' then
    return true;
  end if;

  if v_tier = 'paid' then
    return true;
  end if;

  if v_class_paid and (v_paid_until is null or v_paid_until > now()) then
    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.user_has_pro_access(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: current quotas for dashboard chip
-- ---------------------------------------------------------------------------
create or replace function public.get_plan_quotas()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_week date;
  v_month date;
  v_ai_used int := 0;
  v_half_used int := 0;
begin
  if v_uid is null then
    return jsonb_build_object('is_pro', false);
  end if;

  if public.user_has_pro_access(v_uid) then
    return jsonb_build_object('is_pro', true);
  end if;

  v_week := date_trunc('week', current_date)::date;
  v_month := date_trunc('month', current_date)::date;

  select coalesce(ai_marks_used, 0) into v_ai_used
  from weekly_ai_usage
  where user_id = v_uid and week_start = v_week;

  select coalesce(half_papers_used, 0) into v_half_used
  from monthly_paper_usage
  where user_id = v_uid and month_start = v_month;

  return jsonb_build_object(
    'is_pro', false,
    'ai_used', coalesce(v_ai_used, 0),
    'ai_limit', 3,
    'half_paper_used', coalesce(v_half_used, 0),
    'half_paper_limit', 1
  );
end;
$$;

grant execute on function public.get_plan_quotas() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: consume one AI long-answer mark (free tier)
-- ---------------------------------------------------------------------------
create or replace function public.try_consume_ai_mark()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_week date;
  v_used int;
  v_limit int := 3;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  end if;

  if public.user_has_pro_access(v_uid) then
    return jsonb_build_object('allowed', true, 'is_pro', true, 'used', 0, 'limit', null);
  end if;

  v_week := date_trunc('week', current_date)::date;

  insert into weekly_ai_usage (user_id, week_start, ai_marks_used)
  values (v_uid, v_week, 0)
  on conflict (user_id, week_start) do nothing;

  select ai_marks_used into v_used
  from weekly_ai_usage
  where user_id = v_uid and week_start = v_week;

  if v_used >= v_limit then
    return jsonb_build_object(
      'allowed', false,
      'is_pro', false,
      'used', v_used,
      'limit', v_limit,
      'reason', 'quota_exceeded'
    );
  end if;

  update weekly_ai_usage
  set ai_marks_used = ai_marks_used + 1
  where user_id = v_uid and week_start = v_week;

  return jsonb_build_object(
    'allowed', true,
    'is_pro', false,
    'used', v_used + 1,
    'limit', v_limit
  );
end;
$$;

grant execute on function public.try_consume_ai_mark() to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: consume one half-paper (35 marks) per calendar month on free tier
-- ---------------------------------------------------------------------------
create or replace function public.try_consume_half_paper()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_month date;
  v_used int;
  v_limit int := 1;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  end if;

  if public.user_has_pro_access(v_uid) then
    return jsonb_build_object('allowed', true, 'is_pro', true, 'used', 0, 'limit', null);
  end if;

  v_month := date_trunc('month', current_date)::date;

  insert into monthly_paper_usage (user_id, month_start, half_papers_used)
  values (v_uid, v_month, 0)
  on conflict (user_id, month_start) do nothing;

  select half_papers_used into v_used
  from monthly_paper_usage
  where user_id = v_uid and month_start = v_month;

  if v_used >= v_limit then
    return jsonb_build_object(
      'allowed', false,
      'is_pro', false,
      'used', v_used,
      'limit', v_limit,
      'reason', 'quota_exceeded'
    );
  end if;

  update monthly_paper_usage
  set half_papers_used = half_papers_used + 1
  where user_id = v_uid and month_start = v_month;

  return jsonb_build_object(
    'allowed', true,
    'is_pro', false,
    'used', v_used + 1,
    'limit', v_limit
  );
end;
$$;

grant execute on function public.try_consume_half_paper() to authenticated;

-- ---------------------------------------------------------------------------
-- join_class_by_code: grant Pro when class has active licence
-- ---------------------------------------------------------------------------
create or replace function public.join_class_by_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_class classes%rowtype;
  v_normalized text;
  v_grant_paid boolean := false;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_normalized := upper(trim(p_code));
  if length(v_normalized) < 4 then
    raise exception 'Invalid class code';
  end if;

  select * into v_class
  from classes
  where join_code = v_normalized;

  if not found then
    raise exception 'Invalid class code';
  end if;

  v_grant_paid := coalesce(v_class.is_paid, false)
    and (v_class.paid_until is null or v_class.paid_until > now());

  update profiles
  set
    class_id = v_class.id,
    subscription_tier = case when v_grant_paid then 'paid' else subscription_tier end
  where user_id = v_uid;

  return jsonb_build_object(
    'class_id', v_class.id,
    'class_name', v_class.name,
    'granted_pro', v_grant_paid
  );
end;
$$;
