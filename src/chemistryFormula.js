/**
 * GCSE chemistry formula parsing and relative formula mass helpers.
 * First pass: formulas without brackets (H2O, CaCO3, NH4NO3).
 */

import { ELEMENT_DATA } from "./chemistryWorkflow.js";

/** GCSE relative atomic masses (includes metals used in quantitative chem). */
export const RELATIVE_ATOMIC_MASSES = {
  ...Object.fromEntries(
    Object.entries(ELEMENT_DATA).map(([sym, d]) => [sym, d.A])
  ),
  Fe: 56,
  Cu: 63.5,
  Zn: 65
};

/**
 * Parse a formula with no brackets into { element: count }.
 * @throws {Error} if brackets present or unknown element
 */
export function parseFormula(formula) {
  const raw = String(formula || "").trim();
  if (!raw) throw new Error("Empty formula");
  if (/[()]/.test(raw)) {
    throw new Error(`Bracketed formulas are not supported in this pass: ${raw}`);
  }
  const re = /([A-Z][a-z]?)(\d*)/g;
  const counts = {};
  let lastIndex = 0;
  let m;
  while ((m = re.exec(raw)) !== null) {
    if (m.index !== lastIndex) {
      throw new Error(`Could not parse formula: ${raw}`);
    }
    const el = m[1];
    const n = m[2] ? parseInt(m[2], 10) : 1;
    if (!Number.isFinite(n) || n < 1) {
      throw new Error(`Invalid count in formula: ${raw}`);
    }
    if (RELATIVE_ATOMIC_MASSES[el] == null) {
      throw new Error(`Unknown element in formula: ${el}`);
    }
    counts[el] = (counts[el] || 0) + n;
    lastIndex = re.lastIndex;
  }
  if (lastIndex === 0 || lastIndex !== raw.length) {
    throw new Error(`Could not parse formula: ${raw}`);
  }
  return counts;
}

export function relativeAtomicMass(element) {
  const ar = RELATIVE_ATOMIC_MASSES[element];
  if (ar == null) throw new Error(`Unknown element: ${element}`);
  return ar;
}

/** Relative formula mass (Mr). */
export function relativeFormulaMass(formula) {
  const counts = parseFormula(formula);
  let sum = 0;
  for (const [el, n] of Object.entries(counts)) {
    sum += relativeAtomicMass(el) * n;
  }
  return sum;
}

/** Mass contribution of one element in the formula (n × Ar). */
export function elementMassInCompound(formula, element) {
  const counts = parseFormula(formula);
  const n = counts[element];
  if (!n) throw new Error(`Element ${element} not in ${formula}`);
  return n * relativeAtomicMass(element);
}

/** Percentage by mass of an element in a compound. */
export function percentByMass(formula, element, mr = null) {
  const elemMass = elementMassInCompound(formula, element);
  const formulaMass = mr != null ? Number(mr) : relativeFormulaMass(formula);
  if (!Number.isFinite(formulaMass) || formulaMass === 0) {
    throw new Error("Invalid relative formula mass");
  }
  return (elemMass / formulaMass) * 100;
}

/** Ar values used in a formula, for stem display. */
export function arValuesForFormula(formula) {
  const counts = parseFormula(formula);
  const out = {};
  for (const el of Object.keys(counts)) {
    out[el] = relativeAtomicMass(el);
  }
  return out;
}

/**
 * Common wrong Mr values for MCQ distractors.
 * @returns {number[]} unique wrong values (may be fewer than requested)
 */
export function distractorFormulaMasses(formula, { count = 3 } = {}) {
  const counts = parseFormula(formula);
  const correct = relativeFormulaMass(formula);
  const candidates = new Set();

  // Sum Ar without multiplying by atom counts
  let sumOnce = 0;
  for (const el of Object.keys(counts)) {
    sumOnce += relativeAtomicMass(el);
  }
  candidates.add(sumOnce);

  // Off-by-one on each multi-atom element
  for (const [el, n] of Object.entries(counts)) {
    if (n > 1) {
      candidates.add(correct - relativeAtomicMass(el));
      candidates.add(correct + relativeAtomicMass(el));
    }
  }

  // Double the first element's contribution
  const els = Object.keys(counts);
  if (els.length) {
    const el = els[0];
    candidates.add(correct + relativeAtomicMass(el) * counts[el]);
  }

  // Use integer Ar for Cl if present (35 instead of 35.5)
  if (counts.Cl) {
    candidates.add(correct - 0.5 * counts.Cl);
  }

  const wrong = [...candidates]
    .filter((v) => Number.isFinite(v) && Math.abs(v - correct) > 1e-9)
    .map((v) => (Number.isInteger(v) ? v : Math.round(v * 10) / 10));

  const unique = [];
  for (const v of wrong) {
    if (!unique.some((u) => Math.abs(u - v) < 1e-9)) unique.push(v);
    if (unique.length >= count) break;
  }

  // Pad with simple offsets if needed
  let offset = 1;
  while (unique.length < count) {
    const v = correct + offset * (offset % 2 === 0 ? 1 : -1) * 2;
    offset += 1;
    if (Math.abs(v - correct) < 1e-9) continue;
    if (!unique.some((u) => Math.abs(u - v) < 1e-9)) unique.push(v);
  }

  return unique.slice(0, count);
}

/** Format Ar list for stems: "H = 1, O = 16". */
export function formatArList(arMap) {
  return Object.entries(arMap)
    .map(([el, ar]) => `${el} = ${ar}`)
    .join(", ");
}
