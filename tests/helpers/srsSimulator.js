/**
 * Clock-controlled in-memory SRS student simulator (61-topic horizon pacing).
 * Used by tests and scripts/srsScenarioSimulator.mjs.
 */
import { addDaysISO } from "../../src/utils.js";
import {
  applySrsSession,
  createSeedSrsRow,
  summariseMasteryMatrix,
  collectSrsWarnings,
  WEEKLY_FORECAST_TARGET,
  TODAY_DUE_TARGET,
  WORKLOAD_SPIKE_THRESHOLD,
  LONG_INTERVAL_THRESHOLD_DAYS
} from "../../src/srsAnalytics.js";
import {
  planCurriculumIntros,
  resolveIntroDeadline,
  resolveExamDate,
  longIntervalThresholdForPreset,
  resolveBootstrapWeekTarget
} from "../../src/curriculumPace.js";
import {
  CURRICULUM_61,
  CURRICULUM_61_TOTAL,
  masteryBySubject
} from "./srsCurriculum61.js";

export {
  WEEKLY_FORECAST_TARGET,
  TODAY_DUE_TARGET,
  WORKLOAD_SPIKE_THRESHOLD,
  LONG_INTERVAL_THRESHOLD_DAYS,
  CURRICULUM_61,
  CURRICULUM_61_TOTAL
};

export const PACED_SCENARIO_NAMES = ["y10_pace_61", "y11_pace_61", "final_months_pace_61"];

/**
 * @typedef {{ id: string, subject?: string, topic_name?: string, spec_ref?: string }} SpecPoint
 * @typedef {(ctx: { dayIndex: number, today: string, topic: SpecPoint, state: object|null }) => number} QualityFn
 */

export function makeSpecPoints(count, subjects = ["biology", "chemistry", "physics"]) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const subject = subjects[i % subjects.length];
    points.push({
      id: `sp-${String(i + 1).padStart(3, "0")}`,
      subject,
      topic_name: `${subject} topic ${i + 1}`,
      spec_ref: `${subject.slice(0, 1).toUpperCase()}.${Math.floor(i / 3) + 1}.${(i % 3) + 1}`
    });
  }
  return points;
}

export class SrsSimulator {
  /**
   * @param {{ startDate?: string, specPoints?: SpecPoint[], userId?: string, horizonPreset?: string, targetExamDate?: string|null }} [opts]
   */
  constructor(opts = {}) {
    this.startDate = opts.startDate || "2026-09-01";
    this.today = this.startDate;
    this.dayIndex = 0;
    this.userId = opts.userId || "sim-user";
    this.specPoints = opts.specPoints || CURRICULUM_61;
    this.specById = new Map(this.specPoints.map((p) => [p.id, p]));
    /** @type {Map<string, object>} */
    this.srs = new Map();
    this.hasStartedPractice = false;
    this.history = [];
    this.unusedPool = this.specPoints.map((p) => p.id);
    this.horizonProfile = {
      revision_horizon_preset: opts.horizonPreset || "y11",
      target_exam_date: opts.targetExamDate || null,
      revision_pace_state: {}
    };
    this.maxNewIntrosOnDay = 0;
  }

  rows() {
    return [...this.srs.values()];
  }

  dueTopics(date = this.today) {
    return this.rows()
      .filter((r) => String(r.due_date || "").slice(0, 10) <= date)
      .map((r) => this.specById.get(r.spec_point_id))
      .filter(Boolean);
  }

  seedWeekForecast() {
    if (this.hasStartedPractice) {
      return { added: 0, reason: "practice_started" };
    }
    const weekTarget = resolveBootstrapWeekTarget(
      this.horizonProfile,
      this.today,
      this.specPoints.length
    );
    const existing = this.srs.size;
    const dueTodayCount = this.dueTopics(this.today).length;
    if (existing >= weekTarget && dueTodayCount >= TODAY_DUE_TARGET) {
      return { added: 0, reason: "sufficient", weekTarget };
    }

    const needMoreInWeek = Math.max(0, weekTarget - existing);
    const needDueToday = Math.max(0, TODAY_DUE_TARGET - dueTodayCount);
    let added = 0;

    for (let i = 0; i < needDueToday && this.unusedPool.length; i++) {
      const id = this.unusedPool.shift();
      this.srs.set(id, createSeedSrsRow(id, this.today, { userId: this.userId }));
      added++;
    }

    // Spread the rest across tomorrow…+6 only (do not pile more onto today).
    const stillNeed = Math.max(0, needMoreInWeek - needDueToday);
    for (let i = 0; i < stillNeed && this.unusedPool.length; i++) {
      const id = this.unusedPool.shift();
      const offset = 1 + (i % 6);
      const due = addDaysISO(this.today, offset);
      this.srs.set(id, createSeedSrsRow(id, due, { userId: this.userId }));
      added++;
    }

    return { added, reason: "seeded", weekTarget };
  }

