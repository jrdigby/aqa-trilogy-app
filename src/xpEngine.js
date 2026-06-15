import { getEffectiveDifficulty } from "./examRules.js";

export const XP_PER_DIFFICULTY = 10;
export const HINT_MULTIPLIERS = [1.0, 0.75, 0.5, 0.25];

export const XP_RULES_FOOTNOTE =
  "XP is earned for each submitted attempt (based on question difficulty). Marks scored do not change XP. Hints reduce XP.";

export const XP_FIRST_TOAST_NOTE =
  "Earned per attempt — marks don't change XP. Hints reduce XP.";

export const XP_RULES_TOAST_KEY = "xp_rules_toast_shown";

/** True when the student provided a non-empty answer worth XP. */
export function isSubstantiveAttempt(question, response) {
  if (!question || !response) return false;

  if (question.question_type === "mcq") {
    return Boolean(String(response.answer ?? "").trim());
  }

  if (question.question_type === "numeric") {
    return response.value != null && !Number.isNaN(response.value);
  }

  if (response.text != null) {
    return String(response.text).trim().length > 0;
  }

  return false;
}

export function computeAttemptXp(question, hintsRevealed, response) {
  if (!isSubstantiveAttempt(question, response)) return 0;

  const difficulty = getEffectiveDifficulty(question);
  const base = XP_PER_DIFFICULTY * difficulty;
  const idx = Math.min(Math.max(0, hintsRevealed || 0), HINT_MULTIPLIERS.length - 1);
  return Math.round(base * HINT_MULTIPLIERS[idx]);
}

export function formatXpToastMessage(xpEarned, hintsRevealed, { includeRulesNote = false } = {}) {
  if (!xpEarned) return null;

  let msg;
  if (hintsRevealed > 0) {
    const label = hintsRevealed === 1 ? "1 hint used" : `${hintsRevealed} hints used`;
    msg = `+${xpEarned} XP (${label})`;
  } else {
    msg = `+${xpEarned} XP`;
  }

  if (includeRulesNote) {
    msg = `${msg} — ${XP_FIRST_TOAST_NOTE}`;
  }

  return msg;
}
