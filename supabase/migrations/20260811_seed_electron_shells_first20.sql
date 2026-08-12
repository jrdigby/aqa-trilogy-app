-- Seed electron shell diagrams + short-text electron structures for first 20 elements.
-- Spec: Combined 5.01.1 / Triple 4.01.1. Demand: standard (matches fluorine diagram).

do $$
declare
  v_combined uuid;
  v_triple uuid;
  v_row record;
  v_qid uuid;
  v_shells int[];
  v_shell_str text;
  v_chem jsonb;
  v_prompt text;
  v_short_prompt text;
  v_a int;
  v_n int;
begin
  select id into v_combined
  from spec_points
  where course_track = 'combined' and subject = 'chemistry' and spec_ref = '5.01.1'
  limit 1;

  select id into v_triple
  from spec_points
  where course_track = 'triple' and subject = 'chemistry' and spec_ref = '4.01.1'
  limit 1;

  if v_combined is null or v_triple is null then
    raise exception 'Missing atomic structure spec points 5.01.1 / 4.01.1';
  end if;

  for v_row in
    select *
    from (
      values
        ('H',  'hydrogen',     1,  1,  array[1]::int[]),
        ('He', 'helium',       2,  4,  array[2]::int[]),
        ('Li', 'lithium',      3,  7,  array[2,1]::int[]),
        ('Be', 'beryllium',    4,  9,  array[2,2]::int[]),
        ('B',  'boron',        5,  11, array[2,3]::int[]),
        ('C',  'carbon',       6,  12, array[2,4]::int[]),
        ('N',  'nitrogen',     7,  14, array[2,5]::int[]),
        ('O',  'oxygen',       8,  16, array[2,6]::int[]),
        ('F',  'fluorine',     9,  19, array[2,7]::int[]),
        ('Ne', 'neon',         10, 20, array[2,8]::int[]),
        ('Na', 'sodium',       11, 23, array[2,8,1]::int[]),
        ('Mg', 'magnesium',    12, 24, array[2,8,2]::int[]),
        ('Al', 'aluminium',    13, 27, array[2,8,3]::int[]),
        ('Si', 'silicon',      14, 28, array[2,8,4]::int[]),
        ('P',  'phosphorus',   15, 31, array[2,8,5]::int[]),
        ('S',  'sulphur',      16, 32, array[2,8,6]::int[]),
        ('Cl', 'chlorine',     17, 35, array[2,8,7]::int[]),
        ('Ar', 'argon',        18, 40, array[2,8,8]::int[]),
        ('K',  'potassium',    19, 39, array[2,8,8,1]::int[]),
        ('Ca', 'calcium',      20, 40, array[2,8,8,2]::int[])
    ) as t(symbol, name, z, a, shells)
  loop
    v_shells := v_row.shells;
    v_a := v_row.a;
    v_n := v_a - v_row.z;
    v_shell_str := array_to_string(v_shells, ',');

    -- 1) Electron shell diagram (chemistry_interactive)
    v_prompt := format(
      'Complete the electron shell diagram for %s: $\\ce{^%s_%s%s}$',
      v_row.name, v_a, v_row.z, v_row.symbol
    );

    v_chem := jsonb_build_object(
      'kind', 'electron_shell',
      'template', jsonb_build_object(
        'symbol', v_row.symbol,
        'protons', v_row.z,
        'neutrons', v_n,
        'shellCount', cardinality(v_shells)
      ),
      'answer', jsonb_build_object(
        'kind', 'electron_shell',
        'shells', to_jsonb(v_shells),
        'symbol', v_row.symbol,
        'nucleus', jsonb_build_object('p', v_row.z, 'n', v_n)
      )
    );

    select id into v_qid
    from questions
    where question_type = 'chemistry_interactive'
      and chemistry_config ->> 'kind' = 'electron_shell'
      and (
        prompt = v_prompt
        or (
          chemistry_config #>> '{answer,symbol}' = v_row.symbol
          and spec_point_id = v_combined
        )
      )
    limit 1;

    if v_qid is null then
      insert into questions (
        spec_point_id, triple_spec_point_id, question_type, prompt,
        difficulty, tier, marking_method, max_marks, demand_level,
        ao1_marks, ao2_marks, ao3_marks, is_maths_skill, is_required_practical,
        audience, chemistry_config, resource_links
      ) values (
        v_combined, v_triple, 'chemistry_interactive', v_prompt,
        2, 'both', 'chemistry', 1, 'standard',
        1, 0, 0, false, false,
        'both', v_chem, ''
      )
      returning id into v_qid;
    else
      update questions
      set
        prompt = v_prompt,
        triple_spec_point_id = v_triple,
        marking_method = 'chemistry',
        max_marks = 1,
        demand_level = 'standard',
        ao1_marks = 1,
        ao2_marks = 0,
        ao3_marks = 0,
        is_maths_skill = false,
        audience = 'both',
        chemistry_config = v_chem,
        difficulty = 2,
        tier = 'both'
      where id = v_qid;
    end if;

    insert into answer_keys (question_id, key_type, key_payload)
    values (v_qid, 'chemistry', v_chem -> 'answer')
    on conflict (question_id) do update
      set key_type = excluded.key_type,
          key_payload = excluded.key_payload;

    -- 2) Short-text electron structure by numbers
    v_short_prompt := format('What is the electron structure of %s?', v_row.name);

    select id into v_qid
    from questions
    where question_type = 'short_text'
      and spec_point_id = v_combined
      and (
        prompt = v_short_prompt
        or prompt = format('What is the electron structure of %s?', initcap(v_row.name))
        or (
          v_row.symbol = 'Na'
          and prompt ilike 'What is the electron structure of sodium?'
        )
      )
    limit 1;

    if v_qid is null then
      insert into questions (
        spec_point_id, triple_spec_point_id, question_type, prompt,
        difficulty, tier, marking_method, max_marks, demand_level,
        ao1_marks, ao2_marks, ao3_marks, is_maths_skill, is_required_practical,
        audience, resource_links
      ) values (
        v_combined, v_triple, 'short_text', v_short_prompt,
        2, 'both', 'keyword', 1, 'standard',
        1, 0, 0, false, false,
        'both', ''
      )
      returning id into v_qid;
    else
      update questions
      set
        prompt = v_short_prompt,
        triple_spec_point_id = v_triple,
        marking_method = 'keyword',
        max_marks = 1,
        demand_level = 'standard',
        ao1_marks = 1,
        ao2_marks = 0,
        ao3_marks = 0,
        is_maths_skill = false,
        audience = 'both',
        difficulty = 2,
        tier = 'both'
      where id = v_qid;
    end if;

    insert into answer_keys (question_id, key_type, key_payload)
    values (
      v_qid,
      'keywords',
      jsonb_build_object(
        'required', jsonb_build_array(v_shell_str),
        'optional', '[]'::jsonb,
        'min_optional', 0
      )
    )
    on conflict (question_id) do update
      set key_type = excluded.key_type,
          key_payload = excluded.key_payload;
  end loop;
end $$;
