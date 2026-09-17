import { test } from "node:test";
import assert from "node:assert/strict";
import { markResponse, splitFlashcardInsight } from "../src/evalEngine.js";

const poolKey = {
  key_type: "pick_n",
  key_payload: {
    pool: ["coal", "oil|petroleum", "gas|natural gas", "nuclear|uranium"],
    marks_per_hit: 1,
    distinct: true
  }
};

const q = { question_type: "short_text", max_marks: 2, ao1_marks: 2, ao2_marks: 0, ao3_marks: 0 };

test("pick_n — one correct answer scores 1/2", async () => {
  const result = await markResponse(q, { text: "coal" }, poolKey, []);
  assert.equal(result.total, 1);
  assert.equal(result.max, 2);
  assert.equal(result.ao.AO1, 1);
  assert.equal(result.maxAo.AO1, 2);
  assert.equal(result.missing.length, 1);
});

test("pick_n — two correct answers score full 2/2 with no missing feedback", async () => {
  const result = await markResponse(q, { text: "coal and oil" }, poolKey, []);
  assert.equal(result.total, 2);
  assert.equal(result.ao.AO1, 2);
  assert.equal(result.missing.length, 0);
  assert.equal(result.quality, 5);
});

test("pick_n — synonyms count as a match", async () => {
  const result = await markResponse(q, { text: "petroleum, uranium" }, poolKey, []);
  assert.equal(result.total, 2);
});

test("pick_n — never exceeds max marks even if all pool items named", async () => {
  const result = await markResponse(q, { text: "coal, oil, gas, nuclear" }, poolKey, []);
  assert.equal(result.total, 2);
  assert.equal(result.ao.AO1, 2);
  assert.equal(result.maxAo.AO1, 2);
});

test("pick_n — no correct answers scores 0 with acceptable-answer hint", async () => {
  const result = await markResponse(q, { text: "wind and solar" }, poolKey, []);
  assert.equal(result.total, 0);
  assert.equal(result.quality, 0);
  assert.equal(result.missing.length, 1);
  assert.match(result.missing[0].text, /Acceptable answers include/);
  assert.match(result.missing[0].flashcard_text, /coal/i);
  assert.match(result.missing[0].flashcard_text, /oil \/ petroleum/i);
  assert.doesNotMatch(result.missing[0].flashcard_text, /Give 2 more correct responses/);
  assert.doesNotMatch(result.missing[0].flashcard_text, /Acceptable answers include/);
});

test("pick_n — flashcard_text shows full pool including already-matched answers", async () => {
  const result = await markResponse(q, { text: "coal" }, poolKey, []);
  assert.equal(result.total, 1);
  assert.match(result.missing[0].text, /Acceptable answers include/);
  assert.match(result.missing[0].text, /You correctly named 1/);
  assert.doesNotMatch(result.missing[0].text, /\bcoal\b/i); // practice tip: still-needed only
  assert.match(result.missing[0].flashcard_text, /\bcoal\b/i); // revision: full pool
  assert.match(result.missing[0].flashcard_text, /oil \/ petroleum/i);
  assert.match(result.missing[0].flashcard_text, /nuclear \/ uranium/i);
  assert.doesNotMatch(result.missing[0].flashcard_text, /You correctly named/);
});

test("pick_n — two-part concept pool keeps both terms on flashcard after partial credit", async () => {
  const key = {
    key_type: "pick_n",
    key_payload: { pool: ["positive|+", "ions"], marks_per_hit: 1, distinct: true }
  };
  const q2 = { question_type: "short_text", max_marks: 2, ao1_marks: 2, ao2_marks: 0, ao3_marks: 0 };
  const result = await markResponse(q2, { text: "ions" }, key, []);
  assert.equal(result.total, 1);
  assert.match(result.missing[0].flashcard_text, /positive/i);
  assert.match(result.missing[0].flashcard_text, /ions/i);
});

test("pick_n — legacy progress-only flashcard recovers answers from practice text", () => {
  const split = splitFlashcardInsight({
    flashcard_text: "You correctly named 1. Give 1 more correct response for full marks.",
    text: "You correctly named 1. Give 1 more correct response for full marks. Acceptable answers include: ions / positive ions / cations."
  });
  assert.match(split.answer, /ions/i);
  assert.doesNotMatch(split.answer, /You correctly named/);
  assert.equal(split.explanation, "");
});

test("pick_n — marks_per_hit > 1 caps at max marks", async () => {
  const key = {
    key_type: "pick_n",
    key_payload: { pool: ["a", "b", "c"], marks_per_hit: 2 }
  };
  const q3 = { question_type: "short_text", max_marks: 3, ao1_marks: 3, ao2_marks: 0, ao3_marks: 0 };
  // one hit → 2 marks; two hits → capped at 3
  assert.equal((await markResponse(q3, { text: "a" }, key, [])).total, 2);
  assert.equal((await markResponse(q3, { text: "a b" }, key, [])).total, 3);
});
