# generate-questions

Supabase Edge Function — AI MCQ and short-text drafts for admin Question Studio.

## Secrets

```bash
supabase secrets set GEMINI_API_KEY=your_key_here
# optional (defaults to gemini-2.5-flash-lite):
supabase secrets set GEMINI_MODEL=gemini-2.5-flash-lite
```

Supports optional `avoid_questions` and `focus_offset` in the request body for gap-fill generation (existing preview drafts passed from admin).

## Deploy

```bash
supabase functions deploy generate-questions
```

Requires caller JWT with `profiles.role = developer`.
