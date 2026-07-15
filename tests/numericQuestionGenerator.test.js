import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  evaluateEquation,
  generateSlotValues,
  generateBatch,
  expandVariantDescriptors,
  solveForSubject,
  buildConversionStep,
  suggestBatchSkills,
  formatEquationLatexBlock,
  recomputeBatchDraft,
  inferBatchDemandLevel,
  resolveBatchBaseVariant,
  getDraftGivenSlotIds,
  listConversionUnitOptions,
  parseSlotDisplayInput,
  buildPrompt
} from "../src/numericQuestionGenerator.js";
import {
  buildCalculationConfigForVariant,
  buildSubstitutionFeedbackText,
  computeMaxMarksFromConfig,
  finalizeCalculationConfigForSave,
  markCalculationResponse
} from "../src/calculationWorkflow.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sheetP2 = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "equation_sheets", "physics_p2_ht.json"), "utf8"));
const sheetP1 = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "equation_sheets", "physics_p1_ht.json"), "utf8"));

function findEq(sheet, id) {
  return sheet.equations.find((e) => e.id === id);
}

test("evaluateEquation — product layout (weight)", () => {
  const eq = findEq(sheetP2, "weight");
  const { answer, unit } = evaluateEquation(eq, { m: "2", g: "10" });
  assert.equal(unit, "N");
  assert.ok(Math.abs(answer - 20) < 0.01);
});

test("evaluateEquation — efficiency (energy transfer)", () => {
  const eq = findEq(sheetP1, "efficiency_energy");
  assert.ok(eq?.substitution_template, "efficiency_energy should have a substitution template");
  const { answer, unit } = evaluateEquation(eq, { E_useful: "3000", E_in: "10000" });
  assert.equal(unit, "");
  assert.ok(Math.abs(answer - 0.3) < 0.001);
});

test("evaluateEquation — efficiency (power output)", () => {
  const eq = findEq(sheetP1, "efficiency_power");
  assert.ok(eq?.substitution_template, "efficiency_power should have a substitution template");
  const { answer } = evaluateEquation(eq, { P_useful: "150", P_in: "500" });
  assert.ok(Math.abs(answer - 0.3) < 0.001);
});

test("generateBatch — efficiency energy substitute variant", () => {
  const { drafts, errors } = generateBatch(
    {
      equation: "efficiency_energy",
      subject: "physics",
      paper: "paper1",
      tier: "foundation",
      seed: 42,
      variants: { recipes: [{ base: "substitute", count: 1 }] }
    },
    sheetP1
  );
  assert.equal(errors.length, 0, errors.map((e) => e.message).join("; "));
  assert.equal(drafts.length, 1);
  const d = drafts[0];
  const sub = d.question.calculation_config.steps.find((s) => s.type === "substitution");
  assert.ok(sub.slot_answers.E_useful?.length);
  assert.ok(sub.slot_answers.E_in?.length);
  assert.equal(sub.slot_answers.efficiency, undefined, "result slot omitted from slot_answers");
  assert.ok(d.question.prompt.includes("useful energy"));
  assert.ok(Number(d.answer_key.key_payload.answer) > 0);
  assert.ok(Number(d.answer_key.key_payload.answer) < 1);
});

test("generateBatch — efficiency energy recall + conversion (kJ/MJ)", () => {
  for (let seed = 0; seed < 20; seed++) {
    const { drafts, errors } = generateBatch(
      {
        equation: "efficiency_energy",
        subject: "physics",
        paper: "paper1",
        tier: "higher",
        seed,
        variants: { recipes: [{ base: "recall", unitConversion: true, count: 1 }] }
      },
      sheetP1
    );
    assert.equal(errors.length, 0, `seed ${seed}: ${errors[0]?.message || ""}`);
    assert.equal(drafts.length, 1);
    const conv = drafts[0].question.calculation_config.steps.find((s) => s.type === "conversion");
    assert.ok(conv, "expected conversion step");
    assert.ok(["E_useful", "E_in"].includes(conv.slot_id));
    assert.ok(["kJ", "MJ"].includes(conv.from_unit));
  }
});

test("generateBatch — efficiency power recall + conversion (kW/MW)", () => {
  for (let seed = 0; seed < 20; seed++) {
    const { drafts, errors } = generateBatch(
      {
        equation: "efficiency_power",
        subject: "physics",
        paper: "paper1",
        tier: "higher",
        seed,
        variants: { recipes: [{ base: "recall", unitConversion: true, count: 1 }] }
      },
      sheetP1
    );
    assert.equal(errors.length, 0, `seed ${seed}: ${errors[0]?.message || ""}`);
    const conv = drafts[0].question.calculation_config.steps.find((s) => s.type === "conversion");
    assert.ok(conv);
    assert.ok(["P_useful", "P_in"].includes(conv.slot_id));
    assert.ok(["kW", "MW"].includes(conv.from_unit));
  }
});

