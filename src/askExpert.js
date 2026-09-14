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
      "id, category, student_message, snapshot, status, admin_reply, replied_at, student_seen_at, student_feedback, student_feedback_at, archived_at, created_at, question_id"
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data || [];
}

export async function setExpertQueryFeedback(supabaseClient, id, feedback) {
  const { data, error } = await supabaseClient.rpc("set_expert_query_feedback", {
    p_id: id,
    p_feedback: feedback
  });
  if (error) throw error;
  return data;
}

export async function setExpertQueryArchived(supabaseClient, id, archived) {
  const { data, error } = await supabaseClient.rpc("set_expert_query_archived", {
    p_id: id,
    p_archived: !!archived
  });
  if (error) throw error;
  return data;
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

const NUMERIC_STEP_ORDER = [
  "equation_select",
  "substitution",
  "conversion",
  "element_mass",
  "mass_ratio",
  "insert_values",
  "mole_table",
  "mole_ratio",
  "limiting_select",
  "rearrangement",
  "balance_coeffs",
  "working_1",
  "working_2",
  "sig_figs"
];

const NUMERIC_STEP_LABELS = {
  equation_select: "Equation",
  substitution: "Substitution",
  conversion: "Unit conversion",
  element_mass: "Element mass",
  mass_ratio: "Mass ratio",
  insert_values: "Substituted values",
  mole_table: "Mole table",
  mole_ratio: "Mole ratio",
  limiting_select: "Limiting reactant",
  rearrangement: "Rearrangement",
  balance_coeffs: "Balanced equation",
  working_1: "Working",
  working_2: "Further working",
  sig_figs: "Significant figures"
};

const INTERACTIVE_SKIP_KEYS = new Set([
  "type",
  "kind",
  "x",
  "y",
  "id",
  "style",
  "mode",
  "maxPairs",
  "selectedElectron",
  "nextAtomId",
  "bondFrom",
  "selectedSymbol"
]);

export function prettyScientificNotation(value) {
  return String(value ?? "").replace(
    /([+-]?\d+(?:\.\d+)?)(?:\s*[eE]\s*([+-]?\d+)|\s*[x×*]\s*10\s*\^\s*([+-]?\d+))/g,
    (_, mantissa, expE, expX) => {
      const exp = String(expE ?? expX ?? "").replace(/^\+/, "");
      return `${mantissa} × 10^${exp}`;
    }
  );
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseStructured(value) {
  if (isPlainObject(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return isPlainObject(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

function formatScalar(value) {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return prettyScientificNotation(String(value));
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? prettyScientificNotation(trimmed) : "";
  }
  return "";
}

function formatStepValue(value) {
  const scalar = formatScalar(value);
  if (scalar) return scalar;
  if (Array.isArray(value)) {
    const parts = value.map((item) => formatStepValue(item)).filter(Boolean);
    return parts.join(", ");
  }
  if (!isPlainObject(value)) return "";
  if (typeof value.text === "string" && value.text.trim()) {
    return prettyScientificNotation(value.text.trim());
  }
  if ("numerator" in value || "denominator" in value) {
    const num = formatStepValue(value.numerator);
    const den = formatStepValue(value.denominator);
    if (num || den) return [num, den].filter(Boolean).join(" / ");
  }
  if ("left" in value || "right" in value) {
    const left = formatStepValue(value.left);
    const right = formatStepValue(value.right);
    if (left || right) return [left, right].filter(Boolean).join(", ");
  }
  const parts = Object.entries(value)
    .map(([key, item]) => {
      const shown = formatStepValue(item);
      return shown ? `${key}: ${shown}` : "";
    })
    .filter(Boolean);
  return parts.join(", ");
}

function formatNumericAnswer(payload) {
  const stepRaw = isPlainObject(payload.stepRaw) ? payload.stepRaw : {};
  const steps = isPlainObject(payload.steps) ? payload.steps : {};
  const keys = [];
  const seen = new Set();
  for (const key of [...NUMERIC_STEP_ORDER, ...Object.keys(stepRaw), ...Object.keys(steps)]) {
    if (key === "calculate" || seen.has(key)) continue;
    if (!(key in stepRaw) && !(key in steps)) continue;
    seen.add(key);
    keys.push(key);
  }

  const lines = [];
  for (const key of keys) {
    const shown = formatStepValue(stepRaw[key]) || formatStepValue(steps[key]);
    if (!shown) continue;
    lines.push(`${NUMERIC_STEP_LABELS[key] || key}: ${shown}`);
  }

  const finalShown =
    formatStepValue(stepRaw.calculate) ||
    formatStepValue(steps.calculate) ||
    formatStepValue(payload.value);
  const unit = formatScalar(payload.unit);
  if (finalShown) {
    lines.push(`Final answer: ${finalShown}${unit ? ` ${unit}` : ""}`);
  }
  return lines.join("\n");
}

function formatInteractiveAnswer(payload) {
  const typeLabel =
    payload.type === "chemistry"
      ? "Chemistry"
      : payload.type === "circuit"
        ? "Circuit"
        : payload.type === "equipment"
          ? "Equipment"
          : "Interactive";
  const kind = formatScalar(payload.kind).replace(/_/g, " ");
  const lines = [kind ? `${typeLabel} (${kind})` : typeLabel];

  const selected = formatScalar(payload.selectedType || payload.selectedId);
  if (selected) lines.push(`Selected: ${selected}`);

  if (isPlainObject(payload.slotChoices)) {
    const slots = Object.entries(payload.slotChoices)
      .map(([key, value]) => {
        const shown = formatStepValue(value);
        return shown ? `${key}: ${shown}` : "";
      })
      .filter(Boolean);
    if (slots.length) lines.push(`Components: ${slots.join(", ")}`);
  }

  if (isPlainObject(payload.hotspotLabels)) {
    const labels = Object.entries(payload.hotspotLabels)
      .map(([key, value]) => {
        const shown = formatStepValue(value);
        return shown ? `${key}: ${shown}` : "";
      })
      .filter(Boolean);
    if (labels.length) lines.push(`Labels: ${labels.join(", ")}`);
  }

  if (Array.isArray(payload.atoms) && payload.atoms.length) {
    const atoms = payload.atoms
      .map((atom) => formatScalar(atom?.symbol || atom?.id))
      .filter(Boolean);
    if (atoms.length) lines.push(`Atoms: ${atoms.join(", ")}`);
  }

  if (Array.isArray(payload.bonds) && payload.bonds.length) {
    lines.push(`Bonds: ${payload.bonds.length}`);
  }

  const extras = Object.entries(payload)
    .filter(([key, value]) => !INTERACTIVE_SKIP_KEYS.has(key))
    .filter(([key]) => !["selectedType", "selectedId", "slotChoices", "hotspotLabels", "atoms", "bonds"].includes(key))
    .map(([key, value]) => {
      if (value == null || typeof value === "object") return "";
      const shown = formatScalar(value);
      return shown ? `${key.replace(/_/g, " ")}: ${shown}` : "";
    })
    .filter(Boolean)
    .slice(0, 4);
  lines.push(...extras);

  return lines.join("\n");
}

function formatStructuredResponse(payload, snapshot) {
  const type = payload.type || snapshot?.question_type || "";
  if (
    type === "numeric" ||
    isPlainObject(payload.stepRaw) ||
    (isPlainObject(payload.steps) && ("value" in payload || "unit" in payload))
  ) {
    const numeric = formatNumericAnswer(payload);
    if (numeric) return numeric;
  }

  if (type === "mcq" || (typeof payload.answer === "string" && type !== "numeric")) {
    const answer = formatScalar(payload.answer);
    if (answer) return `Selected: ${answer}`;
  }

  if (type === "short_text" || type === "extended_response" || typeof payload.text === "string") {
    const text = formatScalar(payload.text);
    if (text && !isPlainObject(payload.steps)) return text;
  }

  if (type === "chemistry" || type === "circuit" || type === "equipment") {
    return formatInteractiveAnswer(payload);
  }

  if (typeof payload.selected === "string" && payload.selected.trim()) {
    return `Selected: ${prettyScientificNotation(payload.selected.trim())}`;
  }

  return "";
}

/**
 * Readable student answer for Ask an Expert. Prefers the structured
 * client response over the stored one-line summary.
 * @param {object|null|undefined} snapshot
 */
export function formatExpertStudentAnswer(snapshot) {
  const snap = isPlainObject(snapshot) ? snapshot : {};
  const structured =
    parseStructured(snap.client_response) || parseStructured(snap.student_response_summary);
  if (structured) {
    const formatted = formatStructuredResponse(structured, snap);
    if (formatted) return formatted;
  }
  const summary = String(snap.student_response_summary ?? "").trim();
  if (!summary) return "—";
  return prettyScientificNotation(summary);
}

export function expertFeedbackLabel(feedback) {
  if (feedback === "understood") return "I understand now";
  if (feedback === "still_confused") return "Still confused";
  return "";
}

export async function developerExpertOpenCount(supabaseClient) {
  const { data, error } = await supabaseClient.rpc(
    "developer_expert_query_open_count"
  );
  if (error) throw error;
  return Number(data) || 0;
}
