-- Fix signup 500: profiles_preferred_tier_check violated on new user insert.
-- Run in Supabase SQL Editor if signup fails with SQLSTATE 23514.

-- Allow FT/HT (app) and legacy foundation/higher values
alter table profiles drop constraint if exists profiles_preferred_tier_check;
alter table profiles
  add constraint profiles_preferred_tier_check
  check (preferred_tier in ('FT', 'HT', 'foundation', 'higher'));

alter table profiles
  alter column preferred_tier set default 'FT';

-- Recreate signup trigger with explicit preferred_tier
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, preferred_tier, subscription_tier, role)
  values (new.id, 'FT', 'free', 'student')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
