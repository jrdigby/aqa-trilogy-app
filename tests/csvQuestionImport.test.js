import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CSV_IMPORT_COLUMNS,
  getCsvImportHeaderLine,
  parseDelimitedRows,
  isNamedHeaderRow,
  rowToRecord,
  legacyPositionalToRecord,
  parseKeywordGroups,
  parseHintsField,
  buildMarkPointsFromRecord,
  buildAnswerKey,
  recordToImportBundle,
  parseImportRecords
} from "../src/csvQuestionImport.js";

test("getCsvImportHeaderLine — tab-separated ordered columns", () => {
  const header = getCsvImportHeaderLine("\t");
  assert.ok(header.startsWith("subject\tpaper\tspec_ref"));
  assert.ok(header.includes("mp1_ao\tmp1_keywords\tmp1_feedback\tmp1_image_url"));
  assert.equal(header.split("\t").length, CSV_IMPORT_COLUMNS.length);
});

test("parseDelimitedRows — quoted commas in tab file", () => {
  const text = "a\tb\n\"hello, world\"\t2";
  const { rows, delimiter } = parseDelimitedRows(text);
  assert.equal(delimiter, "\t");
  assert.equal(rows.length, 2);
  assert.equal(rows[1][0], "hello, world");
});

test("parseKeywordGroups — comma groups with pipe synonyms", () => {
  assert.deepEqual(parseKeywordGroups("gravity|gravitational, mass"), [
    "gravity|gravitational",
    "mass"
  ]);
});

test("parseHintsField — triple-pipe separator", () => {
  assert.deepEqual(parseHintsField("Hint one|||Hint two"), ["Hint one", "Hint two"]);
  assert.equal(parseHintsField(""), null);
});

test("buildMarkPointsFromRecord — Section 3 with image URLs", () => {
  const mps = buildMarkPointsFromRecord({
    mp1_ao: "AO1",
    mp1_keywords: "mitochondria",
    mp1_feedback: "Remember organelles.",
    mp1_image_url: "https://example.com/diag.png",
    mp2_ao: "AO2",
    mp2_keywords: "respiration",
    mp2_feedback: "Aerobic vs anaerobic."
  });
  assert.equal(mps.length, 2);
  assert.equal(mps[0].image_url, "https://example.com/diag.png");
  assert.equal(mps[1].image_url, null);
});

test("buildAnswerKey — MCQ with per-option feedback keyed by option text", () => {
  const options = ["Correct", "Wrong A", "Wrong B", "Wrong C"];
  const key = buildAnswerKey(
    {
      mcq_correct: "Correct",
      mcq_feedback_b: "B is a common misconception."
    },
    "mcq",
    options
  );
  assert.equal(key.key_type, "mcq");
  assert.equal(key.key_payload.correct, "Correct");
  assert.equal(key.key_payload.option_feedback["Wrong A"], "B is a common misconception.");
});

test("recordToImportBundle — short text with mark points", () => {
  const bundle = recordToImportBundle({
    subject: "physics",
    paper: "paper1",
    spec_ref: "4.1.1.1",
    audience: "both",
    tier: "both",
    question_type: "short_text",
    command_word: "describe",
    demand_level: "standard",
    max_marks: "2",
    ao1_marks: "1",
    ao2_marks: "1",
    prompt: "Describe energy transfer in a system.",
    keywords_required: "kinetic|KE, thermal",
    mp1_ao: "AO1",
    mp1_keywords: "kinetic|KE",
    mp1_feedback: "Name the energy store.",
    mp1_image_url: "https://cdn.example/kinetic.png",
    mp2_ao: "AO2",
    mp2_keywords: "thermal|heat",
    mp2_feedback: "Energy dissipated as heat."
  });

  assert.equal(bundle.question.question_type, "short_text");
  assert.equal(bundle.markPoints.length, 2);
  assert.equal(bundle.markPoints[0].image_url, "https://cdn.example/kinetic.png");
});

test("parseImportRecords — named header TSV", () => {
  const tsv = [
    getCsvImportHeaderLine("\t"),
    [
      "physics",
      "paper1",
      "4.1.1.1",
      "",
      "both",
      "both",
      "mcq",
      "state",
      "low",
      "1",
      "1",
      "0",
      "0",
      "",
      "",
      "",
      "",
      "",
      "What is the unit of force?",
      "",
      "",
      "",
      "Newton",
      "Joule",
      "Watt",
      "Pascal",
      "Newton",
      "A joule is energy.",
      "Watt is power.",
      "Pascal is pressure.",
      ""
    ].join("\t")
  ].join("\n");

  const { records, format } = parseImportRecords(tsv);
  assert.equal(format, "named");
  assert.equal(records.length, 1);
  assert.equal(records[0].question_type, "mcq");
  assert.equal(records[0].mcq_correct, "Newton");
});

test("legacyPositionalToRecord — backward compatible MCQ row", () => {
  const parts = [
    "physics",
    "paper1",
    "both",
    "4.1.1.1",
    "mcq",
    "Prompt?",
    "A",
    "B",
    "C",
    "D",
    "B",
    "1"
  ];
  const rec = legacyPositionalToRecord(parts);
  assert.equal(rec.mcq_correct, "B");
  assert.equal(rec.option_a, "A");
});
