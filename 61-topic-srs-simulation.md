# 61-topic SRS simulation

Horizon-paced SM-2 simulation on a combined-shaped curriculum (**19 biology / 21 chemistry / 21 physics**).
Intros are interleaved **Bio → Chem → Phys** (round-robin), matching the live `pickWeeklyStarterSpecPoints` path.

## Scenarios (report only)

| Scenario | Horizon |
|---|---|
| `y10_pace_61` | Sept → 11 May +2 years |
| `y11_pace_61` | Sept → next 11 May |
| `final_months_pace_61` | ≤12 weeks |

```powershell
node --test tests/srsSimulation.test.js
node scripts/srsScenarioSimulator.mjs
```

Open [`preview-diagrams/srs-scenario-report.html`](preview-diagrams/srs-scenario-report.html).
