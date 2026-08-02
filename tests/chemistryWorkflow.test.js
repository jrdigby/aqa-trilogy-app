/**
 * Unit tests for chemistry interactive marking (no DOM).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  markChemistryResponse,
  CHEMISTRY_PRESETS,
  shellsForElement,
  distributeElectrons,
  initialStateForConfig,
  buildAtomDiagramConfig,
  buildOrganicDiagramConfig,
  symbolFromProtons,
} from "../src/chemistryWorkflow.js";

describe("chemistry shells helpers", () => {
  it("distributes electrons into shells", () => {
    assert.deepEqual(distributeElectrons(6), [2, 4]);
    assert.deepEqual(distributeElectrons(11), [2, 8, 1]);
  });

  it("returns known element shells", () => {
    assert.deepEqual(shellsForElement("C"), [2, 4]);
    assert.deepEqual(shellsForElement("Na"), [2, 8, 1]);
  });
});

describe("markChemistryResponse", () => {
  it("marks carbon-12 shells correct", () => {
    const preset = CHEMISTRY_PRESETS.carbon12;
    const q = { question_type: "chemistry_interactive", max_marks: 2, chemistry_config: { kind: preset.kind, template: preset.template, answer: preset.answer } };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = { kind: "electron_shell", shells: [2, 4], nucleus: { p: 6, n: 6 }, symbol: "C" };
    const result = markChemistryResponse(q, resp, key, [], null);
    assert.equal(result.total, 2);
    assert.equal(result.quality, 5);
  });

  it("marks shells correct even if nucleus differs (nucleus not student-entered)", () => {
    const answer = { kind: "electron_shell", shells: [2, 7], nucleus: { p: 9, n: 10 }, symbol: "F" };
    const q = { question_type: "chemistry_interactive", max_marks: 1, chemistry_config: { kind: "electron_shell", answer } };
    const key = { key_type: "chemistry", key_payload: answer };
    const resp = { kind: "electron_shell", shells: [2, 7], nucleus: { p: 0, n: 0 }, symbol: "F" };
    assert.equal(markChemistryResponse(q, resp, key, [], null).total, 1);
  });

  it("rejects wrong shells", () => {
    const preset = CHEMISTRY_PRESETS.carbon12;
    const q = { question_type: "chemistry_interactive", max_marks: 1, chemistry_config: { kind: preset.kind, template: preset.template } };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = { kind: "electron_shell", shells: [2, 3], nucleus: { p: 6, n: 6 } };
    const result = markChemistryResponse(q, resp, key, [], null);
    assert.equal(result.total, 0);
  });

  it("marks balanced equation with equivalent multiples", () => {
    const preset = CHEMISTRY_PRESETS.water_balance;
    const q = { question_type: "chemistry_interactive", max_marks: 1, chemistry_config: { kind: preset.kind, template: preset.template } };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = { kind: "balance_equation", coeffs: [4, 2, 4] };
    const result = markChemistryResponse(q, resp, key, [], null);
    assert.equal(result.total, 1);
  });

  it("marks ionic NaCl", () => {
    const preset = CHEMISTRY_PRESETS.nacl;
    const q = { question_type: "chemistry_interactive", max_marks: 1, chemistry_config: { kind: preset.kind, template: preset.template } };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = {
      kind: "ionic_bonding",
      left: { symbol: "Na", shells: [2, 8], charge: 1 },
      right: { symbol: "Cl", shells: [2, 8, 8], charge: -1 },
    };
    const result = markChemistryResponse(q, resp, key, [], null);
    assert.equal(result.total, 1);
  });

  it("marks ethene double bond", () => {
    const preset = CHEMISTRY_PRESETS.ethene;
    const q = { question_type: "chemistry_interactive", max_marks: 1, chemistry_config: { kind: preset.kind, template: preset.template } };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = {
      kind: "organic_structure",
      carbonBonds: [{ from: 0, to: 1, order: 2 }],
    };
    const result = markChemistryResponse(q, resp, key, [], null);
    assert.equal(result.total, 1);
  });

  it("marks polyethene repeat unit", () => {
    const preset = CHEMISTRY_PRESETS.polyethene;
    const q = { question_type: "chemistry_interactive", max_marks: 1, chemistry_config: { kind: preset.kind, template: preset.template } };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = { kind: "polymer_structure", selectedRepeat: "ch2ch2" };
    const result = markChemistryResponse(q, resp, key, [], null);
    assert.equal(result.total, 1);
  });

  it("marks fluorine shells with matching nucleus", () => {
    const answer = { kind: "electron_shell", shells: [2, 7], nucleus: { p: 9, n: 10 }, symbol: "F" };
    const q = { question_type: "chemistry_interactive", max_marks: 1, chemistry_config: { kind: "electron_shell", answer } };
    const key = { key_type: "chemistry", key_payload: answer };
    const resp = { kind: "electron_shell", shells: [2, 7], nucleus: { p: 9, n: 10 }, symbol: "F" };
    assert.equal(markChemistryResponse(q, resp, key, [], null).total, 1);
  });

  it("rejects fluorine with wrong shell split", () => {
    const answer = { kind: "electron_shell", shells: [2, 7], nucleus: { p: 9, n: 10 } };
    const q = { question_type: "chemistry_interactive", max_marks: 1, chemistry_config: { kind: "electron_shell" } };
    const key = { key_type: "chemistry", key_payload: answer };
    const resp = { kind: "electron_shell", shells: [1, 8], nucleus: { p: 9, n: 10 } };
    const result = markChemistryResponse(q, resp, key, [], null);
    assert.equal(result.total, 0);
    assert.match(result.feedbackPayload.chemistry.detail, /expected \[2, 7\]/i);
  });
});

describe("custom atom / organic builders", () => {
  it("maps protons to element symbol", () => {
    assert.equal(symbolFromProtons(11), "Na");
    assert.equal(symbolFromProtons(6), "C");
  });

  it("builds Na+ from protons/electrons/neutrons", () => {
    const cfg = buildAtomDiagramConfig({ protons: 11, electrons: 10, neutrons: 12 });
    assert.equal(cfg.kind, "electron_shell");
    assert.equal(cfg.answer.symbol, "Na");
    assert.deepEqual(cfg.answer.shells, [2, 8]);
    assert.equal(cfg.answer.charge, 1);
    assert.deepEqual(cfg.answer.nucleus, { p: 11, n: 12 });
  });

  it("builds Cl- ion", () => {
    const cfg = buildAtomDiagramConfig({ symbol: "Cl", protons: 17, electrons: 18, neutrons: 18 });
    assert.deepEqual(cfg.answer.shells, [2, 8, 8]);
    assert.equal(cfg.answer.charge, -1);
  });

  it("builds custom butane alkane", () => {
    const cfg = buildOrganicDiagramConfig({ family: "alkane", carbons: 4, name: "butane" });
    assert.equal(cfg.kind, "organic_structure");
    assert.equal(cfg.answer.carbons, 4);
    assert.equal(cfg.answer.carbonBonds.length, 3);
    assert.ok(cfg.answer.carbonBonds.every((b) => b.order === 1));
  });

  it("builds custom but-2-ene with double bond at C2", () => {
    const cfg = buildOrganicDiagramConfig({
      family: "alkene",
      carbons: 4,
      name: "but-2-ene",
      doubleBondAt: 1,
    });
    assert.equal(cfg.answer.carbonBonds[1].order, 2);
    assert.equal(cfg.answer.carbonBonds[0].order, 1);
  });

  it("builds custom ethanol alcohol", () => {
    const cfg = buildOrganicDiagramConfig({ family: "alcohol", carbons: 2, name: "ethanol" });
    assert.deepEqual(cfg.answer.groups[1], ["OH"]);
  });
});
