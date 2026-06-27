import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCommutativeGroups,
  substitutionSlotsMatchCommutative,
  rearrangementStructurallyMatches,
  isRearrangementInputReady,
  resolveSymbolSlotIds
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

const kineticEnergyTemplate = {
  layout: "sum_product",
  tokens: [
    { kind: "slot", id: "E_k", label: "E_k" },
    { kind: "op", text: "=" },
    { kind: "op", text: "½" },
    { kind: "op", text: "×" },
    { kind: "slot", id: "m", label: "m" },
    { kind: "op", text: "×" },
    { kind: "slot", id: "v", label: "v" },
    { kind: "op", text: "²" }
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

test("separate answer boxes: 605 in calculate and 610 in sig figs both score", () => {
  const q = {
    max_marks: 2,
    calculation_config: {
      equation_given: true,
      steps: [
        { type: "calculate", required: true, marks: 1 },
        { type: "sig_figs", required: true, sig_figs: 2, enforce_on_final: true, marks: 1 }
      ]
    }
  };
  const resp = { steps: { calculate: 605, sig_figs: 610 } };
  const key = {
    key_payload: {
      answer: 605,
      exact_answer: 605,
      tolerance: 0.001,
      unit: "J"
    }
  };
  const result = markCalculationResponse(q, resp, key, [], null, null);
  assert.equal(result.stepResults.calculate.correct, true);
  assert.equal(result.stepResults.calculate.earned, 1);
  assert.equal(result.stepResults.sig_figs.correct, true);
  assert.equal(result.stepResults.sig_figs.earned, 1);
  assert.equal(result.total, 2);
});

test("separate answer boxes: 610 only in calculate loses calculation mark", () => {
  const q = {
    calculation_config: {
      equation_given: true,
      steps: [
        { type: "calculate", required: true, marks: 1 },
        { type: "sig_figs", required: true, sig_figs: 2, enforce_on_final: true, marks: 1 }
      ]
    }
  };
  const resp = { steps: { calculate: 610, sig_figs: 610 } };
  const key = {
    key_payload: { answer: 605, exact_answer: 605, tolerance: 0.001, unit: "J" }
  };
  const result = markCalculationResponse(q, resp, key, [], null, null);
  assert.equal(result.stepResults.calculate.correct, false);
  assert.equal(result.stepResults.sig_figs.correct, true);
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

test("buildSubstitutionFeedbackText shows full equation with symbol slot from blank mark scheme", () => {
  const equation = {
    id: "kinetic_energy",
    substitution_template: kineticEnergyTemplate
  };
  const subStep = {
    slot_answers: { m: ["100"], v: ["20"] }
  };
  const text = buildSubstitutionFeedbackText(subStep, equation);
  assert.equal(text, "Substitute E_k = ½ × 100 × 20²");
  assert.ok(!text.toLowerCase().includes("incorrect"));
});

test("resolveSymbolSlotIds uses blank expected values from mark scheme", () => {
  const subStep = { slot_answers: { m: ["500"], v: ["15"] } };
  const ids = resolveSymbolSlotIds(kineticEnergyTemplate, subStep);
  assert.ok(ids.has("E_k"));
  assert.ok(!ids.has("m"));
  assert.ok(!ids.has("v"));
});

test("stale rearrangement_subject ignored when rearrangement step is inactive", () => {
  const config = {
    steps: [
      { type: "substitution", required: true },
      { type: "calculate", required: true }
    ]
  };
  const subStep = { rearrangement_subject: "v" };
  const ids = resolveSymbolSlotIds(kineticEnergyTemplate, subStep, config);
  assert.ok(ids.has("E_k"));
  assert.ok(!ids.has("v"));
});

test("symbol slot accepts variable name when mark scheme leaves result slot blank", () => {
  const subStep = { slot_answers: { m: ["20"], v: ["4"] } };
  const payload = {
    mode: "structured",
    equation_id: "kinetic_energy",
    slots: { E_k: "E_k", m: "20", v: "4" }
  };
  assert.equal(substitutionSlotsMatchCommutative(payload, subStep, kineticEnergyTemplate), true);
});

test("kinetic energy substitution accepts E_k symbol with m and v filled", () => {
  const sheet = {
    equations: [{ id: "kinetic_energy", substitution_template: kineticEnergyTemplate }]
  };
  const q = {
    question_type: "numeric",
    max_marks: 2,
    calculation_config: {
      equation_given: true,
      steps: [
        {
          type: "substitution",
          required: true,
          mode: "structured",
          equation_id: "kinetic_energy",
          slot_answers: { m: ["20"], v: ["4"] },
          marks: 1
        },
        { type: "calculate", required: true, marks: 1 }
      ]
    }
  };
  const resp = {
    steps: {
      substitution: {
        mode: "structured",
        equation_id: "kinetic_energy",
        slots: { E_k: "E_k", m: "20", v: "4" }
      },
      calculate: 160
    }
  };
  const key = {
    key_type: "numeric",
    key_payload: { answer: 160, exact_answer: 160, tolerance: 0.001, unit: "J" }
  };

  const result = markCalculationResponse(q, resp, key, [], null, sheet);
  assert.equal(result.stepResults.substitution.correct, true);
  assert.equal(result.total, 2);
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

test("buildSubstitutionFeedbackText uses SI value after unit conversion", () => {
  const equation = {
    id: "kinetic_energy",
    substitution_template: kineticEnergyTemplate
  };
  const subStep = {
    slot_answers: { m: ["10000"], v: ["4"] },
    si_slot_answers: { m: ["10"], v: ["4"] }
  };
  const convStep = {
    slot_id: "m",
    answer: 10,
    to_unit: "kg",
    from_unit: "g",
    display_value: 10000
  };
  const text = buildSubstitutionFeedbackText(subStep, equation, { convStep });
  assert.equal(text, "Substitute E_k = ½ × 10 × 4²");
  assert.ok(!text.includes("10000"));
});

test("conversion then substitution — SI value after correct conversion is accepted", async () => {
  const fs = await import("fs");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const sheetP1 = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "data", "equation_sheets", "physics_p1_ht.json"), "utf8")
  );
  const { generateBatch } = await import("../src/numericQuestionGenerator.js");

  let draft = null;
  for (let seed = 0; seed < 80; seed++) {
    const { drafts } = generateBatch(
      {
        equation: "weight",
        sheet: "physics_p1_ht",
        variants: { recipes: [{ base: "substitute", unitConversion: true, count: 1 }] },
        seed
      },
      sheetP1
    );
    const cfg = drafts[0].question.calculation_config;
    if (cfg.steps.some((s) => s.type === "conversion" && s.slot_id === "m")) {
      draft = drafts[0];
      break;
    }
  }
  assert.ok(draft, "expected a weight question with mass unit conversion");

  const cfg = draft.question.calculation_config;
  const convStep = cfg.steps.find((s) => s.type === "conversion");
  const subStep = cfg.steps.find((s) => s.type === "substitution");
  const convSlot = convStep.slot_id;
  const siVal = subStep.si_slot_answers?.[convSlot]?.[0] ?? subStep.slot_answers[convSlot][0];

  const slots = {};
  for (const [id, vals] of Object.entries(subStep.slot_answers)) {
    const v = Array.isArray(vals) ? vals[0] : vals;
    slots[id] = id === convSlot ? String(siVal) : String(v);
  }

  const resp = {
    steps: {
      conversion: parseFloat(convStep.answer),
      substitution: {
        mode: "structured",
        equation_id: subStep.equation_id,
        slots
      },
      calculate: draft.answer_key.key_payload.answer
    }
  };

  const result = markCalculationResponse(
    draft.question,
    resp,
    draft.answer_key,
    [],
    null,
    sheetP1
  );

  assert.equal(result.stepResults.conversion.correct, true);
  assert.equal(result.stepResults.substitution.correct, true);
  assert.equal(result.stepResults.substitution.ecf, false);
});

test("stale baked substitution feedback is ignored when conversion step exists", () => {
  const equation = {
    id: "kinetic_energy",
    substitution_template: {
      layout: "sum_product",
      tokens: [
        { kind: "slot", id: "E_k", label: "E_k" },
        { kind: "op", text: "=" },
        { kind: "op", text: "½" },
        { kind: "op", text: "×" },
        { kind: "slot", id: "m", label: "m" },
        { kind: "op", text: "×" },
        { kind: "slot", id: "v", label: "v" },
        { kind: "op", text: "²" }
      ]
    }
  };
  const config = {
    equation_given: true,
    steps: [
      {
        type: "conversion",
        required: true,
        marks: 1,
        slot_id: "m",
        answer: 10,
        display_value: 10000,
        from_unit: "g",
        to_unit: "kg"
      },
      {
        type: "substitution",
        required: true,
        marks: 1,
        mode: "structured",
        equation_id: "kinetic_energy",
        feedback_if_wrong: "Substitute m=10000g and v=11m/s",
        slot_answers: { m: ["10000"], v: ["11"] },
        si_slot_answers: { m: ["10"], v: ["11"] }
      },
      { type: "calculate", required: true, marks: 1 }
    ]
  };
  const subStep = config.steps[1];
  const live = buildSubstitutionFeedbackText(subStep, equation, { convStep: config.steps[0] });
  assert.equal(live, "Substitute E_k = ½ × 10 × 11²");

  const q = {
    question_type: "numeric",
    calculation_config: config
  };
  const resp = {
    steps: {
      conversion: 10,
      substitution: {
        mode: "structured",
        equation_id: "kinetic_energy",
        slots: { m: "10", v: "11", E_k: "" }
      },
      calculate: 605
    }
  };
  const key = {
    key_type: "numeric",
    key_payload: { answer: 605, exact_answer: 605, tolerance: 0.001, unit: "J" }
  };
  const result = markCalculationResponse(q, resp, key, [], null, { equations: [equation] });
  assert.equal(result.stepResults.substitution.correct, true, "SI mass after conversion should score");
  const subMissing = result.missing.find((m) => m.stepType === "substitution");
  assert.equal(subMissing, undefined);
});

test("substitution with stem value after conversion — conversion hint precedes substitution feedback", async () => {
  const fs = await import("fs");
  const path = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const sheetP1 = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "data", "equation_sheets", "physics_p1_ht.json"), "utf8")
  );
  const { generateBatch } = await import("../src/numericQuestionGenerator.js");

  const { drafts } = generateBatch(
    {
      equation: "weight",
      sheet: "physics_p1_ht",
      variants: { recipes: [{ base: "substitute", unitConversion: true, count: 1 }] },
      seed: 12
    },
    sheetP1
  );
  const draft = drafts[0];
  const cfg = draft.question.calculation_config;
  const convStep = cfg.steps.find((s) => s.type === "conversion");
  const subStep = cfg.steps.find((s) => s.type === "substitution");
  if (convStep.slot_id !== "m") return;

  const slots = {};
  for (const [id, vals] of Object.entries(subStep.slot_answers)) {
    const v = Array.isArray(vals) ? vals[0] : vals;
    slots[id] = id === convStep.slot_id ? String(convStep.display_value) : String(v);
  }

  const resp = {
    steps: {
      conversion: parseFloat(convStep.answer),
      substitution: {
        mode: "structured",
        equation_id: subStep.equation_id,
        slots
      },
      calculate: 0
    }
  };

  const result = markCalculationResponse(
    draft.question,
    resp,
    draft.answer_key,
    [],
    null,
    sheetP1
  );

  assert.equal(result.stepResults.substitution.correct, false);
  const convIdx = result.missing.findIndex((m) => m.stepType === "conversion" && !m.isEcf);
  const subIdx = result.missing.findIndex((m) => m.stepType === "substitution");
  assert.ok(convIdx >= 0 && subIdx >= 0 && convIdx < subIdx);
  assert.ok(result.missing[convIdx].text.includes(String(convStep.answer)));
});

