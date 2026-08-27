# Ask an expert

Students can flag a practice question for developer review. You get an in-app admin inbox plus email; you send **one** written reply the student reads under Settings → Expert replies.

## What was built

| Piece | Location |
|--------|----------|
| Schema + RPCs | [`supabase/migrations/20260827120000_ask_expert.sql`](supabase/migrations/20260827120000_ask_expert.sql) |
| Submit + email | [`supabase/functions/submit-expert-query/index.ts`](supabase/functions/submit-expert-query/index.ts) |
| Shared helpers | [`src/askExpert.js`](src/askExpert.js) |
| Student UI | [`app.html`](app.html) + [`src/app.js`](src/app.js) |
| Admin inbox | [`admin.html`](admin.html) Expert Queries tab + [`src/admin/adminExpertQueries.js`](src/admin/adminExpertQueries.js) |

## Student flow

1. During practice, tap **Ask an expert** under the question.
2. Choose a reason (misconception vs suspected content error) and optional note.
3. Edge Function inserts `expert_queries` (snapshot of stem, correct answer summary, student response) and emails you.
4. When you reply, the student sees it in **Settings → Expert replies** (unread badge on Settings).

Anti-spam: one open flag per question, max 5 open overall, max 10 creates per UTC day.

## Admin flow

1. Open **Expert Queries** in [`admin.html`](admin.html) (mobile-friendly list → detail).
2. Review category, student message, question, correct answer summary, student response/score.
3. **Send reply** or **Dismiss**, or **Edit question** (opens the live edit modal).

Deep link from email:

```text
https://YOUR_HOST/admin.html#expert&id=<query-uuid>
```

## Edge Function secrets

Set in Supabase Dashboard → Edge Functions → Secrets (or CLI):

| Secret | Purpose |
|--------|---------|
| `RESEND_API_KEY` | Resend API key (shared with weekly reports) |
| `ADMIN_NOTIFY_EMAIL` | Your inbox for new flags |
| `APP_ADMIN_BASE_URL` | Origin for deep links, e.g. `https://your-site.example` (no trailing slash). Falls back to `APP_URL`. |
| `REPORT_FROM_EMAIL` or `EXPERT_FROM_EMAIL` | From address (verified Resend domain) |
| `EXPERT_NOTIFY_DRY_RUN` | Set `true` to skip live send while testing |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically.

Submit still succeeds if email is skipped (missing `ADMIN_NOTIFY_EMAIL` / Resend); check the function response `email` field.

## Deploy function

```bash
supabase functions deploy submit-expert-query --project-ref hemcttqmhptwgxxrtolh
```

(Already deployable via Dashboard / MCP; re-run after local edits.)

## Smoke checklist

1. As a **student**, open a practice question → Ask an expert → send with a note.
2. Confirm a row appears in `expert_queries` with `status = open` and a populated `snapshot`.
3. Confirm email arrives (or `email.skipped` / dry-run in the function response if secrets unset).
4. As **developer**, open Expert Queries → see the item with Q / correct answer / student response / note.
5. Send a reply → student Settings shows unread Expert replies → opening marks seen.
6. Optional: Dismiss path; rate-limit by flagging the same question twice while open.
7. Email deep link `#expert&id=…` opens the Expert Queries tab on that row.

## Out of scope (v1)

- Multi-message threads
- Teacher-facing queue
- Push / Slack / SMS notifications
