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
  generateMolesFindNDraft,
  generateMolesFindMDraft,
  generateAvogadroFindParticlesDraft,
  generateAvogadroFindMolesDraft,
  generateReactingMassesDraft,
  generateBalanceFromMassesDraft,
  generateLimitingIdentifyDraft,
  concentrationFindCNearMisses,
  listCompounds,
  listBalanceEquations,
  listStoichReactions,
  selectUniqueCompounds,
  selectUniqueBalanceEquations,
  balanceEquationSignature,
  extractBalanceSignatureFromPrompt,
  extractFormulaFromChemPrompt,
  formulasFromPrompts
} from "../src/chemistryQuantitativeGenerator.js";
import { relativeFormulaMass } from "../src/chemistryFormula.js";
import {
  markPercentByMassResponse,
  markMultiPathCalculationResponse,
  markMolesMassResponse,
  markBalanceFromMassesResponse,
  markLimitingReactantResponse,
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
    assert.equal(drafts[1].question.demand_level, "standard");
    assert.deepEqual(drafts[0].skill_codes, { ms: ["MS1a"], ws: ["WS4.3"] });
    assert.deepEqual(drafts[1].skill_codes, { ms: ["MS1a"], ws: ["WS4.3"] });
    assert.ok(drafts[0].question.options.length === 4);
    assert.match(drafts[0].mark_points[0].feedback_if_missing, /Calculate Mr|×/);
    assert.equal(Object.keys(drafts[0].answer_key.key_payload.option_feedback || {}).length, 0);
  });

  it("never repeats a compound within one run", () => {
    const { drafts, errors } = generateChemBatch({ scenario: "rfm", count: 20, seed: 99 });
    assert.equal(errors.length, 0);
    assert.equal(drafts.length, 40);
    const formulas = drafts
      .filter((d) => d.variant?.format === "mcq")
      .map((d) => d.variant.formula);
    assert.equal(formulas.length, 20);
    assert.equal(new Set(formulas).size, 20);
  });

  it("skips formulas listed in excludeFormulas", () => {
    const first = listCompounds()[0].formula;
    const { drafts, errors } = generateChemBatch({
      scenario: "rfm",
      count: 3,
      seed: 3,
      excludeFormulas: [first]
    });
    assert.equal(errors.length, 0);
    for (const d of drafts) {
      assert.notEqual(d.variant.formula, first);
    }
  });
});

