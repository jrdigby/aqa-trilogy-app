-- Seed low-demand MCQs identifying carbon allotrope structures from diagrams.
-- Combined 5.02.3 / Triple 4.02.3 — Structure and bonding of carbon.

do $$
declare
  v_combined uuid;
  v_triple uuid;
  v_row record;
  v_qid uuid;
  v_stem jsonb;
  v_opts jsonb;
  v_key jsonb;
  v_feedback jsonb;
begin
  select id into v_combined
  from spec_points
  where course_track = 'combined' and subject = 'chemistry' and spec_ref = '5.02.3'
  limit 1;

  select id into v_triple
  from spec_points
  where course_track = 'triple' and subject = 'chemistry' and spec_ref = '4.02.3'
  limit 1;

  if v_combined is null or v_triple is null then
    raise exception 'Missing carbon structure spec points 5.02.3 / 4.02.3';
  end if;

  v_opts := '["graphite","diamond","buckminsterfullerene","carbon nanotube"]'::jsonb;

  for v_row in
    select *
    from (
      values
        (
          'graphite',
          '{"kind":"carbon_allotrope","template":{"allotrope":"graphite"},"answer":{"kind":"carbon_allotrope","allotrope":"graphite"}}'::jsonb,
          'graphite'
        ),
        (
          'diamond',
          '{"kind":"carbon_allotrope","template":{"allotrope":"diamond"},"answer":{"kind":"carbon_allotrope","allotrope":"diamond"}}'::jsonb,
          'diamond'
        ),
        (
          'buckminsterfullerene',
          '{"kind":"carbon_allotrope","template":{"allotrope":"buckminsterfullerene"},"answer":{"kind":"carbon_allotrope","allotrope":"buckminsterfullerene"}}'::jsonb,
          'buckminsterfullerene'
        ),
        (
          'carbon_nanotube',
          '{"kind":"carbon_allotrope","template":{"allotrope":"carbon_nanotube"},"answer":{"kind":"carbon_allotrope","allotrope":"carbon_nanotube"}}'::jsonb,
          'carbon nanotube'
        )
    ) as t(allotrope_id, chemistry_config, correct)
  loop
    v_stem := v_row.chemistry_config;
    v_feedback := jsonb_build_object(
      'graphite', 'Graphite has layers of hexagonally arranged carbon atoms with weak forces between the layers.',
      'diamond', 'Diamond is a giant covalent structure where each carbon atom is bonded to four others in a tetrahedral lattice.',
      'buckminsterfullerene', 'Buckminsterfullerene (C₆₀) is a spherical cage of hexagons and pentagons.',
      'carbon nanotube', 'Carbon nanotubes are cylindrical tubes of carbon atoms arranged in hexagons.'
    ) - v_row.correct;
    v_key := jsonb_build_object('correct', v_row.correct, 'option_feedback', v_feedback);

    select id into v_qid
    from questions
    where question_type = 'mcq'
      and spec_point_id = v_combined
      and prompt = 'What is the structure in the diagram?'
      and chemistry_config -> 'answer' ->> 'allotrope' = v_row.allotrope_id
    limit 1;

    if v_qid is null then
      insert into questions (
        spec_point_id, triple_spec_point_id, question_type, prompt, options,
        difficulty, tier, marking_method, max_marks, demand_level,
        ao1_marks, ao2_marks, ao3_marks, is_maths_skill, is_required_practical,
        audience, chemistry_config, resource_links, command_word
      ) values (
        v_combined, v_triple, 'mcq', 'What is the structure in the diagram?', v_opts,
        1, 'both', 'keyword', 1, 'low',
        1, 0, 0, false, false,
        'both', v_stem, '', 'identify'
      )
      returning id into v_qid;
    else
      update questions
      set
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
        command_word = 'identify',
        image_url = null
      where id = v_qid;
    end if;

    insert into answer_keys (question_id, key_type, key_payload)
    values (v_qid, 'mcq', v_key)
    on conflict (question_id) do update
      set key_type = excluded.key_type,
          key_payload = excluded.key_payload;
  end loop;
end $$;
