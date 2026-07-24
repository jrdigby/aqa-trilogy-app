-- Lock question bank content: authenticated read, developer-only writes.
-- Removes anon/public open-read and broad authenticated insert/admin policies.

-- Ensure helper exists (idempotent with 20250623_sync_question_skills_rpc.sql)
create or replace function public.is_developer()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'developer'
  );
$$;

grant execute on function public.is_developer() to authenticated;

-- ---------------------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can do everything on questions" on public.questions;
drop policy if exists "Allow authenticated users to insert questions" on public.questions;
drop policy if exists "Allow public read access to questions" on public.questions;
drop policy if exists questions_read_all on public.questions;
drop policy if exists questions_authenticated_select on public.questions;
drop policy if exists questions_developer_write on public.questions;

create policy questions_authenticated_select on public.questions
  for select
  to authenticated
  using (true);

create policy questions_developer_write on public.questions
  for all
  to authenticated
  using (public.is_developer())
  with check (public.is_developer());

revoke all on table public.questions from anon;
grant select on table public.questions to authenticated;
grant insert, update, delete on table public.questions to authenticated;

-- ---------------------------------------------------------------------------
-- answer_keys
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can do everything on answer_keys" on public.answer_keys;
drop policy if exists "Allow authenticated users to insert keys" on public.answer_keys;
drop policy if exists "Allow public read access to answer_keys" on public.answer_keys;
drop policy if exists answer_keys_read_all on public.answer_keys;
drop policy if exists answer_keys_authenticated_select on public.answer_keys;
drop policy if exists answer_keys_developer_write on public.answer_keys;

create policy answer_keys_authenticated_select on public.answer_keys
  for select
  to authenticated
  using (true);

create policy answer_keys_developer_write on public.answer_keys
  for all
  to authenticated
  using (public.is_developer())
  with check (public.is_developer());

revoke all on table public.answer_keys from anon;
grant select on table public.answer_keys to authenticated;
grant insert, update, delete on table public.answer_keys to authenticated;

-- ---------------------------------------------------------------------------
-- mark_points
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can do everything on mark_points" on public.mark_points;
drop policy if exists "Allow authenticated users to insert mark points" on public.mark_points;
drop policy if exists "Allow public read access to mark_points" on public.mark_points;
drop policy if exists mark_points_authenticated_select on public.mark_points;
drop policy if exists mark_points_developer_write on public.mark_points;

create policy mark_points_authenticated_select on public.mark_points
  for select
  to authenticated
  using (true);

create policy mark_points_developer_write on public.mark_points
  for all
  to authenticated
  using (public.is_developer())
  with check (public.is_developer());

revoke all on table public.mark_points from anon;
grant select on table public.mark_points to authenticated;
grant insert, update, delete on table public.mark_points to authenticated;
