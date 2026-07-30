import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Gemini often emits LaTeX like `\times` / `\frac` inside JSON strings with a
 * single backslash. JSON.parse then interprets `\t`/`\f`/`\b`/`\v` as control
 * characters (TAB + "imes", form-feed + "rac", …). Double those backslashes
 * when followed by a letter so parse preserves the LaTeX command.
 *
 * Intentionally skips `\n` / `\r` — real newlines/returns before letters are
 * common in multi-line answers; post-parse restore covers the control-char cases.
 */
function protectLatexEscapesInJson(raw: string): string {
  return String(raw || "").replace(/\\([bftv])(?=[A-Za-z])/g, "\\\\$1");
}

/**
 * Repairs strings whose LaTeX escapes were already collapsed into control
 * characters (e.g. TAB+"imes" → `\times`). Only control chars immediately
 * followed by a letter are restored.
 */
function restoreMangledLatexEscapes(text: string): string {
  if (!text || typeof text !== "string") return text;
  return text
    .replace(/\t(?=[a-zA-Z])/g, "\\t")
    .replace(/\f(?=[a-zA-Z])/g, "\\f")
    .replace(/\v(?=[a-zA-Z])/g, "\\v")
    .replace(/[\b](?=[a-zA-Z])/g, "\\b");
}

function sanitizeEvaluationLatex(value: unknown): unknown {
  if (typeof value === "string") return restoreMangledLatexEscapes(value);
  if (Array.isArray(value)) return value.map(sanitizeEvaluationLatex);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeEvaluationLatex(v);
    }
    return out;
  }
  return value;
}

function parseGeminiEvaluationJson(rawResultText: string) {
  const protectedRaw = protectLatexEscapesInJson(rawResultText);
  const parsed = JSON.parse(protectedRaw);
  return sanitizeEvaluationLatex(parsed);
}

/** Trial default: Flash-Lite (cheaper; thinking off by default). Override with GEMINI_MARK_MODEL. */
const GEMINI_MODEL = Deno.env.get("GEMINI_MARK_MODEL") || "gemini-2.5-flash-lite";
/** Bump when static system text or model/cache identity changes. */
const SYSTEM_PROMPT_VERSION = "v4-ao-delta";
/** Explicit cache TTL; refreshed when an existing cache is reused. */
const EXPLICIT_CACHE_TTL = "86400s";

/**
 * Flash-Lite: thinking is OFF unless thinkingBudget is set (>0 or -1 dynamic).
 * Flash (non-lite): thinking is ON by default (dynamic).
 * Leave unset so Lite stays cheap for this trial; set GEMINI_MARK_THINKING_BUDGET
 * (e.g. 1024) later if marking quality needs a reasoning boost.
 */
const MARK_THINKING_BUDGET_RAW = Deno.env.get("GEMINI_MARK_THINKING_BUDGET");
const MARK_THINKING_BUDGET = MARK_THINKING_BUDGET_RAW === undefined || MARK_THINKING_BUDGET_RAW === ""
  ? null
  : Number(MARK_THINKING_BUDGET_RAW);

type SciencePath = "combined" | "triple";

/** Shared fields for first marks and improvement resubmits. */
const EVALUATION_RESPONSE_PROPERTIES_BASE = {
  score_total: { type: "INTEGER" },
  score_max: { type: "INTEGER" },
  level_achieved: { type: "STRING" },
  ao_breakdown: {
    type: "OBJECT",
    properties: {
      AO1: { type: "INTEGER" },
      AO2: { type: "INTEGER" },
      AO3: { type: "INTEGER" }
    },
    required: ["AO1", "AO2", "AO3"]
  },
  analysis_highlights: {
    type: "ARRAY",
    items: { type: "STRING" }
  },
  missing_or_incorrect: {
    type: "ARRAY",
    items: { type: "STRING" }
  },
  actionable_improvement_advice: { type: "STRING" }
};

const EVALUATION_REQUIRED_BASE = [
  "score_total",
  "score_max",
  "level_achieved",
  "ao_breakdown",
  "analysis_highlights",
  "missing_or_incorrect",
  "actionable_improvement_advice"
];

/** First mark: include full-mark coaching rewrite. */
const EVALUATION_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    ...EVALUATION_RESPONSE_PROPERTIES_BASE,
    improved_answer: { type: "STRING" }
  },
  required: [...EVALUATION_REQUIRED_BASE, "improved_answer"]
};

/**
 * Improvement resubmit: omit improved_answer; add recognition of what improved.
 */
const EVALUATION_RESPONSE_SCHEMA_IMPROVEMENT = {
  type: "OBJECT",
  properties: {
    ...EVALUATION_RESPONSE_PROPERTIES_BASE,
    improvements_recognised: {
      type: "ARRAY",
      items: { type: "STRING" }
    }
  },
  required: [...EVALUATION_REQUIRED_BASE, "improvements_recognised"]
};

const MAX_OUTPUT_TOKENS_FIRST_MARK = 4096;
const MAX_OUTPUT_TOKENS_IMPROVEMENT = 2048;

/**
 * Shared static examiner reference (AQA only). Kept large and stable so:
 * 1) byte-identical prefixes enable Gemini 2.5+ implicit caching, and
 * 2) total cached tokens can clear the ~2048-token floor for explicit caches.
 * Question-specific bands, rubrics, and answers must NEVER go here.
 */
