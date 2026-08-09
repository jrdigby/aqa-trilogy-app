# WCAG 2.1 / 2.2 AA — Student UI tokens & keyboard

Guidance for student and teacher layouts. Admin is out of scope. See also [`wcag-2.2-aa.md`](wcag-2.2-aa.md) for the 2.2 delta and audit.

## Contrast tokens (`app.html` `:root`)

| Token | Value | Use |
|-------|--------|-----|
| `--bg` | `#f4f6f8` | Page background |
| `--card-bg` | `#ffffff` | Cards |
| `--text` | `#333333` | Body text (≥ 4.5:1 on bg/card) |
| `--text-muted` | `#555555` | Secondary/helper text |
| `--primary` | `#1d6fd0` | Primary buttons / accents (white label ≥ 4.5:1) |
| `--primary-hover` | `#1557a8` | Primary hover |
| `--success` | `#1f8f4e` | Submit / success fills (white label AA) |
| `--success-hover` | `#187a41` | Success hover |
| `--success-text` | `#157a42` | Success *text* on light backgrounds (`.good`) |
| `--secondary` | `#5a6a6b` | Secondary buttons |
| `--secondary-hover` | `#4a5859` | Secondary hover |
| `--error` | `#e74c3c` | Errors |
| `--focus-ring` | `0 0 0 3px rgba(29, 111, 208, 0.45)` | `:focus-visible` |

**Rules for new UI**
- Prefer `var(--text-muted)` over hardcoded `#64748b` / `#94a3b8`.
- Button label text on colored fills: use `--primary` / `--success` / `--secondary` (not the old lighter blues/greens).
- Status copy on white: use `--success-text`, not `--success`.

## Keyboard — practice answers

| Action | Keys |
|--------|------|
| Submit answer | **Enter** (outside textarea); **Ctrl+Enter** / **Cmd+Enter** inside `#txtAns` |
| Advance | **Enter** when Next is shown and Submit is hidden |
| Space submit | When focus is not in a text field or on a button |

Shared handlers: `submitCurrentAnswer()`, `advanceToNextQuestion()` in `src/app.js`.

MCQ: native radios + `.mcq-option:focus-within` ring; select then Enter to submit.

## Keyboard — custom widgets

- Chemistry SVG hit targets: `tabindex="0"`, Enter/Space → same as click (`src/chemistryWorkflow.js`).
- Heatmap cells, flashcards, journey landmarks: focusable + Enter/Space.
- Upgrade modal: Escape, initial focus, Tab trap, restore focus.

## Manual verification checklist

- [ ] Submit (green) and Primary button labels pass contrast checker (≥ 4.5:1).
- [ ] Muted helpers (char counts, legends) use `--text-muted` and pass on `#f4f6f8` / white.
- [ ] Keyboard-only: MCQ → Enter submit → Enter next.
- [ ] Short/extended: Ctrl+Enter submits; plain Enter adds newline in textarea.
- [ ] Numeric: Tab through fields → Enter submits.
- [ ] Visible focus ring on buttons, MCQ options, heatmap, flashcards, chemistry targets.
- [ ] Upgrade modal: Escape closes; focus returns to opener.
- [ ] Chemistry diagram: Tab to shell/electron → Enter/Space adds/removes.
