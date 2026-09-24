# Edexcel Combined (1SC0) topic draft — edit before import

**Status:** Draft only. Not loaded into the app or the database.

**File to edit:** `content/edexcel/1sc0-combined-topics-DRAFT.csv`

The wording is paraphrased so it can live in the product later. It is not Pearson’s specification text. Line the codes up with your Combined Science PDF and change anything that does not match.

## How the sheet is organised

| Column | What to do |
|--------|------------|
| `spec_ref` | Working code (`B1.3`, `C6.2`, `P12.3`). Rename to match the PDF’s own numbers. |
| `topic_name` | Topic title, shortened. |
| `paraphrase` | One original sentence. Rewrite freely. |
| `paper` | `paper1` or `paper2`. |
| `also_on_other_paper` | `yes` only for the key-concepts topics (biology 1, chemistry 1, physics 1), which both papers can assess. |
| `ht_only` | `yes` / `no`. Flip if your PDF marks the point differently. |
| `core_practical` | `yes` if a required practical sits here. Official practical codes are not filled in yet. |
| `include` | Set to `no` to drop a row. Parent rows (`B1`, `C2`, `P6`) are headings — set `include` to `no` if you only want the numbered sub-rows in the product. |
| `review_notes` | Flags where the PDF should win. |

## Separate-only topics

Those are in a second sheet, not in the combined file:

`content/edexcel/1sc0-separate-only-topics-DRAFT.csv`

Same columns. `course_track` is `triple`, which is what the app stores for separate sciences. That sheet has:

- Whole topics that Combined Science does not assess: chemistry 5 and 9, physics 7 (astronomy) and 11 (static electricity)
- Extra points inside shared biology topics, coded `B2.S1` and similar so they do not clash with the combined codes

Biology has no extra topic number. Its separate-only material sits inside topics 1 to 9.

## Before this is used in the product

1. Correct codes, paper, and higher-tier flags against the PDF.
2. Delete or merge rows that do not match a real statement.
3. Add any topic the sheet missed.
4. Only then import as `exam_board = edexcel`, `course_track = combined`.
