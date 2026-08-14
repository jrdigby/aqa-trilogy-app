/**
 * Default recipe matrix for syllabus-wide Gemini batch generation (per spec point).
 * Numeric questions use the Batch Numeric Generator — not included here.
 */

export const SYLLABUS_BATCH_RECIPES = [
  { question_type: "mcq", demand_level: "low", count: 3 },
  { question_type: "mcq", demand_level: "standard", count: 3 },
  { question_type: "mcq", demand_level: "standard_45", count: 2 },
  { question_type: "short_text", demand_level: "standard_45", max_marks: 1, count: 3 },
  { question_type: "extended_response", demand_level: "standard_45", max_marks: 4, count: 2 },
  { question_type: "extended_response", demand_level: "standard_67", max_marks: 4, count: 2 },
  { question_type: "extended_response", demand_level: "high_89", max_marks: 4, count: 2 },
  { question_type: "extended_response", demand_level: "standard_67", max_marks: 6, count: 2 }
];

/** @deprecated Template MCQ batch discontinued — kept for reference only */
export const TEMPLATE_MCQ_BATCH_RECIPES = [
  { question_type: "mcq", demand_level: "low", count: 3 }
];

/** 19 Gemini questions per spec point */
export const SYLLABUS_BATCH_QUESTIONS_PER_SPEC = SYLLABUS_BATCH_RECIPES.reduce(
  (n, r) => n + (r.count || 0),
  0
);

export const TEMPLATE_MCQ_QUESTIONS_PER_SPEC = TEMPLATE_MCQ_BATCH_RECIPES.reduce(
  (n, r) => n + (r.count || 0),
  0
);
