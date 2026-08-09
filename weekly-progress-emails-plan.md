# Weekly progress email reports

**Status:** Implemented (schema + Settings + Edge Function + docs). Deploy function + Resend secrets + cron still needed for live sends.

## Product decisions (locked)

- **Audience:** all students (not Pro-gated)
- **Opt-in:** weekly digest off by default; student enables in Settings
- **Parent/guardian:** optional email; when set + enabled, same digest is **Cc’d**
- **Provider:** Resend
- **Send window:** Sunday **17:00 Europe/London**
- **Schema:** explicit columns on `profiles` (not jsonb prefs)

## Do you need a domain first?

No. Build schema, Settings, report RPC, and Edge Function (dry-run) now. Resend test sending works without a custom domain; verify a domain before production cutover.

## Email contents

1. **Last week** — topics practised + weighted score %
2. **Pace** — behind (overdue > 0) / on track / ahead (no overdue, nothing due today)
3. **Coming week** — A) new (`repetitions = 0`) B) recurring (`repetitions > 0`) + overdue list
4. **Light engagement** — streak + XP

## Architecture

- Migration: profile columns + `weekly_report_sends` + `build_weekly_progress_report` RPC
- Settings UI in `app.html` / `src/app.js` / `src/dbClient.js` / `src/onboardingEngine.js`
- Edge Function `send-weekly-reports` (Resend, dry-run flag, parent Cc)
- pg_cron Sunday 17:00 Europe/London
- Secrets: `RESEND_API_KEY`, `REPORT_FROM_EMAIL`, `WEEKLY_REPORTS_DRY_RUN`

## Schema (explicit columns)

```sql
profiles.weekly_report_enabled boolean not null default false
profiles.parent_email text  -- format check constraint
profiles.parent_email_enabled boolean not null default false
profiles.weekly_report_unsubscribed_at timestamptz

weekly_report_sends (
  id, user_id, week_start, sent_at,
  status in ('sent','dry_run','failed','skipped'),
  error, recipient_student, recipient_parent, payload_summary jsonb
  unique (user_id, week_start)
)
```

## Implementation checklist

1. Migration `20260808180216_weekly_progress_reports.sql` (file stub already created by CLI)
2. Settings: Progress emails section
3. RPC `build_weekly_progress_report(p_user_id, p_as_of)`
4. Edge Function + dry-run default
5. Cron schedule + Resend secrets docs

## Out of scope

Parent dashboard, push, Pro-only deep analytics in email, projected intros not yet in `srs_state`.
