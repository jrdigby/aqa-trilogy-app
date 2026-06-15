-- XP gamification + progressive practice hints on questions

alter table profiles add column if not exists total_xp integer not null default 0;

alter table attempts add column if not exists xp_earned integer not null default 0;
alter table attempts add column if not exists hints_revealed smallint not null default 0;

alter table questions add column if not exists hints jsonb;
comment on column questions.hints is 'Ordered progressive hint strings; revealed one at a time in practice UI';

create or replace function public.increment_user_xp(p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new integer;
begin
  if auth.uid() is null or p_amount <= 0 then
    return 0;
  end if;

  update profiles
  set total_xp = total_xp + p_amount
  where user_id = auth.uid()
  returning total_xp into v_new;

  return coalesce(v_new, 0);
end;
$$;

grant execute on function public.increment_user_xp(integer) to authenticated;
