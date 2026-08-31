-- Enrich flashcard backs that only stored mark-point explanations
-- (feedback_if_missing) without the actual answer (point_text).

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
          WHEN NULLIF(trim(t.m->>'flashcard_text'), '') IS NOT NULL THEN t.m
          WHEN NULLIF(trim(mp.point_text), '') IS NOT NULL THEN
            t.m || jsonb_build_object(
              'point_text', mp.point_text,
              'flashcard_text',
                trim(both E'\n' FROM (
                  replace(mp.point_text, '|', ' / ')
                  || CASE
                       WHEN NULLIF(trim(mp.feedback_if_missing), '') IS NOT NULL
                            AND position(
                              lower(replace(mp.point_text, '|', ' / '))
                              IN lower(mp.feedback_if_missing)
                            ) = 0
                       THEN E'\n\n' || trim(mp.feedback_if_missing)
                       ELSE ''
                     END
                ))
            )
          ELSE t.m
        END AS item
      FROM jsonb_array_elements(a.feedback_payload->'missing') WITH ORDINALITY AS t(m, ord)
      LEFT JOIN LATERAL (
        SELECT mp.point_text, mp.feedback_if_missing
        FROM public.mark_points mp
        WHERE mp.question_id = a.question_id
          AND NULLIF(trim(mp.feedback_if_missing), '') IS NOT NULL
          AND trim(mp.feedback_if_missing) = trim(COALESCE(t.m->>'text', ''))
        ORDER BY mp.max_marks DESC NULLS LAST
        LIMIT 1
      ) mp ON true
    ) enriched
  ), a.feedback_payload->'missing')
)
WHERE a.feedback_payload ? 'missing'
  AND jsonb_typeof(a.feedback_payload->'missing') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(a.feedback_payload->'missing') m
    JOIN public.mark_points mp
      ON mp.question_id = a.question_id
     AND trim(COALESCE(mp.feedback_if_missing, '')) = trim(COALESCE(m->>'text', ''))
    WHERE NULLIF(trim(m->>'flashcard_text'), '') IS NULL
      AND NULLIF(trim(mp.point_text), '') IS NOT NULL
  );