test("listConversionUnitOptions — efficiency energy slots offer kJ and MJ", () => {
  for (const slotId of ["E_useful", "E_in"]) {
    const opts = listConversionUnitOptions(slotId);
    assert.ok(opts.some((o) => o.fromUnit === "kJ"), `${slotId} should offer kJ`);
    assert.ok(opts.some((o) => o.fromUnit === "MJ"), `${slotId} should offer MJ`);
  }
});

test("listConversionUnitOptions — efficiency power slots offer kW and MW", () => {
  for (const slotId of ["P_useful", "P_in"]) {
    const opts = listConversionUnitOptions(slotId);
    assert.ok(opts.some((o) => o.fromUnit === "kW"), `${slotId} should offer kW`);
    assert.ok(opts.some((o) => o.fromUnit === "MW"), `${slotId} should offer MW`);
  }
});

test("generateBatch — efficiency as percentage", () => {
  const { drafts, errors } = generateBatch(
    {
      equation: "efficiency_energy",
      subject: "physics",
      paper: "paper1",
      tier: "foundation",
      efficiency_as_percentage: true,
      constants: { E_useful: "3000", E_in: "10000" },
      seed: 42,
      variants: { recipes: [{ base: "substitute", count: 1 }] }
    },
    sheetP1
  );
  assert.equal(errors.length, 0, errors.map((e) => e.message).join("; "));
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].answer_key.key_payload.answer, 30);
  assert.equal(drafts[0].answer_key.key_payload.unit, "%");
  assert.ok(drafts[0].question.prompt.includes("percentage"));
});

test("solveForSubject — efficiency energy rearranged for E_useful", () => {
  const eq = findEq(sheetP1, "efficiency_energy");
  const E_useful = solveForSubject(eq, { efficiency: "0.25", E_in: "8000" }, "E_useful");
  assert.ok(Math.abs(E_useful - 2000) < 0.001, `expected 2000, got ${E_useful}`);
});

test("solveForSubject — gravitational potential energy rearranged for h", () => {
  const eq = findEq(sheetP1, "gravitational_potential_energy");
  const slots = { E: "200", m: "4", g: "10" };
  const h = solveForSubject(eq, slots, "h");
  assert.ok(Math.abs(h - 5) < 0.001, `expected h=5, got ${h}`);
});

test("generateBatch — gravitational potential energy rearrangement for h", () => {
  const { drafts, errors } = generateBatch(
    {
      equation: "gravitational_potential_energy",
      sheet: "physics_p1_ht",
      rearrangement_subject: "h",
      variants: { recipes: [{ base: "recall", rearrangement: true, count: 1 }] },
      seed: 42
    },
    sheetP1
  );
  assert.equal(errors.length, 0, errors.map((e) => e.message).join("; "));
  assert.equal(drafts.length, 1);
  const cfg = drafts[0].question.calculation_config;
  assert.ok(cfg.steps.some((s) => s.type === "rearrangement"));
  assert.equal(
    cfg.steps.find((s) => s.type === "substitution")?.rearrangement_subject,
    "h"
  );
  assert.equal(drafts[0].answer_key.key_payload.unit, "m");
});

test("generateBatch — distance travelled uses metres and natural prompt", () => {
  const { drafts, errors } = generateBatch(
    {
      equation: "distance_speed",
      sheet: "physics_p2_ht",
      constants: { v: "15", t: "14" },
      variants: { recipes: [{ base: "substitute", count: 1 }] },
      seed: 1
    },
    sheetP2
  );
  assert.equal(errors.length, 0, errors.map((e) => e.message).join("; "));
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].answer_key.key_payload.unit, "m");
  assert.equal(drafts[0].answer_key.key_payload.answer, 210);
  assert.equal(
    drafts[0].question.prompt.split("\n\n")[0],
    "Calculate the distance an object travels in 14 s at a speed of 15 m/s."
  );
});

test("generateBatch — distance rearranged for speed uses m/s", () => {
  const { drafts, errors } = generateBatch(
    {
      equation: "distance_speed",
      sheet: "physics_p2_ht",
      rearrangement_subject: "v",
      variants: { recipes: [{ base: "recall", rearrangement: true, count: 1 }] },
      seed: 5
    },
    sheetP2
  );
  assert.equal(errors.length, 0, errors.map((e) => e.message).join("; "));
  assert.equal(drafts[0].answer_key.key_payload.unit, "m/s");
});

test("generateBatch — charge flow rearrangement uses subject unit not result unit", () => {
  const { drafts: forI, errors: errI } = generateBatch(
    {
      equation: "charge",
      sheet: "physics_p1_ht",
      rearrangement_subject: "I",
      variants: { recipes: [{ base: "recall", rearrangement: true, count: 1 }] },
      seed: 42
    },
    sheetP1
  );
  assert.equal(errI.length, 0, errI.map((e) => e.message).join("; "));
  assert.equal(forI[0].answer_key.key_payload.unit, "A");

  const { drafts: forT, errors: errT } = generateBatch(
    {
      equation: "charge",
      sheet: "physics_p1_ht",
      rearrangement_subject: "t",
      variants: { recipes: [{ base: "recall", rearrangement: true, count: 1 }] },
      seed: 42
    },
    sheetP1
  );
  assert.equal(errT.length, 0, errT.map((e) => e.message).join("; "));
  assert.equal(forT[0].answer_key.key_payload.unit, "s");
});

