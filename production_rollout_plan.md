# Production Rollout Plan

**Last updated:** June 2026

## Decisions confirmed


| Decision          | Choice                                                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pricing model     | **Hybrid** ΓÇö Student Pro + school/class licences                                                                                                                               |
| Free vs Pro split | `**[gcse-competitive-analysis-and-growth.md](gcse-competitive-analysis-and-growth.md)` ┬º5.5** ΓÇö SRS free unlimited; gate AI marks, paper sims, PDF flashcards, full analytics |
| Product name      | **TBD**                                                                                                                                                                          |
| Domain / hosting  | **Deferred**                                                                                                                                                                     |
| Phase 3 timing    | **After Phase 1A** — Stripe checkout once domain and product name are set                                                                                                        |


---

## Phase status


| Phase  | Scope                                                         | Status                                                                                               |
| ------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **1B** | Landing page, `app.html` split, password reset, Terms/Privacy | **Done**                                                                                             |
| **1A** | Domain, Cloudflare Pages, production Supabase URLs            | Deferred                                                                                             |
| **2**  | Free vs Pro feature gates                                     | **Done** — see `[free_vs_pro_plan.md](free_vs_pro_plan.md)`; apply migrations in Supabase SQL Editor |
| **3**  | Stripe Student Pro checkout                                   | **Blocked** — after Phase 1A (domain + product name)                                                 |
| **4**  | Class licence billing                                         | Pending                                                                                              |
| **5**  | Launch polish                                                 | Pending                                                                                              |


---

## Free vs Pro (summary)

Full implementation spec: `**[free_vs_pro_plan.md](free_vs_pro_plan.md)`**


| Free                          | Student Pro                        |
| ----------------------------- | ---------------------------------- |
| Unlimited SRS practice        | Same                               |
| MCQ / short answer / numeric  | Same                               |
| Quick exam prep (10/20 Q)     | Same                               |
| 3 AI long-answer marks / week | Unlimited AI marking               |
| Basic heatmap                 | Click-to-practise heatmap          |
| In-app flashcards             | + PDF export                       |
| Analytics summary             | Full analytics dashboard           |
| ΓÇö                           | Half/full paper sims (35/70 marks) |


**Important:** This replaces the earlier draft that capped Start Practice at 15 questions/day. The competitive analysis keeps SRS unlimited on free.

---

## Next step

Apply pending Supabase migrations if not already run:

1. `[supabase/migrations/20250617_free_pro_gates.sql](supabase/migrations/20250617_free_pro_gates.sql)` — quotas and billing columns
2. `[supabase/migrations/20250622_developer_grant_pro.sql](supabase/migrations/20250622_developer_grant_pro.sql)` — developer pilot Pro override

**Phase 3 (Stripe)** is deferred until **Phase 1A** is complete — domain/hosting and product name must be set first (Checkout success URLs, Terms/Privacy links, and Stripe product branding all depend on them). Until then, use the admin **Pilot Pro Access** tab for manual upgrades.

**Immediate focus:** Phase 1A when ready, or continued pilot testing via manual Pro override.