test("wrong equation + empty response — conversion feedback appears only once", () => {
  const equation = {
    id: "kinetic_energy",
    label: "Kinetic energy",
    substitution_template: {
      layout: "sum_product",
      tokens: [
        { kind: "slot", id: "E_k" },
        { kind: "op", text: "=" },
        { kind: "op", text: "½" },
        { kind: "op", text: "×" },
        { kind: "slot", id: "m" },
        { kind: "op", text: "×" },
        { kind: "slot", id: "v" },
        { kind: "op", text: "²" }
      ]
    }
  };
  const sheet = { equations: [equation] };
  const q = {
    question_type: "numeric",
    calculation_config: {
      equation_given: false,
      steps: [
        { type: "equation_select", required: true, marks: 0, answer: "kinetic_energy" },
        {
          type: "conversion",
          required: true,
          marks: 1,
          label: "Convert 10000 g to kg",
          answer: 10,
          tolerance: 0.001,
          slot_id: "m"
        },
        {
          type: "substitution",
          required: true,
          marks: 1,
          mode: "structured",
          equation_id: "kinetic_energy",
          slot_answers: { m: ["10"], v: ["11"] }
        },
        { type: "calculate", required: true, marks: 1 }
      ]
    }
  };
  const resp = {
    steps: {
      equation_select: "gravitational_potential",
      substitution: { mode: "structured", equation_id: "gravitational_potential", slots: {} }
    }
  };
  const key = {
    key_type: "numeric",
    key_payload: { answer: 605, exact_answer: 605, tolerance: 0.001, unit: "J" }
  };

  const result = markCalculationResponse(q, resp, key, [], null, sheet);
  const convMissing = result.missing.filter(
    (m) => m.stepType === "conversion" && !m.isEcf
  );
  assert.equal(convMissing.length, 1, `expected one conversion line, got ${convMissing.length}`);
});

