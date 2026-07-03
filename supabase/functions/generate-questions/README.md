# generate-questions

Supabase Edge Function — AI MCQ and short-text drafts for admin Question Studio.

## Secrets

```bash
supabase secrets set GEMINI_API_KEY=your_key_here
# optional:
supabase secrets set GEMINI_MODEL=gemini-2.5-flash
```

## Deploy

```bash
supabase functions deploy generate-questions
```

Requires caller JWT with `profiles.role = developer`.
