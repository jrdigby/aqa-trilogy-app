-- TRUNCATE is not subject to RLS; remove it from authenticated on content tables.
revoke truncate, references, trigger on table public.questions from authenticated;
revoke truncate, references, trigger on table public.answer_keys from authenticated;
revoke truncate, references, trigger on table public.mark_points from authenticated;
