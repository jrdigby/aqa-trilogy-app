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
  assert.ok(d.question.prompt.includes("useful energy"));
  assert.ok(Number(d.answer_key.key_payload.answer) > 0);
  assert.ok(Number(d.answer_key.key_payload.answer) < 1);
});

test("solveForSubject — efficiency energy rearranged for E_useful", () => {
  const eq = findEq(sheetP1, "efficiency_energy");
  const E_useful = solveForSubject(eq, { efficiency: "0.25", E_in: "8000" }, "E_useful");
  assert.ok(Math.abs(E_useful - 2000) < 0.001, `expected 2000, got ${E_useful}`);
});

test("solveForSubject — gravitational potential energy rearranged for h", () => {
  const eq = findEq(sheetP1, "gravitational_potential_energy");
  const slots = { E_p: "200", m: "4", g: "10" };
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
});

test("buildCalculationConfigForVariant — substitute vs optional rearrangement", () => {
  const slotAnswers = { m: ["2"], v: ["4"], E_k: ["16"] };
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

test("getDraftGivenSlotIds — rearrange for k includes energy (E_e) and extension", () => {
  const eq = findEq(sheetP1, "elastic_potential_energy");
  const ids = getDraftGivenSlotIds(
    { variant: { base: "substitute", rearrangement: true }, rearrangement_subject: "k" },
    eq
  );
  assert.deepEqual(ids.sort(), ["E_e", "e"]);
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
  assert.ok(draft.slot_edits.E_e, "energy slot should be editable when solving for k");
  assert.ok(draft.slot_edits.e?.convertible, "extension should offer unit options");
  assert.ok(draft.slot_edits.E_e?.convertible, "energy should offer kJ/MJ options");
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

  const energyOpts = listConversionUnitOptions("E_e");
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
  assert.match(subStep.feedback_if_wrong, /^Substitute E_k = /);
  assert.ok(subStep.feedback_if_wrong.includes(siVal), `feedback should use SI value in equation: ${subStep.feedback_if_wrong}`);
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
    slot_answers: { E_k: ["16"], m: ["2"] },
    si_slot_answers: { E_k: ["16"], m: ["2"] },
    rearrangement_subject: "v"
  };
  const rearrStep = { mode: "numeric", subject: "v" };
  const built = buildNumericRearrangementOptions(eq, subStep, rearrStep);
  assert.match(built.answer, /^v²\s*=/);
  assert.ok(!/^v\s*=/.test(built.answer), "should not show v = sqrt form");
});

test("buildPrompt appends sig figs instruction", () => {
  const eq = findEq(sheetP1, "kinetic_energy");
  const prompt = buildPrompt(eq, "substitute", { m: "2", v: "3", E_k: "9" }, {
    equationGiven: true,
    sigFigsCount: 2
  });
  assert.ok(prompt.includes("Give your answer to 2 significant figures"));
});