  /**
   * Horizon-paced curriculum intro (mirrors introduceCurriculumTopics).
   * @param {{ afterPractice?: boolean }} [opts]
   */
  introduceCurriculumTopics(opts = {}) {
    const dueTodayCount = this.dueTopics(this.today).length;
    const plan = planCurriculumIntros({
      profile: this.horizonProfile,
      today: this.today,
      trackedCount: this.srs.size,
      eligibleCount: this.specPoints.length,
      dueTodayCount,
      paceStateRaw: this.horizonProfile.revision_pace_state
    });

    if (plan.toIntroduce <= 0 || !this.unusedPool.length) {
      return { added: 0, reason: plan.reason, plan, dueTodayCount };
    }

    let dueDate = this.today;
    if (opts.afterPractice && dueTodayCount === 0) {
      dueDate = addDaysISO(this.today, 1);
    }

    let added = 0;
    for (let i = 0; i < plan.toIntroduce && this.unusedPool.length; i++) {
      const id = this.unusedPool.shift();
      this.srs.set(id, createSeedSrsRow(id, dueDate, { userId: this.userId }));
      added++;
    }
    if (added > 0) {
      this.horizonProfile.revision_pace_state = plan.nextPaceState;
      this.maxNewIntrosOnDay = Math.max(this.maxNewIntrosOnDay, added);
    }
    return { added, reason: plan.reason, plan, dueTodayCount, dueDate };
  }

  /**
   * Practise all topics due on `today`.
   * @param {number|QualityFn} qualityOrFn
   * @param {{ maxTopics?: number, topUp?: boolean }} [opts]
   */
  practiseDueToday(qualityOrFn, opts = {}) {
    const maxTopics = opts.maxTopics ?? Infinity;
    const due = this.dueTopics(this.today).slice(0, maxTopics);
    const sessionResults = [];

    for (const topic of due) {
      const existing = this.srs.get(topic.id) || null;
      const quality =
        typeof qualityOrFn === "function"
          ? qualityOrFn({
              dayIndex: this.dayIndex,
              today: this.today,
              topic,
              state: existing
            })
          : qualityOrFn;

      const updated = applySrsSession(existing, quality, this.today, {
        specPointId: topic.id,
        userId: this.userId,
        horizonPreset: this.horizonProfile.revision_horizon_preset,
        profile: this.horizonProfile
      });
      this.srs.set(topic.id, updated);
      if (updated.repetitions > 0) {
        this.hasStartedPractice = true;
      }

      sessionResults.push({
        specPointId: topic.id,
        spec_ref: topic.spec_ref || topic.id,
        subject: topic.subject || null,
        topic_name: topic.topic_name || null,
        quality,
        due_date: updated.due_date,
        interval_days: updated.interval_days,
        repetitions: updated.repetitions,
        lapses: updated.lapses,
        ease_factor: updated.ease_factor
      });
    }

    let topUp = null;
    if (opts.topUp !== false) {
      topUp = this.introduceCurriculumTopics({ afterPractice: true });
    }

    const snap = this.snapshot();

    const dayRecord = {
      dayIndex: this.dayIndex,
      today: this.today,
      practised: sessionResults,
      topUp,
      snapshot: snap
    };
    this.history.push(dayRecord);
    return dayRecord;
  }

  advanceDays(n = 1) {
    this.today = addDaysISO(this.today, n);
    this.dayIndex += n;
    return this.today;
  }

  snapshot() {
    const schedules = this.rows();
    const matrix = summariseMasteryMatrix(this.specPoints, this.srs);
    const { forecast, warnings } = collectSrsWarnings(schedules, this.today, {
      horizonPreset: this.horizonProfile.revision_horizon_preset
    });
    const dueToday = this.dueTopics(this.today).length;
    const unattempted = matrix.counts["cell-unattempted"] || 0;
    return {
      today: this.today,
      dayIndex: this.dayIndex,
      curriculumSize: this.specPoints.length,
      trackedCount: schedules.length,
      unattempted,
      unusedPool: this.unusedPool.length,
      dueToday,
      matrixCounts: matrix.counts,
      matrixBySubject: masteryBySubject(matrix.cells),
      matrixCells: matrix.cells.filter((c) => c.stateClass !== "cell-unattempted"),
      forecast: {
        overdueCount: forecast.overdueCount,
        days: forecast.days.map((d) => ({
          dateString: d.dateString,
          dayLabel: d.dayLabel,
          count: d.count,
          items: d.items.map((i) => i.spec_point_id)
        })),
        maxCount: forecast.maxCount
      },
      warnings,
      topics: schedules.map((r) => {
        const point = this.specById.get(r.spec_point_id);
        return {
          spec_point_id: r.spec_point_id,
          subject: point?.subject || null,
          spec_ref: point?.spec_ref || null,
          topic_name: point?.topic_name || null,
          due_date: r.due_date,
          interval_days: r.interval_days,
          ease_factor: r.ease_factor,
          repetitions: r.repetitions,
          lapses: r.lapses,
          last_quality: r.last_quality,
          mastery: summariseMasteryMatrix(
            [point].filter(Boolean),
            new Map([[r.spec_point_id, r]])
          ).cells[0]?.stateClass
        };
      })
    };
  }
}

