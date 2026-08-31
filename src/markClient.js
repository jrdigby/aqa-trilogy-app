/** Client wrapper for server-side marking (mark-response edge function). */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {{
 *   question_id: string,
 *   response_payload: object,
 *   equation_sheet?: object|null,
 * }} payload
 */
export async function markResponseOnServer(supabaseClient, payload) {
  const { data, error } = await supabaseClient.functions.invoke("mark-response", {
    body: {
      question_id: payload.question_id,
      response_payload: payload.response_payload,
      equation_sheet: payload.equation_sheet ?? null,
    },
  });

  if (data && typeof data === "object") {
    if (data.ok === false) {
      return {
        ok: false,
        reason: data.reason || data.error || "marking_failed",
        error: data.error,
      };
    }
    if (data.ok === true) return data;
  }

  if (error) {
    let reason = "invoke_error";
    let detail = error.message || "Request failed";
    try {
      const ctx = error.context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json();
        if (body?.reason) reason = body.reason;
        if (body?.error) detail = body.error;
      }
    } catch (_) {
      /* ignore */
    }
    return { ok: false, reason, error: detail };
  }

  return { ok: false, reason: "empty_response", error: "No marking data returned" };
}