test("buildCalculationConfigForVariant — substitute vs optional rearrangement", () => {
  const slotAnswers = { m: ["2"], v: ["4"], E: ["16"] };
  const sub = buildCalculationConfigForVariant("substitute", {
    equationId: "kinetic_energy",
    sheetId: "physics_p1_ht",
    slotAnswers
  });
  assert.equal(computeMaxMarksFromConfig(sub), 2);

  const subRearr = buildCalculationConfigForVariant("substitute", {
    equationId: "kinetic_energy",
    sheetId: "physics_p1_ht",
    slotAnswers,
    rearrangementSubject: "v",
    includeRearrangement: true
  });
  const finalized = finalizeCalculationConfigForSave(subRearr, sheetP1.equations);
  assert.equal(computeMaxMarksFromConfig(finalized), 3);
  assert.ok(finalized.equation_given);
  assert.ok(finalized.steps.some((s) => s.type === "rearrangement"));

  const recallRearr = buildCalculationConfigForVariant("recall", {
    equationId: "kinetic_energy",
    sheetId: "physics_p1_ht",
    slotAnswers,
    rearrangementSubject: "v",
    includeRearrangement: true
  });
  assert.equal(computeMaxMarksFromConfig(recallRearr), 3);
  assert.equal(recallRearr.equation_given, false);
});

test("expandVariantDescriptors — base paths + optional flags", () => {
  const list = expandVariantDescriptors({
    substitute: 2,
    recall: 1,
    with_rearrangement: true,
    with_conversion: true
  });
  assert.equal(list.length, 3);
  assert.equal(list.filter((v) => v.base === "substitute").length, 2);
  assert.equal(list.filter((v) => v.base === "recall").length, 1);
  assert.ok(list.every((v) => v.rearrangement && v.unitConversion));
});

test("expandVariantDescriptors — per-recipe optional steps", () => {
  const list = expandVariantDescriptors({
    recipes: [
      { base: "substitute", count: 2 },
      { base: "substitute", rearrangement: true, count: 1 },
      { base: "substitute", rearrangement: true, unitConversion: true, count: 1 },
      { base: "recall", unitConversion: true, sigFigs: true, count: 1 }
    ]
  });
  assert.equal(list.length, 5);
  assert.equal(list.filter((v) => v.base === "substitute" && !v.rearrangement).length, 2);
  assert.equal(list.filter((v) => v.rearrangement && !v.unitConversion).length, 1);
  assert.equal(list.filter((v) => v.rearrangement && v.unitConversion).length, 1);
  assert.equal(list.filter((v) => v.base === "recall" && v.unitConversion && v.sigFigs).length, 1);
});

test("generateBatch — maps foundation tier to FT for database", () => {
  const { drafts, errors } = generateBatch(
    {
      equation: "kinetic_energy",
      sheet: "physics_p1_ft",
      tier: "foundation",
      variants: { substitute: 1 },
      seed: 1
    },
    sheetP1
  );
  assert.equal(errors.length, 0);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].question.tier, "FT");
});

test("generateBatch produces drafts with answer keys", () => {
  const { drafts, errors } = generateBatch(
    {
      equation: "kinetic_energy",
      sheet: "physics_p1_ht",
      variants: { substitute: 2 },
      seed: 42
    },
    sheetP1
  );
  assert.equal(errors.length, 0);
  assert.equal(drafts.length, 2);
  for (const d of drafts) {
    assert.ok(d.question.prompt.length > 10);
    assert.equal(d.question.max_marks, 2);
  }
});

test("substitute + rearrangement solves for unknown", () => {
  const { drafts } = generateBatch(
    {
      equation: "elastic_potential_energy",
      sheet: "physics_p1_ht",
      rearrangement_subject: "e",
      variants: { substitute: 1, with_rearrangement: true },
      seed: 99
    },
    sheetP1
  );
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].rearrangement_subject, "e");
  assert.ok(drafts[0].question.prompt.toLowerCase().includes("extension"));
  assert.ok(drafts[0].question.calculation_config.equation_given);
  assert.ok(drafts[0].skill_codes.ms.includes("MS3b"));
});

test("inferBatchDemandLevel — HT 3-mark recall + one optional is standard_45", () => {
  assert.equal(
    inferBatchDemandLevel(
      { base: "recall", rearrangement: true },
      { tier: "higher", maxMarks: 3 },
      {}
    ),
    "standard_45"
  );
});