const SHARED_AQA_LOR_SYSTEM_CORE = `
You are an expert, strict, and fair senior examiner for AQA GCSE Science extended-response (Level of Response / LoR) questions.

BOARD SCOPE:
- Mark only against AQA criteria and language. Do not import Edexcel, OCR, or WJEC phrasing or grade boundaries.
- Use British English spelling and scientific terminology expected in AQA GCSE papers.
- Treat the user message as the sole source of the live question stem, official mark scheme, AO targets, band rules for that item, and the student answer.

ASSESSMENT PROTOCOL:
1. Read the question context, marking guidelines, level descriptors, and key scientific points in the user message carefully before awarding any marks.
2. Determine the Level of Response achieved from coherence, sequencing, logical linkage, and scientific accuracy — using only the descriptors and band caps supplied for that question.
3. Apply the misconception / fundamental-error cap exactly as stated in the user message for that question. Do not invent a harsher or softer rule.
4. Distribute the total score across Assessment Objectives (AO1, AO2, AO3) using the question's AO targets in the user message when provided. If AO targets are missing, infer from the cognitive nature of the student's statements, but still keep the AO sum correct.
5. The sum of (AO1 + AO2 + AO3) MUST EXACTLY equal score_total. score_max MUST equal the Maximum Marks given in the user message.
5a. HARD AO CAPS: Never award more than the AO target for that objective. If AO2 target is 0, AO2 MUST be 0. If AO3 target is 0, AO3 MUST be 0. Prefer putting remaining marks into AO objectives that have remaining capacity.
6. Prefer evidence from the student's actual wording. Do not award marks for ideas that are merely implied without scientific substance.
7. Do not invent mark-scheme content. If something is not in the provided guidelines, level descriptors, or key scientific points, do not treat it as required for full marks unless it is essential physics / chemistry / biology consistency already implied by those points.

AQA ASSESSMENT OBJECTIVES (STATIC REFERENCE):
- AO1 — Demonstrate knowledge and understanding of scientific ideas, techniques, and procedures (recall of facts, definitions, named apparatus, standard explanations).
- AO2 — Apply knowledge and understanding of scientific ideas, techniques, and procedures (use ideas in a familiar or unfamiliar context; interpret data or scenarios).
- AO3 — Analyse information and ideas to interpret, evaluate, make judgements, draw conclusions, and develop/improve experimental procedures (comparisons, justifications, evaluations, linked reasoning).
Award AO marks only for material the student actually demonstrated. Cap each AO so the triple sum equals score_total and does not exceed score_max.

LEVEL OF RESPONSE PHILOSOPHY (STATIC):
- LoR marking rewards a coherent, organised answer at a performance band, not atomised tick-every-keyword marking alone.
- Higher bands typically show linked scientific ideas in a sensible order, correct terminology, and an answer that addresses the whole demand of the command word.
- Mid bands show some relevant science with gaps, weak linkage, or incomplete coverage of the key scientific points.
- Low bands show isolated relevant points, limited structure, or heavily incomplete science.
- Irrelevant material does not raise the band. Contradictions and fundamental misconceptions drag the band down as directed by the question-specific cap.
- For 6-mark items, Level 3 is normally the top band (typically 5–6), Level 2 mid (3–4), Level 1 limited (1–2). For 4-mark items, Level 2 is normally the top/full-marks band and Level 3 is not used — but always follow the user-message band rules for the live item.

COMMAND-WORD DISCIPLINE (STATIC):
- Respect the command word supplied for the question (e.g. describe, explain, compare, evaluate, suggest, justify).
- "Describe" expects what happens / what is observed / what the features are, without requiring deep causal mechanism unless the mark scheme asks for it.
- "Explain" / "explain why" expects causal or mechanism-linked science.
- "Compare" needs similarities and/or differences as the mark scheme expects.
- "Evaluate" / "justify" needs a reasoned judgement using scientific evidence, not only a list of facts.
- Do not penalise a student for omitting material the supplied mark scheme does not require.

FEEDBACK QUALITY RULES:
- Provide objective, clear, and constructive feedback: what they successfully demonstrated, and what precise conceptual step was missing to reach the next mark level.
- Include spelling corrections when they misspelled key scientific terms.
- analysis_highlights: short, specific strengths grounded in the student's wording.
- missing_or_incorrect: short, specific gaps, errors, or misconceptions tied to the mark scheme.
- actionable_improvement_advice: concrete next steps a GCSE student can act on (structure, keywords, sequencing, AO focus). Avoid vague pep-talk.
- Tone: fair senior examiner — firm on standards, never mocking or condescending.

IMPROVED ANSWER RULES:
- Create improved_answer as a perfect full-mark rewrite of the student's response that acts as a direct coaching model.
- Preserve the student's original voice, tone, vocabulary, and sentence structure where possible.
- Correct scientific misconceptions, expand incomplete details, and inject missing AQA keywords so the rewrite would achieve the top band / full marks for the supplied scheme.
- Keep improved_answer as plain text (no markdown formatting or bold asterisks). Use standard spacing and LaTeX maths where needed.

LATEX AND JSON STRING RULES:
- Use LaTeX-style syntax for maths (enclosed in $ for inline, $$ for display) inside string fields where formulas help.
- CRITICAL: In every string field, write each LaTeX backslash as a double backslash so JSON preserves it. Examples: write \\\\times not \\times; write \\\\frac not \\frac; write \\\\text not \\text. Single-backslash LaTeX escapes are corrupted by JSON parsers.
- Structured JSON output is enforced by the API response schema. Do not wrap the answer in markdown fences or add conversational preamble.

WHAT NOT TO DO:
- Do not invent board rules outside AQA.
- Do not change score_max away from the Maximum Marks in the user message.
- Do not award marks above the top band allowed for that question.
- Do not refuse to mark ordinary school science content within AQA GCSE scope.
- Do not include explanations outside the JSON fields defined by the schema.

COMMON AQA LoR FAILURE MODES (STATIC COACHING REFERENCE):
- Listing isolated facts with no causal link when the command word is explain / explain why.
- Mixing force / energy / power language incorrectly, or confounding mass and weight.
- Describing what happens without using the key scientific points the mark scheme requires.
- Giving a correct conclusion with no supporting scientific reason when AO3 judgement is expected.
- Using everyday language where an AQA keyword is required by the key scientific points (e.g. "push" vs "force", "heat" vs "thermal energy" when the scheme expects the latter).
- Writing a strong paragraph that answers a different question from the stem.
- Over-long narrative that never hits the level descriptors' required coherence / sequencing.

MARKING WORKFLOW (STATIC):
1. Identify command word and the question's demand from the stem.
2. Scan the student answer for coverage of each key scientific point (present / partial / missing / contradicted).
3. Judge overall band from the level descriptors and any misconception cap in the user message.
4. Convert band into a numeric score within the allowed mark range for that band and question.
5. Split the numeric total across AO1 / AO2 / AO3 using the AO targets when given.
6. Write highlights, missing points, advice, and an improved full-mark model answer.

SCORING INTEGRITY CHECKS BEFORE YOU FINISH:
- score_total is an integer between 0 and score_max inclusive.
- score_max equals Maximum Marks from the user message.
- level_achieved matches the band rules for this question (e.g. do not claim Level 3 on a 4-mark item if Level 3 is N/A).
- AO1 + AO2 + AO3 = score_total exactly, with no negative AO values.
- Feedback arrays and advice are specific to this student answer, not generic boilerplate alone.
- improved_answer would itself achieve full marks against the supplied scheme.
`.trim();

