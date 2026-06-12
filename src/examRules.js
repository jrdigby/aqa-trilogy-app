// AQA exam metadata helpers — difficulty computation and tier bands.

const DEMAND_BASE = {
  low: 1,
  standard: 2,
  standard_45: 3,
  standard_67: 4,
  high_89: 5
};

export const GLOBAL_OFFSET_MIN = -2;
export const GLOBAL_OFFSET_MAX = 2;
export const SPEC_OFFSET_MIN = 0;
export const SPEC_OFFSET_MAX = 2;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function inferDemandFromHeuristics(question) {
  const prompt = (question.prompt || "").trim().toLowerCase();
  const firstWord = prompt.split(/\s+/)[0] || "";
  const tier = normalizeQuestionTier(question.tier);
  const type = question.question_type || "";

  const highDemandWords = new Set(["evaluate", "justify", "discuss"]);
  const midDemandWords = new Set(["explain", "suggest", "compare", "calculate", "determine", "describe"]);
  const lowDemandWords = new Set(["state", "give", "name", "define", "identify", "write", "plot", "label"]);

  if (tier === "HT" || tier === "higher") {
    if (highDemandWords.has(firstWord) || type === "extended_response") return 5;
    if (midDemandWords.has(firstWord)) return 4;
    return 3;
  }

  if (lowDemandWords.has(firstWord) || type === "mcq") return 1;
  if (midDemandWords.has(firstWord) || type === "numeric") return 2;
  if (type === "extended_response") return 2;
  return 2;
}

export function normalizeQuestionTier(tier) {
  if (!tier) return "both";
  const t = String(tier).toLowerCase();
  if (t === "foundation" || t === "ft") return "FT";
  if (t === "higher" || t === "ht") return "HT";
  return tier;
}

/**
 * Compute cached difficulty index 1–5 from demand_level + AO marks, with fallbacks.
 */
export function computeQuestionDifficulty(question) {
  if (!question) return 3;

  const maxMarks = Number(question.max_marks) || 0;
  const ao1 = Number(question.ao1_marks) || 0;
  const ao2 = Number(question.ao2_marks) || 0;
  const ao3 = Number(question.ao3_marks) || 0;
  const demandLevel = question.demand_level;

  let base;
  if (demandLevel && DEMAND_BASE[demandLevel] != null) {
    base = DEMAND_BASE[demandLevel];
  } else if (question.difficulty != null && Number(question.difficulty) >= 1) {
    base = Number(question.difficulty);
  } else {
    base = inferDemandFromHeuristics(question);
  }

  if (maxMarks > 0 && (ao1 + ao2 + ao3) > 0) {
    const ao3Share = ao3 / maxMarks;
    const aoModifier = (ao3Share - 0.2) * 1.25;
    return clamp(Math.round(base + aoModifier), 1, 5);
  }

  return clamp(Math.round(base), 1, 5);
}

export function getEffectiveDifficulty(question) {
  return computeQuestionDifficulty(question);
}

export function getTargetDifficultyForGlobal(tier, globalOffset) {
  const o = clamp(globalOffset, GLOBAL_OFFSET_MIN, GLOBAL_OFFSET_MAX);
  if (tier === "HT") return clamp(3 + o, 3, 5);
  return clamp(2 + o, 1, 2);
}

export function getTargetDifficultyForSpecPoint(tier, specOffset) {
  const o = clamp(specOffset, SPEC_OFFSET_MIN, SPEC_OFFSET_MAX);
  if (tier === "HT") return clamp(3 + o, 3, 5);
  return clamp(1 + o, 1, 2);
}

const MATHS_MIN_PCT = { biology: 0.1, chemistry: 0.2, physics: 0.3 };
const RP_MIN_PCT = 0.15;

const FT_DEMAND_PCT = { low: 0.6, standard: 0.4 };
const HT_DEMAND_PCT = { standard_45: 0.4, standard_67: 0.4, high_89: 0.2 };

function largestRemainder(total, ratios) {
  const keys = Object.keys(ratios);
  const raw = keys.map((k) => ({ k, raw: total * ratios[k] }));
  const floors = raw.map((r) => ({ k: r.k, v: Math.floor(r.raw), frac: r.raw - Math.floor(r.raw) }));
  let used = floors.reduce((s, f) => s + f.v, 0);
  const sorted = [...floors].sort((a, b) => b.frac - a.frac);
  const out = Object.fromEntries(floors.map((f) => [f.k, f.v]));
  for (let i = 0; used < total && i < sorted.length; i++) {
    out[sorted[i].k] += 1;
    used += 1;
  }
  return out;
}

