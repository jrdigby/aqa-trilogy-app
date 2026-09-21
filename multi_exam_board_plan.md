# Multi-Exam-Board Rollout Plan

**Last updated:** September 2026  
**Status:** Planning only — no implementation started

**Goal:** Add **Edexcel**, **OCR Gateway**, and **OCR 21st Century** (each with **combined** and **separate** science) alongside existing **AQA** — without rebuilding the question bank from scratch.

**Core assumption:** Science content is ~70–85% equivalent across boards. Work is mainly **mapping, adapting, and validating** — not writing ~6,600 new questions.

---

## Target qualification tracks (8 total)

| Board | Combined | Separate sciences |
|-------|----------|-------------------|
| **AQA** *(existing)* | Trilogy **8464** | Bio **8461**, Chem **8462**, Phys **8463** |
| **Edexcel** | Combined Science **1SC0** | Bio **1BI0**, Chem **1CH0**, Phys **1PH0** |
| **OCR Gateway** | Combined Science A **J250** | Bio **J247**, Chem **J248**, Phys **J249** |
| **OCR 21st Century** | Combined Science B **J260** | Bio **J257**, Chem **J258**, Phys **J259** |

OCR Gateway and OCR 21st Century are **separate suites** — different spec structures, not interchangeable.

---

## Current state (baseline)

The app is built around one implicit exam board. There is **no `exam_board` column or selector anywhere**.

| Dimension | How it works today |
|-----------|-------------------|
| Exam board | Hardcoded **AQA** in copy, prompts, marking rules, and data files |
| Combined vs separate | `profiles.science_path` → `combined` \| `triple` |
| Syllabus partition | `spec_points.course_track` → `combined` \| `triple` |
| Question visibility | `questions.audience` → `both` \| `triple_only` + dual spec linking |
| Grades | Combined: dual-award (`5/5`, `7/6`…); Triple: 1–9 per subject |
| AI extended responses | Generated and marked with AQA-only prompts (8464 / 8461–8463) |

The **combined/triple architecture is solid** and was designed as a reusable pattern (`archived_md/triple_science_and_rp_plan.md`). What is missing is a **second axis: exam board**.

---

## Architecture (foundation for everything)

Introduce a two-dimensional model:

```
Student profile  = exam_board × science_path × tier(s) × subjects
Content key      = exam_board × course_track × subject × paper × spec_ref
```

**Extend the existing combined↔triple equivalence pattern to cross-board mapping:**

```
AQA B4.1.1  ↔  Edexcel 1B.1  ↔  OCR Gateway B1.1  ↔  OCR 21C B1.1
```

That enables question porting, gap detection, SRS migration, and bulk AI adaptation with human review.

### Recommended schema approach

Add `exam_board` column to existing tables (mirrors how `course_track` was added for triple science):

| Table | Change |
|-------|--------|
| **`profiles`** | Add `exam_board text not null default 'aqa'` |
| **`spec_points`** | Add `exam_board`; update unique index to `(exam_board, course_track, subject, paper, spec_ref)` |
| **`required_practicals`** | Add `exam_board`; unique on `(exam_board, subject, course_track, code)` |
| **`equation_sheets`** | Add `exam_board` |
| **`spec_point_equivalences`** | Add `exam_board` — equivalences stay **within the same board** (combined↔triple); add cross-board equivalence table or extend for porting |
| **New: `exam_boards`** (optional) | Catalog: id, display name, spec codes, grade format, paper mark totals |

RPCs to update: `seed_initial_srs`, `migrate_srs_for_track_change`, `developer_upsert_question_bundle`, science subjects validation.

Backfill all existing data: `exam_board = 'aqa'`.

---

## Content strategy: adapt, don't rebuild

The science is largely the same across AQA, Edexcel, OCR Gateway, and OCR 21st Century. The real work is **mapping, filtering, and adapting** — not writing thousands of net-new questions.

### What transfers cleanly (~70–85% of question bank)

| Question type | Reuse potential | Typical changes needed |
|---------------|-----------------|------------------------|
| **MCQs** | Very high | Wording tweaks, distractor review, occasional command-word change |
| **1-mark recall / short text** | Very high | Mark scheme keywords may differ slightly |
| **Calculations / numeric** | Very high | Same physics/chemistry; equation sheet refs differ |
| **Chemistry interactives** | High | Mostly unchanged if underlying concept matches |
| **Extended responses (stems)** | Moderate–high | Stem often reusable; **rubrics and LoR bands need board-specific rewrites** |

