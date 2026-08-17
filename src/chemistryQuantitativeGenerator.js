/**
 * Batch generators for AQA chemistry quantitative questions.
 * Scenarios: RFM, conservation, % by mass, concentration, balance,
 * HT moles↔mass, Avogadro, reacting masses, balance from masses, limiting reactant.
 * No chemistry equation sheets — numeric configs are custom calculation_config only.
 */

import {
  relativeFormulaMass,
  elementMassInCompound,
  percentByMass,
  arValuesForFormula,
  distractorFormulaMasses,
  formatArStem,
  formatMrStem,
  parseFormula,
  relativeAtomicMass,
  scaleByMoleRatio,
  identifyLimitingReactant,
  AVOGADRO_CONSTANT,
  particleKind,
  particlesFromMoles
} from "./chemistryFormula.js";

import compoundsData from "../data/chemistry/compounds.json" with { type: "json" };
import reactionsData from "../data/chemistry/conservation_reactions.json" with { type: "json" };
import balanceData from "../data/chemistry/balance_equations.json" with { type: "json" };
import stoichData from "../data/chemistry/stoichiometry_reactions.json" with { type: "json" };
import { normalizeQuestionTierForDb } from "./sciencePath.js";

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

function dbTier(tier) {
  return normalizeQuestionTierForDb(tier);
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

export function listStoichReactions(useFor = null) {
  const all = stoichData.reactions || [];
  if (!useFor) return all;
  return all.filter((r) => (r.use_for || []).includes(useFor));
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
  if (scenario === "moles_find_n") return "%number of moles in%";
  if (scenario === "moles_find_m") return "%mass of%that contains%";
  if (scenario === "avogadro_find_N") return "%in % mol of%";
  if (scenario === "avogadro_find_n") return "%contains%number of moles of%";
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
    formatArStem(arMap)
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
      tier: dbTier(meta.tier),
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
      tier: dbTier(meta.tier),
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
    `${formatArStem(arMap)}\n` +
    `${formatMrStem([{ formulaDisplay: mhchemInline(compound.formula), mr: formatNumber(mr) }])}\n\n` +
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
      tier: dbTier(meta.tier),
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
      tier: dbTier(meta.tier),
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
      tier: dbTier(meta.tier),
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
        ? dbTier("higher")
        : dbTier(meta.tier),
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

// ─── HT mole / stoichiometry helpers ────────────────────────────────────────

const NICE_MOLES = [0.1, 0.2, 0.25, 0.4, 0.5, 0.8, 1, 1.5, 2, 2.5, 3, 4, 5, 10];
const HT_SKILLS = { ms: ["MS1a", "MS1c", "MS3b"], ws: ["WS4.3"] };

function htQuestionMeta(spec) {
  const meta = baseMeta(spec);
  return { ...meta, tier: "higher" };
}

function stoichSpeciesSide(sp) {
  const s = String(sp?.side || "");
  if (s === "left" || s === "reactant") return "reactant";
  return "product";
}

function enrichStoichSpecies(species) {
  return (species || []).map((sp) => ({
    ...sp,
    mr: relativeFormulaMass(sp.formula)
  }));
}

function arValuesForSpeciesList(species) {
  const out = {};
  for (const sp of species || []) {
    Object.assign(out, arValuesForFormula(sp.formula));
  }
  return out;
}

function formatMrList(species) {
  return formatMrStem(
    (species || []).map((sp) => ({
      formulaDisplay: mhchemInline(sp.formula),
      mr: formatNumber(sp.mr ?? relativeFormulaMass(sp.formula))
    }))
  );
}

/** Balanced mhchem from stoich species that include coeffs. */
export function mhchemBalancedFromStoich(species, arrow = "->") {
  const fmt = (sp) => {
    const coeff = Number(sp.coeff) || 1;
    const prefix = coeff === 1 ? "" : String(coeff);
    return `${prefix}${formulaToMhchemToken(sp.formula)}`;
  };
  const list = Array.isArray(species) ? species : [];
  const left = list.filter((s) => stoichSpeciesSide(s) === "reactant").map(fmt);
  const right = list.filter((s) => stoichSpeciesSide(s) === "product").map(fmt);
  return `$\\ce{${left.join(" + ")} ${arrow} ${right.join(" + ")}}$`;
}

export function mhchemUnbalancedFromStoich(species, arrow = "->") {
  const fmt = (sp) => formulaToMhchemToken(sp.formula);
  const list = Array.isArray(species) ? species : [];
  const left = list.filter((s) => stoichSpeciesSide(s) === "reactant").map(fmt);
  const right = list.filter((s) => stoichSpeciesSide(s) === "product").map(fmt);
  return `$\\ce{${left.join(" + ")} ${arrow} ${right.join(" + ")}}$`;
}

function isNiceNumber(n) {
  if (!Number.isFinite(n)) return false;
  const r = roundNice(n);
  return Math.abs(r - n) < 1e-9;
}

function pickNiceMolesForMr(rng, mr) {
  for (const n of shuffle(NICE_MOLES, rng)) {
    const m = n * mr;
    if (isNiceNumber(m)) return { n, m: roundNice(m) };
  }
  return { n: 1, m: roundNice(mr) };
}

export function selectUniqueStoichReactions(reactions, count, rng, excludeIds = []) {
  const exclude = new Set((excludeIds || []).map((k) => String(k || "").trim()).filter(Boolean));
  const seen = new Set();
  const pool = [];
  for (const entry of shuffle(reactions || [], rng)) {
    if (!entry) continue;
    const id = String(entry.id || "").trim();
    if (id && (exclude.has(id) || seen.has(id))) continue;
    if (id) seen.add(id);
    pool.push(entry);
  }
  const selected = pool.slice(0, Math.max(0, count));
  const shortfall = Math.max(0, count - selected.length);
  return { selected, shortfall, available: pool.length };
}

function htNumericDraft({ spec, scenario, variant, prompt, maxMarks, unit, answer, calcConfig, hints, commandWord = "calculate", skillCodes, tolerance = 0.05, demandLevel = "standard_45", difficulty = 3 }) {
  const meta = htQuestionMeta(spec);
  const draft = {
    variant,
    question: applySpecLinks({
      question_type: "numeric",
      prompt,
      marking_method: "numeric",
      max_marks: maxMarks,
      demand_level: demandLevel,
      command_word: commandWord,
      tier: dbTier("higher"),
      ao1_marks: 0,
      ao2_marks: maxMarks,
      ao3_marks: 0,
      is_maths_skill: true,
      is_required_practical: false,
      audience: meta.audience,
      difficulty,
      calculation_config: calcConfig,
      ...(hints ? { hints } : {})
    }, meta),
    answer_key: {
      key_type: "numeric",
      key_payload: {
        answer,
        exact_answer: answer,
        tolerance,
        unit
      }
    },
    mark_points: [],
    skill_codes: skillCodes || (scenario === "moles_find_n" || scenario === "moles_find_m"
      ? { ms: ["MS1a", "MS1c"], ws: ["WS4.3"] }
      : HT_SKILLS)
  };
  return finalizeDraft(draft, spec, scenario);
}

// ─── 1) Moles ↔ mass ────────────────────────────────────────────────────────

export function generateMolesFindNDraft(compound, spec, rng) {
  const mr = relativeFormulaMass(compound.formula);
  const { n, m } = pickNiceMolesForMr(rng, mr);
  const arMap = arValuesForFormula(compound.formula);
  const prompt =
    `Calculate the number of moles in ${formatNumber(m)} g of ${compound.name}, ${mhchemInline(compound.formula)}.\n\n` +
    `${formatArStem(arMap)}\n` +
    formatMrStem([{ formulaDisplay: mhchemInline(compound.formula), mr: formatNumber(mr) }]);

  const calcConfig = {
    marking_mode: "moles_mass",
    equation_given: false,
    unit: "mol",
    max_marks: 2,
    answer: n,
    steps: [
      {
        type: "insert_values",
        marks: 1,
        ao: "AO2",
        required: true,
        op: "div",
        lhs: "n",
        label: "Substitute into n = mass ÷ Mr",
        left: { value: m },
        right: { value: mr }
      },
      {
        type: "calculate",
        marks: 1,
        ao: "AO2",
        required: true,
        answer: n,
        unit: "mol",
        label: "Number of moles"
      }
    ]
  };

  return htNumericDraft({
    spec,
    scenario: "moles_find_n",
    variant: { scenario: "moles_find_n", formula: compound.formula, name: compound.name, m, n, mr },
    prompt,
    maxMarks: 2,
    unit: "mol",
    answer: n,
    calcConfig,
    hints: [
      "Recall: number of moles = mass ÷ relative formula mass (Mr).",
      "Substitute the mass and Mr from the question, then calculate."
    ]
  });
}

export function generateMolesFindMDraft(compound, spec, rng) {
  const mr = relativeFormulaMass(compound.formula);
  const { n, m } = pickNiceMolesForMr(rng, mr);
  const arMap = arValuesForFormula(compound.formula);
  const prompt =
    `Calculate the mass of ${compound.name}, ${mhchemInline(compound.formula)}, that contains ${formatNumber(n)} mol of the substance.\n\n` +
    `Give your answer in grams.\n\n` +
    `${formatArStem(arMap)}\n` +
    formatMrStem([{ formulaDisplay: mhchemInline(compound.formula), mr: formatNumber(mr) }]);

  const calcConfig = {
    marking_mode: "moles_mass",
    equation_given: false,
    unit: "g",
    max_marks: 2,
    answer: m,
    steps: [
      {
        type: "insert_values",
        marks: 1,
        ao: "AO2",
        required: true,
        op: "mul",
        lhs: "m",
        label: "Substitute into m = n × Mr",
        left: { value: n },
        right: { value: mr }
      },
      {
        type: "calculate",
        marks: 1,
        ao: "AO2",
        required: true,
        answer: m,
        unit: "g",
        label: "Mass (g)"
      }
    ]
  };

  return htNumericDraft({
    spec,
    scenario: "moles_find_m",
    variant: { scenario: "moles_find_m", formula: compound.formula, name: compound.name, m, n, mr },
    prompt,
    maxMarks: 2,
    unit: "g",
    answer: m,
    calcConfig,
    hints: [
      "Recall: mass = number of moles × relative formula mass (Mr).",
      "Substitute the moles and Mr from the question, then calculate."
    ]
  });
}

// ─── Avogadro constant (particles ↔ moles) ──────────────────────────────────

const NICE_AVOGADRO_MOLES = [0.1, 0.2, 0.25, 0.5, 1, 2, 3, 4, 5, 10];
const AVOGADRO_SKIP_FORMULAS = new Set(["SiO2"]);
const AVOGADRO_EXTRA_SPECIES = [
  { formula: "Mg", name: "magnesium" },
  { formula: "Na", name: "sodium" },
  { formula: "Fe", name: "iron" },
  { formula: "Cu", name: "copper" },
  { formula: "Zn", name: "zinc" },
  { formula: "Al", name: "aluminium" },
  { formula: "C", name: "carbon" },
  { formula: "S", name: "sulfur" },
  { formula: "H2", name: "hydrogen" },
  { formula: "O2", name: "oxygen" },
  { formula: "N2", name: "nitrogen" },
  { formula: "Cl2", name: "chlorine" }
];

export function listAvogadroSpecies() {
  const seen = new Set();
  const out = [];
  for (const c of [...listCompounds(), ...AVOGADRO_EXTRA_SPECIES]) {
    const key = normalizeFormulaKey(c?.formula);
    if (!key || seen.has(key) || AVOGADRO_SKIP_FORMULAS.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function formatStandardFormLatex(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return String(value);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const exp = Math.floor(Math.log10(abs));
  const mant = abs / (10 ** exp);
  return `$${sign}${parseFloat(mant.toPrecision(4))} \\times 10^{${exp}}$`;
}

function avogadroSigFigsCount(spec) {
  if (!spec?.sig_figs) return 0;
  return Math.max(1, parseInt(spec.sig_figs_count, 10) || 2);
}

function avogadroSkillCodes({ findMoles, sigFigs }) {
  const ms = ["MS1a", "MS1b", "MS3a"];
  if (findMoles) ms.push("MS3b");
  if (sigFigs) ms.push("MS2a");
  return { ms, ws: ["WS4.3"] };
}

function avogadroPromptTail({ standardForm, sigFigsN }) {
  let text = `\n\nThe Avogadro constant is $6.02 \\times 10^{23}$ per mole.`;
  if (standardForm) text += `\n\nGive your answer in standard form.`;
  if (sigFigsN > 0) text += `\n\nGive your answer to ${sigFigsN} significant figures.`;
  return text;
}

function withAvogadroSigFigsStep(steps, sigFigsN) {
  if (!(sigFigsN > 0)) return steps;
  return [
    ...steps,
    {
      type: "sig_figs",
      marks: 1,
      ao: "AO2",
      required: true,
      sig_figs: sigFigsN,
      enforce_on_final: true
    }
  ];
}

export function generateAvogadroFindParticlesDraft(compound, spec, rng) {
  const n = pick(rng, NICE_AVOGADRO_MOLES);
  const N = particlesFromMoles(n);
  const { noun } = particleKind(compound.formula);
  const sigFigsN = avogadroSigFigsCount(spec);
  const maxMarks = sigFigsN > 0 ? 3 : 2;
  const prompt =
    `Calculate the number of ${noun} in ${formatNumber(n)} mol of ${compound.name}, ${mhchemInline(compound.formula)}.` +
    avogadroPromptTail({ standardForm: true, sigFigsN });

  const calcConfig = {
    marking_mode: "moles_mass",
    equation_given: false,
    unit: noun,
    max_marks: maxMarks,
    answer: N,
    steps: withAvogadroSigFigsStep([
      {
        type: "insert_values",
        marks: 1,
        ao: "AO2",
        required: true,
        op: "mul",
        lhs: "N",
        standard_form: true,
        label: "Substitute into number of particles = moles × Avogadro constant",
        left: { value: n },
        right: { value: AVOGADRO_CONSTANT }
      },
      {
        type: "calculate",
        marks: 1,
        ao: "AO2",
        required: true,
        answer: N,
        unit: noun,
        label: `Number of ${noun}`
      }
    ], sigFigsN)
  };

  return htNumericDraft({
    spec,
    scenario: "avogadro_find_N",
    variant: {
      scenario: "avogadro_find_N",
      formula: compound.formula,
      name: compound.name,
      n,
      N,
      noun,
      sig_figs: sigFigsN || null
    },
    prompt,
    maxMarks,
    unit: noun,
    answer: N,
    calcConfig,
    skillCodes: avogadroSkillCodes({ findMoles: false, sigFigs: sigFigsN > 0 }),
    tolerance: 0,
    hints: [
      "Recall: number of particles = number of moles × Avogadro constant (6.02 × 10^23).",
      "Substitute the moles and the Avogadro constant, then calculate."
    ]
  });
}

export function generateAvogadroFindMolesDraft(compound, spec, rng) {
  const n = pick(rng, NICE_AVOGADRO_MOLES);
  const N = particlesFromMoles(n);
  const { noun } = particleKind(compound.formula);
  const sigFigsN = avogadroSigFigsCount(spec);
  const maxMarks = sigFigsN > 0 ? 3 : 2;
  const prompt =
    `A sample of ${compound.name}, ${mhchemInline(compound.formula)}, contains ${formatStandardFormLatex(N)} ${noun}.\n\n` +
    `Calculate the number of moles of ${compound.name} in the sample.` +
    avogadroPromptTail({ standardForm: false, sigFigsN });

  const calcConfig = {
    marking_mode: "moles_mass",
    equation_given: false,
    unit: "mol",
    max_marks: maxMarks,
    answer: n,
    steps: withAvogadroSigFigsStep([
      {
        type: "insert_values",
        marks: 1,
        ao: "AO2",
        required: true,
        op: "div",
        lhs: "n",
        standard_form: true,
        label: "Substitute into n = number of particles ÷ Avogadro constant",
        left: { value: N },
        right: { value: AVOGADRO_CONSTANT }
      },
      {
        type: "calculate",
        marks: 1,
        ao: "AO2",
        required: true,
        answer: n,
        unit: "mol",
        label: "Number of moles"
      }
    ], sigFigsN)
  };

  return htNumericDraft({
    spec,
    scenario: "avogadro_find_n",
    variant: {
      scenario: "avogadro_find_n",
      formula: compound.formula,
      name: compound.name,
      n,
      N,
      noun,
      sig_figs: sigFigsN || null
    },
    prompt,
    maxMarks,
    unit: "mol",
    answer: n,
    calcConfig,
    skillCodes: avogadroSkillCodes({ findMoles: true, sigFigs: sigFigsN > 0 }),
    hints: [
      "Recall: number of moles = number of particles ÷ Avogadro constant (6.02 × 10^23).",
      "Substitute the number of particles and the Avogadro constant, then calculate."
    ]
  });
}

function pickGivenAndFindSpecies(species, rng, preferReactantToProduct = true) {
  const reactants = species.filter((s) => stoichSpeciesSide(s) === "reactant");
  const products = species.filter((s) => stoichSpeciesSide(s) === "product");
  if (preferReactantToProduct && reactants.length && products.length) {
    return { given: pick(rng, reactants), find: pick(rng, products) };
  }
  const pool = species.filter((s) => s);
  const given = pick(rng, pool);
  const findPool = pool.filter((s) => s.id !== given.id);
  return { given, find: pick(rng, findPool) };
}

function pickNiceReactingMasses(given, find, rng) {
  for (const nGiven of shuffle(NICE_MOLES, rng)) {
    const mGiven = nGiven * given.mr;
    const nFind = scaleByMoleRatio(nGiven, given.coeff, find.coeff);
    const mFind = nFind * find.mr;
    if (isNiceNumber(mGiven) && isNiceNumber(mFind) && isNiceNumber(nFind)) {
      return {
        nGiven: roundNice(nGiven),
        mGiven: roundNice(mGiven),
        nFind: roundNice(nFind),
        mFind: roundNice(mFind)
      };
    }
  }
  const nGiven = 1;
  return {
    nGiven,
    mGiven: roundNice(given.mr),
    nFind: roundNice(scaleByMoleRatio(1, given.coeff, find.coeff)),
    mFind: roundNice(scaleByMoleRatio(1, given.coeff, find.coeff) * find.mr)
  };
}

function reactingMassesPaths(given, find, nums) {
  const factor = (find.mr * find.coeff) / (given.mr * given.coeff);
  return [
    {
      id: "moles_then_ratio",
      label: "Moles of given → mole ratio → mass of target",
      steps: [
        { id: "s1", marks: 1, accept: [{ value: nums.nGiven }, { op: "div", values: [nums.mGiven, given.mr] }] },
        { id: "s2", marks: 1, accept: [{ value: nums.nFind }, { op: "mul", values: [nums.nGiven, find.coeff / given.coeff] }], ecf_from: "s1" },
        { id: "s3", marks: 1, accept: [{ value: nums.mFind }, { op: "mul", values: [nums.nFind, find.mr] }], ecf_from: "s2" }
      ]
    },
    {
      id: "mass_ratio",
      label: "Mass-ratio shortcut",
      steps: [
        { id: "s1", marks: 1, accept: [{ value: roundNice(factor) }, { op: "div", values: [find.mr * find.coeff, given.mr * given.coeff] }] },
        { id: "s2", marks: 1, accept: [{ value: nums.mFind }, { op: "mul", values: [nums.mGiven, factor] }], ecf_from: "s1" },
        { id: "s3", marks: 1, accept: [{ value: nums.mFind }], ecf_from: "s2" }
      ]
    }
  ];
}

function reactingMassesCalcConfig(given, find, nums) {
  const paths = reactingMassesPaths(given, find, nums);
  return {
    marking_mode: "multi_path",
    equation_given: false,
    unit: "g",
    max_marks: 3,
    answer: nums.mFind,
    answer_bands: [
      { marks: 3, accept: [{ value: nums.mFind }] }
    ],
    paths,
    primary_path_id: "moles_then_ratio",
    scaffold: "moles_then_ratio",
    steps: [
      {
        type: "working_1",
        marks: 1,
        ao: "AO2",
        required: true,
        label: `Moles of ${given.name}`,
        placeholder: "",
        reveal_from_path_step: "s1"
      },
      {
        type: "working_2",
        marks: 1,
        ao: "AO2",
        required: true,
        label: `Moles of ${find.name}`,
        placeholder: "",
        reveal_from_path_step: "s2"
      },
      {
        type: "calculate",
        marks: 1,
        ao: "AO2",
        required: true,
        answer: nums.mFind,
        unit: "g",
        label: `Mass of ${find.name} (g)`
      }
    ]
  };
}

function reactingMassesStem(reaction, given, find, mGiven, species) {
  const verb = stoichSpeciesSide(find) === "product" ? "produced" : "required";
  return (
    `The balanced equation for the reaction is:\n\n${mhchemBalancedFromStoich(species)}\n\n` +
    `Calculate the mass of ${find.name}, ${mhchemInline(find.formula)}, ${verb} from ${formatNumber(mGiven)} g of ${given.name}, ${mhchemInline(given.formula)}.\n\n` +
    `Give your answer in grams.\n\n` +
    `${formatArStem(arValuesForSpeciesList(species))}\n` +
    `${formatMrList([given, find])}`
  );
}

export function generateReactingMassesDraft(reaction, spec, rng) {
  const species = enrichStoichSpecies(reaction.species);
  const { given, find } = pickGivenAndFindSpecies(species, rng, true);
  const nums = pickNiceReactingMasses(given, find, rng);
  const calcConfig = reactingMassesCalcConfig(given, find, nums);
  const prompt = reactingMassesStem(reaction, given, find, nums.mGiven, species);
  return htNumericDraft({
    spec,
    scenario: "reacting_masses",
    variant: {
      scenario: "reacting_masses",
      id: reaction.id,
      given: given.id,
      find: find.id,
      mGiven: nums.mGiven,
      mFind: nums.mFind
    },
    prompt,
    maxMarks: 3,
    unit: "g",
    answer: nums.mFind,
    calcConfig,
    hints: [
      "Calculate moles of the given substance: mass ÷ Mr.",
      "Use the mole ratio from the balanced equation to find moles of the target substance.",
      "Calculate mass: moles × Mr. (A mass-ratio shortcut is also valid.)"
    ]
  });
}

export function generateBalanceFromMassesDraft(reaction, spec, rng) {
  const species = enrichStoichSpecies(reaction.species);
  const baseN = pick(rng, [0.1, 0.2, 0.25, 0.5, 1, 2]);
  const moleRows = species.map((sp) => {
    const n = roundNice(baseN * sp.coeff);
    const mass = roundNice(n * sp.mr);
    return { ...sp, moles: n, mass };
  });
  const massLines = moleRows
    .map((sp) => `${formatNumber(sp.mass)} g of ${sp.name} (${mhchemInline(sp.formula)})`)
    .join("\n");
  const prompt =
    `In an experiment, the following masses of substances were obtained:\n\n${massLines}\n\n` +
    `Use the masses to calculate the number of moles of each substance, then balance the equation.\n\n` +
    `${mhchemUnbalancedFromStoich(species)}\n\n` +
    `${formatArStem(arValuesForSpeciesList(species))}\n` +
    `${formatMrList(species)}`;

  const calcConfig = {
    marking_mode: "balance_from_masses",
    equation_given: false,
    max_marks: 2,
    steps: [
      {
        type: "mole_table",
        marks: 1,
        ao: "AO2",
        required: true,
        label: "Calculate moles of each substance (mass ÷ Mr)",
        species: moleRows.map((sp) => ({
          id: sp.id,
          formula: sp.formula,
          name: sp.name,
          answer: sp.moles
        }))
      },
      {
        type: "balance_coeffs",
        marks: 1,
        ao: "AO2",
        required: true,
        label: "Balance the equation using the simplest whole-number ratio of moles",
        species: moleRows,
        coeffs: moleRows.map((sp) => sp.coeff)
      }
    ]
  };

  return htNumericDraft({
    spec,
    scenario: "balance_from_masses",
    variant: {
      scenario: "balance_from_masses",
      id: reaction.id,
      masses: Object.fromEntries(moleRows.map((sp) => [sp.id, sp.mass]))
    },
    prompt,
    maxMarks: 2,
    unit: "",
    answer: moleRows.map((sp) => sp.coeff).join(","),
    calcConfig,
    commandWord: "balance",
    hints: [
      "Calculate moles of each substance: mass ÷ Mr.",
      "Divide each amount by the smallest number of moles, then scale to whole numbers."
    ]
  });
}

function pickLimitingPair(species, rng) {
  const reactants = species.filter((s) => stoichSpeciesSide(s) === "reactant");
  const products = species.filter((s) => stoichSpeciesSide(s) === "product");
  if (reactants.length < 2 || !products.length) return null;
  const limiting = pick(rng, reactants);
  const excess = pick(rng, reactants.filter((r) => r.id !== limiting.id));
  const product = pick(rng, products);
  return { limiting, excess, product };
}

function pickLimitingMasses(limiting, excess, product, rng) {
  for (const nL of shuffle(NICE_MOLES, rng)) {
    const mL = nL * limiting.mr;
    const nP = scaleByMoleRatio(nL, limiting.coeff, product.coeff);
    const mP = nP * product.mr;
    const eqL = nL / limiting.coeff;
    const nEmin = eqL * 1.2 * excess.coeff;
    let nE = NICE_MOLES.find((n) => n >= nEmin - 1e-12 && isNiceNumber(n * excess.mr));
    if (nE == null) {
      nE = roundNice(Math.ceil(nEmin * 10) / 10);
    }
    const mE = nE * excess.mr;
    if (isNiceNumber(mL) && isNiceNumber(mP) && nE / excess.coeff > eqL + 1e-9) {
      return {
        nL: roundNice(nL),
        mL: roundNice(mL),
        nE: roundNice(nE),
        mE: roundNice(mE),
        nP: roundNice(nP),
        mP: roundNice(mP)
      };
    }
  }
  const nL = limiting.coeff;
  const nE = excess.coeff * 2;
  const nP = product.coeff;
  return {
    nL,
    mL: roundNice(nL * limiting.mr),
    nE,
    mE: roundNice(nE * excess.mr),
    nP,
    mP: roundNice(nP * product.mr)
  };
}

export function generateLimitingExcessDraft(reaction, spec, rng) {
  const species = enrichStoichSpecies(reaction.species);
  const pair = pickLimitingPair(species, rng);
  if (!pair) throw new Error(`Reaction ${reaction.id} needs two reactants for limiting`);
  const { limiting, excess, product } = pair;
  const nums = pickLimitingMasses(limiting, excess, product, rng);
  const given = limiting;
  const find = product;
  const reactingNums = { nGiven: nums.nL, mGiven: nums.mL, nFind: nums.nP, mFind: nums.mP };
  const calcConfig = reactingMassesCalcConfig(given, find, reactingNums);
  const prompt =
    `The balanced equation for the reaction is:\n\n${mhchemBalancedFromStoich(species)}\n\n` +
    `${excess.name}, ${mhchemInline(excess.formula)}, is in excess.\n\n` +
    `Calculate the mass of ${product.name}, ${mhchemInline(product.formula)}, produced from ${formatNumber(nums.mL)} g of ${limiting.name}, ${mhchemInline(limiting.formula)}.\n\n` +
    `Give your answer in grams.\n\n` +
    `${formatArStem(arValuesForSpeciesList(species))}\n` +
    `${formatMrList([limiting, product])}`;

  return htNumericDraft({
    spec,
    scenario: "limiting_excess",
    variant: {
      scenario: "limiting_excess",
      id: reaction.id,
      limiting: limiting.id,
      excess: excess.id,
      product: product.id,
      mL: nums.mL,
      mP: nums.mP
    },
    prompt,
    maxMarks: 3,
    unit: "g",
    answer: nums.mP,
    calcConfig,
    hints: [
      "The named excess reactant is not limiting — use the given mass of the other reactant.",
      "Calculate moles of that reactant, apply the mole ratio, then moles × Mr for the product."
    ]
  });
}

export function generateLimitingIdentifyDraft(reaction, spec, rng) {
  const species = enrichStoichSpecies(reaction.species);
  const pair = pickLimitingPair(species, rng);
  if (!pair) throw new Error(`Reaction ${reaction.id} needs two reactants for limiting`);
  const { limiting, excess, product } = pair;
  const nums = pickLimitingMasses(limiting, excess, product, rng);
  const checkId = identifyLimitingReactant([
    { id: limiting.id, moles: nums.nL, coeff: limiting.coeff },
    { id: excess.id, moles: nums.nE, coeff: excess.coeff }
  ]);
  if (checkId !== limiting.id) {
    throw new Error(`Limiting check failed for ${reaction.id}`);
  }

  const prompt =
    `The balanced equation for the reaction is:\n\n${mhchemBalancedFromStoich(species)}\n\n` +
    `${formatNumber(nums.mL)} g of ${limiting.name}, ${mhchemInline(limiting.formula)}, is mixed with ` +
    `${formatNumber(nums.mE)} g of ${excess.name}, ${mhchemInline(excess.formula)}.\n\n` +
    `Identify the limiting reactant and calculate the mass of ${product.name}, ${mhchemInline(product.formula)}, produced.\n\n` +
    `Give your answer in grams.\n\n` +
    `${formatArStem(arValuesForSpeciesList(species))}\n` +
    `${formatMrList([limiting, excess, product])}`;

  const calcConfig = {
    marking_mode: "limiting_reactant",
    equation_given: false,
    unit: "g",
    max_marks: 4,
    answer: nums.mP,
    limiting_id: limiting.id,
    limiting_coeff: limiting.coeff,
    product_coeff: product.coeff,
    product_mr: product.mr,
    steps: [
      {
        type: "mole_table",
        marks: 1,
        ao: "AO2",
        required: true,
        label: "Calculate moles of each reactant from the masses given",
        species: [
          { id: limiting.id, formula: limiting.formula, name: limiting.name, answer: nums.nL },
          { id: excess.id, formula: excess.formula, name: excess.name, answer: nums.nE }
        ]
      },
      {
        type: "mole_ratio",
        marks: 1,
        ao: "AO2",
        required: true,
        label: "Mole ratio of the two reactants from the equation",
        left: { id: limiting.id, formula: limiting.formula, name: limiting.name, value: limiting.coeff },
        right: { id: excess.id, formula: excess.formula, name: excess.name, value: excess.coeff }
      },
      {
        type: "limiting_select",
        marks: 1,
        ao: "AO2",
        required: true,
        label: "Which reactant is limiting?",
        options: shuffle([
          { id: limiting.id, label: `${limiting.name} (${limiting.formula})` },
          { id: excess.id, label: `${excess.name} (${excess.formula})` }
        ], rng),
        answer: limiting.id
      },
      {
        type: "calculate",
        marks: 1,
        ao: "AO2",
        required: true,
        answer: nums.mP,
        unit: "g",
        label: `Mass of ${product.name} (g)`
      }
    ]
  };

  return htNumericDraft({
    spec,
    scenario: "limiting_identify",
    variant: {
      scenario: "limiting_identify",
      id: reaction.id,
      limiting: limiting.id,
      excess: excess.id,
      product: product.id,
      mL: nums.mL,
      mE: nums.mE,
      mP: nums.mP
    },
    prompt,
    maxMarks: 4,
    unit: "g",
    answer: nums.mP,
    calcConfig,
    demandLevel: "standard_67",
    difficulty: 4,
    hints: [
      "Calculate moles of both reactants: mass ÷ Mr.",
      "Compare moles ÷ coefficient to see which reactant is limiting.",
      "Use the limiting reactant and the mole ratio to find moles of product, then mass = moles × Mr."
    ]
  });
}

// ─── Batch orchestration ────────────────────────────────────────────────────

/**
 * @param {object} spec
 * @param {string} spec.scenario
 * @param {number} [spec.count]
 * @param {number} [spec.seed]
 * @param {string[]} [spec.excludeFormulas] - formulas already in the bank (RFM / % mass / moles)
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

  if (scenario === "rfm" || scenario === "percent_by_mass" || scenario === "moles_find_n" || scenario === "moles_find_m" || scenario === "avogadro_find_N" || scenario === "avogadro_find_n") {
    const pool = (scenario === "avogadro_find_N" || scenario === "avogadro_find_n")
      ? listAvogadroSpecies()
      : compounds;
    const { selected, shortfall, available } = selectUniqueCompounds(
      pool,
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
        } else if (scenario === "percent_by_mass") {
          drafts.push(generatePercentByMassDraft(compound, { ...spec, seed }, rng));
        } else if (scenario === "moles_find_n") {
          drafts.push(generateMolesFindNDraft(compound, { ...spec, seed }, rng));
        } else if (scenario === "moles_find_m") {
          drafts.push(generateMolesFindMDraft(compound, { ...spec, seed }, rng));
        } else if (scenario === "avogadro_find_N") {
          drafts.push(generateAvogadroFindParticlesDraft(compound, { ...spec, seed }, rng));
        } else {
          drafts.push(generateAvogadroFindMolesDraft(compound, { ...spec, seed }, rng));
        }
      } catch (err) {
        errors.push({ index: i, message: err?.message || String(err) });
      }
    });
    return { drafts, errors, seed, scenario };
  }

  const STOICH_SCENARIOS = {
    reacting_masses: "reacting_masses",
    balance_from_masses: "balance_from_masses",
    limiting_excess: "limiting",
    limiting_identify: "limiting"
  };
  if (STOICH_SCENARIOS[scenario]) {
    const pool = listStoichReactions(STOICH_SCENARIOS[scenario]);
    if (!pool.length) {
      errors.push({ index: null, message: `No stoichiometry reactions for ${scenario}` });
      return { drafts, errors, seed, scenario };
    }
    const { selected, shortfall, available } = selectUniqueStoichReactions(pool, count, rng, spec.excludeStoichIds || []);
    if (shortfall > 0) {
      errors.push({
        index: null,
        message:
          `Only ${available} unused reaction(s) available; requested ${count}. Generated ${selected.length}.`
      });
    }
    selected.forEach((entry, i) => {
      try {
        if (scenario === "reacting_masses") {
          drafts.push(generateReactingMassesDraft(entry, { ...spec, seed }, rng));
        } else if (scenario === "balance_from_masses") {
          drafts.push(generateBalanceFromMassesDraft(entry, { ...spec, seed }, rng));
        } else if (scenario === "limiting_excess") {
          drafts.push(generateLimitingExcessDraft(entry, { ...spec, seed }, rng));
        } else {
          drafts.push(generateLimitingIdentifyDraft(entry, { ...spec, seed }, rng));
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
