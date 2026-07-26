-- Combined science: transformer power form is Paper 1 HT only (6.2.4.3 National Grid).
-- Triple science: both transformer equations stay on Paper 2 HT (4.7.3.4).

-- Remove power-form transformer from combined P2 (any tier) and all FT P2 sheets.
UPDATE equation_sheets
SET equations = (
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  FROM jsonb_array_elements(equations) AS elem
  WHERE elem->>'id' <> 'transformer'
)
WHERE id IN ('physics_p2_ft', 'physics_p2_ht', 'triple_physics_p2_ft');

-- Ensure combined Paper 1 HT has the power-form transformer (electricity / National Grid).
UPDATE equation_sheets
SET equations = equations || $eq$[
  {
    "label": "Transformer",
    "latex": "V_p I_p = V_s I_s",
    "id": "transformer",
    "topic_tags": ["electricity"],
    "substitution_template": {
      "layout": "fraction",
      "lhs": [{"kind": "slot", "id": "V_s", "label": "V_s"}],
      "numerator": [
        {"kind": "slot", "id": "V_p", "label": "V_p"},
        {"kind": "op", "text": "×"},
        {"kind": "slot", "id": "I_p", "label": "I_p"}
      ],
      "denominator": [{"kind": "slot", "id": "I_s", "label": "I_s"}]
    },
    "rearrangement_forms": {
      "default_subject": "I_s",
      "variants": [
        {"subject": "V_p", "correct": "V_p = V_s × I_s / I_p", "distractor_patterns": ["invert_fraction", "multiply_instead"]},
        {"subject": "I_p", "correct": "I_p = V_s × I_s / V_p", "distractor_patterns": ["invert_fraction", "multiply_instead"]},
        {"subject": "I_s", "correct": "I_s = V_p × I_p / V_s", "distractor_patterns": ["invert_fraction", "multiply_instead"]}
      ]
    }
  }
]$eq$::jsonb
WHERE id = 'physics_p1_ht'
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(equations) AS elem WHERE elem->>'id' = 'transformer'
  );

-- Triple Physics HT Paper 2: add turns-ratio substitution template.
UPDATE equation_sheets
SET equations = (
  SELECT jsonb_agg(
    CASE elem->>'id'
      WHEN 'transformer_turns' THEN elem || '{"substitution_template":{"layout":"fraction","lhs":[{"kind":"slot","id":"V_s","label":"V_s"}],"numerator":[{"kind":"slot","id":"V_p","label":"V_p"},{"kind":"op","text":"×"},{"kind":"slot","id":"n_s","label":"n_s"}],"denominator":[{"kind":"slot","id":"n_p","label":"n_p"}]},"rearrangement_forms":{"default_subject":"n_s","variants":[{"subject":"V_p","correct":"V_p = V_s × n_p / n_s","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"n_p","correct":"n_p = V_p × n_s / V_s","distractor_patterns":["invert_fraction","multiply_instead"]},{"subject":"n_s","correct":"n_s = V_s × n_p / V_p","distractor_patterns":["invert_fraction","multiply_instead"]}]}}'::jsonb
      ELSE elem
    END
  )
  FROM jsonb_array_elements(equations) AS elem
)
WHERE id = 'triple_physics_p2_ht';
