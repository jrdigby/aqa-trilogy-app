-- Developer-only transactional question + answer_key + mark_points + skills commit

create or replace function public.developer_upsert_question_bundle(p_bundle jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_id uuid;
  v_is_update boolean;
  v_q jsonb;
  v_key jsonb;
  v_mp jsonb;
  v_skill_ids uuid[];
  v_replace_mp boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if not public.is_developer() then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  v_q := coalesce(p_bundle->'question', '{}'::jsonb);
  v_key := coalesce(p_bundle->'answer_key', '{}'::jsonb);
  v_replace_mp := coalesce((p_bundle->>'replace_mark_points')::boolean, true);

  v_skill_ids := array(
    select (jsonb_array_elements_text(coalesce(p_bundle->'skill_ids', '[]'::jsonb)))::uuid
  );

  v_question_id := nullif(p_bundle->>'question_id', '')::uuid;
  v_is_update := v_question_id is not null;

  if v_is_update then
    if not exists (select 1 from public.questions where id = v_question_id) then
      return jsonb_build_object('ok', false, 'reason', 'question_not_found');
    end if;

    update public.questions set
      question_type = coalesce(v_q->>'question_type', question_type),
      prompt = coalesce(v_q->>'prompt', prompt),
      options = case when v_q ? 'options' then v_q->'options' else options end,
      tier = coalesce(v_q->>'tier', tier),
      marking_method = coalesce(v_q->>'marking_method', marking_method),
      max_marks = coalesce((v_q->>'max_marks')::smallint, max_marks),
      resource_links = case when v_q ? 'resource_links' then nullif(v_q->>'resource_links', '') else resource_links end,
      image_url = case when v_q ? 'image_url' then nullif(v_q->>'image_url', '') else image_url end,
      hints = case when v_q ? 'hints' then v_q->'hints' else hints end,
      audience = coalesce(v_q->>'audience', audience),
      spec_point_id = coalesce(nullif(v_q->>'spec_point_id', '')::uuid, spec_point_id),
      triple_spec_point_id = case when v_q ? 'triple_spec_point_id' then nullif(v_q->>'triple_spec_point_id', '')::uuid else triple_spec_point_id end,
      command_word = case when v_q ? 'command_word' then nullif(v_q->>'command_word', '') else command_word end,
      demand_level = case when v_q ? 'demand_level' then nullif(v_q->>'demand_level', '') else demand_level end,
      ao1_marks = case when v_q ? 'ao1_marks' then (v_q->>'ao1_marks')::smallint else ao1_marks end,
      ao2_marks = case when v_q ? 'ao2_marks' then (v_q->>'ao2_marks')::smallint else ao2_marks end,
      ao3_marks = case when v_q ? 'ao3_marks' then (v_q->>'ao3_marks')::smallint else ao3_marks end,
      is_maths_skill = coalesce((v_q->>'is_maths_skill')::boolean, is_maths_skill),
      is_required_practical = coalesce((v_q->>'is_required_practical')::boolean, is_required_practical),
      required_practical_id = case when v_q ? 'required_practical_id' then nullif(v_q->>'required_practical_id', '')::uuid else required_practical_id end,
      difficulty = case when v_q ? 'difficulty' then (v_q->>'difficulty')::smallint else difficulty end,
      calculation_config = case when v_q ? 'calculation_config' then v_q->'calculation_config' else calculation_config end,
      chemistry_config = case when v_q ? 'chemistry_config' then v_q->'chemistry_config' else chemistry_config end,
      circuit_config = case when v_q ? 'circuit_config' then v_q->'circuit_config' else circuit_config end,
      equipment_config = case when v_q ? 'equipment_config' then v_q->'equipment_config' else equipment_config end
    where id = v_question_id;

    if exists (select 1 from public.answer_keys where question_id = v_question_id) then
      update public.answer_keys set
        key_type = coalesce(v_key->>'key_type', key_type),
        key_payload = coalesce(v_key->'key_payload', key_payload)
      where question_id = v_question_id;
    else
      insert into public.answer_keys (question_id, key_type, key_payload)
      values (
        v_question_id,
        coalesce(v_key->>'key_type', 'keywords'),
        coalesce(v_key->'key_payload', '{}'::jsonb)
      );
    end if;
  else
    insert into public.questions (
      question_type, prompt, options, tier, marking_method, max_marks,
      resource_links, image_url, hints, audience, spec_point_id, triple_spec_point_id,
      command_word, demand_level, ao1_marks, ao2_marks, ao3_marks,
      is_maths_skill, is_required_practical, required_practical_id, difficulty,
      calculation_config, chemistry_config, circuit_config, equipment_config
    ) values (
      v_q->>'question_type',
      v_q->>'prompt',
      case when v_q ? 'options' then v_q->'options' else null end,
      coalesce(v_q->>'tier', 'both'),
      coalesce(v_q->>'marking_method', 'keyword'),
      coalesce((v_q->>'max_marks')::smallint, 1),
      nullif(v_q->>'resource_links', ''),
      nullif(v_q->>'image_url', ''),
      case when v_q ? 'hints' then v_q->'hints' else null end,
      coalesce(v_q->>'audience', 'both'),
      nullif(v_q->>'spec_point_id', '')::uuid,
      nullif(v_q->>'triple_spec_point_id', '')::uuid,
      nullif(v_q->>'command_word', ''),
      nullif(v_q->>'demand_level', ''),
      nullif(v_q->>'ao1_marks', '')::smallint,
      nullif(v_q->>'ao2_marks', '')::smallint,
      nullif(v_q->>'ao3_marks', '')::smallint,
      coalesce((v_q->>'is_maths_skill')::boolean, false),
      coalesce((v_q->>'is_required_practical')::boolean, false),
      nullif(v_q->>'required_practical_id', '')::uuid,
      nullif(v_q->>'difficulty', '')::smallint,
      case when v_q ? 'calculation_config' then v_q->'calculation_config' else null end,
      case when v_q ? 'chemistry_config' then v_q->'chemistry_config' else null end,
      case when v_q ? 'circuit_config' then v_q->'circuit_config' else null end,
      case when v_q ? 'equipment_config' then v_q->'equipment_config' else null end
    )
    returning id into v_question_id;

    insert into public.answer_keys (question_id, key_type, key_payload)
    values (
      v_question_id,
      coalesce(v_key->>'key_type', 'keywords'),
      coalesce(v_key->'key_payload', '{}'::jsonb)
    );
  end if;

  if v_replace_mp then
    delete from public.mark_points where question_id = v_question_id;
    for v_mp in select * from jsonb_array_elements(coalesce(p_bundle->'mark_points', '[]'::jsonb))
    loop
      insert into public.mark_points (
        question_id, ao, point_text, feedback_if_missing, max_marks, image_url
      ) values (
        v_question_id,
        coalesce(v_mp->>'ao', 'AO1'),
        coalesce(v_mp->>'point_text', ''),
        coalesce(v_mp->>'feedback_if_missing', ''),
        coalesce((v_mp->>'max_marks')::smallint, 1),
        nullif(v_mp->>'image_url', '')
      );
    end loop;
  end if;

  perform public.sync_question_skills(v_question_id, v_skill_ids);

  return jsonb_build_object('ok', true, 'question_id', v_question_id);
end;
$$;

grant execute on function public.developer_upsert_question_bundle(jsonb) to authenticated;

comment on function public.developer_upsert_question_bundle(jsonb) is
  'Developer-only: atomic insert/update of question, answer_key, mark_points, and skills';
