-- Enrich MCQ flashcard backs with the correct option text + letter where missing.

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
          WHEN NULLIF(trim(t.m->>'answer'), '') IS NOT NULL
               AND NULLIF(trim(t.m->>'answer_label'), '') IS NOT NULL
            THEN t.m
          WHEN NULLIF(trim(correct_opt.answer), '') IS NOT NULL THEN
            t.m || jsonb_build_object(
              'answer', correct_opt.answer,
              'answer_label', correct_opt.answer_label,
              'flashcard_text',
                trim(both E'\n' FROM (
                  correct_opt.answer_label
                  || CASE
                       WHEN NULLIF(trim(t.m->>'flashcard_text'), '') IS NOT NULL
                            AND position(
                              lower(correct_opt.answer)
                              IN lower(t.m->>'flashcard_text')
                            ) = 0
                            AND t.m->>'flashcard_text' !~* 'the correct answer is'
                       THEN E'\n\n' || trim(t.m->>'flashcard_text')
                       WHEN NULLIF(trim(t.m->>'flashcard_text'), '') IS NULL
                            AND NULLIF(trim(regexp_replace(
                              COALESCE(t.m->>'text', ''),
                              '\s*This question has been added to your flashcard list\.?\s*$',
                              '',
                              'i'
                            )), '') IS NOT NULL
                            AND position(
                              lower(correct_opt.answer)
                              IN lower(COALESCE(t.m->>'text', ''))
                            ) = 0
                            AND COALESCE(t.m->>'text', '') !~* 'the correct answer is'
                       THEN E'\n\n' || trim(regexp_replace(
                         COALESCE(t.m->>'text', ''),
                         '\s*This question has been added to your flashcard list\.?\s*$',
                         '',
                         'i'
                       ))
                       ELSE ''
                     END
                ))
            )
          ELSE t.m
        END AS item
      FROM jsonb_array_elements(a.feedback_payload->'missing') WITH ORDINALITY AS t(m, ord)
      CROSS JOIN LATERAL (
        SELECT
          ans.answer,
          CASE
            WHEN ans.idx IS NULL THEN ans.answer
            ELSE chr(65 + ans.idx) || '. ' || ans.answer
          END AS answer_label
        FROM (
          SELECT
            COALESCE(ak.key_payload->>'correct', ak.key_payload->>'answer') AS answer,
            (
              SELECT (opt.ord - 1)::int
              FROM public.questions q2
              CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(q2.options, '[]'::jsonb))
                WITH ORDINALITY AS opt(val, ord)
              WHERE q2.id = a.question_id
                AND opt.val = COALESCE(ak.key_payload->>'correct', ak.key_payload->>'answer')
              LIMIT 1
            ) AS idx
          FROM public.answer_keys ak
          WHERE ak.question_id = a.question_id
            AND ak.key_type = 'mcq'
          LIMIT 1
        ) ans
      ) correct_opt
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
      AND NULLIF(trim(COALESCE(ak.key_payload->>'correct', ak.key_payload->>'answer')), '') IS NOT NULL
  )
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(a.feedback_payload->'missing') m
    WHERE NULLIF(trim(m->>'answer_label'), '') IS NULL
  );
