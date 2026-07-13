// Batch numeric question generator — pure functions for admin tab and future CLI
import {
  getSubstitutionTemplate,
  getSlotIdsFromTemplate,
  findEquationInSheet,
  listRearrangementSubjectIds,
  slotLabelFromTemplate,
  enrichEquationSheet,
  initSubstitutionTemplateCatalog
} from "./substitutionTemplate.js";
import {
  buildCalculationConfigForVariant,
  finalizeCalculationConfigForSave,
  computeMaxMarksFromConfig,
  resolveEquationSheetId,
  applyDefaultStepFeedbackToConfig
} from "./calculationWorkflow.js";
import { suggestSkillsForQuestion } from "./skillTagging.js";
import { normalizeQuestionTierForDb } from "./sciencePath.js";
import { normalizeQuestionTier } from "./examRules.js";

/** Result quantity unit by equation id (SI unless noted). */
const EQUATION_UNITS = {
  kinetic_energy: "J",
  gravitational_potential_energy: "J",
  elastic_potential_energy: "J",
  power: "W",
  power_energy: "W",
  power_work: "W",
  power_vi: "W",
  power_i2r: "W",
  charge: "C",
  potential_difference: "V",
  energy_pt: "J",
  energy_qv: "J",
  weight: "N",
  work_done: "J",
  spring_force: "N",
  force: "N",
  momentum: "kg m/s",
  specific_latent_heat: "J",
  wave_speed: "m/s",
  moment: "Nm",
  force_on_conductor: "N",
  pressure_column: "Pa",
  specific_heat_capacity: "J",
  transformer: "V",
  density: "kg/m³",
  acceleration: "m/s²",
  period: "s",
  pressure: "Pa",
  force_momentum: "N",
  distance_speed: "m/s",
  frequency: "Hz"
};

/** Units when solving for a specific variable (rearrangement). */
const SUBJECT_UNITS = {
  v: "m/s",
  e: "m",
  m: "kg",
  s: "m",
  t: "s",
  I: "A",
  V: "V",
  R: "Ω",
  F: "N",
  a: "m/s²",
  delta_v: "m/s",
  f: "Hz",
  lambda: "m",
  P: "W",
  E: "J",
  E_k: "J",
  E_e: "J",
  Q: "C",
  k: "N/m",
  p: "kg m/s",
  rho: "kg/m³",
  W: "N",
  g: "N/kg",
  c: "J/(kg °C)",
  L: "J/kg",
  h: "m",
  T: "s",
  E_useful: "J",
  E_in: "J",
  P_useful: "W",
  P_in: "W",
  V_p: "V",
  V_s: "V",
  I_p: "A",
  I_s: "A",
  vol: "m³"
};

/** Human-readable names for prompt text. */
const SLOT_PROMPT_LABELS = {
  e: "extension",
  m: "mass",
  v: "velocity",
  k: "spring constant",
  E: "energy",
  E_k: "kinetic energy",
  E_e: "elastic potential energy",
  E_p: "gravitational potential energy",
  W: "weight",
  F: "force",
  s: "distance",
  t: "time",
  I: "current",
  V: "potential difference",
  R: "resistance",
  P: "power",
  Q: "charge",
  a: "acceleration",
  delta_v: "change in velocity",
  f: "frequency",
  lambda: "wavelength",
  p: "momentum",
  rho: "density",
  g: "gravitational field strength",
  c: "specific heat capacity",
  h: "height",
  L: "specific latent heat",
  delta_theta: "temperature change",
  delta_E: "energy change",
  efficiency: "efficiency",
  E_useful: "useful output energy",
  E_in: "total input energy",
  P_useful: "useful power output",
  P_in: "total power input",
  V_p: "primary potential difference",
  V_s: "secondary potential difference",
  I_p: "primary current",
  I_s: "secondary current"
};

/** Per-equation overrides when a slot id means different quantities (e.g. W = weight vs work). */
const EQUATION_SLOT_PROMPT_LABELS = {
  work_done: { W: "work done" },
  power_work: { W: "work done" },
  weight: { W: "weight" },
  density: { V: "volume" },
  kinetic_energy: { E: "kinetic energy" },
  gravitational_potential_energy: { E: "gravitational potential energy" },
  elastic_potential_energy: { E: "elastic potential energy" }
};

const EQUATION_SLOT_UNITS = {
  work_done: { W: "J" },
  power_work: { W: "J" },
  density: { V: "m³", vol: "m³" }
};

/** Default numeric ranges for common slot ids when spec omits ranges. */
const DEFAULT_SLOT_RANGES = {
  m: { min: 1, max: 10, step: 0.5 },
  v: { min: 2, max: 20, step: 1 },
  s: { min: 5, max: 100, step: 5 },
  t: { min: 2, max: 60, step: 1 },
  F: { min: 10, max: 500, step: 10 },
  I: { min: 0.5, max: 5, step: 0.1 },
  V: { min: 2, max: 24, step: 1 },
  R: { min: 2, max: 50, step: 1 },
  P: { min: 10, max: 2000, step: 10 },
  E: { min: 100, max: 5000, step: 50 },
  Q: { min: 1, max: 100, step: 1 },
  g: { min: 10, max: 10, step: 1 },
  c: { min: 4200, max: 4200, step: 1 },
  h: { min: 1, max: 2, step: 0.1 },
  k: { min: 50, max: 500, step: 10 },
  e: { min: 0.01, max: 0.2, step: 0.01 },
  rho: { min: 500, max: 8000, step: 100 },
  f: { min: 50, max: 2000, step: 10 },
  lambda: { min: 0.1, max: 2, step: 0.1 },
  a: { min: 1, max: 10, step: 0.5 },
  delta_v: { min: 2, max: 20, step: 1 },
  delta_theta: { min: 10, max: 80, step: 5 },
  delta_E: { min: 100, max: 5000, step: 50 },
  E_k: { min: 10, max: 5000, step: 10 },
  E_e: { min: 10, max: 500, step: 5 },
  W: { min: 10, max: 5000, step: 10 },
  p: { min: 1000, max: 100000, step: 1000 },
  L: { min: 200000, max: 500000, step: 10000 },
  M: { min: 1, max: 50, step: 1 },
  d: { min: 0.1, max: 2, step: 0.1 },
  T: { min: 0.001, max: 2, step: 0.001 },
  E_useful: { min: 200, max: 4000, step: 50 },
  E_in: { min: 5000, max: 12000, step: 100 },
  P_useful: { min: 50, max: 400, step: 10 },
  P_in: { min: 500, max: 2000, step: 50 },
  efficiency: { min: 0.15, max: 0.85, step: 0.05 },
  V_p: { min: 100, max: 25000, step: 100 },
  V_s: { min: 5, max: 240, step: 1 },
  I_p: { min: 0.01, max: 5, step: 0.01 },
  I_s: { min: 0.1, max: 50, step: 0.1 }
};

const EFFICIENCY_EQUATION_IDS = new Set(["efficiency_energy", "efficiency_power"]);

export function isEfficiencyEquation(equationOrId) {
  const id = typeof equationOrId === "string" ? equationOrId : equationOrId?.id;
  return EFFICIENCY_EQUATION_IDS.has(id);
}

function efficiencyAsPercentage(spec) {
  return !!spec?.efficiency_as_percentage;
}

/** Decimal efficiency (0–1) → display value for prompts when percentage mode is on. */
function efficiencyDecimalToDisplay(decimal) {
  const n = parseFloat(decimal);
  if (!Number.isFinite(n)) return decimal;
  const pct = n * 100;
  return Number.isInteger(pct) ? String(pct) : String(Math.round(pct * 10) / 10);
}

function isEfficiencyResultAnswer(equation, rearrangementSubject) {
  const resultSlot = identifyResultSlot(getSubstitutionTemplate(equation));
  return !rearrangementSubject || rearrangementSubject === resultSlot;
}

