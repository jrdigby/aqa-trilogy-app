import test from "node:test";
import assert from "node:assert/strict";
import {
  SrsSimulator,
  runScenario,
  alwaysCorrect,
  WORKLOAD_SPIKE_THRESHOLD,
  LONG_INTERVAL_THRESHOLD_DAYS,
  WEEKLY_FORECAST_TARGET,
  TODAY_DUE_TARGET,
  CURRICULUM_61,
  CURRICULUM_61_TOTAL,
  PACED_SCENARIO_NAMES
} from "./helpers/srsSimulator.js";
import {
  countBySubject,
  BIOLOGY_COUNT,
  CHEMISTRY_COUNT,
  PHYSICS_COUNT
} from "./helpers/srsCurriculum61.js";
import { buildWeeklyForecast } from "../src/srsAnalytics.js";

test("CURRICULUM_61 has 19 biology, 21 chemistry, 21 physics", () => {
  assert.equal(CURRICULUM_61.length, CURRICULUM_61_TOTAL);
  assert.equal(CURRICULUM_61_TOTAL, 61);
  const counts = countBySubject(CURRICULUM_61);
  assert.equal(counts.biology, BIOLOGY_COUNT);
  assert.equal(counts.chemistry, CHEMISTRY_COUNT);
  assert.equal(counts.physics, PHYSICS_COUNT);
});

test("CURRICULUM_61 intro order interleaves Bio → Chem → Phys", () => {
  const first = CURRICULUM_61.slice(0, 6).map((p) => p.subject);
  assert.deepEqual(first, [
    "biology",
    "chemistry",
    "physics",
    "biology",
    "chemistry",
    "physics"
  ]);
});

test("paced scenarios are only y10 / y11 / final_months", () => {
  assert.deepEqual(PACED_SCENARIO_NAMES, [
    "y10_pace_61",
    "y11_pace_61",
    "final_months_pace_61"
  ]);
});

test("seedWeekForecast places ~6 topics with at most 2 due today", () => {
  const sim = new SrsSimulator({
    startDate: "2026-09-01",
    specPoints: CURRICULUM_61
  });
  const result = sim.seedWeekForecast();
  assert.ok(result.added > 0);
  assert.equal(sim.srs.size, WEEKLY_FORECAST_TARGET);
  assert.equal(sim.dueTopics().length, TODAY_DUE_TARGET);
  // Remaining seeds land on later days, not piled onto today
  const byDue = {};
  for (const row of sim.rows()) {
    const d = row.due_date;
    byDue[d] = (byDue[d] || 0) + 1;
  }
  assert.equal(byDue["2026-09-01"], TODAY_DUE_TARGET);
  assert.ok(Object.keys(byDue).length > 1);
});

test("simulator snapshot forecast matches buildWeeklyForecast", () => {
  const sim = new SrsSimulator({ startDate: "2026-09-01", specPoints: CURRICULUM_61 });
  sim.seedWeekForecast();
  sim.practiseDueToday(alwaysCorrect);
  const snap = sim.snapshot();
  const rebuilt = buildWeeklyForecast(sim.rows(), sim.today);
  assert.equal(snap.forecast.overdueCount, rebuilt.overdueCount);
  assert.deepEqual(
    snap.forecast.days.map((d) => d.count),
    rebuilt.days.map((d) => d.count)
  );
});

test("LONG_INTERVAL_THRESHOLD_DAYS is 21 legacy fallback", () => {
  assert.equal(LONG_INTERVAL_THRESHOLD_DAYS, 21);
  assert.equal(WORKLOAD_SPIKE_THRESHOLD, 5);
});

test("y10 early days stay gentle (no day-2 dump of 8)", () => {
  const result = runScenario("y10_pace_61", { days: 14 });
  const byDate = Object.fromEntries(
    result.practiceDays.map((d) => [d.date, d.items.length])
  );
  assert.ok((byDate["2026-09-01"] || 0) <= 3, `day1=${byDate["2026-09-01"]}`);
  assert.ok((byDate["2026-09-02"] || 0) <= 5, `day2=${byDate["2026-09-02"]}`);
  for (const d of result.practiceDays.slice(0, 10)) {
    assert.ok(d.items.length <= 6, `${d.date} had ${d.items.length}`);
  }
});

test("y10_pace_61 covers curriculum with capped intervals", () => {
  const result = runScenario("y10_pace_61", { days: 620 });
  assert.equal(result.examDate, "2028-05-11");
  assert.ok(result.final.trackedCount >= 55, `expected near-full coverage, got ${result.final.trackedCount}`);
  assert.ok(result.practiceDayCount > 50, `expected many practice days, got ${result.practiceDayCount}`);
  assert.ok(result.maxNewIntrosOnDay <= 2, `expected daily new cap, got ${result.maxNewIntrosOnDay}`);
  assert.ok(result.maxDueOnAnyDay < 20, `expected no dump of dozens, maxDue=${result.maxDueOnAnyDay}`);
  const maxInterval = Math.max(0, ...result.final.topics.map((t) => t.interval_days || 0));
  assert.ok(maxInterval <= 60, `y10 max interval should be ≤60, got ${maxInterval}`);
  assert.ok(
    result.final.topics.some((t) => (t.attempts || 0) > 0),
    "expected attempt counts on topics"
  );
});

test("y11_pace_61 covers curriculum with capped intervals", () => {
  const result = runScenario("y11_pace_61", { days: 250 });
  assert.equal(result.examDate, "2027-05-11");
  assert.ok(result.final.trackedCount >= 55, `expected near-full coverage, got ${result.final.trackedCount}`);
  assert.ok(result.maxNewIntrosOnDay <= 2);
  assert.ok(result.maxDueOnAnyDay < 25, `expected no dump of dozens, maxDue=${result.maxDueOnAnyDay}`);
  const maxInterval = Math.max(0, ...result.final.topics.map((t) => t.interval_days || 0));
  assert.ok(maxInterval <= 42, `y11 max interval should be ≤42, got ${maxInterval}`);
});

test("final_months_pace_61 covers full curriculum under short horizon", () => {
  const result = runScenario("final_months_pace_61", { days: 100 });
  assert.equal(result.final.trackedCount, 61, `expected full coverage, got ${result.final.trackedCount}`);
  assert.equal(result.final.unattempted, 0);
  assert.ok(result.maxNewIntrosOnDay <= 4, `daily new cap exceeded: ${result.maxNewIntrosOnDay}`);
  assert.ok(result.maxDueOnAnyDay < 30, `workload dump maxDue=${result.maxDueOnAnyDay}`);
  const maxInterval = Math.max(0, ...result.final.topics.map((t) => t.interval_days || 0));
  assert.ok(maxInterval <= 21, `final_months max interval should be ≤21, got ${maxInterval}`);
});

test("unknown scenario names are rejected", () => {
  assert.throws(() => runScenario("always_correct"), /Unknown scenario/);
});
