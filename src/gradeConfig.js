/** GCSE current / target grade options and adaptive-offset mapping. */

import { SUBJECTS, normalizeTier } from "./sciencePath.js";

export const COMBINED_GRADE_OPTIONS = [
  "9/9",
  "9/8",
  "8/8",
  "8/7",
  "7/7",
  "7/6",
  "6/6",
  "6/5",
  "5/5",
  "5/4",
  "4/4",
  "4/3",
  "3/3",
  "3/2",
  "2/2",
  "2/1",
  "1/1"
];

export const TRIPLE_GRADE_OPTIONS = [9, 8, 7, 6, 5, 4, 3, 2, 1];

const COMBINED_SET = new Set(COMBINED_GRADE_OPTIONS);
const TRIPLE_SET = new Set(TRIPLE_GRADE_OPTIONS);

const DEFAULT_COMBINED = "5/5";
const DEFAULT_TRIPLE = 5;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function parseCombinedPair(value) {
  const m = String(value || "").match(/^([1-9])\/([1-9])$/);
  if (!m) return null;
  const high = Number(m[1]);
  const low = Number(m[2]);
  if (!COMBINED_SET.has(`${high}/${low}`)) return null;
  return { high, low };
}

function normalizeTripleNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return TRIPLE_SET.has(rounded) ? rounded : null;
}

export function defaultCurrentGrades(path) {
  if (path === "triple") {
    return { biology: DEFAULT_TRIPLE, chemistry: DEFAULT_TRIPLE, physics: DEFAULT_TRIPLE };
  }
  return { combined: DEFAULT_COMBINED };
}

export function defaultTargetGrades(path) {
  return defaultCurrentGrades(path);
}

export function normalizeCurrentGrades(raw, path = "combined") {
  const track = path === "triple" ? "triple" : "combined";
  if (track === "combined") {
    const value =
      typeof raw === "string"
        ? raw
        : raw && typeof raw === "object"
          ? raw.combined
          : null;
    const pair = parseCombinedPair(value);
    return { combined: pair ? `${pair.high}/${pair.low}` : DEFAULT_COMBINED };
  }

  const out = {};
  const src = raw && typeof raw === "object" ? raw : {};
  for (const subject of SUBJECTS) {
    out[subject] = normalizeTripleNumber(src[subject]) ?? DEFAULT_TRIPLE;
  }
  return out;
}

export function normalizeTargetGrades(raw, path = "combined") {
  return normalizeCurrentGrades(raw, path);
}

export function gradesMatchPath(grades, path) {
  if (!grades || typeof grades !== "object") return false;
  if (path === "triple") {
    return SUBJECTS.every((s) => normalizeTripleNumber(grades[s]) != null);
  }
  return parseCombinedPair(grades.combined) != null;
}

/** True when every target component is >= the matching current component. */
export function compareGrades(current, target, path) {
  const track = path === "triple" ? "triple" : "combined";
  const cur = normalizeCurrentGrades(current, track);
  const tgt = normalizeTargetGrades(target, track);

  if (track === "combined") {
    const a = parseCombinedPair(cur.combined);
    const b = parseCombinedPair(tgt.combined);
    if (!a || !b) return false;
    return b.high >= a.high && b.low >= a.low;
  }

  return SUBJECTS.every((s) => tgt[s] >= cur[s]);
}

/**
 * Combined: lower of the dual-award pair.
 * Triple: rounded average of the three subjects.
 */
export function primaryGradeNumber(grades, path) {
  const track = path === "triple" ? "triple" : "combined";
  const normalized = normalizeCurrentGrades(grades, track);

  if (track === "combined") {
    const pair = parseCombinedPair(normalized.combined);
    return pair ? Math.min(pair.high, pair.low) : DEFAULT_TRIPLE;
  }

  const sum = SUBJECTS.reduce((acc, s) => acc + normalized[s], 0);
  return Math.round(sum / SUBJECTS.length);
}

/**
 * Map a 1–9 grade into adaptive difficulty_offset [-2, +2] within FT/HT bands.
 * FT: 1→-2, 2→-1, 3→0, 4→0, 5+→+1
 * HT: ≤5→-2, 6→-1, 7→0, 8→+1, 9→+2
 */
export function gradeToDifficultyOffset(gradeNum, tier) {
  const g = clamp(Math.round(Number(gradeNum) || 5), 1, 9);
  const t = normalizeTier(tier);

  if (t === "HT") {
    if (g <= 5) return -2;
    if (g === 6) return -1;
    if (g === 7) return 0;
    if (g === 8) return 1;
    return 2;
  }

  if (g <= 1) return -2;
  if (g === 2) return -1;
  if (g === 3 || g === 4) return 0;
  return 1;
}

/**
 * Initial global adaptive offset from current grades.
 * Combined: preferred_tier + primary grade.
 * Triple: average of per-subject offsets (each subject uses its own tier).
 *
 * @param {object} grades - current_grades shape
 * @param {"combined"|"triple"} path
 * @param {string|object} tierOrSubjectTiers - preferred_tier string, or { biology, chemistry, physics } for triple
 */
export function initialAdaptiveOffsetFromGrades(grades, path, tierOrSubjectTiers) {
  const track = path === "triple" ? "triple" : "combined";
  const normalized = normalizeCurrentGrades(grades, track);

  if (track === "combined") {
    const tier =
      typeof tierOrSubjectTiers === "string"
        ? tierOrSubjectTiers
        : tierOrSubjectTiers?.preferred_tier || "FT";
    return gradeToDifficultyOffset(primaryGradeNumber(normalized, "combined"), tier);
  }

  const tiers =
    tierOrSubjectTiers && typeof tierOrSubjectTiers === "object"
      ? tierOrSubjectTiers
      : {};
  const offsets = SUBJECTS.map((s) =>
    gradeToDifficultyOffset(normalized[s], tiers[s] || "FT")
  );
  const avg = offsets.reduce((a, b) => a + b, 0) / offsets.length;
  return clamp(Math.round(avg), -2, 2);
}

export function formatGradesLabel(grades, path) {
  const track = path === "triple" ? "triple" : "combined";
  const normalized = normalizeCurrentGrades(grades, track);
  if (track === "combined") return normalized.combined;
  return SUBJECTS.map(
    (s) => `${s.charAt(0).toUpperCase()}${s.slice(1, 3)} ${normalized[s]}`
  ).join(" · ");
}