### What needs board-specific work (~15–30%)

| Area | Why it differs |
|------|----------------|
| **Extended response rubrics** | LoR band descriptors, mark ranges, and examiner language differ |
| **Command words** | Same word, different expectations (e.g. "Evaluate", "Compare") |
| **Required practicals** | Different codes, titles, and emphasis — RP-linked questions need retargeting |
| **Physics equation sheets** | Same equations, different presentation / which are given |
| **Syllabus gaps** | Board-only topics (e.g. some triple-only content, OCR "Ideas about Science" framing) |
| **Paper simulation rules** | Mark totals, AO splits, maths % targets — not the questions themselves |

### Net-new content is mostly "delta" topics

Rough expectation per new board:

- **~85–90%** of spec points have a clear AQA equivalent
- **~5–10%** need minor spec-text / context adjustments
- **~5–10%** are genuinely board-specific (net-new questions only here)

For 6 new tracks: **hundreds of targeted edits plus a few hundred new questions**, not thousands written from scratch.

---

## Phased rollout (recommended order)

Each phase is **shippable on its own** once Phase 0 is done.

```
Phase 0  →  Platform refactor (AQA unchanged)
Phase 1  →  Edexcel Combined
Phase 2  →  Edexcel Separate
Phase 3  →  OCR Gateway Combined
Phase 4  →  OCR Gateway Separate
Phase 5  →  OCR 21st Century Combined
Phase 6  →  OCR 21st Century Separate
```

Do **not** attempt all boards at once. Edexcel first (largest non-AQA market, most similar structure). OCR Gateway and 21st Century are distinct — treat 21st Century almost as a new product within the platform.

---

### Phase 0 — Platform refactor (no new content, AQA unchanged)

**Purpose:** Add `exam_board` as a first-class dimension across the stack.

| Area | Work |
|------|------|
| **Database** | Add `exam_board` to profiles, spec_points, required_practicals, equation_sheets, spec_point_equivalences; update RPCs |
| **App code** | Parameterise ~20–25 files (`sciencePath.js`, `dbClient.js`, `sessionEngine.js`, `onboardingEngine.js`, etc.) |
| **Exam rules** | Split `examRules.js` into board-specific modules (AO weights, paper lengths, maths %, demand bands) |
| **UI** | New onboarding step 0: exam board picker; update settings, dashboard chip, admin filters |
| **AI scaffolding** | Parameterise generation/marking functions by board (AQA prompts stay default) |
| **Tests** | Regression: existing AQA users completely unaffected |

**Your time:** ~14–22 hrs (architecture decisions, PR review, regression testing)  
**Cursor:** ~90% of engineering  
**Ship criteria:** AQA works exactly as today; board selector exists but only AQA is populated

---

### Phase 1 — Edexcel Combined

**Purpose:** First new board; prove the content porting pipeline.

| Step | Work |
|------|------|
| 1 | Build Edexcel combined syllabus spec points (~50–70 topics) |
| 2 | Create **cross-board equivalence map** (AQA ↔ Edexcel refs) |
| 3 | Map required practicals and physics equation sheets |
| 4 | **Auto-port** MCQs, recall, calculations from AQA (~85% reuse) |
| 5 | **Adapt** extended-response rubrics (LoR bands, command words) |
| 6 | Calibrate AI marking against Edexcel mark scheme exemplars |
| 7 | UAT as Edexcel combined student |

**Your time:** ~28–51 hrs  
**Net-new questions:** ~50–100 (board-only delta topics only)  
**Ship criteria:** Edexcel combined students can onboard, practice, and get AI-marked extended responses

---

### Phase 2 — Edexcel Separate

**Purpose:** Extend Edexcel using combined infra + equivalences.

| Step | Work |
|------|------|
| 1 | Separate-only spec points + combined↔separate equivalences within Edexcel |
| 2 | Port triple-only / separate-depth questions from AQA triple track |
| 3 | Review extended-response rubrics for separate depth |
| 4 | UAT |

**Your time:** ~14–27 hrs  
**Ship criteria:** Edexcel separate students fully supported

---

### Phase 3 — OCR Gateway Combined

**Purpose:** Second exam board; traditional OCR structure.

| Step | Work |
|------|------|
| 1 | OCR Gateway combined syllabus + equivalence map from AQA/Edexcel |
| 2 | Port and adapt questions (reuse pipeline from Phases 1–2) |
| 3 | OCR Gateway-specific command words and LoR descriptors |
| 4 | AI marking calibration |
| 5 | UAT |

