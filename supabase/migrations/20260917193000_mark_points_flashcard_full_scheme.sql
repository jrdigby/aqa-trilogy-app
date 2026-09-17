-- Multi-mark short-text flashcards previously stored only missed checkpoints,
-- so partial credit dropped earned terms (e.g. "Salt" from "Salt, hydrogen").
-- Rewrite the first missing flashcard_text to the full mark-point answer list.

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
          WHEN t.ord = 1 AND NULLIF(trim(scheme.full_label), '') IS NOT NULL
            THEN (t.m - 'flashcard_text') || jsonb_build_object('flashcard_text', scheme.full_label)
          WHEN t.ord > 1 AND t.m ? 'flashcard_text'
            THEN t.m - 'flashcard_text'
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
          SELECT string_agg(label, ', ' ORDER BY ord) AS raw_label
          FROM (
            SELECT
              replace(trim(mp.point_text), '|', ' / ') AS label,
              row_number() OVER (ORDER BY mp.id) AS ord
            FROM public.mark_points mp
            WHERE mp.question_id = a.question_id
              AND NULLIF(trim(mp.point_text), '') IS NOT NULL
          ) pts
        ) labeled
      ) scheme
    ) enriched
  ), a.feedback_payload->'missing')
)
WHERE a.feedback_payload ? 'missing'
  AND jsonb_typeof(a.feedback_payload->'missing') = 'array'
  AND EXISTS (
    SELECT 1
    FROM public.questions q
    JOIN public.answer_keys ak ON ak.question_id = q.id
    WHERE q.id = a.question_id
      AND q.question_type = 'short_text'
      AND ak.key_type = 'keywords'
  )
  AND (
    SELECT count(*)
    FROM public.mark_points mp
    WHERE mp.question_id = a.question_id
      AND NULLIF(trim(mp.point_text), '') IS NOT NULL
  ) >= 2;
