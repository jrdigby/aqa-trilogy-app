/**
 * Horizon-aware curriculum introduction pacing.
 * Exam anchor: first GCSE science paper ≈ 11 May.
 * Earliest signup: September of the academic year.
 */
import { addDaysISO } from "./utils.js";

export const EXAM_MONTH = 5;
export const EXAM_DAY = 11;
export const INTRO_BUFFER_WEEKS = 4;
/** Final-months: keep introducing until closer to the paper so all topics fit. */
export const FINAL_MONTHS_INTRO_BUFFER_WEEKS = 1;
export const MAX_WEEKLY_NEW = 5;
/** Hard ceiling when the horizon requires a faster drip than MAX_WEEKLY_NEW. */
export const ABSOLUTE_MAX_WEEKLY_NEW = 12;
export const DEFAULT_DAILY_NEW_CAP = 1;
export const SHORT_HORIZON_WEEKS = 8;
export const SHORT_HORIZON_DAILY_CAP = 2;
export const SOFT_DUE_LOAD = 4;
export const FINAL_MONTHS_WEEKS = 12;
/** Do not schedule next review after exam − this many days. */
export const EXAM_REVIEW_BUFFER_DAYS = 7;

export const HORIZON_PRESETS = ["y10", "y11", "final_months"];

/** Comfortable first-week starter count when many weeks remain until exams. */
export const BOOTSTRAP_WEEK_MIN = 6;

/**
 * SM-2 clamps per revision horizon (stops 147/456-day runaway).
 * @returns {{ maxInterval: number, efFloor: number, efCeil: number, softGrowthMult: number, softGrowthAfterReps: number }}
 */
export function getHorizonSrsCaps(preset) {
  const p = normalizeHorizonPreset(preset);
  if (p === "final_months") {
    return {
      maxInterval: 21,
      efFloor: 1.3,
      efCeil: 2.5,
      softGrowthMult: 2.0,
      softGrowthAfterReps: 3
    };
  }
  if (p === "y10") {
    return {
      maxInterval: 60,
      efFloor: 1.3,
      efCeil: 2.7,
      softGrowthMult: 2.0,
      softGrowthAfterReps: 3
    };
  }
  // y11
  return {
    maxInterval: 42,
    efFloor: 1.3,
    efCeil: 2.6,
    softGrowthMult: 2.0,
    softGrowthAfterReps: 3
  };
}

/** Long-interval / at-ceiling warning threshold = horizon max interval. */
export function longIntervalThresholdForPreset(preset) {
  return getHorizonSrsCaps(preset).maxInterval;
}

/**
 * Round-robin items by subject (default biology → chemistry → physics).
 * Relative order within each subject is preserved. Unknown subjects append at the end.
 *
 * @template {{ subject?: string }} T
 * @param {T[]} items
 * @param {string[]} [subjectOrder]
 * @returns {T[]}
 */
export function interleaveBySubject(
  items,
  subjectOrder = ["biology", "chemistry", "physics"]
) {
  const queues = Object.fromEntries(subjectOrder.map((s) => [s, []]));
  const other = [];
  for (const item of items || []) {
    const s = String(item?.subject || "").toLowerCase();
    if (queues[s]) queues[s].push(item);
    else other.push(item);
  }
  const out = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (const s of subjectOrder) {
      if (queues[s].length) {
        out.push(queues[s].shift());
        progress = true;
      }
    }
  }
  return out.concat(other);
}

