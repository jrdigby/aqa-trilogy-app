-- Strip wrong-option tips from MCQ flashcard backs.
-- Practice feedback (missing.text) keeps the tip; flashcards should only show
-- the correct answer (+ generic mark-point feedback when present).

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
          WHEN NULLIF(trim(COALESCE(t.m->>'answer_label', t.m->>'answer', '')), '') IS NOT NULL
               AND EXISTS (
                 SELECT 1
                 FROM public.answer_keys ak
                 CROSS JOIN LATERAL jsonb_each_text(COALESCE(ak.key_payload->'option_feedback', '{}'::jsonb)) AS fb(opt, tip)
                 WHERE ak.question_id = a.question_id
                   AND ak.key_type = 'mcq'
                   AND NULLIF(trim(fb.tip), '') IS NOT NULL
                   AND position(lower(trim(fb.tip)) IN lower(COALESCE(t.m->>'flashcard_text', ''))) > 0
               )
            THEN t.m || jsonb_build_object(
              'flashcard_text',
              trim(COALESCE(NULLIF(trim(t.m->>'answer_label'), ''), NULLIF(trim(t.m->>'answer'), '')))
            )
          ELSE t.m
        END AS item
      FROM jsonb_array_elements(a.feedback_payload->'missing') WITH ORDINALITY AS t(m, ord)
    ) enriched
  ), a.feedback_payload->'missing')
)
WHERE a.feedback_payload ? 'missing'
  AND jsonb_typeof(a.feedback_payload->'missing') = 'array'
  AND EXISTS (
    SELECT 1
    FROM public.questions q
    JOIN public.answer_keys ak ON ak.question_id = q.id AND ak.key_type = 'mcq'
    WHERE q.id = a.question_id
      AND q.question_type = 'mcq'
      AND COALESCE(ak.key_payload->'option_feedback', '{}'::jsonb) <> '{}'::jsonb
  )
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(a.feedback_payload->'missing') m
    JOIN public.answer_keys ak ON ak.question_id = a.question_id AND ak.key_type = 'mcq'
    CROSS JOIN LATERAL jsonb_each_text(COALESCE(ak.key_payload->'option_feedback', '{}'::jsonb)) AS fb(opt, tip)
    WHERE NULLIF(trim(fb.tip), '') IS NOT NULL
      AND position(lower(trim(fb.tip)) IN lower(COALESCE(m->>'flashcard_text', ''))) > 0
  );