test("inferBatchDemandLevel — HT 4–5 marks is standard_67", () => {
  assert.equal(
    inferBatchDemandLevel(
      { base: "recall", rearrangement: true, unitConversion: true },
      { tier: "higher", maxMarks: 4 },
      {}
    ),
    "standard_67"
  );
  assert.equal(
    inferBatchDemandLevel(
      { base: "recall", rearrangement: true, unitConversion: true, sigFigs: true },
      { tier: "higher", maxMarks: 5 },
      {}
    ),
    "standard_67"
  );
});

test("resolveBatchBaseVariant — HT coerces substitute to recall", () => {
  assert.equal(resolveBatchBaseVariant({ tier: "higher" }, { base: "substitute" }), "recall");
  assert.equal(resolveBatchBaseVariant({ tier: "foundation" }, { base: "substitute" }), "substitute");
});

test("generateBatch — HT substitute recipe generates recall workflow", () => {
  const { drafts } = generateBatch(
    {
      equation: "kinetic_energy",
      sheet: "physics_p1_ht",
      tier: "higher",
      variants: { substitute: 1 },
      seed: 20
    },
    sheetP1
  );
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].question.calculation_config.equation_given, false);
  assert.ok(drafts[0].question.calculation_config.steps.some((s) => s.type === "equation_select"));
  assert.equal(drafts[0].question.demand_level, "standard_45");
  assert.equal(drafts[0].question.max_marks, 2);
});

test("generateBatch — HT recall + rearrange is standard_45 difficulty 3", async () => {
  const { computeQuestionDifficulty } = await import("../src/examRules.js");
  const { drafts } = generateBatch(
    {
      equation: "kinetic_energy",
      sheet: "physics_p1_ht",
      tier: "higher",
      rearrangement_subject: "v",
      variants: { recipes: [{ base: "recall", rearrangement: true, count: 1 }] },
      seed: 21
    },
    sheetP1
  );
  assert.equal(drafts[0].question.max_marks, 3);
  assert.equal(drafts[0].question.demand_level, "standard_45");
  assert.equal(computeQuestionDifficulty(drafts[0].question), 3);
});

test("generateBatch — HT recall + two optionals is standard_67 difficulty 4", async () => {
  const { computeQuestionDifficulty } = await import("../src/examRules.js");
  const { drafts } = generateBatch(
    {
      equation: "kinetic_energy",
      sheet: "physics_p1_ht",
      tier: "higher",
      rearrangement_subject: "m",
      variants: {
        recipes: [{ base: "recall", rearrangement: true, unitConversion: true, count: 1 }]
      },
      seed: 22
    },
    sheetP1
  );
  assert.equal(drafts[0].question.max_marks, 4);
  assert.equal(drafts[0].question.demand_level, "standard_67");
  assert.equal(computeQuestionDifficulty(drafts[0].question), 4);
});

test("inferBatchDemandLevel — rearrangement is not auto high_89", () => {
  const demand = inferBatchDemandLevel(
    { base: "substitute", rearrangement: true },
    { tier: "higher" },
    {}
  );
  assert.notEqual(demand, "high_89");
  assert.equal(demand, "standard_45");
});

test("inferBatchDemandLevel — foundation simple substitute is low", () => {
  assert.equal(inferBatchDemandLevel({ base: "substitute" }, { tier: "foundation" }, {}), "low");
  assert.equal(inferBatchDemandLevel({ base: "substitute" }, { tier: "FT" }, {}), "low");
});

test("inferBatchDemandLevel — both tier is not treated as HT band", () => {
  assert.equal(inferBatchDemandLevel({ base: "substitute" }, { tier: "both" }, {}), "low");
});

test("inferBatchDemandLevel — foundation recall is standard (difficulty 2)", () => {
  assert.equal(inferBatchDemandLevel({ base: "recall" }, { tier: "foundation" }, {}), "standard");
});

test("generateBatch — 2-mark substitute is low FT AO2-only; recall is standard", async () => {
  const { computeQuestionDifficulty } = await import("../src/examRules.js");

  const { drafts: subDrafts } = generateBatch(
    {
      equation: "kinetic_energy",
      sheet: "physics_p1_ft",
      tier: "foundation",
      variants: { substitute: 1 },
      seed: 11
    },
    sheetP1
  );
  assert.equal(subDrafts[0].question.max_marks, 2);
  assert.equal(subDrafts[0].question.demand_level, "low");
  assert.equal(subDrafts[0].question.ao1_marks, 0);
  assert.equal(subDrafts[0].question.ao2_marks, 2);
  assert.equal(computeQuestionDifficulty(subDrafts[0].question), 1);

  const { drafts: recallDrafts } = generateBatch(
    {
      equation: "kinetic_energy",
      sheet: "physics_p1_ft",
      tier: "foundation",
      variants: { recall: 1 },
      seed: 12
    },
    sheetP1
  );
  assert.equal(recallDrafts[0].question.max_marks, 2);
  assert.equal(recallDrafts[0].question.demand_level, "standard");
  assert.equal(recallDrafts[0].question.ao1_marks, 0);
  assert.equal(recallDrafts[0].question.ao2_marks, 2);
  assert.equal(computeQuestionDifficulty(recallDrafts[0].question), 2);
});

