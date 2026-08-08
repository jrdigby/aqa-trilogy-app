import test from "node:test";
import assert from "node:assert/strict";
import {
  academicYearStartISO,
  nextMay11OnOrAfter,
  resolveExamDate,
  resolveIntroDeadline,
  computeWeeklyIntroBudget,
  planCurriculumIntros,
  weeksUntil,
  normalizeHorizonPreset,
  getHorizonSrsCaps,
  clampIntervalForExam,
  daysBetweenISO,
  longIntervalThresholdForPreset,
  interleaveBySubject,
  examDateToPersist,
  EXAM_DAY,
  EXAM_MONTH
} from "../src/curriculumPace.js";
import { updateSRS } from "../src/evalEngine.js";
import { addDaysISO } from "../src/utils.js";

test("exam anchor is 11 May", () => {
  assert.equal(EXAM_MONTH, 5);
  assert.equal(EXAM_DAY, 11);
});

test("academicYearStartISO uses September", () => {
  assert.equal(academicYearStartISO("2026-09-01"), "2026-09-01");
  assert.equal(academicYearStartISO("2026-10-15"), "2026-09-01");
  assert.equal(academicYearStartISO("2027-03-01"), "2026-09-01");
});

test("nextMay11OnOrAfter", () => {
  assert.equal(nextMay11OnOrAfter("2026-09-01"), "2027-05-11");
  assert.equal(nextMay11OnOrAfter("2027-05-11"), "2027-05-11");
  assert.equal(nextMay11OnOrAfter("2027-05-12"), "2028-05-11");
});

test("resolveExamDate presets from Sept signup", () => {
  const today = "2026-09-01";
  assert.equal(resolveExamDate({ revision_horizon_preset: "y10" }, today), "2028-05-11");
  assert.equal(resolveExamDate({ revision_horizon_preset: "y11" }, today), "2027-05-11");
  assert.equal(
    resolveExamDate({ revision_horizon_preset: "final_months" }, today),
    "2026-11-24"
  );
});

test("target_exam_date override wins", () => {
  assert.equal(
    resolveExamDate(
      { revision_horizon_preset: "y10", target_exam_date: "2027-05-11" },
      "2026-09-01"
    ),
    "2027-05-11"
  );
});

test("intro deadline is exam minus 4 weeks", () => {
  const today = "2026-09-01";
  const exam = "2027-05-11";
  const deadline = resolveIntroDeadline(exam, today);
  assert.equal(deadline, "2027-04-13");
  assert.ok(weeksUntil(deadline, today) >= 30);
});

test("computeWeeklyIntroBudget spreads and raises for crunch", () => {
  assert.equal(computeWeeklyIntroBudget({ untracked: 0, weeksLeft: 10 }), 0);
  assert.equal(computeWeeklyIntroBudget({ untracked: 49, weeksLeft: 10 }), 5);
  assert.equal(computeWeeklyIntroBudget({ untracked: 49, weeksLeft: 80 }), 1);
  assert.equal(computeWeeklyIntroBudget({ untracked: 3, weeksLeft: 10 }), 1);
  // Short horizon must not stay capped at 5 if more are required
  assert.equal(computeWeeklyIntroBudget({ untracked: 61, weeksLeft: 8 }), 8);
  assert.equal(computeWeeklyIntroBudget({ untracked: 61, weeksLeft: 4 }), 12); // absolute max
});

test("final_months intro deadline is exam − 1 week", () => {
  const today = "2026-09-01";
  const exam = resolveExamDate({ revision_horizon_preset: "final_months" }, today);
  const deadline = resolveIntroDeadline(exam, today, "final_months");
  assert.equal(deadline, addDaysISO(exam, -7));
});

test("final_months exam date locks via target_exam_date", () => {
  const today = "2026-09-01";
  const locked = examDateToPersist(
    { revision_horizon_preset: "final_months" },
    today
  );
  assert.equal(locked, "2026-11-24");
  assert.equal(
    resolveExamDate(
      { revision_horizon_preset: "final_months", target_exam_date: locked },
      "2026-10-15"
    ),
    locked
  );
});

