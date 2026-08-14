import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const MAX_QUESTIONS = 20;
const GEMINI_CALL_TIMEOUT_MS = 50_000;
const FUNCTION_BUDGET_MS = 130_000;
const SPEC_TEXT_MAX_CHARS = 1200;
const AUTHOR_PROMPT_MAX_CHARS = 800;
const RECIPE_GAP_MS = 600;
const RETRYABLE_STATUSES = new Set([429, 500, 503, 504]);
const RETRY_BACKOFF_MS = [1200, 2500, 5000, 8000, 12000];

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function recordAiUsageEvent(admin, row) {
  if (!admin || !row?.user_id) return;
  try {
    const { error } = await admin.from("ai_usage_events").insert(row);
    if (error) {
      console.error(JSON.stringify({
        event: "ai_usage_insert_failed",
        feature: row.feature,
        message: error.message
      }));
    }
  } catch (err) {
    console.error(JSON.stringify({
      event: "ai_usage_insert_failed",
      feature: row.feature,
      message: err?.message || String(err)
    }));
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncateSpecText(text) {
  const raw = String(text || "").trim();
  if (raw.length <= SPEC_TEXT_MAX_CHARS) return raw;
  return `${raw.slice(0, SPEC_TEXT_MAX_CHARS)}… [truncated for generation]`;
}

function truncateAuthorPrompt(text) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  if (raw.length <= AUTHOR_PROMPT_MAX_CHARS) return raw;
  return `${raw.slice(0, AUTHOR_PROMPT_MAX_CHARS)}… [truncated]`;
}

function recipeMaxMarks(recipe) {
  const type = recipe?.question_type;
  if (type === "short_text") return Number(recipe?.max_marks) === 1 ? 1 : 2;
  if (type === "extended_response") return Number(recipe?.max_marks) === 4 ? 4 : 6;
  return 1;
}

function isRecallShortTextRecipe(recipe) {
  return recipe?.question_type === "short_text"
    && Number(recipe?.max_marks) === 1
    && recipe?.demand_level === "standard_45";
}

const MCQ_FOCUS_ANGLES = [
  "Core recall — key term, symbol, unit, or single fact from the spec.",
  "Applied scenario — short unfamiliar context; student applies knowledge.",
  "Discrimination — distinguish between two easily confused concepts.",
  "Misconception — plausible wrong ideas as distractors; tests precise understanding.",
  "Observation or data — interpret a described result, trend, or experimental outcome."
];

const SHORT_TEXT_FOCUS_ANGLES = [
  "Describe — structure, process, or pattern named in the spec.",
  "Explain — cause, effect, or mechanism (why/how).",
  "Compare or link — relationship between two spec ideas.",
  "Apply — short novel context requiring spec knowledge in an answer.",
  "Evaluate evidence — use a described observation to justify a conclusion."
];

const RECALL_SHORT_TEXT_FOCUS_ANGLES = [
  "State — key term, symbol, unit, or single fact from the spec.",
  "Name — identify a substance, structure, particle, or piece of apparatus.",
  "Give — provide one quantity, value, formula, or property from the spec.",
  "Define — one-sentence definition of a spec term.",
  "Identify — recognise a labelled part, variable, hazard symbol, or classification."
];

const EXTENDED_FOCUS_ANGLES = [
  "Explain a process or mechanism in a structured extended answer.",
  "Apply ideas to an unfamiliar practical or real-world context.",
  "Compare options or evaluate a claim using scientific reasoning.",
  "Link several related ideas from the spec into a coherent argument.",
  "Interpret given information and justify a conclusion at length."
];

function buildRecipeContexts(recipes) {
  const typeTotals = {};
  for (const recipe of recipes) {
    const t = recipe.question_type;
    typeTotals[t] = (typeTotals[t] || 0) + 1;
  }
  const typeSeen = {};
  return recipes.map((recipe, batchIndex) => {
    const t = recipe.question_type;
    const sameTypeIndex = typeSeen[t] || 0;
    typeSeen[t] = sameTypeIndex + 1;
    return { batchIndex, recipe, sameTypeIndex, sameTypeTotal: typeTotals[t] || 1 };
  });
}

function summarizeQuestionKey(question) {
  if (question.question_type === "short_text") {
    const kws = (question.mark_points || [])
      .map((mp) => mp.keywords || mp.point_text)
      .filter(Boolean)
      .join("; ");
    return kws || "—";
  }
  if (question.question_type === "extended_response") {
    return String(question.marking_guidelines || "").slice(0, 40) || "rubric";
  }
  return question.correct || "—";
}

function normalizeForCompare(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenOverlapRatio(a, b) {
  const wordsA = new Set(normalizeForCompare(a).split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(normalizeForCompare(b).split(" ").filter((w) => w.length > 2));
  if (!wordsA.size || !wordsB.size) return 0;
  let shared = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) shared++;
  }
  return shared / Math.min(wordsA.size, wordsB.size);
}

function stemCore(text) {
  return normalizeForCompare(text)
    .replace(/^state which statement correctly describes:\s*/i, "")
    .trim();
}

function stemSignature(text) {
  const core = stemCore(text) || normalizeForCompare(text);
  const STEM_BOILERPLATE = /\b(state|give|name|define|identify|which|statement|statements|about|correct|according|the|specification|for|this|topic|student|investigates|revises|lesson|during|an|experiment|in|a|on|exam|style|best|applies|focusing|describe|explain|suggest|compare|evaluate|justify|discuss|higher|tier|demand)\b/gi;
  const stripped = core.replace(STEM_BOILERPLATE, " ").replace(/\s+/g, " ").trim();
  return stripped || core;
}

function overlapThresholdForDemand(demandLevel) {
  if (demandLevel === "standard_67" || demandLevel === "high_89") return 0.92;
  if (demandLevel === "standard_45") return 0.88;
  if (demandLevel === "standard") return 0.8;
  return 0.72;
}

function priorMatchesScope(prev, candidate) {
  if (candidate.question_type && prev?.question_type && prev.question_type !== candidate.question_type) {
    return false;
  }
  if (candidate.demand_level && prev?.demand_level && prev.demand_level !== candidate.demand_level) {
    return false;
  }
  return true;
}

function isNearDuplicateQuestion(candidate, priorSameType) {
  const signature = stemSignature(candidate.prompt);
  if (!signature) return false;
  const threshold = overlapThresholdForDemand(candidate.demand_level);

  for (const prev of priorSameType) {
    if (!priorMatchesScope(prev, candidate)) continue;
    const prevSignature = stemSignature(prev.prompt);
    if (!prevSignature) continue;
    if (signature === prevSignature) return true;
    if (tokenOverlapRatio(signature, prevSignature) >= threshold) return true;
    if (
      candidate.question_type === "mcq"
      && prev.correct
      && candidate.correct
      && normalizeForCompare(candidate.correct) === normalizeForCompare(prev.correct)
    ) {
      return true;
    }
  }
  return false;
}

const FILLER_PATTERN = /check the specification point carefully|distractor \d/i;
const OPEN_ENDED_COMMANDS = new Set([
  "explain", "describe", "suggest", "compare", "evaluate", "justify", "discuss", "analyse", "analyze"
]);

function optionDistinctness(options = [], correct = "") {
  const trimmed = options.map((o) => String(o || "").trim()).filter(Boolean);
  if (trimmed.length < 4) return false;
  const correctNorm = normalizeForCompare(correct);
  for (let i = 0; i < trimmed.length; i++) {
    for (let j = i + 1; j < trimmed.length; j++) {
      const a = normalizeForCompare(trimmed[i]);
      const b = normalizeForCompare(trimmed[j]);
      if (a === b) return false;
      const bothWrong = a !== correctNorm && b !== correctNorm;
      if (bothWrong && tokenOverlapRatio(trimmed[i], trimmed[j]) >= 0.85) return false;
    }
  }
  return true;
}

function countScientificPointsForGate(raw) {
  if (!raw) return 0;
  if (Array.isArray(raw)) return raw.filter(Boolean).length;
  if (typeof raw === "string") {
    return raw.split(/\r?\n|;/).map((s) => s.trim()).filter((s) => s.length > 8).length;
  }
  return 0;
}

function passesRecallShortTextGate(question, recipe) {
  const prompt = String(question?.prompt || "").trim();
  const commandWord = String(question?.command_word || "").toLowerCase().trim();
  const markPoints = Array.isArray(question?.mark_points) ? question.mark_points : [];

  if (prompt.length < 12 || prompt.length > 280) return false;
  if (OPEN_ENDED_COMMANDS.has(commandWord)) return false;
  if (/^(explain|describe|suggest|compare|evaluate|justify|discuss|analyse|analyze)\b/i.test(prompt)) {
    return false;
  }
  if (Number(recipe?.max_marks) !== 1 || markPoints.length !== 1) return false;

  const keywords = String(markPoints[0]?.keywords || markPoints[0]?.point_text || "").trim();
  if (!keywords) return false;
  const synonyms = keywords.split("|").map((s) => s.trim()).filter(Boolean);
  if (synonyms.length > 4 || keywords.length > 100) return false;
  return true;
}

function passesQualityGate(question, recipe, priorSameType = []) {
  const type = recipe?.question_type || question?.question_type;
  const prompt = String(question?.prompt || "").trim();
  if (isNearDuplicateQuestion(question, priorSameType)) return false;

  if (type === "extended_response") {
    const maxMarks = Number(recipe?.max_marks) === 4 ? 4 : 6;
    if (prompt.length < 30) return false;
    if (countScientificPointsForGate(question.key_scientific_points) < 2) return false;
    if (!String(question.marking_guidelines || "").trim()) return false;
    if (!String(question.level_1_descriptor || "").trim()) return false;
    if (!String(question.level_2_descriptor || "").trim()) return false;
    if (maxMarks === 6 && !String(question.level_3_descriptor || "").trim()) return false;
    return true;
  }

  if (type === "short_text") {
    if (isRecallShortTextRecipe(recipe)) return passesRecallShortTextGate(question, recipe);
    const markPoints = Array.isArray(question?.mark_points) ? question.mark_points : [];
    return prompt.length >= 12 && prompt.length <= 280 && markPoints.length >= 1;
  }

  if (type !== "mcq") return true;

  const options = Array.isArray(question?.options) ? question.options : [];
  const correct = String(question?.correct || "").trim();
  if (prompt.length < 20 || prompt.length > 280) return false;
  if (!correct || !optionDistinctness(options, correct)) return false;
  if (!options.some((o) => normalizeForCompare(o) === normalizeForCompare(correct))) return false;
  if (FILLER_PATTERN.test(options.join(" "))) return false;

  const wrongOptions = options.filter((o) => normalizeForCompare(o) !== normalizeForCompare(correct));
  const feedback = question.option_feedback || [];
  const feedbackCount = Array.isArray(feedback)
    ? feedback.filter((f) => String(f?.feedback || "").trim().length >= 8).length
    : Object.keys(feedback).filter((k) => k !== correct && String(feedback[k] || "").trim().length >= 8).length;
  if (feedbackCount < Math.min(3, wrongOptions.length)) return false;

  return true;
}

function buildAvoidByType(avoidQuestions) {
  const out = { mcq: [], short_text: [], extended_response: [] };
  for (const q of avoidQuestions || []) {
    const t = q?.question_type === "short_text"
      ? "short_text"
      : q?.question_type === "extended_response"
        ? "extended_response"
        : "mcq";
    out[t].push(q);
  }
  return out;
}

function typeHintForRecipe(recipe) {
  const marks = recipeMaxMarks(recipe);
  if (recipe.question_type === "short_text") {
    if (isRecallShortTextRecipe(recipe)) {
      return "short_text RECALL (1-mark): exactly 1 mark_point with a tight keywords string (max 3 synonyms separated by |). command_word MUST be one of: state, name, give, define, identify. Do NOT use explain, describe, suggest, compare, evaluate, justify, or discuss. The answer must be a brief factual recall (word, phrase, symbol, unit, name, or value) — NOT an extended explanation. max_marks 1, ao1=1 ao2=0 ao3=0. Feedback max 12 words.";
    }
    const aoHint = marks === 1
      ? "max_marks 1, ao1=1 ao2=0 ao3=0"
      : "max_marks 2, ao1=1 ao2=1 ao3=0";
    return `short_text: exactly ${marks} mark_point(s) with keyword strings suitable for keyword marking (use | for synonyms within a point), brief feedback per point, ${aoHint}. Feedback max 12 words each. Word the question so answers can be marked by keyword checkpoints.`;
  }
  if (recipe.question_type === "extended_response") {
    const pointsHint =
      "REQUIRED field key_scientific_points: a single string with 4–8 short scientific content statements, EACH ON ITS OWN LINE (use \\n between points). These are the local-feedback checklist items a full-mark answer must cover. Example value: \"Weight acts downwards from the centre of mass\\nNormal contact force acts upwards\\nForces are equal in size\". Use concrete science terms, not command words. Never leave this field blank.";
    const levelHint = marks === 6
      ? "Fill level_3_descriptor (top/full band, 5–6 marks), level_2_descriptor (mid band, 3–4 marks), and level_1_descriptor (limited, 1–2 marks)."
      : "For 4-mark: level_2_descriptor is the TOP/FULL-MARKS band (complete coherent answer worth 3–4 marks — not a partial answer). level_1_descriptor is limited/partial (1–2 marks). Set level_3_descriptor to \"N/A for 4-mark\".";
    return `extended_response: max_marks ${marks}. Provide key_scientific_points first, then marking_guidelines and level descriptors. ${pointsHint} ${levelHint} AO marks must sum to ${marks}.`;
  }
  return "mcq: exactly 4 options, one correct answer, three distractors based on common science misconceptions for the topic, option_feedback for each wrong option only (3 entries), max_marks 1, ao1=1. Wrong-option feedback max 12 words each.";
}

function focusAnglesForRecipe(recipe) {
  if (isRecallShortTextRecipe(recipe)) return RECALL_SHORT_TEXT_FOCUS_ANGLES;
  if (recipe.question_type === "short_text") return SHORT_TEXT_FOCUS_ANGLES;
  if (recipe.question_type === "extended_response") return EXTENDED_FOCUS_ANGLES;
  return MCQ_FOCUS_ANGLES;
}

function buildSingleQuestionPrompt(payload, recipe, context = {}) {
  const { spec_ref, topic_name, spec_text, subject, paper, tier } = payload;
  const authorPrompt = truncateAuthorPrompt(payload.author_prompt);
  const {
    batchIndex = 0,
    sameTypeIndex = 0,
    sameTypeTotal = 1,
    priorSameType = [],
    avoidSameType = [],
    focusOffset = 0,
    forceDistinct = false
  } = context;

  const allPrior = [...avoidSameType, ...priorSameType];
  const marks = recipeMaxMarks(recipe);
  const typeHint = typeHintForRecipe(recipe);

  const angles = focusAnglesForRecipe(recipe);
  const focusAngle = angles[(avoidSameType.length + sameTypeIndex + focusOffset) % angles.length];

  const usedCommands = [...new Set(allPrior.map((q) => q.command_word).filter(Boolean))];
  const avoidCommands = usedCommands.length
    ? `Use a different command_word than: ${usedCommands.join(", ")}.`
    : "";

  const avoidBlock = allPrior.length
    ? `\nALREADY IN THIS BATCH — new spec angle, scenario, and answer required:\n${allPrior.map((q, n) => {
      const key = summarizeQuestionKey(q);
      const gist = String(q.prompt || "").slice(0, 50);
      return `${n + 1}. ${q.command_word || "?"} · ${key} · "${gist}${gist.length >= 50 ? "…" : ""}"`;
    }).join("\n")}`
    : "";

  const distinctNote = forceDistinct
    ? "\nCRITICAL: Your last attempt duplicated an existing question. Pick a completely different sub-topic and scenario.\n"
    : "";

  const varietyWithinFocus = authorPrompt
    ? `\nThis is ${recipe.question_type} ${sameTypeIndex + 1} of ${sameTypeTotal} in the batch. Stay on the AUTHOR FOCUS below; vary only the example, scenario, or misconception within that focus — do NOT switch to a different sub-topic from the wider spec.\nAngle within the focus: ${focusAngle}\n${avoidCommands}`
    : `\nThis is ${recipe.question_type} ${sameTypeIndex + 1} of ${sameTypeTotal} in the batch. It MUST test a different aspect of the spec than the others.\nFocus angle for this question: ${focusAngle}\n${avoidCommands}`;

  const varietyNote = sameTypeTotal > 1 ? varietyWithinFocus : "";

  const authorBlock = authorPrompt
    ? `\nAUTHOR FOCUS (MANDATORY — this overrides picking a random idea from the full spec):\n"""\n${authorPrompt}\n"""\nThe question stem, correct answer, and distractors MUST be about this focus only. The spec text is context and constraint — do not write a question whose main idea is outside the focus (e.g. if the focus is non-contact forces, do not ask about Hooke's law, spring extension, weight vs mass definitions, or the unit of force unless that is explicitly the focus).\n`
    : "";

  const promptLineRule = recipe.question_type === "extended_response"
    ? "Prompt may use short paragraphs if needed, but prefer a clear exam-style stem."
    : "Single-line prompt (no line breaks).";

  const closingRequirements = authorPrompt
    ? `Requirements: ${typeHint} · appropriate AQA command_word · ON-FOCUS for the AUTHOR FOCUS above · genuinely distinct from any listed above.`
    : `Requirements: ${typeHint} · appropriate AQA command_word · genuinely distinct from any listed above.`;

  return `AQA GCSE Combined Science (8464) question author. Write ONE original exam-style question. British English.
${distinctNote}${varietyNote}${authorBlock}
Subject: ${subject} · Paper: ${paper} · Spec: ${spec_ref} · Topic: ${topic_name} · Tier: ${tier}
Batch item: ${batchIndex + 1} · Type: ${recipe.question_type} · demand_level: ${recipe.demand_level} · max_marks: ${marks}
Spec text (syllabus constraint — use only as needed to stay accurate; when AUTHOR FOCUS is set, do not roam the whole spec):
"""
${truncateSpecText(spec_text)}
"""
${avoidBlock}

${authorPrompt ? `FINAL CHECK: Does this question directly address: "${authorPrompt}"? If not, rewrite so it does.\n` : ""}${closingRequirements}
${promptLineRule} Be concise — no preamble or explanation outside the JSON schema.`;
}

const MCQ_SCHEMA = {
  type: "OBJECT",
  properties: {
    question_type: { type: "STRING", enum: ["mcq"] },
    demand_level: { type: "STRING" },
    command_word: { type: "STRING", maxLength: 24 },
    prompt: { type: "STRING", maxLength: 280 },
    max_marks: { type: "INTEGER" },
    ao1_marks: { type: "INTEGER" },
    ao2_marks: { type: "INTEGER" },
    ao3_marks: { type: "INTEGER" },
    options: {
      type: "ARRAY",
      minItems: 4,
      maxItems: 4,
      items: { type: "STRING", maxLength: 160 }
    },
    correct: { type: "STRING", maxLength: 160 },
    option_feedback: {
      type: "ARRAY",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "OBJECT",
        properties: {
          option: { type: "STRING", maxLength: 160 },
          feedback: { type: "STRING", maxLength: 80 }
        },
        required: ["option", "feedback"]
      }
    }
  },
  required: [
    "question_type", "demand_level", "command_word", "prompt", "max_marks",
    "ao1_marks", "ao2_marks", "ao3_marks", "options", "correct", "option_feedback"
  ],
  propertyOrdering: [
    "question_type", "demand_level", "command_word", "prompt", "max_marks",
    "ao1_marks", "ao2_marks", "ao3_marks", "options", "correct", "option_feedback"
  ]
};

