import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveMcqWrongFeedback,
  markResponse,
  getMcqTargetAo,
  MCQ_FLASHCARD_ADDED_MSG,
  flashcardInsightFromMissing
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

test("wrong + per-option only → one specific block", () => {
  const missing = resolveMcqWrongFeedback("nucleus", key, [], "mitochondria");
  assert.equal(missing.length, 1);
  assert.ok(missing[0].text.includes("nucleus controls the cell"));
  assert.ok(missing[0].text.includes(MCQ_FLASHCARD_ADDED_MSG));
  assert.equal(missing[0].flashcard_text, missing[0].text.replace(` ${MCQ_FLASHCARD_ADDED_MSG}`, ""));
});

test("wrong + generic only → one generic block", () => {
  const missing = resolveMcqWrongFeedback("cell wall", { key_type: "mcq", key_payload: { correct: "mitochondria" } }, markPointsGeneric, "mitochondria");
  assert.equal(missing.length, 1);
  assert.ok(missing[0].text.includes("Review cell organelles"));
  assert.equal(missing[0].flashcard_text, "Review cell organelles in your textbook.");
});

test("wrong + both → two blocks, specific first", () => {
  const missing = resolveMcqWrongFeedback("nucleus", key, markPointsGeneric, "mitochondria");
  assert.equal(missing.length, 2);
  assert.ok(missing[0].text.includes("nucleus controls the cell"));
  assert.ok(missing[1].text.includes("Review cell organelles"));
  assert.ok(!missing[1].text.includes(MCQ_FLASHCARD_ADDED_MSG));
  assert.equal(
    missing[0].flashcard_text,
    "The nucleus controls the cell; it does not release energy.\n\nReview cell organelles in your textbook."
  );
});

test("wrong + neither → default correct-answer message", () => {
  const missing = resolveMcqWrongFeedback("cell wall", { key_type: "mcq", key_payload: { correct: "mitochondria" } }, [], "mitochondria");
  assert.equal(missing.length, 1);
  assert.ok(missing[0].text.includes('The correct answer is "mitochondria"'));
});

test("correct → no missing entries via markResponse", () => {
  const q = { question_type: "mcq", max_marks: 1 };
  const result = markResponse(q, { answer: "mitochondria" }, key, markPointsGeneric);
  assert.equal(result.total, 1);
  assert.equal(result.missing.length, 0);
});

test("flashcard text combines specific + generic without UI suffix noise", () => {
  const missing = resolveMcqWrongFeedback("nucleus", key, markPointsGeneric, "mitochondria");
  const insight = flashcardInsightFromMissing(missing[0]);
  assert.equal(insight, missing[0].flashcard_text);
  assert.ok(!insight.includes(MCQ_FLASHCARD_ADDED_MSG));
  assert.ok(insight.includes("nucleus controls the cell"));
  assert.ok(insight.includes("Review cell organelles"));
});

test("markResponse awards AO2 for calculation MCQ when ao2_marks is set", () => {
  const q = { question_type: "mcq", max_marks: 1, ao1_marks: 0, ao2_marks: 1, ao3_marks: 0 };
  const result = markResponse(q, { answer: "mitochondria" }, key, []);
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