test("planCurriculumIntros respects week budget and soft due load", () => {
  const profile = { revision_horizon_preset: "y11", revision_pace_state: {} };
  const plan = planCurriculumIntros({
    profile,
    today: "2026-09-01",
    trackedCount: 12,
    eligibleCount: 61,
    dueTodayCount: 2,
    paceStateRaw: {}
  });
  assert.equal(plan.toIntroduce, 1);
  assert.equal(plan.reason, "introduce");
  assert.ok(plan.weeklyBudget >= 1);

  const deferred = planCurriculumIntros({
    profile,
    today: "2026-09-01",
    trackedCount: 12,
    eligibleCount: 61,
    dueTodayCount: 9,
    paceStateRaw: {}
  });
  assert.equal(deferred.toIntroduce, 0);
  assert.equal(deferred.reason, "defer_heavy_review_day");

  const weekDone = planCurriculumIntros({
    profile,
    today: "2026-09-01",
    trackedCount: 12,
    eligibleCount: 61,
    dueTodayCount: 0,
    paceStateRaw: { weekKey: plan.examDate && undefined, today: "2026-09-01", introsThisWeek: 99, introsToday: 0 }
  });
  // Force week key match via normalize — use plan's week from first call
  const weekDone2 = planCurriculumIntros({
    profile,
    today: "2026-09-01",
    trackedCount: 12,
    eligibleCount: 61,
    dueTodayCount: 0,
    paceStateRaw: {
      weekKey: plan.nextPaceState.weekKey,
      today: "2026-09-01",
      introsThisWeek: plan.weeklyBudget,
      introsToday: 0
    }
  });
  assert.equal(weekDone2.toIntroduce, 0);
  assert.equal(weekDone2.reason, "week_budget_met");
});

test("interleaveBySubject round-robins Bio → Chem → Phys", () => {
  const items = [
    { id: "b1", subject: "biology" },
    { id: "b2", subject: "biology" },
    { id: "c1", subject: "chemistry" },
    { id: "p1", subject: "physics" },
    { id: "c2", subject: "chemistry" }
  ];
  assert.deepEqual(
    interleaveBySubject(items).map((x) => x.id),
    ["b1", "c1", "p1", "b2", "c2"]
  );
});

test("normalizeHorizonPreset defaults to y11", () => {
  assert.equal(normalizeHorizonPreset("y10"), "y10");
  assert.equal(normalizeHorizonPreset("nope"), "y11");
});

test("getHorizonSrsCaps matches agreed ceilings", () => {
  assert.equal(getHorizonSrsCaps("final_months").maxInterval, 21);
  assert.equal(getHorizonSrsCaps("final_months").efCeil, 2.5);
  assert.equal(getHorizonSrsCaps("y11").maxInterval, 42);
  assert.equal(getHorizonSrsCaps("y11").efCeil, 2.6);
  assert.equal(getHorizonSrsCaps("y10").maxInterval, 60);
  assert.equal(getHorizonSrsCaps("y10").efCeil, 2.7);
});

test("capped SM-2 stops short of 147/456 for each horizon", () => {
  function ramp(preset, n = 8) {
    const caps = getHorizonSrsCaps(preset);
    let ef = 2.5;
    let reps = 0;
    let interval = 1;
    for (let i = 0; i < n; i++) {
      const u = updateSRS({ quality: 5, ef, reps, interval, caps });
      ef = u.newEF;
      reps = u.newReps;
      interval = u.newInterval;
    }
    return { interval, ef };
  }
  assert.equal(ramp("final_months").interval, 21);
  assert.ok(ramp("final_months").ef <= 2.5);
  assert.equal(ramp("y11").interval, 42);
  assert.ok(ramp("y11").ef <= 2.6);
  assert.equal(ramp("y10").interval, 60);
  assert.ok(ramp("y10").ef <= 2.7);
});

test("clampIntervalForExam respects exam ceiling and final-week park", () => {
  assert.equal(
    clampIntervalForExam({
      today: "2027-03-01",
      intervalDays: 42,
      examDate: "2027-05-11"
    }),
    42
  );
  // From 2027-04-20 to exam = 21 days; interval 42 compresses with spread
  const clamped = clampIntervalForExam({
    today: "2027-04-20",
    intervalDays: 42,
    examDate: "2027-05-11",
    spreadKey: "topic-a"
  });
  assert.ok(clamped >= 1 && clamped <= 21, `expected 1–21, got ${clamped}`);
  assert.equal(
    clampIntervalForExam({
      today: "2027-04-20",
      intervalDays: 10,
      examDate: "2027-05-11"
    }),
    10
  );
  // Pass in final week → park after exam (at least day after = 7 from May 5)
  const parked = clampIntervalForExam({
    today: "2027-05-05",
    intervalDays: 21,
    examDate: "2027-05-11",
    quality: 5,
    spreadKey: "topic-b"
  });
  assert.ok(parked >= 7 && parked <= 13, `expected park 7–13, got ${parked}`);
  assert.equal(
    clampIntervalForExam({
      today: "2027-05-05",
      intervalDays: 21,
      examDate: "2027-05-11",
      quality: 1
    }),
    1
  );
  assert.equal(
    clampIntervalForExam({
      today: "2027-05-12",
      intervalDays: 21,
      examDate: "2027-05-11"
    }),
    1
  );
});

test("daysBetweenISO and longIntervalThresholdForPreset", () => {
  assert.equal(daysBetweenISO("2027-05-01", "2027-05-11"), 10);
  assert.equal(longIntervalThresholdForPreset("y10"), 60);
  assert.equal(longIntervalThresholdForPreset("y11"), 42);
  assert.equal(longIntervalThresholdForPreset("final_months"), 21);
});