const MARK_POINT_ITEM = {
  type: "OBJECT",
  properties: {
    ao: { type: "STRING", maxLength: 4 },
    keywords: { type: "STRING", maxLength: 120 },
    feedback: { type: "STRING", maxLength: 80 }
  },
  required: ["ao", "keywords", "feedback"]
};

function shortTextSchema(maxMarks = 2) {
  const n = Number(maxMarks) === 1 ? 1 : 2;
  return {
    type: "OBJECT",
    properties: {
      question_type: { type: "STRING", enum: ["short_text"] },
      demand_level: { type: "STRING" },
      command_word: { type: "STRING", maxLength: 24 },
      prompt: { type: "STRING", maxLength: 280 },
      max_marks: { type: "INTEGER" },
      ao1_marks: { type: "INTEGER" },
      ao2_marks: { type: "INTEGER" },
      ao3_marks: { type: "INTEGER" },
      mark_points: {
        type: "ARRAY",
        minItems: n,
        maxItems: n,
        items: MARK_POINT_ITEM
      }
    },
    required: [
      "question_type", "demand_level", "command_word", "prompt", "max_marks",
      "ao1_marks", "ao2_marks", "ao3_marks", "mark_points"
    ],
    propertyOrdering: [
      "question_type", "demand_level", "command_word", "prompt", "max_marks",
      "ao1_marks", "ao2_marks", "ao3_marks", "mark_points"
    ]
  };
}