function finalizeEfficiencyAnswer(answer, equation, spec, rearrangementSubject) {
  if (!isEfficiencyEquation(equation) || !efficiencyAsPercentage(spec)) {
    const unit = rearrangementSubject
      ? getSubjectUnit(equation, rearrangementSubject)
      : (EQUATION_UNITS[equation.id] || "");
    return { answer, unit };
  }
  if (isEfficiencyResultAnswer(equation, rearrangementSubject)) {
    const pct = Math.round(answer * 10000) / 100;
    return { answer: pct, unit: "%" };
  }
  if (rearrangementSubject) {
    return { answer, unit: getSubjectUnit(equation, rearrangementSubject) };
  }
  return { answer, unit: "" };
}

const DEFAULT_CONSTANTS = { g: 10, c: 4200 };

const PROMPT_TEMPLATES = {
  kinetic_energy:
    "Calculate the kinetic energy of an object of mass {m} kg moving at {v} m/s.",
  weight:
    "Calculate the weight of an object of mass {m} kg. Use a gravitational field strength of {g} N/kg.",
  work_done: "Calculate the work done when a force of {F} N acts over a distance of {s} m.",
  force: "Calculate the force needed to accelerate a mass of {m} kg at {a} m/s².",
  potential_difference:
    "A resistor has resistance {R} Ω and current {I} A. Calculate the potential difference.",
  power_vi: "An appliance operates at {I} A and {V} V. Calculate the power.",
  density: "Calculate the density of a substance of mass {m} kg and volume {V} m³.",
  transformer:
    "A transformer has primary voltage {V_p} V, primary current {I_p} A, and secondary current {I_s} A. Calculate the secondary voltage.",
  wave_speed: "A wave has frequency {f} Hz and wavelength {lambda} m. Calculate the wave speed.",
  gravitational_potential_energy:
    "Calculate the gravitational potential energy of a {m} kg object raised {h} m. Use a gravitational field strength of {g} N/kg.",
  speed: "Calculate the speed of an object that travels {s} m in {t} s.",
  acceleration:
    "Calculate the acceleration when velocity changes by {delta_v} m/s in {t} s.",
  elastic_potential_energy:
    "A spring has spring constant {k} N/m and extension {e} m. Calculate the elastic potential energy stored.",
  efficiency_energy:
    "A device transfers {E_useful} J of useful energy from a total input of {E_in} J. Calculate the efficiency.",
  efficiency_power:
    "An appliance delivers {P_useful} W of useful power from a total power input of {P_in} W. Calculate the efficiency.",
  momentum: "Calculate the momentum of an object of mass {m} kg moving at {v} m/s.",
  spring_force:
    "Calculate the force on a spring with spring constant {k} N/m and extension {e} m."
};

const CONVERSION_CATALOG = [
  { slotPattern: /^(s|h|d|e|lambda)$/, fromUnit: "km", toUnit: "m", factor: 1000 },
  { slotPattern: /^(s|h|d|e|lambda)$/, fromUnit: "cm", toUnit: "m", factor: 0.01 },
  { slotPattern: /^(s|h|d|e|lambda)$/, fromUnit: "mm", toUnit: "m", factor: 0.001 },
  { slotPattern: /^m$/, fromUnit: "g", toUnit: "kg", factor: 0.001 },
  { slotPattern: /^m$/, fromUnit: "t", toUnit: "kg", factor: 1000 },
  { slotPattern: /^t$|^T$/, fromUnit: "min", toUnit: "s", factor: 60 },
  { slotPattern: /^t$|^T$/, fromUnit: "ms", toUnit: "s", factor: 0.001 },
  { slotPattern: /^I$/, fromUnit: "mA", toUnit: "A", factor: 0.001 },
  { slotPattern: /^I$/, fromUnit: "µA", toUnit: "A", factor: 1e-6 },
  { slotPattern: /^I$/, fromUnit: "uA", toUnit: "A", factor: 1e-6 },
  { slotPattern: /^V$/, fromUnit: "mV", toUnit: "V", factor: 0.001 },
  { slotPattern: /^V$/, fromUnit: "kV", toUnit: "V", factor: 1000 },
  { slotPattern: /^P$|^P_useful$|^P_in$/, fromUnit: "kW", toUnit: "W", factor: 1000 },
  { slotPattern: /^P$|^P_useful$|^P_in$/, fromUnit: "MW", toUnit: "W", factor: 1e6 },
  {
    slotPattern: /^E$|^E_k$|^E_e$|^E_p$|^delta_E$|^W$|^E_useful$|^E_in$/,
    fromUnit: "kJ",
    toUnit: "J",
    factor: 1000
  },
  {
    slotPattern: /^E$|^E_k$|^E_e$|^E_p$|^delta_E$|^E_useful$|^E_in$/,
    fromUnit: "MJ",
    toUnit: "J",
    factor: 1e6
  },
  { slotPattern: /^efficiency$/, fromUnit: "%", toUnit: "", factor: 0.01 },
  { slotPattern: /^Q$/, fromUnit: "mC", toUnit: "C", factor: 0.001 },
  { slotPattern: /^k$/, fromUnit: "N/cm", toUnit: "N/m", factor: 100 },
  { slotPattern: /^k$/, fromUnit: "N/mm", toUnit: "N/m", factor: 1000 }
];

