import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAiQuestions,
  validateDraftForCommit,
  expandRecipes,
  demandRecipeLabel,
  syncShortTextDraftFromPreviewEdits,
  syncExtendedDraftFromPreviewEdits,
  computeGapFillRecipes,
  splitTemplateAndAiRecipes,
  draftsToAvoidQuestions,
  recipeKey,
  parseImportedDraftBundle,
  prepareImportedDrafts,
  LEVEL_3_KEY,
  LEVEL_2_KEY,
  LEVEL_1_KEY
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

test("normalizeAiQuestions — short text 1 mark", () => {
  const [draft] = normalizeAiQuestions([{
    question_type: "short_text",
    demand_level: "low",
    prompt: "Name one contact force.",
    max_marks: 1,
    ao1_marks: 1,
    ao2_marks: 0,
    ao3_marks: 0,
    mark_points: [
      { ao: "AO1", keywords: "friction|air resistance", feedback: "Name a contact force." }
    ]
  }]);

  assert.equal(draft.question.max_marks, 1);
  assert.equal(draft.mark_points.length, 1);
  assert.equal(validateDraftForCommit(draft, 0), null);
});

test("normalizeAiQuestions — extended response ai_rubric", () => {
  const [draft] = normalizeAiQuestions([{
    question_type: "extended_response",
    demand_level: "high_89",
    prompt: "Explain how contact forces act in a braking bicycle.",
    max_marks: 6,
    ao1_marks: 2,
    ao2_marks: 2,
    ao3_marks: 2,
    command_word: "explain",
    marking_guidelines: "Award marks for clear science of friction and force pairs.",
    level_3_descriptor: "Detailed linked explanation with correct force pairs.",
    level_2_descriptor: "Some correct ideas with partial links.",
    level_1_descriptor: "Simple statements with limited science."
  }]);

  assert.equal(draft.question.question_type, "extended_response");
  assert.equal(draft.question.marking_method, "ai_rubric");
  assert.equal(draft.answer_key.key_type, "ai_rubric");
  assert.equal(draft.question.max_marks, 6);
  assert.match(draft.answer_key.key_payload.marking_guidelines, /friction/);
  assert.ok(draft.answer_key.key_payload.level_descriptors[LEVEL_3_KEY]);
  assert.equal(validateDraftForCommit(draft, 0), null);
});

test("normalizeAiQuestions — extended 4-mark allows N/A level 3", () => {
  const [draft] = normalizeAiQuestions([{
    question_type: "extended_response",
    demand_level: "standard",
    prompt: "Describe contact forces on a book resting on a table.",
    max_marks: 4,
    ao1_marks: 1,
    ao2_marks: 2,
    ao3_marks: 1,
    marking_guidelines: "Look for weight and normal contact force.",
    level_3_descriptor: "N/A for 4-mark",
    level_2_descriptor: "Clear description of both forces.",
    level_1_descriptor: "Names one force only."
  }]);

  assert.equal(draft.question.max_marks, 4);
  assert.equal(
    draft.answer_key.key_payload.level_descriptors[LEVEL_3_KEY],
    "N/A for 4-mark"
  );
  assert.equal(validateDraftForCommit(draft, 0), null);
});