const EXTENDED_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    question_type: { type: "STRING", enum: ["extended_response"] },
    demand_level: { type: "STRING" },
    command_word: { type: "STRING", maxLength: 24 },
    prompt: { type: "STRING", maxLength: 800 },
    max_marks: { type: "INTEGER" },
    ao1_marks: { type: "INTEGER" },
    ao2_marks: { type: "INTEGER" },
    ao3_marks: { type: "INTEGER" },
    // Newline-separated STRING is more reliable than ARRAY for flash-lite structured output.
    key_scientific_points: {
      type: "STRING",
      description: "4–8 concise scientific content statements for the local feedback checklist, each on its own line",
      maxLength: 1200
    },
    marking_guidelines: { type: "STRING", maxLength: 1200 },
    level_3_descriptor: { type: "STRING", maxLength: 600 },
    level_2_descriptor: { type: "STRING", maxLength: 600 },
    level_1_descriptor: { type: "STRING", maxLength: 600 }
  },
  required: [
    "question_type", "demand_level", "command_word", "prompt", "max_marks",
    "ao1_marks", "ao2_marks", "ao3_marks",
    "key_scientific_points", "marking_guidelines",
    "level_3_descriptor", "level_2_descriptor", "level_1_descriptor"
  ],
  propertyOrdering: [
    "question_type", "demand_level", "command_word", "prompt", "max_marks",
    "ao1_marks", "ao2_marks", "ao3_marks",
    "key_scientific_points", "marking_guidelines",
    "level_3_descriptor", "level_2_descriptor", "level_1_descriptor"
  ]
};

