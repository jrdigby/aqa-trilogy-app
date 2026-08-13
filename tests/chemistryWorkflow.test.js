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
  layoutCovalentAtoms,
  covalentSharedElectronPositions,
  covSharedElectronStyle,
  renderPolymerRepeatUnitSvg,
  normalizeMoleculeGraph,
  renderMetallicBondingSvg,
  renderParticleModelSvg,
  parseEquationSpeciesToken,
  parseEquationSpeciesList,
  formatEquationSpeciesList,
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

  it("places CH4 shared electrons on both atom shells", () => {
    const preset = CHEMISTRY_PRESETS.ch4_covalent;
    const { positions, shellRadii } = layoutCovalentAtoms(preset.answer.atoms, preset.answer.bonds);
    for (const bond of preset.answer.bonds) {
      const pts = covalentSharedElectronPositions(bond, positions, shellRadii);
      assert.equal(pts.length, 2, "each C–H bond has one dot and one cross");
      assert.equal(covSharedElectronStyle(bond, pts[0].atom), "dot");
      assert.equal(covSharedElectronStyle(bond, pts[1].atom), "cross");
      for (const pt of pts) {
        const centre = positions[pt.atom];
        const r = shellRadii[pt.atom];
        const d = Math.hypot(pt.x - centre.x, pt.y - centre.y);
        assert.ok(Math.abs(d - r) <= 1, `electron at distance ${d.toFixed(1)} should sit on shell radius ${r}`);
      }
    }
  });

  it("assigns dot and cross per bond side for ammonia", () => {
    const preset = CHEMISTRY_PRESETS.nh3;
    const { positions, shellRadii } = layoutCovalentAtoms(preset.answer.atoms, preset.answer.bonds);
    for (const bond of preset.answer.bonds) {
      assert.equal(covSharedElectronStyle(bond, bond.a), "dot");
      assert.equal(covSharedElectronStyle(bond, bond.b), "cross");
      const pts = covalentSharedElectronPositions(bond, positions, shellRadii);
      assert.equal(pts.length, 2);
      for (const pt of pts) {
        const centre = positions[pt.atom];
        const r = shellRadii[pt.atom];
        const d = Math.hypot(pt.x - centre.x, pt.y - centre.y);
        assert.ok(Math.abs(d - r) <= 1, `NH₃ electron should sit on shell (d=${d.toFixed(1)}, r=${r})`);
      }
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

describe("polymer repeat-unit diagrams", () => {
  it("renders poly(ethene) style with C backbone, H substituents, and n subscript", () => {
    const svg = renderPolymerRepeatUnitSvg("ch2ch2");
    assert.match(svg, />C</);
    assert.match(svg, />H</);
    assert.match(svg, />n</);
    assert.match(svg, /<path /);
    assert.doesNotMatch(svg, /<rect /);
  });

  it("renders PVC repeat unit with Cl on one carbon", () => {
    const svg = renderPolymerRepeatUnitSvg("ch2chcl");
    assert.match(svg, />Cl</);
    assert.match(svg, />H</);
  });
});

describe("metallic bonding diagrams", () => {
  it("renders atoms-to-ions diagram with delocalised electron label", () => {
    const svg = renderMetallicBondingSvg();
    assert.match(svg, /<svg/);
    assert.match(svg, />Delocalised electrons</);
    assert.match(svg, />\+</);
    assert.match(svg, />−</);
    assert.ok((svg.match(/stroke-dasharray/g) || []).length >= 7);
  });

  it("renders via stem preset", () => {
    const svg = renderStemDiagramSvg("metallic_bonding");
    assert.match(svg, /chem-metallic-svg/);
    assert.match(svg, />Delocalised electrons</);
  });

  it("renders model answer html", () => {
    const html = renderChemistryModelAnswerHtml(CHEMISTRY_PRESETS.metallic_bonding.answer);
    assert.match(html, />Delocalised electrons</);
  });
});

describe("particle model diagrams", () => {
  it("renders separate solid, liquid and gas SVGs without labels", () => {
    const solid = renderParticleModelSvg({ state: "solid" });
    const liquid = renderParticleModelSvg({ state: "liquid" });
    const gas = renderParticleModelSvg({ state: "gas" });
    assert.doesNotMatch(solid, />Solid</);
    assert.doesNotMatch(liquid, />Liquid</);
    assert.doesNotMatch(gas, />Gas</);
    const solidCircles = (solid.match(/<circle /g) || []).length;
    const liquidCircles = (liquid.match(/<circle /g) || []).length;
    const gasCircles = (gas.match(/<circle /g) || []).length;
    assert.ok(solidCircles >= 100);
    assert.ok(liquidCircles > 55);
    assert.ok(gasCircles >= 10 && gasCircles <= 14);
    assert.ok(gasCircles < liquidCircles);
  });

  it("packs liquid particles without overlap and against bottom/sides", () => {
    const r = 8.5;
    const box = 200;
    const left = 1 + r;
    const right = box - 1 - r;
    const bottom = box - 1 - r;
    const minDist = 2 * r;
    const svg = renderParticleModelSvg({ state: "liquid" });
    const centres = [...svg.matchAll(/cx="([\d.]+)" cy="([\d.]+)"/g)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
    }));
    assert.ok(centres.length > 50);
    let nearTouch = 0;
    let clearGaps = 0;
    for (let i = 0; i < centres.length; i++) {
      let nearest = Infinity;
      for (let j = 0; j < centres.length; j++) {
        if (i === j) continue;
        const d = Math.hypot(centres[j].x - centres[i].x, centres[j].y - centres[i].y);
        assert.ok(d >= minDist - 0.15, `overlap: ${d}`);
        nearest = Math.min(nearest, d);
      }
      if (nearest <= minDist + 0.35) nearTouch += 1;
      if (nearest >= minDist + r * 0.4) clearGaps += 1;
    }
    assert.ok(nearTouch >= centres.length * 0.45, "many particles should still touch neighbours");
    assert.ok(clearGaps >= 4, "some particles should have visible gaps");
    const onFloor = centres.filter((p) => Math.abs(p.y - bottom) < 0.6);
    assert.ok(onFloor.length >= 3);
    assert.ok(centres.some((p) => Math.abs(p.x - left) < 0.6));
    assert.ok(centres.some((p) => Math.abs(p.x - right) < 0.6));
  });

  it("renders via stem presets", () => {
    assert.match(renderStemDiagramSvg("particle_solid"), /chem-particle-svg--solid/);
    assert.match(renderStemDiagramSvg("particle_liquid"), /chem-particle-svg--liquid/);
    assert.match(renderStemDiagramSvg("particle_gas"), /chem-particle-svg--gas/);
  });
});

describe("molecule builder", () => {
  it("marks NH₃ graph correct regardless of atom ids", () => {
    const preset = CHEMISTRY_PRESETS.nh3_molecule;
    const q = {
      question_type: "chemistry_interactive",
      max_marks: 2,
      chemistry_config: { kind: preset.kind, template: preset.template, answer: preset.answer },
    };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = {
      kind: "molecule_builder",
      atoms: [
        { id: "a", symbol: "N", x: 100, y: 100 },
        { id: "b", symbol: "H", x: 50, y: 100 },
        { id: "c", symbol: "H", x: 150, y: 100 },
        { id: "d", symbol: "H", x: 100, y: 160 },
      ],
      bonds: [{ a: "a", b: "b" }, { a: "a", b: "c" }, { a: "a", b: "d" }],
    };
    assert.equal(markChemistryResponse(q, resp, key, [], null).total, 2);
  });

  it("awards 1 mark for correct atoms only", () => {
    const preset = CHEMISTRY_PRESETS.nh3_molecule;
    const q = {
      question_type: "chemistry_interactive",
      max_marks: 2,
      chemistry_config: { kind: preset.kind, template: preset.template, answer: preset.answer },
    };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = {
      kind: "molecule_builder",
      atoms: [
        { id: "n", symbol: "N", x: 200, y: 120 },
        { id: "h1", symbol: "H", x: 130, y: 120 },
        { id: "h2", symbol: "H", x: 270, y: 120 },
        { id: "h3", symbol: "H", x: 200, y: 190 },
      ],
      bonds: [],
    };
    assert.equal(markChemistryResponse(q, resp, key, [], null).total, 1);
  });

  it("rejects wrong molecule connectivity", () => {
    const preset = CHEMISTRY_PRESETS.nh3_molecule;
    const q = {
      question_type: "chemistry_interactive",
      max_marks: 2,
      chemistry_config: { kind: preset.kind, template: preset.template, answer: preset.answer },
    };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = {
      kind: "molecule_builder",
      atoms: [
        { id: "n", symbol: "N", x: 200, y: 120 },
        { id: "h1", symbol: "H", x: 130, y: 120 },
        { id: "h2", symbol: "H", x: 270, y: 120 },
        { id: "h3", symbol: "H", x: 200, y: 190 },
      ],
      bonds: [{ a: "h1", b: "h2" }, { a: "h2", b: "h3" }],
    };
    assert.equal(markChemistryResponse(q, resp, key, [], null).total, 1);
  });

  it("normalizes graphs by symbols and edges only", () => {
    const a = normalizeMoleculeGraph({
      atoms: [{ id: "x", symbol: "N" }, { id: "y", symbol: "H" }],
      bonds: [{ a: "x", b: "y" }],
    });
    const b = normalizeMoleculeGraph({
      atoms: [{ id: "1", symbol: "H" }, { id: "2", symbol: "N" }],
      bonds: [{ a: "2", b: "1" }],
    });
    assert.equal(a, b);
  });

  it("renders stem diagram for model answer", () => {
    const preset = CHEMISTRY_PRESETS.nh3_molecule;
    const svg = renderStemDiagramSvg({
      kind: preset.kind,
      template: preset.template,
      answer: preset.answer,
    });
    assert.match(svg, />N</);
    assert.match(svg, />H</);
    assert.match(svg, /<line /);
  });
});

describe("equation species authoring", () => {
  it("parses ?NaCl(aq):left as a student-entered formula with state", () => {
    assert.deepEqual(parseEquationSpeciesToken("?NaCl(aq):left"), {
      formula: "NaCl",
      side: "left",
      state: "aq",
      studentEntersFormula: true,
    });
  });

  it("parses H2(g):left as a pre-filled formula with state", () => {
    assert.deepEqual(parseEquationSpeciesToken("H2(g):left"), {
      formula: "H2",
      side: "left",
      state: "g",
    });
  });

  it("parses legacy H2:left without state", () => {
    assert.deepEqual(parseEquationSpeciesToken("H2:left"), {
      formula: "H2",
      side: "left",
    });
  });

  it("round-trips a mixed species list", () => {
    const raw = "H2(g):left, ?NaCl(aq):right";
    const parsed = parseEquationSpeciesList(raw);
    assert.equal(formatEquationSpeciesList(parsed), raw);
  });
});

describe("balance equation formulas and states", () => {
  it("still marks water_balance equivalent multiples with no states", () => {
    const preset = CHEMISTRY_PRESETS.water_balance;
    const q = {
      question_type: "chemistry_interactive",
      max_marks: 1,
      chemistry_config: { kind: preset.kind, template: preset.template },
    };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = { kind: "balance_equation", coeffs: [4, 2, 4] };
    assert.equal(markChemistryResponse(q, resp, key, [], null).total, 1);
  });

  it("awards full marks for correct lowercase states and coeffs", () => {
    const preset = CHEMISTRY_PRESETS.water_balance_states;
    const q = {
      question_type: "chemistry_interactive",
      max_marks: 2,
      chemistry_config: { kind: preset.kind, template: preset.template, answer: preset.answer },
    };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const resp = {
      kind: "balance_equation",
      coeffs: [2, 1, 2],
      states: ["g", "g", "l"],
    };
    const result = markChemistryResponse(q, resp, key, [], null);
    assert.equal(result.total, 2);
    assert.equal(result.quality, 5);
  });

  it("loses the state mark when a state is blank or wrong case", () => {
    const preset = CHEMISTRY_PRESETS.water_balance_states;
    const q = {
      question_type: "chemistry_interactive",
      max_marks: 2,
      chemistry_config: { kind: preset.kind, template: preset.template, answer: preset.answer },
    };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const blank = markChemistryResponse(
      q,
      { kind: "balance_equation", coeffs: [2, 1, 2], states: ["g", "g", ""] },
      key,
      [],
      null
    );
    assert.equal(blank.total, 1);
    const wrongCase = markChemistryResponse(
      q,
      { kind: "balance_equation", coeffs: [2, 1, 2], states: ["g", "g", "L"] },
      key,
      [],
      null
    );
    assert.equal(wrongCase.total, 1);
    assert.match(wrongCase.feedbackPayload.chemistry.detail, /State symbols must be lowercase/);
  });

  it("requires all dimensions on a 1-mark states question", () => {
    const preset = CHEMISTRY_PRESETS.water_balance_states;
    const q = {
      question_type: "chemistry_interactive",
      max_marks: 1,
      chemistry_config: { kind: preset.kind, template: preset.template, answer: preset.answer },
    };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const result = markChemistryResponse(
      q,
      { kind: "balance_equation", coeffs: [2, 1, 2], states: ["g", "g", ""] },
      key,
      [],
      null
    );
    assert.equal(result.total, 0);
  });

  it("accepts exact-case NaCl and rejects nacl / NACL", () => {
    const preset = CHEMISTRY_PRESETS.nacl_aq_formula;
    const q = {
      question_type: "chemistry_interactive",
      max_marks: 3,
      chemistry_config: { kind: preset.kind, template: preset.template, answer: preset.answer },
    };
    const key = { key_type: "chemistry", key_payload: preset.answer };
    const ok = markChemistryResponse(
      q,
      { kind: "balance_equation", coeffs: [1, 1, 1], formulas: ["", "", "NaCl"], states: ["aq", "aq", "aq"] },
      key,
      [],
      null
    );
    assert.equal(ok.total, 3);
    assert.equal(
      markChemistryResponse(
        q,
        { kind: "balance_equation", coeffs: [1, 1, 1], formulas: ["", "", "nacl"], states: ["aq", "aq", "aq"] },
        key,
        [],
        null
      ).total,
      2
    );
    assert.equal(
      markChemistryResponse(
        q,
        { kind: "balance_equation", coeffs: [1, 1, 1], formulas: ["", "", "NACL"], states: ["aq", "aq", "aq"] },
        key,
        [],
        null
      ).total,
      2
    );
  });

  it("does not treat Co as a match for CO", () => {
    const species = [
      { formula: "C", side: "left", state: "s" },
      { formula: "O2", side: "left", state: "g" },
      { formula: "CO", side: "right", state: "g", studentEntersFormula: true },
    ];
    const q = {
      question_type: "chemistry_interactive",
      max_marks: 3,
      chemistry_config: {
        kind: "balance_equation",
        template: { subtype: "symbol", species },
        answer: { kind: "balance_equation", coeffs: [2, 1, 2], species },
      },
    };
    const key = { key_type: "chemistry", key_payload: q.chemistry_config.answer };
    assert.equal(
      markChemistryResponse(
        q,
        { kind: "balance_equation", coeffs: [2, 1, 2], formulas: ["", "", "CO"], states: ["s", "g", "g"] },
        key,
        [],
        null
      ).total,
      3
    );
    const co = markChemistryResponse(
      q,
      { kind: "balance_equation", coeffs: [2, 1, 2], formulas: ["", "", "Co"], states: ["s", "g", "g"] },
      key,
      [],
      null
    );
    assert.equal(co.total, 2);
    assert.match(co.feedbackPayload.chemistry.detail, /formula case/);
  });

  it("shows formulas and states on the model-answer caption", () => {
    const preset = CHEMISTRY_PRESETS.water_balance_states;
    const html = renderChemistryModelAnswerHtml(preset.answer, { template: preset.template });
    assert.match(html, /2H2\(g\)/);
    assert.match(html, /H2O\(l\)/);
  });
});
