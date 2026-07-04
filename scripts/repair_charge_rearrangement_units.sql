-- Repair wrong answer units on Q = I t rearrangement questions (batch generator bug).
-- Affected: answer_keys.key_payload.unit was "C" when solving for I (should be A) or t (should be s).
-- Also patches calculate-step feedback_if_wrong where the unit was baked in as "C".
--
-- Run in Supabase Dashboard → SQL → New query.
-- 1) Run the PREVIEW block first and check the rows.
-- 2) Run the UPDATE blocks inside a transaction; COMMIT if the preview looks right.

-- ── PREVIEW ──────────────────────────────────────────────────────────────────
SELECT
  q.id,
  sub.rearrangement_subject AS solving_for,
  ak.key_payload->>'unit' AS current_unit,
  CASE sub.rearrangement_subject
    WHEN 'I' THEN 'A'
    WHEN 't' THEN 's'
  END AS correct_unit,
  (
    SELECT s->>'feedback_if_wrong'
    FROM jsonb_array_elements(q.calculation_config->'steps') s
    WHERE s->>'type' = 'calculate'
    LIMIT 1
  ) AS calc_feedback
FROM questions q
JOIN answer_keys ak ON ak.question_id = q.id
CROSS JOIN LATERAL (
  SELECT s->>'rearrangement_subject' AS rearrangement_subject
  FROM jsonb_array_elements(q.calculation_config->'steps') s
  WHERE s->>'type' = 'substitution'
    AND s->>'equation_id' = 'charge'
  LIMIT 1
) sub
WHERE q.question_type = 'numeric'
  AND sub.rearrangement_subject IN ('I', 't')
  AND ak.key_payload->>'unit' = 'C'
ORDER BY sub.rearrangement_subject, q.id;

-- ── FIX (wrap in BEGIN … COMMIT) ───────────────────────────────────────────
-- BEGIN;

-- 1) answer_keys.unit
UPDATE answer_keys ak
SET key_payload = jsonb_set(
  ak.key_payload,
  '{unit}',
  to_jsonb(
    CASE sub.rearrangement_subject
      WHEN 'I' THEN 'A'
      WHEN 't' THEN 's'
    END
  )
)
FROM questions q
CROSS JOIN LATERAL (
  SELECT s->>'rearrangement_subject' AS rearrangement_subject
  FROM jsonb_array_elements(q.calculation_config->'steps') s
  WHERE s->>'type' = 'substitution'
    AND s->>'equation_id' = 'charge'
  LIMIT 1
) sub
WHERE ak.question_id = q.id
  AND q.question_type = 'numeric'
  AND sub.rearrangement_subject IN ('I', 't')
  AND ak.key_payload->>'unit' = 'C';

-- 2) calculation_config calculate-step feedback (wrong-mark feedback shown to students)
UPDATE questions q
SET calculation_config = jsonb_set(q.calculation_config, '{steps}', fixed.steps)
FROM (
  SELECT
    q2.id,
    jsonb_agg(
      CASE
        WHEN step->>'type' = 'calculate'
          AND step->>'feedback_if_wrong' ~ ' C\.$'
        THEN jsonb_set(
          step,
          '{feedback_if_wrong}',
          to_jsonb(
            regexp_replace(
              step->>'feedback_if_wrong',
              ' C\.$',
              CASE rearr.rearrangement_subject
                WHEN 'I' THEN ' A.'
                WHEN 't' THEN ' s.'
              END
            )
          )
        )
        ELSE step
      END
      ORDER BY ord
    ) AS steps
  FROM questions q2
  CROSS JOIN LATERAL (
    SELECT s->>'rearrangement_subject' AS rearrangement_subject
    FROM jsonb_array_elements(q2.calculation_config->'steps') s
    WHERE s->>'type' = 'substitution'
      AND s->>'equation_id' = 'charge'
    LIMIT 1
  ) rearr
  CROSS JOIN LATERAL jsonb_array_elements(q2.calculation_config->'steps')
    WITH ORDINALITY AS t(step, ord)
  WHERE rearr.rearrangement_subject IN ('I', 't')
  GROUP BY q2.id
) fixed
WHERE q.id = fixed.id;

-- COMMIT;
