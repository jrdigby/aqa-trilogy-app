-- Weekly progress email prefs + send log + report RPC

-- ---------------------------------------------------------------------------
-- profiles: explicit notification columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists weekly_report_enabled boolean not null default false;

alter table public.profiles
  add column if not exists parent_email text;

alter table public.profiles
  add column if not exists parent_email_enabled boolean not null default false;

alter table public.profiles
  add column if not exists weekly_report_unsubscribed_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_parent_email_format_check;

alter table public.profiles
  add constraint profiles_parent_email_format_check
  check (
    parent_email is null
    or parent_email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'
  );

comment on column public.profiles.weekly_report_enabled is
  'Opt-in: send weekly progress digest to the student account email';
comment on column public.profiles.parent_email is
  'Optional parent/guardian email for a Cc copy of the weekly digest';
comment on column public.profiles.parent_email_enabled is
  'When true and parent_email is set, weekly digest is Cc''d to parent';
comment on column public.profiles.weekly_report_unsubscribed_at is
  'Hard stop timestamp; when set, digests are skipped even if enabled';

-- ---------------------------------------------------------------------------
-- weekly_report_sends: idempotent send log
-- ---------------------------------------------------------------------------
create table if not exists public.weekly_report_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  sent_at timestamptz not null default now(),
  status text not null,
  error text,
  recipient_student text,
  recipient_parent text,
  payload_summary jsonb not null default '{}'::jsonb,
  constraint weekly_report_sends_status_check
    check (status in ('sent', 'dry_run', 'failed', 'skipped')),
  constraint weekly_report_sends_user_week_unique unique (user_id, week_start)
);

create index if not exists weekly_report_sends_week_start_idx
  on public.weekly_report_sends (week_start desc);

create index if not exists weekly_report_sends_user_id_idx
  on public.weekly_report_sends (user_id);

alter table public.weekly_report_sends enable row level security;

grant select on public.weekly_report_sends to authenticated;

drop policy if exists weekly_report_sends_select_own on public.weekly_report_sends;
create policy weekly_report_sends_select_own on public.weekly_report_sends
  for select
  to authenticated
  using (user_id = auth.uid());

-- Writes are service_role / edge function only (no insert/update policies for authenticated)

comment on table public.weekly_report_sends is
  'Log of weekly progress digest sends; unique per user/week for cron idempotency';

