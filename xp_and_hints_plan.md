# XP and Hints Implementation Plan

## Design decisions (confirmed)

| Decision | Choice |
|----------|--------|
| When XP is awarded | **On any submitted attempt** — base amount from question difficulty, independent of marks scored |
| Hint penalty | **Graduated** — each hint revealed steps down the multiplier (100% → 75% → 50% → 25%) |
| Hint storage | **`questions.hints` jsonb column** — ordered array of strings on the existing questions row |
| Hint authoring | **Developer admin view** (`admin.html`) — create form + edit modal, same pattern as `resource_links` |
| No hints UI rule | **If `questions.hints` is null/empty, the entire hints section is hidden** — no button, no panel, no empty placeholder |

Command-word tips (existing `.exam-tip` banners from `getAQACommandWordHelper`) are **not** hints for XP purposes. Only content revealed through the new dedicated hints panel counts.

---

## Hints storage (questions table)

Yes — hints are stored as an **additional column on `questions`**, not a separate table.

```sql
alter table questions add column if not exists hints jsonb;
comment on column questions.hints is 'Ordered progressive hint strings; revealed one at a time in practice UI';
```

### Why `jsonb` on `questions` (not a `question_hints` table)

- Hints are always loaded with the question in practice sessions — no extra join
- Typical count is 1–3 short strings per question — fits naturally in JSON
- Matches existing patterns (`options`, `scaffold_config`, `resource_links` as scalar/JSON on the same row)
- Admin create/edit already writes directly to `questions` — one field to add to insert/update payloads

### Data shape

```json
["Start by identifying which process releases energy in respiration.", "Remember: glucose is broken down in stages.", "The first stage is glycolysis in the cytoplasm."]
```

- **Order matters** — index 0 is the gentlest nudge; later hints are more revealing
- **`null` or `[]`** — student app hides the hints panel entirely
- **Separate from `resource_links`** — video URLs stay post-submit review links; hints are in-session text nudges only

### What gets persisted per attempt

On `attempts` (for XP audit / teacher analytics):

| Column | Purpose |
|--------|---------|
| `hints_revealed` | `smallint` — how many hints the student revealed before submitting (0–n) |
| `xp_earned` | `integer` — XP awarded for that attempt after hint penalty |

Lifetime total: `profiles.total_xp`.

---

## Developer admin authoring (`admin.html`)

All hint input lives in the existing **developer question view** — no new admin page.

### Create Question tab (`panelCreator`)

Add a **"Practice hints"** section in Section 1, directly below the video URL row (~line 552, after `#qVideo`):

```html
<div class="hints-author-panel" style="margin-top: 16px;">
  <label>Practice hints (optional, revealed one at a time — reduces student XP)</label>
  <p class="muted" style="font-size: 0.78rem; margin: 4px 0 8px;">
    Add 1–3 progressive nudges. Hint 1 should be subtle; later hints more direct. Leave empty if none.
  </p>
  <div id="creatorHintsList">
    <div class="hint-row">
      <span class="hint-row-label">Hint 1</span>
      <textarea class="hint-input" rows="2" placeholder="Gentle nudge…"></textarea>
    </div>
  </div>
  <button type="button" id="btnAddCreatorHint" class="btn btn-secondary" style="margin-top: 8px;">+ Add hint</button>
</div>
```

**Create submit** (`insertPayload` ~line 1588): collect non-empty `.hint-input` values in order:

```javascript
function collectHintsFromList(containerId) {
  const inputs = document.querySelectorAll(`#${containerId} .hint-input`);
  return [...inputs]
    .map(el => el.value.trim())
    .filter(Boolean);
}
// insertPayload.hints = collectHintsFromList('creatorHintsList').length ? collectHintsFromList(...) : null;
```

Cap at **5 hints** in UI (XP multipliers cap at 3+ anyway; extra hints still penalise at 25%).

### Edit modal (`editForm` / `requestInteractiveEdit`)

Mirror the same UI inside the edit modal, below `editResource` (~line 943):

```html
<div class="hints-author-panel" style="margin-bottom: 16px;">
  <label>Practice hints</label>
  <div id="editHintsList"></div>
  <button type="button" id="btnAddEditHint" class="btn btn-secondary">+ Add hint</button>
</div>
```

**Load existing hints** in `requestInteractiveEdit` (~line 2161):

```javascript
populateHintsEditor('editHintsList', Array.isArray(q.hints) ? q.hints : []);
```

**Save** in `btnSaveEdits` handler (~line 2384): add `hints` to `updatePayload` using same `collectHintsFromList('editHintsList')`.

### Audit tab

- Add `hints` to `selectWithMeta` / `selectBasic` question queries (~line 1970)
- Show hint count in audit warnings: `⚠️ No practice hints` (informational only, not an error)
- Optional badge: `💡 2 hints` in the audit row

### CSV importer (deferred)

Bulk CSV import (`admin.js` / `bulk_import_full_question` RPC) does **not** need hints in v1. Hints are authored interactively in the developer UI. Can add `p_hints jsonb` to the RPC later if bulk content is needed.

---

## XP formula

New module [`src/xpEngine.js`](src/xpEngine.js) centralises all tunable constants:

```javascript
export const XP_PER_DIFFICULTY = 10; // difficulty 1 → 10 XP, difficulty 5 → 50 XP
export const HINT_MULTIPLIERS = [1.0, 0.75, 0.5, 0.25]; // index = hints revealed (capped)

