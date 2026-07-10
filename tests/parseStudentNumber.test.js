import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseStudentNumber,
  isValidStudentNumber,
  isStandardFormPresentation,
  promptRequiresStandardForm,
  formatNumberLatexPreview,
  studentNumberValue,
  renderStandardFormInputHelper
} from "../src/parseStudentNumber.js";
import { countSigFigs } from "../src/sigFigs.js";

test("parseStudentNumber — plain decimals", () => {
  assert.equal(studentNumberValue("4500"), 4500);
  assert.equal(studentNumberValue("-12.5"), -12.5);
  assert.equal(studentNumberValue("1,200"), 1200);
});

test("parseStudentNumber — calculator e-notation", () => {
  assert.equal(studentNumberValue("3.2e8"), 320000000);
  assert.equal(studentNumberValue("3.2E+8"), 320000000);
  assert.equal(studentNumberValue("-2.5e-3"), -0.0025);
});

test("parseStudentNumber — UK standard form variants", () => {
  assert.equal(studentNumberValue("3.2 × 10^8"), 320000000);
  assert.equal(studentNumberValue("3.2x10^8"), 320000000);
  assert.equal(studentNumberValue("3.2×10⁸"), 320000000);
  assert.equal(studentNumberValue("4.5×10³"), 4500);
});

test("parseStudentNumber — rejects invalid input", () => {
  assert.equal(parseStudentNumber("3.2 × 10^").valid, false);
  assert.equal(parseStudentNumber("abc").valid, false);
  assert.equal(isValidStudentNumber(""), false);
});

test("isStandardFormPresentation — GCSE mantissa rules", () => {
  assert.equal(isStandardFormPresentation("3.2×10⁸"), true);
  assert.equal(isStandardFormPresentation("3.2e8"), false);
  assert.equal(isStandardFormPresentation("320000000"), false);
  assert.equal(isStandardFormPresentation("10×10^5"), false);
});

test("promptRequiresStandardForm", () => {
  assert.equal(promptRequiresStandardForm("Give your answer in standard form."), true);
  assert.equal(promptRequiresStandardForm("Calculate the speed."), false);
});

test("formatNumberLatexPreview", () => {
  assert.equal(formatNumberLatexPreview("3.2×10⁸"), "3.2 \\times 10^{8}");
  assert.equal(formatNumberLatexPreview("3.2e8"), "3.2 \\times 10^{8}");
  assert.equal(formatNumberLatexPreview("4500"), "4500");
});

test("countSigFigs — standard form mantissa", () => {
  assert.equal(countSigFigs("2.30×10^4"), 3);
  assert.equal(countSigFigs("2.30e4"), 3);
});

test("renderStandardFormInputHelper includes typing pattern and required note", () => {
  const general = renderStandardFormInputHelper();
  assert.match(general, /3\.2x10\^6/);
  assert.match(general, /x10\^/);
  assert.match(general, /How to type numbers/);

  const required = renderStandardFormInputHelper({ requiresStandardForm: true });
  assert.match(required, /requires standard form/);
  assert.match(required, /3\.34e5/);
  assert.match(required, /open/);
});
