/**
 * Normalise AI-generated question payloads into admin preview/commit draft shape.
 */
import { normalizeQuestionTierForDb } from "./sciencePath.js";
import {
  formatDemandLabel,
  getDemandOptionsForTier,
  syncDraftFromPreviewEdits as syncMcqDraftFromPreviewEdits
} from "./mcqBatchGenerator.js";

export { getDemandOptionsForTier, formatDemandLabel };

const STUDIO_MAX_QUESTIONS = 12;

const SHORT_TYPES = new Set(["short_text", "short text", "short-text"]);
const EXTENDED_TYPES = new Set([
  "extended_response",
  "extended response",
  "extended-response",
  "extended"
]);

export const LEVEL_3_KEY = "Level 3 (5-6 marks)";
export const LEVEL_2_KEY = "Level 2 (3-4 marks)";
export const LEVEL_1_KEY = "Level 1 (1-2 marks)";

export function questionTypeLabel(questionType) {
  if (questionType === "mcq") return "MCQ";
  if (questionType === "short_text") return "Short text";
  if (questionType === "extended_response") return "Extended";
  return questionType || "—";
}

export function normalizeQuestionType(raw) {
  const t = String(raw || "mcq").trim().toLowerCase();
  if (SHORT_TYPES.has(t)) return "short_text";
  if (EXTENDED_TYPES.has(t)) return "extended_response";
  return "mcq";
}

export function normalizeRecipeMaxMarks(questionType, raw) {
  const type = normalizeQuestionType(questionType);
  if (type === "mcq") return 1;
  if (type === "short_text") {
    return Number(raw) === 1 ? 1 : 2;
  }
  if (type === "extended_response") {
    return Number(raw) === 4 ? 4 : 6;
  }
  return 1;
}

export function demandRecipeLabel(variant) {
  if (!variant) return "—";
  const parts = [];
  if (variant.question_type) parts.push(questionTypeLabel(variant.question_type));
  if (variant.demand_level) parts.push(formatDemandLabel(variant.demand_level));
  if (
    variant.question_type
    && variant.question_type !== "mcq"
    && variant.max_marks != null
  ) {
    parts.push(`${variant.max_marks} mark${Number(variant.max_marks) === 1 ? "" : "s"}`);
  }
  return parts.join(" · ") || "—";
}

function normalizeOptionFeedback(raw, options, correct) {
  const map = {};
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const opt = String(entry?.option ?? entry?.text ?? "").trim();
      const fb = String(entry?.feedback ?? "").trim();
      if (opt && fb && opt !== correct) map[opt] = fb;
    }
  } else if (raw && typeof raw === "object") {
    for (const [opt, fb] of Object.entries(raw)) {
      if (opt && fb && opt !== correct) map[opt] = String(fb).trim();
    }
  }
  for (let i = 0; i < options.length; i++) {
    const letter = String.fromCharCode(97 + i);
    const fb = raw?.[`mcq_feedback_${letter}`] || raw?.[`feedback_${letter}`];
    const opt = options[i];
    if (opt && fb && opt !== correct) map[opt] = String(fb).trim();
  }
  return Object.keys(map).length ? map : undefined;
}

function normalizeMarkPoints(raw, maxMarks = 2) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const mp of list.slice(0, 6)) {
    const keywords = String(mp?.keywords ?? mp?.point_text ?? "").trim();
    const feedback = String(mp?.feedback ?? mp?.feedback_if_missing ?? "").trim();
    const ao = String(mp?.ao ?? "AO1").trim().toUpperCase();
    const imageUrl = String(mp?.image_url ?? "").trim();
    if (!keywords && !feedback) continue;
    out.push({
      ao: ao.startsWith("AO") ? ao : "AO1",
      point_text: keywords,
      feedback_if_missing: feedback,
      image_url: imageUrl || null,
      max_marks: 1
    });
  }
  while (out.length > maxMarks) out.pop();
  return out;
}

