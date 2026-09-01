/** Client wrapper for server-side marking (mark-response edge function). */

function parseInvokeResult(data, error) {
  if (data && typeof data === "object") {
    if (data.ok === false) {
      return {
        ok: false,
        reason: data.reason || data.error || "request_failed",
        error: data.error,
      };
    }
    if (data.ok === true) return data;
  }

  if (error) {
    let reason = "invoke_error";
    let detail = error.message || "Request failed";
    return { ok: false, reason, error: detail, _error: error };
  }

  return { ok: false, reason: "empty_response", error: "No data returned" };
}

async function parseInvokeError(result) {
  if (result.ok !== false || !result._error) return result;
  const error = result._error;
  let reason = result.reason || "invoke_error";
  let detail = result.error || error.message || "Request failed";
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

  const result = parseInvokeResult(data, error);
  return parseInvokeError(result);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {string} questionId
 */
export async function prefetchMarkingData(supabaseClient, questionId) {
  const { data, error } = await supabaseClient.functions.invoke(
    "prefetch-marking-data",
    { body: { question_id: questionId } },
  );

  const result = parseInvokeResult(data, error);
  return parseInvokeError(result);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {string[]} questionIds
 */
export async function prefetchMarkingDataBatch(supabaseClient, questionIds) {
  const ids = [...new Set((questionIds || []).filter(Boolean))];
  if (!ids.length) return { ok: true, data: {} };

  const { data, error } = await supabaseClient.functions.invoke(
    "prefetch-marking-data",
    { body: { question_ids: ids } },
  );

  const result = parseInvokeResult(data, error);
  return parseInvokeError(result);
}