export function inferAoMarks(question) {
  const max = Number(question.max_marks) || 1;
  if (question.ao1_marks != null || question.ao2_marks != null || question.ao3_marks != null) {
    return {
      ao1: Number(question.ao1_marks) || 0,
      ao2: Number(question.ao2_marks) || 0,
      ao3: Number(question.ao3_marks) || 0
    };
  }
  const type = question.question_type || "";
  if (type === "mcq") return { ao1: max, ao2: 0, ao3: 0 };
  if (type === "numeric") return { ao1: 0, ao2: max, ao3: 0 };
  if (type === "extended_response") {
    const third = Math.floor(max / 3);
    return { ao1: third, ao2: third, ao3: max - third * 2 };
  }
  return { ao1: max, ao2: 0, ao3: 0 };
}

export function inferDemandBucket(question, tier) {
  if (question.demand_level) return question.demand_level;
  const d = computeQuestionDifficulty(question);
  if (tier === "HT") {
    if (d >= 5) return "high_89";
    if (d >= 4) return "standard_67";
    return "standard_45";
  }
  return d <= 1 ? "low" : "standard";
}

export function isMathsSkillQuestion(question) {
  if (question.is_maths_skill === true) return true;
  return question.question_type === "numeric";
}

export function isRpQuestion(question) {
  return question.is_required_practical === true;
}

export function getPaperTargets(totalMarks, tier, subject) {
  const ao = largestRemainder(totalMarks, { ao1: 0.4, ao2: 0.4, ao3: 0.2 });
  const demand =
    tier === "HT"
      ? largestRemainder(totalMarks, HT_DEMAND_PCT)
      : largestRemainder(totalMarks, FT_DEMAND_PCT);
  const subj = (subject || "biology").toLowerCase();
  const mathsPct = MATHS_MIN_PCT[subj] ?? 0.1;
  return {
    marks: totalMarks,
    ao1: ao.ao1,
    ao2: ao.ao2,
    ao3: ao.ao3,
    demand,
    maths: Math.ceil(totalMarks * mathsPct),
    rp: Math.ceil(totalMarks * RP_MIN_PCT)
  };
}

export const COMMAND_WORD_OPTIONS = [
  "state", "give", "name", "define", "identify", "write", "plot", "label",
  "describe", "compare", "calculate", "determine", "suggest", "use", "show",
  "explain", "evaluate", "justify", "discuss"
];

const FT_LOW_WORDS = new Set(["state", "give", "name", "define", "identify", "write", "plot", "label"]);
const FT_STANDARD_WORDS = new Set(["describe", "compare", "calculate", "determine", "suggest", "use", "show"]);
const HT_STANDARD_45 = new Set(["describe", "compare", "calculate"]);
const HT_STANDARD_67 = new Set(["explain", "suggest", "use"]);
const HT_HIGH_WORDS = new Set(["evaluate", "justify", "discuss"]);