const UNIT_ALIASES = {
  microa: "µA",
  ua: "µA",
  μa: "µA",
  ma: "mA",
  mv: "mV",
  kv: "kV",
  kj: "kJ",
  mj: "MJ",
  kw: "kW",
  mw: "MW",
  mc: "mC",
  mm: "mm",
  cm: "cm",
  km: "km",
  min: "min",
  ms: "ms"
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

function pickFromRange(range, rng) {
  const { min, max, step = 1 } = range;
  if (min === max) return min;
  const steps = Math.floor((max - min) / step) + 1;
  const idx = Math.floor(rng() * steps);
  const val = min + idx * step;
  return Math.round(val * 1e6) / 1e6;
}

function slotNumericValue(slots, slotId) {
  const v = slots[slotId];
  if (v == null || v === "") return NaN;
  return parseFloat(v);
}

export function getSlotPromptLabel(slotId, equation = null) {
  const eqOverride = equation?.id ? EQUATION_SLOT_PROMPT_LABELS[equation.id]?.[slotId] : null;
  if (eqOverride) return eqOverride;

  const template = equation ? getSubstitutionTemplate(equation) : null;
  if (template) {
    const tplLabel = slotLabelFromTemplate(template, slotId);
    if (tplLabel && tplLabel !== slotId && tplLabel.length > 2) {
      return String(tplLabel).replace(/Δ/g, "change in ");
    }
  }
  if (SLOT_PROMPT_LABELS[slotId]) return SLOT_PROMPT_LABELS[slotId];
  const token = template?.tokens?.find((t) => t.kind === "slot" && t.id === slotId);
  if (token?.label) return String(token.label).replace(/Δ/g, "change in ");
  return slotId;
}

/** SI (or equation-specific) unit for a slot in prompt / answer text. */
export function resolveSlotUnit(equation, slotId) {
  const eqUnit = equation?.id ? EQUATION_SLOT_UNITS[equation.id]?.[slotId] : null;
  if (eqUnit) return eqUnit;
  if (SUBJECT_UNITS[slotId]) return SUBJECT_UNITS[slotId];
  return "";
}

/** Lowercase equation label for use after "Calculate the …". */
export function getEquationPromptLabel(equation) {
  const raw = String(equation?.label || equation?.id || "value").trim();
  if (!raw) return "value";
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

export function formatEquationLatexBlock(latex) {
  if (!latex?.trim()) return "";
  return `\n\n$$${latex.trim()}$$`;
}

export function identifyResultSlot(template) {
  if (!template) return null;
  if (template.layout === "fraction") {
    const lhs = template.lhs?.find((t) => t.kind === "slot");
    return lhs?.id || null;
  }
  if (template.layout === "product" || template.layout === "sum_product") {
    const eqIdx = (template.tokens || []).findIndex((t) => t.kind === "op" && t.text === "=");
    if (eqIdx < 0) return null;
    const lhsSlot = template.tokens.slice(0, eqIdx).find((t) => t.kind === "slot");
    return lhsSlot?.id || null;
  }
  return null;
}

function collectRhsSlots(template) {
  if (template.layout === "fraction") {
    return { numerator: template.numerator || [], denominator: template.denominator || [] };
  }
  const eqIdx = (template.tokens || []).findIndex((t) => t.kind === "op" && t.text === "=");
  const rhs = eqIdx >= 0 ? template.tokens.slice(eqIdx + 1) : template.tokens || [];
  return { tokens: rhs };
}

function evalFractionPart(items, slots) {
  let product = 1;
  let hasValue = false;
  for (const item of items || []) {
    if (item.kind === "slot") {
      const v = slotNumericValue(slots, item.id);
      if (!Number.isFinite(v)) return NaN;
      product *= v;
      hasValue = true;
    } else if (item.kind === "op" && item.text === "1") {
      product *= 1;
      hasValue = true;
    }
  }
  return hasValue ? product : NaN;
}

function evalRhsTokens(tokens, slots) {
  let result = 1;
  let pendingHalf = false;
  let started = false;
  const items = tokens || [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "op") {
      if (item.text === "½" || item.text === "1/2") pendingHalf = true;
      continue;
    }
    if (item.kind !== "slot") continue;

    let v = slotNumericValue(slots, item.id);
    if (!Number.isFinite(v)) return NaN;
    if (pendingHalf) {
      v *= 0.5;
      pendingHalf = false;
    }
    const next = items[i + 1];
    if (next?.kind === "op" && (next.text === "²" || next.text === "^2")) {
      v = v * v;
    }
    if (!started) {
      result = v;
      started = true;
    } else {
      result *= v;
    }
  }
  return started ? result : NaN;
}

export function evaluateEquation(equation, slots) {
  const template = getSubstitutionTemplate(equation);
  if (!template) {
    throw new Error(`No substitution template for equation "${equation?.id}"`);
  }

  let answer;
  if (template.layout === "fraction") {
    const num = evalFractionPart(template.numerator, slots);
    const den = evalFractionPart(template.denominator, slots);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
      throw new Error(`Cannot evaluate fraction for "${equation.id}"`);
    }
    answer = num / den;
  } else if (template.layout === "product" || template.layout === "sum_product") {
    answer = evalRhsTokens(collectRhsSlots(template).tokens, slots);
  } else {
    throw new Error(`Unsupported template layout "${template.layout}" for "${equation.id}"`);
  }

  if (!Number.isFinite(answer)) {
    throw new Error(`Evaluation failed for "${equation.id}"`);
  }

  const unit = EQUATION_UNITS[equation.id] || "";
  return { answer, unit, resultSlot: identifyResultSlot(template) };
}

/** Pick which variable to solve for in a rearrangement question. */
export function pickRearrangementSubject(equation, rng = Math.random, preferred = null) {
  const variants = equation?.rearrangement_forms?.variants || [];
  if (preferred && variants.some((v) => v.subject === preferred)) return preferred;

  const resultSlot = identifyResultSlot(getSubstitutionTemplate(equation));
  const candidates = variants
    .map((v) => v.subject)
    .filter((s) => s && s !== resultSlot);

  if (!candidates.length) {
    return variants[0]?.subject || equation?.rearrangement_forms?.default_subject || null;
  }
  return candidates[Math.floor(rng() * candidates.length)];
}

/** Solve equation for a specific subject variable using known slot values. */
export function solveForSubject(equation, slots, subject) {
  const template = getSubstitutionTemplate(equation);
  const resultSlot = identifyResultSlot(template);
  const val = (id) => slotNumericValue(slots, id);

  if (subject === resultSlot) {
    return evaluateEquation(equation, slots).answer;
  }

  if (template.layout === "sum_product") {
    const energy = () => val("E") ?? val("E_k") ?? val("E_e") ?? val("E_p");
    if (subject === "v") {
      const Ek = energy();
      const m = val("m");
      if (Number.isFinite(Ek) && Number.isFinite(m) && m > 0) return Math.sqrt(2 * Ek / m);
    }
    if (subject === "m") {
      const Ek = energy();
      const v = val("v");
      if (Number.isFinite(Ek) && Number.isFinite(v) && v > 0) return (2 * Ek) / (v * v);
    }
    if (subject === "e") {
      const Ee = energy();
      const k = val("k");
      if (Number.isFinite(Ee) && Number.isFinite(k) && k > 0) return Math.sqrt(2 * Ee / k);
    }
    if (subject === "k") {
      const Ee = energy();
      const e = val("e");
      if (Number.isFinite(Ee) && Number.isFinite(e) && e > 0) return (2 * Ee) / (e * e);
    }
    if (subject === "I") {
      const P = val("P");
      const R = val("R");
      if (Number.isFinite(P) && Number.isFinite(R) && R > 0) return Math.sqrt(P / R);
    }
    if (subject === "R") {
      const P = val("P");
      const I = val("I");
      if (Number.isFinite(P) && Number.isFinite(I) && I > 0) return P / (I * I);
    }
  }

  if (equation.id === "transformer") {
    const Vp = val("V_p");
    const Ip = val("I_p");
    const Vs = val("V_s");
    const Is = val("I_s");
    if (subject === "V_s" && Number.isFinite(Vp) && Number.isFinite(Ip) && Number.isFinite(Is) && Is !== 0) {
      return (Vp * Ip) / Is;
    }
    if (subject === "V_p" && Number.isFinite(Vs) && Number.isFinite(Is) && Number.isFinite(Ip) && Ip !== 0) {
      return (Vs * Is) / Ip;
    }
    if (subject === "I_p" && Number.isFinite(Vs) && Number.isFinite(Is) && Number.isFinite(Vp) && Vp !== 0) {
      return (Vs * Is) / Vp;
    }
    if (subject === "I_s" && Number.isFinite(Vp) && Number.isFinite(Ip) && Number.isFinite(Vs) && Vs !== 0) {
      return (Vp * Ip) / Vs;
    }
  }

  if (template.layout === "product") {
    const ids = getSlotIdsFromTemplate(template).filter((id) => id !== resultSlot);
    let res = val(resultSlot);
    if (!Number.isFinite(res)) {
      res = evaluateEquation(equation, slots).answer;
    }
    const others = ids.filter((id) => id !== subject);
    if (others.length === 1) {
      const other = val(others[0]);
      if (Number.isFinite(res) && Number.isFinite(other) && other !== 0) return res / other;
    }
    if (others.length >= 2) {
      let product = 1;
      for (const id of others) {
        const v = val(id);
        if (!Number.isFinite(v) || v === 0) {
          product = NaN;
          break;
        }
        product *= v;
      }
      if (Number.isFinite(product) && product !== 0 && Number.isFinite(res)) {
        return res / product;
      }
    }
  }

  if (template.layout === "fraction") {
    const numSlots = (template.numerator || []).filter((t) => t.kind === "slot").map((t) => t.id);
    const denSlots = (template.denominator || []).filter((t) => t.kind === "slot").map((t) => t.id);
    let res = val(resultSlot);
    if (!Number.isFinite(res)) {
      const num = evalFractionPart(template.numerator, slots);
      const den = evalFractionPart(template.denominator, slots);
      if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) res = num / den;
    }
    if (numSlots.includes(subject) && denSlots.length === 1 && subject !== denSlots[0]) {
      const den = val(denSlots[0]);
      if (Number.isFinite(res) && Number.isFinite(den)) return res * den;
    }
    if (denSlots.includes(subject) && numSlots.length === 1) {
      const num = val(numSlots[0]);
      if (Number.isFinite(res) && Number.isFinite(num) && res !== 0) return num / res;
    }
  }

  throw new Error(`Cannot solve for "${subject}" in equation "${equation.id}"`);
}