-- ---------------------------------------------------------------------------
-- build_weekly_progress_report: JSON payload for digest
-- ---------------------------------------------------------------------------
create or replace function public.build_weekly_progress_report(
  p_user_id uuid,
  p_as_of date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_as_of date := coalesce(p_as_of, (timezone('Europe/London', now()))::date);
  v_week_ago date := v_as_of - 7;
  v_week_end date := v_as_of + 6;
  v_streak integer := 0;
  v_total_xp integer := 0;
  v_display_name text;
  v_overdue_count integer := 0;
  v_due_today integer := 0;
  v_practised_last_week boolean := false;
  v_pace text;
  v_covered jsonb := '[]'::jsonb;
  v_coming_new jsonb := '[]'::jsonb;
  v_coming_review jsonb := '[]'::jsonb;
  v_overdue_topics jsonb := '[]'::jsonb;
  v_profile_found boolean := false;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  -- Authenticated callers may only read their own report; service_role has auth.uid() null
  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'not authorized';
  end if;

  select
    true,
    coalesce(p.current_streak, 0),
    coalesce(p.total_xp, 0),
    p.display_name
  into v_profile_found, v_streak, v_total_xp, v_display_name
  from public.profiles p
  where p.user_id = p_user_id;

  if not coalesce(v_profile_found, false) then
    return jsonb_build_object(
      'as_of', v_as_of,
      'pace', 'on_track',
      'overdue_count', 0,
      'due_today', 0,
      'streak', 0,
      'total_xp', 0,
      'display_name', null,
      'covered', '[]'::jsonb,
      'coming_new', '[]'::jsonb,
      'coming_review', '[]'::jsonb,
      'overdue_topics', '[]'::jsonb
    );
  end if;

  select count(*)::integer
  into v_overdue_count
  from public.srs_state s
  where s.user_id = p_user_id
    and s.due_date is not null
    and s.due_date < v_as_of;

  select count(*)::integer
  into v_due_today
  from public.srs_state s
  where s.user_id = p_user_id
    and s.due_date is not null
    and s.due_date = v_as_of;

  select exists (
    select 1
    from public.attempts a
    where a.user_id = p_user_id
      and a.submitted_at >= v_week_ago::timestamptz
      and a.submitted_at < v_as_of::timestamptz
  )
  into v_practised_last_week;

  if v_overdue_count > 0 then
    v_pace := 'behind';
  elsif v_due_today = 0 then
    v_pace := 'ahead';
  else
    v_pace := 'on_track';
  end if;

  select coalesce(
    (
      select jsonb_agg(to_jsonb(t) order by t.pct desc nulls last, t.topic)
      from (
        select
          coalesce(sp.topic_name, sp.spec_ref, 'Topic') as topic,
          sp.subject,
          sp.spec_ref,
          count(*)::integer as attempts,
          case
            when sum(coalesce(a.score_max, 0)) > 0
              then (round(100.0 * sum(coalesce(a.score_total, 0)) / sum(a.score_max)))::integer
            else null
          end as pct
        from public.attempts a
        join public.questions q on q.id = a.question_id
        left join public.spec_points sp on sp.id = q.spec_point_id
        where a.user_id = p_user_id
          and a.submitted_at >= v_week_ago::timestamptz
          and a.submitted_at < v_as_of::timestamptz
        group by sp.id, sp.topic_name, sp.spec_ref, sp.subject
      ) t
    ),
    '[]'::jsonb
  )
  into v_covered;

  select coalesce(
    (
      select jsonb_agg(to_jsonb(t) order by t.due_date, t.topic)
      from (
        select
          coalesce(sp.topic_name, sp.spec_ref, 'Topic') as topic,
          sp.subject,
          sp.spec_ref,
          s.due_date as due_date
        from public.srs_state s
        left join public.spec_points sp on sp.id = s.spec_point_id
        where s.user_id = p_user_id
          and s.due_date is not null
          and s.due_date >= v_as_of
          and s.due_date <= v_week_end
          and coalesce(s.repetitions, 0) = 0
      ) t
    ),
    '[]'::jsonb
  )
  into v_coming_new;

  select coalesce(
    (
      select jsonb_agg(to_jsonb(t) order by t.due_date, t.topic)
      from (
        select
          coalesce(sp.topic_name, sp.spec_ref, 'Topic') as topic,
          sp.subject,
          sp.spec_ref,
          s.due_date as due_date
        from public.srs_state s
        left join public.spec_points sp on sp.id = s.spec_point_id
        where s.user_id = p_user_id
          and s.due_date is not null
          and s.due_date >= v_as_of
          and s.due_date <= v_week_end
          and coalesce(s.repetitions, 0) > 0
      ) t
    ),
    '[]'::jsonb
  )
  into v_coming_review;

  select coalesce(
    (
      select jsonb_agg(to_jsonb(t) order by t.due_date, t.topic)
      from (
        select
          coalesce(sp.topic_name, sp.spec_ref, 'Topic') as topic,
          sp.subject,
          sp.spec_ref,
          s.due_date as due_date
        from public.srs_state s
        left join public.spec_points sp on sp.id = s.spec_point_id
        where s.user_id = p_user_id
          and s.due_date is not null
          and s.due_date < v_as_of
        order by s.due_date
        limit 20
      ) t
    ),
    '[]'::jsonb
  )
  into v_overdue_topics;

  return jsonb_build_object(
    'as_of', v_as_of,
    'week_start', v_week_ago,
    'week_end', v_week_end,
    'pace', v_pace,
    'overdue_count', v_overdue_count,
    'due_today', v_due_today,
    'practised_last_week', v_practised_last_week,
    'streak', v_streak,
    'total_xp', v_total_xp,
    'display_name', v_display_name,
    'covered', coalesce(v_covered, '[]'::jsonb),
    'coming_new', coalesce(v_coming_new, '[]'::jsonb),
    'coming_review', coalesce(v_coming_review, '[]'::jsonb),
    'overdue_topics', coalesce(v_overdue_topics, '[]'::jsonb)
  );
end;
$fn$;

grant execute on function public.build_weekly_progress_report(uuid, date) to authenticated;
grant execute on function public.build_weekly_progress_report(uuid, date) to service_role;

comment on function public.build_weekly_progress_report(uuid, date) is
  'Builds weekly progress digest JSON: last-week coverage, pace, coming new/review topics';
