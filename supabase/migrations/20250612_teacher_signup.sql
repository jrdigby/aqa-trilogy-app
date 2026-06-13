-- Teacher sign-up: role from auth metadata at registration; block self role elevation on update.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
begin
  if v_role not in ('student', 'teacher') then
    v_role := 'student';
  end if;

  insert into public.profiles (user_id, preferred_tier, subscription_tier, role)
  values (new.id, 'FT', 'free', v_role)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Prevent self-promotion to teacher/developer via profile update (RLS-safe trigger).
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