export function suggestCommandWord(prompt) {
  const text = (prompt || "").trim();
  if (!text) return "";
  const first = text.split(/\s+/)[0].toLowerCase().replace(/[.,\/#!$%^&*;:{}=\-_`~()?]/g, "");
  if (COMMAND_WORD_OPTIONS.includes(first)) return first;
  for (const w of COMMAND_WORD_OPTIONS) {
    if (text.toLowerCase().startsWith(w + " ")) return w;
  }
  return "";
}

export function suggestDemandLevel(commandWord, tier) {
  const word = (commandWord || "").toLowerCase();
  const t = normalizeQuestionTier(tier);
  const isHt = t === "HT" || tier === "higher";

  if (isHt) {
    if (HT_HIGH_WORDS.has(word)) return "high_89";
    if (HT_STANDARD_67.has(word)) return "standard_67";
    if (HT_STANDARD_45.has(word) || word === "show") return "standard_45";
    return "standard_45";
  }

  if (FT_LOW_WORDS.has(word)) return "low";
  if (FT_STANDARD_WORDS.has(word) || word === "explain") return "standard";
  return "standard";
}

export function getDemandOptionsForTier(tier) {
  const t = normalizeQuestionTier(tier);
  const isHt = t === "HT" || tier === "higher";
  if (tier === "both") {
    return [
      { value: "low", label: "Low (FT)" },
      { value: "standard", label: "Standard (FT)" },
      { value: "standard_45", label: "Standard 4–5 (HT)" },
      { value: "standard_67", label: "Standard 6–7 (HT)" },
      { value: "high_89", label: "High 8–9 (HT)" }
    ];
  }
  if (isHt) {
    return [
      { value: "standard_45", label: "Standard 4–5" },
      { value: "standard_67", label: "Standard 6–7" },
      { value: "high_89", label: "High 8–9" }
    ];
  }
  return [
    { value: "low", label: "Low" },
    { value: "standard", label: "Standard" }
  ];
}

export function suggestAoMarks(questionType, maxMarks, markPoints = []) {
  const max = Number(maxMarks) || 1;
  if (markPoints?.length) {
    const ao = { ao1: 0, ao2: 0, ao3: 0 };
    for (const mp of markPoints) {
      const key = (mp.ao || "AO1").toUpperCase();
      const marks = Number(mp.max_marks) || 1;
      if (key === "AO2") ao.ao2 += marks;
      else if (key === "AO3") ao.ao3 += marks;
      else ao.ao1 += marks;
    }
    return ao;
  }
  return inferAoMarks({ question_type: questionType, max_marks: max });
}

export function formatDemandLabel(demand) {
  const labels = {
    low: "Low",
    standard: "Standard",
    standard_45: "Std 4–5",
    standard_67: "Std 6–7",
    high_89: "High 8–9"
  };
  return labels[demand] || demand || "—";
}

export function getAuthoringGuidelinesHtml() {
  return `
    <p><strong>AO weighting (per paper):</strong> AO1 40% · AO2 40% · AO3 20%. Align Section 3 mark points with AO fields below.</p>
    <ul>
      <li><strong>MCQ / recall</strong> → usually AO1</li>
      <li><strong>Calculations</strong> → usually AO2 (flag <em>Maths skill</em>)</li>
      <li><strong>Extended 4–6 mark</strong> → mix AO1/AO2/AO3</li>
    </ul>
    <p><strong>Demand bands:</strong></p>
    <ul>
      <li><strong>Foundation:</strong> Low · Standard</li>
      <li><strong>Higher:</strong> Standard 4–5 · Standard 6–7 · High 8–9</li>
    </ul>
    <p><strong>Command word → demand (default):</strong></p>
    <table class="guidelines-table">
      <thead><tr><th>FT Low</th><th>FT Standard</th><th>HT 4–5</th><th>HT 6–7</th><th>HT 8–9</th></tr></thead>
      <tbody><tr>
        <td>state, give, name, define…</td>
        <td>describe, compare, calculate…</td>
        <td>describe, compare, calculate</td>
        <td>explain, suggest, use</td>
        <td>evaluate, justify, discuss</td>
      </tr></tbody>
    </table>
    <p><strong>Maths skills minimum (by subject):</strong> Biology 10% · Chemistry 20% · Physics 30% of paper marks.</p>
    <p><strong>Required practicals:</strong> at least 15% of paper marks — flag RP questions in authoring.</p>
    <p><strong>CSV optional columns:</strong> <code>command_word</code>, <code>demand_level</code>, <code>ao1_marks</code>, <code>ao2_marks</code>, <code>ao3_marks</code>, <code>is_maths_skill</code>, <code>is_required_practical</code> (true/false).</p>
  `;
}

export function getBoundaryMode(tier, globalOffset, specOffset, mode) {
  if (mode === "spec_point") {
    const o = clamp(specOffset ?? 0, SPEC_OFFSET_MIN, SPEC_OFFSET_MAX);
    if (tier === "FT" && o >= SPEC_OFFSET_MAX) return "ft_ceiling";
    if (tier === "HT" && o <= SPEC_OFFSET_MIN) return "ht_floor";
    return null;
  }
  const o = clamp(globalOffset ?? 0, GLOBAL_OFFSET_MIN, GLOBAL_OFFSET_MAX);
  if (tier === "FT" && o >= GLOBAL_OFFSET_MAX) return "ft_ceiling";
  if (tier === "HT" && o <= GLOBAL_OFFSET_MIN) return "ht_floor";
  return null;
}
