# Later security & content-protection tasks

Follow-ups after the 2025-07-24 RLS lockdown on `questions`, `answer_keys`, and `mark_points` (authenticated read, developer-only write). Smoke-test of that change passed.

## After domain / website URL is live

- [ ] Put the site (and ideally API traffic) behind Cloudflare (or equivalent).
- [ ] Rate-limit sensitive paths (e.g. Supabase REST / practice API proxies) by IP and/or authenticated user.
- [ ] Confirm custom domain + SSL; avoid relying on the raw `*.supabase.co` URL in production UX where possible.

## Content scrape / IP protection (architecture)

Rate limiting alone will not protect ~965 curated rows if clients can still `SELECT` the full bank. Next real controls:

- [ ] Stop shipping full `answer_keys` / mark schemes to the browser for marking.
- [ ] Mark via Edge Functions (or RPCs) using the service role; return scores/feedback only.
- [ ] Optionally serve practice questions via constrained RPCs (“next N for this session”) instead of open table reads of the whole bank.
- [ ] Revisit authenticated `SELECT` on `answer_keys` / `mark_points` once server-side marking is in place (likely developer-only or no client read).

## Related hardening (optional / opportunistic)

- [ ] Audit other content-adjacent tables with broad read policies (e.g. `spec_points`, `equation_sheets`, `question_skills`) for the same anon vs authenticated posture.
- [ ] CAPTCHA / Auth rate-limit review at signup (Supabase Auth dashboard) to reduce throwaway accounts used for scraping.
- [ ] Monitor API usage for bulk `questions` / `answer_keys` reads after launch.

## Explicitly out of scope for hosted Supabase

- Configuring Kong rate limits on the managed API gateway (not customer-configurable like self-hosted).
- Treating Auth-only rate limits as protection for PostgREST table scraping.