test("generateBatch — recall + rearrange + conversion + sig figs (HT) with fixed v unknown", () => {
  for (let seed = 0; seed < 40; seed++) {
    const { drafts, errors } = generateBatch(
      {
        equation: "kinetic_energy",
        sheet: "physics_p1_ht",
        tier: "higher",
        rearrangement_subject: "v",
        variants: {
          recipes: [{
            base: "recall",
            rearrangement: true,
            unitConversion: true,
            sigFigs: true,
            count: 1
          }]
        },
        seed
      },
      sheetP1
    );
    assert.equal(errors.length, 0, `seed ${seed}: ${errors[0]?.message || ""}`);
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].rearrangement_subject, "v");
    assert.equal(drafts[0].question.max_marks, 5);
    assert.equal(drafts[0].question.demand_level, "standard_67");
  }
});

test("generateBatch — structured substitution marks full marks for kinetic energy", () => {
  const { drafts } = generateBatch(
    { equation: "kinetic_energy", sheet: "physics_p1_ht", variants: { substitute: 1 }, seed: 7 },
    sheetP1
  );
  const draft = drafts[0];
  const cfg = draft.question.calculation_config;
  const subStep = cfg.steps.find((s) => s.type === "substitution");
  const slots = {};
  for (const [id, vals] of Object.entries(subStep.slot_answers || {})) {
    slots[id] = Array.isArray(vals) ? vals[0] : vals;
  }
  slots.E = "E";

  const resp = {
    steps: {
      substitution: { mode: "structured", equation_id: "kinetic_energy", slots },
      calculate: draft.answer_key.key_payload.answer
    }
  };

  const result = markCalculationResponse(
    { max_marks: draft.question.max_marks, calculation_config: cfg },
    resp,
    { key_payload: draft.answer_key.key_payload },
    [],
    "",
    sheetP1
  );
  assert.equal(result.total, result.max);
});

test("auto rearrangement mixes subjects across drafts", () => {
  const { drafts } = generateBatch(
    {
      equation: "elastic_potential_energy",
      sheet: "physics_p1_ht",
      variants: { substitute: 6, with_rearrangement: true },
      seed: 77
    },
    sheetP1
  );
  const subjects = new Set(drafts.map((d) => d.rearrangement_subject).filter(Boolean));
  assert.ok(subjects.size >= 2, "expected mix of rearrangement unknowns");
});

test("getDraftGivenSlotIds — rearrange for k includes energy (E) and extension", () => {
  const eq = findEq(sheetP1, "elastic_potential_energy");
  const ids = getDraftGivenSlotIds(
    { variant: { base: "substitute", rearrangement: true }, rearrangement_subject: "k" },
    eq
  );
  assert.deepEqual(ids.sort(), ["E", "e"]);
});

test("recomputeBatchDraft — editing given values updates rearrangement prompt", () => {
  const eq = findEq(sheetP1, "elastic_potential_energy");
  const { drafts } = generateBatch(
    {
      equation: "elastic_potential_energy",
      sheet: "physics_p1_ht",
      rearrangement_subject: "k",
      variants: { recipes: [{ base: "substitute", rearrangement: true, count: 1 }] },
      seed: 12
    },
    sheetP1
  );
  const draft = drafts[0];
  assert.ok(draft.slot_edits.E, "energy slot should be editable when solving for k");
  assert.ok(draft.slot_edits.e?.convertible, "extension should offer unit options");
  assert.ok(draft.slot_edits.E?.convertible, "energy should offer kJ/MJ options");
  draft.slot_edits.e.display = "0.1";
  recomputeBatchDraft(draft, eq, sheetP1);
  assert.ok(draft.question.prompt.includes("0.1"));
  assert.ok(draft.question.prompt.toLowerCase().includes("extension"));
});

test("parseSlotDisplayInput — typed value with unit", () => {
  const parsed = parseSlotDisplayInput("0.5cm", "e");
  assert.equal(parsed.display, "0.5");
  assert.equal(parsed.unit, "cm");
  assert.equal(parsed.factor, 0.01);

  const energyOpts = listConversionUnitOptions("E");
  assert.ok(energyOpts.some((o) => o.fromUnit === "kJ"));
  assert.ok(energyOpts.some((o) => o.fromUnit === "MJ"));
});

