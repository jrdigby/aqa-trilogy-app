/**
 * Unit tests for chemistry formula / Mr helpers.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseFormula,
  relativeFormulaMass,
  elementMassInCompound,
  percentByMass,
  distractorFormulaMasses,
  formatArList,
  formatArStem,
  formatMrStem,
  arValuesForFormula,
  molesFromMass,
  massFromMoles,
  scaleByMoleRatio,
  identifyLimitingReactant,
  AVOGADRO_CONSTANT,
  particleKind,
  particlesFromMoles,
  molesFromParticles
} from "../src/chemistryFormula.js";

describe("parseFormula", () => {
  it("parses simple and multi-atom formulas", () => {
    assert.deepEqual(parseFormula("H2O"), { H: 2, O: 1 });
    assert.deepEqual(parseFormula("CaCO3"), { Ca: 1, C: 1, O: 3 });
    assert.deepEqual(parseFormula("NH4NO3"), { N: 2, H: 4, O: 3 });
    assert.deepEqual(parseFormula("Na2SO4"), { Na: 2, S: 1, O: 4 });
  });

  it("rejects brackets", () => {
    assert.throws(() => parseFormula("Al2(SO4)3"), /Bracketed/);
  });

  it("rejects unknown elements", () => {
    assert.throws(() => parseFormula("Xx2"), /Unknown element/);
  });
});

describe("relativeFormulaMass", () => {
  it("computes Mr for common compounds", () => {
    assert.equal(relativeFormulaMass("H2O"), 18);
    assert.equal(relativeFormulaMass("CO2"), 44);
    assert.equal(relativeFormulaMass("NaCl"), 58.5);
    assert.equal(relativeFormulaMass("NH4NO3"), 80);
  });
});

describe("elementMassInCompound and percentByMass", () => {
  it("matches NH4NO3 oxygen example", () => {
    assert.equal(elementMassInCompound("NH4NO3", "O"), 48);
    assert.equal(percentByMass("NH4NO3", "O", 80), 60);
  });
});

describe("distractorFormulaMasses", () => {
  it("returns wrong values not equal to correct Mr", () => {
    const correct = relativeFormulaMass("Na2O");
    const distractors = distractorFormulaMasses("Na2O", { count: 3 });
    assert.equal(distractors.length, 3);
    for (const d of distractors) {
      assert.notEqual(d, correct);
    }
  });
});

describe("ar display helpers", () => {
  it("formats Ar list", () => {
    const map = arValuesForFormula("H2O");
    assert.match(formatArList(map), /H = 1/);
    assert.match(formatArList(map), /O = 16/);
  });

  it("formats Ar and Mr stem lines", () => {
    assert.equal(
      formatArStem({ Mg: 24 }),
      "Relative atomic mass (Ar):     Mg = 24"
    );
    assert.equal(
      formatMrStem({ formulaDisplay: "MgCl2", mr: 95 }),
      "Relative formula mass (Mr):    MgCl2 = 95"
    );
  });
});

describe("mole / stoich helpers", () => {
  it("round-trips mass and moles", () => {
    const mr = relativeFormulaMass("H2O");
    const n = molesFromMass(36, mr);
    assert.equal(n, 2);
    assert.equal(massFromMoles(n, mr), 36);
  });

  it("scales by mole ratio", () => {
    assert.equal(scaleByMoleRatio(0.5, 2, 1), 0.25);
    assert.equal(scaleByMoleRatio(1, 1, 2), 2);
  });

  it("identifies the limiting reactant", () => {
    assert.equal(
      identifyLimitingReactant([
        { id: "Mg", moles: 0.2, coeff: 2 },
        { id: "O2", moles: 0.2, coeff: 1 }
      ]),
      "Mg"
    );
  });
});

describe("Avogadro helpers", () => {
  it("classifies atoms, molecules, and ions", () => {
    assert.equal(particleKind("Mg").noun, "atoms");
    assert.equal(particleKind("O2").noun, "molecules");
    assert.equal(particleKind("H2O").noun, "molecules");
    assert.equal(particleKind("NaCl").noun, "ions");
    assert.equal(particleKind("NH4NO3").noun, "ions");
  });

  it("converts moles and particles with 6.02e23", () => {
    assert.equal(AVOGADRO_CONSTANT, 6.02e23);
    assert.equal(particlesFromMoles(0.5), 3.01e23);
    assert.equal(molesFromParticles(3.01e23), 0.5);
  });
});