function readLevelDescriptors(raw) {
  const nested = raw?.level_descriptors && typeof raw.level_descriptors === "object"
    ? raw.level_descriptors
    : {};
  return {
    [LEVEL_3_KEY]: String(
      nested[LEVEL_3_KEY]
      ?? raw?.level_3_descriptor
      ?? raw?.level_3
      ?? ""
    ).trim(),
    [LEVEL_2_KEY]: String(
      nested[LEVEL_2_KEY]
      ?? raw?.level_2_descriptor
      ?? raw?.level_2
      ?? ""
    ).trim(),
    [LEVEL_1_KEY]: String(
      nested[LEVEL_1_KEY]
      ?? raw?.level_1_descriptor
      ?? raw?.level_1
      ?? ""
    ).trim()
  };
}

function normalizeMcqQuestion(raw, context, demandLevel) {
  const tier = normalizeQuestionTierForDb(context.tier || raw?.tier || "both");
  const options = (raw?.options || [])
    .map((o) => String(o || "").trim())
    .slice(0, 4);
  while (options.length < 4) options.push("");

  let correct = String(raw?.correct ?? raw?.mcq_correct ?? "").trim();
  if (!options.includes(correct)) {
    correct = options.find(Boolean) || "";
  }

  const optionFeedback = normalizeOptionFeedback(
    raw?.option_feedback ?? raw?.optionFeedback,
    options,
    correct
  );

  const ao1 = Number(raw?.ao1_marks ?? 1) || 0;
  const ao2 = Number(raw?.ao2_marks ?? 0) || 0;
  const ao3 = Number(raw?.ao3_marks ?? 0) || 0;

  const question = {
    question_type: "mcq",
    prompt: String(raw?.prompt || "").trim(),
    options,
    tier,
    max_marks: 1,
    marking_method: "keyword",
    command_word: raw?.command_word || "state",
    demand_level: demandLevel,
    ao1_marks: ao1,
    ao2_marks: ao2,
    ao3_marks: ao3,
    is_maths_skill: false,
    is_required_practical: false,
    image_url: String(raw?.image_url ?? "").trim() || null
  };

  const payload = { correct };
  if (optionFeedback) payload.option_feedback = optionFeedback;

  const overallFb = String(raw?.overall_feedback ?? raw?.section3_feedback ?? "").trim();

  return {
    variant: { question_type: "mcq", demand_level: demandLevel, max_marks: 1 },
    question,
    answer_key: { key_type: "mcq", key_payload: payload },
    mark_points: overallFb
      ? [{
          ao: ao1 > 0 ? "AO1" : "AO2",
          point_text: correct,
          feedback_if_missing: overallFb,
          max_marks: 1
        }]
      : []
  };
}

function normalizeShortTextQuestion(raw, context, demandLevel) {
  const tier = normalizeQuestionTierForDb(context.tier || raw?.tier || "both");
  const maxMarks = normalizeRecipeMaxMarks("short_text", raw?.max_marks ?? 2);
  const markPoints = normalizeMarkPoints(raw?.mark_points, maxMarks);
  const ao1 = Number(raw?.ao1_marks ?? Math.min(1, maxMarks)) || 0;
  const ao2 = Number(raw?.ao2_marks ?? Math.max(0, maxMarks - ao1)) || 0;
  const ao3 = Number(raw?.ao3_marks ?? 0) || 0;

  return {
    variant: { question_type: "short_text", demand_level: demandLevel, max_marks: maxMarks },
    question: {
      question_type: "short_text",
      prompt: String(raw?.prompt || "").trim(),
      options: null,
      tier,
      max_marks: maxMarks,
      marking_method: "keyword",
      command_word: raw?.command_word || "describe",
      demand_level: demandLevel,
      ao1_marks: ao1,
      ao2_marks: ao2,
      ao3_marks: ao3,
      is_maths_skill: false,
      is_required_practical: false,
      image_url: String(raw?.image_url ?? "").trim() || null
    },
    answer_key: {
      key_type: "keywords",
      key_payload: {
        required: [],
        optional: [],
        min_optional: 0
      }
    },
    mark_points: markPoints
  };
}

