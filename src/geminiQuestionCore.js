/**
 * Shared Gemini question-generation prompts and schemas (Node + admin scripts).
 * Keep in sync with supabase/functions/generate-questions/index.ts
 */

export const SPEC_TEXT_MAX_CHARS = 1200;
export const DEFAULT_BATCH_TIER = "both";

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

export function truncateSpecText(text) {
  const raw = String(text || "").trim();
  if (raw.length <= SPEC_TEXT_MAX_CHARS) return raw;
  return `${raw.slice(0, SPEC_TEXT_MAX_CHARS)}… [truncated for generation]`;
}

export function buildRecipeContexts(recipes) {
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

export function summarizeQuestionKey(question) {
  if (question.question_type === "short_text") {
    const kws = (question.mark_points || [])
      .map((mp) => mp.keywords || mp.point_text)
      .filter(Boolean)
      .join("; ");
    return kws || "—";
  }
  return question.correct || "—";
}

export function buildSingleQuestionPrompt(payload, recipe, context = {}) {
  const { spec_ref, topic_name, spec_text, subject, paper, tier } = payload;
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

  const typeHint = recipe.question_type === "short_text"
    ? "short_text: exactly 2 mark_points (keywords + brief feedback), max_marks 2, ao1=1 ao2=1. Feedback max 12 words each."
    : "mcq: exactly 4 options, option_feedback for each wrong option only (3 entries), max_marks 1, ao1=1. Wrong-option feedback max 12 words each.";

  const angles = recipe.question_type === "short_text" ? SHORT_TEXT_FOCUS_ANGLES : MCQ_FOCUS_ANGLES;
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

  const varietyNote = sameTypeTotal > 1
    ? `\nThis is ${recipe.question_type} ${sameTypeIndex + 1} of ${sameTypeTotal} in the batch. It MUST test a different aspect of the spec than the others.\nFocus angle for this question: ${focusAngle}\n${avoidCommands}`
    : "";

  return `AQA GCSE Combined Science (8464) question author. Write ONE original exam-style question from the spec below. British English.
${distinctNote}${varietyNote}
Subject: ${subject} · Paper: ${paper} · Spec: ${spec_ref} · Topic: ${topic_name} · Tier: ${tier}
Batch item: ${batchIndex + 1} · Type: ${recipe.question_type} · demand_level: ${recipe.demand_level}
Spec text:
"""
${truncateSpecText(spec_text)}
"""
${avoidBlock}

Requirements: ${typeHint} · appropriate AQA command_word · genuinely distinct from any listed above.
Single-line prompt (no line breaks). Be concise — no preamble or explanation outside the JSON schema.`;
}

export const MCQ_SCHEMA = {
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

export const SHORT_TEXT_SCHEMA = {
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
      minItems: 2,
      maxItems: 2,
      items: {
        type: "OBJECT",
        properties: {
          ao: { type: "STRING", maxLength: 4 },
          keywords: { type: "STRING", maxLength: 120 },
          feedback: { type: "STRING", maxLength: 80 }
        },
        required: ["ao", "keywords", "feedback"]
      }
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

export function schemaForQuestionType(questionType) {
  return questionType === "short_text" ? SHORT_TEXT_SCHEMA : MCQ_SCHEMA;
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

export function extractJson(text) {
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

export function buildGeminiGenerateRequest(prompt, questionType, temperature = 0.4) {
  return {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      responseMimeType: "application/json",
      responseSchema: schemaForQuestionType(questionType),
      thinkingConfig: { thinkingBudget: 0 }
    }
  };
}

export function makeBatchRequestKey(parts) {
  return parts.map((p) => String(p).replace(/[|/\\]/g, "_")).join("|");
}

export function parseBatchRequestKey(key) {
  const [subject, paper, course_track, spec_ref, question_type, demand_level, slot] = key.split("|");
  return { subject, paper, course_track, spec_ref, question_type, demand_level, slot };
}