function schemaForQuestionType(questionType, maxMarks) {
  if (questionType === "short_text") return shortTextSchema(maxMarks ?? 2);
  if (questionType === "extended_response") return EXTENDED_RESPONSE_SCHEMA;
  return MCQ_SCHEMA;
}

function stripTrailingCommas(json) {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < json.length; i++) {
    const ch = json[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === "\"") inString = false;
      continue;
    }
    if (ch === "\"") {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < json.length && /\s/.test(json[j])) j++;
      if (json[j] === "]" || json[j] === "}") continue;
    }
    out += ch;
  }
  return out;
}

function sanitizeJsonCandidate(text) {
  return String(text || "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u201C\u201D]/g, "\"")
    .replace(/[\u2018\u2019]/g, "'")
    .trim();
}

function parseJsonCandidate(raw, label = "AI response") {
  for (const candidate of [raw, stripTrailingCommas(raw)]) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next
    }
  }
  const preview = raw.slice(0, 400).replace(/\s+/g, " ");
  throw new Error(`${label}: invalid JSON. Preview: ${preview}`);
}

function extractJson(text) {
  const trimmed = sanitizeJsonCandidate(text);
  if (!trimmed) throw new Error("AI response was empty");
  try {
    return parseJsonCandidate(trimmed, "AI JSON");
  } catch {
    // fall through
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = sanitizeJsonCandidate(fence ? fence[1] : trimmed);
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI response did not contain a JSON object");
  return parseJsonCandidate(candidate.slice(start, end + 1), "Extracted AI JSON");
}

function isTimeoutError(err) {
  return err?.name === "TimeoutError" || /timed out|timeout/i.test(err?.message || "");
}

function parseGeminiErrorBody(bodyText) {
  try {
    const parsed = JSON.parse(bodyText);
    return parsed?.error?.message || bodyText.slice(0, 200);
  } catch {
    return bodyText.slice(0, 200);
  }
}

class GeminiApiError extends Error {
  constructor(status, bodyText) {
    const detail = parseGeminiErrorBody(bodyText);
    super(`Gemini unavailable (${status}): ${detail}`);
    this.name = "GeminiApiError";
    this.status = status;
    this.retryable = RETRYABLE_STATUSES.has(status);
  }
}

function formatRecipeWarning(index, recipe, err) {
  const marks = recipe.max_marks != null ? ` · ${recipe.max_marks}m` : "";
  const label = `Question ${index} (${recipe.question_type} · ${recipe.demand_level}${marks})`;
  const msg = err?.message || String(err);
  if (/503|high demand|UNAVAILABLE/i.test(msg)) {
    return `${label}: Gemini busy — auto-retried; click Generate again if still missing`;
  }
  if (isTimeoutError(err)) {
    return `${label}: timed out — try fewer recipes per batch`;
  }
  return `${label}: ${msg}`;
}

async function callGeminiOnce(prompt, model, timeoutMs, responseSchema, requestId, index, temperature = 0.4, maxOutputTokens = 4096) {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured on the server");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens,
        responseMimeType: "application/json",
        responseSchema,
        thinkingConfig: { thinkingBudget: 0 }
      }
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!res.ok) {
    throw new GeminiApiError(res.status, await res.text());
  }

  const data = await res.json();
  const usage = data?.usageMetadata;
  const finishReason = data?.candidates?.[0]?.finishReason || null;
  if (usage) {
    console.log(JSON.stringify({
      requestId,
      event: "gemini_usage",
      index,
      model,
      promptTokenCount: usage.promptTokenCount,
      candidatesTokenCount: usage.candidatesTokenCount,
      totalTokenCount: usage.totalTokenCount,
      finishReason
    }));
  }

  const text = data?.candidates?.[0]?.content?.parts
    ?.filter((p) => p?.text && !p.thought)
    .map((p) => p.text)
    .join("\n")
    || data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");
  return {
    parsed: extractJson(text),
    rawText: text,
    usage: usage || null,
    finishReason
  };
}

