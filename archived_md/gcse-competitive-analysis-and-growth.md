# AQA Trilogy App — Feature Map, Competitive Analysis & Growth Strategy

**Date:** June 2026  
**Product:** AQA Science Spaced Repetition (AQA GCSE Combined Science: Trilogy)

---

## 1. Current feature map

### 1.1 Product positioning

A specialist revision web app for **AQA Combined Science: Trilogy** (Biology, Chemistry, Physics — Papers 1 & 2, Foundation and Higher). Core differentiator: **spec-point-level spaced repetition** combined with **exam-realistic practice** and **AQA-aligned marking**.

### 1.2 User roles

| Role | Portal | Capabilities |
|------|--------|--------------|
| **Student** | `index.html` | Practice, analytics, flashcards, settings, class join |
| **Teacher** | `teacher.html` | Create classes, share join codes, view roster & aggregate progress |
| **Developer/Admin** | `admin.html` | Question bank authoring, CSV import, AI grading sandbox |
| **Parent** | — | Not supported |

### 1.3 Student journey

```
Sign up → 5-step onboarding → Dashboard → Practice / Exam prep / Mastery matrix → Session → Feedback → SRS update
```

**Onboarding captures:** tier (FT/HT), subject preference ranking, subject difficulty ranking, optional teacher class code.

### 1.4 Study & practice features

| Feature | Detail | Maturity |
|---------|--------|----------|
| **Spaced repetition (SRS)** | SM-2-style scheduling per AQA spec point; due queue; 7-day workload forecast | Strong |
| **Scheduled practice** | ~10 questions on next due spec point | Strong |
| **Exam preparation** | Quick sets (10/20 Qs) with adaptive difficulty | Strong |
| **Paper simulation** | Half (35 marks) / full (70 marks) papers assembled to AQA targets (AO split, demand bands, maths %, required practicals) | Strong & distinctive |
| **Mastery heatmap** | Curriculum matrix coloured by SRS mastery | Strong |
| **Question types** | MCQ, short answer, calculations (with ECF), 6-mark extended response | Strong |
| **Marking** | Keyword/fuzzy matching, numeric with units, AI examiner for long answers (Gemini) | Strong |
| **Flashcards** | Auto-generated from failed attempts (“Dynamic Gaps”); PDF export | Strong |
| **Command-word tips** | Per-question AQA command word guidance | Good |
| **Resource links** | YouTube / external links on remediation | Basic |
| **Revision notes** | — | Missing |
| **Past papers (real AQA)** | — | Missing (simulated only) |
| **AI chat tutor** | — | Missing |

### 1.5 Progress & analytics

| Feature | Status |
|---------|--------|
| Subject Mastery Index | Yes |
| AO1/AO2/AO3 breakdown | Yes |
| Recent activity charts (7/14/30/90 days) | Yes |
| Adaptive difficulty (global + per spec point) | Yes |
| FT ↔ HT tier boundary nudges | Yes |
| Attempt history with feedback payloads | Yes |
| Predicted grade / target tracking | No |
| Parent visibility | No |

### 1.6 Engagement & social

| Feature | Status |
|---------|--------|
| Daily login streak | Yes |
| XP / levels / badges | No |
| Leaderboards / leagues | No |
| Peer sharing | No |
| Push notifications / reminders | No |

### 1.7 Teacher features

| Feature | Status |
|---------|--------|
| Class creation + join codes | Yes |
| Roster view (name, tier, onboarded, plan) | Yes |
| Class averages & SRS due/overdue counts | Yes |
| Set homework / assignments | No |
| Per-student drill-down analytics | Limited |
| MIS integration / bulk enrolment | No |
| Parent reports | No |

### 1.8 Commercial & distribution

| Feature | Status |
|---------|--------|
| Subscription tier field (`free` / `paid`) | Schema only |
| Payment / Stripe | No |
| Feature gating by tier | No |
| Marketing landing page | No (app is the entry point) |
| PWA / native mobile app | No (responsive web only) |
| School licensing | No |

### 1.9 Technical stack

Vanilla HTML/CSS/JS → Supabase (Auth, Postgres, RLS, Edge Functions) → Gemini for AI marking. No build step; static hosting.

---

## 2. Competitive landscape (GCSE England)

Students typically use a **stack** of tools, not one app:

| Platform | Price | Breadth | Primary strength | Weakness vs. your app |
|----------|-------|---------|------------------|----------------------|
| **Seneca Learning** | Free + Premium (~£6–12/mo) | All subjects, all major boards | School adoption, homework, gamification, brand trust | Less granular AQA paper assembly; SRS less visible to student |
| **BBC Bitesize** | Free | All subjects | Trusted explanations, videos, accessibility | Weak on exam technique & personalisation |
| **Save My Exams** | ~£4–12/mo | Wide GCSE/A-Level | Examiner notes, topic Qs, real past papers & model answers | Passive reading; limited adaptive scheduling |
| **Smart Revise** | School licence | Subject-specific (strong in CS etc.) | Teacher assignments, mock exams, proven school outcomes | Narrower subject coverage |
| **RevisePal** | School + app | Multi-subject | Homework workflow, mobile app, teacher-student messaging | Less deep science-specific marking |
| **UpGrades** | Freemium | 85+ subjects, 6 boards | Parent dashboard, adaptive paths, school analytics | Generic breadth over Trilogy depth |
| **ExAIm / Revision Genie** | Freemium | Growing GCSE coverage | AI tutor, XP/badges/leagues, 24/7 help | Newer; less spec-point SRS depth |
| **Corbettmaths / Maths Genie** | Free | Maths | Best-in-class free maths | Science-only competitors |

