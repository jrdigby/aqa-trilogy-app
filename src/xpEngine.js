import { getEffectiveDifficulty } from "./examRules.js";

export const XP_PER_DIFFICULTY = 10;
export const HINT_MULTIPLIERS = [1.0, 0.75, 0.5, 0.25];

export function computeAttemptXp(question, hintsRevealed) {
  const difficulty = getEffectiveDifficulty(question);
  const base = XP_PER_DIFFICULTY * difficulty;
  const idx = Math.min(Math.max(0, hintsRevealed || 0), HINT_MULTIPLIERS.length - 1);
  return Math.round(base * HINT_MULTIPLIERS[idx]);
}

export function formatXpToastMessage(xpEarned, hintsRevealed) {
  if (!xpEarned) return null;
  if (hintsRevealed > 0) {
    const label = hintsRevealed === 1 ? "1 hint used" : `${hintsRevealed} hints used`;
    return `+${xpEarned} XP (${label})`;
  }
  return `+${xpEarned} XP`;
}
