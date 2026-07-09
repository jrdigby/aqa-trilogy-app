import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkKeywordOrSynonymsMatch,
  markResponse,
  parseKeywordExpression,
  findStudentAnswerHighlights,
  renderHighlightedStudentAnswer,
} from "../src/evalEngine.js";

const transformerMarkPoints = [
  { ao: "AO1", point_text: "increase, potential difference|voltage|volts", max_marks: 1 },
  { ao: "AO2", point_text: "decrease, current|amps", max_marks: 1 },
];

const transformerKey = { key_type: "keywords", key_payload: {} };
const transformerQ = {
  question_type: "short_text",
  max_marks: 2,
  ao1_marks: 1,
  ao2_marks: 1,
  ao3_marks: 0,
};

test("parseKeywordExpression — comma AND groups with pipe synonyms", () => {
  assert.deepEqual(parseKeywordExpression("increase, potential difference|voltage|volts"), [
    "increase",
    "potential difference|voltage|volts",
  ]);
});

test("transformer — increase voltage earns first mark point only", async () => {
  const result = await markResponse(
    transformerQ,
    { text: "increase voltage" },
    transformerKey,
    transformerMarkPoints
  );
  assert.equal(result.total, 1);
});

test("transformer — decrease current earns second mark point", async () => {
  const result = await markResponse(
    transformerQ,
    { text: "decrease current" },
    transformerKey,
    transformerMarkPoints
  );
  assert.equal(result.total, 1);
});

test("transformer — both features earn full marks", async () => {
  const result = await markResponse(
    transformerQ,
    { text: "increase voltage and decrease current" },
    transformerKey,
    transformerMarkPoints
  );
  assert.equal(result.total, 2);
});

test("transformer — voltage alone does not earn increase mark point", () => {
  const words = "voltage".replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").split(/\s+/);
  assert.equal(
    checkKeywordOrSynonymsMatch("increase, potential difference|voltage|volts", words, "voltage"),
    false
  );
});

test("thermal wall — multi-word phrase highlights in student answer", () => {
  const targets = ["thickness", "thermal conductivity"];
  const answer = "Thickness of wall, thermal conductivity of the brick";
  const highlights = findStudentAnswerHighlights(answer, targets);

  const matched = highlights.map((h) => answer.slice(h.start, h.end).toLowerCase());
  assert.ok(matched.some((m) => m.includes("thickness")));
  assert.ok(matched.some((m) => m.includes("thermal conductivity")));

  const html = renderHighlightedStudentAnswer(answer, targets);
  assert.ok(html.includes('class="match-exact"'));
  assert.ok(html.includes("thermal conductivity"));
});

test("section 2 keywords used when section 3 rows have empty point_text", async () => {
  const q = { question_type: "short_text", max_marks: 1, ao1_marks: 1, ao2_marks: 0, ao3_marks: 0 };
  const key = { key_type: "keywords", key_payload: { required: ["series"], optional: [], min_optional: 0 } };
  const emptyCheckpoint = [{ ao: "AO1", point_text: "", feedback_if_missing: "", max_marks: 1 }];

  const result = await markResponse(q, { text: "series" }, key, emptyCheckpoint);
  assert.equal(result.total, 1);
  assert.equal(result.missing.length, 0);
});

test("pipe-only expressions remain backward compatible", () => {
  const words = "resists motion".replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "").split(/\s+/);
  assert.equal(checkKeywordOrSynonymsMatch("opposes|resists", words, "resists motion"), true);
});
