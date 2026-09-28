# Edexcel Combined (1SC0) topic draft — edit before import

**Status:** Draft only. Not loaded into the app or the database.

**File to edit:** `content/edexcel/1sc0-all-spec-points-DRAFT.csv`

This sheet lists every numbered statement from the Combined Science PDF and the separate Biology, Chemistry and Physics specifications. Combined statements use `course_track = combined`. Statements that appear only in a separate science use `course_track = triple`, with the scientific terms kept in `paraphrase`.

Separate-only topics are broken out in full: chemistry 5 (C5.1–C5.27) and 9 (C9.1–C9.39), physics 7 astronomy (P7.1–P7.19) and 11 static electricity (P11.1–P11.10).

Your earlier drafts are unchanged: `content/edexcel/1sc0-combined-topics-DRAFT.csv` and `content/edexcel/1sc0-separate-only-topics-DRAFT.csv`.

## How the sheet is organised

| Column | What to do |
|--------|------------|
| `spec_ref` | Working code (`B1.3`, `C6.2`, `P12.3`). Rename to match the PDF’s own numbers. |
| `topic_name` | Topic title, shortened. |
| `paraphrase` | Learner-facing wording, with the scientific terms kept. |
| `paper` | `paper1` or `paper2`. |
| `also_on_other_paper` | `yes` only for the key-concepts topics (biology 1, chemistry 1, physics 1), which both papers can assess. |
| `ht_only` | `yes` / `no`. Flip if your PDF marks the point differently. |
| `core_practical` | `yes` if a required practical sits here. Official practical codes are not filled in yet. |
| `include` | Set to `no` to drop a row. Parent rows (`B1`, `C2`, `P6`) are headings — set `include` to `no` if you only want the numbered sub-rows in the product. |
| `review_notes` | Flags where the PDF should win. |

## Before this is used in the product

1. Read the paraphrases and rewrite any line you want to sound different.
2. Check `ht_only`. It is `yes` where the PDF prints that statement in bold. A bold phrase inside a longer statement marks the whole row.
3. Read the triple rows and rewrite any line you want to sound different.
4. Do not import until you are happy with the sheet. Combined rows use `course_track = combined`. Triple-only rows use `course_track = triple`.
