/**
 * Student-only safeguarding helpers for AI-marked long answers.
 * Keep phrase lists in sync with supabase/functions/mark-long-answer/index.ts.
 */

export const OFF_TOPIC_FEEDBACK_MESSAGE =
  "Please submit a science-related answer to receive feedback.";

/** Science contexts that contain words otherwise treated as concerning. */
const SCIENCE_SAFE_PHRASE_RES = [
  /suicide\s+gene/gi,
  /programmed\s+cell\s+death/gi,
  /cell\s+suicid\w*/gi,
  /apoptosis/gi,
  /kill(?:s|ing|ed)?\s+(?:the\s+)?(?:bacteria|bacterium|pathogen(?:s)?|microbe(?:s)?|micro[\s-]?organism(?:s)?|virus(?:es)?|fungi|fungus|weed(?:s)?|pest(?:s)?|cell(?:s)?|cancer|tumou?rs?)/gi,
  /antibiotics?\s+kill/gi,
  /disinfectant(?:s)?\s+kill/gi,
  /white\s+blood\s+cells?\s+kill/gi
];

const CONCERNING_PATTERNS = [
  /\bkill(?:ing)?\s+myself\b/i,
  /\bend\s+my\s+(?:own\s+)?life\b/i,
  /\btake\s+my\s+own\s+life\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bself[-\s]?harm(?:ing)?\b/i,
  /\bcut(?:ting)?\s+myself\b/i,
  /\bhurt(?:ing)?\s+myself\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bi\s+(?:just\s+)?want\s+to\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+(?:live|be\s+alive)\b/i,
  /\bi\s+wish\s+i\s+(?:was|were)\s+dead\b/i,
  /\bgoing\s+to\s+kill\s+myself\b/i
];

/**
 * Conservative precheck for self-harm / acute distress language.
 * Prefer precision over recall; science-safe phrases are stripped first.
 */
export function textLooksConcerning(text) {
  let normalised = String(text || "").toLowerCase();
  if (!normalised.trim()) return false;

  for (const re of SCIENCE_SAFE_PHRASE_RES) {
    normalised = normalised.replace(re, " ");
  }

  return CONCERNING_PATTERNS.some((re) => re.test(normalised));
}

export function isOffTopicSubmission(evaluation) {
  if (!evaluation || typeof evaluation !== "object") return false;
  return String(evaluation.submission_status || "").toLowerCase() === "not_science";
}