describe("compound bank and unique selection", () => {
  it("has a broad GCSE bank with parseable formulas", () => {
    const compounds = listCompounds();
    assert.ok(compounds.length >= 50);
    for (const c of compounds) {
      assert.ok(relativeFormulaMass(c.formula) > 0);
    }
  });

  it("selectUniqueCompounds never repeats and respects excludes", () => {
    const rng = mulberry32(11);
    const { selected, shortfall } = selectUniqueCompounds(
      listCompounds(),
      10,
      rng,
      [listCompounds()[0].formula]
    );
    assert.equal(shortfall, 0);
    assert.equal(selected.length, 10);
    assert.equal(new Set(selected.map((c) => c.formula)).size, 10);
    assert.ok(!selected.some((c) => c.formula === listCompounds()[0].formula));
  });

  it("extracts formulas from RFM prompts", () => {
    assert.equal(
      extractFormulaFromChemPrompt(
        "Calculate the relative formula mass (Mr) of water, $\\ce{H2O}$.\n\nRelative atomic masses: H = 1"
      ),
      "H2O"
    );
    assert.deepEqual(
      formulasFromPrompts([
        "Calculate the relative formula mass (Mr) of methane, $\\ce{CH4}$.",
        "Calculate the relative formula mass (Mr) of ethane, $\\ce{C2H6}$."
      ]),
      ["CH4", "C2H6"]
    );
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
    assert.equal(drafts[0].question.demand_level, "low");
    assert.equal(drafts[1].question.demand_level, "standard");
    assert.deepEqual(drafts[0].skill_codes, { ms: ["MS1a"], ws: ["WS4.3"] });
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
    assert.equal(draft.question.demand_level, "standard_45");
    assert.deepEqual(draft.skill_codes.ms, ["MS1a", "MS1c", "MS3c", "MS3b"]);
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
    assert.match(drafts[0].question.prompt, /Balance|half-equation|ionic equation/i);
    if (drafts[0].question.chemistry_config.template.subtype !== "half") {
      assert.match(drafts[0].question.prompt, /\$\\ce\{/);
    }
    assert.ok(drafts[0].variant.signature);
  });

  it("covers a broad GCSE equation bank with unique signatures", () => {
    const eqs = listBalanceEquations();
    assert.ok(eqs.length >= 50);
    const cats = new Set(eqs.map((e) => e.category));
    for (const need of [
      "combustion",
      "decomposition",
      "metal_oxygen",
      "displacement",
      "metal_water",
      "redox",
      "acid_metal",
      "neutralisation_hydroxide",
      "neutralisation_oxide",
      "neutralisation_carbonate",
      "electrolysis_half",
      "ionic_displacement"
    ]) {
      assert.ok(cats.has(need), `missing category ${need}`);
    }
    const sigs = eqs.map((e) => balanceEquationSignature(e));
    assert.equal(new Set(sigs).size, sigs.length);
  });

  it("marks ionic and half equations as HT-only with WS4.3", () => {
    const ionicCount = listBalanceEquations().filter((e) => e.subtype === "ionic").length;
    const { drafts, errors } = generateChemBatch({
      scenario: "balance",
      count: ionicCount,
      seed: 21,
      balance_subtype: "ionic"
    });
    assert.equal(errors.length, 0);
    assert.equal(drafts.length, ionicCount);
    for (const d of drafts) {
      assert.equal(d.question.tier, "HT");
      assert.equal(d.question.demand_level, "standard_45");
      assert.deepEqual(d.skill_codes, { ms: [], ws: ["WS4.3"] });
      assert.match(d.question.prompt, /ionic equation|displacement/i);
      assert.match(d.question.prompt, /including its charge/i);
    }

    const half = generateChemBatch({
      scenario: "balance",
      count: 3,
      seed: 22,
      balance_subtype: "half"
    });
    assert.equal(half.errors.length, 0);
    for (const d of half.drafts) {
      assert.equal(d.question.tier, "HT");
      assert.equal(d.question.demand_level, "standard_45");
      assert.deepEqual(d.skill_codes, { ms: [], ws: ["WS4.3"] });
    }
  });

  it("uses AQA-style half-equation stems with three-slot layout", () => {
    const halfCount = listBalanceEquations().filter((e) => e.subtype === "half").length;
    const { drafts, errors } = generateChemBatch({
      scenario: "balance",
      count: halfCount,
      seed: 22,
      balance_subtype: "half"
    });
    assert.equal(errors.length, 0);
    assert.equal(drafts.length, halfCount);
    for (const d of drafts) {
      assert.equal(d.question.chemistry_config.template.subtype, "half");
      assert.match(d.question.chemistry_config.template.halfLayout, /cation|anion/);
      assert.equal(d.question.max_marks, 2);
      assert.match(d.question.prompt, /half-equation/i);
      assert.doesNotMatch(d.question.prompt, /-> \?/);
    }
    const al = drafts.find((d) => d.variant.id === "half_al2o3_cathode");
    assert.ok(al);
    assert.match(al.question.prompt, /aluminium oxide/i);
    assert.match(al.question.prompt, /negative electrode/i);
    assert.equal(al.question.chemistry_config.template.halfLayout, "cation");
    const cl = drafts.find((d) => d.variant.id === "half_chloride_anode");
    assert.equal(cl.question.chemistry_config.template.halfLayout, "anion");
  });

  it("never repeats an equation within one run", () => {
    const { drafts, errors } = generateChemBatch({ scenario: "balance", count: 25, seed: 12 });
    assert.equal(errors.length, 0);
    assert.equal(drafts.length, 25);
    const sigs = drafts.map((d) => d.variant.signature);
    assert.equal(new Set(sigs).size, 25);
  });

  it("skips equations listed in excludeBalanceKeys", () => {
    const first = listBalanceEquations()[0];
    const sig = balanceEquationSignature(first);
    const { drafts, errors } = generateChemBatch({
      scenario: "balance",
      count: 5,
      seed: 4,
      excludeBalanceKeys: [sig, first.id]
    });
    assert.equal(errors.length, 0);
    for (const d of drafts) {
      assert.notEqual(d.variant.signature, sig);
      assert.notEqual(d.variant.id, first.id);
    }
  });

  it("extracts balance signatures from prompts", () => {
    assert.equal(
      extractBalanceSignatureFromPrompt("Balance the following equation.\n\n$\\ce{H2 + O2 -> H2O}$"),
      "H2 + O2 -> H2O"
    );
  });

  it("selectUniqueBalanceEquations respects excludes", () => {
    const rng = mulberry32(8);
    const first = listBalanceEquations()[0];
    const { selected, shortfall } = selectUniqueBalanceEquations(
      listBalanceEquations(),
      8,
      rng,
      [balanceEquationSignature(first)]
    );
    assert.equal(shortfall, 0);
    assert.equal(selected.length, 8);
    assert.ok(!selected.some((e) => e.id === first.id));
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

describe("HT moles ↔ mass", () => {
  it("find n is 2-mark higher-tier with insert + calculate", () => {
    const { drafts, errors } = generateChemBatch({ scenario: "moles_find_n", count: 3, seed: 21 });
    assert.equal(errors.length, 0);
    assert.equal(drafts.length, 3);
    for (const d of drafts) {
      assert.equal(d.question.tier, "HT");
      assert.equal(d.question.max_marks, 2);
      assert.equal(d.question.demand_level, "standard_45");
      assert.equal(d.question.calculation_config.marking_mode, "moles_mass");
      assert.deepEqual(getActiveSteps(d.question.calculation_config).map((s) => s.type), ["insert_values", "calculate"]);
      assert.match(d.question.prompt, /Relative atomic mass \(Ar\):/);
      assert.match(d.question.prompt, /Relative formula mass \(Mr\):/);
      assert.equal(d.question.calculation_config.steps[0].op, "div");
    }
  });

  it("find mass is the reverse recipe", () => {
    const { drafts, errors } = generateChemBatch({ scenario: "moles_find_m", count: 2, seed: 22 });
    assert.equal(errors.length, 0);
    assert.equal(drafts[0].question.calculation_config.steps[0].op, "mul");
    assert.equal(drafts[0].answer_key.key_payload.unit, "g");
  });

  it("correct final alone scores 2/2; insert only scores 1/2", () => {
    const compound = listCompounds().find((c) => c.formula === "H2O");
    const draft = generateMolesFindNDraft(compound, { seed: 1 }, mulberry32(1));
    const n = draft.variant.n;
    const m = draft.variant.m;
    const mr = draft.variant.mr;
    const config = draft.question.calculation_config;
    const key = draft.answer_key;

    const full = markMolesMassResponse(
      draft.question,
      { steps: { calculate: n }, value: n },
      key,
      [],
      null,
      config
    );
    assert.equal(full.total, 2);

    const insertOnly = markMolesMassResponse(
      draft.question,
      { steps: { insert_values: { left: m, right: mr } } },
      key,
      [],
      null,
      config
    );
    assert.equal(insertOnly.total, 1);
    assert.equal(insertOnly.stepResults.insert_values.earned, 1);
  });

  it("ECF: inverted numbers calculated correctly still get the answer mark", () => {
    const compound = listCompounds().find((c) => c.formula === "H2O");
    const draft = generateMolesFindNDraft(compound, { seed: 1 }, mulberry32(1));
    const m = draft.variant.m;
    const mr = draft.variant.mr;
    const inverted = mr / m;
    const result = markMolesMassResponse(
      draft.question,
      {
        steps: {
          insert_values: { left: mr, right: m },
          calculate: inverted
        }
      },
      draft.answer_key,
      [],
      null,
      draft.question.calculation_config
    );
    assert.equal(result.stepResults.insert_values.earned, 0);
    assert.equal(result.stepResults.calculate.earned, 1);
    assert.equal(result.total, 1);
  });
});

describe("HT Avogadro", () => {
  function rngIndex(i, len = 10) {
    return () => (i + 0.1) / len;
  }

  function toSfRaw(value) {
    const n = Number(value);
    const exp = Math.floor(Math.log10(Math.abs(n)));
    const mant = parseFloat((n / 10 ** exp).toPrecision(4));
    const mantStr = Number.isInteger(mant) ? `${mant}.0` : String(mant);
    return `${mantStr}x10^${exp}`;
  }

  it("find particles is 2-mark higher-tier with Avogadro constant and standard form", () => {
    const { drafts, errors } = generateChemBatch({ scenario: "avogadro_find_N", count: 3, seed: 31 });
    assert.equal(errors.length, 0);
    assert.equal(drafts.length, 3);
    for (const d of drafts) {
      assert.equal(d.question.tier, "HT");
      assert.equal(d.question.max_marks, 2);
      assert.equal(d.question.demand_level, "standard_45");
      assert.equal(d.question.calculation_config.marking_mode, "moles_mass");
      assert.deepEqual(getActiveSteps(d.question.calculation_config).map((s) => s.type), ["insert_values", "calculate"]);
      assert.match(d.question.prompt, /Avogadro constant/);
      assert.match(d.question.prompt, /6\.02 \\times 10\^\{23\}/);
      assert.match(d.question.prompt, /Give your answer in standard form/);
      assert.doesNotMatch(d.question.prompt, /Relative atomic mass/);
      assert.equal(d.question.calculation_config.steps[0].op, "mul");
      assert.deepEqual(d.skill_codes.ms, ["MS1a", "MS1b", "MS3a"]);
      assert.ok(!d.skill_codes.ms.includes("MS3b"));
      assert.ok(!d.skill_codes.ms.includes("MS2a"));
    }
  });

  it("find moles rearranges and includes MS3b", () => {
    const { drafts, errors } = generateChemBatch({ scenario: "avogadro_find_n", count: 2, seed: 32 });
    assert.equal(errors.length, 0);
    assert.equal(drafts[0].question.calculation_config.steps[0].op, "div");
    assert.equal(drafts[0].answer_key.key_payload.unit, "mol");
    assert.ok(drafts[0].skill_codes.ms.includes("MS3b"));
    assert.ok(!drafts[0].question.prompt.includes("Give your answer in standard form"));
  });

  it("2 significant figures adds a sig_figs step, MS2a, and 3 marks", () => {
    const { drafts, errors } = generateChemBatch({
      scenario: "avogadro_find_N",
      count: 1,
      seed: 33,
      sig_figs: true,
      sig_figs_count: 2
    });
    assert.equal(errors.length, 0);
    const d = drafts[0];
    assert.equal(d.question.max_marks, 3);
    assert.deepEqual(getActiveSteps(d.question.calculation_config).map((s) => s.type), ["insert_values", "calculate", "sig_figs"]);
    assert.match(d.question.prompt, /Give your answer to 2 significant figures/);
    assert.ok(d.skill_codes.ms.includes("MS2a"));
    assert.equal(d.question.calculation_config.steps[2].sig_figs, 2);
    assert.equal(d.question.calculation_config.steps[2].marks, 1);
  });

  it("correct final scores 2/2 without sig figs", () => {
    const compound = listCompounds().find((c) => c.formula === "H2O");
    const draft = generateAvogadroFindParticlesDraft(compound, { seed: 1 }, rngIndex(1));
    const N = draft.variant.N;
    const raw = toSfRaw(N);
    const result = markMolesMassResponse(
      draft.question,
      { steps: { calculate: N }, value: N, stepRaw: { calculate: raw } },
      draft.answer_key,
      [],
      null,
      draft.question.calculation_config
    );
    assert.equal(result.total, 2);
    assert.equal(result.max, 2);
  });

  it("correct calculate plus 2 s.f. scores 3/3", () => {
    const compound = listCompounds().find((c) => c.formula === "H2O");
    const draft = generateAvogadroFindParticlesDraft(
      compound,
      { seed: 1, sig_figs: true, sig_figs_count: 2 },
      rngIndex(1)
    );
    const n = draft.variant.n;
    const N = draft.variant.N;
    const na = draft.question.calculation_config.steps[0].right.value;
    const rounded = Number(N.toPrecision(2));
    const result = markMolesMassResponse(
      draft.question,
      {
        steps: {
          insert_values: { left: n, right: na },
          calculate: N,
          sig_figs: rounded
        },
        stepRaw: {
          calculate: toSfRaw(N),
          sig_figs: toSfRaw(rounded)
        },
        value: N
      },
      draft.answer_key,
      [],
      null,
      draft.question.calculation_config
    );
    assert.equal(result.total, 3);
    assert.equal(result.stepResults.sig_figs.earned, 1);
  });

  it("find moles with 2 s.f. includes MS3b and MS2a", () => {
    const { drafts } = generateChemBatch({
      scenario: "avogadro_find_n",
      count: 1,
      seed: 34,
      sig_figs: true
    });
    assert.deepEqual(drafts[0].skill_codes.ms, ["MS1a", "MS1b", "MS3a", "MS3b", "MS2a"]);
  });
});

describe("HT reacting masses", () => {
  it("generates 3-mark HT drafts with moles path and mass-ratio shortcut", () => {
    const { drafts, errors } = generateChemBatch({ scenario: "reacting_masses", count: 4, seed: 31 });
    assert.equal(errors.length, 0);
    assert.equal(drafts.length, 4);
    for (const d of drafts) {
      assert.equal(d.question.tier, "HT");
      assert.equal(d.question.max_marks, 3);
      assert.equal(d.question.calculation_config.marking_mode, "multi_path");
      const ids = d.question.calculation_config.paths.map((p) => p.id);
      assert.ok(ids.includes("moles_then_ratio"));
      assert.ok(ids.includes("mass_ratio"));
      assert.match(d.question.prompt, /balanced equation/i);
      assert.match(d.question.prompt, /Relative atomic mass \(Ar\):/);
      assert.match(d.question.prompt, /Relative formula mass \(Mr\):/);
      assert.equal(d.question.calculation_config.steps[0].placeholder, "");
      assert.equal(d.question.calculation_config.steps[1].placeholder, "");
    }
  });

  it("correct final scores 3/3 including via mass-ratio shortcut", () => {
    const reaction = listStoichReactions("reacting_masses")[0];
    const draft = generateReactingMassesDraft(reaction, { seed: 2 }, mulberry32(2));
    const ans = draft.variant.mFind;
    const result = markMultiPathCalculationResponse(
      draft.question,
      { steps: { calculate: ans }, value: ans },
      draft.answer_key,
      [],
      null,
      draft.question.calculation_config
    );
    assert.equal(result.total, 3);
  });

  it("ECF from wrong moles of given into later steps", () => {
    const reaction = listStoichReactions("reacting_masses").find((r) => r.id === "mg_o2_mgo");
    const draft = generateReactingMassesDraft(reaction, { seed: 4 }, mulberry32(4));
    const config = draft.question.calculation_config;
    const nGiven = config.paths[0].steps[0].accept.find((r) => r.value != null).value;
    const nFind = config.paths[0].steps[1].accept.find((r) => r.value != null).value;
    const mFind = draft.variant.mFind;
    const ratio = nFind / nGiven;
    const mrFind = mFind / nFind;
    const wrongN = nGiven * 2;
    const ecfNFind = wrongN * ratio;
    const ecfMass = ecfNFind * mrFind;
    const result = markMultiPathCalculationResponse(
      draft.question,
      {
        steps: { working_1: wrongN, working_2: ecfNFind, calculate: ecfMass },
        value: ecfMass
      },
      draft.answer_key,
      [],
      null,
      config
    );
    assert.equal(result.total, 2);
  });
});

describe("HT balance from masses", () => {
  it("is 2-mark HT: moles table + coefficients", () => {
    const { drafts, errors } = generateChemBatch({ scenario: "balance_from_masses", count: 3, seed: 41 });
    assert.equal(errors.length, 0);
    assert.equal(drafts.length, 3);
    for (const d of drafts) {
      assert.equal(d.question.tier, "HT");
      assert.equal(d.question.max_marks, 2);
      assert.equal(d.question.calculation_config.marking_mode, "balance_from_masses");
      assert.deepEqual(
        getActiveSteps(d.question.calculation_config).map((s) => s.type),
        ["mole_table", "balance_coeffs"]
      );
      assert.match(d.question.prompt, /g of /);
    }
  });

  it("awards 1 for moles and 1 for any equivalent whole-number ratio", () => {
    const reaction = listStoichReactions("balance_from_masses").find((r) => r.id === "mg_o2_mgo");
    const draft = generateBalanceFromMassesDraft(reaction, { seed: 5 }, mulberry32(5));
    const moleStep = draft.question.calculation_config.steps[0];
    const moles = Object.fromEntries(moleStep.species.map((sp) => [sp.id, sp.answer]));
    const doubled = markBalanceFromMassesResponse(
      draft.question,
      {
        steps: {
          mole_table: moles,
          balance_coeffs: [4, 2, 4]
        }
      },
      draft.answer_key,
      [],
      null,
      draft.question.calculation_config
    );
    assert.equal(doubled.total, 2);

    const molesOnly = markBalanceFromMassesResponse(
      draft.question,
      { steps: { mole_table: moles, balance_coeffs: [1, 1, 1] } },
      draft.answer_key,
      [],
      null,
      draft.question.calculation_config
    );
    assert.equal(molesOnly.total, 1);
  });
});

describe("HT limiting reactant", () => {
  it("excess-given is 3-mark reacting-mass style", () => {
    const { drafts, errors } = generateChemBatch({ scenario: "limiting_excess", count: 3, seed: 51 });
    assert.equal(errors.length, 0);
    assert.equal(drafts.length, 3);
    for (const d of drafts) {
      assert.equal(d.question.max_marks, 3);
      assert.match(d.question.prompt, /in excess/i);
      assert.equal(d.question.calculation_config.marking_mode, "multi_path");
    }
  });

  it("identify recipe is 4 marks with select + moles + ratio + mass", () => {
    const { drafts, errors } = generateChemBatch({ scenario: "limiting_identify", count: 3, seed: 52 });
    assert.equal(errors.length, 0);
    assert.equal(drafts.length, 3);
    for (const d of drafts) {
      assert.equal(d.question.max_marks, 4);
      assert.equal(d.question.tier, "HT");
      assert.equal(d.question.demand_level, "standard_67");
      assert.deepEqual(
        getActiveSteps(d.question.calculation_config).map((s) => s.type),
        ["mole_table", "mole_ratio", "limiting_select", "calculate"]
      );
      const moleIds = d.question.calculation_config.steps[0].species.map((sp) => sp.id);
      const ratio = d.question.calculation_config.steps[1];
      assert.deepEqual([ratio.left.id, ratio.right.id], moleIds);
    }
  });

  it("wrong limiting select does not award that mark; correct mass still can", () => {
    const reaction = listStoichReactions("limiting").find((r) => r.id === "mg_o2_mgo");
    const draft = generateLimitingIdentifyDraft(reaction, { seed: 8 }, mulberry32(8));
    const config = draft.question.calculation_config;
    const moleStep = config.steps.find((s) => s.type === "mole_table");
    const moles = Object.fromEntries(moleStep.species.map((sp) => [sp.id, sp.answer]));
    const ratioStep = config.steps.find((s) => s.type === "mole_ratio");
    const wrongId = config.steps.find((s) => s.type === "limiting_select")
      .options.find((o) => o.id !== draft.variant.limiting).id;
    const result = markLimitingReactantResponse(
      draft.question,
      {
        steps: {
          mole_table: moles,
          mole_ratio: { left: ratioStep.left.value, right: ratioStep.right.value },
          limiting_select: wrongId,
          calculate: draft.variant.mP
        },
        value: draft.variant.mP
      },
      draft.answer_key,
      [],
      null,
      config
    );
    assert.equal(result.stepResults.limiting_select.earned, 0);
    assert.equal(result.stepResults.calculate.earned, 1);
    assert.equal(result.total, 3);
  });
});

describe("stoich bank", () => {
  it("has parseable formulas and limiting-capable reactions", () => {
    const all = listStoichReactions();
    assert.ok(all.length >= 12);
    for (const r of all) {
      for (const sp of r.species) {
        assert.ok(relativeFormulaMass(sp.formula) > 0);
        assert.ok(sp.coeff >= 1);
      }
    }
    assert.ok(listStoichReactions("limiting").length >= 8);
  });
});

describe("chem quant DB tier", () => {
  const HT_SCENARIOS = [
    "moles_find_n",
    "moles_find_m",
    "avogadro_find_N",
    "avogadro_find_n",
    "reacting_masses",
    "balance_from_masses",
    "limiting_excess",
    "limiting_identify"
  ];

  it("writes questions.tier as HT for every HT recipe", () => {
    for (const scenario of HT_SCENARIOS) {
      const { drafts, errors } = generateChemBatch({ scenario, count: 1, seed: 7 });
      assert.equal(errors.length, 0, scenario);
      assert.ok(drafts.length >= 1, scenario);
      assert.equal(drafts[0].question.tier, "HT", scenario);
    }
  });

  it("maps ionic/half balance to HT", () => {
    const ionic = generateChemBatch({ scenario: "balance", count: 1, seed: 8, balance_subtype: "ionic" });
    assert.equal(ionic.errors.length, 0);
    assert.equal(ionic.drafts[0].question.tier, "HT");
    const half = generateChemBatch({ scenario: "balance", count: 1, seed: 9, balance_subtype: "half" });
    assert.equal(half.errors.length, 0);
    assert.equal(half.drafts[0].question.tier, "HT");
  });

  it("maps admin higher/foundation/both onto FT | HT | both", () => {
    assert.equal(generateChemBatch({ scenario: "rfm", count: 1, seed: 1, tier: "higher" }).drafts[0].question.tier, "HT");
    assert.equal(generateChemBatch({ scenario: "rfm", count: 1, seed: 1, tier: "foundation" }).drafts[0].question.tier, "FT");
    assert.equal(generateChemBatch({ scenario: "rfm", count: 1, seed: 1, tier: "both" }).drafts[0].question.tier, "both");
  });
});
