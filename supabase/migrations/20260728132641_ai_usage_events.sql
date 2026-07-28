-- Per-user Gemini token usage for cost monitoring (marking + question generation).
-- Edge functions insert via service role; not returned to student clients.

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null
    check (feature in ('mark_long_answer', 'generate_questions')),
  model text,
  request_id text,
  question_id uuid references public.questions (id) on delete set null,
  prompt_token_count integer,
  candidates_token_count integer,
  total_token_count integer,
  finish_reason text,
  usage_meta jsonb,
  status text not null default 'success'
    check (status in ('success', 'error')),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists ai_usage_events_user_id_created_at_idx
  on public.ai_usage_events (user_id, created_at desc);

create index if not exists ai_usage_events_feature_created_at_idx
  on public.ai_usage_events (feature, created_at desc);

create index if not exists ai_usage_events_created_at_idx
  on public.ai_usage_events (created_at desc);

alter table public.ai_usage_events enable row level security;

-- Developers can audit all usage for cost monitoring.
drop policy if exists ai_usage_events_developer_select on public.ai_usage_events;
create policy ai_usage_events_developer_select on public.ai_usage_events
  for select to authenticated
  using (public.is_developer());

-- Users can see their own usage (read-only).
drop policy if exists ai_usage_events_select_own on public.ai_usage_events;
create policy ai_usage_events_select_own on public.ai_usage_events
  for select to authenticated
  using (user_id = auth.uid());

-- No client inserts/updates — edge functions write with the service role.

comment on table public.ai_usage_events is
  'Gemini token usage per user/request for AI cost monitoring. Written by edge functions; not exposed in student mark responses.';
