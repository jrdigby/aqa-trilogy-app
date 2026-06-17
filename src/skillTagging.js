import { getSkillByFullCode, normalizeFullCode, skillAppliesToSubject } from "./skillFramework.js";

function addSkill(set, fullCode, sources, reason) {
  const normalized = normalizeFullCode(fullCode);
  if (!normalized) return;
  set.add(normalized);
  if (sources && reason) {
    if (!sources[normalized]) sources[normalized] = [];
    if (!sources[normalized].includes(reason)) sources[normalized].push(reason);
  }
}

function promptMatches(prompt, patterns) {
  const text = (prompt || "").toLowerCase();
  return patterns.some((p) => (typeof p === "string" ? text.includes(p) : p.test(text)));
}

function getCalcSteps(draft) {
  const config = draft.calculation_config;
  if (!config) return [];
  if (Array.isArray(config.steps)) return config.steps;
  if (typeof config === "object" && config.steps) return config.steps;
  return [];
}

function filterBySubject(codes, subject) {
  return codes.filter((code) => {
    const skill = getSkillByFullCode(code);
    return skill && skillAppliesToSubject(skill, subject);
  });
}

/**
 * Suggest MS and WS full_codes for a question draft.
 * @returns {{ ms: string[], ws: string[], sources: Record<string, string[]> }}
 */
export function suggestSkillsForQuestion(draft, markPoints = []) {
  const ms = new Set();
  const ws = new Set();
  const sources = {};
  const subject = draft.subject || draft.spec_subject || null;
  const prompt = draft.prompt || "";
  const qType = draft.question_type;
  const steps = getCalcSteps(draft);

  for (const step of steps) {
    if (!step || step.required === false) continue;
    switch (step.type) {
      case "sig_figs":
        addSkill(ms, "MS2a", sources, "calculation: significant figures");
        addSkill(ws, "WS4.6", sources, "calculation: significant figures");
        break;
      case "conversion":
        addSkill(ms, "MS4a", sources, "calculation: unit conversion");
        addSkill(ws, "WS4.5", sources, "calculation: unit conversion");
        break;
      case "rearrangement":
        addSkill(ms, "MS3b", sources, "calculation: rearrangement");
        addSkill(ws, "WS3.3", sources, "calculation: rearrangement");
        break;
      case "substitution":
        addSkill(ms, "MS3c", sources, "calculation: substitution");
        addSkill(ws, "WS3.3", sources, "calculation: substitution");
        break;
      case "equation_select":
        addSkill(ms, "MS3b", sources, "calculation: equation");
        addSkill(ms, "MS3c", sources, "calculation: equation");
        addSkill(ws, "WS3.3", sources, "calculation: equation");
        break;
      case "calculate":
        addSkill(ms, "MS3c", sources, "calculation: numeric answer");
        break;
      default:
        break;
    }
  }

  if (qType === "numeric") {
    if (subject === "biology") {
      addSkill(ms, "MS3d", sources, "question type: numeric");
    } else {
      addSkill(ms, "MS3c", sources, "question type: numeric");
    }
  }

  if (draft.is_maths_skill && qType !== "numeric") {
    addSkill(ms, "MS1c", sources, "flagged maths skill");
  }

  if (draft.is_required_practical) {
    ["WS2.2", "WS2.3", "WS2.4", "WS2.6", "WS2.7"].forEach((code) =>
      addSkill(ws, code, sources, "required practical")
    );
  }

  if (promptMatches(prompt, ["mean", "average", "arithmetic mean"])) {
    addSkill(ms, "MS2b", sources, "prompt: mean/average");
    addSkill(ws, "WS3.3", sources, "prompt: mean/average");
  }

  if (promptMatches(prompt, ["median", "mode"])) {
    addSkill(ms, "MS2f", sources, "prompt: median/mode");
  }

  if (promptMatches(prompt, ["graph", "gradient", "slope", "intercept", "plot"])) {
    addSkill(ms, "MS4d", sources, "prompt: graph/gradient");
    addSkill(ws, "WS3.1", sources, "prompt: graph");
    addSkill(ws, "WS3.3", sources, "prompt: graph analysis");
  }

  if (promptMatches(prompt, ["scatter", "correlation"])) {
    addSkill(ms, "MS2g", sources, "prompt: scatter/correlation");
  }

  if (promptMatches(prompt, ["hypothesis", "predict"])) {
    addSkill(ws, "WS2.1", sources, "prompt: hypothesis");
  }

  if (promptMatches(prompt, ["control variable", "independent variable", "dependent variable", "fair test"])) {
    addSkill(ws, "WS2.2", sources, "prompt: variables");
  }

  if (promptMatches(prompt, ["anomaly", "anomalous", "repeatable", "reproducible", "precision", "accuracy"])) {
    addSkill(ws, "WS3.7", sources, "prompt: data quality");
  }

  if (promptMatches(prompt, ["standard form", "scientific notation"])) {
    addSkill(ms, "MS1b", sources, "prompt: standard form");
  }

  if (promptMatches(prompt, ["percentage", "percent", "ratio", "fraction"])) {
    addSkill(ms, "MS1c", sources, "prompt: ratio/percentage");
  }

  if (promptMatches(prompt, ["order of magnitude"])) {
    addSkill(ms, "MS2h", sources, "prompt: order of magnitude");
    addSkill(ws, "WS3.3", sources, "prompt: order of magnitude");
  }

  if (promptMatches(prompt, ["sample", "sampling"])) {
    addSkill(ms, "MS2d", sources, "prompt: sampling");
    addSkill(ws, "WS2.5", sources, "prompt: sampling");
  }

  if (promptMatches(prompt, ["hazard", "risk", "safety"])) {
    addSkill(ws, "WS2.4", sources, "prompt: safety");
    addSkill(ws, "WS1.5", sources, "prompt: risk");
  }

  if (promptMatches(prompt, ["evaluate", "evaluation", "improve"])) {
    addSkill(ws, "WS1.4", sources, "prompt: evaluate");
    addSkill(ws, "WS3.6", sources, "prompt: evaluate");
  }

  const cmd = (draft.command_word || "").toLowerCase();
  if (cmd === "plot" || cmd === "draw") {
    addSkill(ms, "MS4c", sources, "command word: plot/draw");
    addSkill(ws, "WS3.1", sources, "command word: plot/draw");
  }
  if (cmd === "calculate" || cmd === "determine") {
    addSkill(ms, "MS3c", sources, "command word: calculate");
  }

  for (const mp of markPoints || []) {
    const text = (mp.point_text || "").toLowerCase();
    if (mp.ao === "AO3" && /evaluat|justif|conclud/.test(text)) {
      addSkill(ws, "WS3.6", sources, "mark point: AO3 evaluate");
    }
  }

  return {
    ms: filterBySubject([...ms], subject),
    ws: filterBySubject([...ws], subject),
    sources,
  };
}