export function getSubjectUnit(equation, subject) {
  const slotUnit = resolveSlotUnit(equation, subject);
  if (slotUnit) return slotUnit;
  return EQUATION_UNITS[equation.id] || "";
}

function fillSlotValue(id, ranges, constants, rng, slotAnswers, slots) {
  if (constants[id] != null) {
    slots[id] = String(constants[id]);
    slotAnswers[id] = [String(constants[id])];
    return;
  }
  if (DEFAULT_CONSTANTS[id] != null && !ranges[id]) {
    slots[id] = String(constants[id] ?? DEFAULT_CONSTANTS[id]);
    slotAnswers[id] = [slots[id]];
    return;
  }
  const range = ranges[id] || DEFAULT_SLOT_RANGES[id] || { min: 1, max: 10, step: 1 };
  const val = pickFromRange(range, rng);
  slots[id] = String(val);
  slotAnswers[id] = [String(val)];
}

export function generateSlotValues(equation, ranges = {}, constants = {}, rng = Math.random) {
  const template = getSubstitutionTemplate(equation);
  if (!template) {
    throw new Error(`No substitution template for "${equation?.id}" — batch v1 requires structured templates`);
  }

  const slotIds = getSlotIdsFromTemplate(template);
  const resultSlot = identifyResultSlot(template);
  const slots = {};
  const slotAnswers = {};

  for (const id of slotIds) {
    if (id === resultSlot) continue;
    fillSlotValue(id, ranges, constants, rng, slotAnswers, slots);
  }

  const { answer } = evaluateEquation(equation, slots);
  if (resultSlot) {
    slots[resultSlot] = String(answer);
    // Students type the result symbol in substitution — omit from mark-scheme slot_answers.
  }

  return { slots, slot_answers: slotAnswers };
}

export function generateSlotValuesForRearrangement(
  equation,
  subject,
  ranges = {},
  constants = {},
  rng = Math.random
) {
  const template = getSubstitutionTemplate(equation);
  if (!template) throw new Error(`No template for "${equation?.id}"`);

  const resultSlot = identifyResultSlot(template);
  const slotIds = getSlotIdsFromTemplate(template).filter((id) => id !== subject);
  const slots = {};
  const slotAnswers = {};

  for (const id of slotIds) {
    if (id === resultSlot && subject !== resultSlot) {
      fillSlotValue(id, ranges, constants, rng, slotAnswers, slots);
      continue;
    }
    if (id !== resultSlot) {
      fillSlotValue(id, ranges, constants, rng, slotAnswers, slots);
    }
  }

  if (resultSlot && resultSlot !== subject && !slots[resultSlot]) {
    fillSlotValue(resultSlot, ranges, constants, rng, slotAnswers, slots);
  }

  const answer = solveForSubject(equation, slots, subject);
  if (!Number.isFinite(answer)) {
    throw new Error(`Could not solve for ${subject} in "${equation.id}"`);
  }

  slots[subject] = String(answer);
  // Unknown is not substituted by the student — omit from substitution slot_answers.

  return {
    slots,
    slot_answers: slotAnswers,
    answer,
    unit: getSubjectUnit(equation, subject),
    rearrangement_subject: subject
  };
}

function applyConversionRule(slots, slotAnswers, id, siValue, rule) {
  const displayVal = conversionDisplayValue(siValue, rule.factor);
  if (!conversionDisplayOk(displayVal)) {
    throw new Error(`Conversion display value out of range for slot "${id}"`);
  }
  const converted = Math.round(displayVal * rule.factor * 1e6) / 1e6;

  const siSlotAnswers = {};
  for (const [slotId, vals] of Object.entries(slotAnswers || {})) {
    siSlotAnswers[slotId] = Array.isArray(vals) ? [...vals] : [String(vals)];
  }
  siSlotAnswers[id] = [String(converted)];

  return {
    slots: { ...slots, [id]: String(converted) },
    slot_answers: { ...slotAnswers, [id]: [String(converted)] },
    si_slot_answers: siSlotAnswers,
    conversion: {
      label: `Convert ${displayVal} ${rule.fromUnit} to ${rule.toUnit}`,
      answer: converted,
      tolerance: 0.001,
      slot_id: id,
      display_value: displayVal,
      display_factor: rule.factor,
      from_unit: rule.fromUnit,
      to_unit: rule.toUnit
    },
    promptOverrides: { [id]: `${displayVal} ${rule.fromUnit}` },
    conversionMeta: {
      slotId: id,
      fromUnit: rule.fromUnit,
      toUnit: rule.toUnit,
      factor: rule.factor
    }
  };
}

function conversionDisplayValue(siValue, factor) {
  const raw = siValue / factor;
  if (!Number.isFinite(raw) || raw <= 0) return NaN;
  if (raw >= 10) return Math.round(raw * 10) / 10;
  if (raw >= 1) return Math.round(raw * 100) / 100;
  if (raw >= 0.1) return Math.round(raw * 1000) / 1000;
  return Math.round(raw * 10000) / 10000;
}

function conversionDisplayOk(displayVal) {
  return Number.isFinite(displayVal) && displayVal >= 0.001 && displayVal <= 1e6;
}

/** Slots used to solve for an unknown — omit the subject so stale values cannot confuse the solver. */
export function rearrangementSolveSlots(slots, subject) {
  const solveSlots = { ...slots };
  delete solveSlots[subject];
  return solveSlots;
}

function canSolveForRearrangementSubject(equation, slots, subject) {
  try {
    const ans = solveForSubject(equation, rearrangementSolveSlots(slots, subject), subject);
    return Number.isFinite(ans) && ans > 0;
  } catch {
    return false;
  }
}

function conversionKeepsRearrangementSolvable(equation, slots, slotAnswers, pick, rearrSubject) {
  const trial = applyConversionRule(slots, slotAnswers, pick.id, pick.si, pick.rule);
  return canSolveForRearrangementSubject(equation, trial.slots, rearrSubject);
}

export function buildConversionStep(equation, slots, slotAnswers, rng = Math.random, options = {}) {
  const exclude = new Set((options.excludeSlotIds || []).filter(Boolean));
  const rearrSubject = options.rearrangementSubject || null;
  const template = getSubstitutionTemplate(equation);
  const resultSlot = identifyResultSlot(template);
  let slotIds = getSlotIdsFromTemplate(template);
  if (rearrSubject) {
    slotIds = slotIds.filter((id) => id !== rearrSubject);
  } else if (resultSlot) {
    slotIds = slotIds.filter((id) => id !== resultSlot);
  }
  slotIds = slotIds.filter((id) => !exclude.has(id));

  const candidates = [];
  for (const id of slotIds) {
    const si = slotNumericValue(slots, id);
    if (!Number.isFinite(si) || si <= 0) continue;
    for (const rule of CONVERSION_CATALOG) {
      if (rule.slotPattern.test(id)) {
        const displayVal = conversionDisplayValue(si, rule.factor);
        if (conversionDisplayOk(displayVal)) {
          candidates.push({ id, rule, si });
        }
      }
    }
  }

  if (candidates.length) {
    let pool = candidates;
    if (options.rearrangementSubject) {
      const viable = candidates.filter((pick) =>
        conversionKeepsRearrangementSolvable(
          equation,
          slots,
          slotAnswers,
          pick,
          options.rearrangementSubject
        )
      );
      if (!viable.length) {
        return {
          slots,
          slot_answers: slotAnswers,
          conversion: null,
          promptOverrides: {},
          conversionMeta: null
        };
      }
      pool = viable;
    }
    const pick = pool[Math.floor(rng() * pool.length)];
    return applyConversionRule(slots, slotAnswers, pick.id, pick.si, pick.rule);
  }

  return { slots, slot_answers: slotAnswers, conversion: null, promptOverrides: {}, conversionMeta: null };
}

