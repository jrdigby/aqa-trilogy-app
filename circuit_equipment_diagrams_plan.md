# Circuit & Equipment Diagram Builders — Implementation Plan

## Decision (locked)

- **Mode B:** Admin stem builders (SVG → PNG → `image_url`) **and** interactive student question types.
- **Equipment:** Shared library across Biology, Chemistry, Physics.
- **Tech:** Custom SVG + structured JSON (same as chemistry). No freehand canvas.

## Status

**Implemented** (2026-08-03):

- Migration: `supabase/migrations/20260803_circuit_equipment_diagrams.sql`
- Modules: `src/diagramSvgUtils.js`, `src/circuitWorkflow.js`, `src/equipmentWorkflow.js`, lazy loaders
- Admin: create/edit panels, stem builders, sandbox marking
- Student: mount + mark via `uiComponents.js` / `evalEngine.js` / `app.js`
- Tests: `tests/circuitWorkflow.test.js`, `tests/equipmentWorkflow.test.js`

## How to use (admin)

1. **Stem only (MCQ / short text):** Open “Build circuit diagram” or “Build equipment diagram” under the stem image field → preview → **Use as question diagram**.
2. **Interactive:** Set question type to **Circuit Diagram** or **Apparatus / Equipment**, pick a preset (or configure manually), save.

## Apply migration

Run the new SQL migration against your Supabase project before creating interactive circuit/equipment questions.
