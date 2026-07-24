/** Provenance logging when questions are committed to the bank. */

export const GENERATION_SOURCES = Object.freeze({
  AI_STUDIO: "ai_studio",
  AI_STUDIO_IMPORT: "ai_studio_import",
  BATCH_NUMERIC: "batch_numeric",
  MANUAL_CREATE: "manual_create",
  CSV_IMPORT: "csv_import"
});

const ALLOWED_SOURCES = new Set(Object.values(GENERATION_SOURCES));

export async function sha256Hex(text) {
  const raw = String(text ?? "");
  if (!raw) return null;
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return null;
  }
  const data = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * True when committed draft differs from the original generated/imported snapshot.
 * Compares stem, options, answer key, and mark points (not only the prompt).
 */
export function detectHumanEdited(provenance, draft) {
  const snapshot = provenance?.original_snapshot;
  if (snapshot && typeof snapshot === "object") {
    const norm = (v) => JSON.stringify(v ?? null);
    if (norm(draft?.question?.prompt) !== norm(snapshot.question?.prompt)) return true;
    if (norm(draft?.question?.options) !== norm(snapshot.question?.options)) return true;
    if (norm(draft?.question?.command_word) !== norm(snapshot.question?.command_word)) return true;
    if (norm(draft?.question?.max_marks) !== norm(snapshot.question?.max_marks)) return true;
    if (norm(draft?.question?.ao1_marks) !== norm(snapshot.question?.ao1_marks)) return true;
    if (norm(draft?.question?.ao2_marks) !== norm(snapshot.question?.ao2_marks)) return true;
    if (norm(draft?.question?.ao3_marks) !== norm(snapshot.question?.ao3_marks)) return true;
    if (norm(draft?.answer_key) !== norm(snapshot.answer_key)) return true;
    if (norm(draft?.mark_points) !== norm(snapshot.mark_points)) return true;
    return false;
  }

  const original = String(provenance?.original_prompt ?? "").trim();
  if (!original) return false;
  const current = String(draft?.question?.prompt ?? "").trim();
  return current !== original;
}

function resolveSource(provenance, fallbackSource) {
  const fromProv = provenance?.source;
  if (ALLOWED_SOURCES.has(fromProv)) return fromProv;
  return fallbackSource;
}

/**
 * Insert a generation_logs row and link it on questions.source_generation_log_id.
 * Call after a successful questions insert.
 */
export async function recordQuestionIngestion(supabaseClient, {
  source,
  questionId,
  draft,
  provenance = null,
  humanEdited = null
} = {}) {
  if (!supabaseClient) throw new Error("supabaseClient is required");
  if (!questionId) throw new Error("questionId is required");
  if (!source) throw new Error("source is required");

  const resolvedSource = resolveSource(provenance, source);
  const promptText = provenance?.prompt_text ?? provenance?.prompt ?? null;
  const rawResponse = provenance?.raw_response ?? null;
  const edited = humanEdited == null
    ? detectHumanEdited(provenance, draft)
    : !!humanEdited;

  const parsedOutput = {
    question: draft?.question ?? null,
    answer_key: draft?.answer_key ?? null,
    mark_points: draft?.mark_points ?? null,
    variant: draft?.variant ?? null
  };

  const payload = {
    source: resolvedSource,
    published_question_id: questionId,
    model: provenance?.model ?? null,
    request_id: provenance?.request_id ?? null,
    prompt_text: promptText,
    prompt_hash: await sha256Hex(promptText),
    raw_response: rawResponse,
    response_hash: await sha256Hex(rawResponse),
    parsed_output: parsedOutput,
    input_meta: provenance?.input_meta && typeof provenance.input_meta === "object"
      ? provenance.input_meta
      : {},
    usage_meta: provenance?.usage ?? provenance?.usage_meta ?? null,
    status: "success",
    human_edited: edited
  };

  const { data: logId, error: rpcErr } = await supabaseClient.rpc(
    "record_question_ingestion",
    { p_payload: payload }
  );

  if (!rpcErr && logId) return logId;

  // Fallback for DBs that have the table but not yet the RPC
  const { data: logRow, error: logErr } = await supabaseClient
    .from("generation_logs")
    .insert({
      source: payload.source,
      model: payload.model,
      request_id: payload.request_id,
      prompt_text: payload.prompt_text,
      prompt_hash: payload.prompt_hash,
      raw_response: payload.raw_response,
      response_hash: payload.response_hash,
      parsed_output: payload.parsed_output,
      input_meta: payload.input_meta,
      usage_meta: payload.usage_meta,
      status: payload.status,
      published_question_id: questionId,
      human_edited: edited
    })
    .select("id")
    .single();

  if (logErr) {
    const rpcMsg = rpcErr?.message ? `RPC: ${rpcErr.message}` : null;
    throw new Error([rpcMsg, logErr.message].filter(Boolean).join(" | ") || "generation_logs insert failed");
  }

  const { error: qErr } = await supabaseClient
    .from("questions")
    .update({ source_generation_log_id: logRow.id })
    .eq("id", questionId);
  if (qErr) throw qErr;

  return logRow.id;
}
