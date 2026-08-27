/** Ask an expert — shared labels and helpers for student + admin UIs */

export const EXPERT_CATEGORIES = [
  {
    id: "confused_question",
    label: "I don't understand the question"
  },
  {
    id: "confused_feedback",
    label: "I don't understand the answer / feedback"
  },
  {
    id: "suspect_question_error",
    label: "I think the question has an error"
  },
  {
    id: "suspect_answer_error",
    label: "I think the marked answer is wrong"
  },
  {
    id: "other",
    label: "Other"
  }
];

export const EXPERT_CATEGORY_LABELS = Object.fromEntries(
  EXPERT_CATEGORIES.map((c) => [c.id, c.label])
);

export function expertCategoryLabel(category) {
  return EXPERT_CATEGORY_LABELS[category] || category || "Other";
}

export function escapeExpertHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function truncateExpertText(value, max = 160) {
  const s = String(value ?? "").replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function formatExpertAge(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function expertSubmitErrorMessage(reason) {
  switch (reason) {
    case "already_open_for_question":
      return "You already have an open question for this item. Wait for a reply first.";
    case "too_many_open":
      return "You already have several open expert questions. Wait for replies before sending more.";
    case "daily_cap":
      return "You've reached today's Ask an expert limit. Try again tomorrow.";
    case "students_only":
      return "Only student accounts can ask an expert.";
    case "invalid_category":
      return "Please choose a reason.";
    case "message_too_long":
      return "Your message is too long (max 1000 characters).";
    case "question_not_found":
      return "That question could not be found.";
    default:
      return "Could not send your question. Please try again.";
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {{ question_id: string, category: string, student_message?: string|null, attempt_id?: string|null, client_response?: object|null }} payload
 */
export async function submitExpertQuery(supabaseClient, payload) {
  const { data, error } = await supabaseClient.functions.invoke("submit-expert-query", {
    body: {
      question_id: payload.question_id,
      category: payload.category,
      student_message: payload.student_message || null,
      attempt_id: payload.attempt_id || null,
      client_response: payload.client_response || null
    }
  });

  if (data && typeof data === "object") {
    if (data.ok === false) {
      return {
        ok: false,
        reason: data.reason || data.error || "submit_failed",
        error: data.error
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

  return { ok: true };
}

export async function fetchStudentExpertQueries(supabaseClient) {
  const { data, error } = await supabaseClient
    .from("expert_queries")
    .select(
      "id, category, student_message, snapshot, status, admin_reply, replied_at, student_seen_at, created_at, question_id"
    )
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return data || [];
}

export async function markExpertQuerySeen(supabaseClient, id) {
  const { data, error } = await supabaseClient.rpc("mark_expert_query_seen", {
    p_id: id
  });
  if (error) throw error;
  return data;
}

export async function developerListExpertQueries(
  supabaseClient,
  status = "open",
  limit = 50,
  offset = 0
) {
  const { data, error } = await supabaseClient.rpc("developer_list_expert_queries", {
    p_status: status,
    p_limit: limit,
    p_offset: offset
  });
  if (error) throw error;
  return data;
}

export async function developerReplyExpertQuery(
  supabaseClient,
  id,
  status,
  reply = null
) {
  const { data, error } = await supabaseClient.rpc("developer_reply_expert_query", {
    p_id: id,
    p_status: status,
    p_reply: reply
  });
  if (error) throw error;
  return data;
}

export async function developerExpertOpenCount(supabaseClient) {
  const { data, error } = await supabaseClient.rpc(
    "developer_expert_query_open_count"
  );
  if (error) throw error;
  return Number(data) || 0;
}
