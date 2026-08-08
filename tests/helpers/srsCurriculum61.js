/**
 * Synthetic combined-science curriculum shaped like 19 bio / 21 chem / 21 phys.
 * Spec refs and names are illustrative — not live Supabase IDs.
 */
import { interleaveBySubject } from "../../src/curriculumPace.js";

export const BIOLOGY_COUNT = 19;
export const CHEMISTRY_COUNT = 21;
export const PHYSICS_COUNT = 21;
export const CURRICULUM_61_TOTAL = BIOLOGY_COUNT + CHEMISTRY_COUNT + PHYSICS_COUNT; // 61

const BIOLOGY_TOPICS = [
  ["B4.1.1", "Cell structure"],
  ["B4.1.2", "Cell division"],
  ["B4.1.3", "Transport in cells"],
  ["B4.2.1", "Principles of organisation"],
  ["B4.2.2", "Animal tissues, organs and systems"],
  ["B4.2.3", "Plant tissues, organs and systems"],
  ["B4.3.1", "Communicable diseases"],
  ["B4.3.2", "Monoclonal antibodies"],
  ["B4.3.3", "Plant disease"],
  ["B4.4.1", "Photosynthesis"],
  ["B4.4.2", "Respiration"],
  ["B4.5.1", "Homeostasis"],
  ["B4.5.2", "The human nervous system"],
  ["B4.5.3", "Hormonal coordination"],
  ["B4.6.1", "Reproduction"],
  ["B4.6.2", "Variation and evolution"],
  ["B4.6.3", "Genetics and evolution"],
  ["B4.7.1", "Adaptations and interdependence"],
  ["B4.7.2", "Organisation of an ecosystem"]
];

const CHEMISTRY_TOPICS = [
  ["C5.1.1", "A simple model of the atom"],
  ["C5.1.2", "The periodic table"],
  ["C5.1.3", "Properties of transition metals"],
  ["C5.2.1", "Chemical bonds"],
  ["C5.2.2", "How bonding and structure are related to properties"],
  ["C5.2.3", "Structure and bonding of carbon"],
  ["C5.3.1", "Conservation of mass and quantitative chemistry"],
  ["C5.3.2", "Use of amount of substance"],
  ["C5.3.3", "Yield and atom economy"],
  ["C5.4.1", "Reactivity of metals"],
  ["C5.4.2", "Reactions of acids"],
  ["C5.4.3", "Electrolysis"],
  ["C5.5.1", "Exothermic and endothermic reactions"],
  ["C5.5.2", "Chemical cells and fuel cells"],
  ["C5.6.1", "Rate of reaction"],
  ["C5.6.2", "Reversible reactions and dynamic equilibrium"],
  ["C5.7.1", "Carbon compounds as fuels and feedstock"],
  ["C5.7.2", "Reactions of alkenes and alcohols"],
  ["C5.8.1", "Purity, formulations and chromatography"],
  ["C5.8.2", "Identification of common gases"],
  ["C5.10.1", "Using the Earth's resources"]
];

const PHYSICS_TOPICS = [
  ["P6.1.1", "Energy changes in a system"],
  ["P6.1.2", "Conservation and dissipation of energy"],
  ["P6.1.3", "National and global energy resources"],
  ["P6.2.1", "Current, potential difference and resistance"],
  ["P6.2.2", "Series and parallel circuits"],
  ["P6.2.3", "Domestic uses and safety"],
  ["P6.2.4", "Energy transfers"],
  ["P6.3.1", "Changes of state and the particle model"],
  ["P6.3.2", "Internal energy and energy transfers"],
  ["P6.3.3", "Particle model and pressure"],
  ["P6.4.1", "Atoms and isotopes"],
  ["P6.4.2", "Atoms and nuclear radiation"],
  ["P6.4.3", "Hazards and uses of radioactive emissions"],
  ["P6.5.1", "Forces and their interactions"],
  ["P6.5.2", "Work done and energy transfer"],
  ["P6.5.3", "Forces and elasticity"],
  ["P6.5.4", "Moments, levers and gears"],
  ["P6.5.5", "Pressure and pressure differences in fluids"],
  ["P6.6.1", "Waves in air, fluids and solids"],
  ["P6.6.2", "Electromagnetic waves"],
  ["P6.7.1", "Permanent and induced magnetism"]
];

function buildSubjectPoints(subject, pairs, idPrefix) {
  return pairs.map(([spec_ref, topic_name], i) => ({
    id: `${idPrefix}-${String(i + 1).padStart(2, "0")}`,
    subject,
    spec_ref,
    topic_name
  }));
}

/** Subject-grouped lists (tests / counts). */
export const CURRICULUM_61_BY_SUBJECT = {
  biology: buildSubjectPoints("biology", BIOLOGY_TOPICS, "bio"),
  chemistry: buildSubjectPoints("chemistry", CHEMISTRY_TOPICS, "chem"),
  physics: buildSubjectPoints("physics", PHYSICS_TOPICS, "phys")
};

/**
 * Full 61-point curriculum interleaved Bio → Chem → Phys → Bio → …
 * (matches product intro sequencing).
 */
export const CURRICULUM_61 = interleaveBySubject([
  ...CURRICULUM_61_BY_SUBJECT.biology,
  ...CURRICULUM_61_BY_SUBJECT.chemistry,
  ...CURRICULUM_61_BY_SUBJECT.physics
]);

if (BIOLOGY_TOPICS.length !== BIOLOGY_COUNT) {
  throw new Error(`Expected ${BIOLOGY_COUNT} biology topics, got ${BIOLOGY_TOPICS.length}`);
}
if (CHEMISTRY_TOPICS.length !== CHEMISTRY_COUNT) {
  throw new Error(`Expected ${CHEMISTRY_COUNT} chemistry topics, got ${CHEMISTRY_TOPICS.length}`);
}
if (PHYSICS_TOPICS.length !== PHYSICS_COUNT) {
  throw new Error(`Expected ${PHYSICS_COUNT} physics topics, got ${PHYSICS_TOPICS.length}`);
}
if (CURRICULUM_61.length !== CURRICULUM_61_TOTAL) {
  throw new Error(`Expected ${CURRICULUM_61_TOTAL} curriculum points, got ${CURRICULUM_61.length}`);
}

/**
 * Count fixture points by subject.
 * @param {Array<{ subject?: string }>} [points]
 */
export function countBySubject(points = CURRICULUM_61) {
  const counts = { biology: 0, chemistry: 0, physics: 0, other: 0 };
  for (const p of points) {
    const s = String(p.subject || "").toLowerCase();
    if (s === "biology" || s === "chemistry" || s === "physics") counts[s] += 1;
    else counts.other += 1;
  }
  return counts;
}

/**
 * Per-subject mastery class breakdown from summariseMasteryMatrix-style cells.
 * @param {Array<{ subject?: string, stateClass: string }>} cells
 */
export function masteryBySubject(cells) {
  const subjects = ["biology", "chemistry", "physics"];
  const classes = [
    "cell-unattempted",
    "cell-scheduled",
    "cell-gap",
    "cell-mastery-l1",
    "cell-mastery-l2",
    "cell-mastery-l3"
  ];
  const out = {};
  for (const sub of subjects) {
    out[sub] = Object.fromEntries(classes.map((c) => [c, 0]));
  }
  for (const cell of cells || []) {
    const sub = String(cell.subject || "").toLowerCase();
    if (!out[sub]) continue;
    if (out[sub][cell.stateClass] !== undefined) out[sub][cell.stateClass] += 1;
  }
  return out;
}
