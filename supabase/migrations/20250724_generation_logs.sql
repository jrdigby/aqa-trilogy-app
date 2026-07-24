-- Provenance logs for questions entering the bank (Studio, import, numeric, manual, CSV).
-- Not used for student marking.

create table if not exists public.generation_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid references auth.users (id) on delete set null default auth.uid(),
  source text not null
    check (source in (
      'ai_studio',
      'ai_studio_import',
      'batch_numeric',
      'manual_create',
      'csv_import'
    )),
  model text,
  request_id text,
  prompt_text text,
  prompt_hash text,
  raw_response text,
  response_hash text,
  parsed_output jsonb,
  input_meta jsonb not null default '{}'::jsonb,
  usage_meta jsonb,
  status text not null default 'success'
    check (status in ('success', 'partial', 'error')),
  error_message text,
  published_question_id uuid references public.questions (id) on delete set null,
  human_edited boolean not null default false
);

create index if not exists generation_logs_created_at_idx
  on public.generation_logs (created_at desc);
create index if not exists generation_logs_source_idx
  on public.generation_logs (source);
create index if not exists generation_logs_published_question_id_idx
  on public.generation_logs (published_question_id);
create index if not exists generation_logs_actor_user_id_idx
  on public.generation_logs (actor_user_id);

alter table public.questions
  add column if not exists source_generation_log_id uuid
    references public.generation_logs (id) on delete set null;

create index if not exists questions_source_generation_log_id_idx
  on public.questions (source_generation_log_id);

alter table public.generation_logs enable row level security;

drop policy if exists generation_logs_developer_select on public.generation_logs;
create policy generation_logs_developer_select on public.generation_logs
  for select to authenticated
  using (public.is_developer());

drop policy if exists generation_logs_developer_insert on public.generation_logs;
create policy generation_logs_developer_insert on public.generation_logs
  for insert to authenticated
  with check (public.is_developer());

-- Developers may link a log to a published question after insert.
drop policy if exists generation_logs_developer_update on public.generation_logs;
create policy generation_logs_developer_update on public.generation_logs
  for update to authenticated
  using (public.is_developer())
  with check (public.is_developer());

comment on table public.generation_logs is
  'Provenance for questions committed from AI Studio, JSON import, numeric batch, manual create, or CSV import.';
comment on column public.questions.source_generation_log_id is
  'generation_logs row that produced this question (if committed via a logged path).';
