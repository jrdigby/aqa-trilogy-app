-- Seed covalent dot-and-cross diagram questions for Combined 5.02.1 / Triple 4.02.1.
-- 1) Complete-the-diagram (chemistry_interactive, 2 marks, standard, WS1.2/WS3.1/MS5b)
-- 2) Identify from diagram (mcq, 1 mark, low)
-- 3) Name from diagram (short_text, 1 mark, standard)

do $$
declare
  v_combined uuid;
  v_triple uuid;
  v_ws12 uuid;
  v_ws31 uuid;
  v_ms5b uuid;
  v_row record;
  v_qid uuid;
  v_chem jsonb;
  v_stem jsonb;
  v_opts jsonb;
  v_key jsonb;
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

  -- ── 1) Complete the dot and cross diagram (interactive, 2 marks) ───────────
  for v_row in
    select *
    from (
      values
        (
          'Complete the dot and cross diagram for hydrogen.',
          '{"kind":"covalent_bonding","template":{"atoms":[{"symbol":"H","maxLone":0},{"symbol":"H","maxLone":0}],"bonds":[{"a":0,"b":1,"maxPairs":1}]},"answer":{"kind":"covalent_bonding","atoms":[{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        ),
        (
          'Complete the dot and cross diagram for chlorine.',
          '{"kind":"covalent_bonding","template":{"atoms":[{"symbol":"Cl","maxLone":3},{"symbol":"Cl","maxLone":3}],"bonds":[{"a":0,"b":1,"maxPairs":1}]},"answer":{"kind":"covalent_bonding","atoms":[{"symbol":"Cl","lonePairs":3},{"symbol":"Cl","lonePairs":3}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        ),
        (
          'Complete the dot and cross diagram for oxygen.',
          '{"kind":"covalent_bonding","template":{"atoms":[{"symbol":"O","maxLone":2},{"symbol":"O","maxLone":2}],"bonds":[{"a":0,"b":1,"maxPairs":2}]},"answer":{"kind":"covalent_bonding","atoms":[{"symbol":"O","lonePairs":2},{"symbol":"O","lonePairs":2}],"bonds":[{"a":0,"b":1,"sharedPairs":2,"maxPairs":2}]}}'::jsonb
        ),
        (
          'Complete the dot and cross diagram for nitrogen.',
          '{"kind":"covalent_bonding","template":{"atoms":[{"symbol":"N","maxLone":1},{"symbol":"N","maxLone":1}],"bonds":[{"a":0,"b":1,"maxPairs":3}]},"answer":{"kind":"covalent_bonding","atoms":[{"symbol":"N","lonePairs":1},{"symbol":"N","lonePairs":1}],"bonds":[{"a":0,"b":1,"sharedPairs":3,"maxPairs":3}]}}'::jsonb
        ),
        (
          'Complete the dot and cross diagram for hydrogen chloride.',
          '{"kind":"covalent_bonding","template":{"atoms":[{"symbol":"H","maxLone":0},{"symbol":"Cl","maxLone":3}],"bonds":[{"a":0,"b":1,"maxPairs":1}]},"answer":{"kind":"covalent_bonding","atoms":[{"symbol":"H","lonePairs":0},{"symbol":"Cl","lonePairs":3}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        ),
        (
          'Complete the dot and cross diagram for water.',
          '{"kind":"covalent_bonding","template":{"atoms":[{"symbol":"O","maxLone":2},{"symbol":"H","maxLone":0},{"symbol":"H","maxLone":0}],"bonds":[{"a":0,"b":1,"maxPairs":1},{"a":0,"b":2,"maxPairs":1}]},"answer":{"kind":"covalent_bonding","atoms":[{"symbol":"O","lonePairs":2},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1},{"a":0,"b":2,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        ),
        (
          'Complete the dot and cross diagram for ammonia.',
          '{"kind":"covalent_bonding","template":{"atoms":[{"symbol":"N","maxLone":1},{"symbol":"H","maxLone":0},{"symbol":"H","maxLone":0},{"symbol":"H","maxLone":0}],"bonds":[{"a":0,"b":1,"maxPairs":1},{"a":0,"b":2,"maxPairs":1},{"a":0,"b":3,"maxPairs":1}]},"answer":{"kind":"covalent_bonding","atoms":[{"symbol":"N","lonePairs":1},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1},{"a":0,"b":2,"sharedPairs":1,"maxPairs":1},{"a":0,"b":3,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        ),
        (
          'Complete the dot and cross diagram for methane.',
          '{"kind":"covalent_bonding","template":{"atoms":[{"symbol":"C","maxLone":0},{"symbol":"H","maxLone":0},{"symbol":"H","maxLone":0},{"symbol":"H","maxLone":0},{"symbol":"H","maxLone":0}],"bonds":[{"a":0,"b":1,"maxPairs":1},{"a":0,"b":2,"maxPairs":1},{"a":0,"b":3,"maxPairs":1},{"a":0,"b":4,"maxPairs":1}]},"answer":{"kind":"covalent_bonding","atoms":[{"symbol":"C","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1},{"a":0,"b":2,"sharedPairs":1,"maxPairs":1},{"a":0,"b":3,"sharedPairs":1,"maxPairs":1},{"a":0,"b":4,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
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
        3, 'both', 'chemistry', 2, 'standard',
        2, 0, 0, true, false,
        'both', v_row.chemistry_config, '', 'complete'
      )
      returning id into v_qid;
    else
      update questions
      set
        triple_spec_point_id = v_triple,
        marking_method = 'chemistry',
        max_marks = 2,
        demand_level = 'standard',
        ao1_marks = 2,
        ao2_marks = 0,
        ao3_marks = 0,
        is_maths_skill = true,
        audience = 'both',
        chemistry_config = v_row.chemistry_config,
        difficulty = 3,
        tier = 'both',
        command_word = 'complete'
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

  -- ── 2) Identify substance from diagram (MCQ, 1 mark, low demand) ─────────
  for v_row in
    select *
    from (
      values
        (
          'Which substance is shown in the dot and cross diagram?',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1}]}}'::jsonb,
          '["H₂","He","H","H₂O"]'::jsonb,
          '{"correct":"H₂","option_feedback":{"He":"Helium is monatomic and does not form a covalent molecule of two hydrogen atoms.","H":"Hydrogen atoms exist singly; this diagram shows a covalent bond between two hydrogen atoms.","H₂O":"Water has one oxygen atom bonded to two hydrogen atoms, not two hydrogen atoms only."}}'::jsonb
        ),
        (
          'Which substance is shown in the dot and cross diagram?',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"Cl","lonePairs":3},{"symbol":"Cl","lonePairs":3}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1}]}}'::jsonb,
          '["Cl₂","Cl","HCl","ClO"]'::jsonb,
          '{"correct":"Cl₂","option_feedback":{"Cl":"Chlorine atoms do not exist singly; this diagram shows a shared pair between two chlorine atoms.","HCl":"Hydrogen chloride has one hydrogen and one chlorine atom, not two chlorine atoms.","ClO":"ClO is a different molecule with one chlorine and one oxygen atom."}}'::jsonb
        ),
        (
          'Which substance is shown in the dot and cross diagram?',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"O","lonePairs":2},{"symbol":"O","lonePairs":2}],"bonds":[{"a":0,"b":1,"sharedPairs":2,"maxPairs":2}]}}'::jsonb,
          '["O₂","O","O₃","HO₂"]'::jsonb,
          '{"correct":"O₂","option_feedback":{"O":"Oxygen atoms exist singly; this diagram shows a double bond between two oxygen atoms.","O₃":"Ozone has three oxygen atoms, not two.","HO₂":"HO₂ has hydrogen and two oxygen atoms; this diagram shows only two oxygen atoms."}}'::jsonb
        ),
        (
          'Which substance is shown in the dot and cross diagram?',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"N","lonePairs":1},{"symbol":"N","lonePairs":1}],"bonds":[{"a":0,"b":1,"sharedPairs":3,"maxPairs":3}]}}'::jsonb,
          '["N₂","N","NH₃","NO₂"]'::jsonb,
          '{"correct":"N₂","option_feedback":{"N":"Nitrogen atoms exist singly; this diagram shows a triple bond between two nitrogen atoms.","NH₃":"Ammonia has one nitrogen bonded to three hydrogen atoms.","NO₂":"NO₂ has one nitrogen and two oxygen atoms."}}'::jsonb
        ),
        (
          'Which substance is shown in the dot and cross diagram?',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"H","lonePairs":0},{"symbol":"Cl","lonePairs":3}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1}]}}'::jsonb,
          '["HCl","H₂Cl","H₂S","H₂O"]'::jsonb,
          '{"correct":"HCl","option_feedback":{"H₂Cl":"There is no stable molecule H₂Cl; hydrogen chloride is HCl.","H₂S":"Hydrogen sulfide has sulfur, not chlorine.","H₂O":"Water has one oxygen and two hydrogen atoms."}}'::jsonb
        ),
        (
          'Which substance is shown in the dot and cross diagram?',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"O","lonePairs":2},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1},{"a":0,"b":2,"sharedPairs":1,"maxPairs":1}]}}'::jsonb,
          '["H₂O","HO₂","H₂O₂","OH"]'::jsonb,
          '{"correct":"H₂O","option_feedback":{"HO₂":"HO₂ has a different arrangement; water is H₂O with one oxygen and two hydrogens.","H₂O₂":"Hydrogen peroxide has an O–O single bond between two oxygen atoms.","OH":"The hydroxide ion OH⁻ is not a neutral water molecule."}}'::jsonb
        ),
        (
          'Which substance is shown in the dot and cross diagram?',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"N","lonePairs":1},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1},{"a":0,"b":2,"sharedPairs":1,"maxPairs":1},{"a":0,"b":3,"sharedPairs":1,"maxPairs":1}]}}'::jsonb,
          '["NH₃","NH₄","N₂H₄","NO"]'::jsonb,
          '{"correct":"NH₃","option_feedback":{"NH₄":"NH₄⁺ is an ion with four hydrogens and a positive charge, not neutral ammonia.","N₂H₄":"Hydrazine (N₂H₄) has two nitrogen atoms, not one.","NO":"Nitric oxide (NO) has one nitrogen and one oxygen atom."}}'::jsonb
        ),
        (
          'Which substance is shown in the dot and cross diagram?',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"C","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1},{"a":0,"b":2,"sharedPairs":1,"maxPairs":1},{"a":0,"b":3,"sharedPairs":1,"maxPairs":1},{"a":0,"b":4,"sharedPairs":1,"maxPairs":1}]}}'::jsonb,
          '["CH₄","CH₃","C₂H₆","CH₃OH"]'::jsonb,
          '{"correct":"CH₄","option_feedback":{"CH₃":"The methyl radical CH₃ is not a stable neutral molecule with four C–H bonds.","C₂H₆":"Ethane has two carbon atoms bonded together.","CH₃OH":"Methanol has an oxygen atom bonded to carbon."}}'::jsonb
        )
    ) as t(prompt, chemistry_config, options, key_payload)
  loop
    v_stem := v_row.chemistry_config;
    v_opts := v_row.options;
    v_key := v_row.key_payload;

    select id into v_qid
    from questions
    where question_type = 'mcq'
      and spec_point_id = v_combined
      and chemistry_config -> 'answer' = v_stem -> 'answer'
    limit 1;

    if v_qid is null then
      insert into questions (
        spec_point_id, triple_spec_point_id, question_type, prompt, options,
        difficulty, tier, marking_method, max_marks, demand_level,
        ao1_marks, ao2_marks, ao3_marks, is_maths_skill, is_required_practical,
        audience, chemistry_config, resource_links, command_word
      ) values (
        v_combined, v_triple, 'mcq', v_row.prompt, v_opts,
        1, 'both', 'keyword', 1, 'low',
        1, 0, 0, false, false,
        'both', v_stem, '', 'identify'
      )
      returning id into v_qid;
    else
      update questions
      set
        prompt = v_row.prompt,
        options = v_opts,
        triple_spec_point_id = v_triple,
        marking_method = 'keyword',
        max_marks = 1,
        demand_level = 'low',
        ao1_marks = 1,
        ao2_marks = 0,
        ao3_marks = 0,
        is_maths_skill = false,
        audience = 'both',
        chemistry_config = v_stem,
        difficulty = 1,
        tier = 'both',
        command_word = 'identify'
      where id = v_qid;
    end if;

    insert into answer_keys (question_id, key_type, key_payload)
    values (v_qid, 'mcq', v_key)
    on conflict (question_id) do update
      set key_type = excluded.key_type,
          key_payload = excluded.key_payload;
  end loop;

  -- ── 3) Name substance from diagram (short_text, 1 mark, standard) ────────
  for v_row in
    select *
    from (
      values
        (
          'Name the substance shown in the dot and cross diagram.',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1}]}}'::jsonb,
          'hydrogen'
        ),
        (
          'Name the substance shown in the dot and cross diagram.',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"Cl","lonePairs":3},{"symbol":"Cl","lonePairs":3}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1}]}}'::jsonb,
          'chlorine'
        ),
        (
          'Name the substance shown in the dot and cross diagram.',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"O","lonePairs":2},{"symbol":"O","lonePairs":2}],"bonds":[{"a":0,"b":1,"sharedPairs":2,"maxPairs":2}]}}'::jsonb,
          'oxygen'
        ),
        (
          'Name the substance shown in the dot and cross diagram.',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"N","lonePairs":1},{"symbol":"N","lonePairs":1}],"bonds":[{"a":0,"b":1,"sharedPairs":3,"maxPairs":3}]}}'::jsonb,
          'nitrogen'
        ),
        (
          'Name the substance shown in the dot and cross diagram.',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"H","lonePairs":0},{"symbol":"Cl","lonePairs":3}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1}]}}'::jsonb,
          'hydrogen chloride'
        ),
        (
          'Name the substance shown in the dot and cross diagram.',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"O","lonePairs":2},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1},{"a":0,"b":2,"sharedPairs":1,"maxPairs":1}]}}'::jsonb,
          'water'
        ),
        (
          'Name the substance shown in the dot and cross diagram.',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"N","lonePairs":1},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1},{"a":0,"b":2,"sharedPairs":1,"maxPairs":1},{"a":0,"b":3,"sharedPairs":1,"maxPairs":1}]}}'::jsonb,
          'ammonia'
        ),
        (
          'Name the substance shown in the dot and cross diagram.',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"C","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1},{"a":0,"b":2,"sharedPairs":1,"maxPairs":1},{"a":0,"b":3,"sharedPairs":1,"maxPairs":1},{"a":0,"b":4,"sharedPairs":1,"maxPairs":1}]}}'::jsonb,
          'methane'
        )
    ) as t(prompt, chemistry_config, answer_name)
  loop
    v_stem := v_row.chemistry_config;

    select id into v_qid
    from questions
    where question_type = 'short_text'
      and spec_point_id = v_combined
      and chemistry_config -> 'answer' = v_stem -> 'answer'
    limit 1;

    if v_qid is null then
      insert into questions (
        spec_point_id, triple_spec_point_id, question_type, prompt,
        difficulty, tier, marking_method, max_marks, demand_level,
        ao1_marks, ao2_marks, ao3_marks, is_maths_skill, is_required_practical,
        audience, chemistry_config, resource_links, command_word
      ) values (
        v_combined, v_triple, 'short_text', v_row.prompt,
        2, 'both', 'keyword', 1, 'standard',
        1, 0, 0, false, false,
        'both', v_stem, '', 'name'
      )
      returning id into v_qid;
    else
      update questions
      set
        prompt = v_row.prompt,
        triple_spec_point_id = v_triple,
        marking_method = 'keyword',
        max_marks = 1,
        demand_level = 'standard',
        ao1_marks = 1,
        ao2_marks = 0,
        ao3_marks = 0,
        is_maths_skill = false,
        audience = 'both',
        chemistry_config = v_stem,
        difficulty = 2,
        tier = 'both',
        command_word = 'name'
      where id = v_qid;
    end if;

    insert into answer_keys (question_id, key_type, key_payload)
    values (
      v_qid,
      'keywords',
      jsonb_build_object(
        'required', jsonb_build_array(v_row.answer_name),
        'optional', '[]'::jsonb,
        'min_optional', 0
      )
    )
    on conflict (question_id) do update
      set key_type = excluded.key_type,
          key_payload = excluded.key_payload;
  end loop;
end $$;
