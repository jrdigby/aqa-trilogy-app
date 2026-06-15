# Production Rollout Plan

**Last updated:** June 2026

## Decisions confirmed

| Decision | Choice |
|----------|--------|
| Pricing model | **Hybrid** ΓÇö Student Pro + school/class licences |
| Free vs Pro split | **[`gcse-competitive-analysis-and-growth.md`](gcse-competitive-analysis-and-growth.md) ┬º5.5** ΓÇö SRS free unlimited; gate AI marks, paper sims, PDF flashcards, full analytics |
| Product name | **TBD** |
| Domain / hosting | **Deferred** |

---

## Phase status

| Phase | Scope | Status |
|-------|--------|--------|
| **1B** | Landing page, `app.html` split, password reset, Terms/Privacy | **Done** |
| **1A** | Domain, Cloudflare Pages, production Supabase URLs | Deferred |
| **2** | Free vs Pro feature gates | **Next** ΓÇö see [`free_vs_pro_plan.md`](free_vs_pro_plan.md) |
| **3** | Stripe Student Pro checkout | Pending |
| **4** | Class licence billing | Pending |
| **5** | Launch polish | Pending |

---

## Free vs Pro (summary)

Full implementation spec: **[`free_vs_pro_plan.md`](free_vs_pro_plan.md)**

| Free | Student Pro |
|------|-------------|
| Unlimited SRS practice | Same |
| MCQ / short answer / numeric | Same |
| Quick exam prep (10/20 Q) | Same |
| 3 AI long-answer marks / week | Unlimited AI marking |
| Basic heatmap | Click-to-practise heatmap |
| In-app flashcards | + PDF export |
| Analytics summary | Full analytics dashboard |
| ΓÇö | Half/full paper sims (35/70 marks) |

**Important:** This replaces the earlier draft that capped Start Practice at 15 questions/day. The competitive analysis keeps SRS unlimited on free.

---

## Next step

Switch to **agent mode** and ask to **"implement free vs pro gates (Phase 2)"** to build `featureAccess.js`, migration, app gates, upgrade modal, and update the landing page pricing table.
