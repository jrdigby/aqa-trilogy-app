-- Patch substitution_template + rearrangement_forms for efficiency equations only

UPDATE equation_sheets
SET equations = (
  SELECT jsonb_agg(
    CASE elem->>'id'
      WHEN 'efficiency_energy' THEN elem || '{"substitution_template":{"layout":"fraction","lhs":[{"kind":"slot","id":"efficiency","label":"efficiency"}],"numerator":[{"kind":"slot","id":"E_useful","label":"useful output energy"}],"denominator":[{"kind":"slot","id":"E_in","label":"total input energy"}]},"rearrangement_forms":{"default_subject":"E_useful","variants":[{"subject":"E_useful","correct":"E_useful = efficiency × E_in","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"E_in","correct":"E_in = E_useful / efficiency","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"efficiency","correct":"efficiency = E_useful / E_in","distractor_patterns":["invert_fraction","multiply_instead"]}]}}'::jsonb
      WHEN 'efficiency_power' THEN elem || '{"substitution_template":{"layout":"fraction","lhs":[{"kind":"slot","id":"efficiency","label":"efficiency"}],"numerator":[{"kind":"slot","id":"P_useful","label":"useful power output"}],"denominator":[{"kind":"slot","id":"P_in","label":"total power input"}]},"rearrangement_forms":{"default_subject":"P_useful","variants":[{"subject":"P_useful","correct":"P_useful = efficiency × P_in","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"P_in","correct":"P_in = P_useful / efficiency","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"efficiency","correct":"efficiency = P_useful / P_in","distractor_patterns":["invert_fraction","multiply_instead"]}]}}'::jsonb
      ELSE elem
    END
  )
  FROM jsonb_array_elements(equations) AS elem
)
WHERE id = 'physics_p1_ft';

UPDATE equation_sheets
SET equations = (
  SELECT jsonb_agg(
    CASE elem->>'id'
      WHEN 'efficiency_energy' THEN elem || '{"substitution_template":{"layout":"fraction","lhs":[{"kind":"slot","id":"efficiency","label":"efficiency"}],"numerator":[{"kind":"slot","id":"E_useful","label":"useful output energy"}],"denominator":[{"kind":"slot","id":"E_in","label":"total input energy"}]},"rearrangement_forms":{"default_subject":"E_useful","variants":[{"subject":"E_useful","correct":"E_useful = efficiency × E_in","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"E_in","correct":"E_in = E_useful / efficiency","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"efficiency","correct":"efficiency = E_useful / E_in","distractor_patterns":["invert_fraction","multiply_instead"]}]}}'::jsonb
      WHEN 'efficiency_power' THEN elem || '{"substitution_template":{"layout":"fraction","lhs":[{"kind":"slot","id":"efficiency","label":"efficiency"}],"numerator":[{"kind":"slot","id":"P_useful","label":"useful power output"}],"denominator":[{"kind":"slot","id":"P_in","label":"total power input"}]},"rearrangement_forms":{"default_subject":"P_useful","variants":[{"subject":"P_useful","correct":"P_useful = efficiency × P_in","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"P_in","correct":"P_in = P_useful / efficiency","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"efficiency","correct":"efficiency = P_useful / P_in","distractor_patterns":["invert_fraction","multiply_instead"]}]}}'::jsonb
      ELSE elem
    END
  )
  FROM jsonb_array_elements(equations) AS elem
)
WHERE id = 'physics_p1_ht';

UPDATE equation_sheets
SET equations = (
  SELECT jsonb_agg(
    CASE elem->>'id'
      WHEN 'efficiency_energy' THEN elem || '{"substitution_template":{"layout":"fraction","lhs":[{"kind":"slot","id":"efficiency","label":"efficiency"}],"numerator":[{"kind":"slot","id":"E_useful","label":"useful output energy"}],"denominator":[{"kind":"slot","id":"E_in","label":"total input energy"}]},"rearrangement_forms":{"default_subject":"E_useful","variants":[{"subject":"E_useful","correct":"E_useful = efficiency × E_in","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"E_in","correct":"E_in = E_useful / efficiency","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"efficiency","correct":"efficiency = E_useful / E_in","distractor_patterns":["invert_fraction","multiply_instead"]}]}}'::jsonb
      WHEN 'efficiency_power' THEN elem || '{"substitution_template":{"layout":"fraction","lhs":[{"kind":"slot","id":"efficiency","label":"efficiency"}],"numerator":[{"kind":"slot","id":"P_useful","label":"useful power output"}],"denominator":[{"kind":"slot","id":"P_in","label":"total power input"}]},"rearrangement_forms":{"default_subject":"P_useful","variants":[{"subject":"P_useful","correct":"P_useful = efficiency × P_in","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"P_in","correct":"P_in = P_useful / efficiency","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"efficiency","correct":"efficiency = P_useful / P_in","distractor_patterns":["invert_fraction","multiply_instead"]}]}}'::jsonb
      ELSE elem
    END
  )
  FROM jsonb_array_elements(equations) AS elem
)
WHERE id = 'triple_physics_p1_ft';

UPDATE equation_sheets
SET equations = (
  SELECT jsonb_agg(
    CASE elem->>'id'
      WHEN 'efficiency_energy' THEN elem || '{"substitution_template":{"layout":"fraction","lhs":[{"kind":"slot","id":"efficiency","label":"efficiency"}],"numerator":[{"kind":"slot","id":"E_useful","label":"useful output energy"}],"denominator":[{"kind":"slot","id":"E_in","label":"total input energy"}]},"rearrangement_forms":{"default_subject":"E_useful","variants":[{"subject":"E_useful","correct":"E_useful = efficiency × E_in","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"E_in","correct":"E_in = E_useful / efficiency","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"efficiency","correct":"efficiency = E_useful / E_in","distractor_patterns":["invert_fraction","multiply_instead"]}]}}'::jsonb
      WHEN 'efficiency_power' THEN elem || '{"substitution_template":{"layout":"fraction","lhs":[{"kind":"slot","id":"efficiency","label":"efficiency"}],"numerator":[{"kind":"slot","id":"P_useful","label":"useful power output"}],"denominator":[{"kind":"slot","id":"P_in","label":"total power input"}]},"rearrangement_forms":{"default_subject":"P_useful","variants":[{"subject":"P_useful","correct":"P_useful = efficiency × P_in","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"P_in","correct":"P_in = P_useful / efficiency","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"efficiency","correct":"efficiency = P_useful / P_in","distractor_patterns":["invert_fraction","multiply_instead"]}]}}'::jsonb
      ELSE elem
    END
  )
  FROM jsonb_array_elements(equations) AS elem
)
WHERE id = 'triple_physics_p1_ht';
