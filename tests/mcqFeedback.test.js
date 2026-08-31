import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveMcqWrongFeedback,
  markResponse,
  getMcqTargetAo,
  MCQ_FLASHCARD_ADDED_MSG,
  flashcardInsightFromMissing,
  splitFlashcardInsight,
  formatMcqAnswerWithLetter
} from "../src/evalEngine.js";

const key = {
  key_type: "mcq",
  key_payload: {
    correct: "mitochondria",
    option_feedback: {
      nucleus: "The nucleus controls the cell; it does not release energy."
    }
  }
};

const markPointsGeneric = [
  { ao: "AO1", feedback_if_missing: "Review cell organelles in your textbook." }
];

const cellOptions = ["cell wall", "nucleus", "mitochondria", "ribosome"];

test("wrong + per-option only → practice tip kept, flashcard is answer only", () => {
  const missing = resolveMcqWrongFeedback("nucleus", key, [], "mitochondria", null, "AO1", cellOptions);
  assert.equal(missing.length, 1);
  assert.ok(missing[0].text.includes("nucleus controls the cell"));
  assert.ok(missing[0].text.includes(MCQ_FLASHCARD_ADDED_MSG));
  assert.equal(missing[0].flashcard_text, "C. Mitochondria.");
  assert.equal(missing[0].answer_label, "C. Mitochondria.");
});

test("wrong + generic only → one generic block", () => {
  const missing = resolveMcqWrongFeedback("cell wall", { key_type: "mcq", key_payload: { correct: "mitochondria" } }, markPointsGeneric, "mitochondria");
  assert.equal(missing.length, 1);
  assert.ok(missing[0].text.includes("Review cell organelles"));
  assert.equal(
    missing[0].flashcard_text,
    "Mitochondria.\n\nReview cell organelles in your textbook."
  );
});

test("wrong + both → practice shows both; flashcard uses generic only", () => {
  const missing = resolveMcqWrongFeedback("nucleus", key, markPointsGeneric, "mitochondria");
  assert.equal(missing.length, 2);
  assert.ok(missing[0].text.includes("nucleus controls the cell"));
  assert.ok(missing[1].text.includes("Review cell organelles"));
  assert.ok(!missing[1].text.includes(MCQ_FLASHCARD_ADDED_MSG));
  assert.equal(
    missing[0].flashcard_text,
    "Mitochondria.\n\nReview cell organelles in your textbook."
  );
});

test("wrong + neither → lettered answer only on flashcard", () => {
  const opts = ["Alpha", "Beta", "Gamma", "Neutron"];
  const missing = resolveMcqWrongFeedback(
    "Alpha",
    { key_type: "mcq", key_payload: { correct: "Gamma" } },
    [],
    "Gamma",
    null,
    "AO1",
    opts
  );
  assert.equal(missing.length, 1);
  assert.ok(missing[0].text.includes('The correct answer is "Gamma"'));
  assert.equal(missing[0].flashcard_text, "C. Gamma.");
  assert.equal(missing[0].answer_label, "C. Gamma.");
});

test("wrong + neither → mhchem correct answer is not wrapped in quotes", () => {
  const correct = "$\\ce{NaCl}$";
  const missing = resolveMcqWrongFeedback(
    "$\\ce{Na2Cl}$",
    { key_type: "mcq", key_payload: { correct } },
    [],
    correct
  );
  assert.equal(missing.length, 1);
  assert.ok(missing[0].text.includes("The correct answer is $\\ce{NaCl}$."));
  assert.ok(!missing[0].text.includes('"$\\ce{NaCl}$"'));
  assert.equal(missing[0].flashcard_text, "$\\ce{NaCl}$");
});

test("correct → no missing entries via markResponse", async () => {
  const q = { question_type: "mcq", max_marks: 1 };
  const result = await markResponse(q, { answer: "mitochondria" }, key, markPointsGeneric);
  assert.equal(result.total, 1);
  assert.equal(result.missing.length, 0);
});

test("flashcard text uses generic tip and omits wrong-option tip", () => {
  const missing = resolveMcqWrongFeedback("nucleus", key, markPointsGeneric, "mitochondria");
  const insight = flashcardInsightFromMissing(missing[0]);
  assert.equal(insight, missing[0].flashcard_text);
  assert.ok(!insight.includes(MCQ_FLASHCARD_ADDED_MSG));
  assert.ok(!insight.includes("nucleus controls the cell"));
  assert.ok(insight.includes("Review cell organelles"));
  assert.ok(insight.includes("Mitochondria"));
});

test("splitFlashcardInsight keeps answer bold-ready and explanation separate", () => {
  const split = splitFlashcardInsight({
    point_text: "directly proportional",
    flashcard_text:
      "directly proportional\n\nThis is the term for a straight line graph that goes through the origin",
    text: "This is the term for a straight line graph that goes through the origin",
  });
  assert.equal(split.answer, "Directly proportional.");
  assert.equal(
    split.explanation,
    "This is the term for a straight line graph that goes through the origin"
  );
});

test("splitFlashcardInsight ignores practice wrong-option tip when flashcard_text is answer-only", () => {
  const opts = ["Light emitting diode", "Thermistor", "Light dependent resistor", "Diode"];
  const split = splitFlashcardInsight(
    {
      answer: "Light dependent resistor",
      answer_label: "C. Light dependent resistor",
      flashcard_text: "C. Light dependent resistor",
      text: '"Therm" is the prefix for "Thermometer" - meaning a thermistor depends on temperature not light. This question has been added to your flashcard list.',
    },
    opts
  );
  assert.equal(split.answer, "C. Light dependent resistor.");
  assert.equal(split.explanation, "");
  assert.ok(!split.text.toLowerCase().includes("thermistor"));
});

test("formatMcqAnswerWithLetter prefixes matching option", () => {
  assert.equal(
    formatMcqAnswerWithLetter(["Light emitting diode", "Thermistor", "Light dependent resistor", "Diode"], "Light dependent resistor"),
    "C. Light dependent resistor."
  );
});

test("markResponse awards AO2 for calculation MCQ when ao2_marks is set", async () => {
  const q = { question_type: "mcq", max_marks: 1, ao1_marks: 0, ao2_marks: 1, ao3_marks: 0 };
  const result = await markResponse(q, { answer: "mitochondria" }, key, []);
  assert.equal(result.total, 1);
  assert.equal(result.ao.AO1, 0);
  assert.equal(result.ao.AO2, 1);
  assert.equal(result.maxAo.AO2, 1);
});

test("getMcqTargetAo prefers question metadata over mark point AO", () => {
  assert.equal(
    getMcqTargetAo({ ao1_marks: 0, ao2_marks: 1, ao3_marks: 0 }, [{ ao: "AO1" }]),
    "AO2"
  );
});
