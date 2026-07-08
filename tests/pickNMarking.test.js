import { test } from "node:test";
import assert from "node:assert/strict";
import { markResponse } from "../src/evalEngine.js";

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