function sanitizeLevelDescriptorsForMarks(levelDescriptors, maxMarks) {
  if (maxMarks !== 4) return levelDescriptors;
  return {
    ...levelDescriptors,
    [LEVEL_3_KEY]: "N/A for 4-mark"
  };
}

function normalizeExtendedQuestion(raw, context, demandLevel) {
  const tier = normalizeQuestionTierForDb(context.tier || raw?.tier || "both");
  const maxMarks = normalizeRecipeMaxMarks("extended_response", raw?.max_marks ?? 6);
  const levelDescriptors = sanitizeLevelDescriptorsForMarks(
    readLevelDescriptors(raw),
    maxMarks
  );
  const ao1 = Number(raw?.ao1_marks ?? 0) || 0;
  const ao2 = Number(raw?.ao2_marks ?? Math.min(2, maxMarks)) || 0;
  const ao3 = Number(raw?.ao3_marks ?? Math.max(0, maxMarks - ao1 - ao2)) || 0;

  return {
    variant: {
      question_type: "extended_response",
      demand_level: demandLevel,
      max_marks: maxMarks
    },
    question: {
      question_type: "extended_response",
      prompt: String(raw?.prompt || "").trim(),
      options: null,
      tier,
      max_marks: maxMarks,
      marking_method: "ai_rubric",
      command_word: raw?.command_word || "explain",
      demand_level: demandLevel,
      ao1_marks: ao1,
      ao2_marks: ao2,
      ao3_marks: ao3,
      is_maths_skill: false,
      is_required_practical: false,
      image_url: String(raw?.image_url ?? "").trim() || null
    },
    answer_key: {
      key_type: "ai_rubric",
      key_payload: {
        marking_guidelines: String(raw?.marking_guidelines || "").trim(),
        level_descriptors: levelDescriptors
      }
    },
    mark_points: []
  };
}

function normalizeSingleQuestion(raw, context = {}) {
  const questionType = normalizeQuestionType(raw?.question_type);
  const demandLevel = raw?.demand_level || "low";

  if (questionType === "mcq") {
    return normalizeMcqQuestion(raw, context, demandLevel);
  }
  if (questionType === "extended_response") {
    return normalizeExtendedQuestion(raw, context, demandLevel);
  }
  return normalizeShortTextQuestion(raw, context, demandLevel);
}

export function normalizeAiQuestions(rawList, context = {}) {
  const list = Array.isArray(rawList) ? rawList : [];
  return list.map((raw) => {
    const draft = normalizeSingleQuestion(raw, context);
    if (!draft.question.prompt) return null;
    const prov = raw?._provenance || raw?.provenance || null;
    const originalSnapshot = {
      question: structuredClone
        ? structuredClone(draft.question)
        : JSON.parse(JSON.stringify(draft.question)),
      answer_key: structuredClone
        ? structuredClone(draft.answer_key)
        : JSON.parse(JSON.stringify(draft.answer_key)),
      mark_points: structuredClone
        ? structuredClone(draft.mark_points || [])
        : JSON.parse(JSON.stringify(draft.mark_points || []))
    };
    draft.provenance = {
      source: prov?.source || "ai_studio",
      prompt_text: prov?.prompt_text ?? prov?.prompt ?? null,
      raw_response: prov?.raw_response ?? null,
      model: prov?.model ?? null,
      request_id: prov?.request_id ?? null,
      usage: prov?.usage ?? prov?.usage_meta ?? null,
      original_prompt: prov?.original_prompt ?? draft.question.prompt,
      original_snapshot: prov?.original_snapshot || originalSnapshot,
      input_meta: prov?.input_meta && typeof prov.input_meta === "object" ? prov.input_meta : {}
    };
    return draft;
  }).filter(Boolean);
}

export function syncDraftFromPreviewEdits(draft, edits) {
  if (!draft?.question) return draft;
  if (draft.question.question_type === "short_text") {
    return syncShortTextDraftFromPreviewEdits(draft, edits);
  }
  if (draft.question.question_type === "extended_response") {
    return syncExtendedDraftFromPreviewEdits(draft, edits);
  }
  const updated = syncMcqDraftFromPreviewEdits(draft, edits);
  if (edits.demand_level != null) {
    updated.variant = {
      ...(updated.variant || {}),
      question_type: "mcq",
      demand_level: edits.demand_level,
      max_marks: 1
    };
  }
  return updated;
}

