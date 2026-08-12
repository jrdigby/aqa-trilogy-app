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
  renderStemDiagramSvg,
  renderChemistryModelAnswerHtml,
  renderIonicLatticeSvg,
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

  it("marks ionic NaCl all three points", () => {
    const preset = CHEMISTRY_PRESETS.nacl;
    const q = { question_type: "chemistry_interactive", max_marks: 3, chemistry_config: { kind: preset.kind, template: preset.template } };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = {
      kind: "ionic_bonding",
      atoms: [
        { symbol: "Na", shells: [2, 8], charge: 1, brackets: true },
        { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true },
      ],
    };
    const result = markChemistryResponse(q, resp, key, [], null);
    assert.equal(result.total, 3);
    assert.equal(result.quality, 5);
  });

  it("marks ionic NaCl with trailing zero shells normalized", () => {
    const preset = CHEMISTRY_PRESETS.nacl;
    const q = { question_type: "chemistry_interactive", max_marks: 3, chemistry_config: { kind: preset.kind, template: preset.template } };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = {
      kind: "ionic_bonding",
      atoms: [
        { symbol: "Na", shells: [2, 8, 0], charge: 1, brackets: true },
        { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true },
      ],
    };
    assert.equal(markChemistryResponse(q, resp, key, [], null).total, 3);
  });

  it("awards partial ionic marks when brackets missing", () => {
    const preset = CHEMISTRY_PRESETS.nacl;
    const q = { question_type: "chemistry_interactive", max_marks: 3, chemistry_config: { kind: preset.kind, template: preset.template } };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = {
      kind: "ionic_bonding",
      atoms: [
        { symbol: "Na", shells: [2, 8], charge: 1, brackets: false },
        { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true },
      ],
    };
    const result = markChemistryResponse(q, resp, key, [], null);
    assert.equal(result.total, 2);
    assert.equal(result.quality, 3);
  });

  it("ionic feedback focuses on electron arrangement when shells wrong", () => {
    const preset = CHEMISTRY_PRESETS.nacl;
    const q = { question_type: "chemistry_interactive", max_marks: 3, chemistry_config: { kind: preset.kind, template: preset.template } };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = {
      kind: "ionic_bonding",
      atoms: [
        { symbol: "Na", shells: [2, 8, 1], charge: 0, brackets: false },
        { symbol: "Cl", shells: [2, 8, 7], charge: 0, brackets: false },
      ],
    };
    const result = markChemistryResponse(q, resp, key, [], null);
    assert.equal(result.feedbackPayload.chemistry.detail, "Electron arrangement incorrect");
    assert.equal(result.missing.length, 1);
  });

  it("ionic feedback is charge-only when shells are correct", () => {
    const preset = CHEMISTRY_PRESETS.nacl;
    const q = { question_type: "chemistry_interactive", max_marks: 3, chemistry_config: { kind: preset.kind, template: preset.template } };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = {
      kind: "ionic_bonding",
      atoms: [
        { symbol: "Na", shells: [2, 8], charge: 0, brackets: true },
        { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true },
      ],
    };
    const result = markChemistryResponse(q, resp, key, [], null);
    assert.equal(result.total, 2);
    assert.equal(result.feedbackPayload.chemistry.detail, "Check the charge on each ion (group number).");
    assert.doesNotMatch(result.feedbackPayload.chemistry.detail, /electron arrangement/i);
  });

  it("marks MgCl2 ionic with ratio mark (4 marks)", () => {
    const preset = CHEMISTRY_PRESETS.mgcl2;
    const q = { question_type: "chemistry_interactive", max_marks: 4, chemistry_config: { kind: preset.kind, template: preset.template } };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = {
      kind: "ionic_bonding",
      atoms: [
        { symbol: "Mg", shells: [2, 8], charge: 2, brackets: true },
        { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true },
        { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true },
      ],
    };
    assert.equal(markChemistryResponse(q, resp, key, [], null).total, 4);
  });

  it("marks water covalent shared + lone pairs (2 marks)", () => {
    const preset = CHEMISTRY_PRESETS.h2o;
    const q = { question_type: "chemistry_interactive", max_marks: 2, chemistry_config: { kind: preset.kind, template: preset.template } };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = JSON.parse(JSON.stringify(preset.answer));
    assert.equal(markChemistryResponse(q, resp, key, [], null).total, 2);
  });

  it("awards 1 covalent mark for shared pairs only", () => {
    const preset = CHEMISTRY_PRESETS.o2;
    const q = { question_type: "chemistry_interactive", max_marks: 2, chemistry_config: { kind: preset.kind, template: preset.template } };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = {
      kind: "covalent_bonding",
      atoms: [{ symbol: "O", lonePairs: 0 }, { symbol: "O", lonePairs: 0 }],
      bonds: [{ a: 0, b: 1, sharedPairs: 2, maxPairs: 2 }],
    };
    const result = markChemistryResponse(q, resp, key, [], null);
    assert.equal(result.total, 1);
    assert.equal(result.quality, 3);
  });

  it("includes AQA covalent molecule presets", () => {
    for (const id of ["h2", "cl2", "o2", "n2", "hcl", "h2o", "nh3", "ch4_covalent"]) {
      assert.ok(CHEMISTRY_PRESETS[id], `missing preset ${id}`);
      assert.equal(CHEMISTRY_PRESETS[id].kind, "covalent_bonding");
      assert.equal(CHEMISTRY_PRESETS[id].recommendedMaxMarks, 2);
    }
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

  it("marks stem ion diagrams for square brackets by default", () => {
    const cfg = buildAtomDiagramConfig({ protons: 11, electrons: 10, neutrons: 12 });
    assert.equal(cfg.answer.showIonBrackets, true);
    assert.equal(cfg.template.showIonBrackets, true);
  });

  it("can suppress ion brackets on stem when requested", () => {
    const cfg = buildAtomDiagramConfig({
      protons: 11, electrons: 10, neutrons: 12, showIonBrackets: false,
    });
    assert.equal(cfg.answer.showIonBrackets, false);
  });

  it("renders stem SVG with ion brackets for Na+", () => {
    const cfg = buildAtomDiagramConfig({ protons: 11, electrons: 10, neutrons: 12 });
    const svg = renderStemDiagramSvg(cfg);
    assert.match(svg, /M[\d.]+ [\d.]+ L[\d.]+/); // bracket path
    assert.match(svg, />⁺<\/text>/); // charge label
  });

  it("renders stem SVG without brackets when suppressed", () => {
    const cfg = buildAtomDiagramConfig({
      protons: 11, electrons: 10, neutrons: 12, showIonBrackets: false,
    });
    const svg = renderStemDiagramSvg(cfg);
    assert.doesNotMatch(svg, />⁺<\/text>/);
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

describe("ionic charge notation", () => {
  it("renders model-answer caption with superscript charges (²⁺ / ⁻)", () => {
    const html = renderChemistryModelAnswerHtml(CHEMISTRY_PRESETS.mgcl2.answer);
    assert.match(html, /Mg²⁺/);
    assert.match(html, /Cl⁻/);
    assert.doesNotMatch(html, /Mg⁺2/);
    assert.doesNotMatch(html, /Cl⁻1/);
  });
});

describe("ionic lattice stem diagrams", () => {
  it("renders ball-and-stick NaCl lattice with key and bonds", () => {
    const svg = renderStemDiagramSvg("nacl_lattice_ball");
    assert.match(svg, /<svg/);
    assert.match(svg, /<line /);
    assert.match(svg, />Key</);
    assert.match(svg, /Na⁺/);
    assert.match(svg, /Cl⁻/);
    assert.ok((svg.match(/<circle /g) || []).length >= 29); // 27 ions + 2 key
  });

  it("renders space-filling NaCl lattice with alternating charges and no key", () => {
    const svg = renderIonicLatticeSvg(CHEMISTRY_PRESETS.nacl_lattice_space.answer);
    assert.match(svg, />\+</);
    assert.match(svg, />−</);
    assert.doesNotMatch(svg, /<line /);
    assert.doesNotMatch(svg, />Key</);
    const plus = (svg.match(/>\+</g) || []).length;
    const minus = (svg.match(/>−</g) || []).length;
    assert.equal(plus + minus, 27);
    assert.ok(Math.abs(plus - minus) <= 1);
  });

  it("renders compare preset with both models", () => {
    const svg = renderStemDiagramSvg("nacl_lattice_compare");
    assert.match(svg, /Ball-and-stick/);
    assert.match(svg, /Space-filling/);
    assert.match(svg, />Key</);
  });
});