### 2.1 Feature comparison matrix

| Capability | Your app | Seneca | Save My Exams | BBC Bitesize | ExAIm / Rev Genie |
|------------|----------|--------|---------------|--------------|-------------------|
| AQA Trilogy spec-point mapping | ✅ Deep | ✅ | ✅ | ✅ | Partial |
| Spaced repetition schedule | ✅ Core | ✅ | ❌ | ❌ | Partial |
| Real AQA past papers | ❌ | Partial | ✅ | Some | Partial |
| Revision notes / explainers | ❌ | ✅ | ✅ | ✅ | ✅ (AI) |
| AI long-answer marking | ✅ | Premium | ❌ | ❌ | ✅ |
| AI chat tutor | ❌ | Premium (Amelia) | ❌ | ❌ | ✅ |
| Exam paper simulation (AO/demand) | ✅ Distinctive | Partial | ❌ | ❌ | Partial |
| Gap-driven flashcards | ✅ | Premium modes | ✅ | ❌ | Partial |
| Teacher homework setting | ❌ | ✅ | ❌ | ❌ | Partial |
| Parent dashboard | ❌ | Partial | ❌ | ❌ | Partial |
| Gamification (XP, badges, leagues) | Streak only | ✅ | ❌ | ❌ | ✅ |
| Mobile app / PWA | Web only | ✅ | Web | Web/App | Web |
| Multi-subject (full GCSE load) | Science only | ✅ | ✅ | ✅ | ✅ |
| Free tier students actually use | Unclear | ✅ Strong | Limited | ✅ | ✅ |
| School trust / social proof | ❌ | ✅ 300k+ teachers | ✅ | ✅ BBC | Growing |

---

## 3. Key missing features (prioritised)

### 3.1 Critical for acquisition (why students don’t sign up)

1. **No marketing landing page** — Students discover Seneca/Bitesize first. There is no SEO, no “what is this?” page, no social proof.
2. **Single-subject, single-qualification scope** — Year 11 students revise 8–10 GCSEs. A science-only tool competes with “one app for everything.”
3. **No teacher homework workflow** — Schools drive bulk sign-up via assigned work. Your teacher portal monitors but cannot *require* usage.
4. **Weak habit loop vs. competitors** — Only a streak; no XP, badges, leagues, or push reminders.
5. **No free hook with clear upgrade path** — `subscription_tier` exists but nothing is gated; no reason to pay or refer.

### 3.2 Critical for retention (why students churn)

6. **No revision content layer** — When stuck, students leave for Bitesize/Seneca notes or YouTube. No in-app explanations.
7. **No AI tutor for “I don’t understand”** — Competitors offer 24/7 conversational help; you only mark answers.
8. **No real past papers** — High-intent students want official AQA papers with mark schemes.
9. **No reminders** — Email/push for due SRS items (Anki-style) drives return visits.
10. **No mobile install** — Students revise on phones; PWA or app increases daily opens.

### 3.3 Critical for school adoption (B2B2C)

11. **No assignment builder** — Teachers need “set Paper 1 Bio mock by Friday.”
12. **Limited teacher analytics** — Per-student spec-point gaps, exportable reports, intervention flags.
13. **No MIS / bulk import** — Schools won’t manually onboard 200 students.
14. **No parent visibility** — Parents pay for Premium on Seneca/UpGrades; you miss that buyer.
15. **No credibility assets** — Case studies, examiner endorsement, GDPR/privacy page, school logos.

### 3.4 Product gaps for grade 7–9 students

16. **Separate Sciences** — Many high-attainers do Triple Science, not Trilogy.
17. **Predicted grade / target grade tracking** — Motivational and shareable.
18. **Peer competition** — Optional class leagues (Revision Genie model).

---

## 4. Where you already win

These are genuine differentiators to lead with:

1. **Spec-point SRS with visible due queue and mastery matrix** — More transparent than Seneca’s black-box algorithm.
2. **AQA-faithful paper assembly** — AO split, demand bands, maths skills %, required practical minimums.
3. **Gap-driven flashcards from real attempts** — Personalised, not generic decks.
4. **Multi-modal marking** — Calculations with ECF + AI 6-mark examiner feedback.
5. **Adaptive difficulty + tier nudges** — Sensible FT/HT progression.
6. **Teacher class linking** — Foundation for school distribution (needs homework layer).

