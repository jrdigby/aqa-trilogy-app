# Syllabus batch question generation

Two pipelines seed the question bank. Both output **Studio-compatible JSON** for review before commit.

## Pipelines

| Pipeline | Script | Model | Best for |
|----------|--------|-------|----------|
| **Template MCQ** | `batch-generate-mcq-template.mjs` | None (local) | Chemistry low-demand MCQs |
| **Gemini batch** | `batch-generate-subject-paper.mjs` | `gemini-2.5-flash` | MCQ standard+ and extended response |

## Gemini recipe matrix (per spec point)

| Type | Demand | Count |
|------|--------|-------|
| MCQ | low | 3 |
| MCQ | standard | 3 |
| MCQ | standard_45 (4–5) | 2 |
| Short text (recall) | standard_45 | 3 |
| Extended 4-mark | standard_45 | 2 |
| Extended 4-mark | standard_67 | 2 |
| Extended 4-mark | high_89 | 2 |
| Extended 6-mark | standard_67 | 2 |

**19 questions per spec point** · `tier=both` · recall short text only (1-mark, keyword-marked) · no numeric (use Batch Numeric Generator).

Template MCQ batch adds **3 low MCQs per spec** for chemistry (optional — filter duplicates when reviewing).

## Prerequisites

```bash
cp .env.example .env
```

```env
GEMINI_API_KEY=your-google-ai-studio-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# optional (default gemini-2.5-flash):
GEMINI_MODEL=gemini-2.5-flash
```

## Run template MCQ batch (chemistry, local)

```bash
node scripts/batch-generate-mcq-template.mjs --subject chemistry --paper paper1
```

Output: `batch-output/chemistry/paper1/template-mcq/by-spec-ref/*.json`

## Run Gemini batch job

```bash
node scripts/batch-generate-subject-paper.mjs --subject chemistry --paper paper1
```

Options:

- `--course-track combined` (default) or `triple`
- `--prepare-only` — write `input.jsonl` only
- `--collect batch-output/chemistry/paper1/job.json` — poll existing job
- `--poll-seconds 30`

Output: `batch-output/chemistry/paper1/by-spec-ref/*.json`

## Quality gate

Both pipelines reject drafts that fail automated checks (duplicate stems, filler distractors, missing rubric fields, invalid MCQ options). Rejected items appear in `warnings` — re-run Studio gap-fill or adjust recipes.

## Import into admin

1. Open **AI Question Studio** in `admin.html`
2. **Import JSON** — template or Gemini `by-spec-ref/*.json`
3. Review → **Commit all**

Studio **Generate** uses template MCQs for chemistry `low` demand and Gemini Flash for other recipes.

## Deploy note

After pulling, redeploy the edge function so Studio uses Flash:

```bash
supabase functions deploy generate-questions
```

`mark-long-answer` remains on `gemini-2.5-flash-lite` unless `GEMINI_MARK_MODEL` is set.
