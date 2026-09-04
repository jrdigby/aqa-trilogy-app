// Pure SRS analytics helpers shared by dashboard UI, tests, and the scenario simulator.
import { updateSRS } from "./evalEngine.js";
import { addDaysISO, formatShortDateISO, todayISO } from "./utils.js";
import {
  clampIntervalForExam,
  getHorizonSrsCaps,
  longIntervalThresholdForPreset,
  normalizeHorizonPreset,
  resolveExamDate
} from "./curriculumPace.js";

/** Queue / bootstrap targets (mirrors onboardingEngine). */
export const WEEKLY_FORECAST_TARGET = 6;
export const TODAY_DUE_TARGET = 2;
export const POST_PRACTICE_DUE_TODAY_TARGET = 2;
export const MAX_NEW_TOPICS_PER_TOPUP = 2;

/** Default SM-2 starting values (mirrors buildSrsRow / upsertSRS). */
export const DEFAULT_EASE_FACTOR = 2.5;
export const DEFAULT_INTERVAL_DAYS = 1;

/** Simulation warning thresholds. */
export const WORKLOAD_SPIKE_THRESHOLD = 5;
/** Legacy / final_months fallback when no horizon preset is passed. */
export const LONG_INTERVAL_THRESHOLD_DAYS = 21;

export { longIntervalThresholdForPreset };

/**
 * Human-readable due phrasing relative to today.
 * @param {string} dueDate — YYYY-MM-DD
 * @param {string} todayStr — YYYY-MM-DD
 * @returns {{ relative: "today"|"past"|"future"|"unknown", shortDate: string }}
 */
function dueDateRelative(dueDate, todayStr) {
  const shortDate = formatShortDateISO(dueDate);
  if (!dueDate || !shortDate) {
    return { relative: "unknown", shortDate: "" };
  }
  if (dueDate === todayStr) return { relative: "today", shortDate };
  if (dueDate < todayStr) return { relative: "past", shortDate };
  return { relative: "future", shortDate };
}

/**
 * Classify a mastery heatmap cell from an srs_state row (or null if untracked).
 * Matches renderMasteryHeatmap rules in uiComponents.js.
 *
 * Colours reflect current review readiness, not “last practised N days ago”.
 * Green “Secure” only applies while the SM-2 due date is still in the future;
 * overdue / due-today practised items surface as review-needed (amber).
 *
 * “Concept gap” (amber) means the SRS engine flagged struggling performance:
 * failed review (reps reset), collapsed interval, or ease factor below 2.0 —
 * not merely that a healthy topic is due.
 *
 * @param {object|null|undefined} srsRecord
 * @param {string} [today] — YYYY-MM-DD (defaults to local today)
 * @returns {{ stateClass: string, baseColor: string, borderStyle: string, label: string }}
 */
export function classifyMasteryCell(srsRecord, today = null) {
  if (!srsRecord) {
    return {
      stateClass: "cell-unattempted",
      baseColor: "#cbd5e1",
      borderStyle: "1px solid #94a3b8",
      label: "Not Attempted Yet"
    };
  }

  const todayStr = today || todayISO();
  const reps = srsRecord.repetitions ?? 0;
  const days = srsRecord.interval_days || 0;
  const lapses = srsRecord.lapses ?? 0;
  const lastQuality = srsRecord.last_quality ?? 0;
  const hasBeenPractised = reps > 0 || lapses > 0 || lastQuality > 0;
  const dueDate = String(srsRecord.due_date || "").slice(0, 10);
  const { relative, shortDate } = dueDateRelative(dueDate, todayStr);

  if (reps === 0 && !hasBeenPractised) {
    let label = "Scheduled (not practised yet)";
    if (relative === "today") {
      label = "Scheduled — first practice due today";
    } else if (relative === "past") {
      label = `Scheduled — first practice was due ${shortDate}`;
    } else if (relative === "future") {
      label = `Scheduled — first practice due ${shortDate}`;
    }
    return {
      stateClass: "cell-scheduled",
      baseColor: "#dbeafe",
      borderStyle: "1px solid #93c5fd",
      label
    };
  }

  if (reps === 0 || days === 0 || (srsRecord.ease_factor && srsRecord.ease_factor < 2.0)) {
    let label = "Concept gap — needs consolidation";
    if (relative === "today") {
      label = "Concept gap — due for review today";
    } else if (relative === "past") {
      label = `Concept gap — was due for review ${shortDate}`;
    } else if (relative === "future") {
      label = `Concept gap — due for review ${shortDate}`;
    }
    return {
      stateClass: "cell-gap",
      baseColor: "#f59e0b",
      borderStyle: "1px solid #d97706",
      label
    };
  }

  // Practised + healthy ease, but due now or overdue → not “secure” green.
  // Matches teacher portal: strengths require due_date > today.
  if (dueDate && dueDate <= todayStr) {
    return {
      stateClass: "cell-gap",
      baseColor: "#f59e0b",
      borderStyle: "1px solid #d97706",
      label:
        relative === "past"
          ? `Review overdue — was due ${shortDate}`
          : "Due for review today"
    };
  }

  const nextDue =
    relative === "future" && shortDate
      ? `next practice due ${shortDate}`
      : "next practice date unknown";

  if (days <= 3) {
    return {
      stateClass: "cell-mastery-l1",
      baseColor: "#bbf7d0",
      borderStyle: "1px solid #166534",
      label: `Secure — ${nextDue}`
    };
  }
  if (days <= 10) {
    return {
      stateClass: "cell-mastery-l2",
      baseColor: "#4ade80",
      borderStyle: "1px solid #166534",
      label: `Secure — ${nextDue}`
    };
  }
  return {
    stateClass: "cell-mastery-l3",
    baseColor: "#16a34a",
    borderStyle: "1px solid #166534",
    label: `Secure — ${nextDue}`
  };
}

