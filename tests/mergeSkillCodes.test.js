import test from "node:test";
import assert from "node:assert/strict";
import { mergeSkillCodesForQuestion } from "../src/adminSkills.js";

test("mergeSkillCodesForQuestion adds newly checked codes", () => {
  const merged = mergeSkillCodesForQuestion(
    ["WS1.2"],
    ["WS1.2"],
    ["WS1.2", "MS1a"]
  );
  assert.deepEqual([...merged].sort(), ["MS1a", "WS1.2"]);
});

test("mergeSkillCodesForQuestion removes unchecked baseline codes", () => {
  const merged = mergeSkillCodesForQuestion(
    ["WS1.2", "MS1a"],
    ["WS1.2", "MS1a"],
    ["WS1.2"]
  );
  assert.deepEqual(merged, ["WS1.2"]);
});

test("mergeSkillCodesForQuestion applies checked union tags onto questions that lacked them", () => {
  // Baseline union includes MS1a from another question; leave it checked → this Q gains MS1a.
  const merged = mergeSkillCodesForQuestion(
    ["WS1.2"],
    ["WS1.2", "MS1a"],
    ["WS1.2", "MS1a"]
  );
  assert.deepEqual([...merged].sort(), ["MS1a", "WS1.2"]);
});

test("mergeSkillCodesForQuestion removes a baseline code that user unchecked", () => {
  const merged = mergeSkillCodesForQuestion(
    ["WS1.2", "MS1a"],
    ["WS1.2", "MS1a"],
    ["MS1a"]
  );
  assert.deepEqual(merged, ["MS1a"]);
});