/** Merge manual selections with auto suggestions (union). */
export function mergeSkillSelections(manualFullCodes, suggested) {
  const merged = new Set(manualFullCodes || []);
  for (const code of suggested?.ms || []) merged.add(code);
  for (const code of suggested?.ws || []) merged.add(code);
  return [...merged];
}

export function splitSkillsByFramework(fullCodes) {
  const ms = [];
  const ws = [];
  for (const code of fullCodes || []) {
    const n = normalizeFullCode(code);
    if (!n) continue;
    if (n.startsWith("MS")) ms.push(n);
    else if (n.startsWith("WS")) ws.push(n);
  }
  return { ms, ws };
}

/** Resolve full_codes to skill IDs using a catalog map full_code -> id */
export function fullCodesToSkillIds(fullCodes, catalogByFullCode) {
  const ids = [];
  for (const code of fullCodes || []) {
    const n = normalizeFullCode(code);
    const row = n ? catalogByFullCode.get(n) : null;
    if (row?.id) ids.push(row.id);
  }
  return [...new Set(ids)];
}

export function extractQuestionSkillCodes(question) {
  const rows = question?.question_skills || [];
  const codes = rows
    .map((r) => normalizeFullCode(r.skill_framework_items?.full_code || r.full_code))
    .filter(Boolean);
  return [...new Set(codes)];
}