async function callGemini(prompt, model, timeoutMs, requestId, index, questionType, maxMarks, temperature = 0.4) {
  const responseSchema = schemaForQuestionType(questionType, maxMarks);
  const maxOutputTokens = questionType === "extended_response" ? 8192 : 4096;
  let lastErr = null;

  for (let attempt = 0; attempt < RETRY_BACKOFF_MS.length; attempt++) {
    try {
      return await callGeminiOnce(
        prompt,
        model,
        timeoutMs,
        responseSchema,
        requestId,
        index,
        temperature,
        maxOutputTokens
      );
    } catch (err) {
      lastErr = err;
      const retryable = isTimeoutError(err) || (err instanceof GeminiApiError && err.retryable);
      if (!retryable || attempt >= RETRY_BACKOFF_MS.length - 1) break;

      const waitMs = RETRY_BACKOFF_MS[attempt];
      console.warn(JSON.stringify({
        requestId,
        event: "gemini_retry",
        index,
        model,
        attempt: attempt + 1,
        waitMs,
        status: err instanceof GeminiApiError ? err.status : "timeout",
        message: err?.message
      }));
      await sleep(waitMs);
    }
  }

  throw lastErr || new Error("Gemini call failed");
}

async function generateOneQuestion(prompt, requestId, index, timeoutMs, questionType, maxMarks, temperature = 0.4) {
  console.log(JSON.stringify({
    requestId,
    event: "gemini_call",
    index,
    model: GEMINI_MODEL,
    question_type: questionType,
    max_marks: maxMarks,
    timeoutMs,
    temperature
  }));
  return await callGemini(prompt, GEMINI_MODEL, timeoutMs, requestId, index, questionType, maxMarks, temperature);
}

