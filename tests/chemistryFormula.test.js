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
  arValuesForFormula
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
});
