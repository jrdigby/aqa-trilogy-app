import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCommutativeGroups,
  substitutionSlotsMatchCommutative,
  rearrangementStructurallyMatches,
  isRearrangementInputReady
} from "../src/substitutionTemplate.js";
import { markCalculationResponse, buildSubstitutionFeedbackText, applyDefaultStepFeedbackToConfig } from "../src/calculationWorkflow.js";

const powerViTemplate = {
  layout: "product",
  tokens: [
    { kind: "slot", id: "P", label: "P" },
    { kind: "op", text: "=" },
    { kind: "slot", id: "I", label: "I" },
    { kind: "op", text: "×" },
    { kind: "slot", id: "V", label: "V" }
  ]
};

const shcTemplate = {
  layout: "product",
  tokens: [
    { kind: "slot", id: "delta_E", label: "ΔE" },
    { kind: "op", text: "=" },
    { kind: "slot", id: "m", label: "m" },
    { kind: "op", text: "×" },
    { kind: "slot", id: "c", label: "c" },
    { kind: "op", text: "×" },
    { kind: "slot", id: "delta_theta", label: "Δθ" }
  ]
};

test("parseCommutativeGroups identifies I×V group for P=I×V", () => {
  const { fixedSlots, commutativeGroups } = parseCommutativeGroups(powerViTemplate);
  assert.deepEqual(fixedSlots, ["P"]);
  assert.deepEqual(commutativeGroups, [["I", "V"]]);
});

test("commutative substitution accepts swapped I and V values", () => {
  const subStep = {
    slot_answers: { P: ["12"], I: ["I"], V: ["400"] }
  };
  const payload = {
    mode: "structured",
    equation_id: "power_vi",
    slots: { P: "12", I: "400", V: "I" }
  };
  assert.equal(substitutionSlotsMatchCommutative(payload, subStep, powerViTemplate), true);
});

test("commutative substitution accepts swapped I and V when I is rearrangement unknown", () => {
  const subStep = {
    rearrangement_subject: "I",
    slot_answers: { P: ["12"], I: ["I"], V: ["400"] }
  };
  const payload = {
    mode: "structured",
    equation_id: "power_vi",
    slots: { P: "12", I: "400", V: "I" }
  };
  assert.equal(substitutionSlotsMatchCommutative(payload, subStep, powerViTemplate), true);
});

test("commutative substitution accepts permuted m, c, delta_theta values", () => {
  const subStep = {
    slot_answers: { delta_E: ["500"], m: ["2"], c: ["450"], delta_theta: ["55"] }
  };
  const payload = {
    mode: "structured",
    equation_id: "specific_heat_capacity",
    slots: { delta_E: "500", m: "2", c: "450", delta_theta: "55" }
  };
  assert.equal(substitutionSlotsMatchCommutative(payload, subStep, shcTemplate), true);
  payload.slots = { delta_E: "500", m: "450", c: "2", delta_theta: "55" };
  assert.equal(substitutionSlotsMatchCommutative(payload, subStep, shcTemplate), true);
});

test("isRearrangementInputReady accepts variable symbol in non-unknown slots", () => {
  const equationSheet = {
    equations: [{
      id: "power_vi",
      substitution_template: powerViTemplate
    }]
  };
  const config = {
    steps: [
      { type: "substitution", required: true, mode: "structured", equation_id: "power_vi" },
      { type: "rearrangement", required: true, mode: "numeric", subject: "I" }
    ]
  };
  const subStep = { equation_id: "power_vi", rearrangement_subject: "I" };
  const slots = { P: "12", I: "400", V: "I" };
  const root = {
    querySelectorAll(sel) {
      if (sel !== ".calc-sub-slot") return [];
      return Object.entries(slots).map(([id, value]) => ({
        dataset: { slotId: id },
        value
      }));
    }
  };
  assert.equal(isRearrangementInputReady(config, equationSheet, subStep, root), true);
});

test("rearrangementStructurallyMatches ignores spacing", () => {
  assert.equal(
    rearrangementStructurallyMatches("I=12/400", "I = 12 / 400"),
    true
  );
  assert.equal(
    rearrangementStructurallyMatches("I = 400 / 12", "I = 12 / 400"),
    false
  );
});

