-- =============================================================================
-- APPLY IN SUPABASE SQL EDITOR (Dashboard → SQL → New query → Run)
-- Project: cbycwfhczyvzzhthpgsw
--
-- Remote check (2026-06-13): insert_srs_seed_rows RPC returns 404 — NOT deployed.
-- seed_initial_srs appears present. This script applies the missing RLS + RPC.
-- Safe to re-run (idempotent drops + create or replace).
-- =============================================================================

-- From: supabase/migrations/20250612_srs_state_rls_and_seed_rpc.sql

alter table srs_state enable row level security;

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

drop policy if exists srs_state_teacher_read on srs_state;
create policy srs_state_teacher_read on srs_state
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from profiles p
      join classes c on c.id = p.class_id
      where p.user_id = srs_state.user_id
        and c.teacher_id = auth.uid()
    )
  );

create or replace function public.insert_srs_seed_rows(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row jsonb;
  v_inserted int := 0;
  v_spec_point_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return jsonb_build_object('inserted', 0, 'reason', 'empty_payload');
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) as t(value)
  loop
    v_spec_point_id := (v_row->>'spec_point_id')::uuid;

    if exists (
      select 1 from srs_state s
      where s.user_id = v_uid and s.spec_point_id = v_spec_point_id
    ) then
      continue;
    end if;

    insert into srs_state (
      user_id,
      spec_point_id,
      due_date,
      interval_days,
      ease_factor,
      repetitions,
      lapses,
      last_quality,
      practice_difficulty_offset,
      updated_at
    ) values (
      v_uid,
      v_spec_point_id,
      coalesce((v_row->>'due_date')::date, current_date),
      coalesce((v_row->>'interval_days')::int, 1),
      coalesce((v_row->>'ease_factor')::numeric, 2.5),
      coalesce((v_row->>'repetitions')::int, 0),
      coalesce((v_row->>'lapses')::int, 0),
      coalesce((v_row->>'last_quality')::int, 0),
      coalesce((v_row->>'practice_difficulty_offset')::int, 0),
      coalesce((v_row->>'updated_at')::timestamptz, now())
    );

    v_inserted := v_inserted + 1;
  end loop;

  return jsonb_build_object('inserted', v_inserted);
end;
$$;

grant execute on function public.insert_srs_seed_rows(jsonb) to authenticated;

-- From: supabase/migrations/20250612_profile_role_immutable_fix.sql
-- (fixes profile/streak update RLS if teacher_signup migration was applied)

create or replace function public.profiles_role_immutable()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role then
    raise exception 'profile role cannot be changed via client update';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_immutable on public.profiles;
create trigger profiles_role_immutable
  before update on public.profiles
  for each row execute function public.profiles_role_immutable();

drop policy if exists profiles_update_own on profiles;
create policy profiles_update_own on profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Verify (should show insert_srs_seed_rows + three srs_state_*_own policies):
-- Run supabase/diagnostics/rls_troubleshooting.sql sections B and C.
