# AI long-answer safeguarding (minors)

**Decisions locked:** block marking and show soft signposting only (1A); student-only (no teacher/school alerts or pastoral logging); **AQA-only** lockdown wording (not AQA/Edexcel).

## Implemented

1. **[`support.html`](support.html)** — soft-signposting page (trusted adults + Childline / Samaritans / NHS 111). Footer **Need support?** links on app, landing, and teacher portal.
2. **[`supabase/functions/mark-long-answer/index.ts`](supabase/functions/mark-long-answer/index.ts)** — keyword precheck → `{ status: "safeguarding" }`; Gemini `safetySettings`; SCOPE LOCK prompt; `submission_status` schema; `SYSTEM_PROMPT_VERSION = v5-safeguard-scope`.
3. **[`src/safeguarding.js`](src/safeguarding.js)** + client handling in [`src/app.js`](src/app.js) / [`src/uiComponents.js`](src/uiComponents.js) — block local failover; off-topic fixed message; no scored attempt on safeguarding.

Deploy note: redeploy the `mark-long-answer` edge function for server changes to take effect.
