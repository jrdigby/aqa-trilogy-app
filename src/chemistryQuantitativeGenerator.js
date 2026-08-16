/**
 * Batch generators for AQA chemistry quantitative questions (FT first pass).
 * Scenarios: RFM, conservation of mass, % by mass, concentration (find c / find m), balance.
 * No chemistry equation sheets — numeric configs are custom calculation_config only.
 */

import {
  relativeFormulaMass,
  elementMassInCompound,
  percentByMass,
  arValuesForFormula,
  distractorFormulaMasses,
  formatArList,
  parseFormula,
  relativeAtomicMass
} from "./chemistryFormula.js";

import compoundsData from "../data/chemistry/compounds.json" with { type: "json" };
import reactionsData from "../data/chemistry/conservation_reactions.json" with { type: "json" };
import balanceData from "../data/chemistry/balance_equations.json" with { type: "json" };

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

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function roundNice(n) {
  if (!Number.isFinite(n)) return n;
  if (Number.isInteger(n)) return n;
  const r1 = Math.round(n * 10) / 10;
  if (Math.abs(r1 - n) < 1e-9) return r1;
  const r2 = Math.round(n * 100) / 100;
  if (Math.abs(r2 - n) < 1e-9) return r2;
  const r3 = Math.round(n * 1000) / 1000;
  if (Math.abs(r3 - n) < 1e-9) return r3;
  return Math.round(n * 10000) / 10000;
}

/** Preserve up to 6 significant figures for near-miss lists. */
function roundNearMiss(n) {
  if (!Number.isFinite(n) || n === 0) return n;
  const abs = Math.abs(n);
  if (abs >= 1) return roundNice(n);
  return parseFloat(n.toPrecision(4));
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return String(n);
  const s = String(roundNice(n));
  return s;
}

function baseMeta(spec) {
  return {
    subject: "chemistry",
    paper: spec.paper || "paper1",
    tier: spec.tier || "both",
    courseTrack: spec.courseTrack || "combined",
    audience: spec.audience || "both",
    spec_point_id: spec.spec_point_id || null,
    triple_spec_point_id: spec.triple_spec_point_id || null
  };
}

function provenance(spec, scenario, extra = {}) {
  return {
    source: "batch_chem_quant",
    scenario,
    seed: spec.seed ?? null,
    ...extra
  };
}

function applySpecLinks(question, meta) {
  if (meta.spec_point_id) question.spec_point_id = meta.spec_point_id;
  if (meta.triple_spec_point_id) question.triple_spec_point_id = meta.triple_spec_point_id;
  return question;
}

function snapshotDraft(draft) {
  return {
    question: { ...draft.question },
    answer_key: draft.answer_key ? { ...draft.answer_key, key_payload: { ...draft.answer_key.key_payload } } : null,
    mark_points: draft.mark_points || []
  };
}

function finalizeDraft(draft, spec, scenario) {
  draft.provenance = {
    ...provenance(spec, scenario),
    original_snapshot: snapshotDraft(draft),
    original_prompt: draft.question?.prompt || ""
  };
  draft._sourceSpec = { ...spec, scenario };
  return draft;
}

export function listCompounds() {
  return compoundsData.compounds || [];
}

export function listConservationReactions() {
  return reactionsData.reactions || [];
}

export function listBalanceEquations() {
  return balanceData.equations || [];
}

/** Normalise formula keys for exclude / dedupe sets. */
export function normalizeFormulaKey(formula) {
  return String(formula || "").trim();
}

/**
 * Extract the first mhchem formula token from a chem-quant prompt.
 * Matches `$\\ce{H2O}$` or embedded `\\ce{H2O}`.
 */
export function extractFormulaFromChemPrompt(prompt) {
  const text = String(prompt || "");
  const m = text.match(/\\ce\{([A-Za-z][A-Za-z0-9]*)\}/);
  return m ? normalizeFormulaKey(m[1]) : null;
}

export function formulasFromPrompts(prompts) {
  const out = new Set();
  for (const p of prompts || []) {
    const f = extractFormulaFromChemPrompt(p);
    if (f) out.add(f);
  }
  return [...out];
}

function promptPatternForCompoundScenario(scenario) {
  if (scenario === "rfm") return "%relative formula mass (Mr) of%";
  if (scenario === "percent_by_mass") return "%percentage by mass of%";
  return null;
}

/**
 * Load formulas already used in the bank for RFM / % by mass questions.
 * @returns {Promise<string[]>}
 */
export async function loadExcludedFormulas(supabaseClient, scenario) {
  const pattern = promptPatternForCompoundScenario(scenario);
  if (!supabaseClient || !pattern) return [];

  const { data, error } = await supabaseClient
    .from("questions")
    .select("prompt")
    .ilike("prompt", pattern)
    .limit(5000);

  if (error) throw error;
  return formulasFromPrompts((data || []).map((row) => row.prompt));
}

/**
 * Shuffle pool and take up to `count` compounds not in excludeFormulas.
 * Never repeats a formula within the returned list.
 */
export function selectUniqueCompounds(compounds, count, rng, excludeFormulas = []) {
  const exclude = new Set(
    (excludeFormulas || []).map(normalizeFormulaKey).filter(Boolean)
  );
  const pool = shuffle(
    (compounds || []).filter((c) => {
      const key = normalizeFormulaKey(c?.formula);
      return key && !exclude.has(key);
    }),
    rng
  );
  const selected = pool.slice(0, Math.max(0, count));
  const shortfall = Math.max(0, count - selected.length);
  return { selected, shortfall, available: pool.length };
}