test("wrong equation: no calculate mark even if answer matches", () => {
  const equationSheet = {
    equations: [
      {
        id: "power_vi",
        label: "Power",
        latex: "P = VI",
        substitution_template: powerViTemplate,
        rearrangement_forms: {
          default_subject: "I",
          variants: [{ subject: "I", correct: "I = P / V", distractor_patterns: [] }]
        }
      },
      {
        id: "energy_pt",
        label: "Energy",
        latex: "E = Pt"
      }
    ]
  };
  const q = {
    calculation_config: {
      equation_given: false,
      steps: [
        { type: "equation_select", required: true, answer: "power_vi", marks: 0 },
        { type: "substitution", required: true, mode: "structured", equation_id: "power_vi",
          slot_answers: { P: ["12"], I: ["I"], V: ["400"] }, marks: 1 },
        { type: "rearrangement", required: true, mode: "numeric", subject: "I", marks: 1 },
        { type: "calculate", required: true, marks: 1 }
      ]
    }
  };
  const resp = {
    steps: {
      equation_select: "energy_pt",
      substitution: { mode: "structured", equation_id: "energy_pt", slots: { P: "12" } },
      rearrangement: "I = 12 / 400",
      calculate: 0.03
    }
  };
  const key = { key_payload: { answer: 0.03, tolerance: 0.001 } };
  const result = markCalculationResponse(q, resp, key, [], null, equationSheet);
  assert.equal(result.stepResults.calculate.earned, 0);
  assert.equal(result.stepResults.calculate.correct, false);
  const texts = result.missing.map((m) => m.text);
  assert.ok(texts.some((t) => t.includes("correct equation")));
});

test("correct equation: rearrangement spacing variant marks correct", () => {
  const equationSheet = {
    equations: [{
      id: "power_vi",
      latex: "P = VI",
      substitution_template: powerViTemplate,
      rearrangement_forms: {
        default_subject: "I",
        variants: [{ subject: "I", correct: "I = P / V", distractor_patterns: [] }]
      }
    }]
  };
  const q = {
    calculation_config: {
      equation_given: false,
      steps: [
        { type: "equation_select", required: true, answer: "power_vi", marks: 0 },
        { type: "substitution", required: true, mode: "structured", equation_id: "power_vi",
          slot_answers: { P: ["12"], I: ["I"], V: ["400"] }, marks: 1 },
        { type: "rearrangement", required: true, mode: "numeric", subject: "I", marks: 1 },
        { type: "calculate", required: true, marks: 1 }
      ]
    }
  };
  const resp = {
    steps: {
      equation_select: "power_vi",
      substitution: { mode: "structured", equation_id: "power_vi", slots: { P: "12", I: "I", V: "400" } },
      rearrangement: "I=12/400",
      calculate: 0.03
    }
  };
  const key = { key_payload: { answer: 0.03, tolerance: 0.001 } };
  const result = markCalculationResponse(q, resp, key, [], null, equationSheet);
  assert.equal(result.stepResults.rearrangement.correct, true);
  assert.equal(result.stepResults.substitution.correct, true);
});

test("sig figs: exact calculate mark + separate sig figs mark", () => {
  const q = {
    max_marks: 2,
    calculation_config: {
      equation_given: true,
      steps: [
        { type: "substitution", required: true, mode: "structured", equation_id: "speed", marks: 1 },
        { type: "calculate", required: true, marks: 1 },
        { type: "sig_figs", required: true, sig_figs: 2, enforce_on_final: true, marks: 1 }
      ]
    }
  };
  const resp = { steps: { calculate: 27.15695 } };
  const key = {
    key_payload: {
      answer: 27.15695,
      exact_answer: 27.15695,
      tolerance: 0.01,
      unit: "m/s"
    }
  };
  const result = markCalculationResponse(q, resp, key, [], null, null);
  assert.equal(result.stepResults.calculate.earned, 1);
  assert.equal(result.stepResults.calculate.correct, true);
  assert.equal(result.stepResults.sig_figs.earned, 0);
  assert.equal(result.stepResults.sig_figs.correct, false);
  assert.ok(result.missing.some((m) => m.stepType === "sig_figs"));
  assert.ok(!result.missing.some((m) => m.stepType === "calculate"));
});

test("sig figs: 5 s.f. calculate answer loses sig figs mark when 2 s.f. required", () => {
  const q = {
    max_marks: 2,
    calculation_config: {
      equation_given: true,
      steps: [
        { type: "substitution", required: true, mode: "structured", equation_id: "speed", marks: 1 },
        { type: "calculate", required: true, marks: 1 },
        { type: "sig_figs", required: true, sig_figs: 2, enforce_on_final: true, marks: 1 }
      ]
    }
  };
  const resp = { steps: { calculate: 0.58554 } };
  const key = {
    key_payload: {
      answer: 0.5855400437691199,
      exact_answer: 0.5855400437691199,
      tolerance: 0.001,
      unit: "m/s"
    }
  };
  const result = markCalculationResponse(q, resp, key, [], null, null);
  assert.equal(result.stepResults.calculate.earned, 1);
  assert.equal(result.stepResults.calculate.correct, true);
  assert.equal(result.stepResults.sig_figs.earned, 0);
  assert.equal(result.stepResults.sig_figs.correct, false);
  assert.ok(result.missing.some((m) => m.stepType === "sig_figs"));
});

