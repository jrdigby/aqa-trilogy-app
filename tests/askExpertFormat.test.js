import test from "node:test";
import assert from "node:assert/strict";
import { formatExpertStudentAnswer, prettyScientificNotation } from "../src/askExpert.js";

test("prettyScientificNotation rewrites e and x10 forms", () => {
  assert.equal(prettyScientificNotation("3.2e6"), "3.2 × 10^6");
  assert.equal(prettyScientificNotation("3.2E+6"), "3.2 × 10^6");
  assert.equal(prettyScientificNotation("4.1e-3"), "4.1 × 10^-3");
  assert.equal(prettyScientificNotation("3.2 x 10^6"), "3.2 × 10^6");
  assert.equal(prettyScientificNotation("3.2×10^6"), "3.2 × 10^6");
});

test("numeric expert answer lists working then the typed final answer", () => {
  const text = formatExpertStudentAnswer({
    question_type: "numeric",
    student_response_summary: '{"type":"numeric","steps":{"calculate":3200000}}',
    client_response: {
      type: "numeric",
      unit: "J",
      value: 3200000,
      steps: {
        equation_select: "E = P t",
        substitution: { mode: "free_text", text: "2000 x 1600" },
        calculate: 3200000
      },
      stepRaw: {
        substitution: "2000 x 1600",
        calculate: "3.2x10^6"
      }
    }
  });

  assert.equal(
    text,
    [
      "Equation: E = P t",
      "Substitution: 2000 x 1600",
      "Final answer: 3.2 × 10^6 J"
    ].join("\n")
  );
});

test("numeric substitution text is not treated as scientific notation", () => {
  const text = formatExpertStudentAnswer({
    client_response: {
      type: "numeric",
      unit: "J",
      stepRaw: {
        equation_select: "E = Pt",
        substitution: "2000 × 120",
        calculate: "240000"
      }
    }
  });
  assert.match(text, /Equation: E = Pt/);
  assert.match(text, /Substitution: 2000 × 120/);
  assert.match(text, /Final answer: 240000 J/);
});

test("falls back to stored summary JSON when client_response is missing", () => {
  const text = formatExpertStudentAnswer({
    student_response_summary: JSON.stringify({
      type: "numeric",
      unit: "N",
      stepRaw: { calculate: "3.2e6" },
      value: 3200000
    })
  });
  assert.equal(text, "Final answer: 3.2 × 10^6 N");
});

test("mcq and short text stay readable", () => {
  assert.equal(
    formatExpertStudentAnswer({
      client_response: { type: "mcq", answer: "Mitochondria" }
    }),
    "Selected: Mitochondria"
  );
  assert.equal(
    formatExpertStudentAnswer({
      client_response: { type: "short_text", text: "The current increases." }
    }),
    "The current increases."
  );
});

test("interactive answers show a few fields, not the raw object", () => {
  const text = formatExpertStudentAnswer({
    client_response: {
      type: "circuit",
      kind: "identify",
      selectedType: "lamp",
      x: 12,
      y: 40
    }
  });
  assert.match(text, /Circuit \(identify\)/);
  assert.match(text, /Selected: lamp/);
  assert.doesNotMatch(text, /"x"/);
});
