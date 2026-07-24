import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectHumanEdited,
  GENERATION_SOURCES,
  sha256Hex
} from "../src/generationLogs.js";

test("sha256Hex returns hex digest", async () => {
  const hash = await sha256Hex("hello");
  assert.equal(hash, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
});

test("sha256Hex null for empty", async () => {
  assert.equal(await sha256Hex(""), null);
  assert.equal(await sha256Hex(null), null);
});

test("detectHumanEdited compares stems", () => {
  assert.equal(
    detectHumanEdited({ original_prompt: "What is force?" }, { question: { prompt: "What is force?" } }),
    false
  );
  assert.equal(
    detectHumanEdited({ original_prompt: "What is force?" }, { question: { prompt: "What is weight?" } }),
    true
  );
  assert.equal(detectHumanEdited(null, { question: { prompt: "x" } }), false);
});

test("detectHumanEdited uses original_snapshot for non-prompt edits", () => {
  const provenance = {
    original_prompt: "What is current?",
    original_snapshot: {
      question: { prompt: "What is current?", options: ["A", "B", "C", "D"] },
      answer_key: { key_type: "mcq", key_payload: { correct: "A" } },
      mark_points: []
    }
  };
  assert.equal(
    detectHumanEdited(provenance, {
      question: { prompt: "What is current?", options: ["A", "B", "C", "D"] },
      answer_key: { key_type: "mcq", key_payload: { correct: "A" } },
      mark_points: []
    }),
    false
  );
  assert.equal(
    detectHumanEdited(provenance, {
      question: { prompt: "What is current?", options: ["A", "B", "C", "D"] },
      answer_key: { key_type: "mcq", key_payload: { correct: "B" } },
      mark_points: []
    }),
    true
  );
});

test("GENERATION_SOURCES constants", () => {
  assert.equal(GENERATION_SOURCES.AI_STUDIO, "ai_studio");
  assert.equal(GENERATION_SOURCES.AI_STUDIO_IMPORT, "ai_studio_import");
  assert.equal(GENERATION_SOURCES.BATCH_NUMERIC, "batch_numeric");
  assert.equal(GENERATION_SOURCES.MANUAL_CREATE, "manual_create");
  assert.equal(GENERATION_SOURCES.CSV_IMPORT, "csv_import");
});