test("ECF: wrong unit conversion carries forward without losing later marks", async () => {
  const fs = await import("fs");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const sheetP1 = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "data", "equation_sheets", "physics_p1_ht.json"), "utf8")
  );
  const { generateBatch } = await import("../src/numericQuestionGenerator.js");
  const {
    buildSiSlotAnswersForRearrangement,
    buildNumericRearrangementOptions,
    findEquationInSheet
  } = await import("../src/substitutionTemplate.js");
  const { resolveConversionEcfState, resolveWorkflowDerivedAnswer } = await import(
    "../src/calculationWorkflow.js"
  );

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
  const draft = drafts[0];
  const cfg = draft.question.calculation_config;
  const convStep = cfg.steps.find((s) => s.type === "conversion");
  const subStep = cfg.steps.find((s) => s.type === "substitution");
  const rearrStep = cfg.steps.find((s) => s.type === "rearrangement");
  const convSlot = convStep.slot_id;
  const correctConv = convStep.answer;
  const wrongConv = correctConv / 1000;

  const slots = {};
  for (const [id, vals] of Object.entries(subStep.slot_answers || {})) {
    const v = Array.isArray(vals) ? vals[0] : vals;
    slots[id] = id === convSlot ? String(wrongConv) : String(v);
  }

  const eq = findEquationInSheet(sheetP1, subStep.equation_id);
  const conversionEcf = {
    ratio: wrongConv / correctConv,
    studentVal: wrongConv,
    target: correctConv,
    slotId: convSlot,
    tol: convStep.tolerance ?? 0.001
  };
  const siSlots = buildSiSlotAnswersForRearrangement(
    subStep,
    convStep,
    { steps: { conversion: wrongConv } },
    slots,
    conversionEcf
  );
  const built = buildNumericRearrangementOptions(eq, subStep, rearrStep, { siSlotAnswers: siSlots });
  const conversionEcfState = resolveConversionEcfState(cfg.steps, {
    steps: { conversion: wrongConv }
  });
  const ecfAnswer = resolveWorkflowDerivedAnswer(
    cfg,
    cfg.steps,
    { steps: { conversion: wrongConv, substitution: { mode: "structured", equation_id: subStep.equation_id, slots } } },
    sheetP1,
    conversionEcfState
  );
  assert.ok(Number.isFinite(ecfAnswer), "expected workflow-derived ECF answer");

  const resp = {
    steps: {
      conversion: wrongConv,
      substitution: {
        mode: "structured",
        equation_id: subStep.equation_id,
        slots
      },
      rearrangement: built.answer,
      calculate: ecfAnswer
    }
  };

  assert.ok(resolveConversionEcfState(cfg.steps, resp), "expected conversion ECF state");

  const result = markCalculationResponse(
    draft.question,
    resp,
    draft.answer_key,
    [],
    null,
    sheetP1
  );

  assert.equal(result.stepResults.conversion.correct, false);
  assert.equal(result.stepResults.conversion.earned, 0);
  assert.equal(result.stepResults.substitution.correct, true);
  assert.equal(result.stepResults.substitution.ecf, true);
  assert.equal(result.stepResults.rearrangement.correct, true);
  assert.equal(result.stepResults.rearrangement.ecf, true);
  assert.equal(result.stepResults.calculate.correct, true);
  assert.equal(result.stepResults.calculate.ecf, true);
  assert.ok(result.missing.some((m) => m.isEcf));
  assert.ok(result.total > result.stepResults.conversion.max);
});

