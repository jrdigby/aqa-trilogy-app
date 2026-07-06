// Batch MCQ question generator — pure functions for admin tab and tests
import {
  suggestCommandWord,
  suggestDemandLevel,
  formatDemandLabel,
  COMMAND_WORD_OPTIONS
} from "./examRules.js";
import { normalizeQuestionTierForDb } from "./sciencePath.js";
import {
  parseSpecClaims,
  pickClaimWithoutReuse,
  buildPromptForClaim,
  splitIntoSentences,
  cleanFragment
} from "./mcqSpecParser.js";
import {
  generateMisconceptionDistractors,
  buildMisconceptionFeedbackMap
} from "./mcqMisconceptions.js";

const DEMAND_COMMAND_WORDS = {
  low: ["state", "give", "name", "define", "identify"],
  standard: ["describe", "compare", "use", "show"],
  standard_45: ["describe", "compare", "calculate", "determine"],
  standard_67: ["explain", "suggest", "use"],
  high_89: ["evaluate", "justify", "discuss"]
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(arr, rng) {
  if (!arr?.length) return "";
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle(arr, rng) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function shortenForOption(text, maxLen = 160) {
  const t = cleanFragment(text);
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trim()}…`;
}

function commandWordForDemand(demandLevel, rng) {
  const pool = DEMAND_COMMAND_WORDS[demandLevel] || DEMAND_COMMAND_WORDS.standard;
  return pick(pool, rng);
}

/** @deprecated use parseSpecClaims — kept for tests */
export function splitSpecFragments(specText) {
  return splitIntoSentences(specText).filter((p) => p.length >= 12 && p.length <= 220);
}

export function expandDemandRecipes(recipes = []) {
  const list = [];
  for (const recipe of recipes) {
    const count = Math.max(0, parseInt(recipe.count, 10) || 0);
    const demandLevel = recipe.demand_level || recipe.demandLevel || "low";
    for (let i = 0; i < count; i++) {
      list.push({ demand_level: demandLevel });
    }
  }
  return list;
}

export function isLowDemandMcqRecipe(recipe = {}) {
  const type = String(recipe.question_type || "mcq").toLowerCase();
  const demand = recipe.demand_level || "low";
  return type === "mcq" && demand === "low";
}

function normalizeCompareText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAvoidTexts(avoidDrafts = []) {
  const set = new Set();
  for (const draft of avoidDrafts) {
    const prompt = draft?.question?.prompt;
    const correct = draft?.answer_key?.key_payload?.correct;
    if (prompt) set.add(normalizeCompareText(prompt));
    if (correct) set.add(normalizeCompareText(correct));
  }
  return set;
}

function pickClaimAvoidingReuse(claims, usedIds, avoidTexts, rng) {
  if (!claims?.length) return null;
  const unused = claims.filter((c) => !usedIds.has(c.id) && !avoidTexts.has(normalizeCompareText(c.text)));
  let pool = unused.length ? unused : claims.filter((c) => !avoidTexts.has(normalizeCompareText(c.text)));
  if (!pool.length) pool = claims;
  const idx = Math.floor((rng?.() ?? Math.random()) * pool.length);
  return pool[idx];
}

/**
 * Generate low-demand MCQs from an expanded recipe list (one entry per question).
 * @param {object[]} recipes — [{ question_type, demand_level }, ...]
 */
export function generateMcqQuestionsForRecipes(spec, specPoint, recipes = [], options = {}) {
  const { avoidDrafts = [] } = options;
  const seed = spec.seed != null ? spec.seed : Date.now();
  const rng = mulberry32(seed);
  const avoidTexts = buildAvoidTexts(avoidDrafts);

  if (!recipes.length) {
    return { drafts: [], errors: [], seed };
  }

  if (!specPoint?.spec_text && !specPoint?.topic_name) {
    return { drafts: [], errors: [{ message: "Spec point has no content to generate from" }], seed };
  }

  const claims = parseSpecClaims(specPoint.spec_text, specPoint.topic_name);
  if (!claims.length) {
    return { drafts: [], errors: [{ message: "Could not parse any claims from spec point text" }], seed };
  }

  const drafts = [];
  const errors = [];
  const usedClaimIds = new Set();

  for (const recipe of recipes) {
    try {
      const demandLevel = recipe.demand_level || "low";
      const enriched = {
        demand_level: demandLevel,
        _claims: claims,
        _usedClaimIds: usedClaimIds,
        _claim: pickClaimAvoidingReuse(claims, usedClaimIds, avoidTexts, rng)
      };
      if (enriched._claim) usedClaimIds.add(enriched._claim.id);
      const draft = generateMcqQuestion(spec, enriched, specPoint, rng);
      draft._meta = { ...draft._meta, source: "template" };
      drafts.push(draft);
    } catch (err) {
      errors.push({ variant: recipe, message: err.message || String(err) });
    }
  }

  return { drafts, errors, seed };
}

export function generateMcqQuestion(spec, variantDesc, specPoint, rng = Math.random) {
  if (!specPoint) throw new Error("Spec point data is required for MCQ generation");

  const demandLevel = variantDesc.demand_level || spec.demand_level || "low";
  const topic = specPoint.topic_name || "this topic";
  const subject = (spec.subject || specPoint.subject || "physics").toLowerCase();
  const commandWord = spec.command_word || commandWordForDemand(demandLevel, rng);

  const claims = variantDesc._claims || parseSpecClaims(specPoint.spec_text, topic);
  const claim = variantDesc._claim
    || pickClaimWithoutReuse(claims, variantDesc._usedClaimIds || new Set(), rng);

  if (!claim) throw new Error("No testable claims found in spec point text");

  const correct = shortenForOption(claim.text);
  const siblingClaims = claims.filter((c) => c.id !== claim.id).map((c) => c.text);

  const distractorObjs = generateMisconceptionDistractors(correct, claim, {
    subject,
    topicName: topic,
    siblingClaims,
    specRef: specPoint.spec_ref,
    rng,
    count: 3
  });

  const distractors = distractorObjs.map((d) => d.text);
  const options = shuffle([correct, ...distractors], rng);
  const prompt = buildPromptForClaim(claim, topic, commandWord, demandLevel);

  const tier = normalizeQuestionTierForDb(spec.tier || "both");
  const ao1 = spec.ao1_marks != null ? spec.ao1_marks : 1;
  const ao2 = spec.ao2_marks != null ? spec.ao2_marks : 0;
  const ao3 = spec.ao3_marks != null ? spec.ao3_marks : 0;

  const optionFeedback = buildMisconceptionFeedbackMap(correct, distractorObjs);
  const genericFeedback = `Review ${topic} (${specPoint.spec_ref || "spec point"}): ${shortenForOption(correct, 120)}`;

  return {
    variant: { demand_level: demandLevel, claim_id: claim.id, claim_type: claim.type },
    question: {
      question_type: "mcq",
      prompt,
      options,
      tier,
      max_marks: 1,
      marking_method: "keyword",
      command_word: commandWord,
      demand_level: demandLevel,
      ao1_marks: ao1,
      ao2_marks: ao2,
      ao3_marks: ao3,
      is_maths_skill: false,
      is_required_practical: false
    },
    answer_key: {
      key_type: "mcq",
      key_payload: {
        correct,
        option_feedback: optionFeedback
      }
    },
    mark_points: [
      {
        ao: ao1 > 0 ? "AO1" : ao2 > 0 ? "AO2" : "AO3",
        point_text: correct,
        feedback_if_missing: genericFeedback,
        max_marks: 1
      }
    ],
    _meta: {
      spec_ref: specPoint.spec_ref,
      topic_name: topic,
      claim_id: claim.id,
      claim_focus: claim.focus,
      claim_type: claim.type,
      auto_prompt: prompt,
      distractor_sources: distractorObjs.map((d) => d.source)
    }
  };
}

export function generateMcqBatch(spec, specPoint) {
  const seed = spec.seed != null ? spec.seed : Date.now();
  const rng = mulberry32(seed);
  const descriptors = expandDemandRecipes(spec.recipes || spec.variants?.recipes || []);

  if (!descriptors.length) {
    return { drafts: [], errors: [{ message: "No recipes requested (all counts are 0)" }], seed };
  }

  if (!specPoint?.spec_text && !specPoint?.topic_name) {
    return { drafts: [], errors: [{ message: "Spec point has no content to generate from" }], seed };
  }

  const claims = parseSpecClaims(specPoint.spec_text, specPoint.topic_name);
  if (!claims.length) {
    return { drafts: [], errors: [{ message: "Could not parse any claims from spec point text" }], seed };
  }

  const drafts = [];
  const errors = [];
  const usedClaimIds = new Set();

  for (const desc of descriptors) {
    try {
      const enriched = {
        ...desc,
        _claims: claims,
        _usedClaimIds: usedClaimIds,
        _claim: pickClaimWithoutReuse(claims, usedClaimIds, rng)
      };
      if (enriched._claim) usedClaimIds.add(enriched._claim.id);
      drafts.push(generateMcqQuestion(spec, enriched, specPoint, rng));
    } catch (err) {
      errors.push({ variant: desc, message: err.message || String(err) });
    }
  }

  return { drafts, errors, seed };
}

export function remapMcqOptionFeedback(options, optionFeedback = {}, oldCorrect, newCorrect) {
  if (!optionFeedback || typeof optionFeedback !== "object") return undefined;
  const remapped = {};
  const oldOpts = Array.isArray(options) ? options : [];
  for (const [key, val] of Object.entries(optionFeedback)) {
    if (key === oldCorrect) continue;
    const idx = oldOpts.indexOf(key);
    if (idx >= 0 && options[idx] && options[idx] !== newCorrect) {
      remapped[options[idx]] = val;
    } else if (options.includes(key) && key !== newCorrect) {
      remapped[key] = val;
    }
  }
  return Object.keys(remapped).length ? remapped : undefined;
}

export function syncDraftFromPreviewEdits(draft, edits) {
  if (!draft) return draft;
  const q = { ...draft.question, ...edits.question };
  const options = Array.isArray(edits.options)
    ? edits.options.map((o) => String(o || "").trim())
    : [...(q.options || [])];
  while (options.length < 4) options.push("");
  const trimmedOptions = options.slice(0, 4);

  let correct = edits.correct ?? draft.answer_key?.key_payload?.correct ?? "";
  if (!trimmedOptions.includes(correct)) {
    correct = trimmedOptions.find(Boolean) || "";
  }

  const oldCorrect = draft.answer_key?.key_payload?.correct;
  const optionFeedback = edits.option_feedback ?? remapMcqOptionFeedback(
    draft.question?.options,
    draft.answer_key?.key_payload?.option_feedback,
    oldCorrect,
    correct
  );

  const payload = { correct };
  if (optionFeedback) payload.option_feedback = optionFeedback;

  const markPoints = draft.mark_points?.length
    ? [{ ...draft.mark_points[0] }]
    : [{ ao: "AO1", point_text: correct, feedback_if_missing: edits.overall_feedback || "", max_marks: 1 }];

  if (edits.overall_feedback != null) {
    markPoints[0] = { ...markPoints[0], feedback_if_missing: edits.overall_feedback };
  }
  if (edits.mark_point) {
    markPoints[0] = { ...markPoints[0], ...edits.mark_point };
  }
  if (correct) markPoints[0].point_text = correct;

  return {
    ...draft,
    question: {
      ...q,
      options: trimmedOptions,
      ao1_marks: edits.ao1_marks ?? q.ao1_marks,
      ao2_marks: edits.ao2_marks ?? q.ao2_marks,
      ao3_marks: edits.ao3_marks ?? q.ao3_marks,
      command_word: edits.command_word ?? q.command_word,
      demand_level: edits.demand_level ?? q.demand_level,
      prompt: edits.prompt ?? q.prompt,
      image_url: edits.image_url !== undefined ? edits.image_url : q.image_url
    },
    answer_key: {
      key_type: "mcq",
      key_payload: payload
    },
    mark_points: markPoints
  };
}

export function demandRecipeLabel(variant) {
  if (!variant?.demand_level) return "—";
  return formatDemandLabel(variant.demand_level);
}

export function getDemandOptionsForTier(tier) {
  const t = String(tier || "both").toLowerCase();
  if (t === "higher" || t === "ht") {
    return [
      { value: "standard_45", label: "Standard 4–5" },
      { value: "standard_67", label: "Standard 6–7" },
      { value: "high_89", label: "High 8–9" }
    ];
  }
  if (t === "foundation" || t === "ft") {
    return [
      { value: "low", label: "Low" },
      { value: "standard", label: "Standard" }
    ];
  }
  return [
    { value: "low", label: "Low (FT)" },
    { value: "standard", label: "Standard (FT)" },
    { value: "standard_45", label: "Standard 4–5 (HT)" },
    { value: "standard_67", label: "Standard 6–7 (HT)" },
    { value: "high_89", label: "High 8–9 (HT)" }
  ];
}

export function suggestCommandWordForPrompt(prompt) {
  return suggestCommandWord(prompt);
}

export function inferDemandFromCommandWord(commandWord, tier) {
  return suggestDemandLevel(commandWord, tier);
}

export { parseSpecClaims, COMMAND_WORD_OPTIONS, formatDemandLabel };