**Your time:** ~28–51 hrs  
**Ship criteria:** OCR Gateway combined live

---

### Phase 4 — OCR Gateway Separate

**Your time:** ~14–27 hrs  
**Ship criteria:** OCR Gateway separate live

---

### Phase 5 — OCR 21st Century Combined

**Purpose:** Third board; different philosophy ("Ideas about Science" woven through).

| Step | Work |
|------|------|
| 1 | 21st Century syllabus (different topic framing from Gateway) |
| 2 | Equivalence map — more gaps expected vs AQA |
| 3 | Port + adapt; more rubric work than Gateway |
| 4 | AI marking calibration |
| 5 | UAT |

**Your time:** ~28–51 hrs  
**Ship criteria:** OCR 21st Century combined live

---

### Phase 6 — OCR 21st Century Separate

**Your time:** ~14–27 hrs  
**Ship criteria:** Full multi-board rollout complete

---

## Work breakdown by layer

### Database

- Add `exam_board` column to ~6 tables
- Extend `spec_point_equivalences` for cross-board mapping
- Board-scoped RPCs for SRS seeding and migration
- Backfill existing data: `exam_board = 'aqa'`

### Application code

Every place that filters on `course_track` alone needs `exam_board` added:

| Area | Files | Effort |
|------|-------|--------|
| Profile helpers | `src/sciencePath.js` | Medium |
| DB queries | `src/dbClient.js` (~15 functions) | Medium |
| Onboarding / settings | `src/onboardingEngine.js`, `src/app.js` | Medium–High |
| Practice sessions | `src/sessionEngine.js` | Medium |
| Paper builder | `src/paperBuilder.js`, `src/examRules.js` | High |
| Grades | `src/gradeConfig.js` | Medium |
| Command-word tips | `src/evalEngine.js` | Medium |
| Calculation workflow | `src/calculationWorkflow.js` | Low–Medium |
| Admin authoring | `admin.html`, `src/admin/adminSpecCache.js`, `src/csvQuestionImport.js` | High |
| Batch generation | `scripts/batch-generate-subject-paper.mjs`, `src/batchQuestionRecipes.js` | Medium |
| Teacher portal | `src/teacherPortal.js`, `src/teacherStudentDetail.js` | Low |
| Marketing / legal | `index.html`, `terms.html`, `privacy.html`, `teacher.html` | Low |
| Tests | `tests/sciencePath.test.js`, `tests/gradeConfig.test.js`, etc. | Medium |

### UI/UX

**New onboarding flow (8 steps):** Board → Path → Tier → Grades → Order → Horizon → Class → Summary

```
Step 0: Which exam board are you studying?
  [AQA]  [Edexcel]  [OCR Gateway]  [OCR 21st Century]

Step 1: Combined or Separate? (labels vary by board)
  AQA:     "Combined Science (Trilogy)" / "Separate Sciences (Triple)"
  Edexcel: "Combined Science" / "Separate Sciences"
  OCR GW:  "Combined Science A" / "Separate Sciences A"
  OCR 21C: "Combined Science B" / "Separate Sciences B"
```

| Element | Current | New |
|---------|---------|-----|
| `#sciencePathChip` | `Combined · Higher` | `Edexcel · Combined · Higher` |
| Exam prep dropdown | "AQA paper simulation" | Board-specific label + correct mark totals |
| Command-word tips | "Hide AQA command word tips" | Board-aware or generic |
| Landing page | "Built for AQA" | Multi-board or board-agnostic |
| Admin | "Combined (Trilogy 8464)" | Board + track + spec code |

Settings: board change with SRS migration confirmation (like combined↔triple today).

### AI extended responses

| Component | Current | Change |
|-----------|---------|--------|
| **Generation** (`geminiQuestionCore.js`, `generate-questions`) | AQA-only prompts | Board-specific prompts and spec codes |
| **Marking** (`mark-long-answer/index.ts`) | `SHARED_AQA_LOR_SYSTEM_CORE`; rejects Edexcel/OCR | Separate examiner personas per board |
| **Rubrics** | AQA LoR band descriptors | Rewritten per board during porting |
| **Calibration** | AQA exemplars | ~30 sample answers vs mark scheme exemplars per board |

Generation and marking must use **that board's** terminology — the current AQA marking prompt explicitly says "Do not import Edexcel/OCR phrasing."

### Content (adaptation model)

