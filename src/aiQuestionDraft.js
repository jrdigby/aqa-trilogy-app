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

const MCQ_TYPES = new Set(["mcq"]);
const SHORT_TYPES = new Set(["short_text", "short text", "short-text"]);

export function demandRecipeLabel(variant) {
  if (!variant) return "—";
  const parts = [];
  if (variant.question_type) parts.push(variant.question_type === "mcq" ? "MCQ" : "Short text");
  if (variant.demand_level) parts.push(formatDemandLabel(variant.demand_level));
  return parts.join(" · ") || "—";
}

function normalizeQuestionType(raw) {
  const t = String(raw || "mcq").trim().toLowerCase();
  if (SHORT_TYPES.has(t)) return "short_text";
  return "mcq";
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

function normalizeSingleQuestion(raw, context = {}) {
  const questionType = normalizeQuestionType(raw?.question_type);
  const tier = normalizeQuestionTierForDb(context.tier || raw?.tier || "both");
  const demandLevel = raw?.demand_level || "low";
  const variant = {
    question_type: questionType,
    demand_level: demandLevel
  };

  if (questionType === "mcq") {
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
      variant,
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

  const maxMarks = Number(raw?.max_marks ?? 2) || 2;
  const markPoints = normalizeMarkPoints(raw?.mark_points, maxMarks);
  const ao1 = Number(raw?.ao1_marks ?? Math.min(1, maxMarks)) || 0;
  const ao2 = Number(raw?.ao2_marks ?? Math.max(0, maxMarks - ao1)) || 0;
  const ao3 = Number(raw?.ao3_marks ?? 0) || 0;

  const question = {
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
  };

  return {
    variant,
    question,
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

export function normalizeAiQuestions(rawList, context = {}) {
  const list = Array.isArray(rawList) ? rawList : [];
  return list.map((raw) => normalizeSingleQuestion(raw, context)).filter((d) => d.question.prompt);
}

export function syncDraftFromPreviewEdits(draft, edits) {
  if (!draft?.question) return draft;
  if (draft.question.question_type === "short_text") {
    return syncShortTextDraftFromPreviewEdits(draft, edits);
  }
  return syncMcqDraftFromPreviewEdits(draft, edits);
}

export function syncShortTextDraftFromPreviewEdits(draft, edits) {
  const q = { ...draft.question };
  if (edits.prompt != null) q.prompt = edits.prompt;
  if (edits.command_word != null) q.command_word = edits.command_word;
  if (edits.ao1_marks != null) q.ao1_marks = edits.ao1_marks;
  if (edits.ao2_marks != null) q.ao2_marks = edits.ao2_marks;
  if (edits.ao3_marks != null) q.ao3_marks = edits.ao3_marks;
  if (edits.image_url !== undefined) q.image_url = edits.image_url;

  const markPoints = (edits.mark_points || draft.mark_points || []).map((mp, i) => {
    const prev = draft.mark_points?.[i] || {};
    return {
      ao: mp.ao ?? prev.ao ?? "AO1",
      point_text: mp.point_text ?? prev.point_text ?? "",
      feedback_if_missing: mp.feedback_if_missing ?? prev.feedback_if_missing ?? "",
      image_url: mp.image_url ?? prev.image_url ?? null,
      max_marks: 1
    };
  });

  return {
    ...draft,
    question: q,
    mark_points: markPoints.filter((mp) => mp.point_text || mp.feedback_if_missing)
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

  if (!draft.mark_points?.length) return `${label}: short text needs at least one mark checkpoint`;
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
    for (let i = 0; i < count; i++) {
      expanded.push({ question_type: questionType, demand_level: demandLevel });
    }
  }
  return expanded;
}

export function recipeKey(recipe = {}) {
  const questionType = normalizeQuestionType(recipe.question_type);
  const demandLevel = recipe.demand_level || "low";
  return `${questionType}|${demandLevel}`;
}

export function countRecipesByKey(recipes = []) {
  const counts = {};
  for (const recipe of recipes) {
    const key = recipeKey(recipe);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

export function computeGapFillRecipes(targetExpanded, existingDrafts = []) {
  const targets = countRecipesByKey(targetExpanded);
  const existing = countRecipesByKey(
    existingDrafts.map((d) => ({
      question_type: d?.question?.question_type,
      demand_level: d?.question?.demand_level
    }))
  );
  const out = [];
  for (const [key, target] of Object.entries(targets)) {
    const have = existing[key] || 0;
    const gap = Math.max(0, target - have);
    const [question_type, demand_level] = key.split("|");
    for (let i = 0; i < gap; i++) {
      out.push({ question_type, demand_level });
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
        mark_points: markPoints
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

  const aiResult = await invokeGenerateQuestions(supabaseClient, {
    subject: spec.subject,
    paper: spec.paper,
    tier: spec.tier,
    spec_ref: specPoint.spec_ref,
    topic_name: specPoint.topic_name,
    spec_text: specPoint.spec_text,
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
