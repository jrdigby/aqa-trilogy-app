import test from "node:test";
import assert from "node:assert/strict";
import { updateSRS, computeSessionQuality } from "../src/evalEngine.js";
import {
  classifyMasteryCell,
  buildWeeklyForecast,
  applySrsSession,
  createSeedSrsRow
} from "../src/srsAnalytics.js";
import { addDaysISO } from "../src/utils.js";

test("updateSRS fail (quality < 3) resets reps, sets interval 1, marks lapse", () => {
  const upd = updateSRS({ quality: 1, ef: 2.5, reps: 4, interval: 15 });
  assert.equal(upd.newReps, 0);
  assert.equal(upd.newInterval, 1);
  assert.equal(upd.lapse, 1);
  assert.ok(upd.newEF < 2.5);
});

test("updateSRS quality 0 also fails", () => {
  const upd = updateSRS({ quality: 0, ef: 2.5, reps: 2, interval: 6 });
  assert.equal(upd.newReps, 0);
  assert.equal(upd.newInterval, 1);
  assert.equal(upd.lapse, 1);
});

test("updateSRS first success: reps=1, interval=1", () => {
  const upd = updateSRS({ quality: 5, ef: 2.5, reps: 0, interval: 1 });
  assert.equal(upd.newReps, 1);
  assert.equal(upd.newInterval, 1);
  assert.equal(upd.lapse, 0);
  assert.ok(upd.newEF > 2.5);
});

test("updateSRS second success: reps=2, interval=6", () => {
  const afterFirst = updateSRS({ quality: 4, ef: 2.5, reps: 0, interval: 1 });
  const afterSecond = updateSRS({
    quality: 4,
    ef: afterFirst.newEF,
    reps: afterFirst.newReps,
    interval: afterFirst.newInterval
  });
  assert.equal(afterSecond.newReps, 2);
  assert.equal(afterSecond.newInterval, 6);
  assert.equal(afterSecond.lapse, 0);
});

test("updateSRS later success: interval = round(interval * newEF)", () => {
  const ef = 2.5;
  const quality = 5;
  const expectedEF = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  const upd = updateSRS({ quality, ef, reps: 2, interval: 6 });
  assert.equal(upd.newReps, 3);
  assert.equal(upd.newInterval, Math.round(6 * expectedEF));
  assert.equal(upd.newEF, expectedEF);
});

test("updateSRS does not clamp ease factor (documents current behaviour)", () => {
  let ef = 1.5;
  let reps = 0;
  let interval = 1;
  for (let i = 0; i < 8; i++) {
    const upd = updateSRS({ quality: 0, ef, reps, interval });
    ef = upd.newEF;
    reps = upd.newReps;
    interval = upd.newInterval;
  }
  assert.ok(ef < 1.3, `EF fell below classic SM-2 floor without clamping: ${ef}`);
});

test("computeSessionQuality thresholds map pass rates to 5/4/3/1/0", () => {
  assert.equal(computeSessionQuality([]), 0);
  assert.equal(computeSessionQuality([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]), 5); // 100%
  assert.equal(computeSessionQuality([5, 5, 5, 5, 5, 5, 5, 5, 5, 1]), 5); // 90%
  assert.equal(computeSessionQuality([5, 5, 5, 5, 5, 5, 5, 1, 1, 1]), 4); // 70%
  assert.equal(computeSessionQuality([5, 5, 5, 5, 5, 1, 1, 1, 1, 1]), 3); // 50%
  assert.equal(computeSessionQuality([5, 5, 5, 1, 1, 1, 1, 1, 1, 1]), 1); // 30%
  assert.equal(computeSessionQuality([5, 5, 1, 1, 1, 1, 1, 1, 1, 1]), 0); // 20%
  assert.equal(computeSessionQuality([5, 1, 1, 1, 1, 1, 1, 1, 1, 1]), 0); // 10%
});

test("computeSessionQuality treats quality >= 3 as pass", () => {
  assert.equal(computeSessionQuality([3, 3, 3, 3]), 5);
  assert.equal(computeSessionQuality([2, 2, 2, 2]), 0);
});

test("classifyMasteryCell matches dashboard rules", () => {
  const today = "2026-09-04";
  assert.equal(classifyMasteryCell(null).stateClass, "cell-unattempted");
  const scheduled = classifyMasteryCell(createSeedSrsRow("sp1", "2026-08-01"), today);
  assert.equal(scheduled.stateClass, "cell-scheduled");
  assert.match(scheduled.label, /first practice was due/);
  assert.equal(
    classifyMasteryCell({
      repetitions: 0,
      interval_days: 1,
      lapses: 1,
      last_quality: 1,
      ease_factor: 2.3,
      due_date: "2026-09-10"
    }, today).stateClass,
    "cell-gap"
  );
  assert.equal(
    classifyMasteryCell({
      repetitions: 2,
      interval_days: 6,
      lapses: 0,
      last_quality: 5,
      ease_factor: 2.6,
      due_date: "2026-09-10"
    }, today).stateClass,
    "cell-mastery-l2"
  );
  assert.equal(
    classifyMasteryCell({
      repetitions: 3,
      interval_days: 15,
      lapses: 0,
      last_quality: 5,
      ease_factor: 2.6,
      due_date: "2026-09-20"
    }, today).stateClass,
    "cell-mastery-l3"
  );
  assert.equal(
    classifyMasteryCell({
      repetitions: 1,
      interval_days: 1,
      lapses: 0,
      last_quality: 5,
      ease_factor: 1.9,
      due_date: "2026-09-10"
    }, today).stateClass,
    "cell-gap"
  );
});