/**
 * Bucket srs_state rows into Overdue + Today…+6 days (matches loadWeeklyForecast).
 *
 * @param {Array<{ due_date?: string, spec_point_id?: string, spec_points?: object }>} schedules
 * @param {string} today — YYYY-MM-DD
 * @returns {{
 *   today: string,
 *   overdueCount: number,
 *   overdueItems: object[],
 *   days: Array<{ dateString: string, dayLabel: string, count: number, items: object[] }>,
 *   maxCount: number
 * }}
 */
export function buildWeeklyForecast(schedules, today) {
  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = [];
  const countsMap = {};
  const itemsMap = {};

  for (let i = 0; i < 7; i++) {
    const dateString = addDaysISO(today, i);
    const targetDate = new Date(`${dateString}T00:00:00`);
    const dayLabel = i === 0 ? "Today" : weekdayNames[targetDate.getDay()];
    days.push({ dateString, dayLabel, count: 0, items: [] });
    countsMap[dateString] = 0;
    itemsMap[dateString] = [];
  }

  const overdueItems = [];
  let overdueCount = 0;

  (schedules || []).forEach((s) => {
    const dueDate = String(s.due_date || "").slice(0, 10);
    if (!dueDate) return;
    if (dueDate < today) {
      overdueCount++;
      overdueItems.push(s);
    } else if (countsMap[dueDate] !== undefined) {
      countsMap[dueDate]++;
      itemsMap[dueDate].push(s);
    }
  });

  days.forEach((d) => {
    d.count = countsMap[d.dateString];
    d.items = itemsMap[d.dateString];
  });

  const maxCount = Math.max(overdueCount, ...Object.values(countsMap), 1);

  return {
    today,
    overdueCount,
    overdueItems,
    days,
    maxCount
  };
}

/**
 * Apply one session-quality update to an in-memory SRS row (mirrors upsertSRS math).
 *
 * Horizon caps apply by default (y11). Pass `caps: null` for uncapped classic SM-2.
 * When exam date / profile / horizon is known, due dates are clamped to exam − 7d.
 *
 * @param {object|null|undefined} existing — current srs_state fields or null for new
 * @param {number} quality — session quality 0–5
 * @param {string} today — YYYY-MM-DD
 * @param {{
 *   specPointId?: string,
 *   userId?: string,
 *   caps?: object|null,
 *   horizonPreset?: string,
 *   examDate?: string,
 *   targetExamDate?: string|null,
 *   profile?: object
 * }} [opts]
 * @returns {object} updated srs_state-shaped row
 */
export function applySrsSession(existing, quality, today, opts = {}) {
  const ef = existing?.ease_factor ?? DEFAULT_EASE_FACTOR;
  const reps = existing?.repetitions ?? 0;
  const interval = existing?.interval_days ?? DEFAULT_INTERVAL_DAYS;
  const lapses = existing?.lapses ?? 0;
  const preset = normalizeHorizonPreset(
    opts.horizonPreset ?? opts.profile?.revision_horizon_preset
  );

  const caps =
    opts.caps === null ? null : opts.caps ?? getHorizonSrsCaps(preset);

  const upd = updateSRS({ quality, ef, reps, interval, caps });
  let newInterval = upd.newInterval;

  let examDate = opts.examDate ? String(opts.examDate).slice(0, 10) : null;
  if (!examDate && opts.profile) {
    examDate = resolveExamDate(opts.profile, today);
  } else if (!examDate && (opts.horizonPreset != null || opts.targetExamDate != null)) {
    examDate = resolveExamDate(
      {
        revision_horizon_preset: preset,
        target_exam_date: opts.targetExamDate ?? null
      },
      today
    );
  }

  if (examDate) {
    newInterval = clampIntervalForExam({
      today,
      intervalDays: newInterval,
      examDate,
      spreadKey: opts.specPointId ?? existing?.spec_point_id ?? null,
      quality
    });
  }

  const nextDue = addDaysISO(today, newInterval);

  return {
    user_id: opts.userId ?? existing?.user_id ?? null,
    spec_point_id: opts.specPointId ?? existing?.spec_point_id ?? null,
    due_date: nextDue,
    interval_days: newInterval,
    ease_factor: upd.newEF,
    repetitions: upd.newReps,
    lapses: lapses + upd.lapse,
    last_quality: quality,
    practice_difficulty_offset: existing?.practice_difficulty_offset ?? 0,
    updated_at: `${today}T12:00:00.000Z`
  };
}

