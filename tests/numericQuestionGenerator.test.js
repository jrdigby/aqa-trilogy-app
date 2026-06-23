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
  getDraftGivenSlotIds,
  listConversionUnitOptions,
  parseSlotDisplayInput,
  buildPrompt
} from "../src/numericQuestionGenerator.js";
import {
  buildCalculationConfigForVariant,
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
  const { answer, unit } = evaluateEquation(eq, { m: "2", g: "9.8" });
  assert.equal(unit, "N");
  assert.ok(Math.abs(answer - 19.6) < 0.01);
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

test("inferBatchDemandLevel — rearrangement is not auto high_89", () => {
  const demand = inferBatchDemandLevel(
    { base: "substitute", rearrangement: true },
    { tier: "higher" },
    {}
  );
  assert.notEqual(demand, "high_89");
  assert.equal(demand, "standard_45");
});

test("markCalculationResponse smoke — generated substitute", () => {
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