test("conversion + substitution (no rearrangement) — substitution feedback shows full equation with SI values", () => {
  const { drafts } = generateBatch(
    {
      equation: "kinetic_energy",
      sheet: "physics_p1_ht",
      variants: { recipes: [{ base: "substitute", unitConversion: true, count: 1 }] },
      seed: 12
    },
    sheetP1
  );
  const cfg = drafts[0].question.calculation_config;
  const convStep = cfg.steps.find((s) => s.type === "conversion");
  const subStep = cfg.steps.find((s) => s.type === "substitution");
  assert.ok(convStep?.slot_id);
  assert.ok(!cfg.steps.some((s) => s.type === "rearrangement"));

  const convSlot = convStep.slot_id;
  const siVal = subStep.si_slot_answers?.[convSlot]?.[0] ?? subStep.slot_answers[convSlot][0];
  assert.equal(siVal, String(convStep.answer));
  assert.notEqual(siVal, String(convStep.display_value));

  const eq = findEq(sheetP1, "kinetic_energy");
  const expected = buildSubstitutionFeedbackText(subStep, eq, { convStep, config: cfg });
  assert.equal(subStep.feedback_if_wrong, expected);
  assert.match(subStep.feedback_if_wrong, /^Substitute E,/);
  assert.ok(subStep.feedback_if_wrong.includes(`m = ${siVal}`), `feedback should use SI value: ${subStep.feedback_if_wrong}`);
  assert.ok(!subStep.feedback_if_wrong.includes(String(convStep.display_value)), `feedback should not use stem display: ${subStep.feedback_if_wrong}`);
});

test("batch substitution feedback_if_wrong matches live equation feedback (rearrangement keeps symbol slot)", () => {
  const { drafts } = generateBatch(
    {
      equation: "kinetic_energy",
      sheet: "physics_p1_ht",
      rearrangement_subject: "m",
      variants: { recipes: [{ base: "substitute", rearrangement: true, count: 1 }] },
      seed: 77
    },
    sheetP1
  );
  const draft = drafts[0];
  const cfg = draft.question.calculation_config;
  const subStep = cfg.steps.find((s) => s.type === "substitution");
  const eq = findEq(sheetP1, "kinetic_energy");
  const convStep = cfg.steps.find((s) => s.type === "conversion");
  const expected = buildSubstitutionFeedbackText(subStep, eq, {
    convStep,
    config: cfg,
    slotEdits: draft.slot_edits,
    promptOverrides: {}
  });
  assert.equal(subStep.feedback_if_wrong, expected);
  assert.match(subStep.feedback_if_wrong, /\bm\b/, "unknown subject should stay as symbol in equation feedback");
});

test("conversion + rearrangement — substitution mark scheme uses SI after conversion step", async () => {
  const { buildSiSlotAnswersForRearrangement, buildNumericRearrangementOptions } = await import(
    "../src/substitutionTemplate.js"
  );
  const { generateBatch } = await import("../src/numericQuestionGenerator.js");

  const { drafts } = generateBatch(
    {
      equation: "kinetic_energy",
      sheet: "physics_p1_ht",
      rearrangement_subject: "m",
      variants: {
        recipes: [{ base: "substitute", rearrangement: true, unitConversion: true, count: 1 }]
      },
      seed: 101
    },
    sheetP1
  );
  assert.equal(drafts.length, 1);
  const cfg = drafts[0].question.calculation_config;
  const subStep = cfg.steps.find((s) => s.type === "substitution");
  const convStep = cfg.steps.find((s) => s.type === "conversion");
  assert.ok(convStep?.slot_id);

  const convIdx = cfg.steps.findIndex((s) => s.type === "conversion");
  const subIdx = cfg.steps.findIndex((s) => s.type === "substitution");
  assert.ok(convIdx >= 0 && subIdx >= 0 && convIdx < subIdx, "conversion should precede substitution");

  const convSlot = convStep.slot_id;
  const siVal = subStep.si_slot_answers[convSlot][0];
  assert.equal(subStep.slot_answers[convSlot][0], siVal, "substitution mark scheme should use SI value");

  const eq = findEq(sheetP1, "kinetic_energy");
  const rearrStep = cfg.steps.find((s) => s.type === "rearrangement");
  const siSlots = buildSiSlotAnswersForRearrangement(subStep, convStep, {
    steps: { conversion: parseFloat(siVal) }
  });
  const built = buildNumericRearrangementOptions(eq, subStep, rearrStep, { siSlotAnswers: siSlots });
  assert.ok(built.answer.includes(siVal), `rearrangement should use SI ${siVal}, got ${built.answer}`);
});

test("rearrangement for v shows v² on LHS", async () => {
  const { buildNumericRearrangementOptions } = await import("../src/substitutionTemplate.js");
  const eq = findEq(sheetP1, "kinetic_energy");
  const subStep = {
    slot_answers: { E: ["16"], m: ["2"] },
    si_slot_answers: { E: ["16"], m: ["2"] },
    rearrangement_subject: "v"
  };
  const rearrStep = { mode: "numeric", subject: "v" };
  const built = buildNumericRearrangementOptions(eq, subStep, rearrStep);
  assert.match(built.answer, /^v²\s*=/);
  assert.ok(!/^v\s*=/.test(built.answer), "should not show v = sqrt form");
});

test("buildPrompt appends sig figs instruction", () => {
  const eq = findEq(sheetP1, "kinetic_energy");
  const prompt = buildPrompt(eq, "substitute", { m: "2", v: "3", E: "9" }, {
    equationGiven: true,
    sigFigsCount: 2
  });
  assert.ok(prompt.includes("Give your answer to 2 significant figures"));
});