const COMBINED_SCIENCE_SYSTEM_PREAMBLE = `
COURSE PATHWAY — AQA GCSE Combined Science: Trilogy (8464):
- You are marking an extended response for a Combined Science (Trilogy) student following AQA 8464.
- Expect breadth across biology, chemistry, and physics at Combined Science depth. Do not demand Triple-only (8461 / 8462 / 8463) extension content unless it appears explicitly in this question's mark scheme.
- Keep explanations at Combined Science GCSE demand: clear, accurate, and complete for Trilogy, without requiring A-level detail or Triple-only mechanisms.
- When the student uses correct Combined Science language that matches the supplied mark scheme, award credit even if a Triple mark scheme elsewhere might expect more.
`.trim();

const TRIPLE_SCIENCE_SYSTEM_PREAMBLE = `
COURSE PATHWAY — AQA GCSE Separate Sciences / Triple Science (Biology 8461, Chemistry 8462, Physics 8463):
- You are marking an extended response for a Triple Science student on the relevant separate-science specification.
- Apply the supplied mark scheme at Triple / separate-science depth: allow fuller linkage, precise terminology, and any Triple-only ideas that the mark scheme itself requires.
- Do not water the mark scheme down to Combined Science (8464) Trilogy expectations when the supplied descriptors and key scientific points demand separate-science detail.
- Still stay within GCSE (not A-level) demand unless the mark scheme explicitly requires a more advanced statement.
`.trim();

function normalizeSciencePath(raw: unknown): SciencePath {
  return raw === "triple" ? "triple" : "combined";
}

function buildSystemInstruction(sciencePath: SciencePath): string {
  const preamble = sciencePath === "triple"
    ? TRIPLE_SCIENCE_SYSTEM_PREAMBLE
    : COMBINED_SCIENCE_SYSTEM_PREAMBLE;
  return `${preamble}\n\n${SHARED_AQA_LOR_SYSTEM_CORE}`;
}

function cacheDisplayName(sciencePath: SciencePath): string {
  // Include model so Flash vs Flash-Lite caches never collide.
  const modelTag = GEMINI_MODEL.replace(/^gemini-/, "").replace(/[^a-z0-9-]+/gi, "-");
  return `aqa-mark-${SYSTEM_PROMPT_VERSION}-${modelTag}-${sciencePath}`;
}

/**
 * Extra stable prefix stored in cachedContents.contents (in addition to
 * systemInstruction) so explicit caches reliably clear Gemini 2.5 Flash's
 * ~2048-token minimum. Must stay byte-identical for a given SYSTEM_PROMPT_VERSION.
 */
const STATIC_CACHE_PREFIX_CONTENT = `
STATIC AQA EXAMINER BRIEFING (cached prefix — do not treat as a live student answer):
Apply the system instruction for every subsequent marking request in this conversation.
Live question stem, mark scheme, band caps, AO targets, and the student answer arrive only in later user messages.

Reminder checklist for every mark:
1. Board = AQA only (Combined Science Trilogy 8464 or Triple / separate sciences 8461–8463 as stated in the system pathway).
2. Use only the supplied mark scheme for required science points; do not invent extra hurdles.
3. Apply the misconception / band cap written in the user message for that question.
4. AO1 + AO2 + AO3 must equal score_total; score_max must equal Maximum Marks.
5. Feedback must be specific, constructive, and GCSE-appropriate; include key-term spelling fixes when needed.
6. improved_answer is a full-mark coaching rewrite that preserves the student's voice where possible.
7. Escape every LaTeX backslash as a double backslash inside JSON string values.
8. Return only fields required by the response schema — no markdown fences, no preamble.

Quality bar for analysis_highlights:
- Cite what the student actually wrote when praising a point.
- Prefer scientific accuracy and structure comments over vague encouragement.

Quality bar for missing_or_incorrect:
- Name the missing idea in mark-scheme language.
- If a misconception is present, state the incorrect idea and the correction briefly.

Quality bar for actionable_improvement_advice:
- Give 2–4 concrete actions (reorder ideas, add a named keyword, complete a force pair, link cause to effect).
- Align advice to the next band up from the level achieved.

This cached briefing is intentionally static. Ignore any temptation to mark content from this briefing itself.
`.trim();

function markSchemeBandBlock(maxMarks: number): string {
  if (maxMarks >= 6) {
    return [
      `- Top available band: Level 3`,
      `- Typical bands for this ${maxMarks}-mark item: Level 3 = 5–6 marks, Level 2 = 3–4 marks, Level 1 = 1–2 marks`,
      `- Fundamental misconception cap: Level 2 (max 4 marks)`
    ].join("\n");
  }
  return [
    `- Top available band: Level 2 (full marks for this ${maxMarks}-mark item)`,
    `- Typical bands: Level 2 = 3–4 marks (complete coherent answer), Level 1 = 1–2 marks; Level 3 is N/A`,
    `- Fundamental misconception cap: Level 1 (max 2 marks)`
  ].join("\n");
}

