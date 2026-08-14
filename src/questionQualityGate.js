/**
 * Quality gates for AI- and template-generated questions before review/commit.
 */

const FILLER_PATTERN = /check the specification point carefully|distractor \d/i;
const OPEN_ENDED_COMMANDS = new Set([
  "explain", "describe", "suggest", "compare", "evaluate", "justify", "discuss", "analyse", "analyze"
]);

export function normalizeCompareText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenOverlapRatio(a, b) {
  const wordsA = new Set(normalizeCompareText(a).split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(normalizeCompareText(b).split(" ").filter((w) => w.length > 2));
  if (!wordsA.size || !wordsB.size) return 0;
  let shared = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) shared++;
  }
  return shared / Math.min(wordsA.size, wordsB.size);
}

function stemCore(text) {
  return normalizeCompareText(text)
    .replace(/^state which statement correctly describes:\s*/i, "")
    .replace(/^state which statement about .+ is correct according to the specification\?$/i, "")
    .trim();
}

export function isNearDuplicatePrompt(candidatePrompt, priorQuestions = [], candidateCorrect = "") {
  const prompt = stemCore(candidatePrompt) || normalizeCompareText(candidatePrompt);
  if (!prompt) return false;
  const correctNorm = normalizeCompareText(candidateCorrect);
  for (const prev of priorQuestions) {
    const prevCore = stemCore(prev.prompt || prev) || normalizeCompareText(prev.prompt || prev);
    if (!prevCore) continue;
    if (prompt === prevCore) return true;
    if (tokenOverlapRatio(prompt, prevCore) >= 0.72) return true;
    const prevCorrect = normalizeCompareText(prev.correct);
    if (correctNorm && prevCorrect && prevCorrect === correctNorm) return true;
  }
  return false;
}

function optionDistinctness(options = [], correct = "") {
  const trimmed = options.map((o) => String(o || "").trim()).filter(Boolean);
  if (trimmed.length < 4) return { ok: false, reason: "fewer than 4 options" };
  const correctNorm = normalizeCompareText(correct);

  for (let i = 0; i < trimmed.length; i++) {
    for (let j = i + 1; j < trimmed.length; j++) {
      const a = normalizeCompareText(trimmed[i]);
      const b = normalizeCompareText(trimmed[j]);
      if (a === b) return { ok: false, reason: "duplicate options" };
      const bothWrong = a !== correctNorm && b !== correctNorm;
      if (bothWrong && tokenOverlapRatio(trimmed[i], trimmed[j]) >= 0.85) {
        return { ok: false, reason: "options too similar" };
      }
    }
  }
  return { ok: true };
}

/**
 * @returns {{ pass: boolean, reasons: string[] }}
 */
export function evaluateMcqQuality(payload, context = {}) {
  const reasons = [];
  const prompt = String(payload?.prompt || "").trim();
  const options = Array.isArray(payload?.options) ? payload.options : [];
  const correct = String(payload?.correct || "").trim();
  const optionFeedback = payload?.option_feedback || {};
  const distractorSources = payload?.distractor_sources || [];

  if (prompt.length < 20) reasons.push("stem too short");
  if (prompt.length > 280) reasons.push("stem too long");
  if (!correct) reasons.push("missing correct answer");

  const optsCheck = optionDistinctness(options, correct);
  if (!optsCheck.ok) reasons.push(optsCheck.reason);

  if (correct && options.length && !options.some((o) => normalizeCompareText(o) === normalizeCompareText(correct))) {
    reasons.push("correct answer not in options");
  }

  if (FILLER_PATTERN.test(options.join(" "))) {
    reasons.push("filler distractor detected");
  }
  if (distractorSources.includes("filler")) {
    reasons.push("filler distractor source");
  }

  const wrongOptions = options.filter((o) => normalizeCompareText(o) !== normalizeCompareText(correct));
  const feedbackCount = wrongOptions.filter((o) => {
    const fb = optionFeedback[o] || optionFeedback[String(o)];
    return String(fb || "").trim().length >= 8;
  }).length;
  if (feedbackCount < Math.min(3, wrongOptions.length)) {
    reasons.push("insufficient wrong-option feedback");
  }

  const prior = context.priorQuestions || [];
  if (isNearDuplicatePrompt(prompt, prior, correct)) {
    reasons.push("duplicate or near-duplicate stem");
  }
  if (correct && prior.some((p) => normalizeCompareText(p.correct) === normalizeCompareText(correct))) {
    reasons.push("duplicate correct answer in batch");
  }

  if (correct && correct.length >= 30 && tokenOverlapRatio(prompt, correct) >= 0.55) {
    reasons.push("stem reveals the correct answer");
  }

  return { pass: reasons.length === 0, reasons };
}

function countScientificPoints(raw) {
  if (!raw) return 0;
  if (Array.isArray(raw)) return raw.filter(Boolean).length;
  if (typeof raw === "string") {
    return raw.split(/\r?\n|;/).map((s) => s.trim()).filter((s) => s.length > 8).length;
  }
  return 0;
}

/**
 * @returns {{ pass: boolean, reasons: string[] }}
 */