test("buildPrompt — conversion keeps English template without equals signs", () => {
  const eq = findEq(sheetP2, "work_done");
  const prompt = buildPrompt(eq, "recall", { F: "360", s: "75", W: "27000" }, {
    equationGiven: false,
    promptOverrides: { s: "7500 cm" }
  });
  assert.equal(
    prompt,
    "Calculate the work done when a force of 360 N acts over a distance of 7500 cm."
  );
  assert.ok(!prompt.includes("="));
  assert.ok(!/Calculate the Work/.test(prompt));
});

test("buildPrompt — rearrangement uses English sentences and work-done label", () => {
  const eq = findEq(sheetP2, "work_done");
  const prompt = buildPrompt(eq, "recall", { F: "?", s: "100", W: "310" }, {
    equationGiven: false,
    includeRearrangement: true,
    rearrangementSubject: "F"
  });
  assert.equal(prompt, "Calculate the force when the work done is 310 J and the distance is 100 m.");
  assert.ok(!prompt.includes("="));
  assert.ok(!prompt.toLowerCase().includes("weight"));
});

test("buildPrompt — rearrangement with conversion stays English", () => {
  const eq = findEq(sheetP2, "work_done");
  const prompt = buildPrompt(eq, "recall", { F: "?", s: "100", W: "310" }, {
    equationGiven: false,
    includeRearrangement: true,
    rearrangementSubject: "F",
    promptOverrides: { s: "10000 cm" }
  });
  assert.equal(
    prompt,
    "Calculate the force when the work done is 310 J and the distance is 10000 cm."
  );
  assert.ok(!prompt.includes("="));
});

test("generateBatch — recall+conversion and rearrange prompts are English sentences", () => {
  for (const recipe of [
    { base: "recall", unitConversion: true, count: 1 },
    { base: "recall", rearrangement: true, count: 1 },
    { base: "recall", rearrangement: true, unitConversion: true, count: 1 }
  ]) {
    const { drafts, errors } = generateBatch(
      {
        equation: "work_done",
        subject: "physics",
        paper: "paper2",
        tier: "higher",
        seed: 11,
        rearrangement_subject: "F",
        variants: { recipes: [recipe] }
      },
      sheetP2
    );
    assert.equal(errors.length, 0, errors.map((e) => e.message).join("; "));
    const prompt = drafts[0].question.prompt.split("\n\n")[0];
    assert.ok(prompt.startsWith("Calculate the "), prompt);
    assert.ok(!prompt.includes("="), `unexpected equals in: ${prompt}`);
    assert.ok(/^Calculate the [a-z]/.test(prompt), `expected lowercase label: ${prompt}`);
    if (recipe.rearrangement) {
      assert.ok(prompt.includes("work done"), prompt);
      assert.ok(!prompt.toLowerCase().includes("weight"), prompt);
    }
  }
});

test("suvat — evaluateEquation and solveForSubject for all four variables", () => {
  const eq = findEq(sheetP2, "suvat");
  assert.ok(eq?.substitution_template, "suvat should have a substitution template");

  // v² − u² = 2as → 5² − 3² = 16 = 2×2×4
  const slots = { u: "3", a: "2", s: "4", v: "5" };
  const { answer, unit } = evaluateEquation(eq, slots);
  assert.equal(unit, "m/s");
  assert.ok(Math.abs(answer - 5) < 1e-9);

  assert.ok(Math.abs(solveForSubject(eq, slots, "v") - 5) < 1e-9);
  assert.ok(Math.abs(solveForSubject(eq, { v: "5", a: "2", s: "4" }, "u") - 3) < 1e-9);
  assert.ok(Math.abs(solveForSubject(eq, { v: "5", u: "3", s: "4" }, "a") - 2) < 1e-9);
  assert.ok(Math.abs(solveForSubject(eq, { v: "5", u: "3", a: "2" }, "s") - 4) < 1e-9);
});

test("suvat — generateSlotValues yields nice final velocity", () => {
  const eq = findEq(sheetP2, "suvat");
  let t = 0;
  const rng = () => {
    t += 0.17;
    return t % 1;
  };
  const { slots, slot_answers } = generateSlotValues(eq, {}, {}, rng);
  assert.ok(slot_answers.u);
  assert.ok(slot_answers.a);
  assert.ok(slot_answers.s);
  assert.equal(slot_answers.v, undefined, "result v omitted from slot_answers");
  const v = Number(slots.v);
  const u = Number(slots.u);
  const a = Number(slots.a);
  const s = Number(slots.s);
  assert.ok(Math.abs(v * v - (u * u + 2 * a * s)) < 1e-6);
  assert.ok(Number.isInteger(v) || Math.abs(v * 10 - Math.round(v * 10)) < 1e-9);
});