test("ECF: spring constant k re-evaluates with e² not linear ratio", async () => {
  const fs = await import("fs");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const sheetP1 = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "data", "equation_sheets", "physics_p1_ht.json"), "utf8")
  );
  const {
    buildSiSlotAnswersForRearrangement,
    buildNumericRearrangementOptions,
    findEquationInSheet
  } = await import("../src/substitutionTemplate.js");
  const { markCalculationResponse, resolveWorkflowDerivedAnswer } = await import(
    "../src/calculationWorkflow.js"
  );

  const cfg = {
    equation_given: true,
    steps: [
      {
        type: "conversion",
        required: true,
        answer: 0.09,
        tolerance: 0.001,
        slot_id: "e",
        marks: 1
      },
      {
        type: "substitution",
        required: true,
        mode: "structured",
        equation_id: "elastic_potential_energy",
        slot_answers: { E_e: ["285"], e: ["0.09"] },
        rearrangement_subject: "k",
        marks: 1
      },
      { type: "rearrangement", required: true, mode: "numeric", subject: "k", marks: 1 },
      { type: "calculate", required: true, marks: 1 },
      { type: "sig_figs", required: true, sig_figs: 2, enforce_on_final: true, marks: 1 }
    ]
  };

  const wrongConv = 0.9;
  const slots = { E_e: "285", e: "0.9" };
  const convStep = cfg.steps[0];
  const subStep = cfg.steps[1];
  const rearrStep = cfg.steps[2];
  const eq = findEquationInSheet(sheetP1, "elastic_potential_energy");
  const conversionEcf = {
    ratio: wrongConv / 0.09,
    studentVal: wrongConv,
    target: 0.09,
    slotId: "e",
    tol: 0.001
  };
  const siSlots = buildSiSlotAnswersForRearrangement(
    subStep,
    convStep,
    { steps: { conversion: wrongConv } },
    slots,
    conversionEcf
  );
  const built = buildNumericRearrangementOptions(eq, subStep, rearrStep, { siSlotAnswers: siSlots });
  const ecfK = (2 * 285) / (0.9 * 0.9);

  const resp = {
    steps: {
      conversion: wrongConv,
      substitution: {
        mode: "structured",
        equation_id: "elastic_potential_energy",
        slots
      },
      rearrangement: built.answer,
      calculate: ecfK
    }
  };

  const workflowAnswer = resolveWorkflowDerivedAnswer(cfg, cfg.steps, resp, sheetP1, conversionEcf);
  assert.ok(Math.abs(workflowAnswer - ecfK) < 0.01, `expected ~${ecfK}, got ${workflowAnswer}`);

  const markSchemeK = (2 * 285) / (0.09 * 0.09);
  const key = {
    key_payload: {
      answer: markSchemeK,
      exact_answer: markSchemeK,
      tolerance: 50,
      unit: "N/m"
    }
  };

  const result = markCalculationResponse(
    { calculation_config: cfg, max_marks: 5 },
    resp,
    key,
    [],
    null,
    sheetP1
  );
  assert.equal(result.stepResults.calculate.correct, true);
  assert.equal(result.stepResults.calculate.ecf, true);

  const failResult = markCalculationResponse(
    { calculation_config: cfg, max_marks: 5 },
    { ...resp, steps: { ...resp.steps, calculate: 0 } },
    key,
    [],
    null,
    sheetP1
  );
  const calcFb = failResult.missing.find((m) => m.stepType === "calculate");
  assert.ok(calcFb?.text.includes("703"), `feedback should show ECF target: ${calcFb?.text}`);
  assert.ok(calcFb?.text.includes("substituted values"));
});

test("buildSubstitutionFeedbackText uses actual slot values", () => {
  const equation = {
    id: "kinetic_energy",
    substitution_template: {
      layout: "product",
      tokens: [
        { kind: "slot", id: "E_k" },
        { kind: "op", text: "=" },
        { kind: "slot", id: "m" },
        { kind: "op", text: "×" },
        { kind: "slot", id: "v", label: "v" },
        { kind: "op", text: "²" }
      ]
    }
  };
  const subStep = {
    slot_answers: { m: ["100"], v: ["20"], E_k: ["E_k"] }
  };
  const text = buildSubstitutionFeedbackText(subStep, equation);
  assert.equal(text, "Substitute m=100kg and v=20m/s");
  assert.ok(!text.toLowerCase().includes("incorrect"));
});

test("applyDefaultStepFeedbackToConfig drops incorrect from step feedback", () => {
  const config = {
    equation_given: true,
    steps: [
      {
        type: "conversion",
        required: true,
        label: "Convert 9 cm to m",
        answer: 0.09
      },
      {
        type: "calculate",
        required: true
      }
    ]
  };
  const enriched = applyDefaultStepFeedbackToConfig(config, {
    answer: 16,
    unit: "J"
  }, { overwrite: true });
  const conv = enriched.steps.find((s) => s.type === "conversion");
  const calc = enriched.steps.find((s) => s.type === "calculate");
  assert.equal(conv.feedback_if_wrong, "Unit conversion: expected 0.09 (Convert 9 cm to m).");
  assert.equal(calc.feedback_if_wrong, "Final calculation: expected 16 J.");
  assert.ok(!conv.feedback_if_wrong.includes("incorrect"));
  assert.ok(!calc.feedback_if_wrong.includes("incorrect"));
});