/** Whole calendar days from `fromISO` to `toISO` (can be negative). */
export function daysBetweenISO(fromISO, toISO) {
  const a = new Date(`${String(fromISO).slice(0, 10)}T00:00:00`);
  const b = new Date(`${String(toISO).slice(0, 10)}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Cap SM-2 interval so next due is not after the exam.
 * In the final review window (exam − buffer … exam):
 *   - pass (quality ≥ 3, or quality omitted): park until the day after the exam
 *   - fail (quality < 3): due tomorrow for retry
 * Before that window, compress to the exam date and spread by `spreadKey` to avoid cliffs.
 */
export function clampIntervalForExam({
  today,
  intervalDays,
  examDate,
  bufferDays = EXAM_REVIEW_BUFFER_DAYS,
  spreadKey = null,
  quality = null
}) {
  if (!examDate || intervalDays == null) return intervalDays;
  const exam = String(examDate).slice(0, 10);
  const finalWindowStart = addDaysISO(exam, -bufferDays);

  if (today >= exam) {
    return Math.min(Math.max(1, intervalDays), 1);
  }

  if (today >= finalWindowStart) {
    if (quality != null && quality < 3) return 1;
    // Park after the paper; spread restart across the following week.
    const daysToPostExam = Math.max(1, daysBetweenISO(today, exam) + 1);
    if (spreadKey != null) {
      const hash = [...String(spreadKey)].reduce(
        (a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0,
        0
      );
      return daysToPostExam + (Math.abs(hash) % 7);
    }
    return daysToPostExam;
  }

  const maxDays = Math.max(1, daysBetweenISO(today, exam));
  if (intervalDays < maxDays) {
    return intervalDays;
  }
  if (maxDays > 1 && spreadKey != null) {
    const hash = [...String(spreadKey)].reduce(
      (a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0,
      0
    );
    return 1 + (Math.abs(hash) % maxDays);
  }
  return maxDays;
}

/**
 * @param {string} iso YYYY-MM-DD
 * @returns {{ y: number, m: number, d: number }}
 */
export function parseISODate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

export function formatISODate(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Academic year start (1 Sept) containing or preceding `today`. */
export function academicYearStartISO(today) {
  const { y, m } = parseISODate(today);
  if (m >= 9) return formatISODate(y, 9, 1);
  return formatISODate(y - 1, 9, 1);
}

/** Next 11 May on or after `today`. */
export function nextMay11OnOrAfter(today) {
  const { y } = parseISODate(today);
  const thisYear = formatISODate(y, EXAM_MONTH, EXAM_DAY);
  if (today <= thisYear) return thisYear;
  return formatISODate(y + 1, EXAM_MONTH, EXAM_DAY);
}

/**
 * Normalize preset string.
 * @param {string|null|undefined} preset
 * @returns {'y10'|'y11'|'final_months'}
 */
export function normalizeHorizonPreset(preset) {
  const p = String(preset || "y11").toLowerCase();
  if (p === "y10" || p === "final_months") return p;
  return "y11";
}

/**
 * Derive effective exam date from profile fields.
 * @param {{ revision_horizon_preset?: string, target_exam_date?: string|null }} profile
 * @param {string} today YYYY-MM-DD
 */
export function resolveExamDate(profile, today) {
  const override = profile?.target_exam_date
    ? String(profile.target_exam_date).slice(0, 10)
    : null;
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) {
    return override;
  }

  const preset = normalizeHorizonPreset(profile?.revision_horizon_preset);
  if (preset === "y10") {
    // Sept Y10 → May of exam year = two Mays ahead from AY start year
    // AY start 2026-09-01 → exam 2028-05-11
    const ayStart = academicYearStartISO(today);
    const ayYear = parseISODate(ayStart).y;
    return formatISODate(ayYear + 2, EXAM_MONTH, EXAM_DAY);
  }
  if (preset === "final_months") {
    const in12 = addDaysISO(today, FINAL_MONTHS_WEEKS * 7);
    const nextMay = nextMay11OnOrAfter(today);
    return in12 < nextMay ? in12 : nextMay;
  }
  // y11: next 11 May
  return nextMay11OnOrAfter(today);
}

/**
 * Stable exam date to persist on the profile.
 * Final-months must lock a concrete date (otherwise today+12w slides forever and
 * curriculum coverage never finishes).
 * @param {{ revision_horizon_preset?: string, target_exam_date?: string|null }} profile
 * @param {string} today
 */
export function examDateToPersist(profile, today) {
  const existing = profile?.target_exam_date
    ? String(profile.target_exam_date).slice(0, 10)
    : null;
  if (existing && /^\d{4}-\d{2}-\d{2}$/.test(existing)) return existing;
  return resolveExamDate(
    { ...(profile || {}), target_exam_date: null },
    today
  );
}

/**
 * Last day to introduce new topics (exam − buffer), at least 1 week from today.
 * Final-months uses a 1-week buffer so the short horizon can still cover the curriculum.
 * @param {string} examDate
 * @param {string} today
 * @param {{ revision_horizon_preset?: string }|string|null} [profileOrPreset]
 */
export function resolveIntroDeadline(examDate, today, profileOrPreset = null) {
  const preset =
    typeof profileOrPreset === "string"
      ? normalizeHorizonPreset(profileOrPreset)
      : normalizeHorizonPreset(profileOrPreset?.revision_horizon_preset);
  const bufferWeeks =
    preset === "final_months" ? FINAL_MONTHS_INTRO_BUFFER_WEEKS : INTRO_BUFFER_WEEKS;
  let deadline = addDaysISO(examDate, -(bufferWeeks * 7));
  const minDeadline = addDaysISO(today, 7);
  if (deadline < minDeadline) deadline = minDeadline;
  if (deadline < today) deadline = today;
  return deadline;
}

/** Whole weeks from today to deadline (at least 1). */
export function weeksUntil(deadline, today) {
  const t0 = new Date(`${today}T00:00:00`);
  const t1 = new Date(`${deadline}T00:00:00`);
  const days = Math.max(0, Math.round((t1 - t0) / 86400000));
  return Math.max(1, Math.ceil(days / 7));
}

/**
 * ISO week key YYYY-Www (Monday-based week containing `today`).
 */
export function isoWeekKey(today) {
  const d = new Date(`${today}T00:00:00`);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Weekly new-topic budget so remaining topics finish by the intro deadline.
 * Comfortable horizons stay near MAX_WEEKLY_NEW; crunch raises up to ABSOLUTE_MAX_WEEKLY_NEW.
 * @param {{ untracked: number, weeksLeft: number }} args
 */
export function computeWeeklyIntroBudget({ untracked, weeksLeft }) {
  const u = Math.max(0, Number(untracked) || 0);
  const w = Math.max(1, Number(weeksLeft) || 1);
  if (u === 0) return 0;
  const needed = Math.ceil(u / w);
  return Math.min(ABSOLUTE_MAX_WEEKLY_NEW, needed);
}

/**
 * First-week seed/bootstrap target from signup date → exam horizon.
 * Early Y10 (many weeks left) stays at BOOTSTRAP_WEEK_MIN; later signup / shorter
 * horizons raise toward the weekly intro need (capped at ABSOLUTE_MAX_WEEKLY_NEW).
 *
 * @param {{ revision_horizon_preset?: string, target_exam_date?: string|null }} profile
 * @param {string} today YYYY-MM-DD
 * @param {number} [eligibleCount=61]
 */
export function resolveBootstrapWeekTarget(profile, today, eligibleCount = 61) {
  const examDate = resolveExamDate(profile || {}, today);
  const introDeadline = resolveIntroDeadline(examDate, today, profile);
  const weeksLeft = weeksUntil(introDeadline, today);
  const untracked = Math.max(1, Number(eligibleCount) || 61);
  const weeklyBudget = computeWeeklyIntroBudget({ untracked, weeksLeft });
  return Math.max(BOOTSTRAP_WEEK_MIN, Math.min(ABSOLUTE_MAX_WEEKLY_NEW, weeklyBudget));
}

/**
 * @param {number} weeksLeft
 * @param {number} [weeklyBudget]
 */
export function dailyNewCapForWeeksLeft(weeksLeft, weeklyBudget = 0) {
  const budget = Number(weeklyBudget) || 0;
  const crunch = weeksLeft < SHORT_HORIZON_WEEKS || budget > MAX_WEEKLY_NEW;
  if (crunch) {
    const fromBudget = Math.ceil(budget / 5);
    return Math.min(4, Math.max(SHORT_HORIZON_DAILY_CAP, fromBudget || SHORT_HORIZON_DAILY_CAP));
  }
  return DEFAULT_DAILY_NEW_CAP;
}

/**
 * Normalize revision_pace_state from profile for the current day/week.
 * @param {object|null|undefined} raw
 * @param {string} today
 */
export function normalizePaceState(raw, today) {
  const weekKey = isoWeekKey(today);
  const state = raw && typeof raw === "object" ? raw : {};
  const sameWeek = state.weekKey === weekKey;
  const sameDay = state.today === today;
  return {
    weekKey,
    today,
    introsThisWeek: sameWeek ? Math.max(0, Number(state.introsThisWeek) || 0) : 0,
    introsToday: sameDay ? Math.max(0, Number(state.introsToday) || 0) : 0
  };
}

/**
 * Decide how many new topics to introduce today (0 or more, capped).
 *
 * @param {object} args
 * @param {object} args.profile
 * @param {string} args.today
 * @param {number} args.trackedCount
 * @param {number} args.eligibleCount
 * @param {number} args.dueTodayCount — reviews already due (not counting pending intros)
 * @param {object} [args.paceStateRaw]
 * @returns {{
 *   examDate: string,
 *   introDeadline: string,
 *   weeksLeft: number,
 *   untracked: number,
 *   weeklyBudget: number,
 *   introsThisWeek: number,
 *   introsToday: number,
 *   dailyCap: number,
 *   dueTodayCount: number,
 *   toIntroduce: number,
 *   reason: string,
 *   nextPaceState: object
 * }}
 */
export function planCurriculumIntros({
  profile,
  today,
  trackedCount,
  eligibleCount,
  dueTodayCount,
  paceStateRaw
}) {
  const examDate = resolveExamDate(profile || {}, today);
  const introDeadline = resolveIntroDeadline(examDate, today, profile);
  const weeksLeft = weeksUntil(introDeadline, today);
  const untracked = Math.max(0, (Number(eligibleCount) || 0) - (Number(trackedCount) || 0));
  const weeklyBudget = computeWeeklyIntroBudget({ untracked, weeksLeft });
  const pace = normalizePaceState(paceStateRaw ?? profile?.revision_pace_state, today);
  const dailyCap = dailyNewCapForWeeksLeft(weeksLeft, weeklyBudget);
  const due = Math.max(0, Number(dueTodayCount) || 0);
  const crunch =
    weeksLeft < SHORT_HORIZON_WEEKS || weeklyBudget > MAX_WEEKLY_NEW;

  const base = {
    examDate,
    introDeadline,
    weeksLeft,
    untracked,
    weeklyBudget,
    introsThisWeek: pace.introsThisWeek,
    introsToday: pace.introsToday,
    dailyCap,
    dueTodayCount: due,
    nextPaceState: {
      weekKey: pace.weekKey,
      today: pace.today,
      introsThisWeek: pace.introsThisWeek,
      introsToday: pace.introsToday
    }
  };

  if (untracked <= 0) {
    return { ...base, toIntroduce: 0, reason: "coverage_complete" };
  }
  if (pace.introsThisWeek >= weeklyBudget) {
    return { ...base, toIntroduce: 0, reason: "week_budget_met" };
  }
  if (pace.introsToday >= dailyCap) {
    return { ...base, toIntroduce: 0, reason: "daily_cap_met" };
  }
  // Soft-defer only when the horizon is comfortable; crunch must still cover.
  if (due > SOFT_DUE_LOAD && !crunch) {
    return { ...base, toIntroduce: 0, reason: "defer_heavy_review_day" };
  }

  const remainingWeek = weeklyBudget - pace.introsThisWeek;
  const remainingDay = dailyCap - pace.introsToday;
  const toIntroduce = Math.min(remainingWeek, remainingDay);

  if (toIntroduce <= 0) {
    return { ...base, toIntroduce: 0, reason: "no_slot" };
  }

  return {
    ...base,
    toIntroduce,
    reason: "introduce",
    nextPaceState: {
      weekKey: pace.weekKey,
      today: pace.today,
      introsThisWeek: pace.introsThisWeek + toIntroduce,
      introsToday: pace.introsToday + toIntroduce
    }
  };
}

export function horizonPresetLabel(preset) {
  const p = normalizeHorizonPreset(preset);
  if (p === "y10") return "Starting Year 10 (~2 years to exams)";
  if (p === "final_months") return "Final months before exams";
  return "Starting Year 11 (~1 academic year)";
}