/**
 * Fill a prompt template. Overrides may include alternate units and replace any
 * trailing SI unit token after the placeholder (e.g. "{s} m" → "7500 cm").
 */
function fillPromptTemplate(template, slots, promptOverrides = {}) {
  return template.replace(/\{(\w+)\}(?:\s+([^\s.,;!?]+))?/g, (match, key, unit) => {
    if (promptOverrides?.[key]) return String(promptOverrides[key]).trim();
    const value = slots[key] ?? "?";
    return unit != null ? `${value} ${unit}` : String(value);
  });
}

/** Value + unit for a given slot (uses conversion override when present). */
function formatSlotQuantity(id, slots, promptOverrides, ctx = {}) {
  if (promptOverrides?.[id]) return String(promptOverrides[id]).trim();
  if (id === "efficiency" && ctx.efficiencyAsPercentage) {
    return `${efficiencyDecimalToDisplay(slots[id])}%`;
  }
  const unit = resolveSlotUnit(ctx.equation, id);
  const val = slots[id] ?? "?";
  return unit ? `${val} ${unit}` : String(val);
}

/** Natural-English clause for a given quantity, e.g. "the force is 65 N". */
function formatGivenSlotPhrase(id, slots, promptOverrides, ctx = {}) {
  const slotLabel = getSlotPromptLabel(id, ctx.equation);
  const quantity = formatSlotQuantity(id, slots, promptOverrides, ctx);
  return `the ${slotLabel} is ${quantity}`;
}

function joinEnglishList(parts) {
  if (!parts.length) return "the values given";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function buildRearrangementPrompt(equation, subject, slots, promptOverrides, ctx = {}) {
  const label = getSlotPromptLabel(subject, equation);
  const template = getSubstitutionTemplate(equation);
  const parts = getSlotIdsFromTemplate(template)
    .filter((id) => id !== subject)
    .map((id) => formatGivenSlotPhrase(id, slots, promptOverrides, { ...ctx, equation }));

  return `Calculate the ${label} when ${joinEnglishList(parts)}.`;
}

function buildFallbackPrompt(equation, slots, promptOverrides, ctx = {}) {
  const subTemplate = getSubstitutionTemplate(equation);
  const parts = getSlotIdsFromTemplate(subTemplate)
    .filter((id) => id !== identifyResultSlot(subTemplate))
    .map((id) => formatGivenSlotPhrase(id, slots, promptOverrides, ctx));
  return `Calculate the ${getEquationPromptLabel(equation)} when ${joinEnglishList(parts)}.`;
}

export function buildPrompt(equation, baseVariant, slots, ctx = {}) {
  const {
    promptOverrides = {},
    equationGiven = true,
    rearrangementSubject = null,
    customTemplate = null,
    includeRearrangement = false,
    sigFigsCount = null,
    efficiencyAsPercentage: efficiencyPct = false
  } = ctx;

  const solvingForUnknown = includeRearrangement || (baseVariant === "rearrangement" && rearrangementSubject);
  const promptCtx = { equation, efficiencyAsPercentage: efficiencyPct };

  let text;
  if (customTemplate) {
    text = fillPromptTemplate(customTemplate, slots, promptOverrides);
  } else if (solvingForUnknown && rearrangementSubject) {
    text = buildRearrangementPrompt(equation, rearrangementSubject, slots, promptOverrides, promptCtx);
  } else if (PROMPT_TEMPLATES[equation.id]) {
    text = fillPromptTemplate(PROMPT_TEMPLATES[equation.id], slots, promptOverrides);
  } else {
    text = buildFallbackPrompt(equation, slots, promptOverrides, promptCtx);
  }

  const showLatex = equationGiven && equation.latex && baseVariant !== "equation_recall" && baseVariant !== "recall";
  if (showLatex) {
    text += formatEquationLatexBlock(equation.latex);
  }

  if (
    efficiencyPct
    && isEfficiencyEquation(equation)
    && isEfficiencyResultAnswer(equation, rearrangementSubject)
  ) {
    text += "\n\nGive your answer as a percentage.";
  }

  if (sigFigsCount != null && sigFigsCount > 0) {
    text += `\n\nGive your answer to ${sigFigsCount} significant figures.`;
  }

  return text;
}

/** Auto-suggest MS/WS codes from calculation steps (includes MS3a for all). */
export function suggestBatchSkills(draft, subject = "physics") {
  const q = {
    ...draft.question,
    subject,
    calculation_config: draft.question?.calculation_config
  };
  const suggested = suggestSkillsForQuestion(q);
  const ms = new Set(suggested.ms);
  ms.add("MS3a");
  return {
    ms: [...ms],
    ws: [...suggested.ws],
    sources: suggested.sources
  };
}

export async function loadEquationSheet(sheetId, baseUrl = "") {
  await initSubstitutionTemplateCatalog(baseUrl);
  const prefix = baseUrl.replace(/\/?$/, "/");
  const res = await fetch(`${prefix}data/equation_sheets/${sheetId}.json`);
  if (!res.ok) throw new Error(`Failed to load equation sheet "${sheetId}": ${res.status}`);
  const data = await res.json();
  return enrichEquationSheet({ id: data.id || sheetId, equations: data.equations || [], ...data });
}

export function findEquationByTopic(sheet, topic) {
  if (!topic || !sheet?.equations) return null;
  const needle = String(topic).toLowerCase();
  return sheet.equations.find((eq) =>
    (eq.topic_tags || []).some((t) => String(t).toLowerCase() === needle)
  ) || null;
}

function resolveSheetId(spec) {
  if (spec.sheet) return spec.sheet;
  return resolveEquationSheetId({
    subject: spec.subject || "physics",
    paper: spec.paper || "paper1",
    tier: spec.tier === "HT" || spec.tier === "higher" ? "higher" : spec.tier === "FT" ? "foundation" : "both",
    courseTrack: spec.courseTrack || spec.course_track || "combined"
  });
}

function slotAnswersForConfig(slot_answers) {
  const out = {};
  for (const [id, vals] of Object.entries(slot_answers || {})) {
    out[id] = Array.isArray(vals) ? vals : [String(vals)];
  }
  return out;
}

/** SI unit for a template slot (for conversion dropdowns and typed values). */
export function getSlotSiUnit(slotId, equation = null) {
  if (equation?.id === "density" && slotId === "V") return "m³";
  if (SUBJECT_UNITS[slotId]) return SUBJECT_UNITS[slotId];
  if (/^(E_k|E_e|E_p|delta_E|E_useful|E_in)$/.test(slotId)) return "J";
  if (/^(P|P_useful|P_in)$/.test(slotId)) return "W";
  return "";
}

function normalizeUnitToken(token) {
  const compact = String(token || "").replace(/\s+/g, "");
  if (!compact) return "";
  return UNIT_ALIASES[compact.toLowerCase()] || compact;
}

/**
 * Parse a batch slot value like "0.5 cm" or "12kJ" into display number + unit.
 * Returns null when input is empty.
 */
export function parseSlotDisplayInput(raw, slotId, existingEdit = null) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(.*)$/);
  if (!match) return { display: trimmed };

  const display = match[1];
  const unitToken = normalizeUnitToken(match[2]);
  const unitOptions = existingEdit?.unitOptions || listConversionUnitOptions(slotId);
  const siUnit = getSlotSiUnit(slotId) || unitOptions.find((o) => o.isSi)?.fromUnit || unitOptions[0]?.toUnit || "";

  if (!unitToken) {
    const unit = existingEdit?.unit || siUnit;
    const opt = unitOptions.find((o) => o.fromUnit === unit);
    return {
      display,
      unit,
      factor: opt?.factor ?? existingEdit?.factor ?? 1,
      toUnit: opt?.toUnit ?? existingEdit?.toUnit ?? siUnit
    };
  }

  const opt = unitOptions.find(
    (o) => o.fromUnit === unitToken || o.fromUnit.toLowerCase() === unitToken.toLowerCase()
  );
  if (opt) {
    return { display, unit: opt.fromUnit, factor: opt.factor, toUnit: opt.toUnit };
  }

  return { display, unit: unitToken, factor: 1, toUnit: siUnit || unitToken };
}

