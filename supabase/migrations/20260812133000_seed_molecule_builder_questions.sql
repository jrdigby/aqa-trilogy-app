-- Seed displayed-formula molecule builder questions (Combined 5.02.1 / Triple 4.02.1).
-- 2 marks AO1: 1 mark correct atoms, 1 mark correct bonds. Demand: standard_45.

do $$
declare
  v_combined uuid;
  v_triple uuid;
  v_ws12 uuid;
  v_ws31 uuid;
  v_ms5b uuid;
  v_row record;
  v_qid uuid;
begin
  select id into v_combined
  from spec_points
  where course_track = 'combined' and subject = 'chemistry' and spec_ref = '5.02.1'
  limit 1;

  select id into v_triple
  from spec_points
  where course_track = 'triple' and subject = 'chemistry' and spec_ref = '4.02.1'
  limit 1;

  if v_combined is null or v_triple is null then
    raise exception 'Missing bonding spec points 5.02.1 / 4.02.1';
  end if;

  select id into v_ws12 from skill_framework_items where full_code = 'WS1.2' limit 1;
  select id into v_ws31 from skill_framework_items where full_code = 'WS3.1' limit 1;
  select id into v_ms5b from skill_framework_items where full_code = 'MS5b' limit 1;

  if v_ws12 is null or v_ws31 is null or v_ms5b is null then
    raise exception 'Missing skills WS1.2 / WS3.1 / MS5b';
  end if;

  for v_row in
    select *
    from (
      values
        (
          'Draw the displayed formula for hydrogen (H₂).',
          '{"kind":"molecule_builder","template":{"allowedSymbols":["H","C","N","O","Cl"],"maxAtoms":8},"answer":{"kind":"molecule_builder","atoms":[{"id":"a1","symbol":"H","x":150,"y":120},{"id":"a2","symbol":"H","x":250,"y":120}],"bonds":[{"a":"a1","b":"a2"}]}}'::jsonb
        ),
        (
          'Draw the displayed formula for chlorine (Cl₂).',
          '{"kind":"molecule_builder","template":{"allowedSymbols":["H","C","N","O","Cl"],"maxAtoms":8},"answer":{"kind":"molecule_builder","atoms":[{"id":"a1","symbol":"Cl","x":150,"y":120},{"id":"a2","symbol":"Cl","x":250,"y":120}],"bonds":[{"a":"a1","b":"a2"}]}}'::jsonb
        ),
        (
          'Draw the displayed formula for oxygen (O₂).',
          '{"kind":"molecule_builder","template":{"allowedSymbols":["H","C","N","O","Cl"],"maxAtoms":8},"answer":{"kind":"molecule_builder","atoms":[{"id":"a1","symbol":"O","x":150,"y":120},{"id":"a2","symbol":"O","x":250,"y":120}],"bonds":[{"a":"a1","b":"a2"}]}}'::jsonb
        ),
        (
          'Draw the displayed formula for nitrogen (N₂).',
          '{"kind":"molecule_builder","template":{"allowedSymbols":["H","C","N","O","Cl"],"maxAtoms":8},"answer":{"kind":"molecule_builder","atoms":[{"id":"a1","symbol":"N","x":150,"y":120},{"id":"a2","symbol":"N","x":250,"y":120}],"bonds":[{"a":"a1","b":"a2"}]}}'::jsonb
        ),
        (
          'Draw the displayed formula for hydrogen chloride (HCl).',
          '{"kind":"molecule_builder","template":{"allowedSymbols":["H","C","N","O","Cl"],"maxAtoms":8},"answer":{"kind":"molecule_builder","atoms":[{"id":"h","symbol":"H","x":130,"y":120},{"id":"cl","symbol":"Cl","x":270,"y":120}],"bonds":[{"a":"h","b":"cl"}]}}'::jsonb
        ),
        (
          'Draw the displayed formula for water (H₂O).',
          '{"kind":"molecule_builder","template":{"allowedSymbols":["H","C","N","O","Cl"],"maxAtoms":8},"answer":{"kind":"molecule_builder","atoms":[{"id":"o","symbol":"O","x":200,"y":130},{"id":"h1","symbol":"H","x":130,"y":170},{"id":"h2","symbol":"H","x":270,"y":170}],"bonds":[{"a":"o","b":"h1"},{"a":"o","b":"h2"}]}}'::jsonb
        ),
        (
          'Draw the displayed formula for ammonia (NH₃).',
          '{"kind":"molecule_builder","template":{"allowedSymbols":["H","C","N","O","Cl"],"maxAtoms":8},"answer":{"kind":"molecule_builder","atoms":[{"id":"n","symbol":"N","x":200,"y":120},{"id":"h1","symbol":"H","x":130,"y":120},{"id":"h2","symbol":"H","x":270,"y":120},{"id":"h3","symbol":"H","x":200,"y":190}],"bonds":[{"a":"n","b":"h1"},{"a":"n","b":"h2"},{"a":"n","b":"h3"}]}}'::jsonb
        ),
        (
          'Draw the displayed formula for methane (CH₄).',
          '{"kind":"molecule_builder","template":{"allowedSymbols":["H","C","N","O","Cl"],"maxAtoms":8},"answer":{"kind":"molecule_builder","atoms":[{"id":"c","symbol":"C","x":200,"y":120},{"id":"h1","symbol":"H","x":130,"y":120},{"id":"h2","symbol":"H","x":270,"y":120},{"id":"h3","symbol":"H","x":200,"y":60},{"id":"h4","symbol":"H","x":200,"y":190}],"bonds":[{"a":"c","b":"h1"},{"a":"c","b":"h2"},{"a":"c","b":"h3"},{"a":"c","b":"h4"}]}}'::jsonb
        )
    ) as t(prompt, chemistry_config)
  loop
    select id into v_qid
    from questions
    where prompt = v_row.prompt
      and question_type = 'chemistry_interactive'
      and spec_point_id = v_combined
    limit 1;

    if v_qid is null then
      insert into questions (
        spec_point_id, triple_spec_point_id, question_type, prompt,
        difficulty, tier, marking_method, max_marks, demand_level,
        ao1_marks, ao2_marks, ao3_marks, is_maths_skill, is_required_practical,
        audience, chemistry_config, resource_links, command_word
      ) values (
        v_combined, v_triple, 'chemistry_interactive', v_row.prompt,
        4, 'both', 'chemistry', 2, 'standard_45',
        2, 0, 0, true, false,
        'both', v_row.chemistry_config, '', 'draw'
      )
      returning id into v_qid;
    else
      update questions
      set
        triple_spec_point_id = v_triple,
        marking_method = 'chemistry',
        max_marks = 2,
        demand_level = 'standard_45',
        ao1_marks = 2,
        ao2_marks = 0,
        ao3_marks = 0,
        is_maths_skill = true,
        audience = 'both',
        chemistry_config = v_row.chemistry_config,
        difficulty = 4,
        tier = 'both',
        command_word = 'draw'
      where id = v_qid;
    end if;

    insert into answer_keys (question_id, key_type, key_payload)
    values (v_qid, 'chemistry', v_row.chemistry_config -> 'answer')
    on conflict (question_id) do update
      set key_type = excluded.key_type,
          key_payload = excluded.key_payload;

    delete from question_skills where question_id = v_qid;
    insert into question_skills (question_id, skill_id)
    values
      (v_qid, v_ws12),
      (v_qid, v_ws31),
      (v_qid, v_ms5b);
  end loop;
end $$;
