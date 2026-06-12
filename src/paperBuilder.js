import {
  getPaperTargets,
  inferAoMarks,
  inferDemandBucket,
  isMathsSkillQuestion,
  isRpQuestion
} from "./examRules.js";

function questionMarks(q) {
  return Number(q.max_marks) || 1;
}

function tallyQuestion(q, tier) {
  const ao = inferAoMarks(q);
  const demand = inferDemandBucket(q, tier);
  return {
    marks: questionMarks(q),
    ao1: ao.ao1,
    ao2: ao.ao2,
    ao3: ao.ao3,
    demand: { [demand]: questionMarks(q) },
    maths: isMathsSkillQuestion(q) ? questionMarks(q) : 0,
    rp: isRpQuestion(q) ? questionMarks(q) : 0
  };
}

function emptyTotals() {
  return { marks: 0, ao1: 0, ao2: 0, ao3: 0, demand: {}, maths: 0, rp: 0 };
}

function mergeTotals(base, add) {
  const demand = { ...base.demand };
  for (const [k, v] of Object.entries(add.demand || {})) {
    demand[k] = (demand[k] || 0) + v;
  }
  return {
    marks: base.marks + add.marks,
    ao1: base.ao1 + add.ao1,
    ao2: base.ao2 + add.ao2,
    ao3: base.ao3 + add.ao3,
    demand,
    maths: base.maths + add.maths,
    rp: base.rp + add.rp
  };
}

function underfillScore(totals, targets) {
  let score = 0;
  score += Math.max(0, targets.ao1 - totals.ao1) * 3;
  score += Math.max(0, targets.ao2 - totals.ao2) * 3;
  score += Math.max(0, targets.ao3 - totals.ao3) * 4;
  for (const [k, target] of Object.entries(targets.demand || {})) {
    score += Math.max(0, (target || 0) - (totals.demand[k] || 0)) * 2;
  }
  score += Math.max(0, targets.maths - totals.maths) * 2;
  score += Math.max(0, targets.rp - totals.rp) * 2;
  return score;
}

const DEMAND_LABELS = {
  low: "Low demand",
  standard: "Standard demand",
  standard_45: "Standard 4–5",
  standard_67: "Standard 6–7",
  high_89: "High 8–9"
};

function computeShortfalls(totals, targets) {
  const shortfalls = [];
  if (totals.ao1 < targets.ao1) shortfalls.push(`AO1 marks ${targets.ao1 - totals.ao1} below target`);
  if (totals.ao2 < targets.ao2) shortfalls.push(`AO2 marks ${targets.ao2 - totals.ao2} below target`);
  if (totals.ao3 < targets.ao3) shortfalls.push(`AO3 marks ${targets.ao3 - totals.ao3} below target`);
  for (const [k, target] of Object.entries(targets.demand || {})) {
    const got = totals.demand[k] || 0;
    if (got < target) shortfalls.push(`${k} demand ${target - got} marks below target`);
  }
  if (totals.maths < targets.maths) {
    shortfalls.push(`Maths skills marks ${targets.maths - totals.maths} below minimum`);
  }
  if (totals.rp < targets.rp) {
    shortfalls.push(`Required practical marks ${targets.rp - totals.rp} below 15% minimum`);
  }
  if (totals.marks < targets.marks) {
    shortfalls.push(`Total marks ${targets.marks - totals.marks} below paper target`);
  }
  return shortfalls;
}

function buildGroupedShortfallLines(totals, targets) {
  const lines = [];

  const aoParts = [];
  if (totals.ao1 < targets.ao1) aoParts.push(`AO1 ${targets.ao1 - totals.ao1} marks below target`);
  if (totals.ao2 < targets.ao2) aoParts.push(`AO2 ${targets.ao2 - totals.ao2} marks below target`);
  if (totals.ao3 < targets.ao3) aoParts.push(`AO3 ${targets.ao3 - totals.ao3} marks below target`);
  if (aoParts.length) lines.push(aoParts.join(" · "));

  const demandParts = [];
  for (const [k, target] of Object.entries(targets.demand || {})) {
    const got = totals.demand[k] || 0;
    if (got < target) {
      const label = DEMAND_LABELS[k] || k;
      demandParts.push(`${label} ${target - got} marks below target`);
    }
  }
  if (demandParts.length) lines.push(demandParts.join(" · "));

  if (totals.maths < targets.maths) {
    lines.push(`Maths skills ${targets.maths - totals.maths} marks below target`);
  }
  if (totals.rp < targets.rp) {
    lines.push(`Required practicals ${targets.rp - totals.rp} marks below target`);
  }
  if (totals.marks < targets.marks) {
    lines.push(`Total marks ${targets.marks - totals.marks} below paper target`);
  }

  return lines;
}

/**
 * Greedy paper assembly toward AQA mark targets.
 */
export function buildExamPaper(candidates, { targetMarks, tier, subject }) {
  const targets = getPaperTargets(targetMarks, tier, subject);
  const pool = [...(candidates || [])];
  const selected = [];
  let totals = emptyTotals();

  while (totals.marks < targetMarks && pool.length > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const q = pool[i];
      const qMarks = questionMarks(q);
      if (totals.marks + qMarks > targetMarks + 6) continue;

      const qTally = tallyQuestion(q, tier);
      const nextTotals = mergeTotals(totals, qTally);
      const fillGain = underfillScore(totals, targets) - underfillScore(nextTotals, targets);
      const markProgress = Math.min(qMarks, Math.max(0, targetMarks - totals.marks));
      const score = fillGain * 10 + markProgress;

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) break;

    const [picked] = pool.splice(bestIdx, 1);
    selected.push(picked);
    totals = mergeTotals(totals, tallyQuestion(picked, tier));
  }

  return {
    questions: selected,
    totals,
    targets,
    shortfalls: computeShortfalls(totals, targets)
  };
}

export function formatPaperPreviewSummary(result) {
  const { totals, targets } = result;
  const lines = [
    `Marks: ${totals.marks}/${targets.marks}`,
    `AO1: ${totals.ao1}/${targets.ao1} · AO2: ${totals.ao2}/${targets.ao2} · AO3: ${totals.ao3}/${targets.ao3}`,
    `Maths: ${totals.maths}/${targets.maths} · RP: ${totals.rp}/${targets.rp}`
  ];

  const shortfallLines = buildGroupedShortfallLines(totals, targets);
  if (shortfallLines.length) {
    lines.push("Shortfalls:");
    lines.push(...shortfallLines);
  } else {
    lines.push("Balance looks good for available questions.");
  }
  return lines.join("\n");
}
