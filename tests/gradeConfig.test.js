import test from "node:test";
import assert from "node:assert/strict";
import {
  COMBINED_GRADE_OPTIONS,
  TRIPLE_GRADE_OPTIONS,
  normalizeCurrentGrades,
  normalizeTargetGrades,
  gradesMatchPath,
  compareGrades,
  primaryGradeNumber,
  gradeToDifficultyOffset,
  initialAdaptiveOffsetFromGrades,
  formatGradesLabel,
  defaultCurrentGrades
} from "../src/gradeConfig.js";

test("combined options are the 17 dual-award pairs", () => {
  assert.equal(COMBINED_GRADE_OPTIONS.length, 17);
  assert.equal(COMBINED_GRADE_OPTIONS[0], "9/9");
  assert.equal(COMBINED_GRADE_OPTIONS.at(-1), "1/1");
  assert.ok(COMBINED_GRADE_OPTIONS.includes("5/4"));
});

test("triple options are 9..1", () => {
  assert.deepEqual(TRIPLE_GRADE_OPTIONS, [9, 8, 7, 6, 5, 4, 3, 2, 1]);
});

test("normalizeCurrentGrades combined defaults and sanitizes", () => {
  assert.deepEqual(normalizeCurrentGrades(null, "combined"), { combined: "5/5" });
  assert.deepEqual(normalizeCurrentGrades({ combined: "6/5" }, "combined"), {
    combined: "6/5"
  });
  assert.deepEqual(normalizeCurrentGrades({ combined: "nope" }, "combined"), {
    combined: "5/5"
  });
});

test("normalizeCurrentGrades triple fills subjects", () => {
  assert.deepEqual(normalizeCurrentGrades({ biology: 7 }, "triple"), {
    biology: 7,
    chemistry: 5,
    physics: 5
  });
  assert.deepEqual(normalizeTargetGrades({ biology: 9, chemistry: 8, physics: 7 }, "triple"), {
    biology: 9,
    chemistry: 8,
    physics: 7
  });
});

test("gradesMatchPath", () => {
  assert.equal(gradesMatchPath({ combined: "5/5" }, "combined"), true);
  assert.equal(gradesMatchPath({ combined: "x" }, "combined"), false);
  assert.equal(
    gradesMatchPath({ biology: 5, chemistry: 5, physics: 5 }, "triple"),
    true
  );
  assert.equal(gradesMatchPath({ biology: 5 }, "triple"), false);
});

test("compareGrades combined requires both numbers >=", () => {
  assert.equal(compareGrades({ combined: "5/4" }, { combined: "6/5" }, "combined"), true);
  assert.equal(compareGrades({ combined: "5/4" }, { combined: "5/4" }, "combined"), true);
  assert.equal(compareGrades({ combined: "5/4" }, { combined: "4/4" }, "combined"), false);
  assert.equal(compareGrades({ combined: "6/5" }, { combined: "5/5" }, "combined"), false);
});

test("compareGrades triple requires each subject >=", () => {
  assert.equal(
    compareGrades(
      { biology: 4, chemistry: 5, physics: 3 },
      { biology: 5, chemistry: 5, physics: 4 },
      "triple"
    ),
    true
  );
  assert.equal(
    compareGrades(
      { biology: 4, chemistry: 5, physics: 3 },
      { biology: 5, chemistry: 4, physics: 4 },
      "triple"
    ),
    false
  );
});

test("primaryGradeNumber uses lower of pair / average of subjects", () => {
  assert.equal(primaryGradeNumber({ combined: "6/5" }, "combined"), 5);
  assert.equal(primaryGradeNumber({ combined: "4/4" }, "combined"), 4);
  assert.equal(
    primaryGradeNumber({ biology: 6, chemistry: 4, physics: 5 }, "triple"),
    5
  );
});

test("gradeToDifficultyOffset FT and HT bands", () => {
  assert.equal(gradeToDifficultyOffset(1, "FT"), -2);
  assert.equal(gradeToDifficultyOffset(2, "FT"), -1);
  assert.equal(gradeToDifficultyOffset(3, "FT"), 0);
  assert.equal(gradeToDifficultyOffset(4, "FT"), 0);
  assert.equal(gradeToDifficultyOffset(5, "FT"), 1);

  assert.equal(gradeToDifficultyOffset(5, "HT"), -2);
  assert.equal(gradeToDifficultyOffset(6, "HT"), -1);
  assert.equal(gradeToDifficultyOffset(7, "HT"), 0);
  assert.equal(gradeToDifficultyOffset(8, "HT"), 1);
  assert.equal(gradeToDifficultyOffset(9, "HT"), 2);
});

test("initialAdaptiveOffsetFromGrades combined and triple", () => {
  assert.equal(
    initialAdaptiveOffsetFromGrades({ combined: "5/5" }, "combined", "FT"),
    1
  );
  assert.equal(
    initialAdaptiveOffsetFromGrades({ combined: "3/2" }, "combined", "FT"),
    -1
  );
  assert.equal(
    initialAdaptiveOffsetFromGrades(
      { biology: 9, chemistry: 9, physics: 9 },
      "triple",
      { biology: "HT", chemistry: "HT", physics: "HT" }
    ),
    2
  );
  assert.equal(
    initialAdaptiveOffsetFromGrades(
      { biology: 5, chemistry: 5, physics: 5 },
      "triple",
      { biology: "FT", chemistry: "FT", physics: "FT" }
    ),
    1
  );
});

test("formatGradesLabel and defaults", () => {
  assert.equal(formatGradesLabel({ combined: "7/6" }, "combined"), "7/6");
  assert.match(
    formatGradesLabel({ biology: 6, chemistry: 5, physics: 4 }, "triple"),
    /Bio 6/
  );
  assert.deepEqual(defaultCurrentGrades("combined"), { combined: "5/5" });
  assert.deepEqual(defaultCurrentGrades("triple"), {
    biology: 5,
    chemistry: 5,
    physics: 5
  });
});