export function computeAttemptXp(question, hintsRevealed) {
  const difficulty = getEffectiveDifficulty(question); // reuse from examRules.js
  const base = XP_PER_DIFFICULTY * difficulty;
  const idx = Math.min(hintsRevealed, HINT_MULTIPLIERS.length - 1);
  return Math.round(base * HINT_MULTIPLIERS[idx]);
}
```

---

## Full data model migration

New migration: [`supabase/migrations/20250614_xp_and_hints.sql`](supabase/migrations/20250614_xp_and_hints.sql)

```sql
alter table profiles add column if not exists total_xp integer not null default 0;
alter table attempts add column if not exists xp_earned integer not null default 0;
alter table attempts add column if not exists hints_revealed smallint not null default 0;
alter table questions add column if not exists hints jsonb;

create or replace function public.increment_user_xp(p_amount integer)
returns integer language plpgsql security definer set search_path = public as $$
declare v_new integer;
begin
  if auth.uid() is null or p_amount <= 0 then return 0; end if;
  update profiles set total_xp = total_xp + p_amount
  where user_id = auth.uid()
  returning total_xp into v_new;
  return coalesce(v_new, 0);
end; $$;
grant execute on function public.increment_user_xp(integer) to authenticated;
```

Also append to [`supabase/apply_in_sql_editor.sql`](supabase/apply_in_sql_editor.sql).

Update [`src/sessionEngine.js`](src/sessionEngine.js) `QUESTION_SELECT` to include `hints`.

---

## Student hints panel (practice UI)

**Confirmed behaviour:** when a question has no hints (`null`, `[]`, or all-empty strings after normalisation), **the complete hints section does not appear** for students. There is no "Need a hint?" button, no collapsed panel, and no empty box — `#hintsPanelMount` stays hidden and takes no layout space.

### Visibility rule (in `loadQuestion()`)

```javascript
function normalizeQuestionHints(hints) {
  if (!Array.isArray(hints)) return [];
  return hints.map(h => String(h || "").trim()).filter(Boolean);
}

const hints = normalizeQuestionHints(currentQ?.hints);
if (hints.length === 0) {
  hintsPanelMount.classList.add("hidden");
  hintsPanelMount.innerHTML = "";
  currentHintState.revealedCount = 0;
} else {
  hintsPanelMount.classList.remove("hidden");
  renderHintsPanel(hints, currentHintState.revealedCount, onRevealNext);
}
```

Students should never see hints UI for legacy questions (column `null`) or questions where the developer left all hint fields blank.

In [`index.html`](index.html), mount between `#sessionContext` and `#qBox`:

```html
<div id="hintsPanelMount" class="hints-panel-mount hidden"></div>
```

Renderer in [`src/uiComponents.js`](src/uiComponents.js): `renderHintsPanel(hints, revealedCount, onRevealNext)`

- Only shown when `questions.hints` has length > 0
- **"Need a hint?"** → expand panel → **"Show next hint"** reveals one at a time
- Opening the panel alone does **not** penalise XP — only `revealedCount` increments matter

Session state in [`src/app.js`](src/app.js): reset `currentHintState.revealedCount` in `loadQuestion()`.

---

## XP award flow

On submit (both local and AI paths):

1. `computeAttemptXp(currentQ, currentHintState.revealedCount)`
2. `attempts.insert` with `xp_earned`, `hints_revealed`
3. `rpc('increment_user_xp', { p_amount: xpEarned })`
4. Toast: `+30 XP` or `+22 XP (1 hint used)`

Display: session summary total, dashboard `#xpChip`, teacher student detail `total_xp`.

---

## Implementation order

1. Migration + RPC
2. `xpEngine.js`
3. Admin hints UI (create + edit) — so content exists to test
4. Student hints panel + session state
5. Submit flow + XP persistence
6. Display surfaces (toast, summary, dashboard, teacher)

---

## Testing checklist

- Create question with 2 hints in admin → hints appear in practice, reveal order correct
- Edit question: add/remove/reorder hints → saves to `questions.hints`
- Question with no hints: **entire hints section absent** (not just disabled); full XP; `hints_revealed = 0`
- Reveal 1 / 2 / 3 hints → XP matches graduated multipliers
- `total_xp` persists across refresh; teacher sees student total
