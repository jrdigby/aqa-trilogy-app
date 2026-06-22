import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCommutativeGroups,
  substitutionSlotsMatchCommutative,
  rearrangementStructurallyMatches
} from "../src/substitutionTemplate.js";
import { markCalculationResponse } from "../src/calculationWorkflow.js";

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
  assert.ok(texts.some((t) => t.includes("incorrect equation")));
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
