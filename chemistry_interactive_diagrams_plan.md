# Chemistry Interactive Diagrams — Implementation Plan

## Decision (locked)

**Custom SVG widgets + structured JSON answers.** No Konva/canvas freehand. Equation balancing uses coefficient/species inputs with existing mhchem, not SVG.

Audience tagging already exists via `course_track` / `audience` / `triple_spec_point_id` in `src/sciencePath.js` — organic triple content will use that, not a separate renderer.

---

## Scope

### Structure diagrams (custom SVG)

| Kind | Content | Track |
|------|---------|-------|
| `electron_shell` | Bohr shells; nucleus p/n; e.g. Carbon-12 | Combined + Triple |
| `ionic_bonding` | Dot-and-cross ions; electron transfer; charges | Combined + Triple |
| `covalent_bonding` | Shared pairs + lone pairs (dot-and-cross) | Combined + Triple |
| `organic_structure` | Displayed formula templates | Combined: alkanes, alkenes. Triple: + alcohols (–OH), carboxylic acids (–COOH), esters |
| `polymer_structure` | Repeat unit / section of chain | Combined: addition polymers from alkenes. Triple: + condensation (polyesters, polyamides) |

### Equation widgets (not SVG)

| Kind | Content | Track / tier |
|------|---------|--------------|
| `balance_equation` subtype `symbol` | Coefficient steppers on mhchem species | Combined + Triple |
| subtype `ionic` | Full ionic equations | Higher tier |
| subtype `half` | Half-equations (e⁻, H⁺, H₂O, OH⁻ tokens) | Higher tier |

Organic “etc.” for AQA GCSE Chemistry (triple) is covered by alcohols, carboxylic acids, and esters on the shared organic engine — not open-ended A-level functional-group drawing.

---

## Architecture

- New `question_type`: `chemistry_interactive`
- New JSON field `chemistry_config` on `questions` (migration mirroring `calculation_config`)
- Modules:
  - `src/chemistryDiagramWorkflow.js` — shells + ionic/covalent SVG
  - `src/chemistryOrganicWorkflow.js` — displayed formulae, functional groups, polymers
  - `src/equationBalanceWorkflow.js` — symbol / ionic / half
  - `src/lazyChemistryWorkflow.js` — dynamic import cache
- Wire: `src/uiComponents.js`, `src/evalEngine.js`, `src/app.js`, `admin.html`

### Organic / polymer SVG model

One atom–bond graph with slot completion (not freehand): nodes (element + optional functional group), edges (bond order 1|2|3). Polymers: addition repeat units from alkenes; condensation ester/amide linkages for triple.

Marking: exact shell counts; bonding via charges + pair counts; organic/polymer via normalised graph; equations accept any positive integer multiple of the simplest whole-number ratio.

---

## Phased build order

1. **Plumbing** — type, `chemistry_config`, mount, admin shell, marker router
2. **Electron shells** — first SVG; proves authoring + student UX + marking
3. **Equation balancing** — symbol first, then HT ionic/half
4. **Ionic then covalent bonding** — reuse shell SVG primitives
5. **Organic core** — alkanes/alkenes displayed-formula templates
6. **Triple organic** — alcohols, carboxylic acids, esters
7. **Polymers** — addition repeat units, then condensation (triple)

---

## Status

**Implemented**, including Triple organic/polymer presets and admin **stem diagram builder** (Build chemistry diagram → Use as question diagram) for short-text/MCQ identification questions.
