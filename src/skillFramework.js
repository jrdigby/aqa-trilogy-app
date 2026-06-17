/** AQA GCSE Science — DfE Maths Skills (MS) and Working Scientifically (WS) catalog. */

export const SKILL_FRAMEWORK_ITEMS = [
  // MS 1 — Arithmetic and numerical computation
  { framework: "MS", code: "1a", full_code: "MS1a", category: "Arithmetic and numerical computation", title: "Recognise and use expressions in decimal form", subjects: null, sort_order: 1 },
  { framework: "MS", code: "1b", full_code: "MS1b", category: "Arithmetic and numerical computation", title: "Recognise and use expressions in standard form", subjects: null, sort_order: 2 },
  { framework: "MS", code: "1c", full_code: "MS1c", category: "Arithmetic and numerical computation", title: "Use ratios, fractions and percentages", subjects: null, sort_order: 3 },
  { framework: "MS", code: "1d", full_code: "MS1d", category: "Arithmetic and numerical computation", title: "Make estimates of the results of simple calculations", subjects: null, sort_order: 4 },
  // MS 2 — Handling data
  { framework: "MS", code: "2a", full_code: "MS2a", category: "Handling data", title: "Use an appropriate number of significant figures", subjects: null, sort_order: 5 },
  { framework: "MS", code: "2b", full_code: "MS2b", category: "Handling data", title: "Find arithmetic means", subjects: null, sort_order: 6 },
  { framework: "MS", code: "2c", full_code: "MS2c", category: "Handling data", title: "Construct and interpret frequency tables, bar charts and histograms", subjects: null, sort_order: 7 },
  { framework: "MS", code: "2d", full_code: "MS2d", category: "Handling data", title: "Understand the principles of sampling (biology only)", subjects: ["biology"], sort_order: 8 },
  { framework: "MS", code: "2e", full_code: "MS2e", category: "Handling data", title: "Understand simple probability (biology only)", subjects: ["biology"], sort_order: 9 },
  { framework: "MS", code: "2f", full_code: "MS2f", category: "Handling data", title: "Understand the terms mean, mode and median", subjects: null, sort_order: 10 },
  { framework: "MS", code: "2g", full_code: "MS2g", category: "Handling data", title: "Use a scatter diagram to identify correlation (biology and physics only)", subjects: ["biology", "physics"], sort_order: 11 },
  { framework: "MS", code: "2h", full_code: "MS2h", category: "Handling data", title: "Make order of magnitude calculations", subjects: null, sort_order: 12 },
  // MS 3 — Algebra
  { framework: "MS", code: "3a", full_code: "MS3a", category: "Algebra", title: "Understand and use symbols (=, <, <<, >>, >, ∝, ~)", subjects: null, sort_order: 13 },
  { framework: "MS", code: "3b", full_code: "MS3b", category: "Algebra", title: "Change the subject of an equation", subjects: null, sort_order: 14 },
  { framework: "MS", code: "3c", full_code: "MS3c", category: "Algebra", title: "Substitute numerical values into algebraic equations (chemistry and physics only)", subjects: ["chemistry", "physics"], sort_order: 15 },
  { framework: "MS", code: "3d", full_code: "MS3d", category: "Algebra", title: "Solve simple algebraic equations (biology and physics only)", subjects: ["biology", "physics"], sort_order: 16 },
  // MS 4 — Graphs
  { framework: "MS", code: "4a", full_code: "MS4a", category: "Graphs", title: "Translate information between graphical and numeric form", subjects: null, sort_order: 17 },
  { framework: "MS", code: "4b", full_code: "MS4b", category: "Graphs", title: "Understand that y = mx + c represents a linear relationship", subjects: null, sort_order: 18 },
  { framework: "MS", code: "4c", full_code: "MS4c", category: "Graphs", title: "Plot two variables from experimental or other data", subjects: null, sort_order: 19 },
  { framework: "MS", code: "4d", full_code: "MS4d", category: "Graphs", title: "Determine the slope and intercept of a linear graph", subjects: null, sort_order: 20 },
  { framework: "MS", code: "4e", full_code: "MS4e", category: "Graphs", title: "Draw and use the slope of a tangent as rate of change (chemistry and physics only)", subjects: ["chemistry", "physics"], sort_order: 21 },
  { framework: "MS", code: "4f", full_code: "MS4f", category: "Graphs", title: "Understand area under a curve (physics only)", subjects: ["physics"], sort_order: 22 },
  // MS 5 — Geometry and trigonometry
  { framework: "MS", code: "5a", full_code: "MS5a", category: "Geometry and trigonometry", title: "Use angular measures in degrees (physics only)", subjects: ["physics"], sort_order: 23 },
  { framework: "MS", code: "5b", full_code: "MS5b", category: "Geometry and trigonometry", title: "Visualise and represent 2D and 3D forms (chemistry and physics only)", subjects: ["chemistry", "physics"], sort_order: 24 },
  { framework: "MS", code: "5c", full_code: "MS5c", category: "Geometry and trigonometry", title: "Calculate areas, surface areas and volumes", subjects: null, sort_order: 25 },
  // WS 1 — Development of scientific thinking
  { framework: "WS", code: "1.1", full_code: "WS1.1", category: "Development of scientific thinking", title: "Understand how scientific methods and theories develop over time", subjects: null, sort_order: 101 },
  { framework: "WS", code: "1.2", full_code: "WS1.2", category: "Development of scientific thinking", title: "Use a variety of models to solve problems and develop explanations", subjects: null, sort_order: 102 },
  { framework: "WS", code: "1.3", full_code: "WS1.3", category: "Development of scientific thinking", title: "Appreciate the power and limitations of science; ethical issues", subjects: null, sort_order: 103 },
  { framework: "WS", code: "1.4", full_code: "WS1.4", category: "Development of scientific thinking", title: "Explain applications of science; evaluate personal, social, economic and environmental implications", subjects: null, sort_order: 104 },
  { framework: "WS", code: "1.5", full_code: "WS1.5", category: "Development of scientific thinking", title: "Evaluate risks in practical science and wider societal context", subjects: null, sort_order: 105 },
  { framework: "WS", code: "1.6", full_code: "WS1.6", category: "Development of scientific thinking", title: "Recognise the importance of peer review and communicating results", subjects: null, sort_order: 106 },
  // WS 2 — Experimental skills and strategies
  { framework: "WS", code: "2.1", full_code: "WS2.1", category: "Experimental skills and strategies", title: "Use scientific theories and explanations to develop hypotheses", subjects: null, sort_order: 201 },
  { framework: "WS", code: "2.2", full_code: "WS2.2", category: "Experimental skills and strategies", title: "Plan experiments or devise procedures to test hypotheses", subjects: null, sort_order: 202 },
  { framework: "WS", code: "2.3", full_code: "WS2.3", category: "Experimental skills and strategies", title: "Select appropriate techniques, instruments, apparatus and materials", subjects: null, sort_order: 203 },
  { framework: "WS", code: "2.4", full_code: "WS2.4", category: "Experimental skills and strategies", title: "Carry out experiments with correct manipulation, accuracy and H&S", subjects: null, sort_order: 204 },
  { framework: "WS", code: "2.5", full_code: "WS2.5", category: "Experimental skills and strategies", title: "Apply sampling techniques to ensure representative samples", subjects: null, sort_order: 205 },
  { framework: "WS", code: "2.6", full_code: "WS2.6", category: "Experimental skills and strategies", title: "Make and record observations and measurements", subjects: null, sort_order: 206 },
  { framework: "WS", code: "2.7", full_code: "WS2.7", category: "Experimental skills and strategies", title: "Evaluate methods and suggest possible improvements", subjects: null, sort_order: 207 },
  // WS 3 — Analysis and evaluation
  { framework: "WS", code: "3.1", full_code: "WS3.1", category: "Analysis and evaluation", title: "Present observations and data using appropriate methods", subjects: null, sort_order: 301 },
  { framework: "WS", code: "3.2", full_code: "WS3.2", category: "Analysis and evaluation", title: "Translate data from one form to another", subjects: null, sort_order: 302 },
  { framework: "WS", code: "3.3", full_code: "WS3.3", category: "Analysis and evaluation", title: "Carry out and represent mathematical and statistical analysis", subjects: null, sort_order: 303 },
  { framework: "WS", code: "3.4", full_code: "WS3.4", category: "Analysis and evaluation", title: "Represent distributions of results and estimations of uncertainty", subjects: null, sort_order: 304 },
  { framework: "WS", code: "3.5", full_code: "WS3.5", category: "Analysis and evaluation", title: "Interpret observations and data; identify patterns and trends", subjects: null, sort_order: 305 },
  { framework: "WS", code: "3.6", full_code: "WS3.6", category: "Analysis and evaluation", title: "Present reasoned explanations including relating data to hypotheses", subjects: null, sort_order: 306 },
  { framework: "WS", code: "3.7", full_code: "WS3.7", category: "Analysis and evaluation", title: "Evaluate data: accuracy, precision, repeatability, reproducibility, errors", subjects: null, sort_order: 307 },
  { framework: "WS", code: "3.8", full_code: "WS3.8", category: "Analysis and evaluation", title: "Communicate scientific rationale, methods, findings and conclusions", subjects: null, sort_order: 308 },
  // WS 4 — Scientific vocabulary, quantities, units
  { framework: "WS", code: "4.1", full_code: "WS4.1", category: "Scientific vocabulary and units", title: "Use scientific vocabulary, terminology and definitions", subjects: null, sort_order: 401 },
  { framework: "WS", code: "4.2", full_code: "WS4.2", category: "Scientific vocabulary and units", title: "Recognise the importance of scientific quantities", subjects: null, sort_order: 402 },
  { framework: "WS", code: "4.3", full_code: "WS4.3", category: "Scientific vocabulary and units", title: "Use SI units and IUPAC chemical nomenclature", subjects: null, sort_order: 403 },
  { framework: "WS", code: "4.4", full_code: "WS4.4", category: "Scientific vocabulary and units", title: "Use prefixes and powers of ten for orders of magnitude", subjects: null, sort_order: 404 },
  { framework: "WS", code: "4.5", full_code: "WS4.5", category: "Scientific vocabulary and units", title: "Interconvert units", subjects: null, sort_order: 405 },
  { framework: "WS", code: "4.6", full_code: "WS4.6", category: "Scientific vocabulary and units", title: "Use an appropriate number of significant figures in calculation", subjects: null, sort_order: 406 },
];

