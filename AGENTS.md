# Agent / contributor security principles

Follow these when changing auth, RLS, Edge Functions, billing, or AI/metered APIs.

1. **Secrets stay server-side.** Gemini, Resend, and `service_role` keys belong in Edge Function / hosting env only. Never commit them. Client may only use the publishable Supabase URL + anon key (prefer `window.__SUPABASE_*__` injection in production).
2. **RLS is the default.** Sensitive tables (`answer_keys`, `mark_points`, grants, profiles) must keep RLS on. Prefer grant-scoped / RPC-scoped reads over open authenticated `SELECT` on content banks.
3. **Privilege on the server.** Developer-only and paid-path actions must re-check role / continued access in SQL (`SECURITY DEFINER` with `auth.uid()` / `is_developer()` / `user_has_pro_access`) or Edge Functions — never trust client UI gates alone.
4. **Hard paywall model.** Authenticated students get full product access for 14 days, then a hard lock. There is **no** trial-vs-pro feature split. `user_has_pro_access` means “continued full access” (active trial **or** paid / class / Pilot Pro / developer).
5. **Metered AI must be gated.** Any Edge path that calls Gemini (especially `mark-long-answer`) must authenticate, enforce continued access, prefer session/question access checks, and apply per-user rate limits *before* spending tokens.
6. **Least EXECUTE.** Do not leave `anon` able to execute `SECURITY DEFINER` RPCs. Set `search_path` on new functions. Re-run Supabase security advisors after schema changes.
7. **Input hygiene.** Validate lengths and types at RPC/Edge boundaries; escape user text in HTML; keep password minimums aligned via `src/passwordPolicy.js` (8+).
8. **No Stripe half-measures until Phase 3.** Do not invent client-only Checkout; when Stripe ships, verify webhooks and update continued-access fields server-side.

After security-relevant features, update `later_security_hardening_tasks.md` or the Project store security review rather than leaving gaps undocumented.
