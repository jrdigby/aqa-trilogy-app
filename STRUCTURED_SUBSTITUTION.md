# Structured Substitution (Phase 1)

Slot-based substitution UI for numeric calculation questions. Equations with curated templates show **one input per quantity**; all others keep the legacy **single free-text** input.

## How it works

| Layer | Role |
|-------|------|
| `equation_sheets.equations[].substitution_template` | Layout (product / fraction / sum_product) — operators fixed, values in slots |
| `calculation_config.steps[]` substitution step | `mode: "structured"`, `equation_id`, `slot_answers` per slot id |
| `rearrangement_forms` on equation | Auto-build numeric rearrangement dropdown (`I = 400 / 20` style) |

## Marking rules (AQA-aligned)

### Equation gate

When an **equation select** step is enabled:

- **Substitution, rearrangement, and calculate** marks require the student to have chosen the **mark-scheme equation**.
- **Conversion** and **sig figs** marks are **independent** — awarded when those steps are correct, even if the wrong equation was used.
- Students can still complete substitution and rearrangement using their chosen equation (UI follows selection); they score zero on equation-dependent steps.

### Wrong-equation feedback

When the wrong equation is selected, feedback shows:

1. **Correct equation** — LaTeX from the mark-scheme equation entry
2. **Substitution incorrect** — wrong variables substituted
3. **Rearrangement incorrect** — wrong variables used
4. **Answer incorrect** — incorrect equation used (even if the final number matches)

### Commutative multiplication

For structured templates, slots in the same **×-chain** on one side of `=` are matched **commutatively** against `slot_answers`. For example:

- `P = I × V`: values for `I` and `V` may appear in either slot (`12 = I × 400` or `12 = 400 × I`)
- `ΔE = m × c × Δθ`: the three RHS factors are commutative as a group
- Slots with a **²/³ suffix** in the template, fraction numerator/denominator, and `+` chains remain **positional**

### Rearrangement marking

- **UI** builds options from the student's equation + live slot values
- **Marking** compares against the mark-scheme rearrangement built from `slot_answers` (structural match; spacing-insensitive; × operands commutative on RHS products)

**Hybrid fallback:** if substitution step is free-text, or the selected equation has no template, students see `#calc_substitution` as before.

## Equations with structured templates (28)

`charge`, `potential_difference`, `power_vi`, `energy_pt`, `energy_qv`, `weight`, `work_done`, `spring_force`, `distance_speed`, `force`, `momentum`, `specific_latent_heat`, `wave_speed`, `moment`, `force_on_conductor`, `gravitational_potential_energy`, `pressure_column`, `specific_heat_capacity`, `transformer`, `power_energy`, `power_work`, `density`, `acceleration`, `period`, `pressure`, `force_momentum`, `kinetic_energy`, `elastic_potential_energy`, `power_i2r`

Source: `data/equation_sheets/substitution_templates.json`

## Equations without templates (free-text only)

| id | Reason |
|----|--------|
| efficiency_energy, efficiency_power | Word labels in numerator/denominator |
| magnification | Word labels |
| suvat | Multi-term |
| pv_constant | No single rearrangement pattern |
| transformer_turns | Ratio on both sides |

## Authoring (admin)

1. Tick **Substitution** → choose **Structured** mode.
2. Pick **Equation for template** from the linked sheet.
3. Enter **expected value per slot** (`400`, `I | i`, etc.).
4. With **Rearrangement** enabled: set mode **Numeric**, pick **Unknown (subject)** — correct + distractors auto-generate on save.

## Student UI

- Structured layout renders in `.calc-sub-step-inner`.
- Changing **equation select** re-renders substitution (and numeric rearrangement options when configured).
- Response payload: `{ mode: "structured", slots: {...}, text: "..." }` or `{ mode: "free_text", text: "..." }`.

## Key files

- `src/substitutionTemplate.js` — render, collect, commutative mark, structural rearrangement
- `src/calculationWorkflow.js` — workflow integration, equation gate, feedback bundle
- `data/equation_sheets/substitution_templates.json` — template source of truth
- `scripts/merge_substitution_templates.mjs` — merge into sheet JSON
- `tests/calculationMarking.test.js` — marking unit tests (`node --test tests/calculationMarking.test.js`)

## DB migration

Run `supabase/migrations/20250624_substitution_templates.sql` (or re-seed from updated JSON) to patch `equation_sheets.equations` JSONB in Supabase.