const byFullCode = new Map(SKILL_FRAMEWORK_ITEMS.map((s) => [s.full_code, s]));
const byFramework = {
  MS: SKILL_FRAMEWORK_ITEMS.filter((s) => s.framework === "MS"),
  WS: SKILL_FRAMEWORK_ITEMS.filter((s) => s.framework === "WS"),
};

export function getSkillByFullCode(fullCode) {
  return byFullCode.get(fullCode) || null;
}

export function getSkillsByFramework(framework) {
  return byFramework[framework] || [];
}

export function skillAppliesToSubject(skill, subject) {
  if (!skill?.subjects?.length) return true;
  if (!subject) return true;
  return skill.subjects.includes(subject);
}

export function groupSkillsByCategory(framework, subject = null) {
  const items = getSkillsByFramework(framework).filter((s) => skillAppliesToSubject(s, subject));
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }
  return groups;
}

export function parseSkillCodesString(raw) {
  if (!raw?.trim()) return [];
  return raw
    .split(/[;,|]/)
    .map((s) => s.trim().toUpperCase().replace(/^WS(\d)\.(\d)$/, "WS$1.$2"))
    .map((s) => {
      if (/^MS\d+[A-Z]$/i.test(s)) return s.replace(/^MS/i, "MS");
      if (/^WS\d\.\d$/i.test(s)) return s.replace(/^WS/i, "WS");
      return s;
    })
    .filter((code) => byFullCode.has(code) || byFullCode.has(code.replace(/^ms/i, "MS")));
}

