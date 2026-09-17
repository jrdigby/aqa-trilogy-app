-- pick_n flashcard backs previously stored only unmatched pool items, so partial
-- credit dropped matched terms (e.g. "ions" from "positive / +, ions").
-- Rewrite flashcard_text to the full acceptable pool.

UPDATE public.attempts a
SET feedback_payload = jsonb_set(
  a.feedback_payload,
  '{missing}',
  COALESCE((
    SELECT jsonb_agg(enriched.item ORDER BY enriched.ord)
    FROM (
      SELECT
        t.ord,
        CASE
          WHEN NULLIF(trim(pool.full_label), '') IS NOT NULL
            THEN t.m || jsonb_build_object('flashcard_text', pool.full_label)
          ELSE t.m
        END AS item
      FROM jsonb_array_elements(a.feedback_payload->'missing') WITH ORDINALITY AS t(m, ord)
      CROSS JOIN LATERAL (
        SELECT
          CASE
            WHEN NULLIF(trim(raw_label), '') IS NULL THEN NULL
            ELSE
              upper(left(trim(raw_label), 1))
              || substr(trim(raw_label), 2)
              || CASE
                   WHEN right(trim(raw_label), 1) ~ '[.!?]' THEN ''
                   ELSE '.'
                 END
          END AS full_label
        FROM (
          SELECT string_agg(
            replace(elem, '|', ' / '),
            ', '
            ORDER BY ord
          ) AS raw_label
          FROM public.answer_keys ak
          CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(ak.key_payload->'pool', '[]'::jsonb))
            WITH ORDINALITY AS p(elem, ord)
          WHERE ak.question_id = a.question_id
            AND ak.key_type = 'pick_n'
        ) labeled
      ) pool
    ) enriched
  ), a.feedback_payload->'missing')
)
WHERE a.feedback_payload ? 'missing'
  AND jsonb_typeof(a.feedback_payload->'missing') = 'array'
  AND EXISTS (
    SELECT 1
    FROM public.answer_keys ak
    WHERE ak.question_id = a.question_id
      AND ak.key_type = 'pick_n'
      AND jsonb_typeof(ak.key_payload->'pool') = 'array'
      AND jsonb_array_length(ak.key_payload->'pool') > 0
  )
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(a.feedback_payload->'missing') m
    WHERE NULLIF(trim(COALESCE(m->>'flashcard_text', '')), '') IS NOT NULL
  );