export function syncShortTextDraftFromPreviewEdits(draft, edits) {
  const q = { ...draft.question };
  if (edits.prompt != null) q.prompt = edits.prompt;
  if (edits.command_word != null) q.command_word = edits.command_word;
  if (edits.ao1_marks != null) q.ao1_marks = edits.ao1_marks;
  if (edits.ao2_marks != null) q.ao2_marks = edits.ao2_marks;
  if (edits.ao3_marks != null) q.ao3_marks = edits.ao3_marks;
  if (edits.image_url !== undefined) q.image_url = edits.image_url;
  if (edits.demand_level != null) q.demand_level = edits.demand_level;
  if (edits.max_marks != null) {
    q.max_marks = normalizeRecipeMaxMarks("short_text", edits.max_marks);
  }

  let markPoints = (edits.mark_points || draft.mark_points || []).map((mp, i) => {
    const prev = draft.mark_points?.[i] || {};
    return {
      ao: mp.ao ?? prev.ao ?? "AO1",
      point_text: mp.point_text ?? prev.point_text ?? "",
      feedback_if_missing: mp.feedback_if_missing ?? prev.feedback_if_missing ?? "",
      image_url: mp.image_url ?? prev.image_url ?? null,
      max_marks: 1
    };
  });

  const maxMarks = q.max_marks;
  while (markPoints.length > maxMarks) markPoints.pop();
  while (markPoints.length < maxMarks) {
    markPoints.push({
      ao: markPoints.length === 0 ? "AO1" : "AO2",
      point_text: "",
      feedback_if_missing: "",
      image_url: null,
      max_marks: 1
    });
  }

  if (edits.max_marks != null) {
    const aoSum = (q.ao1_marks || 0) + (q.ao2_marks || 0) + (q.ao3_marks || 0);
    if (aoSum !== maxMarks) {
      if (maxMarks === 1) {
        q.ao1_marks = 1;
        q.ao2_marks = 0;
        q.ao3_marks = 0;
      } else {
        q.ao1_marks = 1;
        q.ao2_marks = 1;
        q.ao3_marks = 0;
      }
    }
  }

  return {
    ...draft,
    variant: {
      question_type: "short_text",
      demand_level: q.demand_level,
      max_marks: maxMarks
    },
    question: q,
    mark_points: edits.keepEmptyMarkPoints
      ? markPoints
      : markPoints.filter((mp) => mp.point_text || mp.feedback_if_missing)
  };
}

export function syncExtendedDraftFromPreviewEdits(draft, edits) {
  const q = { ...draft.question };
  if (edits.prompt != null) q.prompt = edits.prompt;
  if (edits.command_word != null) q.command_word = edits.command_word;
  if (edits.ao1_marks != null) q.ao1_marks = edits.ao1_marks;
  if (edits.ao2_marks != null) q.ao2_marks = edits.ao2_marks;
  if (edits.ao3_marks != null) q.ao3_marks = edits.ao3_marks;
  if (edits.image_url !== undefined) q.image_url = edits.image_url;
  if (edits.demand_level != null) q.demand_level = edits.demand_level;
  if (edits.max_marks != null) {
    q.max_marks = normalizeRecipeMaxMarks("extended_response", edits.max_marks);
    const aoSum = (q.ao1_marks || 0) + (q.ao2_marks || 0) + (q.ao3_marks || 0);
    if (aoSum !== q.max_marks) {
      if (q.max_marks === 4) {
        q.ao1_marks = 1;
        q.ao2_marks = 2;
        q.ao3_marks = 1;
      } else {
        q.ao1_marks = 2;
        q.ao2_marks = 2;
        q.ao3_marks = 2;
      }
    }
  }

  const prevPayload = draft.answer_key?.key_payload || {};
  const prevLevels = prevPayload.level_descriptors || {};
  const levelDescriptors = sanitizeLevelDescriptorsForMarks({
    [LEVEL_3_KEY]: edits.level_3 != null
      ? String(edits.level_3).trim()
      : (prevLevels[LEVEL_3_KEY] || ""),
    [LEVEL_2_KEY]: edits.level_2 != null
      ? String(edits.level_2).trim()
      : (prevLevels[LEVEL_2_KEY] || ""),
    [LEVEL_1_KEY]: edits.level_1 != null
      ? String(edits.level_1).trim()
      : (prevLevels[LEVEL_1_KEY] || "")
  }, q.max_marks);

  return {
    ...draft,
    variant: {
      question_type: "extended_response",
      demand_level: q.demand_level,
      max_marks: q.max_marks
    },
    question: q,
    answer_key: {
      key_type: "ai_rubric",
      key_payload: {
        marking_guidelines: edits.marking_guidelines != null
          ? String(edits.marking_guidelines).trim()
          : String(prevPayload.marking_guidelines || "").trim(),
        level_descriptors: levelDescriptors
      }
    },
    mark_points: []
  };
}

