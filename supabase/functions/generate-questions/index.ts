import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const MAX_QUESTIONS = 12;
const GEMINI_CALL_TIMEOUT_MS = 50_000;
const FUNCTION_BUDGET_MS = 130_000;
const SPEC_TEXT_MAX_CHARS = 1200;
const RECIPE_GAP_MS = 600;
const RETRYABLE_STATUSES = new Set([429, 500, 503, 504]);
const RETRY_BACKOFF_MS = [1200, 2500, 5000, 8000, 12000];

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash-lite";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncateSpecText(text) {
  const raw = String(text || "").trim();
  if (raw.length <= SPEC_TEXT_MAX_CHARS) return raw;
  return `${raw.slice(0, SPEC_TEXT_MAX_CHARS)}… [truncated for generation]`;
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

function isNearDuplicateQuestion(candidate, priorSameType) {
  const prompt = normalizeForCompare(candidate.prompt);
  if (!prompt) return false;
  for (const prev of priorSameType) {
    const prevPrompt = normalizeForCompare(prev.prompt);
    if (!prevPrompt) continue;
    if (prompt === prevPrompt) return true;
    if (tokenOverlapRatio(prompt, prevPrompt) >= 0.72) return true;
    if (candidate.question_type !== "short_text" && prev.correct && candidate.correct) {
      if (normalizeForCompare(candidate.correct) === normalizeForCompare(prev.correct)) {
        return true;
      }
    }
  }
  return false;
}

function buildAvoidByType(avoidQuestions) {
  const out = { mcq: [], short_text: [] };
  for (const q of avoidQuestions || []) {
    const t = q?.question_type === "short_text" ? "short_text" : "mcq";
    out[t].push(q);
  }
  return out;
}

function buildSingleQuestionPrompt(payload, recipe, context = {}) {
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

const SHORT_TEXT_SCHEMA = {
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

function schemaForQuestionType(questionType) {
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
  const label = `Question ${index} (${recipe.question_type} · ${recipe.demand_level})`;
  const msg = err?.message || String(err);
  if (/503|high demand|UNAVAILABLE/i.test(msg)) {
    return `${label}: Gemini busy — auto-retried; click Generate again if still missing`;
  }
  if (isTimeoutError(err)) {
    return `${label}: timed out — try fewer recipes per batch`;
  }
  return `${label}: ${msg}`;
}

async function callGeminiOnce(prompt, model, timeoutMs, responseSchema, requestId, index, temperature = 0.4) {
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
  if (usage) {
    console.log(JSON.stringify({
      requestId,
      event: "gemini_usage",
      index,
      model,
      promptTokenCount: usage.promptTokenCount,
      candidatesTokenCount: usage.candidatesTokenCount,
      totalTokenCount: usage.totalTokenCount
    }));
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");
  return extractJson(text);
}

async function callGemini(prompt, model, timeoutMs, requestId, index, questionType, temperature = 0.4) {
  const responseSchema = schemaForQuestionType(questionType);
  let lastErr = null;

  for (let attempt = 0; attempt < RETRY_BACKOFF_MS.length; attempt++) {
    try {
      return await callGeminiOnce(prompt, model, timeoutMs, responseSchema, requestId, index, temperature);
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

async function generateOneQuestion(prompt, requestId, index, timeoutMs, questionType, temperature = 0.4) {
  console.log(JSON.stringify({
    requestId,
    event: "gemini_call",
    index,
    model: GEMINI_MODEL,
    question_type: questionType,
    timeoutMs,
    temperature
  }));
  return await callGemini(prompt, GEMINI_MODEL, timeoutMs, requestId, index, questionType, temperature);
}

async function generateQuestionsForRecipes(payload, recipes, requestId) {
  const questions = [];
  const warnings = [];
  const startedAt = Date.now();
  const generatedByType = { mcq: [], short_text: [] };
  const avoidByType = buildAvoidByType(payload.avoid_questions);
  const focusOffset = Number(payload.focus_offset) || 0;
  const recipeContexts = buildRecipeContexts(recipes);

  for (const ctx of recipeContexts) {
    const { batchIndex, recipe, sameTypeIndex, sameTypeTotal } = ctx;
    const i = batchIndex;

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
      sameTypeIndex: sameTypeIndex + 1,
      sameTypeTotal,
      timeoutMs
    }));

    try {
      let question = null;
      for (let diversityAttempt = 0; diversityAttempt < 2; diversityAttempt++) {
        const prompt = buildSingleQuestionPrompt(payload, recipe, {
          batchIndex,
          sameTypeIndex,
          sameTypeTotal,
          priorSameType,
          avoidSameType,
          focusOffset,
          forceDistinct: diversityAttempt > 0
        });
        question = await generateOneQuestion(
          prompt,
          requestId,
          i + 1,
          timeoutMs,
          recipe.question_type,
          diversityAttempt > 0 ? 0.72 : temperature
        );
        if (!isNearDuplicateQuestion(question, allPrior)) break;
        console.warn(JSON.stringify({
          requestId,
          event: "duplicate_detected",
          index: i + 1,
          attempt: diversityAttempt + 1,
          prompt: question.prompt?.slice(0, 80)
        }));
        if (diversityAttempt === 1) {
          warnings.push(`Question ${i + 1} (${recipe.question_type} · ${recipe.demand_level}): may be similar to another in this batch — please review`);
        }
      }

      questions.push(question);
      generatedByType[recipe.question_type] = [...priorSameType, question];
      console.log(JSON.stringify({
        requestId,
        event: "recipe_done",
        index: i + 1,
        total: recipes.length,
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

    const { questions, warnings } = await generateQuestionsForRecipes(payload, recipes, requestId);

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
