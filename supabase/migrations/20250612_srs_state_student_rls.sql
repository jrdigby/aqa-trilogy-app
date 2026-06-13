-- Student access to own srs_state (read / insert / update).
-- Run if dashboard shows "Nothing due" but seeding should have run.

drop policy if exists srs_state_select_own on srs_state;
create policy srs_state_select_own on srs_state
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists srs_state_insert_own on srs_state;
create policy srs_state_insert_own on srs_state
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists srs_state_update_own on srs_state;
create policy srs_state_update_own on srs_state
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