/** Unit conversion options for a slot (for admin batch editor). */
export function listConversionUnitOptions(slotId, equation = null) {
  const options = [];
  const seen = new Set();
  const add = (rule) => {
    if (seen.has(rule.fromUnit)) return;
    seen.add(rule.fromUnit);
    options.push({ fromUnit: rule.fromUnit, toUnit: rule.toUnit, factor: rule.factor });
  };
  for (const rule of CONVERSION_CATALOG) {
    if (rule.slotPattern.test(slotId)) add(rule);
  }
  const siUnit = getSlotSiUnit(slotId, equation);
  if (siUnit && !seen.has(siUnit)) {
    options.unshift({ fromUnit: siUnit, toUnit: siUnit, factor: 1, isSi: true });
  }
  return options;
}

export function getDraftGivenSlotIds(draft, equation) {
  const template = getSubstitutionTemplate(equation);
  if (!template) return [];
  const resultSlot = identifyResultSlot(template);
  const withRearr = variantIncludesRearrangement(draft.variant);
  const subject = draft.rearrangement_subject;

  let ids = getSlotIdsFromTemplate(template);
  if (withRearr && subject) {
    ids = ids.filter((id) => id !== subject);
  } else if (resultSlot) {
    ids = ids.filter((id) => id !== resultSlot);
  }
  return ids;
}

function normalizeVariantBase(base) {
  if (base === "substitute" || base === "substitution_only") return "substitute";
  if (base === "recall" || base === "equation_recall" || base === "rearrangement") return "recall";
  return "substitute";
}

function variantIncludesRearrangement(variantDesc) {
  if (!variantDesc) return false;
  if (variantDesc.rearrangement) return true;
  return variantDesc.base === "rearrangement";
}

/** HT batch numerics always recall from equation sheet; FT may use substitute (equation given). */
export function resolveBatchBaseVariant(spec, variantDesc) {
  const base = normalizeVariantBase(variantDesc?.base);
  const isHt = normalizeQuestionTier(spec?.tier || "both") === "HT";
  if (isHt && base === "substitute") return "recall";
  return base;
}

/**
 * Infer demand_level for batch drafts.
 * FT: substitute+answer (2m) → low; recall+answer (2m) → standard; +optional steps → standard.
 * HT: always recall path — 2–3 marks → standard_45; 4–5 marks (2+ optional steps) → standard_67.
 */
export function inferBatchDemandLevel(variantDesc, questionMeta = {}, spec = {}) {
  if (spec.demand_level) return spec.demand_level;

  const tier = spec.tier || questionMeta.tier || "both";
  const isHt = normalizeQuestionTier(tier) === "HT";
  const base = resolveBatchBaseVariant({ tier }, variantDesc);
  const withRearr = variantIncludesRearrangement(variantDesc);
  const withConv = !!variantDesc?.unitConversion;
  const withSf = !!variantDesc?.sigFigs;
  const extraSteps = (withRearr ? 1 : 0) + (withConv ? 1 : 0) + (withSf ? 1 : 0);
  const maxMarks = questionMeta.maxMarks;

  if (isHt) {
    if ((maxMarks != null && maxMarks >= 4) || extraSteps >= 2) return "standard_67";
    return "standard_45";
  }

  if (base === "recall") return "standard";
  if (extraSteps >= 2) return "standard";
  if (extraSteps === 1) return "standard";
  return "low";
}

function roundDisplayValue(n) {
  if (!Number.isFinite(n)) return "";
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000) / 1000);
}

function siFromSlotEdit(edit) {
  const display = parseFloat(edit.display);
  const factor = edit.factor ?? 1;
  if (!Number.isFinite(display)) return NaN;
  return Math.round(display * factor * 1e6) / 1e6;
}

/** Keep SI value fixed when the author picks a different display unit in the batch editor. */
export function applySlotUnitChange(edit, fromUnit) {
  const opt = (edit.unitOptions || []).find((o) => o.fromUnit === fromUnit);
  if (!opt) return false;
  const si = siFromSlotEdit(edit);
  edit.unit = opt.fromUnit;
  edit.factor = opt.factor;
  edit.toUnit = opt.toUnit;
  if (Number.isFinite(si)) {
    edit.display = roundDisplayValue(si / opt.factor);
  }
  return true;
}

export function buildSlotEdits(equation, slots, promptOverrides, conversionMeta, givenSlotIds) {
  const edits = {};
  for (const id of givenSlotIds) {
    const si = slotNumericValue(slots, id);
    const unitOptions = listConversionUnitOptions(id, equation);
    const siUnit = getSlotSiUnit(id, equation) || unitOptions.find((o) => o.isSi)?.fromUnit || unitOptions[0]?.toUnit || "";
    const hasAltUnits = unitOptions.some((o) => !o.isSi && o.factor !== 1);

    if (conversionMeta?.slotId === id) {
      edits[id] = {
        display: roundDisplayValue(si / conversionMeta.factor),
        unit: conversionMeta.fromUnit,
        si: String(si),
        factor: conversionMeta.factor,
        toUnit: conversionMeta.toUnit,
        convertible: hasAltUnits,
        unitOptions,
        isConversionSlot: true
      };
      continue;
    }

    if (promptOverrides?.[id]) {
      const parsed = parseSlotDisplayInput(promptOverrides[id], id, { unitOptions });
      if (parsed) {
        edits[id] = {
          display: parsed.display,
          unit: parsed.unit,
          si: String(si),
          factor: parsed.factor ?? 1,
          toUnit: parsed.toUnit ?? siUnit,
          convertible: hasAltUnits,
          unitOptions,
          isConversionSlot: false
        };
        continue;
      }
    }

    edits[id] = {
      display: roundDisplayValue(si),
      unit: siUnit,
      si: String(si),
      factor: 1,
      toUnit: siUnit,
      convertible: hasAltUnits,
      unitOptions,
      isConversionSlot: false
    };
  }
  return edits;
}

function syncConversionMetaFromEdits(draft) {
  if (!draft?.variant?.unitConversion || !draft.slot_edits) return;
  if (draft._conversionMeta?.slotId) {
    const active = draft.slot_edits[draft._conversionMeta.slotId];
    if (active?.factor && active.factor !== 1) {
      draft._conversionMeta = {
        slotId: draft._conversionMeta.slotId,
        fromUnit: active.unit,
        toUnit: active.toUnit,
        factor: active.factor
      };
      return;
    }
  }
  for (const [slotId, edit] of Object.entries(draft.slot_edits)) {
    if (edit.factor && edit.factor !== 1) {
      draft._conversionMeta = {
        slotId,
        fromUnit: edit.unit,
        toUnit: edit.toUnit,
        factor: edit.factor
      };
      for (const [id, e] of Object.entries(draft.slot_edits)) {
        e.isConversionSlot = id === slotId;
      }
      return;
    }
  }
}

