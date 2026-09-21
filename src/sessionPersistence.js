/** Persist in-progress practice sessions across refresh / navigation / new tabs. */

import { QUESTION_SELECT, QUESTION_SELECT_FALLBACK } from "./sessionEngine.js";

const STORAGE_KEY = "aqa_practice_session_v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function readStoredRaw() {
  try {
    const fromLocal = localStorage.getItem(STORAGE_KEY);
    if (fromLocal) return fromLocal;

    // Migrate older same-tab sessionStorage snapshots (pre cross-tab resume).
    const fromSession = sessionStorage.getItem(STORAGE_KEY);
    if (fromSession) {
      localStorage.setItem(STORAGE_KEY, fromSession);
      sessionStorage.removeItem(STORAGE_KEY);
      return fromSession;
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

/**
 * @param {{
 *   userId: string,
 *   questionIds: string[],
 *   idx: number,
 *   sessionMode: string|null,
 *   sessionSpecPointId: string|null,
 *   sessionSkillCode: string|null,
 *   filters: object,
 *   sessionAttemptLog?: unknown[],
 *   sessionQualityLog?: unknown[],
 *   sessionXpEarned?: number,
 * }} state
 */
export function savePracticeSession(state) {
  if (!state?.userId || !Array.isArray(state.questionIds) || !state.questionIds.length) {
    return;
  }
  try {
    const payload = {
      v: 1,
      savedAt: Date.now(),
      userId: state.userId,
      questionIds: state.questionIds,
      idx: Math.max(0, Number(state.idx) || 0),
      sessionMode: state.sessionMode ?? null,
      sessionSpecPointId: state.sessionSpecPointId ?? null,
      sessionSkillCode: state.sessionSkillCode ?? null,
      filters: state.filters || {},
      sessionAttemptLog: state.sessionAttemptLog || [],
      sessionQualityLog: state.sessionQualityLog || [],
      sessionXpEarned: Number(state.sessionXpEarned) || 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {
      /* ignore */
    }
  } catch (err) {
    console.warn("Could not persist practice session:", err?.message || err);
  }
}

/**
 * @param {string} userId
 * @returns {object|null}
 */
export function loadPracticeSession(userId) {
  try {
    const raw = readStoredRaw();
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.userId !== userId || !Array.isArray(data.questionIds) || !data.questionIds.length) {
      return null;
    }
    if (Date.now() - Number(data.savedAt || 0) > MAX_AGE_MS) {
      clearPracticeSession();
      return null;
    }
    return data;
  } catch (_) {
    return null;
  }
}

export function clearPracticeSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (_) {
    /* ignore */
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {string[]} questionIds
 */
export async function fetchQuestionsByIds(supabaseClient, questionIds) {
  const ids = [...new Set((questionIds || []).filter(Boolean))];
  if (!ids.length) return [];

  let result = await supabaseClient.from("questions").select(QUESTION_SELECT).in("id", ids);
  if (result.error && /column/i.test(result.error.message || "")) {
    result = await supabaseClient.from("questions").select(QUESTION_SELECT_FALLBACK).in("id", ids);
  }
  if (result.error) throw result.error;

  const byId = new Map((result.data || []).map((q) => [q.id, q]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