| Content type | Approach |
|--------------|----------|
| MCQs, recall, calculations | Auto-port via equivalence map; spot-check ~10–15% |
| Extended responses | Reuse stems; rewrite rubrics and LoR bands |
| Required practicals | Map AQA RP codes → board RP codes |
| Equation sheets | Same physics; different sheet format |
| Board-only topics | Net-new questions only (~5–10% of spec points) |

**Recommended workflow per board:**

1. Map syllabi — equivalence CSV (AQA ref → board ref), validate
2. Auto-port bulk questions — MCQ, recall, calculations with minimal changes
3. Human pass on extended responses — rubrics and LoR bands per board
4. Map required practicals — retarget RP-linked questions
5. Calibrate AI marking — ~30 sample answers vs mark scheme exemplars
6. Ship combined first, then separate

---

## Where your time goes

```
~30%  Learning exam board differences (spec structures, command words, paper formats)
~25%  Building & validating cross-board spec equivalence maps
~25%  Extended response rubrics + AI marking calibration
~15%  Spot-checking adapted questions (MCQ, recall, calculations)
~5%   Net-new questions for board-only topics
```

---

## Time estimates (your hours)

| Scenario | Hours | Calendar (part-time) |
|----------|-------|----------------------|
| **Phase 0 only** (platform ready, AQA only) | 14–22 | ~2–3 weeks |
| **One board fully** (Edexcel combined + separate) | 40–75 | ~6–10 weeks |
| **All 3 new boards, all 6 tracks** | 120–220 | ~4–7 months |
| **Conservative** (thorough rubric QA + marking) | 180–280 | ~6–9 months |

Cursor handles ~60–75% of engineering autonomously; you review PRs, validate content, and calibrate marking.

| Layer | Original estimate | Revised (adaptation model) |
|-------|-------------------|----------------------------|
| Questions to write from scratch | ~6,600 | ~200–600 (board-only deltas) |
| Questions to adapt/review | Not emphasised | ~4,000–5,000 (mostly automated, you spot-check) |

---

## What Cursor vs you

| Task | Cursor | You |
|------|--------|-----|
| Schema migrations | Full | Review |
| App refactoring | ~80% | Review + test |
| UI (board picker, settings) | ~85% | Copy/UX approval |
| Equivalence mapping tooling | Build admin UI | **Validate mappings** |
| Bulk question porting scripts | AI-adapt + flag low-confidence | **Spot-check samples** |
| Extended response rubrics | Draft from AQA originals | **Review against mark schemes** |
| AI marking prompts | Draft per board | **Calibrate with exemplars** |
| Official spec content | Import scripts if CSV provided | **Provide + validate syllabus data** |
| Legal/marketing copy | Draft | **Approve accuracy claims** |

You shift from **author** to **reviewer and calibrator** — much faster, but still non-optional for quality.

---

## Risk register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Spec mapping errors | High | Human validation of equivalence map; gap report for unmapped topics |
| AI marking inconsistency | High | Calibration sets per board before shipping |
| OCR Gateway vs 21st Century confusion | Medium | Clear UI labels with spec codes (J250 vs J260) |
| Existing AQA users broken | High | Default `exam_board = 'aqa'` everywhere; regression tests |
| Over-adapting questions that don't need changes | Low | Port pipeline flags only items where board rules differ |
| Copyright on spec text | Medium | Use spec refs + paraphrased spec_text; check board licensing terms |

---

## Recommended first move

**Phase 0 + Edexcel Combined only** — proves the full pipeline (mapping → porting → rubrics → marking → UAT) without committing to all 6 tracks. If that goes well, the remaining phases follow the same playbook.

---

## Key file index (for implementation)

**Core logic:** `src/sciencePath.js`, `src/examRules.js`, `src/gradeConfig.js`, `src/paperBuilder.js`, `src/onboardingEngine.js`, `src/sessionEngine.js`, `src/dbClient.js`

**AI:** `src/geminiQuestionCore.js`, `supabase/functions/generate-questions/index.ts`, `supabase/functions/mark-long-answer/index.ts`

**UI:** `app.html`, `src/app.js`, `admin.html`, `index.html`

**Schema reference:** `supabase/migrations/20250617_triple_science_and_rp.sql`, `archived_md/triple_science_and_rp_plan.md`

**Content tooling:** `scripts/batch-generate-subject-paper.mjs`, `src/batchQuestionRecipes.js`, `src/csvQuestionImport.js`
