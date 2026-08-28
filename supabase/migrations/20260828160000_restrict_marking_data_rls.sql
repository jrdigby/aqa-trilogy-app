-- Restrict answer_keys and mark_points reads to developers only.
-- Student marking goes through the mark-response edge function (service role).

drop policy if exists answer_keys_authenticated_select on public.answer_keys;
drop policy if exists mark_points_authenticated_select on public.mark_points;

create policy answer_keys_developer_select on public.answer_keys
  for select
  to authenticated
  using (public.is_developer());

create policy mark_points_developer_select on public.mark_points
  for select
  to authenticated
  using (public.is_developer());
