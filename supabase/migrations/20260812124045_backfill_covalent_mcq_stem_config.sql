-- Backfill chemistry_config on covalent identify MCQs that were saved without a stem diagram config.

do $$
declare
  v_row record;
  v_qid uuid;
begin
  for v_row in
    select *
    from (
      values
        (
          'H₂',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        ),
        (
          'Cl₂',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"Cl","lonePairs":3},{"symbol":"Cl","lonePairs":3}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        ),
        (
          'O₂',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"O","lonePairs":2},{"symbol":"O","lonePairs":2}],"bonds":[{"a":0,"b":1,"sharedPairs":2,"maxPairs":2}]}}'::jsonb
        ),
        (
          'N₂',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"N","lonePairs":1},{"symbol":"N","lonePairs":1}],"bonds":[{"a":0,"b":1,"sharedPairs":3,"maxPairs":3}]}}'::jsonb
        ),
        (
          'HCl',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"H","lonePairs":0},{"symbol":"Cl","lonePairs":3}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        ),
        (
          'H₂O',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"O","lonePairs":2},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1},{"a":0,"b":2,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        ),
        (
          'NH₃',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"N","lonePairs":1},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1},{"a":0,"b":2,"sharedPairs":1,"maxPairs":1},{"a":0,"b":3,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        ),
        (
          'CH₄',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"C","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1},{"a":0,"b":2,"sharedPairs":1,"maxPairs":1},{"a":0,"b":3,"sharedPairs":1,"maxPairs":1},{"a":0,"b":4,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        )
    ) as t(correct, chemistry_config)
  loop
    for v_qid in
      select q.id
      from questions q
      join answer_keys ak on ak.question_id = q.id
      where q.question_type = 'mcq'
        and q.prompt = 'Which substance is shown in the dot and cross diagram?'
        and ak.key_payload ->> 'correct' = v_row.correct
        and (
          q.chemistry_config is null
          or q.chemistry_config -> 'answer' is null
        )
    loop
      update questions
      set chemistry_config = v_row.chemistry_config
      where id = v_qid;
    end loop;
  end loop;

  -- Same backfill for short-text name questions missing stem config.
  for v_row in
    select *
    from (
      values
        (
          'hydrogen',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        ),
        (
          'chlorine',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"Cl","lonePairs":3},{"symbol":"Cl","lonePairs":3}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        ),
        (
          'oxygen',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"O","lonePairs":2},{"symbol":"O","lonePairs":2}],"bonds":[{"a":0,"b":1,"sharedPairs":2,"maxPairs":2}]}}'::jsonb
        ),
        (
          'nitrogen',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"N","lonePairs":1},{"symbol":"N","lonePairs":1}],"bonds":[{"a":0,"b":1,"sharedPairs":3,"maxPairs":3}]}}'::jsonb
        ),
        (
          'hydrogen chloride',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"H","lonePairs":0},{"symbol":"Cl","lonePairs":3}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        ),
        (
          'water',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"O","lonePairs":2},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1},{"a":0,"b":2,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        ),
        (
          'ammonia',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"N","lonePairs":1},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1},{"a":0,"b":2,"sharedPairs":1,"maxPairs":1},{"a":0,"b":3,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        ),
        (
          'methane',
          '{"kind":"covalent_bonding","answer":{"kind":"covalent_bonding","atoms":[{"symbol":"C","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0},{"symbol":"H","lonePairs":0}],"bonds":[{"a":0,"b":1,"sharedPairs":1,"maxPairs":1},{"a":0,"b":2,"sharedPairs":1,"maxPairs":1},{"a":0,"b":3,"sharedPairs":1,"maxPairs":1},{"a":0,"b":4,"sharedPairs":1,"maxPairs":1}]}}'::jsonb
        )
    ) as t(answer_name, chemistry_config)
  loop
    for v_qid in
      select q.id
      from questions q
      join answer_keys ak on ak.question_id = q.id
      where q.question_type = 'short_text'
        and q.prompt = 'Name the substance shown in the dot and cross diagram.'
        and ak.key_payload #>> '{required,0}' = v_row.answer_name
        and (
          q.chemistry_config is null
          or q.chemistry_config -> 'answer' is null
        )
    loop
      update questions
      set chemistry_config = v_row.chemistry_config
      where id = v_qid;
    end loop;
  end loop;
end $$;
