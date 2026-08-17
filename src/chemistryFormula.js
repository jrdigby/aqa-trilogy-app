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

/** Stem line: "Relative atomic mass (Ar):     Mg = 24". */
export function formatArStem(arMap) {
  return `Relative atomic mass (Ar):     ${formatArList(arMap)}`;
}

/**
 * Stem line: "Relative formula mass (Mr):    MgCl2 = 95".
 * @param {{ formulaDisplay: string, mr: number|string }[]} entries
 */
export function formatMrStem(entries) {
  const list = Array.isArray(entries) ? entries : [entries];
  const body = list
    .filter(Boolean)
    .map((e) => `${e.formulaDisplay} = ${e.mr}`)
    .join(", ");
  return `Relative formula mass (Mr):    ${body}`;
}

/** GCSE Avogadro constant (per mole). */
export const AVOGADRO_CONSTANT = 6.02e23;

const METAL_ELEMENTS = new Set(["Li", "Be", "Na", "Mg", "Al", "K", "Ca", "Fe", "Cu", "Zn"]);
const DIATOMIC_ELEMENTS = new Set(["H", "N", "O", "F", "Cl", "Br", "I"]);

/**
 * Particle noun for Avogadro questions: atoms / molecules / ions.
 * Ionic (metal or ammonium) → ions; monatomic element → atoms; else molecules.
 */
export function particleKind(formula) {
  const counts = parseFormula(formula);
  const els = Object.keys(counts);
  const totalAtoms = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (els.length === 1) {
    const el = els[0];
    if (totalAtoms === 2 && DIATOMIC_ELEMENTS.has(el)) {
      return { noun: "molecules", kind: "molecule" };
    }
    return { noun: "atoms", kind: "atom" };
  }
  if (els.some((el) => METAL_ELEMENTS.has(el)) || counts.N && counts.H >= 4) {
    return { noun: "ions", kind: "ion" };
  }
  return { noun: "molecules", kind: "molecule" };
}

/** N = n × NA */
export function particlesFromMoles(n, na = AVOGADRO_CONSTANT) {
  const moles = Number(n);
  const avogadro = Number(na);
  if (!Number.isFinite(moles) || !Number.isFinite(avogadro)) {
    throw new Error("Invalid moles or Avogadro constant");
  }
  return moles * avogadro;
}

/** n = N ÷ NA */
export function molesFromParticles(particleCount, na = AVOGADRO_CONSTANT) {
  const N = Number(particleCount);
  const avogadro = Number(na);
  if (!Number.isFinite(N) || !Number.isFinite(avogadro) || avogadro === 0) {
    throw new Error("Invalid particle count or Avogadro constant");
  }
  return N / avogadro;
}

/** n = m / Mr */
export function molesFromMass(mass, mr) {
  const m = Number(mass);
  const M = Number(mr);
  if (!Number.isFinite(m) || !Number.isFinite(M) || M === 0) {
    throw new Error("Invalid mass or Mr for moles calculation");
  }
  return m / M;
}

/** m = n × Mr */
export function massFromMoles(n, mr) {
  const moles = Number(n);
  const M = Number(mr);
  if (!Number.isFinite(moles) || !Number.isFinite(M)) {
    throw new Error("Invalid moles or Mr for mass calculation");
  }
  return moles * M;
}

/** Scale moles of A to moles of B using equation coefficients. */
export function scaleByMoleRatio(nGiven, coeffGiven, coeffFind) {
  const n = Number(nGiven);
  const a = Number(coeffGiven);
  const b = Number(coeffFind);
  if (!Number.isFinite(n) || !Number.isFinite(a) || !Number.isFinite(b) || a === 0) {
    throw new Error("Invalid mole ratio");
  }
  return n * (b / a);
}

/** Moles of substance divided by its equation coefficient (extent of reaction). */
export function equivalentMoles(n, coeff) {
  const moles = Number(n);
  const c = Number(coeff);
  if (!Number.isFinite(moles) || !Number.isFinite(c) || c === 0) {
    throw new Error("Invalid equivalent moles");
  }
  return moles / c;
}

/**
 * Identify the limiting reactant: smallest n / coeff.
 * @param {{ id: string, moles: number, coeff: number }[]} reactants
 * @returns {string} id of the limiting species
 */
export function identifyLimitingReactant(reactants) {
  if (!Array.isArray(reactants) || reactants.length === 0) {
    throw new Error("No reactants to compare");
  }
  let best = null;
  for (const r of reactants) {
    const eq = equivalentMoles(r.moles, r.coeff);
    if (!best || eq < best.eq - 1e-12) {
      best = { id: r.id, eq };
    }
  }
  return best.id;
}
