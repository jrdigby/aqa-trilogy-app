import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAiQuestions,
  validateDraftForCommit,
  expandRecipes,
  demandRecipeLabel,
  syncShortTextDraftFromPreviewEdits
} from "../src/aiQuestionDraft.js";

test("normalizeAiQuestions — MCQ with option feedback", () => {
  const [draft] = normalizeAiQuestions([{
    question_type: "mcq",
    demand_level: "low",
    command_word: "state",
    prompt: "What is current?",
    options: ["A", "B", "C", "D"],
    correct: "A",
    option_feedback: [
      { option: "B", feedback: "B is wrong because…" }
    ],
    overall_feedback: "Review current.",
    ao1_marks: 1,
    ao2_marks: 0,
    ao3_marks: 0
  }], { tier: "both" });

  assert.equal(draft.question.question_type, "mcq");
  assert.equal(draft.answer_key.key_payload.correct, "A");
  assert.equal(draft.answer_key.key_payload.option_feedback.B, "B is wrong because…");
  assert.equal(draft.mark_points[0].feedback_if_missing, "Review current.");
});

test("normalizeAiQuestions — short text mark points", () => {
  const [draft] = normalizeAiQuestions([{
    question_type: "short_text",
    demand_level: "standard",
    prompt: "Describe resistance.",
    max_marks: 2,
    ao1_marks: 1,
    ao2_marks: 1,
    mark_points: [
      { ao: "AO1", keywords: "opposes|resists", feedback: "Think opposition." },
      { ao: "AO2", keywords: "current", feedback: "Link to flow." }
    ]
  }]);

  assert.equal(draft.question.max_marks, 2);
  assert.equal(draft.mark_points.length, 2);
  assert.equal(draft.mark_points[0].point_text, "opposes|resists");
  assert.equal(draft.answer_key.key_type, "keywords");
});

test("validateDraftForCommit — short text requires mark points", () => {
  const [draft] = normalizeAiQuestions([{
    question_type: "short_text",
    prompt: "Explain.",
    max_marks: 2,
    ao1_marks: 1,
    ao2_marks: 1,
    mark_points: []
  }]);
  assert.match(validateDraftForCommit(draft, 0), /mark checkpoint/);
});

test("expandRecipes — flattens counts", () => {
  const expanded = expandRecipes([
    { question_type: "mcq", demand_level: "low", count: 2 },
    { question_type: "short_text", demand_level: "standard", count: 1 }
  ]);
  assert.equal(expanded.length, 3);
  assert.equal(expanded[2].question_type, "short_text");
});

test("demandRecipeLabel — includes type", () => {
  assert.equal(
    demandRecipeLabel({ question_type: "mcq", demand_level: "low" }),
    "MCQ · Low"
  );
});

test("syncShortTextDraftFromPreviewEdits — updates mark points", () => {
  const [draft] = normalizeAiQuestions([{
    question_type: "short_text",
    prompt: "Old",
    max_marks: 2,
    ao1_marks: 1,
    ao2_marks: 1,
    mark_points: [
      { ao: "AO1", keywords: "a", feedback: "fb1" },
      { ao: "AO2", keywords: "b", feedback: "fb2" }
    ]
  }]);

  const updated = syncShortTextDraftFromPreviewEdits(draft, {
    prompt: "New prompt",
    mark_points: [
      { ao: "AO1", point_text: "x|y", feedback_if_missing: "hint", image_url: "https://x.png" },
      { ao: "AO2", point_text: "z", feedback_if_missing: "hint2" }
    ]
  });

  assert.equal(updated.question.prompt, "New prompt");
  assert.equal(updated.mark_points[0].point_text, "x|y");
  assert.equal(updated.mark_points[0].image_url, "https://x.png");
});
