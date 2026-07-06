# Syllabus batch question generation

Offline Gemini **Batch API** jobs for seeding the question bank. One job per **subject + paper**. Output is split into **one JSON file per spec ref** for import into AI Question Studio.

## Recipe matrix (per spec point)

| Type | Demand | Count |
|------|--------|-------|
| MCQ | low | 3 |
| MCQ | standard | 2 |
| MCQ | standard_45 (4–5) | 2 |
| Short text | low | 3 |
| Short text | standard | 2 |
| Short text | standard_45 | 2 |

**14 questions per spec point** · `tier=both` · no numeric (use Batch Numeric Generator for those).

## Prerequisites

Copy `.env.example` to `.env` in the project root and fill in your keys:

```bash
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
```

```env
GEMINI_API_KEY=your-google-ai-studio-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
# optional:
GEMINI_MODEL=gemini-2.5-flash-lite
```

The batch script loads `.env` automatically. Variables already set in your shell take precedence. `.env` is gitignored — never commit it.

## Run a batch job

```bash
node scripts/batch-generate-subject-paper.mjs --subject physics --paper paper1
```

Options:

- `--course-track combined` (default) or `triple`
- `--prepare-only` — write `input.jsonl` only, no API submit
- `--collect batch-output/physics/paper1/job.json` — poll an existing job and write output
- `--poll-seconds 30`

## Output layout

```
batch-output/physics/paper1/
  job.json              # batch job id + stats
  input.jsonl           # submitted requests
  responses.jsonl       # raw Gemini responses
  index.json            # manifest of spec-ref files
  by-spec-ref/
    6.2.1.json
    6.2.2.json
    ...
```

Each `by-spec-ref/*.json` file:

```json
{
  "meta": { "spec_ref": "6.2.1", "subject": "physics", "paper": "paper1", "tier": "both", ... },
  "drafts": [ /* Studio-compatible drafts with import_meta */ ],
  "warnings": []
}
```

## Import into admin

1. Open **AI Question Studio** in `admin.html`
2. Click **Import JSON** and select e.g. `batch-output/physics/paper1/by-spec-ref/6.2.1.json`
3. Form fields sync from file meta; preview table shows all drafts
4. Edit as needed → **Commit all** (resolves `spec_ref` per draft automatically)
5. Repeat for each spec ref in the topic

**Generate** in Studio remains for gap-fill and one-off curation.

## Cost note

Batch API is ~50% cheaper than interactive. A full physics paper (~40 spec points × 14 questions) is typically a few pence on Flash-Lite.

## Troubleshooting

- Job still running: `node scripts/batch-generate-subject-paper.mjs --collect batch-output/physics/paper1/job.json`
- Partial failures: check `index.json` warnings and re-run Studio gap-fill for missing slots
- 503s: rare in batch mode; failed lines appear in warnings
