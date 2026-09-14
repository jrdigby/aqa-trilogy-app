-- Profile updates fail with 403 if authenticated cannot execute the check function.
grant execute on function public.science_subjects_valid(jsonb) to anon, authenticated;