/**
 * Create an initial seeded SRS row (mirrors onboarding buildSrsRow).
 */
export function createSeedSrsRow(specPointId, dueDate, opts = {}) {
  return {
    user_id: opts.userId ?? "sim-user",
    spec_point_id: specPointId,
    due_date: dueDate,
    interval_days: DEFAULT_INTERVAL_DAYS,
    ease_factor: DEFAULT_EASE_FACTOR,
    repetitions: 0,
    lapses: 0,
    last_quality: 0,
    practice_difficulty_offset: 0,
    updated_at: `${dueDate}T12:00:00.000Z`,
    ...(opts.meta || {})
  };
}

/**
 * Summarise mastery cell classes across a list of spec points + srs map.
 *
 * @param {Array<{ id: string }>} specPoints
 * @param {Map<string, object>|object[]} srsStates
 * @param {string} [today] — YYYY-MM-DD for overdue classification
 */
export function summariseMasteryMatrix(specPoints, srsStates, today = null) {
  const trackingMap = srsStates instanceof Map
    ? srsStates
    : new Map((srsStates || []).filter((s) => s?.spec_point_id).map((s) => [s.spec_point_id, s]));
  const todayStr = today || todayISO();

  const counts = {
    "cell-unattempted": 0,
    "cell-scheduled": 0,
    "cell-gap": 0,
    "cell-mastery-l1": 0,
    "cell-mastery-l2": 0,
    "cell-mastery-l3": 0
  };
  const cells = [];

  for (const point of specPoints || []) {
    const record = trackingMap.get(point.id) || null;
    const classified = classifyMasteryCell(record, todayStr);
    counts[classified.stateClass] = (counts[classified.stateClass] || 0) + 1;
    cells.push({
      specPointId: point.id,
      subject: point.subject || null,
      topic_name: point.topic_name || null,
      spec_ref: point.spec_ref || null,
      ...classified,
      srs: record
    });
  }

  return { counts, cells };
}

/**
 * Collect workload / forgetting warnings from current SRS rows relative to today.
 * Pass `horizonPreset` so “at ceiling” uses that horizon’s maxInterval.
 */
export function collectSrsWarnings(schedules, today, opts = {}) {
  const spikeThreshold = opts.workloadSpikeThreshold ?? WORKLOAD_SPIKE_THRESHOLD;
  const longIntervalDays =
    opts.longIntervalThresholdDays ??
    (opts.horizonPreset != null
      ? longIntervalThresholdForPreset(opts.horizonPreset)
      : LONG_INTERVAL_THRESHOLD_DAYS);
  const forecast = buildWeeklyForecast(schedules, today);
  const warnings = [];

  if (forecast.overdueCount >= spikeThreshold) {
    warnings.push({
      type: "workload_spike",
      message: `Overdue pile-up: ${forecast.overdueCount} topics (threshold ${spikeThreshold})`,
      count: forecast.overdueCount,
      date: null
    });
  }

  for (const day of forecast.days) {
    if (day.count >= spikeThreshold) {
      warnings.push({
        type: "workload_spike",
        message: `${day.dayLabel} (${day.dateString}): ${day.count} topics due (threshold ${spikeThreshold})`,
        count: day.count,
        date: day.dateString
      });
    }
  }

  const dueToday = forecast.days[0]?.count ?? 0;
  if (dueToday === 0 && forecast.overdueCount === 0) {
    warnings.push({
      type: "empty_today_queue",
      message: "No topics due today (caught up)",
      count: 0,
      date: today
    });
  }

  for (const row of schedules || []) {
    const interval = row.interval_days || 0;
    if (interval >= longIntervalDays) {
      warnings.push({
        type: "interval_at_ceiling",
        message: `Topic ${row.spec_point_id}: interval ${interval}d at horizon ceiling (${longIntervalDays}d)`,
        count: interval,
        date: row.due_date,
        specPointId: row.spec_point_id
      });
    }
  }

  return { forecast, warnings };
}
