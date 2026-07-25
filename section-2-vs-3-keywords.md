# Section 2 vs Section 3 keywords

## Decision

**Option 2:** Steer short-text authors toward Section 3 checkpoints for pedagogical feedback and flashcards. Keep Section 2 for `pick_n` (pool marking) and as a lightweight required/optional keyword fallback.

Do not merge the two models or add per-term remediation fields to Section 2 keywords.

## Short-text evaluation

| Path | Role | Flashcard quality |
|------|------|-------------------|
| Section 3 checkpoints | Preferred short-text marking + authored `feedback_if_missing` | Strong — examiner-style tips per missed concept |
| Section 2 `pick_n` | Correct tool for “name/state N from a pool” | Useful in practice; pool list must not spoil revision cards |
| Section 2 `keywords` | All-or-nothing fallback when Section 3 is empty | Weak — “missing these required terms…” with no authored tips |

### Marking priority (short_text)

1. `key_type === "pick_n"` → pool marking (Section 3 skipped on save)
2. Else if any Section 3 row has non-empty `point_text` → checkpoint marking (Section 2 required/optional ignored)
3. Else → Section 2 required / optional / `min_optional` (all-or-nothing)

## MCQ and numeric (confirmed — not changed)

- **MCQ:** Section 2 holds per-option feedback (`option_feedback`). Section 3 holds one generic remediation row (`feedback_if_missing` on the first mark point). Both appear when the student is wrong (`resolveMcqWrongFeedback`).
- **Numeric:** Section 3 UI is hidden. Remediation is authored in Section 2 calculation workflow (`remediation_steps` / per-step `feedback_if_wrong`). Legacy `mark_points` may still be migrated into Section 2 on edit; new numeric questions do not write Section 3.

## Product implications

- Prefer Section 3 for multi-mark / concept short answers so flashcard backs carry authored remediation.
- Use Section 2 `pick_n` for “State two… / Name three…” style questions; leave Section 3 blank. **Create form defaults to `pick_n`.**
- Use Section 2 keywords only as a simple fallback, with admin warnings that flashcards will lack remedial tips.
- Practice feedback for `pick_n` may still list acceptable answers; flashcard backs use a non-spoiler summary.

## Admin audit flags

On the Database Audit page, short-text questions (excluding `pick_n`) are flagged when:

- **Keyword fallback** — Section 2 required/optional keywords exist and there are no gradable Section 3 checkpoints (`point_text` non-empty).
- **Checkpoints missing remediation** — one or more gradable checkpoints lack `feedback_if_missing`.

Empty Section 3 rows do not count as checkpoints. Use the **Remediation filter** to list only these issues.

## Key files

- `src/evalEngine.js` — marking + feedback payloads
- `src/app.js` — `extractFlashcardInsights` (prefers `flashcard_text`)
- `admin.html` — Section 2/3 authoring, grading-mode indicator, audit remediation flags
