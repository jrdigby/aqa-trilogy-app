/**
 * Unit tests for chemistry quantitative batch generator and marking.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateChemBatch,
  generateRfmPair,
  generatePercentByMassDraft,
  generateConcentrationFindCDraft,
  generateConcentrationFindMDraft,
  concentrationFindCNearMisses,
  listCompounds,
  listBalanceEquations
} from "../src/chemistryQuantitativeGenerator.js";
import {
  markPercentByMassResponse,
  markMultiPathCalculationResponse,
  getCalculationConfig,
  getActiveSteps
} from "../src/calculationWorkflow.js";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("generateChemBatch RFM", () => {
  it("creates mcq + short_text pairs", () => {
    const { drafts, errors } = generateChemBatch({ scenario: "rfm", count: 2, seed: 42 });
    assert.equal(errors.length, 0);
    assert.equal(drafts.length, 4);
    assert.equal(drafts[0].question.question_type, "mcq");
    assert.equal(drafts[1].question.question_type, "short_text");
    assert.equal(drafts[0].question.demand_level, "low");
    assert.ok(drafts[0].question.options.length === 4);
    assert.match(drafts[0].mark_points[0].feedback_if_missing, /Calculate Mr|×/);
    assert.equal(Object.keys(drafts[0].answer_key.key_payload.option_feedback || {}).length, 0);
  });
});

describe("generateChemBatch conservation", () => {
  it("creates mcq + short_text pairs with new stem wording", () => {
    const { drafts, errors } = generateChemBatch({
      scenario: "conservation",
      count: 2,
      seed: 7,
      equation_form: "symbol"
    });
    assert.equal(errors.length, 0);
    assert.equal(drafts.length, 4);
    assert.match(drafts[0].question.prompt, /What mass of .+ (reacted|was produced)\?/);
    assert.match(drafts[0].question.prompt, /reacted with|produced/);
    assert.match(drafts[0].question.prompt, /\$\\ce\{/);
  });
});

describe("percent by mass ECF", () => {
  it("awards 2/3 when element mass wrong but ratio and % follow ECF", () => {
    const compound = listCompounds().find((c) => c.formula === "NH4NO3");
    const draft = generatePercentByMassDraft(compound, { focus_element: "O", seed: 1 }, mulberry32(1));
    const q = draft.question;
    const key = draft.answer_key;
    const config = getCalculationConfig(q);

    // Wrong: O=16 instead of 48; then 16/80 → 20%
    const resp = {
      steps: {
        element_mass: 16,
        mass_ratio: { numerator: 16, denominator: 80 },
        calculate: 20
      }
    };
    const result = markPercentByMassResponse(q, resp, key, [], null, config);
    assert.equal(result.max, 3);
    assert.equal(result.total, 2);
    assert.equal(result.stepResults.element_mass.earned, 0);
    assert.equal(result.stepResults.mass_ratio.earned, 1);
    assert.equal(result.stepResults.calculate.earned, 1);
  });

  it("awards 3/3 for correct working", () => {
    const compound = listCompounds().find((c) => c.formula === "NH4NO3");
    const draft = generatePercentByMassDraft(compound, { focus_element: "O", seed: 1 }, mulberry32(1));
    const q = draft.question;
    const key = draft.answer_key;
    const config = getCalculationConfig(q);
    const resp = {
      steps: {
        element_mass: 48,
        mass_ratio: { numerator: 48, denominator: 80 },
        calculate: 60
      }
    };
    const result = markPercentByMassResponse(q, resp, key, [], null, config);
    assert.equal(result.total, 3);
  });
});

describe("concentration multi-path marking", () => {
  it("correct answer alone scores 3/3", () => {
    const draft = generateConcentrationFindCDraft({ seed: 99 }, mulberry32(99));
    const q = draft.question;
    const key = draft.answer_key;
    const config = q.calculation_config;
    const c = key.key_payload.answer;
    const result = markMultiPathCalculationResponse(
      q,
      { steps: { calculate: c }, value: c },
      key,
      [],
      null,
      config
    );
    assert.equal(result.total, 3);
    assert.equal(result.max, 3);
  });

  it("exposes working_1 and working_2 steps for student input", () => {
    const draft = generateConcentrationFindCDraft({ seed: 99 }, mulberry32(99));
    const config = getCalculationConfig(draft.question);
    const steps = getActiveSteps(config);
    assert.deepEqual(steps.map((s) => s.type), ["working_1", "working_2", "calculate"]);
    assert.deepEqual(steps.map((s) => s.marks), [1, 1, 1]);
    assert.equal(steps[0].label, "Convert volume to dm³");
    assert.equal(steps[1].label, "Calculate concentration");
    assert.ok(Array.isArray(draft.question.hints) && draft.question.hints.length >= 2);
    assert.match(draft.question.hints[0], /cm³ ÷ 1000/);
  });

  it("accepts scaffolded working expressions such as 12.8/0.2", () => {
    const draft = generateConcentrationFindCDraft({ seed: 11 }, mulberry32(11));
    const q = draft.question;
    const key = draft.answer_key;
    const config = getCalculationConfig(q);
    const Vcm3 = draft.variant.Vcm3;
    const m = draft.variant.m;
    const c = draft.variant.c;
    const Vdm3 = Vcm3 / 1000;
    const result = markMultiPathCalculationResponse(
      q,
      {
        steps: {
          working_1: Vdm3,
          working_2: null,
          calculate: c
        },
        stepRaw: {
          working_1: String(Vcm3 / 1000),
          working_2: `${m}/${Vdm3}`,
          calculate: String(c)
        }
      },
      key,
      [],
      null,
      config
    );
    assert.equal(result.total, 3);
    assert.equal(result.stepResults.working_1.earned, 1);
    assert.equal(result.stepResults.working_2.earned, 1);
    assert.equal(result.stepResults.calculate.max, 1);
  });

  it("accepts x and leading-dot decimals in mass working (e.g. 3.2x.05)", () => {
    const draft = generateConcentrationFindMDraft({ seed: 21 }, mulberry32(21));
    const config = getCalculationConfig(draft.question);
    const forced = markMultiPathCalculationResponse(
      draft.question,
      {
        steps: { working_1: 0.05, working_2: null, calculate: 0.16 },
        stepRaw: { working_1: ".05", working_2: "3.2x.05", calculate: "0.16" }
      },
      { key_type: "numeric", key_payload: { answer: 0.16, tolerance: 0.05, unit: "g" } },
      [],
      null,
      {
        ...config,
        answer: 0.16,
        answer_bands: [
          { marks: 3, accept: [{ value: 0.16 }] },
          { marks: 2, accept: [] }
        ],
        paths: [
          {
            id: "convert_volume",
            steps: [
              { id: "s1", marks: 1, accept: [{ value: 0.05 }] },
              { id: "s2", marks: 1, accept: [{ value: 0.16 }, { op: "mul", values: [3.2, 0.05] }] },
              { id: "s3", marks: 1, accept: [{ value: 0.16 }] }
            ]
          }
        ]
      }
    );
    assert.equal(forced.stepResults.working_1.earned, 1);
    assert.equal(forced.stepResults.working_2.earned, 1);
    assert.equal(forced.total, 3);
  });

  it("near-miss answer alone scores 2/3", () => {
    const m = 3.2;
    const Vcm3 = 50;
    const near = concentrationFindCNearMisses(m, Vcm3);
    assert.ok(near.includes(0.064) || near.some((v) => Math.abs(v - 0.064) < 1e-9));

    const draft = generateConcentrationFindCDraft({ seed: 3 }, mulberry32(3));
    // Force known values by rebuilding config style question
    const q = {
      question_type: "numeric",
      max_marks: 3,
      calculation_config: {
        marking_mode: "multi_path",
        max_marks: 3,
        unit: "g/dm³",
        answer: 64,
        answer_bands: [
          { marks: 3, accept: [{ value: 64 }] },
          { marks: 2, accept: near.map((v) => ({ value: v })) }
        ],
        paths: [],
        steps: [
          { type: "working_1", marks: 0, required: false },
          { type: "working_2", marks: 0, required: false },
          { type: "calculate", marks: 3, required: true }
        ]
      }
    };
    const key = { key_type: "numeric", key_payload: { answer: 64, tolerance: 0.05, unit: "g/dm³" } };
    const result = markMultiPathCalculationResponse(
      q,
      { steps: { calculate: 0.064 }, value: 0.064 },
      key,
      [],
      null,
      q.calculation_config
    );
    assert.equal(result.total, 2);
  });

  it("find-m generates mass answer with multi_path config", () => {
    const draft = generateConcentrationFindMDraft({ seed: 11 }, mulberry32(11));
    assert.equal(draft.question.calculation_config.marking_mode, "multi_path");
    assert.equal(draft.answer_key.key_payload.unit, "g");
    assert.ok(draft.question.calculation_config.paths.length >= 2);
  });
});

describe("balance batch", () => {
  it("emits chemistry_interactive balance drafts with mhchem equation in prompt", () => {
    const { drafts, errors } = generateChemBatch({ scenario: "balance", count: 3, seed: 5 });
    assert.equal(errors.length, 0);
    assert.equal(drafts.length, 3);
    assert.equal(drafts[0].question.question_type, "chemistry_interactive");
    assert.equal(drafts[0].question.chemistry_config.kind, "balance_equation");
    assert.match(drafts[0].question.prompt, /Balance the following equation/);
    assert.match(drafts[0].question.prompt, /\$\\ce\{/);
    assert.ok(listBalanceEquations().length >= 5);
  });
});

describe("RFM pair from compound", () => {
  it("shares the same prompt across mcq and short_text and uses mhchem", () => {
    const compound = listCompounds()[0];
    const [mcq, shortText] = generateRfmPair(compound, { seed: 1 }, mulberry32(1));
    assert.equal(mcq.question.prompt, shortText.question.prompt);
    assert.match(mcq.question.prompt, /\$\\ce\{/);
  });
});