test("normalizeAiQuestions — extended 4-mark clears filled level 3", () => {
  const [draft] = normalizeAiQuestions([{
    question_type: "extended_response",
    demand_level: "standard",
    prompt: "Describe contact forces on a book resting on a table.",
    max_marks: 4,
    ao1_marks: 1,
    ao2_marks: 2,
    ao3_marks: 1,
    marking_guidelines: "Look for weight and normal contact force.",
    level_3_descriptor: "Detailed linked explanation spanning 5–6 marks.",
    level_2_descriptor: "Clear description of both forces.",
    level_1_descriptor: "Names one force only."
  }]);

  assert.equal(draft.question.max_marks, 4);
  assert.equal(
    draft.answer_key.key_payload.level_descriptors[LEVEL_3_KEY],
    "N/A for 4-mark"
  );
  assert.equal(validateDraftForCommit(draft, 0), null);
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

test("expandRecipes — flattens counts and max_marks", () => {
  const expanded = expandRecipes([
    { question_type: "mcq", demand_level: "low", count: 2 },
    { question_type: "short_text", demand_level: "standard", count: 1, max_marks: 1 },
    { question_type: "extended_response", demand_level: "high_89", count: 1, max_marks: 4 }
  ]);
  assert.equal(expanded.length, 4);
  assert.equal(expanded[2].question_type, "short_text");
  assert.equal(expanded[2].max_marks, 1);
  assert.equal(expanded[3].question_type, "extended_response");
  assert.equal(expanded[3].max_marks, 4);
  assert.equal(expanded[0].max_marks, undefined);
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

test("syncShortTextDraftFromPreviewEdits — resize to 1 mark", () => {
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
    max_marks: 1,
    mark_points: draft.mark_points,
    keepEmptyMarkPoints: true
  });

  assert.equal(updated.question.max_marks, 1);
  assert.equal(updated.mark_points.length, 1);
  assert.equal(updated.question.ao1_marks, 1);
  assert.equal(updated.question.ao2_marks, 0);
});

test("syncExtendedDraftFromPreviewEdits — updates rubric fields", () => {
  const [draft] = normalizeAiQuestions([{
    question_type: "extended_response",
    prompt: "Explain forces.",
    max_marks: 6,
    ao1_marks: 2,
    ao2_marks: 2,
    ao3_marks: 2,
    marking_guidelines: "Old",
    level_3_descriptor: "L3",
    level_2_descriptor: "L2",
    level_1_descriptor: "L1"
  }]);

  const updated = syncExtendedDraftFromPreviewEdits(draft, {
    demand_level: "standard_67",
    max_marks: 4,
    marking_guidelines: "New guidelines",
    level_3: "N/A for 4-mark",
    level_2: "Solid",
    level_1: "Basic"
  });

  assert.equal(updated.question.max_marks, 4);
  assert.equal(updated.question.demand_level, "standard_67");
  assert.equal(updated.answer_key.key_payload.marking_guidelines, "New guidelines");
  assert.equal(
    updated.answer_key.key_payload.level_descriptors[LEVEL_3_KEY],
    "N/A for 4-mark"
  );
  assert.equal(updated.answer_key.key_payload.level_descriptors[LEVEL_2_KEY], "Solid");
  assert.equal(updated.answer_key.key_payload.level_descriptors[LEVEL_1_KEY], "Basic");
});

test("syncExtendedDraftFromPreviewEdits — switching to 4 clears level 3 even if edit keeps it", () => {
  const [draft] = normalizeAiQuestions([{
    question_type: "extended_response",
    prompt: "Explain forces.",
    max_marks: 6,
    ao1_marks: 2,
    ao2_marks: 2,
    ao3_marks: 2,
    marking_guidelines: "Old",
    level_3_descriptor: "Full L3 band",
    level_2_descriptor: "L2",
    level_1_descriptor: "L1"
  }]);

  const updated = syncExtendedDraftFromPreviewEdits(draft, {
    max_marks: 4,
    level_3: "Still a detailed Level 3 descriptor",
    level_2: "Solid",
    level_1: "Basic"
  });

  assert.equal(updated.question.max_marks, 4);
  assert.equal(
    updated.answer_key.key_payload.level_descriptors[LEVEL_3_KEY],
    "N/A for 4-mark"
  );
});

test("demandRecipeLabel — includes type and marks", () => {
  assert.equal(
    demandRecipeLabel({ question_type: "mcq", demand_level: "low" }),
    "MCQ · Low"
  );
  assert.equal(
    demandRecipeLabel({ question_type: "short_text", demand_level: "standard", max_marks: 1 }),
    "Short text · Standard · 1 mark"
  );
  assert.equal(
    demandRecipeLabel({ question_type: "extended_response", demand_level: "high_89", max_marks: 6 }),
    "Extended · High 8–9 · 6 marks"
  );
});

test("computeGapFillRecipes — only returns missing recipe slots", () => {
  const target = expandRecipes([
    { question_type: "mcq", demand_level: "low", count: 5 }
  ]);
  const [existing] = normalizeAiQuestions([{
    question_type: "mcq",
    demand_level: "low",
    prompt: "Existing Q",
    options: ["A", "B", "C", "D"],
    correct: "A"
  }]);
  const gap = computeGapFillRecipes(target, [existing, existing, existing]);
  assert.equal(gap.length, 2);
  assert.equal(gap.every((r) => r.question_type === "mcq" && r.demand_level === "low"), true);
});

test("computeGapFillRecipes — distinguishes short text mark counts", () => {
  const target = expandRecipes([
    { question_type: "short_text", demand_level: "standard", count: 2, max_marks: 1 },
    { question_type: "short_text", demand_level: "standard", count: 1, max_marks: 2 }
  ]);
  const [oneMark] = normalizeAiQuestions([{
    question_type: "short_text",
    demand_level: "standard",
    prompt: "One mark Q",
    max_marks: 1,
    ao1_marks: 1,
    mark_points: [{ ao: "AO1", keywords: "friction", feedback: "fb" }]
  }]);
  const gap = computeGapFillRecipes(target, [oneMark]);
  assert.equal(gap.length, 2);
  assert.equal(gap.filter((r) => r.max_marks === 1).length, 1);
  assert.equal(gap.filter((r) => r.max_marks === 2).length, 1);
});

test("splitTemplateAndAiRecipes — all recipes use AI path", () => {
  const recipes = expandRecipes([
    { question_type: "mcq", demand_level: "low", count: 2 },
    { question_type: "short_text", demand_level: "standard", count: 1 }
  ]);
  const { templateRecipes, aiRecipes } = splitTemplateAndAiRecipes(recipes);
  assert.equal(templateRecipes.length, 0);
  assert.equal(aiRecipes.length, 3);
});

test("draftsToAvoidQuestions — maps preview drafts for AI avoid list", () => {
  const [draft] = normalizeAiQuestions([{
    question_type: "mcq",
    demand_level: "low",
    prompt: "What is current?",
    options: ["A", "B", "C", "D"],
    correct: "A"
  }]);
  const avoid = draftsToAvoidQuestions([draft]);
  assert.equal(avoid.length, 1);
  assert.equal(avoid[0].prompt, "What is current?");
  assert.equal(avoid[0].correct, "A");
});

test("recipeKey — includes marks for short text and extended", () => {
  assert.equal(recipeKey({ question_type: "mcq", demand_level: "low" }), "mcq|low");
  assert.equal(
    recipeKey({ question_type: "short_text", demand_level: "standard", max_marks: 1 }),
    "short_text|standard|1"
  );
  assert.equal(
    recipeKey({ question_type: "extended_response", demand_level: "high_89", max_marks: 6 }),
    "extended_response|high_89|6"
  );
});

test("parseImportedDraftBundle — reads meta and drafts", () => {
  const bundle = {
    meta: { spec_ref: "6.2.1", subject: "physics", paper: "paper1" },
    drafts: [{
      question: { question_type: "mcq", prompt: "Test?", demand_level: "low", tier: "both", max_marks: 1, ao1_marks: 1, ao2_marks: 0, ao3_marks: 0, options: ["A", "B", "C", "D"] },
      answer_key: { key_type: "mcq", key_payload: { correct: "A" } },
      mark_points: []
    }]
  };
  const parsed = parseImportedDraftBundle(bundle);
  assert.equal(parsed.meta.spec_ref, "6.2.1");
  assert.equal(parsed.drafts.length, 1);
  const prepared = prepareImportedDrafts(bundle);
  assert.equal(prepared.drafts[0].import_meta.spec_ref, "6.2.1");
});