export function validateDraftForCommit(draft, index = 0) {
  const label = `Draft ${index + 1}`;
  const q = draft?.question;
  if (!q?.prompt?.trim()) return `${label}: missing prompt`;

  const aoSum = (q.ao1_marks || 0) + (q.ao2_marks || 0) + (q.ao3_marks || 0);
  if (aoSum !== (q.max_marks || 1)) {
    return `${label}: AO marks (${aoSum}) must equal max marks (${q.max_marks})`;
  }

  if (q.question_type === "mcq") {
    const filled = (q.options || []).filter((o) => o?.trim());
    if (filled.length < 2) return `${label}: need at least 2 MCQ options`;
    const correct = draft.answer_key?.key_payload?.correct;
    if (!correct || !filled.includes(correct)) return `${label}: select a valid correct answer`;
    return null;
  }

  if (q.question_type === "extended_response") {
    const payload = draft.answer_key?.key_payload || {};
    if (!String(payload.marking_guidelines || "").trim()) {
      return `${label}: extended response needs marking guidelines`;
    }
    const levels = payload.level_descriptors || {};
    const level2 = String(levels[LEVEL_2_KEY] || "").trim();
    const level1 = String(levels[LEVEL_1_KEY] || "").trim();
    if (!level2 || !level1) {
      return `${label}: extended response needs Level 1 and Level 2 descriptors`;
    }
    if (q.max_marks === 6) {
      const level3 = String(levels[LEVEL_3_KEY] || "").trim();
      if (!level3 || /^n\/?a\b/i.test(level3)) {
        return `${label}: 6-mark extended response needs Level 3 descriptor`;
      }
    }
    return null;
  }

  const maxMarks = q.max_marks || 2;
  if (!draft.mark_points?.length) return `${label}: short text needs at least one mark checkpoint`;
  if (draft.mark_points.length !== maxMarks) {
    return `${label}: short text needs exactly ${maxMarks} mark checkpoint(s)`;
  }
  if (draft.mark_points.some((mp) => !mp.point_text?.trim())) {
    return `${label}: each mark checkpoint needs keywords`;
  }
  return null;
}

export async function invokeGenerateQuestions(supabaseClient, payload) {
  const { data, error } = await supabaseClient.functions.invoke("generate-questions", {
    body: payload
  });

  const serverMessage = typeof data?.error === "string" ? data.error : null;
  if (error) {
    throw new Error(serverMessage || error.message || "AI generation request failed");
  }
  if (serverMessage) {
    throw new Error(serverMessage);
  }

  const raw = data?.questions ?? data?.drafts ?? [];
  return {
    drafts: normalizeAiQuestions(raw, payload),
    warnings: data?.warnings || [],
    model: data?.model || null
  };
}

