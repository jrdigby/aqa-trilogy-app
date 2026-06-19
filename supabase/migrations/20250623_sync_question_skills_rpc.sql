-- Developer sync for question_skills (admin save bypasses client RLS issues)

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

drop policy if exists question_skills_developer_all on public.question_skills;
create policy question_skills_developer_all on public.question_skills
  for all to authenticated
  using (public.is_developer())
  with check (public.is_developer());

create or replace function public.sync_question_skills(
  p_question_id uuid,
  p_skill_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int := 0;
  v_skill_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if not public.is_developer() then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if p_question_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_question_id');
  end if;

  if not exists (select 1 from public.questions where id = p_question_id) then
    return jsonb_build_object('ok', false, 'reason', 'question_not_found');
  end if;

  delete from public.question_skills where question_id = p_question_id;

  if p_skill_ids is not null then
    foreach v_skill_id in array p_skill_ids
    loop
      if v_skill_id is null then
        continue;
      end if;
      if not exists (select 1 from public.skill_framework_items where id = v_skill_id) then
        return jsonb_build_object('ok', false, 'reason', 'invalid_skill_id', 'skill_id', v_skill_id);
      end if;
      insert into public.question_skills (question_id, skill_id)
      values (p_question_id, v_skill_id)
      on conflict do nothing;
      v_inserted := v_inserted + 1;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'inserted', v_inserted);
end;
$$;

grant execute on function public.sync_question_skills(uuid, uuid[]) to authenticated;
