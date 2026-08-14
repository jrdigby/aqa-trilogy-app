# Syllabus batch question generation

Gemini batch output is **Studio-compatible JSON** for review before commit.

## Pipeline

| Script | Model | Output |
|--------|-------|--------|
| `batch-generate-subject-paper.mjs` | `gemini-2.5-flash` | MCQ, recall short text, extended response |

> **Note:** The local template MCQ batch (`batch-generate-mcq-template.mjs`) is discontinued. All chemistry MCQs are generated via Gemini. Use **MCQ → SA** in Studio to convert good MCQs to 1-mark short answer if needed.

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

Rejects drafts that fail automated checks (duplicate stems within the same type+demand band, filler distractors, missing rubric fields, invalid MCQ options, open-ended recall short text). Rejected items appear in `warnings` — re-run Studio gap-fill or adjust recipes.

## Import into admin

1. Open **AI Question Studio** in `admin.html`
2. **Import JSON** — Gemini `by-spec-ref/*.json`
3. Review → **Commit all**

Studio **Generate** sends all recipes to Gemini Flash.

## Deploy note

After pulling, redeploy the edge function so Studio uses Flash:

```bash
supabase functions deploy generate-questions
```

`mark-long-answer` remains on `gemini-2.5-flash-lite` unless `GEMINI_MARK_MODEL` is set.
