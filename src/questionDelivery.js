/** Session-scoped question delivery — grants + meta pool RPCs (scrape hardening). */

export const MAX_SESSION_QUESTIONS = 70;

/**
 * Meta-only pool rows for adaptive / paper assembly (no stems).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {{
 *   specPointIds: string[],
 *   tierValues?: string[],
 *   qType?: string,
 * }} opts
 */
export async function listQuestionPoolMeta(supabaseClient, { specPointIds, tierValues, qType = "" } = {}) {
  const ids = [...new Set((specPointIds || []).filter(Boolean))];
  if (!ids.length) return [];

  const { data, error } = await supabaseClient.rpc("list_question_pool_meta", {
    p_spec_point_ids: ids,
    p_tiers: tierValues?.length ? tierValues : null,
    p_q_type: qType || null,
  });
  if (error) throw error;
  return data || [];
}

/**
 * Meta for an explicit question id list (no stems).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {string[]} questionIds
 */
export async function listQuestionMetaByIds(supabaseClient, questionIds) {
  const ids = [...new Set((questionIds || []).filter(Boolean))];
  if (!ids.length) return [];
  if (ids.length > 200) {
    throw new Error("too_many_question_ids");
  }

  const { data, error } = await supabaseClient.rpc("list_question_meta_by_ids", {
    p_question_ids: ids,
  });
  if (error) throw error;
  return data || [];
}

/**
 * Coverage rows for due-queue / onboarding (no stems).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {string[]} specPointIds
 * @param {string[]|null} tierValues
 */
export async function listQuestionCoverage(supabaseClient, specPointIds, tierValues = null) {
  const ids = [...new Set((specPointIds || []).filter(Boolean))];
  if (!ids.length) return [];

  const { data, error } = await supabaseClient.rpc("list_question_coverage", {
    p_spec_point_ids: ids,
    p_tiers: tierValues?.length ? tierValues : null,
  });
  if (error) throw error;
  return data || [];
}

/**
 * Grant stem access for up to MAX_SESSION_QUESTIONS ids (students).
 * Developers/teachers are no-ops (full or roster access via RLS).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {string[]} questionIds
 * @param {string} mode
 */
export async function openPracticeSession(supabaseClient, questionIds, mode = "practice") {
  const ids = [...new Set((questionIds || []).filter(Boolean))];
  if (!ids.length) {
    return { ok: false, reason: "empty_question_ids" };
  }
  if (ids.length > MAX_SESSION_QUESTIONS) {
    return { ok: false, reason: "too_many_questions", max: MAX_SESSION_QUESTIONS };
  }

  const { data, error } = await supabaseClient.rpc("open_practice_session", {
    p_question_ids: ids,
    p_mode: mode || "practice",
  });
  if (error) {
    return { ok: false, reason: "rpc_error", error: error.message };
  }
  if (data && typeof data === "object") return data;
  return { ok: false, reason: "empty_response" };
}

/**
 * Open a session grant then SELECT full stems (RLS allows granted rows).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {string[]} questionIds
 * @param {{
 *   mode?: string,
 *   select: string,
 *   selectFallback?: string,
 * }} opts
 */
export async function deliverQuestionsByIds(supabaseClient, questionIds, opts) {
  const ids = [...new Set((questionIds || []).filter(Boolean))];
  if (!ids.length) return [];

  const grant = await openPracticeSession(supabaseClient, ids, opts?.mode || "practice");
  if (!grant?.ok) {
    const err = new Error(grant?.reason || grant?.error || "open_practice_session_failed");
    err.reason = grant?.reason;
    throw err;
  }

  const selectCols = opts?.select;
  let result = await supabaseClient.from("questions").select(selectCols).in("id", ids);
  if (result.error && opts?.selectFallback && /column/i.test(result.error.message || "")) {
    result = await supabaseClient.from("questions").select(opts.selectFallback).in("id", ids);
  }
  if (result.error) throw result.error;

  const byId = new Map((result.data || []).map((q) => [q.id, q]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
