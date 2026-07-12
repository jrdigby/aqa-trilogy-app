# generate-questions

Supabase Edge Function — AI MCQ, short-text, and extended-response drafts for admin Question Studio.

## Secrets

```bash
supabase secrets set GEMINI_API_KEY=your_key_here
# optional (defaults to gemini-2.5-flash-lite):
supabase secrets set GEMINI_MODEL=gemini-2.5-flash-lite
```

## Request body

- `subject`, `paper`, `tier`, `spec_ref`, `topic_name`, `spec_text` (required)
- `recipes[]` — `{ question_type, demand_level, max_marks? }` where:
  - `mcq` — 1 mark (ignore `max_marks`)
  - `short_text` — `max_marks` 1 or 2
  - `extended_response` — `max_marks` 4 or 6
- `author_prompt` (optional) — shared focus instruction for the whole run
- `avoid_questions`, `focus_offset` — gap-fill / variety helpers

Keep prompt/schema logic in sync with `src/geminiQuestionCore.js`.

## Deploy

After changing this function, redeploy:

```bash
supabase functions deploy generate-questions
```

Requires caller JWT with `profiles.role = developer`.