export function recomputeBatchDraft(draft, equation, sheet) {
  if (!draft?.slot_edits || !equation) return draft;

  syncConversionMetaFromEdits(draft);

  const baseVariant = normalizeVariantBase(draft.variant?.base || "substitute");
  const withRearrangement = variantIncludesRearrangement(draft.variant);
  const rearrangementSubject = draft.rearrangement_subject;
  const spec = draft._sourceSpec || {};
  const slots = {};
  const slot_answers = {};
  const si_slot_answers = {};
  const promptOverrides = {};

  for (const [id, edit] of Object.entries(draft.slot_edits)) {
    const si = siFromSlotEdit(edit);
    if (!Number.isFinite(si)) continue;
    edit.si = String(si);
    slots[id] = String(si);
    si_slot_answers[id] = [String(si)];
    slot_answers[id] = [String(si)];
    if (draft._conversionMeta?.slotId === id) {
      promptOverrides[id] = `${edit.display} ${edit.unit}`;
    }
  }

  let answer;
  let unit;

  if (withRearrangement && rearrangementSubject) {
    const solveSlots = rearrangementSolveSlots(slots, rearrangementSubject);
    answer = solveForSubject(equation, solveSlots, rearrangementSubject);
    slots[rearrangementSubject] = String(answer);
    si_slot_answers[rearrangementSubject] = [String(answer)];
    unit = getSubjectUnit(equation, rearrangementSubject);
  } else {
    const ev = evaluateEquation(equation, slots);
    answer = ev.answer;
    unit = ev.unit;
  }

  const effFmt = finalizeEfficiencyAnswer(answer, equation, spec, rearrangementSubject);
  answer = effFmt.answer;
  unit = spec.unit || effFmt.unit || unit;

  let conversion = null;
  if (draft._conversionMeta?.slotId) {
    const { slotId, fromUnit, toUnit, factor } = draft._conversionMeta;
    const edit = draft.slot_edits[slotId];
    const si = slotNumericValue(slots, slotId);
    if (edit && Number.isFinite(si)) {
      conversion = {
        label: `Convert ${edit.display} ${fromUnit} to ${toUnit}`,
        answer: si,
        tolerance: 0.001,
        slot_id: slotId,
        display_value: parseFloat(edit.display),
        display_factor: factor,
        from_unit: fromUnit,
        to_unit: toUnit
      };
      promptOverrides[slotId] = `${edit.display} ${fromUnit}`;
    }
  }

  const sigFigsN = draft.variant?.sigFigs ? (spec.sig_figs_count ?? 2) : null;

  let calcConfig = buildCalculationConfigForVariant(baseVariant, {
    equationId: equation.id,
    sheetId: spec.sheetId || sheet?.id,
    slotAnswers: slotAnswersForConfig(slot_answers),
    siSlotAnswers: slotAnswersForConfig(si_slot_answers),
    conversion,
    sigFigs: sigFigsN,
    rearrangementSubject,
    includeRearrangement: withRearrangement
  });
  calcConfig = finalizeCalculationConfigForSave(calcConfig, sheet?.equations || []);
  calcConfig = applyDefaultStepFeedbackToConfig(calcConfig, {
    equation,
    equationSheet: sheet,
    answer,
    unit: spec.unit || unit,
    slotEdits: draft.slot_edits,
    promptOverrides,
    rearrangementSubject
  }, { overwrite: true });

  if (!draft._promptManuallyEdited) {
    draft.question.prompt = buildPrompt(equation, baseVariant, slots, {
      promptOverrides,
      equationGiven: calcConfig.equation_given !== false,
      rearrangementSubject,
      includeRearrangement: withRearrangement,
      sigFigsCount: sigFigsN,
      efficiencyAsPercentage: efficiencyAsPercentage(spec)
    });
    draft._autoPrompt = draft.question.prompt;
  }

  draft.question.max_marks = computeMaxMarksFromConfig(calcConfig);
  draft.question.calculation_config = calcConfig;
  draft.answer_key.key_payload.answer = answer;
  draft.answer_key.key_payload.exact_answer = answer;
  draft.answer_key.key_payload.unit = spec.unit || unit;
  draft.answer_key.key_payload.tolerance = spec.tolerance ?? defaultTolerance(answer);
  draft._debug = { slots, exact_answer: answer };

  const suggested = suggestBatchSkills(draft, spec.subject || "physics");
  const manualMs = (draft.skill_codes?.ms || []).filter((c) => !(draft._autoMs || []).includes(c));
  const manualWs = (draft.skill_codes?.ws || []).filter((c) => !(draft._autoWs || []).includes(c));
  draft._autoMs = suggested.ms;
  draft._autoWs = suggested.ws;
  draft.skill_codes = {
    ms: [...new Set([...suggested.ms, ...manualMs])],
    ws: [...new Set([...suggested.ws, ...manualWs])]
  };

  return draft;
}

function defaultTolerance(answer) {
  if (!Number.isFinite(answer)) return 0;
  if (Number.isInteger(answer)) return 0;
  return Math.max(0.01, Math.abs(answer) * 0.01);
}