function buildUserQuery(params: {
  promptText: string;
  maxMarks: number;
  commandWord: string | null;
  ao1: number | null;
  ao2: number | null;
  ao3: number | null;
  guidelines: string;
  levels: string;
  pointsList: string;
  studentText: string;
  sciencePath: SciencePath;
  isImprovement: boolean;
  priorSummary: string | null;
}): string {
  const ao1 = params.ao1 ?? 0;
  const ao2 = params.ao2 ?? 0;
  const ao3 = params.ao3 ?? 0;
  const aoLine = `- AO targets for a full-mark answer: AO1=${ao1}, AO2=${ao2}, AO3=${ao3}`
    + `\n- HARD CAPS: AO1 ≤ ${ao1}, AO2 ≤ ${ao2}, AO3 ≤ ${ao3}. Do not invent AO marks for objectives with target 0.`
    + `\n- AO1+AO2+AO3 must equal score_total exactly.`;

  const pathwayLabel = params.sciencePath === "triple"
    ? "AQA Triple / separate science"
    : "AQA Combined Science: Trilogy (8464)";

  const taskBlock = params.isImprovement
    ? `IMPROVEMENT RESUBMIT:
- Mark this revised student answer against the mark scheme.
- Do NOT write an improved_answer / model rewrite.
- improvements_recognised: ONLY credit wording that appears in "NEW TEXT ADDED" below (or clearly absent from the previous student answer). Never credit sentences that were already in the previous answer. If NEW TEXT ADDED is empty, return []. Max 3 short bullets.
- Keep analysis_highlights for strengths in the NEW answer; missing_or_incorrect for what is still wrong/missing.
- actionable_improvement_advice: if score_total equals Maximum Marks, congratulate full marks and do NOT ask for extra wording to "secure full marks". Otherwise give 1–2 concrete next steps and mention score change vs previous when useful.`
    : `Mark this answer using only the mark scheme above and the system examiner rules. Include a full-mark improved_answer coaching rewrite.
- If score_total equals Maximum Marks, actionable_improvement_advice must congratulate full marks and must not list required additions.`;

  const priorBlock = params.priorSummary
    ? `\nPRIOR ATTEMPT (for improvement recognition only — mark the NEW answer on its own merits):\n${params.priorSummary}\n`
    : "";

  return `
QUESTION CONTEXT:
- Exam pathway: ${pathwayLabel}
- Prompt: ${JSON.stringify(params.promptText)}
- Command word: ${params.commandWord || "not specified"}
- Maximum Marks: ${params.maxMarks}
${aoLine}

MARK SCHEME FOR THIS QUESTION:
${markSchemeBandBlock(params.maxMarks)}
- Core Marking Guidelines: ${params.guidelines}
- Levels Descriptors Grid: ${params.levels}
- Target Scientific Points expected: ${params.pointsList}
${priorBlock}
STUDENT RESPONSE TO EVALUATE:
${JSON.stringify(params.studentText)}

${taskBlock}
`.trim();
}

/**
 * Clamp AO awards to question targets and force AO1+AO2+AO3 === score_total.
 */
function normalizeAoBreakdown(
  evaluation: Record<string, unknown>,
  aoTargets: { AO1: number; AO2: number; AO3: number },
  scoreTotal: number
) {
  const raw = (evaluation.ao_breakdown && typeof evaluation.ao_breakdown === "object")
    ? evaluation.ao_breakdown as Record<string, unknown>
    : {};

  let ao1 = Math.max(0, Math.min(Number(raw.AO1) || 0, aoTargets.AO1));
  let ao2 = Math.max(0, Math.min(Number(raw.AO2) || 0, aoTargets.AO2));
  let ao3 = Math.max(0, Math.min(Number(raw.AO3) || 0, aoTargets.AO3));

  const targetTotal = Math.max(0, Number(scoreTotal) || 0);
  let sum = ao1 + ao2 + ao3;

  // Trim overflow if model still overshot after per-AO caps somehow, or sum > score.
  while (sum > targetTotal) {
    if (ao1 > 0) { ao1 -= 1; sum -= 1; continue; }
    if (ao2 > 0) { ao2 -= 1; sum -= 1; continue; }
    if (ao3 > 0) { ao3 -= 1; sum -= 1; continue; }
    break;
  }

  // Top up into capped capacity, preferring AO1 then AO2 then AO3.
  let remaining = targetTotal - sum;
  const add = (key: "ao1" | "ao2" | "ao3", cap: number) => {
    if (remaining <= 0) return;
    if (key === "ao1") {
      const room = cap - ao1;
      const addN = Math.min(room, remaining);
      ao1 += addN;
      remaining -= addN;
    } else if (key === "ao2") {
      const room = cap - ao2;
      const addN = Math.min(room, remaining);
      ao2 += addN;
      remaining -= addN;
    } else {
      const room = cap - ao3;
      const addN = Math.min(room, remaining);
      ao3 += addN;
      remaining -= addN;
    }
  };
  add("ao1", aoTargets.AO1);
  add("ao2", aoTargets.AO2);
  add("ao3", aoTargets.AO3);

  // If targets cannot absorb score_total (misconfigured question), dump remainder into AO1 display-wise
  // without exceeding score_total integrity for the sum field used in attempts.
  if (remaining > 0) {
    ao1 += remaining;
    remaining = 0;
  }

  evaluation.ao_breakdown = { AO1: ao1, AO2: ao2, AO3: ao3 };
  evaluation.ao_targets = aoTargets;
  return evaluation;
}

