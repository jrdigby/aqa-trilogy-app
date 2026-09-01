import {
  getGradableMarkPoints,
  checkKeywordOrSynonymsMatch,
  isFuzzyMatch,
} from "./evalEngine.js";

/**
 * Build feedback-safe context for renderFeedback (no raw rubric beyond what UI needs).
 */
export function buildFeedbackContext(q, key, markPoints, resp) {
  const ctx = {};

  if (key?.key_type === "mcq") {
    ctx.mcq_correct = key.key_payload?.correct || key.key_payload?.answer || "";
    ctx.mcq_selected = resp.answer ?? "";
  }

  if (q.question_type === "short_text" && key) {
    let keywordTargets = [];
    if (key.key_type === "pick_n") {
      keywordTargets = Array.isArray(key.key_payload?.pool)
        ? key.key_payload.pool
        : [];
    } else if (getGradableMarkPoints(markPoints).length > 0) {
      keywordTargets = getGradableMarkPoints(markPoints)
        .map((mp) => String(mp.point_text || "").trim())
        .filter(Boolean);
    } else if (key.key_type === "keywords") {
      const required = Array.isArray(key.key_payload?.required)
        ? key.key_payload.required
        : [];
      const optional = Array.isArray(key.key_payload?.optional)
        ? key.key_payload.optional
        : [];
      keywordTargets = [...required, ...optional];
    }
    ctx.keyword_targets = keywordTargets;
    ctx.keyword_key_type = key.key_type;

    const studentRawText = String(resp.text || "").trim();
    const textRaw = studentRawText.toLowerCase();
    const cleanStudentText = textRaw.replace(
      /[.,\/#!$%\^&\*;:{}=\-_`~()?]/g,
      "",
    );
    const studentWords = cleanStudentText.split(/\s+/).filter(Boolean);
    ctx.keyword_badges = keywordTargets.map((targetExpr) => {
      const hasExact = checkKeywordOrSynonymsMatch(
        targetExpr,
        studentWords,
        textRaw,
      );
      const hasFuzzy =
        !hasExact &&
        targetExpr.split("|").some((syn) =>
          studentWords.some((w) =>
            isFuzzyMatch(w, syn.trim().toLowerCase(), 0.85),
          ),
        );
      return {
        label: targetExpr.replace(/\|/g, " / "),
        status: hasExact ? "exact" : hasFuzzy ? "fuzzy" : "missing",
      };
    });
    ctx.student_answer_text = studentRawText;
  }

  if (q.question_type === "chemistry_interactive") {
    ctx.model_answer =
      key?.key_payload || q.chemistry_config?.answer || {};
    ctx.chemistry_template = q.chemistry_config?.template;
  }

  if (q.question_type === "circuit_interactive") {
    ctx.model_answer =
      key?.key_payload || q.circuit_config?.answer || {};
  }

  if (q.question_type === "equipment_interactive") {
    ctx.model_answer =
      key?.key_payload || q.equipment_config?.answer || {};
  }

  return ctx;
}