export function generateNumericQuestion(spec, variantDesc, sheet, rng = Math.random) {
  const equationId = spec.equation;
  const equation = equationId
    ? findEquationInSheet(sheet, equationId)
    : findEquationByTopic(sheet, spec.topic);

  if (!equation) throw new Error(`Equation not found: ${equationId || spec.topic}`);
  if (!getSubstitutionTemplate(equation)) {
    throw new Error(`No substitution template for "${equation.id}" — not supported in batch v1`);
  }

  const sheetId = resolveSheetId(spec);
  const baseVariant = resolveBatchBaseVariant(spec, variantDesc);
  const withRearrangement = variantIncludesRearrangement(variantDesc);
  const needsConversion = !!variantDesc.unitConversion;
  const maxSlotAttempts = withRearrangement && needsConversion ? 24 : 1;

  let rearrangementSubject = null;
  let slots;
  let slot_answers;
  let answer;
  let unit;
  let conversion = null;
  let promptOverrides = {};
  let conversionMeta = null;
  let si_slot_answers;

  if (withRearrangement) {
    rearrangementSubject = spec.rearrangement_subject
      || pickRearrangementSubject(equation, rng, spec.rearrangement_subject);
  }

  let lastSlotErr = null;
  for (let attempt = 0; attempt < maxSlotAttempts; attempt++) {
    try {
      if (withRearrangement) {
        const rearr = generateSlotValuesForRearrangement(
          equation,
          rearrangementSubject,
          spec.ranges || {},
          spec.constants || {},
          rng
        );
        slots = rearr.slots;
        slot_answers = rearr.slot_answers;
        answer = rearr.answer;
        unit = rearr.unit;
      } else {
        const gen = generateSlotValues(equation, spec.ranges || {}, spec.constants || {}, rng);
        slots = gen.slots;
        slot_answers = gen.slot_answers;
        const ev = evaluateEquation(equation, slots);
        answer = ev.answer;
        unit = ev.unit;
      }

      conversion = null;
      promptOverrides = {};
      conversionMeta = null;
      si_slot_answers = slot_answers;

      if (needsConversion) {
        const conv = buildConversionStep(equation, slots, slot_answers, rng, {
          excludeSlotIds: rearrangementSubject ? [rearrangementSubject] : [],
          rearrangementSubject: rearrangementSubject || null
        });
        slots = conv.slots;
        slot_answers = conv.slot_answers;
        si_slot_answers = conv.si_slot_answers || slot_answers;
        conversion = conv.conversion;
        promptOverrides = conv.promptOverrides || {};
        conversionMeta = conv.conversionMeta || null;
        if (!conversion) {
          throw new Error(
            `Could not build unit conversion for "${equation.id}" — no suitable quantity with a positive value`
          );
        }
        if (withRearrangement && rearrangementSubject) {
          answer = solveForSubject(
            equation,
            rearrangementSolveSlots(slots, rearrangementSubject),
            rearrangementSubject
          );
          if (!Number.isFinite(answer) || answer <= 0) {
            throw new Error(`Could not solve for ${rearrangementSubject} in "${equation.id}"`);
          }
          slots[rearrangementSubject] = String(answer);
          unit = getSubjectUnit(equation, rearrangementSubject);
        } else {
          answer = evaluateEquation(equation, slots).answer;
        }
      }

      lastSlotErr = null;
      break;
    } catch (err) {
      lastSlotErr = err;
    }
  }
  if (lastSlotErr) throw lastSlotErr;

  const effFmt = finalizeEfficiencyAnswer(answer, equation, spec, rearrangementSubject);
  answer = effFmt.answer;
  unit = spec.unit || effFmt.unit || unit;

  const sigFigsN = variantDesc.sigFigs ? (spec.sig_figs_count ?? 2) : null;

  let calcConfig = buildCalculationConfigForVariant(baseVariant, {
    equationId: equation.id,
    sheetId,
    slotAnswers: slotAnswersForConfig(slot_answers),
    siSlotAnswers: slotAnswersForConfig(si_slot_answers),
    conversion,
    sigFigs: sigFigsN,
    rearrangementSubject,
    includeRearrangement: withRearrangement
  });

  calcConfig = finalizeCalculationConfigForSave(calcConfig, sheet.equations || []);

  const equationGiven = calcConfig.equation_given !== false;

  const prompt = buildPrompt(equation, baseVariant, slots, {
    promptOverrides,
    equationGiven,
    rearrangementSubject,
    includeRearrangement: withRearrangement,
    sigFigsCount: sigFigsN,
    efficiencyAsPercentage: efficiencyAsPercentage(spec)
  });

  const maxMarks = computeMaxMarksFromConfig(calcConfig);
  const tolerance = spec.tolerance ?? defaultTolerance(answer);
  const demandLevel = inferBatchDemandLevel(variantDesc, { tier: spec.tier, maxMarks }, spec);

  const draft = {
    variant: variantDesc,
    equation_id: equation.id,
    rearrangement_subject: rearrangementSubject,
    question: {
      question_type: "numeric",
      prompt,
      tier: normalizeQuestionTierForDb(spec.tier || "both"),
      audience: spec.audience || "both",
      marking_method: "numeric",
      max_marks: maxMarks,
      calculation_config: calcConfig,
      command_word: spec.command_word || "calculate",
      demand_level: demandLevel,
      ao1_marks: 0,
      ao2_marks: maxMarks,
      ao3_marks: 0,
      is_maths_skill: true,
      is_required_practical: false
    },
    answer_key: {
      key_type: "numeric",
      key_payload: { answer, exact_answer: answer, tolerance, unit: spec.unit || unit }
    },
    skill_codes: { ws: spec.ws_skills || spec.ws || [], ms: spec.ms_skills || spec.ms || [] },
    _debug: { slots, exact_answer: answer }
  };

  const suggested = suggestBatchSkills(draft, spec.subject || "physics");
  const manualMs = draft.skill_codes.ms || [];
  const manualWs = draft.skill_codes.ws || [];
  draft._autoMs = suggested.ms;
  draft._autoWs = suggested.ws;
  draft.skill_codes = {
    ms: [...new Set([...suggested.ms, ...manualMs])],
    ws: [...new Set([...suggested.ws, ...manualWs])]
  };
  draft._skillSources = suggested.sources;
  draft._conversionMeta = conversionMeta;
  draft._sourceSpec = {
    sheetId,
    subject: spec.subject || "physics",
    tier: spec.tier || "both",
    sig_figs_count: spec.sig_figs_count ?? 2,
    tolerance: spec.tolerance,
    unit: spec.unit,
    efficiency_as_percentage: !!spec.efficiency_as_percentage
  };
  const givenSlotIds = getDraftGivenSlotIds(
    { variant: variantDesc, rearrangement_subject: rearrangementSubject },
    equation
  );
  draft.slot_edits = buildSlotEdits(
    equation,
    slots,
    promptOverrides,
    conversionMeta,
    givenSlotIds
  );
  draft._autoPrompt = prompt;

  draft.question.calculation_config = applyDefaultStepFeedbackToConfig(
    draft.question.calculation_config,
    {
      equation,
      equationSheet: sheet,
      answer,
      unit: spec.unit || unit,
      slotEdits: draft.slot_edits,
      promptOverrides,
      rearrangementSubject
    },
    { overwrite: true }
  );
  draft.question.max_marks = computeMaxMarksFromConfig(draft.question.calculation_config);

  return draft;
}

export function expandVariantDescriptors(variants = {}) {
  if (Array.isArray(variants.recipes) && variants.recipes.length) {
    const list = [];
    for (const recipe of variants.recipes) {
      const count = Math.max(0, parseInt(recipe.count, 10) || 0);
      const rearrangementBase = recipe.base === "rearrangement";
      const base = recipe.base === "recall" || recipe.base === "equation_recall" ? "recall" : "substitute";
      const desc = {
        base,
        rearrangement: !!(recipe.rearrangement ?? recipe.rearrange ?? rearrangementBase),
        unitConversion: !!(recipe.unitConversion ?? recipe.conversion ?? recipe.convert),
        sigFigs: !!(recipe.sigFigs ?? recipe.sig_figs)
      };
      for (let i = 0; i < count; i++) list.push({ ...desc });
    }
    return list;
  }

  const optional = {
    rearrangement: !!(variants.with_rearrangement ?? variants.rearrangement),
    unitConversion: !!(variants.with_conversion ?? variants.unit_conversion),
    sigFigs: !!(variants.with_sig_figs ?? variants.sig_figs)
  };

  if (typeof variants.rearrangement === "number" && variants.rearrangement > 0) {
    optional.rearrangement = true;
  }
  if (typeof variants.unit_conversion === "number" && variants.unit_conversion > 0) {
    optional.unitConversion = true;
  }
  if (typeof variants.sig_figs === "number" && variants.sig_figs > 0) {
    optional.sigFigs = true;
  }

  const list = [];
  const subs = Math.max(
    0,
    parseInt(variants.substitute ?? variants.substitution_only, 10) || 0
  );
  const recall = Math.max(
    0,
    parseInt(variants.recall ?? variants.equation_recall, 10) || 0
  );

  for (let i = 0; i < subs; i++) {
    list.push({ base: "substitute", ...optional });
  }
  for (let i = 0; i < recall; i++) {
    list.push({ base: "recall", ...optional });
  }

  return list;
}

export function generateBatch(spec, preloadedSheet = null) {
  const seed = spec.seed != null ? spec.seed : Date.now();
  const rng = mulberry32(seed);
  const descriptors = expandVariantDescriptors(spec.variants || {});

  if (!descriptors.length) {
    return { drafts: [], errors: [{ message: "No variants requested (all counts are 0)" }] };
  }

  const sheet = preloadedSheet;
  if (!sheet?.equations?.length) {
    return {
      drafts: [],
      errors: [{ message: "Equation sheet not loaded — call loadEquationSheet first or pass preloadedSheet" }]
    };
  }

  const drafts = [];
  const errors = [];

  for (const desc of descriptors) {
    try {
      drafts.push(generateNumericQuestion(spec, desc, sheet, rng));
    } catch (err) {
      errors.push({ variant: desc, message: err.message || String(err) });
    }
  }

  return { drafts, errors, seed };
}

export async function generateBatchAsync(spec, baseUrl = "") {
  const sheetId = resolveSheetId(spec);
  if (!sheetId) {
    return { drafts: [], errors: [{ message: "Could not resolve equation sheet id from spec" }] };
  }
  const sheet = await loadEquationSheet(sheetId, baseUrl);
  return generateBatch(spec, sheet);
}

export function summarizeDraftSteps(draft) {
  const steps = draft?.question?.calculation_config?.steps || [];
  return steps
    .filter((s) => s.required !== false)
    .map((s) => s.type)
    .join(" → ");
}

export function listRearrangementSubjects(equation) {
  return listRearrangementSubjectIds(equation);
}