function countScientificPoints(raw) {
  if (Array.isArray(raw)) {
    return raw.filter((p) => String(p || "").trim()).length;
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(/\r?\n|;/).map((s) => s.replace(/^\s*[-•*\d.)]+\s*/, "").trim()).filter(Boolean).length;
  }
  return 0;
}

function stampRecipeOntoQuestion(question, recipe) {
  const marks = recipeMaxMarks(recipe);
  const stamped = {
    ...question,
    question_type: recipe.question_type,
    demand_level: recipe.demand_level || question.demand_level,
    max_marks: marks
  };
  // 4-mark extended responses only use Levels 1–2; never keep a filled Level 3 band.
  if (recipe.question_type === "extended_response" && marks === 4) {
    stamped.level_3_descriptor = "N/A for 4-mark";
  }
  return stamped;
}

async function generateQuestionsForRecipes(payload, recipes, requestId, admin = null, userId = null) {
  const questions = [];
  const warnings = [];
  const startedAt = Date.now();
  const generatedByType = { mcq: [], short_text: [], extended_response: [] };
  const avoidByType = buildAvoidByType(payload.avoid_questions);
  const focusOffset = Number(payload.focus_offset) || 0;
  const recipeContexts = buildRecipeContexts(recipes);

  for (const ctx of recipeContexts) {
    const { batchIndex, recipe, sameTypeIndex, sameTypeTotal } = ctx;
    const i = batchIndex;
    const maxMarks = recipeMaxMarks(recipe);

    if (i > 0) await sleep(RECIPE_GAP_MS);

    const elapsed = Date.now() - startedAt;
    const remaining = FUNCTION_BUDGET_MS - elapsed;

    if (remaining < 12_000) {
      warnings.push(`Question ${i + 1} (${recipe.question_type} · ${recipe.demand_level}): skipped — not enough time remaining`);
      continue;
    }

    const timeoutMs = Math.min(GEMINI_CALL_TIMEOUT_MS, remaining - 2000);
    const avoidSameType = avoidByType[recipe.question_type] || [];
    const priorSameType = generatedByType[recipe.question_type] || [];
    const allPrior = [...avoidSameType, ...priorSameType];
    const temperature = (avoidSameType.length + sameTypeIndex) > 0 ? 0.62 : 0.4;

    console.log(JSON.stringify({
      requestId,
      event: "recipe_start",
      index: i + 1,
      total: recipes.length,
      question_type: recipe.question_type,
      demand_level: recipe.demand_level,
      max_marks: maxMarks,
      sameTypeIndex: sameTypeIndex + 1,
      sameTypeTotal,
      timeoutMs
    }));

    try {
      let question = null;
      let usedPrompt = "";
      let geminiMeta = null;
      const maxAttempts = recipe.question_type === "extended_response" ? 3 : 2;
      for (let diversityAttempt = 0; diversityAttempt < maxAttempts; diversityAttempt++) {
        const forcePoints = recipe.question_type === "extended_response"
          && diversityAttempt > 0
          && question
          && countScientificPoints(question.key_scientific_points) < 2;
        const prompt = buildSingleQuestionPrompt(payload, recipe, {
          batchIndex,
          sameTypeIndex,
          sameTypeTotal,
          priorSameType,
          avoidSameType,
          focusOffset,
          forceDistinct: diversityAttempt > 0 && !forcePoints
        }) + (forcePoints
          ? "\nCRITICAL RETRY: Your previous JSON left key_scientific_points empty. Fill key_scientific_points with 4–8 scientific checklist lines (newline-separated string) before any other rubric field."
          : "");
        usedPrompt = prompt;
        const geminiResult = await generateOneQuestion(
          prompt,
          requestId,
          i + 1,
          timeoutMs,
          recipe.question_type,
          maxMarks,
          diversityAttempt > 0 ? 0.72 : temperature
        );
        geminiMeta = geminiResult;
        question = stampRecipeOntoQuestion(geminiResult.parsed, recipe);

        const usage = geminiResult?.usage || null;
        if (usage && userId) {
          await recordAiUsageEvent(admin, {
            user_id: userId,
            feature: "generate_questions",
            model: GEMINI_MODEL,
            request_id: requestId,
            question_id: null,
            prompt_token_count: usage.promptTokenCount ?? null,
            candidates_token_count: usage.candidatesTokenCount ?? null,
            total_token_count: usage.totalTokenCount ?? null,
            finish_reason: geminiResult?.finishReason || null,
            usage_meta: usage,
            status: "success",
            meta: {
              recipe_index: i,
              diversity_attempt: diversityAttempt,
              question_type: recipe.question_type,
              demand_level: recipe.demand_level,
              max_marks: maxMarks
            }
          });
        }

        const pointsOk = recipe.question_type !== "extended_response"
          || countScientificPoints(question.key_scientific_points) >= 2;
        const distinctOk = !isNearDuplicateQuestion(question, allPrior);
        const qualityOk = passesQualityGate(question, recipe, allPrior);

        if (pointsOk && distinctOk && qualityOk) break;

        console.warn(JSON.stringify({
          requestId,
          event: !qualityOk ? "quality_gate_failed" : pointsOk ? "duplicate_detected" : "missing_scientific_points",
          index: i + 1,
          attempt: diversityAttempt + 1,
          pointCount: countScientificPoints(question.key_scientific_points),
          prompt: question.prompt?.slice(0, 80),
          finishReason: geminiMeta?.finishReason || null
        }));

        if (diversityAttempt === maxAttempts - 1) {
          if (!distinctOk) {
            warnings.push(`Question ${i + 1} (${recipe.question_type} · ${recipe.demand_level}): may be similar to another in this batch — please review`);
          }
          if (!qualityOk) {
            warnings.push(`Question ${i + 1} (${recipe.question_type} · ${recipe.demand_level}): failed quality gate — please review or regenerate`);
          }
          if (!pointsOk) {
            warnings.push(
              `Question ${i + 1} (extended_response · ${recipe.demand_level}): missing key_scientific_points — fill the local feedback checklist before commit`
            );
          }
        }
      }

      questions.push({
        ...question,
        _provenance: {
          source: "ai_studio",
          prompt: usedPrompt,
          raw_response: geminiMeta?.rawText || null,
          model: GEMINI_MODEL,
          request_id: requestId,
          usage: geminiMeta?.usage || null,
          finish_reason: geminiMeta?.finishReason || null,
          original_prompt: question?.prompt || null,
          input_meta: {
            question_type: recipe.question_type,
            demand_level: recipe.demand_level,
            max_marks: maxMarks,
            spec_ref: payload.spec_ref || null,
            subject: payload.subject || null,
            paper: payload.paper || null,
            tier: payload.tier || null,
            author_prompt: truncateAuthorPrompt(payload.author_prompt || ""),
            recipe_index: i
          }
        }
      });
      generatedByType[recipe.question_type] = [...priorSameType, question];
      console.log(JSON.stringify({
        requestId,
        event: "recipe_done",
        index: i + 1,
        total: recipes.length,
        pointCount: countScientificPoints(question?.key_scientific_points),
        elapsedMs: Date.now() - startedAt
      }));
    } catch (err) {
      warnings.push(formatRecipeWarning(i + 1, recipe, err));
      console.warn(JSON.stringify({
        requestId,
        event: "recipe_failed",
        index: i + 1,
        message: err?.message
      }));
    }
  }

  return { questions, warnings };
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log(JSON.stringify({
    requestId,
    event: "request_start",
    method: req.method,
    model: GEMINI_MODEL
  }));

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    });

    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: "Invalid session" }, 401);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (profile?.role !== "developer") {
      return jsonResponse({ error: "Developer role required" }, 403);
    }

    const payload = await req.json();
    const recipes = Array.isArray(payload?.recipes) ? payload.recipes : [];

    if (!payload?.spec_text?.trim()) {
      return jsonResponse({ error: "spec_text is required" }, 400);
    }
    if (!recipes.length) {
      return jsonResponse({ error: "At least one recipe is required" }, 400);
    }
    if (recipes.length > MAX_QUESTIONS) {
      return jsonResponse({ error: `Maximum ${MAX_QUESTIONS} questions per request` }, 400);
    }

    const { questions, warnings } = await generateQuestionsForRecipes(
      payload,
      recipes,
      requestId,
      admin,
      userData.user.id
    );

    console.log(JSON.stringify({
      requestId,
      event: "generation_done",
      questions: questions.length,
      expected: recipes.length,
      warnings: warnings.length
    }));

    if (!questions.length) {
      return jsonResponse({
        error: "Gemini is temporarily busy — please wait a moment and try again."
      }, 503);
    }

    if (questions.length !== recipes.length) {
      warnings.unshift(`Generated ${questions.length} of ${recipes.length} — re-run Generate to fill gaps, or reduce recipe count.`);
    }

    return jsonResponse({
      questions,
      warnings: warnings.length ? warnings : undefined,
      model: GEMINI_MODEL
    });
  } catch (err) {
    console.error(JSON.stringify({
      requestId,
      event: "error",
      message: err?.message || String(err)
    }));
    return jsonResponse({
      error: err?.message || "Generation failed"
    }, 500);
  }
});
