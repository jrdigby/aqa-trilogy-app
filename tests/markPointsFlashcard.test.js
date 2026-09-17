import { test } from "node:test";
import assert from "node:assert/strict";
import {
  markResponse,
  buildMarkPointsFlashcardSteps,
  insightsFromAnswerList,
  splitFlashcardInsight,
} from "../src/evalEngine.js";

const key = {
  key_type: "keywords",
  key_payload: { required: [], optional: [], min_optional: 0 }
};

const q = {
  question_type: "short_text",
  max_marks: 2,
  ao1_marks: 2,
  ao2_marks: 0,
  ao3_marks: 0
};

const markPoints = [
  {
    ao: "AO1",
    max_marks: 1,
    point_text: "Salt",
    feedback_if_missing: "The reaction between a metal and dilute acid produces a salt and hydrogen"
  },
  {
    ao: "AO1",
    max_marks: 1,
    point_text: "hydrogen",
    feedback_if_missing: "Hydrogen is always produced when a metal reacts with a dilute acid"
  }
];

test("checkpoint flashcard_steps lists each mark point after partial credit", async () => {
  const result = await markResponse(q, { text: "salt" }, key, markPoints);
  assert.equal(result.total, 1);
  assert.equal(result.missing.length, 1);
  assert.match(result.missing[0].text, /Hydrogen is always produced/i);
  assert.equal(result.missing[0].flashcard_text, undefined);
  assert.equal(result.feedbackPayload.flashcard_steps.length, 2);
  assert.match(result.feedbackPayload.flashcard_steps[0].answer, /Salt/i);
  assert.match(result.feedbackPayload.flashcard_steps[1].answer, /Hydrogen/i);
});

test("checkpoint flashcard_steps lists each mark point when none earned", async () => {
  const result = await markResponse(q, { text: "water" }, key, markPoints);
  assert.equal(result.total, 0);
  assert.equal(result.missing.length, 2);
  assert.equal(result.feedbackPayload.flashcard_steps.length, 2);
});

test("buildMarkPointsFlashcardSteps returns one bullet per checkpoint", () => {
  const steps = buildMarkPointsFlashcardSteps(markPoints);
  assert.equal(steps.length, 2);
  assert.match(steps[0].answer, /Salt/i);
  assert.match(steps[1].answer, /Hydrogen/i);
  assert.equal(steps[0].explanation, "");
});

test("insightsFromAnswerList expands legacy combined flashcard backs", () => {
  const parts = insightsFromAnswerList("Hydrogen, Salt.");
  assert.equal(parts.length, 2);
  assert.match(parts[0].answer, /Hydrogen/i);
  assert.match(parts[1].answer, /Salt/i);
  assert.equal(parts[0].explanation, "");
});

test("legacy combined flashcard with point_text does not hide sibling answers", () => {
  // Old payload: only missed point_text, combined full scheme in flashcard_text
  const split = splitFlashcardInsight({
    point_text: "hydrogen",
    flashcard_text: "Hydrogen, Salt.",
    text: "Hydrogen is always produced when a metal reacts with a dilute acid"
  });
  // splitFlashcardInsight alone still prefers point_text; UI expands via insightsFromAnswerList
  const expanded = insightsFromAnswerList("Hydrogen, Salt.");
  assert.equal(expanded.length, 2);
  assert.ok(expanded.every((p) => !p.explanation));
  assert.match(split.answer, /Hydrogen/i);
});
