-- Fix RETURN QUERY type mismatch: questions.difficulty is smallint, but
-- list_question_pool_meta / list_question_meta_by_ids declared it as integer.
-- Postgres rejects the mismatch with 42804, which PostgREST surfaces as HTTP 400.

drop function if exists public.list_question_pool_meta(uuid[], text[], text);
drop function if exists public.list_question_meta_by_ids(uuid[]);

create function public.list_question_pool_meta(
  p_spec_point_ids uuid[],
  p_tiers text[] default null,
  p_q_type text default null
)
returns table (
  id uuid,
  spec_point_id uuid,
  triple_spec_point_id uuid,
  audience text,
  tier text,
  difficulty smallint,
  demand_level text,
  ao1_marks smallint,
  ao2_marks smallint,
  ao3_marks smallint,
  is_maths_skill boolean,
  is_required_practical boolean,
  required_practical_id uuid,
  question_type text,
  marking_method text,
  max_marks integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_ids uuid[];
  v_tiers text[];
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_ids := array(select distinct x from unnest(coalesce(p_spec_point_ids, '{}'::uuid[])) as x where x is not null);
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return;
  end if;

  -- Cap filter fan-out to keep meta listing bounded per call.
  if array_length(v_ids, 1) > 200 then
    raise exception 'too_many_spec_points';
  end if;

  v_tiers := nullif(p_tiers, '{}'::text[]);

  return query
  select
    q.id,
    q.spec_point_id,
    q.triple_spec_point_id,
    q.audience,
    q.tier,
    q.difficulty,
    q.demand_level,
    q.ao1_marks,
    q.ao2_marks,
    q.ao3_marks,
    q.is_maths_skill,
    q.is_required_practical,
    q.required_practical_id,
    q.question_type,
    q.marking_method,
    q.max_marks
  from public.questions q
  where (
      q.spec_point_id = any (v_ids)
      or q.triple_spec_point_id = any (v_ids)
    )
    and (v_tiers is null or q.tier = any (v_tiers))
    and (p_q_type is null or p_q_type = '' or q.question_type = p_q_type);
end;
$$;

grant execute on function public.list_question_pool_meta(uuid[], text[], text) to authenticated;

create function public.list_question_meta_by_ids(
  p_question_ids uuid[]
)
returns table (
  id uuid,
  spec_point_id uuid,
  triple_spec_point_id uuid,
  audience text,
  tier text,
  difficulty smallint,
  demand_level text,
  ao1_marks smallint,
  ao2_marks smallint,
  ao3_marks smallint,
  is_maths_skill boolean,
  is_required_practical boolean,
  required_practical_id uuid,
  question_type text,
  marking_method text,
  max_marks integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_ids uuid[];
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  v_ids := array(select distinct x from unnest(coalesce(p_question_ids, '{}'::uuid[])) as x where x is not null);
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    return;
  end if;
  if array_length(v_ids, 1) > 200 then
    raise exception 'too_many_question_ids';
  end if;

  return query
  select
    q.id,
    q.spec_point_id,
    q.triple_spec_point_id,
    q.audience,
    q.tier,
    q.difficulty,
    q.demand_level,
    q.ao1_marks,
    q.ao2_marks,
    q.ao3_marks,
    q.is_maths_skill,
    q.is_required_practical,
    q.required_practical_id,
    q.question_type,
    q.marking_method,
    q.max_marks
  from public.questions q
  where q.id = any (v_ids);
end;
$$;

grant execute on function public.list_question_meta_by_ids(uuid[]) to authenticated;
