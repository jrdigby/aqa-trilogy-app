/**
 * Default recipe matrix for syllabus-wide batch generation (per spec point).
 * Numeric questions use the Batch Numeric Generator — not included here.
 */

export const SYLLABUS_BATCH_RECIPES = [
  { question_type: "mcq", demand_level: "low", count: 3 },
  { question_type: "mcq", demand_level: "standard", count: 2 },
  { question_type: "mcq", demand_level: "standard_45", count: 2 },
  { question_type: "short_text", demand_level: "low", count: 3 },
  { question_type: "short_text", demand_level: "standard", count: 2 },
  { question_type: "short_text", demand_level: "standard_45", count: 2 }
];

/** 14 questions per spec point */
export const SYLLABUS_BATCH_QUESTIONS_PER_SPEC = SYLLABUS_BATCH_RECIPES.reduce(
  (n, r) => n + (r.count || 0),
  0
);