**Positioning statement (draft):**  
*“The only GCSE Science app that schedules your revision like Anki, marks your answers like an examiner, and builds mock papers like AQA — spec point by spec point.”*

---

## 5. How to maximise sign-ups and usage

### 5.1 Distribution: go where students already are

| Channel | Action | Why |
|---------|--------|-----|
| **Teachers (primary)** | Pilot with 2–3 science departments; offer free class licences | One teacher = 30–200 students; Seneca proved this model |
| **School science leads** | Email HODs with “reduce marking workload on 6-mark questions” | AI marking is a teacher painkiller |
| **TikTok / Instagram** | Short demos: “AI examiner roasts my 6-mark answer” | ExAIm/RevGenie grow via social proof |
| **Reddit / The Student Room** | Genuine help posts in r/GCSE | High-intent audience before mocks |
| **Google SEO** | Landing pages per spec point (“AQA 4.1.1 practice questions”) | Save My Exams traffic model |

### 5.2 Product-led growth loops

```
Teacher sets mock → Students sign up via class code → SRS schedules return visits → 
Gap flashcards + streak → Student shares result → Friend joins same class
```

**Implement in order:**

1. **Landing page** with 60-second demo video, 3 student quotes, “Join with class code” CTA.
2. **Teacher assignments** (even MVP: “assign paper simulation or spec topic by date”).
3. **Email reminders** for overdue SRS items (Supabase + Resend).
4. **Freemium gate** — e.g. free: 5 AI-marked long answers/week; paid: unlimited + full analytics.
5. **Referral** — “Invite a classmate, both get 1 week Premium.”
6. **PWA** — Add manifest + “Add to Home Screen” prompt on first session.

### 5.3 Onboarding optimisations

| Change | Impact |
|--------|--------|
| **Guest try** — 5 questions without account | Reduces signup friction |
| **Show value in <90 seconds** — One marked question before onboarding wizard | Proves AI marking immediately |
| **Default to class code step** if `?code=ABC123` in URL | Teacher link-in-bio flow |
| **Skip ranking steps** — Make preference/difficulty optional; infer from attempts | Faster time-to-practice |
| **Exam countdown** — “Mocks in 47 days” on dashboard | Seasonal urgency |

### 5.4 Retention mechanics

| Mechanic | Competitor reference | Effort |
|----------|---------------------|--------|
| Daily streak + streak freeze (paid) | Duolingo / ExAIm | Low |
| Weekly “topics to fix” digest | UpGrades | Medium |
| XP per spec point mastered | Seneca / RevGenie | Medium |
| Class leaderboard (opt-in) | RevGenie | Medium |
| “Night before” cram mode | Seneca Premium | Low (curated due queue) |

### 5.5 Monetisation that doesn’t kill growth

**Recommended tiers:**

| Tier | Price (indicative) | Includes |
|------|-------------------|----------|
| **Free** | £0 | SRS practice, MCQ/short answer, 3 AI long-answer marks/week, basic heatmap |
| **Student Pro** | £4.99/mo | Unlimited AI marking, full paper sims, PDF flashcards, streak freeze |
| **Class licence** | £2/student/year (via school) | Teacher assignments, bulk analytics, MIS export |

Keep core SRS **free** — that’s your Seneca-competitive hook. Gate **AI marking volume** and **teacher tooling**.

### 5.6 Trust & compliance (required for schools)

- Privacy policy + GDPR statement + DPA for schools
- “Not affiliated with AQA” disclaimer (standard)
- Page: “How marking works” — explain AI + human-authored rubrics
- 2–3 pilot school quotes with permission

### 5.7 90-day roadmap (technical priority)

| Phase | Deliverables |
|-------|--------------|
| **Month 1 — Acquisition** | Landing page, URL class codes, guest demo mode, email verification flow polish |
| **Month 2 — Retention** | Assignment MVP for teachers, weekly email reminders, freemium gating + Stripe |
| **Month 3 — Scale** | PWA, revision note snippets per spec point, optional AI “explain this topic” |
| **Later** | Separate Sciences, parent read-only dashboard, MIS import |

---

## 6. Summary

**You have a technically strong, niche product** with SRS, AQA-faithful paper building, and AI marking that most free tools lack. **You are losing on distribution, breadth, habit formation, and school workflow** — not on core science revision quality.

**Highest-leverage moves:**

1. Build a **landing page** and **teacher assignment** flow (school-driven sign-up).
2. Add **habit loops** (reminders, XP, streak freeze) and a clear **free vs. paid** split centred on AI marking.
3. Lead marketing with **“AI examiner + spaced repetition for AQA Trilogy”** — don’t compete with Seneca on all subjects.
4. Run **2–3 school pilots** before broad consumer marketing; science teachers are your growth engine.

---

*Generated from codebase review (`index.html`, `teacher.html`, `src/app.js`, migrations) and public competitor research (Seneca, Save My Exams, BBC Bitesize, Smart Revise, RevisePal, UpGrades, ExAIm, Revision Genie).*