export function expandRecipes(recipes = []) {
  const expanded = [];
  for (const recipe of recipes) {
    const count = Math.max(0, parseInt(recipe.count, 10) || 0);
    const questionType = normalizeQuestionType(recipe.question_type);
    const demandLevel = recipe.demand_level || "low";
    const maxMarks = normalizeRecipeMaxMarks(questionType, recipe.max_marks);
    for (let i = 0; i < count; i++) {
      const entry = { question_type: questionType, demand_level: demandLevel };
      if (questionType !== "mcq") entry.max_marks = maxMarks;
      expanded.push(entry);
    }
  }
  return expanded;
}

export function recipeKey(recipe = {}) {
  const questionType = normalizeQuestionType(recipe.question_type);
  const demandLevel = recipe.demand_level || "low";
  if (questionType === "mcq") return `${questionType}|${demandLevel}`;
  const maxMarks = normalizeRecipeMaxMarks(questionType, recipe.max_marks);
  return `${questionType}|${demandLevel}|${maxMarks}`;
}

export function countRecipesByKey(recipes = []) {
  const counts = {};
  for (const recipe of recipes) {
    const key = recipeKey(recipe);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function recipeFromKey(key) {
  const [question_type, demand_level, marksPart] = String(key).split("|");
  const entry = { question_type, demand_level };
  if (marksPart != null && question_type !== "mcq") {
    entry.max_marks = normalizeRecipeMaxMarks(question_type, marksPart);
  }
  return entry;
}

export function computeGapFillRecipes(targetExpanded, existingDrafts = []) {
  const targets = countRecipesByKey(targetExpanded);
  const existing = countRecipesByKey(
    existingDrafts.map((d) => ({
      question_type: d?.question?.question_type,
      demand_level: d?.question?.demand_level,
      max_marks: d?.question?.max_marks
    }))
  );
  const out = [];
  for (const [key, target] of Object.entries(targets)) {
    const have = existing[key] || 0;
    const gap = Math.max(0, target - have);
    const entry = recipeFromKey(key);
    for (let i = 0; i < gap; i++) {
      out.push({ ...entry });
    }
  }
  return out;
}

export function splitTemplateAndAiRecipes(recipes = []) {
  // Kept for tests; all recipes use Gemini in Question Studio.
  return { templateRecipes: [], aiRecipes: [...recipes] };
}

export function draftsToAvoidQuestions(drafts = []) {
  return drafts
    .map((draft) => {
      const q = draft?.question || {};
      const correct = draft?.answer_key?.key_payload?.correct || "";
      const markPoints = (draft?.mark_points || []).map((mp) => ({
        keywords: mp.point_text || mp.keywords || "",
        point_text: mp.point_text || mp.keywords || ""
      }));
      return {
        question_type: normalizeQuestionType(q.question_type),
        prompt: String(q.prompt || "").trim(),
        command_word: q.command_word || "",
        correct,
        mark_points: markPoints,
        max_marks: q.max_marks
      };
    })
    .filter((q) => q.prompt);
}

function withDraftDifficulty(draft, computeDifficulty) {
  if (!draft?.question || typeof computeDifficulty !== "function") return draft;
  return {
    ...draft,
    question: {
      ...draft.question,
      difficulty: computeDifficulty(draft.question)
    }
  };
}

/**
 * Question Studio batch via Gemini Flash-Lite. Appends when gap-fill applies.
 */
export async function generateQuestionStudioBatch(supabaseClient, {
  spec,
  specPoint,
  existingDrafts = [],
  computeDifficulty = null
}) {
  const expanded = expandRecipes(spec.recipes);
  const gapFill = existingDrafts.length > 0;
  const toGenerate = gapFill ? computeGapFillRecipes(expanded, existingDrafts) : expanded;

  if (!toGenerate.length) {
    return {
      drafts: [],
      warnings: ["Recipe targets already met in preview — increase counts or clear preview to regenerate."],
      model: null,
      appended: false
    };
  }

  if (toGenerate.length > STUDIO_MAX_QUESTIONS) {
    throw new Error(`Maximum ${STUDIO_MAX_QUESTIONS} questions per request — reduce recipe counts`);
  }

  const authorPrompt = String(spec.author_prompt || "").trim();

  const aiResult = await invokeGenerateQuestions(supabaseClient, {
    subject: spec.subject,
    paper: spec.paper,
    tier: spec.tier,
    spec_ref: specPoint.spec_ref,
    topic_name: specPoint.topic_name,
    spec_text: specPoint.spec_text,
    author_prompt: authorPrompt || undefined,
    recipes: toGenerate,
    avoid_questions: draftsToAvoidQuestions(existingDrafts),
    focus_offset: Math.floor(Math.random() * 5)
  });

  const drafts = (aiResult.drafts || []).map((d) => withDraftDifficulty(d, computeDifficulty));

  return {
    drafts,
    warnings: aiResult.warnings || [],
    model: aiResult.model,
    appended: gapFill
  };
}

/**
 * Parse a batch-export or spec-ref JSON file for admin import.
 */
export function parseImportedDraftBundle(raw) {
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!data || typeof data !== "object") {
    throw new Error("Invalid import file — expected JSON object");
  }
  const drafts = Array.isArray(data) ? data : (data.drafts || []);
  if (!Array.isArray(drafts) || !drafts.length) {
    throw new Error("Import file contains no drafts");
  }
  return {
    meta: data.meta || null,
    drafts,
    warnings: Array.isArray(data.warnings) ? data.warnings : []
  };
}

export function ensureDraftImportMeta(draft, bundleMeta = null) {
  if (draft?.import_meta?.spec_ref) return draft;
  if (!bundleMeta?.spec_ref) return draft;
  return {
    ...draft,
    import_meta: {
      spec_ref: bundleMeta.spec_ref,
      subject: bundleMeta.subject,
      paper: bundleMeta.paper,
      course_track: bundleMeta.course_track || "combined",
      audience: bundleMeta.audience || "both",
      tier: bundleMeta.tier || "both",
      topic_name: bundleMeta.topic_name,
      topic_number: bundleMeta.topic_number
    }
  };
}

export function prepareImportedDrafts(bundle, computeDifficulty = null) {
  const parsed = parseImportedDraftBundle(bundle);
  const drafts = parsed.drafts.map((d) => {
    const withMeta = ensureDraftImportMeta(d, parsed.meta);
    const draft = withDraftDifficulty(withMeta, computeDifficulty);
    const existingProv = draft.provenance || d.provenance || d._provenance || null;
    const originalSnapshot = existingProv?.original_snapshot || {
      question: draft.question,
      answer_key: draft.answer_key,
      mark_points: draft.mark_points || []
    };
    if (existingProv) {
      draft.provenance = {
        source: "ai_studio_import",
        prompt_text: existingProv.prompt_text ?? existingProv.prompt ?? null,
        raw_response: existingProv.raw_response ?? null,
        model: existingProv.model ?? parsed.meta?.model ?? null,
        request_id: existingProv.request_id ?? null,
        usage: existingProv.usage ?? existingProv.usage_meta ?? null,
        original_prompt: existingProv.original_prompt ?? draft.question?.prompt ?? null,
        original_snapshot: originalSnapshot,
        input_meta: {
          ...(parsed.meta || {}),
          ...(existingProv.input_meta && typeof existingProv.input_meta === "object"
            ? existingProv.input_meta
            : {}),
          import_meta: draft.import_meta || null
        }
      };
    } else {
      draft.provenance = {
        source: "ai_studio_import",
        prompt_text: null,
        raw_response: JSON.stringify({
          question: draft.question,
          answer_key: draft.answer_key,
          mark_points: draft.mark_points || [],
          variant: draft.variant || null
        }),
        model: parsed.meta?.model || null,
        request_id: null,
        usage: null,
        original_prompt: draft.question?.prompt || null,
        original_snapshot: originalSnapshot,
        input_meta: {
          ...(parsed.meta || {}),
          import_meta: draft.import_meta || null,
          note: "Import file had no embedded AI prompt; logged committed draft snapshot."
        }
      };
    }
    return draft;
  });
  return { ...parsed, drafts };
}
