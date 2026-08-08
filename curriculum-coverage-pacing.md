# Horizon-aware curriculum coverage (no perpetual top-up)

Replace reactive due-queue top-up with horizon-aware curriculum introductions so all ~61 topics are scheduled before exams, while empty due-today remains a valid “caught up” state.

## Calendar anchors

- First GCSE science paper ≈ **11 May**
- Earliest signup ≈ **1 September**
- Presets: `y10` → May +2 years; `y11` → next May; `final_months` → ≤12 weeks

## Horizon-capped SM-2

Classic SM-2 intervals (17 → 49 → 147 → 456) are too long for GCSE. Every schedule update uses caps from `getHorizonSrsCaps(preset)`:

| Horizon | maxInterval | EF ceiling | Soft growth |
|---|---|---|---|
| `final_months` | 21d | 2.5 | × min(EF, 2.0) after 3 reps |
| `y11` | 42d | 2.6 | same |
| `y10` | 60d | 2.7 | same |
| EF floor | 1.3 | | |

Also:

- **Exam clamp:** next due never after the **exam date**; if compressed, spread by topic id
- **Final week (exam − 7d):** a **pass** parks until the day after the exam; a **fail** is due tomorrow
- **Product path:** `engineContext.updateSRS` injects caps; `upsertSRS` applies exam clamp via profile
- **Sims / `applySrsSession`:** default to y11 caps; pass `caps: null` only for uncapped classic SM-2 tests
- **Warnings:** `interval_at_ceiling` when interval ≥ that horizon’s maxInterval

## Key files

- [`src/curriculumPace.js`](src/curriculumPace.js) — pacing math, caps, exam clamp, `interleaveBySubject`
- [`src/evalEngine.js`](src/evalEngine.js) — `updateSRS({ …, caps })`
- [`src/srsAnalytics.js`](src/srsAnalytics.js) — `applySrsSession`, forecast / warnings
- [`src/sessionEngine.js`](src/sessionEngine.js) — `upsertSRS` persistence + exam clamp
- [`src/onboardingEngine.js`](src/onboardingEngine.js) — `introduceCurriculumTopics`; new topics pick **Bio → Chem → Phys** round-robin
- [`supabase/migrations/20260808_curriculum_horizon_pacing.sql`](supabase/migrations/20260808_curriculum_horizon_pacing.sql)
- Onboarding: exam horizon + optional subject study order (seed only); Settings: exam horizon + optional date

## Intro sequencing

**Onboarding seed only:** optional subject study order (default biology → chemistry → physics) controls the order starter topics are added. After onboarding that choice is not editable and has no further effect.

Ongoing curriculum intros are always round-robin **Bio → Chem → Phys**, not all of one subject then the next. Within a subject, paper/topic order is preserved. Students pick specific topics later via exam practice or the curriculum mastery heatmap.

Weekly intro budget is **whatever is required** to finish remaining topics by the intro deadline (capped at 12/week). Comfortable horizons stay near ~1–5/week; **final months** uses a 1-week intro buffer (vs 4 for Y10/Y11) and may drip faster so every eligible topic is allocated before exams. Soft due-load deferral is skipped in that crunch mode.

`final_months` **locks** `target_exam_date` at onboarding/settings (and on first intro if missing) so the horizon does not slide forward each day.

## Simulation (61-topic paced only)

Report scenarios:

- `y10_pace_61`
- `y11_pace_61`
- `final_months_pace_61`

```powershell
node --test tests/curriculumPace.test.js tests/srsSimulation.test.js tests/srsUpdate.test.js
node scripts/srsScenarioSimulator.mjs
```

Report is a **topic overview table** then **practice calendar** (spec refs per day).
Scenarios use quality **5** for final_months; Y10/Y11 use realistic early quality (3→4→5).
Bootstrap seeds **6** topics/week with **2** due on day 1 (not 12/3).

### Exam due policy

- Hard ceiling: never schedule past the **exam date** (spread when compressing)
- Final week (exam − 7d → exam): **pass** parks until the day after the exam; **fail** → tomorrow
- On/after exam day: short intervals (1d) resume