test("classifyMasteryCell labels include due dates", () => {
  const today = "2026-09-04";

  const scheduledFuture = classifyMasteryCell(
    createSeedSrsRow("sp1", "2026-09-12"),
    today
  );
  assert.equal(scheduledFuture.stateClass, "cell-scheduled");
  assert.equal(scheduledFuture.label, "Scheduled — first practice due 12 Sep");

  const gapPast = classifyMasteryCell({
    repetitions: 0,
    interval_days: 1,
    lapses: 1,
    last_quality: 1,
    ease_factor: 2.3,
    due_date: "2026-06-30"
  }, today);
  assert.equal(gapPast.stateClass, "cell-gap");
  assert.equal(gapPast.label, "Concept gap — was due for review 30 Jun");

  const overdue = classifyMasteryCell({
    repetitions: 1,
    interval_days: 1,
    lapses: 0,
    last_quality: 5,
    ease_factor: 2.5,
    due_date: "2026-06-30"
  }, today);
  assert.equal(overdue.stateClass, "cell-gap");
  assert.equal(overdue.label, "Review overdue — was due 30 Jun");

  const dueToday = classifyMasteryCell({
    repetitions: 2,
    interval_days: 6,
    lapses: 0,
    last_quality: 5,
    ease_factor: 2.6,
    due_date: today
  }, today);
  assert.equal(dueToday.stateClass, "cell-gap");
  assert.equal(dueToday.label, "Due for review today");

  const stillSecure = classifyMasteryCell({
    repetitions: 1,
    interval_days: 1,
    lapses: 0,
    last_quality: 5,
    ease_factor: 2.5,
    due_date: "2026-09-05"
  }, today);
  assert.equal(stillSecure.stateClass, "cell-mastery-l1");
  assert.equal(stillSecure.label, "Secure — next practice due 5 Sep");
});

test("applySrsSession mirrors upsertSRS due_date = today + newInterval", () => {
  const today = "2026-08-07";
  const seeded = createSeedSrsRow("topic-a", today);
  const afterPass = applySrsSession(seeded, 5, today, { specPointId: "topic-a" });
  assert.equal(afterPass.repetitions, 1);
  assert.equal(afterPass.interval_days, 1);
  assert.equal(afterPass.due_date, addDaysISO(today, 1));
  assert.equal(afterPass.last_quality, 5);
  assert.equal(afterPass.lapses, 0);

  const afterSecond = applySrsSession(afterPass, 5, afterPass.due_date);
  assert.equal(afterSecond.repetitions, 2);
  assert.equal(afterSecond.interval_days, 6);
  assert.equal(afterSecond.due_date, addDaysISO(afterPass.due_date, 6));

  const afterFail = applySrsSession(afterSecond, 1, afterSecond.due_date);
  assert.equal(afterFail.repetitions, 0);
  assert.equal(afterFail.interval_days, 1);
  assert.equal(afterFail.lapses, 1);
  assert.equal(afterFail.due_date, addDaysISO(afterSecond.due_date, 1));
});

test("applySrsSession clamps due date to exam when horizon known", () => {
  const today = "2027-04-20";
  const row = {
    ...createSeedSrsRow("topic-a", today),
    repetitions: 5,
    interval_days: 42,
    ease_factor: 2.6
  };
  const after = applySrsSession(row, 5, today, {
    specPointId: "topic-a",
    horizonPreset: "y11",
    examDate: "2027-05-11"
  });
  assert.ok(after.interval_days >= 1 && after.interval_days <= 21);
  assert.ok(after.due_date <= "2027-05-11", `due ${after.due_date} should be ≤ exam`);
});

test("applySrsSession defaults to y11 caps (no 147d runaway)", () => {
  let row = createSeedSrsRow("topic-a", "2026-09-01");
  let today = "2026-09-01";
  for (let i = 0; i < 8; i++) {
    row = applySrsSession(row, 5, today, { specPointId: "topic-a" });
    today = row.due_date;
  }
  assert.ok(row.interval_days <= 42, `expected ≤42, got ${row.interval_days}`);
});

test("buildWeeklyForecast buckets overdue and next 7 days", () => {
  const today = "2026-08-07";
  const schedules = [
    { spec_point_id: "a", due_date: "2026-08-05" },
    { spec_point_id: "b", due_date: "2026-08-07" },
    { spec_point_id: "c", due_date: "2026-08-09" },
    { spec_point_id: "d", due_date: "2026-08-20" }
  ];
  const forecast = buildWeeklyForecast(schedules, today);
  assert.equal(forecast.overdueCount, 1);
  assert.equal(forecast.days[0].count, 1); // today
  assert.equal(forecast.days[2].count, 1); // +2 days
  const inWindow = forecast.days.reduce((n, d) => n + d.count, 0);
  assert.equal(inWindow, 2);
  assert.ok(forecast.maxCount >= 1);
});