export function evaluateExtendedQuality(payload, context = {}) {
  const reasons = [];
  const prompt = String(payload?.prompt || "").trim();
  const maxMarks = Number(payload?.max_marks) === 4 ? 4 : 6;
  const rubric = payload?.key_payload || payload || {};
  const points = countScientificPoints(rubric.key_scientific_points);

  if (prompt.length < 30) reasons.push("stem too short");
  if (points < 2) reasons.push("fewer than 2 key scientific points");
  if (!String(rubric.marking_guidelines || "").trim()) {
    reasons.push("missing marking guidelines");
  }

  const levels = rubric.level_descriptors || {};
  if (!String(levels["Level 1 (1-2 marks)"] || "").trim()) reasons.push("missing Level 1 descriptor");
  if (!String(levels["Level 2 (3-4 marks)"] || "").trim()) reasons.push("missing Level 2 descriptor");
  if (maxMarks === 6 && !String(levels["Level 3 (5-6 marks)"] || "").trim()) {
    reasons.push("missing Level 3 descriptor");
  }

  const prior = context.priorQuestions || [];
  if (isNearDuplicatePrompt(prompt, prior)) {
    reasons.push("duplicate or near-duplicate stem");
  }

  return { pass: reasons.length === 0, reasons };
}

function isRecallShortText(payload, context = {}) {
  if (context.recallOnly) return true;
  return payload?.question_type === "short_text"
    && Number(payload?.max_marks) === 1
    && (payload?.demand_level || context.demand_level) === "standard_45";
}

/**
 * @returns {{ pass: boolean, reasons: string[] }}
 */
export function evaluateShortTextQuality(payload, context = {}) {
  const reasons = [];
  const prompt = String(payload?.prompt || "").trim();
  const commandWord = String(payload?.command_word || "").toLowerCase().trim();
  const maxMarks = Number(payload?.max_marks) === 1 ? 1 : 2;
  const markPoints = Array.isArray(payload?.mark_points) ? payload.mark_points : [];
  const recall = isRecallShortText(payload, context);

  if (prompt.length < 12) reasons.push("stem too short");
  if (prompt.length > 280) reasons.push("stem too long");

  if (recall) {
    if (OPEN_ENDED_COMMANDS.has(commandWord)) reasons.push("open-ended command word");
    if (/^(explain|describe|suggest|compare|evaluate|justify|discuss|analyse|analyze)\b/i.test(prompt)) {
      reasons.push("open-ended stem");
    }
    if (maxMarks !== 1) reasons.push("recall short text must be 1 mark");
    if (markPoints.length !== 1) reasons.push("recall must have exactly 1 mark point");

    const keywords = String(markPoints[0]?.keywords || markPoints[0]?.point_text || "").trim();
    if (!keywords) reasons.push("missing keywords");
    if (keywords) {
      const synonyms = keywords.split("|").map((s) => s.trim()).filter(Boolean);
      if (synonyms.length > 3) reasons.push("too many keyword synonyms");
      if (keywords.length > 80) reasons.push("keywords too broad");
    }
  } else if (markPoints.length < 1) {
    reasons.push("missing mark points");
  }

  const prior = context.priorQuestions || [];
  const answerKey = markPoints
    .map((mp) => mp.keywords || mp.point_text)
    .filter(Boolean)
    .join("; ");
  if (isNearDuplicatePrompt(prompt, prior, answerKey)) {
    reasons.push("duplicate or near-duplicate stem");
  }

  return { pass: reasons.length === 0, reasons };
}

/**
 * Evaluate normalized draft or raw AI payload.
 */
export function evaluateQuestionQuality(raw, context = {}) {
  const type = raw?.question_type || raw?.question?.question_type || "mcq";
  if (type === "extended_response") {
    const payload = {
      prompt: raw.prompt || raw.question?.prompt,
      max_marks: raw.max_marks || raw.question?.max_marks,
      key_payload: raw.key_payload || raw.answer_key?.key_payload || raw
    };
    return evaluateExtendedQuality(payload, context);
  }

  if (type === "short_text") {
    const payload = {
      question_type: "short_text",
      prompt: raw.prompt || raw.question?.prompt,
      command_word: raw.command_word || raw.question?.command_word,
      max_marks: raw.max_marks || raw.question?.max_marks,
      demand_level: raw.demand_level || raw.question?.demand_level,
      mark_points: raw.mark_points
        || raw.answer_key?.key_payload?.mark_points
        || raw.key_payload?.mark_points
    };
    return evaluateShortTextQuality(payload, {
      ...context,
      demand_level: payload.demand_level
    });
  }

  const payload = {
    prompt: raw.prompt || raw.question?.prompt,
    options: raw.options || raw.question?.options,
    correct: raw.correct || raw.answer_key?.key_payload?.correct,
    option_feedback: raw.option_feedback || raw.answer_key?.key_payload?.option_feedback,
    distractor_sources: raw.distractor_sources || raw._meta?.distractor_sources
  };
  return evaluateMcqQuality(payload, context);
}

export function filterByQualityGate(items, context = {}) {
  const passed = [];
  const rejected = [];
  const prior = [...(context.priorQuestions || [])];

  for (const item of items) {
    const result = evaluateQuestionQuality(item, { priorQuestions: prior });
    if (result.pass) {
      passed.push(item);
      prior.push({
        prompt: item.prompt || item.question?.prompt,
        correct: item.correct
          || item.answer_key?.key_payload?.correct
          || (item.answer_key?.key_payload?.mark_points || item.mark_points || [])
            .map((mp) => mp.keywords || mp.point_text)
            .filter(Boolean)
            .join("; ")
      });
    } else {
      rejected.push({ item, reasons: result.reasons });
    }
  }
  return { passed, rejected };
}
