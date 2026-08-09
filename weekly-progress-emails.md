# Weekly progress emails (Resend)

Opt-in Sunday digests for all students, with optional parent/guardian Cc.

## What was built

| Piece | Location |
|--------|----------|
| Schema + RPC | [`supabase/migrations/20260808180216_weekly_progress_reports.sql`](supabase/migrations/20260808180216_weekly_progress_reports.sql) |
| Settings UI | [`app.html`](app.html) → Progress emails; wired in [`src/app.js`](src/app.js) / [`src/onboardingEngine.js`](src/onboardingEngine.js) / [`src/dbClient.js`](src/dbClient.js) |
| Sender | [`supabase/functions/send-weekly-reports/index.ts`](supabase/functions/send-weekly-reports/index.ts) |

**Remote DB:** profile columns, `weekly_report_sends`, and `build_weekly_progress_report` are applied on the Science revision app project.

## Profile columns

- `weekly_report_enabled` (default false)
- `parent_email` (nullable, format-checked)
- `parent_email_enabled` (default false)
- `weekly_report_unsubscribed_at` (hard stop)

## Edge Function secrets

Set in Supabase Dashboard → Edge Functions → Secrets (or CLI):

| Secret | Purpose |
|--------|---------|
| `RESEND_API_KEY` | Resend API key |
| `REPORT_FROM_EMAIL` | e.g. `AQA Trilogy <reports@yourdomain.com>` |
| `WEEKLY_REPORTS_DRY_RUN` | `true` (default if unset) or `false` for live sends |
| `WEEKLY_REPORTS_CRON_SECRET` | Shared secret (`x-weekly-reports-secret` header) |
| `APP_URL` | Link in the email CTA |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to Edge Functions.

## Deploy function

```bash
supabase functions deploy send-weekly-reports --project-ref hemcttqmhptwgxxrtolh
```

## Manual test (dry-run)

With `WEEKLY_REPORTS_DRY_RUN=true` (or no Resend key), invoke:

```bash
curl -X POST "https://hemcttqmhptwgxxrtolh.supabase.co/functions/v1/send-weekly-reports" \
  -H "Authorization: Bearer YOUR_ANON_OR_SERVICE_KEY" \
  -H "x-weekly-reports-secret: YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"as_of\":\"2026-08-09\"}"
```

Check `weekly_report_sends` for `status = dry_run` and `payload_summary`.

## Resend domain (production)

1. Create a [Resend](https://resend.com) account and API key.
2. Add and verify your domain (DNS: SPF, DKIM).
3. Set `REPORT_FROM_EMAIL` to an address on that domain.
4. Set `WEEKLY_REPORTS_DRY_RUN=false`.
5. Until the domain is verified, you can dry-run and (with limits) test via Resend’s onboarding address.

You do **not** need the custom domain to ship Settings + schema + dry-run cron.

## Schedule (Sunday ~17:00 London)

There is **no “Schedules” tab under Edge Functions**. Scheduling is done with **Supabase Cron** (`pg_cron`) calling the function over HTTP (`pg_net`).

### Option A — Dashboard Cron UI (easiest)

1. Open **Integrations → Cron**  
   https://supabase.com/dashboard/project/hemcttqmhptwgxxrtolh/integrations/cron/overview  
2. Enable the Cron / `pg_cron` integration if prompted.  
3. Create a job that **invokes an Edge Function** (or runs SQL — Option B).  
4. Function: `send-weekly-reports`  
5. Schedule: Sundays. Use `0 16 * * 0` (16:00 UTC ≈ 17:00 BST) or `0 17 * * 0` in winter (GMT).  
6. If the UI lets you set HTTP headers, add:
   - `x-weekly-reports-secret`: same value as Edge secret `WEEKLY_REPORTS_CRON_SECRET`
   - `Authorization`: `Bearer <anon or service_role key>` (often required for functions)

That header is the **other place** the cron secret goes — not a second Secrets screen.

### Option B — SQL Editor (reliable)

1. Enable extensions if needed: **Database → Extensions** → `pg_cron` and `pg_net`.  
2. In **SQL Editor**, run (paste your real secret and anon/publishable key):

```sql
select cron.schedule(
  'weekly-progress-reports',
  '0 16 * * 0',  -- Sunday 16:00 UTC (~17:00 London in BST)
  $$
  select net.http_post(
    url := 'https://hemcttqmhptwgxxrtolh.supabase.co/functions/v1/send-weekly-reports',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SUPABASE_ANON_KEY',
      'x-weekly-reports-secret', 'YOUR_WEEKLY_REPORTS_CRON_SECRET'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

List jobs: `select * from cron.job;`  
Unschedule: `select cron.unschedule('weekly-progress-reports');`

Idempotency: unique `(user_id, week_start)` on `weekly_report_sends`.
