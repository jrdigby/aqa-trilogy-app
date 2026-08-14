/**
 * Default recipe matrix for syllabus-wide Gemini batch generation (per spec point).
 * Numeric questions use the Batch Numeric Generator — not included here.
 * Low-demand MCQs can also be produced locally via batch-generate-mcq-template.mjs
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

/** Template-only low MCQs (local, no Gemini) — chemistry first */
export const TEMPLATE_MCQ_BATCH_RECIPES = [
  { question_type: "mcq", demand_level: "low", count: 3 }
];

/** 19 Gemini + template questions per spec point when both pipelines run */
export const SYLLABUS_BATCH_QUESTIONS_PER_SPEC = SYLLABUS_BATCH_RECIPES.reduce(
  (n, r) => n + (r.count || 0),
  0
);

export const TEMPLATE_MCQ_QUESTIONS_PER_SPEC = TEMPLATE_MCQ_BATCH_RECIPES.reduce(
  (n, r) => n + (r.count || 0),
  0
);
