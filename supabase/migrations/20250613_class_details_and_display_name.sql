-- Class details for enrolled students + display_name on profiles

alter table profiles add column if not exists display_name text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'student');
  v_display_name text := nullif(trim(new.raw_user_meta_data->>'display_name'), '');
begin
  if v_role not in ('student', 'teacher') then
    v_role := 'student';
  end if;

  insert into public.profiles (user_id, preferred_tier, subscription_tier, role, display_name)
  values (new.id, 'FT', 'free', v_role, v_display_name)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop policy if exists classes_student_select_enrolled on classes;

-- Security definer avoids infinite recursion: profiles_teacher_read_students
-- also selects from classes, which would re-enter profiles RLS if we queried profiles here.
create or replace function public.is_enrolled_in_class(p_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.class_id = p_class_id
  );
$$;

grant execute on function public.is_enrolled_in_class(uuid) to authenticated;

create policy classes_student_select_enrolled on classes
  for select to authenticated
  using (public.is_enrolled_in_class(id));
