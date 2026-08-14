import { test } from "node:test";
import assert from "node:assert/strict";
import { generateMcqQuestionsForRecipes } from "../src/mcqBatchGenerator.js";
import { buildChemistryPromptForClaim, chemistryClaimCategory } from "../src/chemistryStems.js";
import { parseSpecClaims } from "../src/mcqSpecParser.js";

const bondingSpec = {
  spec_ref: "C5.2.1",
  topic_name: "Chemical bonds",
  subject: "chemistry",
  spec_text:
    "Ionic bonding occurs in compounds formed from metals combined with non-metals. " +
    "When a metal atom reacts with a non-metal atom, electrons in the outer shell of the metal atom are transferred. " +
    "Covalent bonding occurs in most non-metallic elements and in compounds of non-metals."
};

test("chemistryClaimCategory — detects bonding topics", () => {
  assert.equal(chemistryClaimCategory("fact", "Ionic bonding occurs in compounds", "Chemical bonds"), "bonding");
});

test("buildChemistryPromptForClaim — produces varied chemistry stem", () => {
  const claims = parseSpecClaims(bondingSpec.spec_text, bondingSpec.topic_name);
  const stem = buildChemistryPromptForClaim(claims[0], bondingSpec.topic_name, "state", "low", () => 0.1);
  assert.match(stem, /ionic|covalent|bond|Chemical bonds/i);
  assert.ok(stem.length >= 20);
  assert.doesNotMatch(stem, /correctly describes:/i);
  assert.doesNotMatch(stem, new RegExp(claims[0].text.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
});

test("buildChemistryPromptForClaim — stem does not embed claim text", () => {
  const claims = parseSpecClaims(bondingSpec.spec_text, bondingSpec.topic_name);
  for (let i = 0; i < 5; i++) {
    const stem = buildChemistryPromptForClaim(claims[0], bondingSpec.topic_name, "state", "low", () => i / 5, i);
    assert.doesNotMatch(stem, /correctly describes:/i);
    assert.ok(tokenOverlap(stem, claims[0].text) < 0.55, `stem too close to claim: ${stem}`);
  }
});

function tokenOverlap(a, b) {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter((w) => w.length > 2));
  if (!wordsA.size || !wordsB.size) return 0;
  let shared = 0;
  for (const w of wordsA) if (wordsB.has(w)) shared++;
  return shared / Math.min(wordsA.size, wordsB.size);
}

test("generateMcqQuestionsForRecipes — chemistry bonding spec produces drafts", () => {
  const { drafts, errors, skipped = [] } = generateMcqQuestionsForRecipes(
    { tier: "both", subject: "chemistry", seed: 2026 },
    bondingSpec,
    [
      { question_type: "mcq", demand_level: "low" },
      { question_type: "mcq", demand_level: "low" },
      { question_type: "mcq", demand_level: "low" }
    ]
  );
  assert.equal(errors.length, 0);
  assert.ok(drafts.length >= 1, `expected chemistry drafts, skipped ${skipped.length}`);
  for (const d of drafts) {
    assert.equal(d.question.question_type, "mcq");
    assert.equal(d.question.options.length, 4);
    assert.ok(!d.question.options.some((o) => /distractor \d/i.test(o)));
    assert.equal(d._meta.source, "template");
  }
});
