# WCAG 2.2 Level AA — Student & Teacher

**Scope:** `app.html` (student) and `teacher.html` (teacher). Admin and marketing landing are out of scope.  
**Date:** 2026-08-09

## What was implemented

### New WCAG 2.2 criteria (A/AA)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| **2.4.11 Focus Not Obscured (Minimum)** | Addressed | Toasts moved to bottom-right with `pointer-events: none`. Practice focus moves to Next/feedback and scrolls into view. Teacher student-detail dialog: initial focus, Tab trap, restore focus. |
| **2.5.7 Dragging Movements** | Addressed (student) | Onboarding/settings subject ranking: ▲/▼ buttons in addition to drag. Teacher: no drag UIs. |
| **2.5.8 Target Size (Minimum)** | Addressed | Auth link buttons ≥32px hit area; heatmap cells 28×28; flashcard select 32×32; chemistry electron hit radii ~24px; journey landmark hit `r=16`; teacher header/portal links ≥32px. |
| **3.2.6 Consistent Help** | Addressed | Shared `.site-help-nav` (Privacy · Terms · cross-link) in student and teacher headers. |
| **3.3.7 Redundant Entry** | Addressed | Student auth reuses typed email across Sign in / Sign up / Forgot. Teacher auth already shares one email field across modes. |
| **3.3.8 Accessible Authentication (Minimum)** | OK | Email/password with `autocomplete`; forgot-password flows; no CAPTCHA; paste not blocked. Teacher register links Terms/Privacy. |

### Supporting 2.1 AA (this pass)

- Skip links → `#mainContent` / `#teacherMain`
- Teacher `:focus-visible` + AA colour tokens aligned with student
- Readonly mastery heatmap cells focusable with `aria-label` + tooltip on focus
- Teacher dialog Escape (existing) + focus trap/restore (new)

### Prior 2.1 work retained

Contrast tokens, Enter/Ctrl+Enter submit, chemistry/journey/flashcard keyboard, upgrade modal focus management — see [`wcag-aa-ui.md`](wcag-aa-ui.md).

## Static audit (2026-08-09)

Automated evidence checks against the codebase: **19/20** patterns matched (the remaining check was a regex false negative for `role="img"` on readonly heatmap cells — code is present at `src/uiComponents.js`).

## Manual verification still recommended

1. Keyboard-only student: onboarding rank with ▲/▼ only (no drag) → practice MCQ Enter submit → Enter next.
2. Keyboard-only teacher: Tab to roster row → Enter opens detail → Tab cycles inside panel → Escape restores focus.
3. Contrast checker on Submit / Primary / muted helpers (student + teacher).
4. Zoom 200%: no loss of help nav / skip link / submit controls.
5. Password manager: paste into password fields on both apps.

## Residual / known non-blockers

- Auth panels are not always wrapped in `<form>` (password managers still work via autocomplete).
- Teacher auth/detail tablists lack full arrow-key tablist pattern (buttons remain activatable).
- Full WCAG 2.2 AA is a **page-level** claim — re-audit after major UI changes; admin remains unaudited.
- Some decorative SVG strokes may still use lighter slate colours where they are not text.

## Key files touched

- [`app.html`](app.html), [`teacher.html`](teacher.html), [`styles.css`](styles.css)
- [`src/app.js`](src/app.js), [`src/uiComponents.js`](src/uiComponents.js)
- [`src/teacherStudentDetail.js`](src/teacherStudentDetail.js), [`src/chemistryWorkflow.js`](src/chemistryWorkflow.js), [`src/journeyMap.js`](src/journeyMap.js)
