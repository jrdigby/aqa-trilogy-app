import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SYLLABUS_BATCH_RECIPES,
  SYLLABUS_BATCH_QUESTIONS_PER_SPEC
} from "../src/batchQuestionRecipes.js";

test("SYLLABUS_BATCH_RECIPES — includes recall short text and extended 4-mark bands", () => {
  const shortRecall = SYLLABUS_BATCH_RECIPES.find(
    (r) => r.question_type === "short_text" && r.demand_level === "standard_45"
  );
  assert.ok(shortRecall);
  assert.equal(shortRecall.max_marks, 1);
  assert.equal(shortRecall.count, 3);

  const ext67Four = SYLLABUS_BATCH_RECIPES.filter(
    (r) => r.question_type === "extended_response"
      && r.demand_level === "standard_67"
      && r.max_marks === 4
  );
  assert.equal(ext67Four.length, 1);
  assert.equal(ext67Four[0].count, 2);

  const ext89Four = SYLLABUS_BATCH_RECIPES.find(
    (r) => r.question_type === "extended_response"
      && r.demand_level === "high_89"
      && r.max_marks === 4
  );
  assert.ok(ext89Four);
  assert.equal(ext89Four.count, 2);
});

test("SYLLABUS_BATCH_QUESTIONS_PER_SPEC totals 19", () => {
  assert.equal(SYLLABUS_BATCH_QUESTIONS_PER_SPEC, 19);
});