test("wrong equation but correct unit conversion still earns the conversion mark", () => {
  const equation = {
    id: "kinetic_energy",
    substitution_template: {
      layout: "sum_product",
      tokens: [
        { kind: "slot", id: "E_k" },
        { kind: "op", text: "=" },
        { kind: "op", text: "½" },
        { kind: "op", text: "×" },
        { kind: "slot", id: "m" },
        { kind: "op", text: "×" },
        { kind: "slot", id: "v" },
        { kind: "op", text: "²" }
      ]
    }
  };
  const sheet = { equations: [equation] };
  const q = {
    question_type: "numeric",
    calculation_config: {
      equation_given: false,
      steps: [
        { type: "equation_select", required: true, marks: 0, answer: "kinetic_energy" },
        {
          type: "conversion",
          required: true,
          marks: 1,
          label: "Convert 10000 g to kg",
          answer: 10,
          tolerance: 0.001,
          slot_id: "m"
        },
        {
          type: "substitution",
          required: true,
          marks: 1,
          mode: "structured",
          equation_id: "kinetic_energy",
          slot_answers: { m: ["10"], v: ["11"] }
        },
        { type: "calculate", required: true, marks: 1 }
      ]
    }
  };
  const resp = {
    steps: {
      equation_select: "weight",
      conversion: 10
    }
  };
  const key = {
    key_type: "numeric",
    key_payload: { answer: 605, exact_answer: 605, tolerance: 0.001, unit: "J" }
  };

  const result = markCalculationResponse(q, resp, key, [], null, sheet);
  assert.equal(result.stepResults.conversion.correct, true);
  assert.equal(result.stepResults.conversion.earned, 1);
  assert.equal(result.total, 1);
  assert.ok(
    !result.missing.some((m) => m.stepType === "conversion" && !m.isEcf),
    "correct conversion should not appear in missing feedback"
  );
});