export const alwaysCorrect = () => 5;

/**
 * Early reviews are harder for real students — first attempt quality 3, then 4, then 5.
 * (SM-2 still uses fixed 1d / 6d for the first two successes; EF grows more slowly.)
 */
export function realisticLearningQuality({ state }) {
  const reps = state?.repetitions ?? 0;
  if (reps <= 0) return 3;
  if (reps === 1) return 4;
  return 5;
}

function horizonPresetForScenario(name) {
  if (name === "y10_pace_61") return "y10";
  if (name === "final_months_pace_61") return "final_months";
  return "y11";
}

function defaultDaysForScenario(name) {
  if (name === "y10_pace_61") return 600;
  if (name === "final_months_pace_61") return 90;
  return 250; // y11_pace_61
}

function defaultQualityForScenario(name) {
  if (name === "final_months_pace_61") return alwaysCorrect;
  return realisticLearningQuality;
}

/**
 * Run a paced 61-topic scenario (y10 / y11 / final_months).
 */
export function runScenario(name, opts = {}) {
  if (!PACED_SCENARIO_NAMES.includes(name)) {
    throw new Error(
      `Unknown scenario: ${name}. Expected one of: ${PACED_SCENARIO_NAMES.join(", ")}`
    );
  }

  const startDate = opts.startDate || "2026-09-01";
  const horizonPreset = opts.horizonPreset || horizonPresetForScenario(name);
  const days = opts.days ?? defaultDaysForScenario(name);
  const qualityFn = opts.qualityFn || defaultQualityForScenario(name);

  // Lock final_months exam at scenario start (mirrors persisting target_exam_date).
  let targetExamDate = opts.targetExamDate || null;
  if (!targetExamDate && horizonPreset === "final_months") {
    targetExamDate = resolveExamDate(
      { revision_horizon_preset: "final_months", target_exam_date: null },
      startDate
    );
  }

  const sim = new SrsSimulator({
    startDate,
    specPoints: opts.specPoints || CURRICULUM_61,
    horizonPreset,
    targetExamDate
  });

  /** @type {Map<string, number>} */
  const attemptCounts = new Map();

  sim.seedWeekForecast();

  for (let d = 0; d < days; d++) {
    sim.introduceCurriculumTopics({ afterPractice: false });
    const dayRecord = sim.practiseDueToday(qualityFn, { topUp: true });
    for (const p of dayRecord.practised || []) {
      attemptCounts.set(
        p.specPointId,
        (attemptCounts.get(p.specPointId) || 0) + 1
      );
    }
    if (d < days - 1) sim.advanceDays(1);
  }

  const final = sim.snapshot();
  const examDate = resolveExamDate(sim.horizonProfile, startDate);
  const introDeadline = resolveIntroDeadline(examDate, startDate, horizonPreset);

  final.topics = (final.topics || []).map((t) => ({
    ...t,
    attempts: attemptCounts.get(t.spec_point_id) || 0
  }));

  const preExamDueCounts = [];
  for (const h of sim.history) {
    if (h.today >= examDate) continue;
    preExamDueCounts.push(
      (h.snapshot?.dueToday ?? 0) + (h.snapshot?.forecast?.overdueCount ?? 0)
    );
    for (const day of h.snapshot?.forecast?.days || []) {
      if (day.dateString < examDate) preExamDueCounts.push(day.count);
    }
  }
  if (final.today < examDate) {
    preExamDueCounts.push(
      (final.dueToday ?? 0) + (final.forecast?.overdueCount ?? 0)
    );
    for (const day of final.forecast?.days || []) {
      if (day.dateString < examDate) preExamDueCounts.push(day.count);
    }
  }

  const practiceDays = sim.history
    .filter((h) => (h.practised || []).length > 0)
    .map((h) => ({
      date: h.today,
      items: (h.practised || []).map((p) => ({
        spec_ref: p.spec_ref,
        subject: p.subject,
        topic_name: p.topic_name,
        quality: p.quality,
        next_due: p.due_date,
        interval_days: p.interval_days
      }))
    }));

  return {
    name,
    startDate,
    days,
    curriculumSize: final.curriculumSize,
    examDate,
    introDeadline,
    maxNewIntrosOnDay: sim.maxNewIntrosOnDay,
    practiceDayCount: practiceDays.length,
    practiceDays,
    final,
    history: sim.history,
    maxDueOnAnyDay: Math.max(0, ...preExamDueCounts),
    longIntervalTopics: final.topics.filter(
      (t) =>
        (t.interval_days || 0) >= longIntervalThresholdForPreset(horizonPreset)
    ),
    allWarnings: [
      ...new Map(
        sim.history
          .flatMap((h) => h.snapshot?.warnings || [])
          .concat(final.warnings)
          .filter((w) => w.type === "workload_spike")
          .map((w) => [`${w.type}:${w.message}`, w])
      ).values()
    ]
  };
}

export function runAllScenarios(opts = {}) {
  return PACED_SCENARIO_NAMES.map((name) => runScenario(name, opts));
}