test("suvat — subject-specific prompts for each unknown", () => {
  const eq = findEq(sheetP2, "suvat");
  const cases = [
    {
      subject: "v",
      slots: { u: "3", a: "2", s: "4", v: "?" },
      expect: "Calculate the final velocity of an object that starts at 3 m/s and accelerates at 2 m/s² for 4 m."
    },
    {
      subject: "u",
      slots: { v: "5", a: "2", s: "4", u: "?" },
      expect: "Calculate the initial velocity of an object that accelerated at 2 m/s² for 4 m and finished at 5 m/s."
    },
    {
      subject: "a",
      slots: { u: "3", v: "5", s: "4", a: "?" },
      expect: "Calculate the acceleration of an object that started at 3 m/s and finished at 5 m/s after travelling 4 m."
    },
    {
      subject: "s",
      slots: { u: "3", a: "2", v: "5", s: "?" },
      expect: "Calculate the distance an object travels when starting at 3 m/s, accelerating at 2 m/s² and finishing at 5 m/s."
    }
  ];
  for (const { subject, slots, expect } of cases) {
    const prompt = buildPrompt(eq, "recall", slots, {
      equationGiven: false,
      includeRearrangement: true,
      rearrangementSubject: subject
    });
    assert.equal(prompt, expect);
  }
});

test("suvat — rearrangement options keep v² and include sign-flip distractor", async () => {
  const { buildNumericRearrangementOptions } = await import("../src/substitutionTemplate.js");
  const eq = findEq(sheetP2, "suvat");
  const subStep = {
    slot_answers: { u: ["3"], a: ["2"], s: ["4"] },
    si_slot_answers: { u: ["3"], a: ["2"], s: ["4"] },
    rearrangement_subject: "v"
  };
  const rearrStep = { mode: "numeric", subject: "v" };
  const built = buildNumericRearrangementOptions(eq, subStep, rearrStep);
  assert.match(built.answer, /^v²\s*=/);
  assert.ok(built.answer.includes("+"), `expected + in correct: ${built.answer}`);
  assert.ok(
    built.distractors.some((d) => /^v²\s*=/.test(d) && d.includes("-")),
    `expected sign-flip distractor among ${JSON.stringify(built.distractors)}`
  );
});

test("generateBatch — suvat rearrange for each subject", () => {
  for (const subject of ["v", "u", "a", "s"]) {
    const { drafts, errors } = generateBatch(
      {
        equation: "suvat",
        subject: "physics",
        paper: "paper2",
        tier: "higher",
        seed: 17,
        rearrangement_subject: subject,
        variants: { recipes: [{ base: "recall", rearrangement: true, count: 1 }] }
      },
      sheetP2
    );
    assert.equal(errors.length, 0, `${subject}: ${errors.map((e) => e.message).join("; ")}`);
    assert.equal(drafts.length, 1);
    const prompt = drafts[0].question.prompt.split("\n\n")[0];
    assert.ok(prompt.startsWith("Calculate the "), prompt);
    assert.ok(!prompt.includes("="), prompt);
    const rearr = drafts[0].question.calculation_config.steps.find((s) => s.type === "rearrangement");
    assert.ok(rearr, "expected rearrangement step");
    assert.equal(rearr.subject, subject);
    if (subject === "v" || subject === "u") {
      assert.match(String(rearr.answer || ""), new RegExp(`^${subject}²\\s*=`));
    }
  }
});

test("generateBatch — suvat recall+rearrange+conversion works for distance unknown", () => {
  const { drafts, errors } = generateBatch(
    {
      equation: "suvat",
      subject: "physics",
      paper: "paper2",
      tier: "higher",
      seed: 9,
      rearrangement_subject: "s",
      variants: {
        recipes: [{ base: "recall", rearrangement: true, unitConversion: true, sigFigs: true, count: 1 }]
      }
    },
    sheetP2
  );
  assert.equal(errors.length, 0, errors.map((e) => e.message).join("; "));
  assert.equal(drafts.length, 1);
  const prompt = drafts[0].question.prompt.split("\n\n")[0];
  assert.ok(/km\/h/.test(prompt), `expected velocity conversion in prompt: ${prompt}`);
  const conv = drafts[0].question.calculation_config.steps.find((s) => s.type === "conversion");
  assert.ok(conv, "expected conversion step");
});

test("suvat is available on FT paper 2 sheet", () => {
  const sheetFt = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "data", "equation_sheets", "physics_p2_ft.json"), "utf8")
  );
  const eq = findEq(sheetFt, "suvat");
  assert.ok(eq, "suvat should be on physics_p2_ft");
  assert.ok(eq.substitution_template, "suvat FT entry needs substitution template");
  assert.notEqual(eq.ht_only, true);

  const { drafts, errors } = generateBatch(
    {
      equation: "suvat",
      subject: "physics",
      paper: "paper2",
      tier: "foundation",
      seed: 4,
      rearrangement_subject: "v",
      variants: { recipes: [{ base: "substitute", rearrangement: true, count: 1 }] }
    },
    sheetFt
  );
  assert.equal(errors.length, 0, errors.map((e) => e.message).join("; "));
  assert.equal(drafts.length, 1);
  assert.ok(drafts[0].question.prompt.includes("final velocity"));
});