function normalizeCompareText(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split answer into sentence-like chunks for diffing prior vs improved text.
 */
function splitAnswerChunks(text: string): string[] {
  return String(text || "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 8);
}

/**
 * Fragments present in current but not already contained in previous (normalized).
 */
function extractAddedFragments(previous: string, current: string): string[] {
  const prevNorm = normalizeCompareText(previous);
  const chunks = splitAnswerChunks(current);
  const added: string[] = [];

  for (const chunk of chunks) {
    const n = normalizeCompareText(chunk);
    if (n.length < 8) continue;
    if (!prevNorm.includes(n)) added.push(chunk.replace(/\s+/g, " ").trim());
  }

  // Short append without sentence punctuation (e.g. one added clause).
  if (added.length === 0) {
    const curNorm = normalizeCompareText(current);
    if (curNorm.length > prevNorm.length + 10 && curNorm.includes(prevNorm)) {
      // Approximate remainder after removing prior blob once.
      const idx = curNorm.indexOf(prevNorm);
      const remNorm = (curNorm.slice(0, idx) + curNorm.slice(idx + prevNorm.length)).trim();
      if (remNorm.length >= 8) {
        // Recover rough original casing from current by taking a trailing/leading window.
        const loose = String(current).replace(/\s+/g, " ").trim();
        const prevLoose = String(previous).replace(/\s+/g, " ").trim();
        if (loose.toLowerCase().includes(prevLoose.toLowerCase())) {
          const remainder = loose.replace(new RegExp(prevLoose.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), "").trim();
          if (remainder.length >= 8) added.push(remainder);
        } else {
          added.push(remNorm);
        }
      }
    }
  }

  return [...new Set(added)].slice(0, 6);
}

/**
 * Keep only recognition bullets that credit genuinely new text.
 */
function refineImprovementsRecognised(
  modelBullets: unknown,
  previousText: string,
  addedFragments: string[]
): string[] {
  const prevNorm = normalizeCompareText(previousText);
  const raw = Array.isArray(modelBullets)
    ? modelBullets.map((x) => String(x)).filter(Boolean)
    : [];

  const filtered = raw.filter((bullet) => {
    const quotes = [...bullet.matchAll(/['"“”]([^'"“”]{6,})['"“”]/g)].map((m) => m[1]);
    if (quotes.length > 0) {
      // Drop if every quoted phrase was already in the previous answer.
      const allOld = quotes.every((q) => prevNorm.includes(normalizeCompareText(q)));
      if (allOld) return false;
      return true;
    }
    // Unquoted: keep only if it clearly refers to an added fragment.
    const bNorm = normalizeCompareText(bullet);
    return addedFragments.some((a) => {
      const aNorm = normalizeCompareText(a);
      return bNorm.includes(aNorm.slice(0, Math.min(40, aNorm.length))) || aNorm.includes(bNorm.slice(0, 40));
    });
  }).slice(0, 3);

  if (filtered.length > 0) return filtered;
  if (addedFragments.length > 0) {
    return addedFragments.slice(0, 3).map((a) => `Added: "${a.replace(/\.$/, "")}".`);
  }
  return [];
}

function compactPriorAttemptSummary(
  prior: Record<string, unknown> | null,
  newStudentText: string
): string | null {
  if (!prior) return null;
  const fb = (prior.feedback_payload && typeof prior.feedback_payload === "object")
    ? prior.feedback_payload as Record<string, unknown>
    : {};
  const missing = Array.isArray(fb.missing_or_incorrect)
    ? fb.missing_or_incorrect.map((x) => String(x)).filter(Boolean).slice(0, 5)
    : [];
  const advice = typeof fb.actionable_improvement_advice === "string"
    ? fb.actionable_improvement_advice.slice(0, 280)
    : "";
  const prevText = (prior.response_payload && typeof prior.response_payload === "object")
    ? String((prior.response_payload as Record<string, unknown>).text || "")
    : "";
  const addedFragments = extractAddedFragments(prevText, newStudentText);

  return [
    `- Previous score: ${prior.score_total ?? "?"}/${prior.score_max ?? "?"}`,
    `- Previous AO: AO1=${prior.ao1_score ?? 0}, AO2=${prior.ao2_score ?? 0}, AO3=${prior.ao3_score ?? 0}`,
    missing.length ? `- Previously missing/incorrect: ${JSON.stringify(missing)}` : `- Previously missing/incorrect: (none listed)`,
    advice ? `- Previous coach advice: ${JSON.stringify(advice)}` : null,
    `- Previous student answer: ${JSON.stringify(prevText.slice(0, 1200))}`,
    `- NEW TEXT ADDED (server diff — only these are eligible for improvements_recognised): ${JSON.stringify(addedFragments)}`
  ].filter(Boolean).join("\n");
}

async function recordAiUsageEvent(supabase: ReturnType<typeof createClient>, row: Record<string, unknown>) {
  try {
    const { error } = await supabase.from("ai_usage_events").insert(row);
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

function geminiHeaders() {
  return { "Content-Type": "application/json" };
}

function isCacheStillValid(expireTime: string | undefined): boolean {
  if (!expireTime) return false;
  const expiresAt = Date.parse(expireTime);
  if (Number.isNaN(expiresAt)) return false;
  // Treat as expired slightly early so generateContent does not race expiry.
  return expiresAt - Date.now() > 60_000;
}

async function listCachedContents(apiKey: string): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  let pageToken: string | null = null;
  for (let page = 0; page < 5; page++) {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/cachedContents");
    url.searchParams.set("key", apiKey);
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), { method: "GET", headers: geminiHeaders() });
    if (!res.ok) {
      const body = await res.text();
      console.warn(JSON.stringify({
        event: "gemini_cache_list_failed",
        status: res.status,
        body: body.slice(0, 400)
      }));
      break;
    }
    const data = await res.json();
    const batch = Array.isArray(data?.cachedContents) ? data.cachedContents : [];
    out.push(...batch);
    pageToken = data?.nextPageToken || null;
    if (!pageToken) break;
  }
  return out;
}

async function createExplicitCache(
  apiKey: string,
  sciencePath: SciencePath,
  systemInstruction: string
): Promise<{ name: string; usageMetadata?: Record<string, unknown> } | null> {
  const displayName = cacheDisplayName(sciencePath);
  const url = `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${apiKey}`;
  const payload = {
    model: `models/${GEMINI_MODEL}`,
    displayName,
    ttl: EXPLICIT_CACHE_TTL,
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    // Stable cached prefix content (helps clear the explicit-cache token floor).
    contents: [{
      role: "user",
      parts: [{ text: STATIC_CACHE_PREFIX_CONTENT }]
    }]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: geminiHeaders(),
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const body = await res.text();
    console.warn(JSON.stringify({
      event: "gemini_cache_create_failed",
      sciencePath,
      displayName,
      status: res.status,
      body: body.slice(0, 600)
    }));
    return null;
  }

  const data = await res.json();
  if (!data?.name) return null;
  console.log(JSON.stringify({
    event: "gemini_cache_created",
    sciencePath,
    displayName,
    name: data.name,
    totalTokenCount: data?.usageMetadata?.totalTokenCount ?? null
  }));
  return { name: data.name, usageMetadata: data.usageMetadata || undefined };
}

async function refreshCacheTtl(apiKey: string, cacheName: string): Promise<boolean> {
  const url = `https://generativelanguage.googleapis.com/v1beta/${cacheName}?key=${apiKey}&updateMask=ttl`;
  try {
    const res = await fetch(url, {
      method: "PATCH",
      headers: geminiHeaders(),
      body: JSON.stringify({ ttl: EXPLICIT_CACHE_TTL })
    });
    if (!res.ok) {
      const body = await res.text();
      console.warn(JSON.stringify({
        event: "gemini_cache_ttl_refresh_failed",
        cacheName,
        status: res.status,
        body: body.slice(0, 300)
      }));
      return false;
    }
    return true;
  } catch (err) {
    console.warn(JSON.stringify({
      event: "gemini_cache_ttl_refresh_failed",
      cacheName,
      message: err?.message || String(err)
    }));
    return false;
  }
}

/**
 * Prefer an existing non-expired explicit cache for this pathway/version,
 * otherwise try to create one. Returns null when explicit caching is unavailable
 * (e.g. under the model's minimum token floor) so callers fall back to
 * generateContent with an inline systemInstruction (implicit caching still helps).
 */
async function getOrCreateExplicitCache(
  apiKey: string,
  sciencePath: SciencePath,
  systemInstruction: string
): Promise<{ name: string; mode: "reuse" | "create" } | null> {
  const displayName = cacheDisplayName(sciencePath);

  const pickFromList = async (): Promise<{ name: string; mode: "reuse" } | null> => {
    const listed = await listCachedContents(apiKey);
    const valid = listed.find((c) =>
      c?.displayName === displayName
      && typeof c?.name === "string"
      && isCacheStillValid(String(c.expireTime || ""))
    );
    if (valid?.name) {
      const name = String(valid.name);
      // Fire-and-forget TTL refresh; do not block marking on patch latency.
      refreshCacheTtl(apiKey, name);
      console.log(JSON.stringify({
        event: "gemini_cache_reuse",
        sciencePath,
        displayName,
        name
      }));
      return { name, mode: "reuse" };
    }

    const stale = listed.find((c) =>
      c?.displayName === displayName && typeof c?.name === "string"
    );
    if (stale?.name) {
      const name = String(stale.name);
      const renewed = await refreshCacheTtl(apiKey, name);
      if (renewed) {
        console.log(JSON.stringify({
          event: "gemini_cache_renewed",
          sciencePath,
          displayName,
          name
        }));
        return { name, mode: "reuse" };
      }
    }
    return null;
  };

  try {
    const existing = await pickFromList();
    if (existing) return existing;
  } catch (err) {
    console.warn(JSON.stringify({
      event: "gemini_cache_lookup_failed",
      sciencePath,
      message: err?.message || String(err)
    }));
  }

  const created = await createExplicitCache(apiKey, sciencePath, systemInstruction);
  if (created?.name) return { name: created.name, mode: "create" };

  // Concurrent create race or transient API error — one more list pass.
  try {
    const raced = await pickFromList();
    if (raced) return raced;
  } catch {
    // ignore
  }
  return null;
}

async function generateWithGemini(
  apiKey: string,
  userQuery: string,
  systemInstruction: string,
  cachedContentName: string | null,
  isImprovement: boolean
): Promise<Response> {
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    responseSchema: isImprovement
      ? EVALUATION_RESPONSE_SCHEMA_IMPROVEMENT
      : EVALUATION_RESPONSE_SCHEMA,
    maxOutputTokens: isImprovement
      ? MAX_OUTPUT_TOKENS_IMPROVEMENT
      : MAX_OUTPUT_TOKENS_FIRST_MARK
  };

  // Only attach when explicitly configured. On Flash-Lite, omitting this keeps
  // thinking off (default). On Flash, omitting would leave dynamic thinking on.
  if (MARK_THINKING_BUDGET != null && Number.isFinite(MARK_THINKING_BUDGET)) {
    generationConfig.thinkingConfig = {
      thinkingBudget: MARK_THINKING_BUDGET
    };
  }

  const payload: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: userQuery }] }],
    generationConfig
  };

  if (cachedContentName) {
    payload.cachedContent = cachedContentName;
  } else {
    payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  return fetch(geminiUrl, {
    method: "POST",
    headers: geminiHeaders(),
    body: JSON.stringify(payload)
  });
}