export function normalizeFullCode(code) {
  if (!code) return null;
  const trimmed = String(code).trim();
  const upper = trimmed.toUpperCase();
  if (byFullCode.has(trimmed)) return trimmed;
  if (byFullCode.has(upper)) return upper;
  const msMatch = upper.match(/^MS(\d+)([A-Z])$/);
  if (msMatch) {
    const fc = `MS${msMatch[1]}${msMatch[2].toLowerCase()}`;
    if (byFullCode.has(fc)) return fc;
  }
  const wsMatch = upper.match(/^WS(\d)\.(\d)$/);
  if (wsMatch) {
    const fc = `WS${wsMatch[1]}.${wsMatch[2]}`;
    if (byFullCode.has(fc)) return fc;
  }
  return null;
}

export function formatSkillBadge(skills) {
  if (!skills?.length) return "—";
  return skills
    .map((s) => (typeof s === "string" ? s : s.full_code || s.skill_framework_items?.full_code))
    .filter(Boolean)
    .join("+");
}

/** SQL seed rows for migration (framework, code, full_code, category, title, subjects, sort_order) */
export function getSkillSeedRows() {
  return SKILL_FRAMEWORK_ITEMS.map((s) => ({
    framework: s.framework,
    code: s.code,
    full_code: s.full_code,
    category: s.category,
    title: s.title,
    subjects: s.subjects,
    sort_order: s.sort_order,
  }));
}
