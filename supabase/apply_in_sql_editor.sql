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

-- From: supabase/migrations/20250613_class_details_and_display_name.sql

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

-- Free vs Pro gates — run full script: supabase/migrations/20250617_free_pro_gates.sql
-- (weekly_ai_usage, monthly_paper_usage, get_plan_quotas, try_consume_ai_mark, try_consume_half_paper)
-- Pilot Pro override — run: supabase/migrations/20250622_developer_grant_pro.sql

-- WS exam examples — From: supabase/migrations/20250620_ws_skill_descriptions.sql

update skill_framework_items
set description = 'Examples:
• Give examples to show how scientific methods and theories have changed over time.
• Explain, with an example, why new data from experiments or observations led to changes in models or theories.
• Decide whether or not given data supports a particular theory.'
where framework = 'WS' and full_code = 'WS1.1';

update skill_framework_items
set description = 'Examples:
• Recognise/draw/interpret diagrams.
• Translate from data to a representation with a model.
• Use models in explanations, or match features of a model to the data from experiments or observations that the model describes or explains.
• Make predictions or calculate quantities based on the model or show its limitations.
• Give examples of ways in which a model can be tested by observation or experiment.'
where framework = 'WS' and full_code = 'WS1.2';

update skill_framework_items
set description = 'Examples:
• Explain why data is needed to answer scientific questions, and why it may be uncertain, incomplete or not available.
• Outline a simple ethical argument about the rights and wrongs of a new technology.'
where framework = 'WS' and full_code = 'WS1.3';

update skill_framework_items
set description = 'Examples:
• Describe and explain specified examples of the technological applications of science.
• Describe and evaluate, with the help of data, methods that can be used to tackle problems caused by human impacts on the environment.'
where framework = 'WS' and full_code = 'WS1.4';

update skill_framework_items
set description = 'Examples:
• Give examples to show that there are hazards associated with science-based technologies which have to be considered alongside the benefits.
• Suggest reasons why the perception of risk is often very different from the measured risk (eg voluntary vs imposed risks, familiar vs unfamiliar risks, visible vs invisible hazards).'
where framework = 'WS' and full_code = 'WS1.5';

update skill_framework_items
set description = 'Examples:
• Explain that the process of peer review helps to detect false claims and to establish a consensus about which claims should be regarded as valid.
• Explain that reports of scientific developments in the popular media are not subject to peer review and may be oversimplified, inaccurate or biased.'
where framework = 'WS' and full_code = 'WS1.6';

update skill_framework_items
set description = 'Examples:
• Suggest a hypothesis to explain given observations or data.'
where framework = 'WS' and full_code = 'WS2.1';

update skill_framework_items
set description = 'Examples:
• Describe a practical procedure for a specified purpose.
• Explain why a given practical procedure is well designed for its specified purpose.
• Explain the need to manipulate and control variables.
• Identify in a given context: the independent variable as the one that is changed or selected by the investigator; the dependent variable that is measured for each change in the independent variable; control variables and be able to explain why they are kept the same.
• Apply understanding of apparatus and techniques to suggest a procedure for a specified purpose.'
where framework = 'WS' and full_code = 'WS2.2';

update skill_framework_items
set description = 'Examples:
• Describe/suggest/select the technique, instrument, apparatus or material that should be used for a particular purpose, and explain why.'
where framework = 'WS' and full_code = 'WS2.3';

update skill_framework_items
set description = 'Examples:
• Identify the main hazards in specified practical contexts.
• Suggest methods of reducing the risk of harm in practical contexts.'
where framework = 'WS' and full_code = 'WS2.4';

update skill_framework_items
set description = 'Examples:
• Suggest and describe an appropriate sampling technique in a given context.'
where framework = 'WS' and full_code = 'WS2.5';

update skill_framework_items
set description = 'Examples:
• Read measurements off a scale in a practical context and record appropriately.'
where framework = 'WS' and full_code = 'WS2.6';

update skill_framework_items
set description = 'Examples:
• Assess whether sufficient, precise measurements have been taken in an experiment.
• Evaluate methods with a view to determining whether or not they are valid.'
where framework = 'WS' and full_code = 'WS2.7';

update skill_framework_items
set description = 'Examples:
• Construct and interpret frequency tables and diagrams, bar charts and histograms.
• Plot two variables from experimental or other data.'
where framework = 'WS' and full_code = 'WS3.1';

update skill_framework_items
set description = 'Examples:
• Translate data between graphical and numeric form.'
where framework = 'WS' and full_code = 'WS3.2';

update skill_framework_items
set description = 'Examples:
• Use an appropriate number of significant figures.
• Find the arithmetic mean and range of a set of data.
• Construct and interpret frequency tables and diagrams, bar charts and histograms.
• Make order of magnitude calculations.
• Change the subject of an equation.
• Substitute numerical values into algebraic equations using appropriate units for physical quantities.
• Determine the slope and intercept of a linear graph.
• Draw and use the slope of a tangent to a curve as a measure of rate of change.
• Understand the physical significance of area between a curve and the x-axis and measure it by counting squares as appropriate.'
where framework = 'WS' and full_code = 'WS3.3';

update skill_framework_items
set description = 'Examples:
• Apply the idea that whenever a measurement is made, there is always some uncertainty about the result obtained.
• Use the range of a set of measurements about the mean as a measure of uncertainty.'
where framework = 'WS' and full_code = 'WS3.4';

update skill_framework_items
set description = 'Examples:
• Use data to make predictions.
• Recognise or describe patterns and trends in data presented in a variety of tabular, graphical and other forms.
• Draw conclusions from given observations.'
where framework = 'WS' and full_code = 'WS3.5';

update skill_framework_items
set description = 'Examples:
• Comment on the extent to which data is consistent with a given hypothesis.
• Identify which of two or more hypotheses provides a better explanation of data in a given context.'
where framework = 'WS' and full_code = 'WS3.6';

update skill_framework_items
set description = 'Examples:
• Apply the following ideas to evaluate data to suggest improvements to procedures and techniques.
• An accurate measurement is one that is close to the true value.
• Measurements are precise if they cluster closely.
• Measurements are repeatable when repetition, under the same conditions by the same investigator, gives similar results.
• Measurements are reproducible if similar results are obtained by different investigators with different equipment.
• Measurements are affected by random error due to results varying in unpredictable ways; these errors can be reduced by making more measurements and reporting a mean value.
• Systematic error is due to measurement results differing from the true value by a consistent amount each time.
• Any anomalous values should be examined to try to identify the cause and, if a product of a poor measurement, ignored.'
where framework = 'WS' and full_code = 'WS3.7';

update skill_framework_items
set description = 'Examples:
• Present coherent and logically structured responses, using the ideas in 2 Experimental skills and strategies and 3 Analysis and evaluation, applied to the required practicals, and other practical investigations given appropriate information.'
where framework = 'WS' and full_code = 'WS3.8';

-- From: supabase/migrations/20250623_sync_question_skills_rpc.sql
-- Fixes admin save RLS error on question_skills when editing questions.

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
  v_role text;
  v_inserted int := 0;
  v_skill_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select role into v_role from public.profiles where user_id = auth.uid();
  if v_role <> 'developer' then
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

