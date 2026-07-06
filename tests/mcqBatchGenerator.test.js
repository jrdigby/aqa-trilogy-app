import { test } from "node:test";
import assert from "node:assert/strict";
import {
  expandDemandRecipes,
  generateMcqBatch,
  generateMcqQuestion,
  generateMcqQuestionsForRecipes,
  remapMcqOptionFeedback,
  splitSpecFragments,
  syncDraftFromPreviewEdits,
  demandRecipeLabel,
  parseSpecClaims
} from "../src/mcqBatchGenerator.js";
import { parseSpecClaims as parseClaims } from "../src/mcqSpecParser.js";
import { generateMisconceptionDistractors } from "../src/mcqMisconceptions.js";

const sampleSpecPoint = {
  id: "sp-1",
  spec_ref: "P4.1.1",
  topic_name: "Energy stores and transfers",
  subject: "physics",
  spec_text:
    "Energy is stored in a system when it is raised above the surroundings. " +
    "Energy is transferred by heating when there is a temperature difference. " +
    "Work done can transfer energy mechanically."
};

test("parseSpecClaims — extracts multiple claims from spec text", () => {
  const claims = parseClaims(sampleSpecPoint.spec_text, sampleSpecPoint.topic_name);
  assert.ok(claims.length >= 3);
  assert.ok(claims.some((c) => /temperature difference/i.test(c.text)));
  assert.ok(claims.some((c) => c.type === "transfer" || c.type === "storage"));
});

test("splitSpecFragments — splits spec text into usable clauses", () => {
  const parts = splitSpecFragments(sampleSpecPoint.spec_text);
  assert.ok(parts.length >= 2);
  assert.ok(parts.every((p) => p.length >= 12));
});

test("generateMisconceptionDistractors — uses condition inversion and subject catalog", () => {
  const correct = "Energy is transferred by heating when there is a temperature difference";
  const distractors = generateMisconceptionDistractors(correct, { text: correct, focus: "heating" }, {
    subject: "physics",
    topicName: "Energy stores and transfers",
    siblingClaims: [
      "Energy is stored in a system when it is raised above the surroundings"
    ],
    rng: () => 0.5,
    count: 3
  });
  assert.equal(distractors.length, 3);
  assert.ok(distractors.every((d) => d.feedback && d.text));
  assert.ok(
    distractors.some((d) => /no temperature difference|used up|hotter to colder|different point/i.test(`${d.text} ${d.feedback}`))
  );
});

test("generateMcqQuestion — correct answer is a spec claim with misconception distractors", () => {
  const draft = generateMcqQuestion(
    { tier: "both", subject: "physics" },
    {
      demand_level: "low",
      _claim: parseClaims(sampleSpecPoint.spec_text, sampleSpecPoint.topic_name)[1]
    },
    sampleSpecPoint,
    () => 0.42
  );
  assert.equal(draft.question.question_type, "mcq");
  assert.ok(/temperature difference|heating/i.test(draft.answer_key.key_payload.correct));
  assert.ok(/heating|energy stores|temperature/i.test(draft.question.prompt));
  assert.equal(draft.question.options.length, 4);
  const fb = draft.answer_key.key_payload.option_feedback;
  assert.ok(Object.keys(fb).length >= 1);
  assert.ok(Object.values(fb).some((msg) => msg.length > 20));
  assert.ok(draft._meta.distractor_sources?.length);
});

test("generateMcqBatch — rotates through different spec claims", () => {
  const { drafts, errors } = generateMcqBatch(
    {
      tier: "foundation",
      subject: "physics",
      recipes: [
        { demand_level: "low", count: 2 },
        { demand_level: "standard", count: 1 }
      ],
      seed: 99
    },
    sampleSpecPoint
  );
  assert.equal(errors.length, 0);
  assert.equal(drafts.length, 3);
  assert.equal(drafts[0].question.tier, "FT");
  const correctAnswers = drafts.map((d) => d.answer_key.key_payload.correct);
  assert.ok(new Set(correctAnswers).size >= 2, "expected distinct claims across batch");
});

test("expandDemandRecipes — expands demand rows by count", () => {
  const list = expandDemandRecipes([
    { demand_level: "low", count: 2 },
    { demand_level: "standard_45", count: 1 }
  ]);
  assert.equal(list.length, 3);
});

test("remapMcqOptionFeedback — remaps feedback when option text changes", () => {
  const remapped = remapMcqOptionFeedback(
    ["A correct", "B altered", "C wrong", "D wrong"],
    { "B wrong": "Because B is incorrect" },
    "A correct",
    "A correct"
  );
  assert.equal(remapped["B altered"], "Because B is incorrect");
});

test("syncDraftFromPreviewEdits — updates AO and overall feedback", () => {
  const draft = generateMcqQuestion(
    { tier: "higher", subject: "physics" },
    { demand_level: "standard_45", _claim: parseSpecClaims(sampleSpecPoint.spec_text, sampleSpecPoint.topic_name)[0] },
    sampleSpecPoint,
    () => 0.1
  );
  const updated = syncDraftFromPreviewEdits(draft, {
    prompt: "Edited prompt?",
    ao1_marks: 0,
    ao2_marks: 1,
    ao3_marks: 0,
    overall_feedback: "Review energy transfers."
  });
  assert.equal(updated.question.prompt, "Edited prompt?");
  assert.equal(updated.mark_points[0].feedback_if_missing, "Review energy transfers.");
});

test("demandRecipeLabel — formats demand bucket", () => {
  assert.equal(demandRecipeLabel({ demand_level: "low" }), "Low");
});

test("generateMcqQuestionsForRecipes — avoids existing draft correct answers", () => {
  const first = generateMcqQuestionsForRecipes(
    { tier: "both", subject: "physics", seed: 42 },
    sampleSpecPoint,
    [{ question_type: "mcq", demand_level: "low" }]
  );
  assert.equal(first.drafts.length, 1);
  const second = generateMcqQuestionsForRecipes(
    { tier: "both", subject: "physics", seed: 43 },
    sampleSpecPoint,
    [{ question_type: "mcq", demand_level: "low" }],
    { avoidDrafts: first.drafts }
  );
  assert.equal(second.drafts.length, 1);
  const firstCorrect = first.drafts[0].answer_key.key_payload.correct;
  const secondCorrect = second.drafts[0].answer_key.key_payload.correct;
  assert.notEqual(normalizeCompare(firstCorrect), normalizeCompare(secondCorrect));
});

function normalizeCompare(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