serve(async (req) => {
  // Handle CORS preflight handshakes cleanly
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    console.log(JSON.stringify({ requestId, event: "mark_start" }));

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? '';

    // Step 1: Check server-side environmental credentials
    console.log("Step 1: Checking environment configurations...");
    if (!supabaseUrl) {
      throw new Error("Missing environmental secret: SUPABASE_URL is not set.");
    }
    if (!supabaseServiceKey) {
      throw new Error("Missing environmental secret: SUPABASE_SERVICE_ROLE_KEY is not set.");
    }
    if (!geminiApiKey) {
      throw new Error("Missing environmental secret: GEMINI_API_KEY is not set. Please add this inside your Supabase Secrets panel.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Resolve the authenticated student so token usage can be attributed per user.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const userId = userData.user.id;

    // Step 2: Parse incoming request parameters safely
    console.log("Step 2: Parsing request payload...");
    const { question_id, student_text, is_improvement } = await req.json();
    const isImprovement = is_improvement === true;

    if (!question_id) {
      console.warn("Validation Warning: Received request with missing question_id parameter.");
      return new Response(JSON.stringify({ error: "Missing required parameter: question_id is undefined or null." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (student_text === undefined || student_text === null || student_text.trim() === "") {
      console.warn("Validation Warning: Received empty or whitespace-only student text.");
      return new Response(JSON.stringify({ error: "Missing required parameter: student_text is blank or contains only whitespace." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Profile pathway (Combined vs Triple) drives the stable system instruction variant.
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("science_path")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileErr) {
      console.warn(JSON.stringify({
        requestId,
        event: "profile_lookup_failed",
        message: profileErr.message
      }));
    }
    const sciencePath = normalizeSciencePath(profile?.science_path);

    console.log(JSON.stringify({
      requestId,
      event: "payload_valid",
      userId,
      question_id,
      sciencePath,
      isImprovement,
      studentTextLength: student_text.length
    }));

    // Step 3: Fetch Question specifications from database
    console.log(`Step 3: Querying 'questions' table for ID: ${question_id}...`);
    const { data: q, error: qErr } = await supabase
      .from('questions')
      .select('prompt, max_marks, command_word, ao1_marks, ao2_marks, ao3_marks')
      .eq('id', question_id)
      .single();

    if (qErr) {
      console.error(`Database Error querying 'questions' table:`, qErr);
      throw new Error(`Failed to find question in database: ${qErr.message}`);
    }
    if (!q) {
      throw new Error(`Question with ID ${question_id} returned null from database query.`);
    }

    console.log(`Successfully fetched question details. Prompt: "${q.prompt.substring(0, 60)}..." | Max Marks: ${q.max_marks}`);

    // Step 4: Fetch AQA Levels criteria from 'answer_keys' table
    console.log(`Step 4: Querying 'answer_keys' table for Question ID: ${question_id}...`);
    const { data: key, error: keyErr } = await supabase
      .from('answer_keys')
      .select('key_payload')
      .eq('question_id', question_id)
      .single();

    if (keyErr) {
      console.error(`Database Error querying 'answer_keys' table:`, keyErr);
      throw new Error(`Failed to find marking rubric key inside answer_keys table: ${keyErr.message}`);
    }
    if (!key || !key.key_payload) {
      throw new Error(`Marking key guidelines are missing or empty for Question ID: ${question_id}`);
    }

    const promptText = q.prompt;
    const maxMarks = q.max_marks || 6;
    const guidelines = key.key_payload.marking_guidelines
      || (sciencePath === "triple"
        ? "Apply standard AQA GCSE Triple / separate-science assessment rules for this subject."
        : "Apply standard AQA GCSE Combined Science: Trilogy (8464) assessment rules.");
    const levels = JSON.stringify(key.key_payload.level_descriptors || {});
    const pointsList = JSON.stringify(key.key_payload.key_scientific_points || []);

    const aoTargets = {
      AO1: Math.max(0, Number(q.ao1_marks) || 0),
      AO2: Math.max(0, Number(q.ao2_marks) || 0),
      AO3: Math.max(0, Number(q.ao3_marks) || 0)
    };

    // Improvement path: load latest prior attempt so Gemini can recognise what changed.
    let priorSummary: string | null = null;
    let priorStudentText = "";
    let addedFragments: string[] = [];
    if (isImprovement) {
      const { data: priorRows, error: priorErr } = await supabase
        .from("attempts")
        .select("score_total, score_max, ao1_score, ao2_score, ao3_score, feedback_payload, response_payload, submitted_at")
        .eq("user_id", userId)
        .eq("question_id", question_id)
        .order("submitted_at", { ascending: false })
        .limit(1);

      if (priorErr) {
        console.warn(JSON.stringify({
          requestId,
          event: "prior_attempt_lookup_failed",
          message: priorErr.message
        }));
      } else if (Array.isArray(priorRows) && priorRows.length) {
        const prior = priorRows[0] as Record<string, unknown>;
        const rp = (prior.response_payload && typeof prior.response_payload === "object")
          ? prior.response_payload as Record<string, unknown>
          : {};
        priorStudentText = String(rp.text || "");
        addedFragments = extractAddedFragments(priorStudentText, student_text);
        priorSummary = compactPriorAttemptSummary(prior, student_text);
      }
    }

    const systemInstruction = buildSystemInstruction(sciencePath);
    const userQuery = buildUserQuery({
      promptText,
      maxMarks,
      commandWord: q.command_word ?? null,
      ao1: aoTargets.AO1,
      ao2: aoTargets.AO2,
      ao3: aoTargets.AO3,
      guidelines,
      levels,
      pointsList,
      studentText: student_text,
      sciencePath,
      isImprovement,
      priorSummary
    });

    console.log(JSON.stringify({
      requestId,
      event: "prompt_built",
      sciencePath,
      isImprovement,
      model: GEMINI_MODEL,
      thinkingBudget: MARK_THINKING_BUDGET,
      systemChars: systemInstruction.length,
      userChars: userQuery.length,
      systemPromptVersion: SYSTEM_PROMPT_VERSION
    }));

    // Step 5: Explicit cache when possible; otherwise identical inline systemInstruction
    // so Gemini 2.5+ implicit prefix caching can still apply across requests.
    let cacheMode: "explicit_reuse" | "explicit_create" | "implicit_fallback" = "implicit_fallback";
    let cachedContentName: string | null = null;
    const cacheRef = await getOrCreateExplicitCache(geminiApiKey, sciencePath, systemInstruction);
    if (cacheRef?.name) {
      cachedContentName = cacheRef.name;
      cacheMode = cacheRef.mode === "reuse" ? "explicit_reuse" : "explicit_create";
    } else {
      console.log(JSON.stringify({
        requestId,
        event: "gemini_cache_fallback_inline_system",
        sciencePath,
        reason: "explicit_cache_unavailable"
      }));
    }

    console.log("Step 5: Handshaking with Google Gemini API...");

    // Robust Exponential Backoff Retry Strategy for handling Gemini 503 Spikes
    let response: Response | undefined;
    const maxRetries = 3;
    let backoffDelay = 1000;
    let usedCachedContent = cachedContentName;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      response = await generateWithGemini(
        geminiApiKey,
        userQuery,
        systemInstruction,
        usedCachedContent,
        isImprovement
      );

      // If the explicit cache vanished mid-flight, drop it and retry inline once.
      if (
        usedCachedContent
        && (response.status === 400 || response.status === 404)
        && attempt < maxRetries
      ) {
        const errPreview = await response.clone().text();
        if (/cachedContent|CachedContent|not found|expired/i.test(errPreview)) {
          console.warn(JSON.stringify({
            requestId,
            event: "gemini_cache_stale_retry_inline",
            status: response.status,
            body: errPreview.slice(0, 300)
          }));
          usedCachedContent = null;
          cacheMode = "implicit_fallback";
          continue;
        }
      }

      if (response.status === 503 && attempt < maxRetries) {
        console.warn(`Gemini API experiencing high demand (HTTP 503). Retrying attempt ${attempt} of ${maxRetries} in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        backoffDelay *= 2;
      } else {
        break;
      }
    }

    if (!response || !response.ok) {
      const errorText = response ? await response.text() : "No response from Gemini";
      console.error(`Gemini API connection error (HTTP ${response?.status}):`, errorText);
      throw new Error(`Gemini API handshake failed: ${response?.status} - ${errorText}`);
    }

    // Step 6: Parse AI Examiner Output (protect LaTeX escapes before JSON.parse)
    console.log("Step 6: Parsing raw response packet returned by Gemini...");
    const geminiData = await response.json();
    const usage = geminiData?.usageMetadata || null;
    const finishReason = geminiData?.candidates?.[0]?.finishReason || null;
    if (usage) {
      console.log(JSON.stringify({
        requestId,
        event: "gemini_usage",
        feature: "mark_long_answer",
        userId,
        model: GEMINI_MODEL,
        question_id,
        sciencePath,
        isImprovement,
        cacheMode,
        promptTokenCount: usage.promptTokenCount,
        cachedContentTokenCount: usage.cachedContentTokenCount ?? null,
        candidatesTokenCount: usage.candidatesTokenCount,
        totalTokenCount: usage.totalTokenCount,
        finishReason
      }));
    }

    const rawResultText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawResultText) {
      await recordAiUsageEvent(supabase, {
        user_id: userId,
        feature: "mark_long_answer",
        model: GEMINI_MODEL,
        request_id: requestId,
        question_id,
        prompt_token_count: usage?.promptTokenCount ?? null,
        candidates_token_count: usage?.candidatesTokenCount ?? null,
        total_token_count: usage?.totalTokenCount ?? null,
        finish_reason: finishReason,
        usage_meta: usage,
        status: "error",
        meta: {
          error: "empty_candidate",
          science_path: sciencePath,
          is_improvement: isImprovement,
          cache_mode: cacheMode,
          system_prompt_version: SYSTEM_PROMPT_VERSION
        }
      });
      throw new Error("Empty candidate evaluation packet returned from Gemini engine.");
    }

    const parsedEvaluation = parseGeminiEvaluationJson(rawResultText) as Record<string, unknown>;

    // Enforce mark ceiling and AO target caps (UI previously invented fake AO denominators).
    const scoreTotal = Math.max(
      0,
      Math.min(Number(parsedEvaluation.score_total) || 0, maxMarks)
    );
    parsedEvaluation.score_total = scoreTotal;
    parsedEvaluation.score_max = maxMarks;
    normalizeAoBreakdown(parsedEvaluation, aoTargets, scoreTotal);

    if (isImprovement) {
      parsedEvaluation.improvements_recognised = refineImprovementsRecognised(
        parsedEvaluation.improvements_recognised,
        priorStudentText,
        addedFragments
      );
    } else {
      delete parsedEvaluation.improvements_recognised;
    }

    // Full marks: never ask for more content to "secure full marks".
    if (scoreTotal >= maxMarks) {
      const recognised = Array.isArray(parsedEvaluation.improvements_recognised)
        ? (parsedEvaluation.improvements_recognised as string[])
        : [];
      parsedEvaluation.missing_or_incorrect = [];
      parsedEvaluation.actionable_improvement_advice = recognised.length
        ? `Full marks (${scoreTotal}/${maxMarks}). Your latest edit was credited: ${recognised[0]}`
        : `Full marks (${scoreTotal}/${maxMarks}). You have covered what this mark scheme requires.`;
    }

    console.log(`Evaluation complete! Awarded Score: ${parsedEvaluation.score_total}/${parsedEvaluation.score_max} | Level: ${parsedEvaluation.level_achieved}`);

    // Persist tokens server-side only — never include usage in the student response.
    await recordAiUsageEvent(supabase, {
      user_id: userId,
      feature: "mark_long_answer",
      model: GEMINI_MODEL,
      request_id: requestId,
      question_id,
      prompt_token_count: usage?.promptTokenCount ?? null,
      candidates_token_count: usage?.candidatesTokenCount ?? null,
      total_token_count: usage?.totalTokenCount ?? null,
      finish_reason: finishReason,
      usage_meta: usage,
      status: "success",
      meta: {
        score_total: parsedEvaluation.score_total ?? null,
        score_max: parsedEvaluation.score_max ?? null,
        science_path: sciencePath,
        is_improvement: isImprovement,
        cache_mode: cacheMode,
        system_prompt_version: SYSTEM_PROMPT_VERSION,
        thinking_budget: MARK_THINKING_BUDGET,
        cached_content_token_count: usage?.cachedContentTokenCount ?? null,
        thoughts_token_count: usage?.thoughtsTokenCount ?? null,
        answer_token_count: usage?.candidatesTokenCount ?? null,
        ao_targets: aoTargets,
        had_prior_summary: Boolean(priorSummary),
        added_fragment_count: addedFragments.length
      }
    });

    console.log(JSON.stringify({ requestId, event: "mark_done", userId, sciencePath, isImprovement, cacheMode, model: GEMINI_MODEL }));
    return new Response(JSON.stringify(parsedEvaluation), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error("🔴 EDGE FUNCTION CRASH:", err);

    return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