/** Canonical equation text for balance dedupe (species + states, no $ wrappers). */
export function balanceEquationSignature(entryOrSpecies, arrow = "->") {
  const species = Array.isArray(entryOrSpecies)
    ? entryOrSpecies
    : entryOrSpecies?.species;
  const ce = mhchemEquationFromSpecies(species || [], arrow);
  return String(ce || "")
    .replace(/^\$\\ce\{/, "")
    .replace(/\}\$$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractBalanceSignatureFromPrompt(prompt) {
  const text = String(prompt || "");
  const m = text.match(/\$\\ce\{([^$]+)\}\$/);
  if (!m) {
    const m2 = text.match(/\\ce\{([^}]+)\}/);
    return m2 ? m2[1].replace(/\s+/g, " ").trim() : null;
  }
  return m[1].replace(/\s+/g, " ").trim();
}

export function balanceKeysFromQuestionRow(row) {
  const keys = [];
  const cfg = row?.chemistry_config;
  if (cfg && cfg.kind === "balance_equation") {
    const species = cfg.template?.species || cfg.answer?.species;
    if (species?.length) keys.push(balanceEquationSignature(species));
  }
  const fromPrompt = extractBalanceSignatureFromPrompt(row?.prompt);
  if (fromPrompt) keys.push(fromPrompt);
  return [...new Set(keys.filter(Boolean))];
}

/**
 * Load equation signatures already used in the bank for balance questions.
 * @returns {Promise<string[]>}
 */
export async function loadExcludedBalanceKeys(supabaseClient) {
  if (!supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from("questions")
    .select("prompt, chemistry_config")
    .eq("question_type", "chemistry_interactive")
    .limit(5000);

  if (error) throw error;

  const keys = new Set();
  for (const row of data || []) {
    if (row?.chemistry_config?.kind && row.chemistry_config.kind !== "balance_equation") {
      continue;
    }
    // Include rows with balance prompts even if kind filter missed older data
    const looksBalance =
      row?.chemistry_config?.kind === "balance_equation" ||
      /balance the|half-equation|ionic equation/i.test(String(row?.prompt || ""));
    if (!looksBalance) continue;
    for (const k of balanceKeysFromQuestionRow(row)) keys.add(k);
  }
  return [...keys];
}

/**
 * Shuffle pool and take up to `count` balance entries not in excludeKeys.
 * Dedupes by equation signature (and id) within the run.
 */
export function selectUniqueBalanceEquations(entries, count, rng, excludeKeys = []) {
  const exclude = new Set((excludeKeys || []).map((k) => String(k || "").trim()).filter(Boolean));
  const seenSig = new Set();
  const pool = [];
  for (const entry of shuffle(entries || [], rng)) {
    if (!entry) continue;
    const sig = balanceEquationSignature(entry);
    const id = String(entry.id || "").trim();
    if (id && exclude.has(id)) continue;
    if (sig && exclude.has(sig)) continue;
    if (sig && seenSig.has(sig)) continue;
    if (sig) seenSig.add(sig);
    pool.push(entry);
  }
  const selected = pool.slice(0, Math.max(0, count));
  const shortfall = Math.max(0, count - selected.length);
  return { selected, shortfall, available: pool.length };
}

/** Convert a formula token for mhchem (charges → ^{n+}). */
export function formulaToMhchemToken(formula) {
  let s = String(formula || "");
  if (/\^\{/.test(s)) return s;
  s = s.replace(/(\d+)\+/g, "^{$1+}");
  s = s.replace(/(\d+)-/g, "^{$1-}");
  s = s.replace(/([A-Za-z])\+$/g, "$1^{+}");
  s = s.replace(/([A-Za-z0-9])-$/g, "$1^{-}");
  return s;
}

/** Inline mhchem for a single formula: $\ce{H2O}$. */
export function mhchemInline(formula) {
  return `$\\ce{${formulaToMhchemToken(formula)}}$`;
}

/** Full equation string (may already include coeffs) → mhchem. */
export function mhchemFromSymbolString(symbol) {
  const ce = String(symbol || "")
    .replace(/→/g, "->")
    .replace(/↔/g, "<->")
    .trim();
  return `$\\ce{${ce}}$`;
}

/** Unbalanced equation from balance-bank species (no coefficients). */
export function mhchemEquationFromSpecies(species, arrow = "->") {
  const fmt = (sp) => {
    if (sp.studentEntersFormula) return "?";
    let t = formulaToMhchemToken(sp.formula);
    if (sp.state) t += `(${sp.state})`;
    return t;
  };
  const list = Array.isArray(species) ? species : [];
  const left = list.filter((s) => s.side === "left").map(fmt);
  const right = list.filter((s) => s.side === "right").map(fmt);
  const arr = arrow === "->" ? "->" : arrow;
  return `$\\ce{${left.join(" + ")} ${arr} ${right.join(" + ")}}$`;
}

function balanceInstruction(subtype) {
  if (subtype === "ionic") {
    return "Write and balance the ionic equation for this displacement reaction. Enter any missing formula.";
  }
  if (subtype === "half") {
    return "Balance the half-equation. Add electrons where needed.";
  }
  return "Balance the following equation.";
}

// ─── RFM ────────────────────────────────────────────────────────────────────

function buildRfmPrompt(compound) {
  const arMap = arValuesForFormula(compound.formula);
  return (
    `Calculate the relative formula mass (Mr) of ${compound.name}, ${mhchemInline(compound.formula)}.\n\n` +
    `Relative atomic masses: ${formatArList(arMap)}`
  );
}

/** Worked method for RFM remedial / flashcard text. */
export function buildRfmWorkingText(compound, mr = null) {
  const counts = parseFormula(compound.formula);
  const answer = mr != null ? mr : relativeFormulaMass(compound.formula);
  const parts = Object.entries(counts).map(([el, n]) => {
    const ar = relativeAtomicMass(el);
    return n === 1 ? String(ar) : `(${n} × ${ar})`;
  });
  return (
    `Calculate Mr by adding the relative atomic masses:\n` +
    `${mhchemInline(compound.formula)}: ${parts.join(" + ")} = ${formatNumber(answer)}.`
  );
}

/** Worked method for conservation of mass remedial text. */
export function buildConservationWorkingText(reaction, unknown, masses) {
  const reactants = reaction.species.filter((s) => s.side === "reactant");
  const products = reaction.species.filter((s) => s.side === "product");
  const sumSide = (list) => list.reduce((s, sp) => s + (Number(masses[sp.id]) || 0), 0);
  const correct = Number(masses[unknown.id]);
  const lines = [
    "Use conservation of mass: total mass of reactants = total mass of products."
  ];

  if (unknown.side === "product") {
    const knownProducts = products.filter((s) => s.id !== unknown.id);
    const reactantTotal = sumSide(reactants);
    if (knownProducts.length) {
      const knownBits = knownProducts.map((s) => `${formatNumber(masses[s.id])} g (${s.name})`).join(" + ");
      lines.push(
        `Mass of ${unknown.name} = mass of reactants − mass of other products` +
        (knownBits ? `\n= ${formatNumber(reactantTotal)} − (${knownBits})` : `\n= ${formatNumber(reactantTotal)}`) +
        `\n= ${formatNumber(correct)} g.`
      );
    } else {
      const reactantBits = reactants.map((s) => `${formatNumber(masses[s.id])} g (${s.name})`).join(" + ");
      lines.push(
        `Mass of ${unknown.name} = ${reactantBits}\n= ${formatNumber(correct)} g.`
      );
    }
  } else {
    const knownReactants = reactants.filter((s) => s.id !== unknown.id);
    const productTotal = sumSide(products);
    if (knownReactants.length) {
      const knownBits = knownReactants.map((s) => `${formatNumber(masses[s.id])} g (${s.name})`).join(" + ");
      lines.push(
        `Mass of ${unknown.name} = mass of products − mass of other reactants` +
        `\n= ${formatNumber(productTotal)} − (${knownBits})` +
        `\n= ${formatNumber(correct)} g.`
      );
    } else {
      lines.push(`Mass of ${unknown.name} = ${formatNumber(productTotal)} g.`);
    }
  }
  return lines.join("\n");
}

function conservationSpeciesLabel(sp, form) {
  if (form === "symbol") return `${sp.name} (${mhchemInline(sp.id)})`;
  return sp.name;
}

/**
 * Narrative conservation stems, e.g.
 * "12 g of magnesium reacted with oxygen to produce 20 g of magnesium oxide.
 *  What mass of oxygen reacted?"
 */
export function buildConservationPrompt(reaction, unknown, masses, form) {
  const reactants = reaction.species.filter((s) => s.side === "reactant");
  const products = reaction.species.filter((s) => s.side === "product");
  const label = (sp) => conservationSpeciesLabel(sp, form);
  const massPhrase = (sp) => `${formatNumber(masses[sp.id])} g of ${label(sp)}`;
  const equationLine = form === "symbol"
    ? mhchemFromSymbolString(reaction.symbol)
    : reaction.word;

  let narrative = "";
  let question = "";

  if (reactants.length === 2 && products.length === 1) {
    const [r1, r2] = reactants;
    const [p] = products;
    if (unknown.id === p.id) {
      narrative = `${massPhrase(r1)} reacted with ${massPhrase(r2)} to produce ${label(p)}.`;
      question = `What mass of ${label(p)} was produced?`;
    } else if (unknown.id === r1.id) {
      narrative = `${label(r1)} reacted with ${massPhrase(r2)} to produce ${massPhrase(p)}.`;
      question = `What mass of ${label(r1)} reacted?`;
    } else {
      narrative = `${massPhrase(r1)} reacted with ${label(r2)} to produce ${massPhrase(p)}.`;
      question = `What mass of ${label(r2)} reacted?`;
    }
  } else if (reactants.length === 1 && products.length === 2) {
    const [r] = reactants;
    const [p1, p2] = products;
    if (unknown.id === r.id) {
      narrative = `${label(r)} produced ${massPhrase(p1)} and ${massPhrase(p2)}.`;
      question = `What mass of ${label(r)} reacted?`;
    } else if (unknown.id === p1.id) {
      narrative = `${massPhrase(r)} produced ${label(p1)} and ${massPhrase(p2)}.`;
      question = `What mass of ${label(p1)} was produced?`;
    } else {
      narrative = `${massPhrase(r)} produced ${massPhrase(p1)} and ${label(p2)}.`;
      question = `What mass of ${label(p2)} was produced?`;
    }
  } else if (reactants.length === 2 && products.length === 2) {
    const [r1, r2] = reactants;
    const [p1, p2] = products;
    const r1Text = unknown.id === r1.id ? label(r1) : massPhrase(r1);
    const r2Text = unknown.id === r2.id ? label(r2) : massPhrase(r2);
    const p1Text = unknown.id === p1.id ? label(p1) : massPhrase(p1);
    const p2Text = unknown.id === p2.id ? label(p2) : massPhrase(p2);
    narrative = `${r1Text} reacted with ${r2Text} to produce ${p1Text} and ${p2Text}.`;
    if (unknown.side === "reactant") {
      question = `What mass of ${label(unknown)} reacted?`;
    } else {
      question = `What mass of ${label(unknown)} was produced?`;
    }
  } else {
    const givenBits = reaction.species
      .filter((s) => s.id !== unknown.id)
      .map((s) => massPhrase(s))
      .join("; ");
    narrative = givenBits
      ? `In the reaction, ${givenBits}.`
      : `Consider the reaction below.`;
    question = unknown.side === "reactant"
      ? `What mass of ${label(unknown)} reacted?`
      : `What mass of ${label(unknown)} was produced?`;
  }

  return `${narrative}\n\n${question}\n\n${equationLine}`;
}

export function generateRfmPair(compound, spec, rng) {
  const meta = baseMeta(spec);
  const mr = relativeFormulaMass(compound.formula);
  const prompt = buildRfmPrompt(compound);
  const distractors = distractorFormulaMasses(compound.formula, { count: 3 }).map(formatNumber);
  const correct = formatNumber(mr);
  const options = shuffle([correct, ...distractors], rng);
  const working = buildRfmWorkingText(compound, mr);

  const mcq = {
    variant: { scenario: "rfm", format: "mcq", formula: compound.formula, name: compound.name },
    question: applySpecLinks({
      question_type: "mcq",
      prompt,
      options,
      marking_method: "keyword",
      max_marks: 1,
      demand_level: "low",
      command_word: "calculate",
      tier: meta.tier === "higher" ? "higher" : meta.tier === "foundation" ? "foundation" : "both",
      ao1_marks: 0,
      ao2_marks: 1,
      ao3_marks: 0,
      is_maths_skill: true,
      is_required_practical: false,
      audience: meta.audience,
      difficulty: 1
    }, meta),
    answer_key: {
      key_type: "mcq",
      key_payload: { correct, answer: correct }
    },
    mark_points: [
      {
        ao: "AO2",
        point_text: correct,
        feedback_if_missing: working,
        max_marks: 1
      }
    ],
    skill_codes: { ms: ["MS1a"], ws: ["WS4.3"] }
  };

  const shortText = {
    variant: { scenario: "rfm", format: "short_text", formula: compound.formula, name: compound.name },
    question: applySpecLinks({
      question_type: "short_text",
      prompt,
      marking_method: "keyword",
      max_marks: 1,
      demand_level: "standard",
      command_word: "calculate",
      tier: mcq.question.tier,
      ao1_marks: 0,
      ao2_marks: 1,
      ao3_marks: 0,
      is_maths_skill: true,
      is_required_practical: false,
      audience: meta.audience,
      difficulty: 2
    }, meta),
    answer_key: {
      key_type: "keywords",
      key_payload: {
        required: [correct],
        optional: [],
        min_optional: 0
      }
    },
    mark_points: [
      {
        ao: "AO2",
        point_text: correct,
        feedback_if_missing: working,
        max_marks: 1
      }
    ],
    skill_codes: { ms: ["MS1a"], ws: ["WS4.3"] }
  };

  return [
    finalizeDraft(mcq, spec, "rfm"),
    finalizeDraft(shortText, spec, "rfm")
  ];
}

// ─── Conservation of mass ───────────────────────────────────────────────────

function allocateConservingMasses(species, rng) {
  const reactants = species.filter((s) => s.side === "reactant");
  const products = species.filter((s) => s.side === "product");
  const masses = {};

  if (reactants.length === 1 && products.length >= 1) {
    // Thermal decomposition style: one reactant splits
    const total = 10 + Math.floor(rng() * 40) * 2; // even-ish
    masses[reactants[0].id] = total;
    let remaining = total;
    for (let i = 0; i < products.length - 1; i++) {
      const maxShare = Math.max(1, remaining - (products.length - 1 - i));
      const share = 1 + Math.floor(rng() * Math.max(1, Math.floor(maxShare / 2)));
      masses[products[i].id] = share;
      remaining -= share;
    }
    masses[products[products.length - 1].id] = remaining;
  } else {
    // Synthesis: reactants sum to product(s)
    let reactantTotal = 0;
    for (const r of reactants) {
      const m = 2 + Math.floor(rng() * 20);
      masses[r.id] = m;
      reactantTotal += m;
    }
    if (products.length === 1) {
      masses[products[0].id] = reactantTotal;
    } else {
      let remaining = reactantTotal;
      for (let i = 0; i < products.length - 1; i++) {
        const share = 1 + Math.floor(rng() * Math.max(1, Math.floor(remaining / 2)));
        masses[products[i].id] = share;
        remaining -= share;
      }
      masses[products[products.length - 1].id] = remaining;
    }
  }
  return masses;
}

function conservationDistractors(correct, givenMasses, rng) {
  const vals = Object.values(givenMasses);
  const sumAll = vals.reduce((a, b) => a + b, 0);
  const candidates = new Set([
    sumAll,
    Math.abs(vals[0] - (vals[1] || 0)),
    correct + 2,
    correct - 2,
    sumAll - correct
  ]);
  const out = [];
  for (const v of candidates) {
    if (!Number.isFinite(v) || v <= 0) continue;
    if (Math.abs(v - correct) < 1e-9) continue;
    if (!out.some((u) => Math.abs(u - v) < 1e-9)) out.push(v);
    if (out.length >= 3) break;
  }
  while (out.length < 3) {
    const v = correct + (out.length + 1) * 3;
    if (!out.some((u) => Math.abs(u - v) < 1e-9)) out.push(v);
  }
  return shuffle(out, rng).slice(0, 3);
}

export function generateConservationPair(reaction, spec, rng) {
  const meta = baseMeta(spec);
  const form = spec.equation_form === "symbol" ? "symbol" : spec.equation_form === "word" ? "word" : (rng() < 0.5 ? "word" : "symbol");
  const masses = allocateConservingMasses(reaction.species, rng);
  const unknownId = pick(rng, reaction.unknown_candidates || reaction.species.map((s) => s.id));
  const unknown = reaction.species.find((s) => s.id === unknownId) || reaction.species[0];
  const correct = masses[unknown.id];
  const givenMasses = { ...masses };
  delete givenMasses[unknown.id];

  const prompt = buildConservationPrompt(reaction, unknown, masses, form);

  const correctStr = formatNumber(correct);
  const distractors = conservationDistractors(correct, givenMasses, rng).map(formatNumber);
  const options = shuffle([correctStr, ...distractors], rng);
  const working = buildConservationWorkingText(reaction, unknown, masses);

  const mcq = {
    variant: { scenario: "conservation", format: "mcq", equation_form: form },
    question: applySpecLinks({
      question_type: "mcq",
      prompt,
      options,
      marking_method: "keyword",
      max_marks: 1,
      demand_level: "low",
      command_word: "calculate",
      tier: meta.tier === "higher" ? "higher" : meta.tier === "foundation" ? "foundation" : "both",
      ao1_marks: 0,
      ao2_marks: 1,
      ao3_marks: 0,
      is_maths_skill: true,
      is_required_practical: false,
      audience: meta.audience,
      difficulty: 1
    }, meta),
    answer_key: {
      key_type: "mcq",
      key_payload: { correct: correctStr, answer: correctStr }
    },
    mark_points: [
      {
        ao: "AO2",
        point_text: correctStr,
        feedback_if_missing: working,
        max_marks: 1
      }
    ],
    skill_codes: { ms: ["MS1a"], ws: ["WS4.3"] }
  };

  const shortText = {
    variant: { scenario: "conservation", format: "short_text", equation_form: form },
    question: applySpecLinks({
      question_type: "short_text",
      prompt,
      marking_method: "keyword",
      max_marks: 1,
      demand_level: "standard",
      command_word: "calculate",
      tier: mcq.question.tier,
      ao1_marks: 0,
      ao2_marks: 1,
      ao3_marks: 0,
      is_maths_skill: true,
      is_required_practical: false,
      audience: meta.audience,
      difficulty: 2
    }, meta),
    answer_key: {
      key_type: "keywords",
      key_payload: {
        required: [correctStr],
        optional: [],
        min_optional: 0
      }
    },
    mark_points: [
      {
        ao: "AO2",
        point_text: correctStr,
        feedback_if_missing: working,
        max_marks: 1
      }
    ],
    skill_codes: { ms: ["MS1a"], ws: ["WS4.3"] }
  };

  return [
    finalizeDraft(mcq, spec, "conservation"),
    finalizeDraft(shortText, spec, "conservation")
  ];
}

// ─── Percentage by mass ─────────────────────────────────────────────────────

export function generatePercentByMassDraft(compound, spec, rng) {
  const meta = baseMeta(spec);
  const focusOptions = compound.focus_elements?.length
    ? compound.focus_elements
    : Object.keys(parseFormula(compound.formula));
  const element = spec.focus_element && focusOptions.includes(spec.focus_element)
    ? spec.focus_element
    : pick(rng, focusOptions);

  const mr = relativeFormulaMass(compound.formula);
  const elemMass = elementMassInCompound(compound.formula, element);
  const pct = percentByMass(compound.formula, element, mr);
  const arMap = arValuesForFormula(compound.formula);
  const answer = roundNice(pct);

  const prompt =
    `Calculate the percentage by mass of ${element} in ${compound.name}, ${mhchemInline(compound.formula)}.\n\n` +
    `Relative atomic masses: ${formatArList(arMap)}\n` +
    `Relative formula mass (Mr) of ${mhchemInline(compound.formula)} = ${formatNumber(mr)}\n\n` +
    `Give your answer as a percentage.`;

  const calcConfig = {
    marking_mode: "percent_by_mass",
    equation_given: false,
    unit: "%",
    max_marks: 3,
    compound_formula: compound.formula,
    focus_element: element,
    mr,
    steps: [
      {
        type: "element_mass",
        marks: 1,
        ao: "AO2",
        required: true,
        answer: elemMass,
        tolerance: 0.05,
        label: `Mass of ${element} in the formula`
      },
      {
        type: "mass_ratio",
        marks: 1,
        ao: "AO2",
        required: true,
        numerator: elemMass,
        denominator: mr,
        label: "Mass of element ÷ Mr"
      },
      {
        type: "calculate",
        marks: 1,
        ao: "AO2",
        required: true,
        answer,
        unit: "%"
      }
    ]
  };

  const draft = {
    variant: { scenario: "percent_by_mass", formula: compound.formula, name: compound.name, element },
    question: applySpecLinks({
      question_type: "numeric",
      prompt,
      marking_method: "numeric",
      max_marks: 3,
      demand_level: "standard",
      command_word: "calculate",
      tier: meta.tier === "higher" ? "higher" : meta.tier === "foundation" ? "foundation" : "both",
      ao1_marks: 0,
      ao2_marks: 3,
      ao3_marks: 0,
      is_maths_skill: true,
      is_required_practical: false,
      audience: meta.audience,
      difficulty: 2,
      calculation_config: calcConfig
    }, meta),
    answer_key: {
      key_type: "numeric",
      key_payload: {
        answer,
        exact_answer: answer,
        tolerance: 0.5,
        unit: "%"
      }
    },
    mark_points: [],
    skill_codes: { ms: ["MS1a", "MS1c"], ws: ["WS4.3"] }
  };

  return finalizeDraft(draft, spec, "percent_by_mass");
}

// ─── Concentration ──────────────────────────────────────────────────────────

function niceConcentrationTriplet(rng) {
  // Prefer clean numbers: volume cm³ that divides 1000, mass that gives integer or 1 d.p. c
  const volumes = [25, 50, 100, 200, 250, 500];
  const Vcm3 = pick(rng, volumes);
  const Vdm3 = Vcm3 / 1000;
  const concentrations = [8, 10, 16, 20, 32, 40, 50, 64, 80, 100];
  const c = pick(rng, concentrations);
  const m = roundNice(c * Vdm3);
  return { m, Vcm3, Vdm3, c };
}

/** AQA-style near-miss answers for find-c (g/dm³). */
export function concentrationFindCNearMisses(m, Vcm3) {
  const Vdm3 = Vcm3 / 1000;
  const correct = m / Vdm3;
  const perCm3 = m / Vcm3;
  const set = new Set([
    perCm3,
    perCm3 * 10,
    perCm3 * 100,
    correct / 10,
    correct / 100,
    correct / 1000,
    m / (Vcm3 * 1000),
    (m / Vcm3) * 100
  ]);
  return [...set]
    .map(roundNearMiss)
    .filter((v) => Number.isFinite(v) && v > 0 && Math.abs(v - correct) > 1e-9)
    .slice(0, 8);
}

/** Near-misses for find-m (mass in g). */
export function concentrationFindMNearMisses(c, Vcm3) {
  const Vdm3 = Vcm3 / 1000;
  const correct = c * Vdm3;
  const set = new Set([
    c * Vcm3,
    c / Vcm3,
    c * (Vcm3 / 100),
    correct * 10,
    correct / 10,
    correct * 1000,
    c * (Vcm3 / 10)
  ]);
  return [...set]
    .map(roundNearMiss)
    .filter((v) => Number.isFinite(v) && v > 0 && Math.abs(v - correct) > 1e-9)
    .slice(0, 8);
}

function buildFindCPaths(m, Vcm3, c) {
  const Vdm3 = Vcm3 / 1000;
  const scale = 1000 / Vcm3;
  const perCm3 = m / Vcm3;
  return [
    {
      id: "convert_volume",
      label: "Convert volume to dm³, then c = m/V",
      steps: [
        { id: "s1", marks: 1, accept: [{ value: Vdm3 }, { op: "div", values: [Vcm3, 1000] }] },
        { id: "s2", marks: 1, accept: [{ value: c }, { op: "div", values: [m, Vdm3] }], ecf_from: "s1" },
        { id: "s3", marks: 1, accept: [{ value: c }], ecf_from: "s2" }
      ]
    },
    {
      id: "per_cm3_then_scale",
      label: "m/V in cm³, then ×1000",
      steps: [
        { id: "s1", marks: 1, accept: [{ value: perCm3 }, { op: "div", values: [m, Vcm3] }] },
        { id: "s2", marks: 1, accept: [{ value: c }, { op: "mul", values: [perCm3, 1000] }], ecf_from: "s1" },
        { id: "s3", marks: 1, accept: [{ value: c }], ecf_from: "s2" }
      ]
    },
    {
      id: "scale_factor",
      label: "1000/V then × mass",
      steps: [
        { id: "s1", marks: 1, accept: [{ value: scale }, { op: "div", values: [1000, Vcm3] }] },
        { id: "s2", marks: 1, accept: [{ value: c }, { op: "mul", values: [scale, m] }], ecf_from: "s1" },
        { id: "s3", marks: 1, accept: [{ value: c }], ecf_from: "s2" }
      ]
    }
  ];
}

function buildFindMPaths(c, Vcm3, m) {
  const Vdm3 = Vcm3 / 1000;
  return [
    {
      id: "convert_volume",
      label: "Convert volume to dm³, then m = c × V",
      steps: [
        { id: "s1", marks: 1, accept: [{ value: Vdm3 }, { op: "div", values: [Vcm3, 1000] }] },
        { id: "s2", marks: 1, accept: [{ value: m }, { op: "mul", values: [c, Vdm3] }], ecf_from: "s1" },
        { id: "s3", marks: 1, accept: [{ value: m }], ecf_from: "s2" }
      ]
    },
    {
      id: "scale_factor",
      label: "Fraction of 1 dm³ × concentration",
      steps: [
        { id: "s1", marks: 1, accept: [{ value: Vdm3 }, { op: "div", values: [Vcm3, 1000] }] },
        { id: "s2", marks: 1, accept: [{ value: m }, { op: "mul", values: [c, Vdm3] }] },
        { id: "s3", marks: 1, accept: [{ value: m }], ecf_from: "s2" }
      ]
    },
    {
      id: "cm3_form",
      label: "c × (V/1000)",
      steps: [
        { id: "s1", marks: 1, accept: [{ value: Vdm3 }, { op: "div", values: [Vcm3, 1000] }] },
        { id: "s2", marks: 1, accept: [{ value: m }, { op: "mul", values: [c, Vdm3] }] },
        { id: "s3", marks: 1, accept: [{ value: m }], ecf_from: "s2" }
      ]
    }
  ];
}

function multiPathCalcConfig({ unit, answer, bands2, paths }) {
  const primary = paths?.[0];
  const findMass = unit === "g";
  return {
    marking_mode: "multi_path",
    equation_given: false,
    unit,
    max_marks: 3,
    // Correct final alone still awards 3 (alternative methods); near-miss finals → 2
    answer_bands: [
      { marks: 3, accept: [{ value: answer }] },
      { marks: 2, accept: bands2.map((v) => ({ value: v })) }
    ],
    paths,
    answer,
    primary_path_id: primary?.id || null,
    scaffold: "convert_volume",
    steps: [
      {
        type: "working_1",
        marks: 1,
        ao: "AO2",
        required: true,
        label: "Convert volume to dm³",
        placeholder: "e.g. 0.2",
        reveal_from_path_step: "s1"
      },
      {
        type: "working_2",
        marks: 1,
        ao: "AO2",
        required: true,
        label: findMass ? "Calculate mass" : "Calculate concentration",
        placeholder: findMass ? "e.g. 3.2x.05 or 0.16" : "e.g. 12.8/0.2 or 64",
        reveal_from_path_step: "s2"
      },
      {
        type: "calculate",
        marks: 1,
        ao: "AO2",
        required: true,
        answer,
        unit,
        label: findMass ? "Final mass (g)" : "Final concentration (g/dm³)"
      }
    ]
  };
}

/** Method cues for the practice hints panel (XP reduced when revealed). */
function concentrationMethodHints(findMass) {
  return [
    "Convert volume to dm³: calculate cm³ ÷ 1000.",
    findMass
      ? "Calculate mass: concentration × volume in dm³."
      : "Calculate concentration: mass ÷ volume in dm³."
  ];
}

export function generateConcentrationFindCDraft(spec, rng) {
  const meta = baseMeta(spec);
  const { m, Vcm3, c } = niceConcentrationTriplet(rng);
  const near = concentrationFindCNearMisses(m, Vcm3);
  const prompt =
    `A solution contains ${formatNumber(m)} g of solute dissolved in ${Vcm3} cm³ of solution.\n\n` +
    `Calculate the concentration of the solution in g/dm³.`;

  const calcConfig = multiPathCalcConfig({
    unit: "g/dm³",
    answer: c,
    bands2: near,
    paths: buildFindCPaths(m, Vcm3, c)
  });

  const draft = {
    variant: { scenario: "concentration_find_c", m, Vcm3, c },
    question: applySpecLinks({
      question_type: "numeric",
      prompt,
      marking_method: "numeric",
      max_marks: 3,
      demand_level: "standard_45",
      command_word: "calculate",
      tier: meta.tier === "higher" ? "higher" : meta.tier === "foundation" ? "foundation" : "both",
      ao1_marks: 0,
      ao2_marks: 3,
      ao3_marks: 0,
      is_maths_skill: true,
      is_required_practical: false,
      audience: meta.audience,
      difficulty: 3,
      calculation_config: calcConfig,
      hints: concentrationMethodHints(false)
    }, meta),
    answer_key: {
      key_type: "numeric",
      key_payload: {
        answer: c,
        exact_answer: c,
        tolerance: 0.05,
        unit: "g/dm³"
      }
    },
    mark_points: [],
    skill_codes: { ms: ["MS1a", "MS1c", "MS3c"], ws: [] }
  };
  return finalizeDraft(draft, spec, "concentration_find_c");
}

export function generateConcentrationFindMDraft(spec, rng) {
  const meta = baseMeta(spec);
  const { m, Vcm3, c } = niceConcentrationTriplet(rng);
  const near = concentrationFindMNearMisses(c, Vcm3);
  const prompt =
    `A solution has a concentration of ${formatNumber(c)} g/dm³.\n\n` +
    `Calculate the mass of solute in ${Vcm3} cm³ of this solution.\n\n` +
    `Give your answer in grams.`;

  const calcConfig = multiPathCalcConfig({
    unit: "g",
    answer: m,
    bands2: near,
    paths: buildFindMPaths(c, Vcm3, m)
  });

  const draft = {
    variant: { scenario: "concentration_find_m", m, Vcm3, c },
    question: applySpecLinks({
      question_type: "numeric",
      prompt,
      marking_method: "numeric",
      max_marks: 3,
      demand_level: "standard_45",
      command_word: "calculate",
      tier: meta.tier === "higher" ? "higher" : meta.tier === "foundation" ? "foundation" : "both",
      ao1_marks: 0,
      ao2_marks: 3,
      ao3_marks: 0,
      is_maths_skill: true,
      is_required_practical: false,
      audience: meta.audience,
      difficulty: 3,
      calculation_config: calcConfig,
      hints: concentrationMethodHints(true)
    }, meta),
    answer_key: {
      key_type: "numeric",
      key_payload: {
        answer: m,
        exact_answer: m,
        tolerance: 0.05,
        unit: "g"
      }
    },
    mark_points: [],
    skill_codes: { ms: ["MS1a", "MS1c", "MS3c", "MS3b"], ws: [] }
  };
  return finalizeDraft(draft, spec, "concentration_find_m");
}

// ─── Balancing ──────────────────────────────────────────────────────────────

export function generateBalanceDraft(entry, spec) {
  const meta = baseMeta(spec);
  const maxMarks = entry.max_marks || 1;
  const subtype = entry.subtype || "symbol";
  const equationCe = mhchemEquationFromSpecies(entry.species, "->");
  const signature = balanceEquationSignature(entry);
  const prompt = `${entry.prompt || balanceInstruction(subtype)}\n\n${equationCe}`;

  const chemistry_config = {
    kind: "balance_equation",
    template: {
      subtype,
      arrow: "->",
      species: entry.species,
      allowedTokens: entry.allowedTokens
    },
    answer: {
      kind: "balance_equation",
      coeffs: entry.coeffs,
      extraSpecies: entry.extraSpecies || [],
      species: entry.species
    }
  };

  const draft = {
    variant: {
      scenario: "balance",
      id: entry.id,
      subtype,
      category: entry.category || null,
      signature
    },
    question: applySpecLinks({
      question_type: "chemistry_interactive",
      prompt,
      marking_method: "chemistry",
      max_marks: maxMarks,
      demand_level: subtype === "half" || subtype === "ionic" ? "standard_45" : "standard",
      command_word: "balance",
      tier: subtype === "half" || subtype === "ionic"
        ? "higher"
        : (meta.tier === "higher" ? "higher" : meta.tier === "foundation" ? "foundation" : "both"),
      ao1_marks: maxMarks,
      ao2_marks: 0,
      ao3_marks: 0,
      is_maths_skill: false,
      is_required_practical: false,
      audience: meta.audience,
      difficulty: subtype === "half" || subtype === "ionic" ? 3 : 2,
      chemistry_config
    }, meta),
    answer_key: {
      key_type: "chemistry",
      key_payload: chemistry_config.answer
    },
    mark_points: [],
    skill_codes: { ms: [], ws: ["WS4.3"] }
  };
  return finalizeDraft(draft, spec, "balance");
}

// ─── Batch orchestration ────────────────────────────────────────────────────

/**
 * @param {object} spec
 * @param {string} spec.scenario - rfm | conservation | percent_by_mass | concentration_find_c | concentration_find_m | balance
 * @param {number} [spec.count]
 * @param {number} [spec.seed]
 * @param {string[]} [spec.excludeFormulas] - formulas already in the bank (RFM / % mass)
 * @param {string[]} [spec.excludeBalanceKeys] - equation signatures/ids already in the bank
 */
export function generateChemBatch(spec = {}) {
  const scenario = String(spec.scenario || "rfm");
  const count = Math.max(1, parseInt(spec.count, 10) || 5);
  const seed = spec.seed != null ? Number(spec.seed) : Date.now() % 1e9;
  const rng = mulberry32(seed);
  const drafts = [];
  const errors = [];
  const excludeFormulas = Array.isArray(spec.excludeFormulas) ? spec.excludeFormulas : [];
  const excludeBalanceKeys = Array.isArray(spec.excludeBalanceKeys) ? spec.excludeBalanceKeys : [];

  const compounds = listCompounds();
  const reactions = listConservationReactions();
  const balances = listBalanceEquations().filter((e) => {
    if (!spec.balance_subtype) return true;
    return e.subtype === spec.balance_subtype;
  });

  if (scenario === "rfm" || scenario === "percent_by_mass") {
    const { selected, shortfall, available } = selectUniqueCompounds(
      compounds,
      count,
      rng,
      excludeFormulas
    );
    if (shortfall > 0) {
      errors.push({
        index: null,
        message:
          `Only ${available} unused compound(s) available` +
          (excludeFormulas.length ? ` after excluding ${excludeFormulas.length} already in the bank` : "") +
          `; requested ${count}. Generated ${selected.length}.`
      });
    }
    selected.forEach((compound, i) => {
      try {
        if (scenario === "rfm") {
          drafts.push(...generateRfmPair(compound, { ...spec, seed }, rng));
        } else {
          drafts.push(generatePercentByMassDraft(compound, { ...spec, seed }, rng));
        }
      } catch (err) {
        errors.push({ index: i, message: err?.message || String(err) });
      }
    });
    return { drafts, errors, seed, scenario };
  }

  if (scenario === "balance") {
    if (!balances.length) {
      errors.push({ index: null, message: "No balance equations for subtype filter" });
      return { drafts, errors, seed, scenario };
    }
    const { selected, shortfall, available } = selectUniqueBalanceEquations(
      balances,
      count,
      rng,
      excludeBalanceKeys
    );
    if (shortfall > 0) {
      errors.push({
        index: null,
        message:
          `Only ${available} unused equation(s) available` +
          (excludeBalanceKeys.length ? ` after excluding ${excludeBalanceKeys.length} already in the bank` : "") +
          `; requested ${count}. Generated ${selected.length}.`
      });
    }
    selected.forEach((entry, i) => {
      try {
        drafts.push(generateBalanceDraft(entry, { ...spec, seed }));
      } catch (err) {
        errors.push({ index: i, message: err?.message || String(err) });
      }
    });
    return { drafts, errors, seed, scenario };
  }

  for (let i = 0; i < count; i++) {
    try {
      if (scenario === "conservation") {
        const reaction = pick(rng, reactions);
        drafts.push(...generateConservationPair(reaction, { ...spec, seed }, rng));
      } else if (scenario === "concentration_find_c") {
        drafts.push(generateConcentrationFindCDraft({ ...spec, seed }, rng));
      } else if (scenario === "concentration_find_m") {
        drafts.push(generateConcentrationFindMDraft({ ...spec, seed }, rng));
      } else {
        throw new Error(`Unknown scenario: ${scenario}`);
      }
    } catch (err) {
      errors.push({ index: i, message: err?.message || String(err) });
    }
  }

  return { drafts, errors, seed, scenario };
}

export function summarizeChemDraft(draft) {
  const v = draft?.variant || {};
  const parts = [
    v.scenario || "?",
    v.format || v.element || v.subtype || "",
    v.id || v.formula || ""
  ].filter(Boolean);
  return parts.join(" / ");
}
