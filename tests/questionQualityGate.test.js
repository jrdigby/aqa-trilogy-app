import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateMcqQuality,
  evaluateExtendedQuality,
  isNearDuplicatePrompt
} from "../src/questionQualityGate.js";

test("evaluateMcqQuality — accepts valid MCQ", () => {
  const result = evaluateMcqQuality({
    prompt: "State which statement about ionic bonding is correct?",
    options: ["A correct", "Wrong one", "Wrong two", "Wrong three"],
    correct: "A correct",
    option_feedback: {
      "Wrong one": "Ionic bonding transfers electrons.",
      "Wrong two": "Sharing is covalent bonding.",
      "Wrong three": "Metals form metallic bonds."
    }
  });
  assert.equal(result.pass, true);
});

test("evaluateMcqQuality — rejects filler distractor", () => {
  const result = evaluateMcqQuality({
    prompt: "State which statement about bonding is correct for this topic?",
    options: [
      "Correct answer here",
      "Bonding — check the specification point carefully (distractor 1)",
      "Wrong two",
      "Wrong three"
    ],
    correct: "Correct answer here",
    option_feedback: {
      "Bonding — check the specification point carefully (distractor 1)": "No",
      "Wrong two": "No",
      "Wrong three": "No"
    }
  });
  assert.equal(result.pass, false);
  assert.ok(result.reasons.some((r) => /filler/i.test(r)));
});

test("evaluateExtendedQuality — requires rubric fields", () => {
  const fail = evaluateExtendedQuality({
    prompt: "Explain how ionic bonding forms between a metal and a non-metal.",
    max_marks: 4,
    key_payload: {
      key_scientific_points: "Metal atoms lose electrons\nNon-metal atoms gain electrons",
      marking_guidelines: "Award marks for correct sequence.",
      level_descriptors: {
        "Level 1 (1-2 marks)": "Limited",
        "Level 2 (3-4 marks)": "Complete"
      }
    }
  });
  assert.equal(fail.pass, true);

  const bad = evaluateExtendedQuality({
    prompt: "Explain bonding.",
    max_marks: 4,
    key_payload: { key_scientific_points: "One point only" }
  });
  assert.equal(bad.pass, false);
});

test("isNearDuplicatePrompt — detects high overlap", () => {
  assert.equal(
    isNearDuplicatePrompt(
      "State which statement about ionic bonding in sodium chloride is correct?",
      [{ prompt: "State which statement about ionic bonding in sodium chloride is correct?" }]
    ),
    true
  );
  assert.equal(
    isNearDuplicatePrompt(
      "State which statement correctly describes: Ionic bonding occurs in compounds formed from metals combined with non-metals?",
      [{ prompt: "State which statement correctly describes: Metals consist of giant structures of atoms with delocalised electrons?", correct: "Metals consist of giant structures of atoms with delocalised electrons." }],
      "Ionic bonding occurs in compounds formed from metals combined with non-metals."
    ),
    false
  );
});
