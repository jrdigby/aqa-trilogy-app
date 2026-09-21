import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CROSS_TIER_DEMAND_LEVEL,
  isCrossTierQuestion,
  questionTierMatchesProfile,
  questionMatchesProfileTier,
  questionTiersForFetch,
  targetTiersForTier,
  getActiveSubjects,
  formatSciencePathLabel,
  formatSciencePathShort,
  getExamBoard,
  normalizeExamBoard,
  questionMatchesStudent,
  DEFAULT_EXAM_BOARD
} from "../src/sciencePath.js";

const ftTiers = targetTiersForTier("FT");
const htTiers = targetTiersForTier("HT");

test("isCrossTierQuestion — true only for standard_45", () => {
  assert.equal(isCrossTierQuestion("standard_45"), true);
  assert.equal(isCrossTierQuestion({ demand_level: "standard_45" }), true);
  assert.equal(isCrossTierQuestion("standard"), false);
  assert.equal(isCrossTierQuestion("standard_67"), false);
  assert.equal(isCrossTierQuestion(null), false);
});

test("questionTierMatchesProfile — standard_45 visible to FT and HT profiles", () => {
  assert.equal(questionTierMatchesProfile("HT", ftTiers, CROSS_TIER_DEMAND_LEVEL), true);
  assert.equal(questionTierMatchesProfile("FT", htTiers, CROSS_TIER_DEMAND_LEVEL), true);
  assert.equal(questionTierMatchesProfile("both", ftTiers, CROSS_TIER_DEMAND_LEVEL), true);
  assert.equal(questionTierMatchesProfile("both", htTiers, CROSS_TIER_DEMAND_LEVEL), true);
});

test("questionTierMatchesProfile — non-crossover questions keep tier rules", () => {
  const ftCanonical = ["FT", "both"];
  const htCanonical = ["HT", "both"];
  assert.equal(questionTierMatchesProfile("HT", ftCanonical, "standard_67"), false);
  assert.equal(questionTierMatchesProfile("FT", ["HT"], "standard"), false);
  assert.equal(questionTierMatchesProfile("HT", htCanonical, "standard_67"), true);
  assert.equal(questionTierMatchesProfile("FT", ftCanonical, "standard"), true);
  assert.equal(questionTierMatchesProfile("both", ftCanonical, "low"), true);
  assert.equal(questionTierMatchesProfile("both", htCanonical, "high_89"), true);
});

test("questionMatchesProfileTier — crossover rows stored under any tier", () => {
  const crossover = { tier: "HT", demand_level: "standard_45" };
  assert.equal(questionMatchesProfileTier(crossover, ftTiers), true);
  assert.equal(questionMatchesProfileTier({ tier: "FT", demand_level: "standard_45" }, htTiers), true);
  assert.equal(questionMatchesProfileTier({ tier: "both", demand_level: "standard_45" }, ftTiers), true);

  const htOnly = { tier: "HT", demand_level: "standard_67" };
  assert.equal(questionMatchesProfileTier(htOnly, ftTiers), false);
  assert.equal(questionMatchesProfileTier(htOnly, htTiers), true);
});

test("getActiveSubjects — combined ignores a subset", () => {
  assert.deepEqual(
    getActiveSubjects({ science_path: "combined", science_subjects: ["physics"] }),
    ["biology", "chemistry", "physics"]
  );
});

test("getActiveSubjects — triple uses the stored subset", () => {
  assert.deepEqual(
    getActiveSubjects({ science_path: "triple", science_subjects: ["physics"] }),
    ["physics"]
  );
  assert.deepEqual(
    getActiveSubjects({
      science_path: "triple",
      science_subjects: ["chemistry", "physics", "chemistry"]
    }),
    ["chemistry", "physics"]
  );
});

test("getActiveSubjects — missing triple selection means all three", () => {
  assert.deepEqual(getActiveSubjects({ science_path: "triple" }), [
    "biology",
    "chemistry",
    "physics"
  ]);
  assert.deepEqual(
    getActiveSubjects({ science_path: "triple", science_subjects: [] }),
    ["biology", "chemistry", "physics"]
  );
});

test("getExamBoard defaults to aqa", () => {
  assert.equal(getExamBoard(null), DEFAULT_EXAM_BOARD);
  assert.equal(getExamBoard({}), "aqa");
  assert.equal(getExamBoard({ exam_board: "AQA" }), "aqa");
  assert.equal(getExamBoard({ exam_board: "edexcel" }), "edexcel");
});

test("normalizeExamBoard falls back for unknown values", () => {
  assert.equal(normalizeExamBoard("aqa"), "aqa");
  assert.equal(normalizeExamBoard("ocr_gateway"), "ocr_gateway");
  assert.equal(normalizeExamBoard("unknown"), "aqa");
  assert.equal(normalizeExamBoard(""), "aqa");
  assert.equal(normalizeExamBoard(null), "aqa");
});

test("formatSciencePathLabel lists only selected triple subjects", () => {
  assert.equal(
    formatSciencePathLabel({
      science_path: "triple",
      science_subjects: ["physics"],
      subject_tiers: { physics: "HT" }
    }),
    "AQA · Triple · Phy HT"
  );
  assert.equal(
    formatSciencePathShort({ science_path: "triple", science_subjects: ["physics"] }),
    "AQA · Triple Science · Physics"
  );
});

test("formatSciencePathLabel includes AQA for combined", () => {
  assert.equal(
    formatSciencePathLabel({ science_path: "combined", preferred_tier: "FT" }),
    "AQA · Combined · Foundation"
  );
  assert.match(
    formatSciencePathLabel({ science_path: "combined", preferred_tier: "HT", exam_board: "aqa" }),
    /AQA/
  );
});

test("questionMatchesStudent rejects wrong exam_board", () => {
  const profile = { science_path: "combined", exam_board: "aqa" };
  const q = { audience: "both" };
  assert.equal(
    questionMatchesStudent(q, profile, {
      course_track: "combined",
      exam_board: "aqa"
    }),
    true
  );
  assert.equal(
    questionMatchesStudent(q, profile, {
      course_track: "combined",
      exam_board: "edexcel"
    }),
    false
  );
});

test("questionTiersForFetch — returns all stored tiers", () => {
  assert.deepEqual(questionTiersForFetch(ftTiers), ["FT", "HT", "both"]);
  assert.deepEqual(questionTiersForFetch(htTiers), ["FT", "HT", "both"]);
});
