-- Seed ionic bonding diagram questions for Combined 5.02.1 / Triple 4.02.1.
-- Demand: standard (FT). Audience: both. Skills: WS1.2, WS3.1, MS5b.

do $$
declare
  v_combined uuid;
  v_triple uuid;
  v_ws12 uuid;
  v_ws31 uuid;
  v_ms5b uuid;
  v_row record;
  v_qid uuid;
  v_marks int;
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

  -- Align existing NaCl prompt wording (compound name -> word equation).
  update questions
  set prompt = 'Complete the ionic bonding diagram for sodium + chlorine → sodium chloride.'
  where question_type = 'chemistry_interactive'
    and chemistry_config ->> 'kind' = 'ionic_bonding'
    and chemistry_config #>> '{template,atoms,0,symbol}' = 'Na'
    and chemistry_config #>> '{template,atoms,1,symbol}' = 'Cl'
    and jsonb_array_length(coalesce(chemistry_config -> 'template' -> 'atoms', '[]'::jsonb)) = 2
    and (
      prompt ilike '%sodium chloride%'
      or prompt ilike '%NaCl%'
    );

  for v_row in
    select *
    from (
      values
        (
          'Complete the ionic bonding diagram for sodium + chlorine → sodium chloride.',
          3,
          2,
          '{"kind":"ionic_bonding","template":{"atoms":[{"symbol":"Na","style":"dot"},{"symbol":"Cl","style":"cross"}]},"answer":{"kind":"ionic_bonding","atoms":[{"symbol":"Na","shells":[2,8],"charge":1,"brackets":true,"style":"dot"},{"symbol":"Cl","shells":[2,8,8],"charge":-1,"brackets":true,"style":"cross"}],"transferred":1}}'::jsonb
        ),
        (
          'Complete the ionic bonding diagram for lithium + chlorine → lithium chloride.',
          3,
          2,
          '{"kind":"ionic_bonding","template":{"atoms":[{"symbol":"Li","style":"dot"},{"symbol":"Cl","style":"cross"}]},"answer":{"kind":"ionic_bonding","atoms":[{"symbol":"Li","shells":[2],"charge":1,"brackets":true,"style":"dot"},{"symbol":"Cl","shells":[2,8,8],"charge":-1,"brackets":true,"style":"cross"}],"transferred":1}}'::jsonb
        ),
        (
          'Complete the ionic bonding diagram for potassium + bromine → potassium bromide.',
          3,
          2,
          '{"kind":"ionic_bonding","template":{"atoms":[{"symbol":"K","style":"dot"},{"symbol":"Br","style":"cross"}]},"answer":{"kind":"ionic_bonding","atoms":[{"symbol":"K","shells":[2,8,8],"charge":1,"brackets":true,"style":"dot"},{"symbol":"Br","shells":[2,8,18,8],"charge":-1,"brackets":true,"style":"cross"}],"transferred":1}}'::jsonb
        ),
        (
          'Complete the ionic bonding diagram for magnesium + oxygen → magnesium oxide.',
          3,
          2,
          '{"kind":"ionic_bonding","template":{"atoms":[{"symbol":"Mg","style":"dot"},{"symbol":"O","style":"cross"}]},"answer":{"kind":"ionic_bonding","atoms":[{"symbol":"Mg","shells":[2,8],"charge":2,"brackets":true,"style":"dot"},{"symbol":"O","shells":[2,8],"charge":-2,"brackets":true,"style":"cross"}],"transferred":2}}'::jsonb
        ),
        (
          'Complete the ionic bonding diagram for calcium + oxygen → calcium oxide.',
          3,
          2,
          '{"kind":"ionic_bonding","template":{"atoms":[{"symbol":"Ca","style":"dot"},{"symbol":"O","style":"cross"}]},"answer":{"kind":"ionic_bonding","atoms":[{"symbol":"Ca","shells":[2,8,8],"charge":2,"brackets":true,"style":"dot"},{"symbol":"O","shells":[2,8],"charge":-2,"brackets":true,"style":"cross"}],"transferred":2}}'::jsonb
        ),
        (
          'Complete the ionic bonding diagram for sodium + oxygen → sodium oxide.',
          4,
          3,
          '{"kind":"ionic_bonding","template":{"atoms":[{"symbol":"Na","style":"dot"},{"symbol":"Na","style":"dot"},{"symbol":"O","style":"cross"}]},"answer":{"kind":"ionic_bonding","ratioMark":true,"atoms":[{"symbol":"Na","shells":[2,8],"charge":1,"brackets":true,"style":"dot"},{"symbol":"Na","shells":[2,8],"charge":1,"brackets":true,"style":"dot"},{"symbol":"O","shells":[2,8],"charge":-2,"brackets":true,"style":"cross"}],"transferred":2}}'::jsonb
        ),
        (
          'Complete the ionic bonding diagram for potassium + sulphur → potassium sulphide.',
          4,
          3,
          '{"kind":"ionic_bonding","template":{"atoms":[{"symbol":"K","style":"dot"},{"symbol":"K","style":"dot"},{"symbol":"S","style":"cross"}]},"answer":{"kind":"ionic_bonding","ratioMark":true,"atoms":[{"symbol":"K","shells":[2,8,8],"charge":1,"brackets":true,"style":"dot"},{"symbol":"K","shells":[2,8,8],"charge":1,"brackets":true,"style":"dot"},{"symbol":"S","shells":[2,8,8],"charge":-2,"brackets":true,"style":"cross"}],"transferred":2}}'::jsonb
        ),
        (
          'Complete the ionic bonding diagram for lithium + oxygen → lithium oxide.',
          4,
          3,
          '{"kind":"ionic_bonding","template":{"atoms":[{"symbol":"Li","style":"dot"},{"symbol":"Li","style":"dot"},{"symbol":"O","style":"cross"}]},"answer":{"kind":"ionic_bonding","ratioMark":true,"atoms":[{"symbol":"Li","shells":[2],"charge":1,"brackets":true,"style":"dot"},{"symbol":"Li","shells":[2],"charge":1,"brackets":true,"style":"dot"},{"symbol":"O","shells":[2,8],"charge":-2,"brackets":true,"style":"cross"}],"transferred":2}}'::jsonb
        ),
        (
          'Complete the ionic bonding diagram for magnesium + chlorine → magnesium chloride.',
          4,
          3,
          '{"kind":"ionic_bonding","template":{"atoms":[{"symbol":"Mg","style":"dot"},{"symbol":"Cl","style":"cross"},{"symbol":"Cl","style":"cross"}]},"answer":{"kind":"ionic_bonding","ratioMark":true,"atoms":[{"symbol":"Mg","shells":[2,8],"charge":2,"brackets":true,"style":"dot"},{"symbol":"Cl","shells":[2,8,8],"charge":-1,"brackets":true,"style":"cross"},{"symbol":"Cl","shells":[2,8,8],"charge":-1,"brackets":true,"style":"cross"}],"transferred":2}}'::jsonb
        ),
        (
          'Complete the ionic bonding diagram for calcium + chlorine → calcium chloride.',
          4,
          3,
          '{"kind":"ionic_bonding","template":{"atoms":[{"symbol":"Ca","style":"dot"},{"symbol":"Cl","style":"cross"},{"symbol":"Cl","style":"cross"}]},"answer":{"kind":"ionic_bonding","ratioMark":true,"atoms":[{"symbol":"Ca","shells":[2,8,8],"charge":2,"brackets":true,"style":"dot"},{"symbol":"Cl","shells":[2,8,8],"charge":-1,"brackets":true,"style":"cross"},{"symbol":"Cl","shells":[2,8,8],"charge":-1,"brackets":true,"style":"cross"}],"transferred":2}}'::jsonb
        )
    ) as t(prompt, max_marks, difficulty, chemistry_config)
  loop
    v_marks := v_row.max_marks;

    select id into v_qid
    from questions
    where prompt = v_row.prompt
      and question_type = 'chemistry_interactive'
      and spec_point_id = v_combined
    limit 1;

    if v_qid is null then
      insert into questions (
        spec_point_id,
        triple_spec_point_id,
        question_type,
        prompt,
        difficulty,
        tier,
        marking_method,
        max_marks,
        demand_level,
        ao1_marks,
        ao2_marks,
        ao3_marks,
        is_maths_skill,
        is_required_practical,
        audience,
        chemistry_config,
        resource_links
      ) values (
        v_combined,
        v_triple,
        'chemistry_interactive',
        v_row.prompt,
        v_row.difficulty,
        'both',
        'chemistry',
        v_marks,
        'standard',
        v_marks,
        0,
        0,
        true,
        false,
        'both',
        v_row.chemistry_config,
        ''
      )
      returning id into v_qid;
    else
      update questions
      set
        triple_spec_point_id = v_triple,
        marking_method = 'chemistry',
        max_marks = v_marks,
        demand_level = 'standard',
        ao1_marks = v_marks,
        ao2_marks = 0,
        ao3_marks = 0,
        is_maths_skill = true,
        audience = 'both',
        chemistry_config = v_row.chemistry_config,
        difficulty = v_row.difficulty,
        tier = 'both'
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
