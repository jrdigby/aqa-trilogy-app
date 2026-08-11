/**
 * Difficulty Scaling Test — Physics Combined Science
 *
 * Analyses the Physics Combined Science question bank for:
 *   1. Difficulty distribution (are there enough hard questions for HT students?)
 *   2. Adaptive offset ramp rate (does difficulty scale at a sensible pace?)
 *
 * Usage: node scripts/difficultyScalingTest.mjs
 * Output: console summary + preview-diagrams/difficulty-scaling-report.html
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (loaded from .env)
 */
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadEnv } from "./lib/loadEnv.mjs";
import { computeQuestionDifficulty } from "../src/examRules.js";
import {
  adaptiveSelectQuestions,
  computeGlobalOffsetUpdate,
  normalizeAdaptiveState,
  marksDeltaFromScorePct,
  blendDelta,
  ratingDeltaFromSelfRating
} from "../src/adaptiveSelector.js";
import { GLOBAL_OFFSET_MIN, GLOBAL_OFFSET_MAX } from "../src/examRules.js";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** Pre–Option A: ±1 offset step every session when score crosses threshold. */
function computeGlobalOffsetUpdateLegacy(state, { scorePct, selfRating, tier }) {
  const marksDelta = marksDeltaFromScorePct(scorePct);
  const finalDelta = blendDelta(marksDelta, selfRating != null ? ratingDeltaFromSelfRating(selfRating) : null);
  const prevOffset = state.difficulty_offset;
  const nextOffset = clamp(prevOffset + finalDelta, GLOBAL_OFFSET_MIN, GLOBAL_OFFSET_MAX);

  const streak = { ...state.boundary_streak };
  let tierNudge = null;

  if (tier === "FT" && nextOffset >= GLOBAL_OFFSET_MAX && scorePct >= 85) {
    streak.at_ft_ceiling += 1;
    streak.at_ht_floor = 0;
    if (streak.at_ft_ceiling >= 3) {
      tierNudge = "consider_ht";
      streak.at_ft_ceiling = 0;
    }
  } else if (tier === "HT" && nextOffset <= GLOBAL_OFFSET_MIN && scorePct < 50) {
    streak.at_ht_floor += 1;
    streak.at_ft_ceiling = 0;
    if (streak.at_ht_floor >= 3) {
      tierNudge = "consider_ft";
      streak.at_ht_floor = 0;
    }
  } else {
    streak.at_ft_ceiling = 0;
    streak.at_ht_floor = 0;
  }

  return {
    nextState: { difficulty_offset: nextOffset, boundary_streak: streak },
    offsetChanged: nextOffset !== prevOffset,
    offsetDirection: nextOffset > prevOffset ? "harder" : nextOffset < prevOffset ? "easier" : null,
    tierNudge,
    finalDelta
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
loadEnv(ROOT);

const outDir = join(ROOT, "preview-diagrams");
const outFile = join(outDir, "difficulty-scaling-report.html");

// ── Thresholds ────────────────────────────────────────────────────────────────
const THRESHOLDS = {
  htMinQuestions: 150,       // min questions at difficulty 4–5 combined
  d5MinQuestions: 30,        // min questions at difficulty 5
  rampSessionMin: 4,         // min sessions to reach max offset
  rampSessionMax: 12,        // max sessions to reach max offset
  meanDiffAtCeiling: 4.0,    // mean difficulty once HT offset hits +2
  sessionCount: 20,          // sessions to simulate per profile
  questionsPerSession: 10    // questions per simulated session
};

// ── Supabase fetch ────────────────────────────────────────────────────────────
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function fetchPhysicsQuestions() {
  const baseUrl = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  // Step 1: get all combined physics spec_point IDs
  const spParams = new URLSearchParams({
    select: "id",
    subject: "eq.physics",
    course_track: "eq.combined"
  });
  const spRes = await fetch(`${baseUrl}/rest/v1/spec_points?${spParams}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!spRes.ok) throw new Error(`spec_points fetch failed (${spRes.status}): ${await spRes.text()}`);
  const specPoints = await spRes.json();
  if (!specPoints?.length) throw new Error("No combined physics spec points found");

  const spIds = specPoints.map(sp => sp.id);
  console.log(`Found ${spIds.length} physics combined spec points.`);

  // Step 2: fetch questions in batches by spec_point_id
  let allRows = [];
  const pageSize = 1000;
  let offset = 0;

  // PostgREST supports `in.(id1,id2,...)` filter
  const inFilter = `in.(${spIds.join(",")})`;

  while (true) {
    const params = new URLSearchParams({
      select: "id,demand_level,difficulty,tier,ao1_marks,ao2_marks,ao3_marks,max_marks,question_type,prompt,spec_point_id",
      spec_point_id: inFilter,
      order: "id.asc",
      limit: String(pageSize),
      offset: String(offset)
    });

    const res = await fetch(`${baseUrl}/rest/v1/questions?${params}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    if (!res.ok) throw new Error(`questions fetch failed (${res.status}): ${await res.text()}`);

    const page = await res.json();
    if (!page?.length) break;
    allRows = allRows.concat(page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return allRows;
}

// ── Difficulty distribution ───────────────────────────────────────────────────
function buildDistribution(questions) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const q of questions) {
    const d = computeQuestionDifficulty(q);
    counts[d] = (counts[d] || 0) + 1;
  }
  return counts;
}

function printDistribution(counts, total) {
  const LEVEL_LABELS = {
    1: "1 — Low (FT)",
    2: "2 — Standard (FT)",
    3: "3 — Standard 4–5 (HT)",
    4: "4 — Standard 6–7 (HT)",
    5: "5 — High 8–9 (HT)"
  };
  console.log("\n── Difficulty Distribution ──────────────────────────────");
  console.log(`Total questions: ${total}`);
  console.log("");
  for (let d = 1; d <= 5; d++) {
    const n = counts[d] || 0;
    const pct = ((n / total) * 100).toFixed(1);
    const bar = "█".repeat(Math.round(n / total * 40));
    console.log(`  D${d} ${LEVEL_LABELS[d].padEnd(28)} ${String(n).padStart(4)} (${pct.padStart(5)}%)  ${bar}`);
  }

  const htCount = (counts[4] || 0) + (counts[5] || 0);
  const d5Count = counts[5] || 0;
  console.log(`\n  HT hard questions (D4+D5): ${htCount}`);
  console.log(`  Highest difficulty (D5):    ${d5Count}`);
}

// ── Ramp simulation ───────────────────────────────────────────────────────────
/**
 * Simulate a student over N sessions.
 * scorePct drives offset update (100 = always correct, 0 = always wrong).
 */
function simulateProfile(questions, { label, tier, scorePct }, updateFn) {
  const { sessionCount, questionsPerSession } = THRESHOLDS;
  let state = normalizeAdaptiveState({});
  const log = [];

  for (let s = 1; s <= sessionCount; s++) {
    const selectedQs = adaptiveSelectQuestions(questions, {
      count: questionsPerSession,
      tier,
      offset: state.difficulty_offset,
      mode: "any_practice"
    });

    const meanDiff = selectedQs.length
      ? selectedQs.reduce((sum, q) => sum + computeQuestionDifficulty(q), 0) / selectedQs.length
      : 0;

    const poolAtTarget = questions.filter(
      q => computeQuestionDifficulty(q) >= Math.max(1, state.difficulty_offset + (tier === "HT" ? 3 : 2) - 1)
    ).length;

    log.push({
      session: s,
      offset: state.difficulty_offset,
      meanDiff: Math.round(meanDiff * 100) / 100,
      poolSize: poolAtTarget
    });

    const update = updateFn(state, { scorePct, tier });
    state = update.nextState;
  }

  return { label, tier, log };
}

function printComparison(beforeProfiles, afterProfiles) {
  console.log("\n── Ramp Speed: Before vs After (Option A: 2-session streak) ──");
  console.log("  Profile                          Policy   Sess→+2  Sess→−2  MeanDiff@S20");
  for (let i = 0; i < beforeProfiles.length; i++) {
    const b = beforeProfiles[i];
    const a = afterProfiles[i];
    const baseLabel = b.label.replace("HT ", "").padEnd(32);
    const bUp = findSessionsToReachOffset(b.log, 2) ?? "—";
    const bDown = findSessionsToReachOffset(b.log, -2) ?? "—";
    const aUp = findSessionsToReachOffset(a.log, 2) ?? "—";
    const aDown = findSessionsToReachOffset(a.log, -2) ?? "—";
    const bMean = b.log[b.log.length - 1].meanDiff;
    const aMean = a.log[a.log.length - 1].meanDiff;
    console.log(`  ${baseLabel}  Before     ${String(bUp).padStart(3)}      ${String(bDown).padStart(3)}       ${bMean}`);
    console.log(`  ${" ".repeat(32)}  After      ${String(aUp).padStart(3)}      ${String(aDown).padStart(3)}       ${aMean}`);
    if (i < beforeProfiles.length - 1) console.log("");
  }
}

function printOffsetTimeline(beforeProfiles, afterProfiles) {
  for (let i = 0; i < beforeProfiles.length; i++) {
    const b = beforeProfiles[i];
    const a = afterProfiles[i];
    console.log(`\n── ${b.label}: offset timeline ─────────────────────────`);
    console.log("  Sess   Before   After");
    for (let s = 0; s < b.log.length; s++) {
      const changed = b.log[s].offset !== a.log[s].offset ? " ◂" : "";
      console.log(
        `   ${String(b.log[s].session).padStart(2)}      ${String(b.log[s].offset).padStart(2)}      ${String(a.log[s].offset).padStart(2)}${changed}`
      );
    }
  }
}

function printSimulation(profile) {
  const { label, log } = profile;
  console.log(`\n── ${label} ─────────────────────────────────────────────`);
  console.log("  Sess  Offset  MeanDiff  PoolAtTarget");
  for (const row of log) {
    const bar = "▸".repeat(Math.max(0, row.offset + 2));
    console.log(
      `   ${String(row.session).padStart(2)}     ${String(row.offset).padStart(2)}     ${String(row.meanDiff).padStart(5)}   ${String(row.poolSize).padStart(5)}  ${bar}`
    );
  }
}

function findSessionsToReachOffset(log, targetOffset) {
  for (const row of log) {
    if (row.offset === targetOffset) return row.session;
  }
  return null;
}

// ── Assertions ────────────────────────────────────────────────────────────────
function runAssertions(counts, total, profiles, policyLabel = "") {
  const results = [];
  const prefix = policyLabel ? `${policyLabel}: ` : "";

  const htCount = (counts[4] || 0) + (counts[5] || 0);
  const d5Count = counts[5] || 0;

  if (!policyLabel) {
    results.push({
      check: `HT questions (D4+D5) ≥ ${THRESHOLDS.htMinQuestions}`,
      value: htCount,
      pass: htCount >= THRESHOLDS.htMinQuestions
    });
    results.push({
      check: `D5 questions ≥ ${THRESHOLDS.d5MinQuestions}`,
      value: d5Count,
      pass: d5Count >= THRESHOLDS.d5MinQuestions
    });
  }

  for (const profile of profiles) {
    const isHighAchiever = profile.scorePct === 100;
    const targetOffset = isHighAchiever ? 2 : -2;
    const sessionsToReach = findSessionsToReachOffset(profile.log, targetOffset);

    results.push({
      check: `${prefix}${profile.label}: sessions to reach offset ${targetOffset} (${THRESHOLDS.rampSessionMin}–${THRESHOLDS.rampSessionMax})`,
      value: sessionsToReach ?? `not reached in ${THRESHOLDS.sessionCount}`,
      pass: sessionsToReach != null &&
        sessionsToReach >= THRESHOLDS.rampSessionMin &&
        sessionsToReach <= THRESHOLDS.rampSessionMax
    });

    if (isHighAchiever) {
      const lastRow = profile.log[profile.log.length - 1];
      results.push({
        check: `${prefix}${profile.label}: mean difficulty at ceiling ≥ ${THRESHOLDS.meanDiffAtCeiling}`,
        value: lastRow.meanDiff,
        pass: lastRow.meanDiff >= THRESHOLDS.meanDiffAtCeiling
      });
    }
  }

  if (policyLabel) return results;

  console.log("\n── Assertions (bank coverage) ───────────────────────────");
  let allPassed = true;
  for (const r of results) {
    const icon = r.pass ? "✓" : "✗";
    const status = r.pass ? "PASS" : "FAIL";
    if (!r.pass) allPassed = false;
    console.log(`  ${icon} [${status}] ${r.check}  →  ${r.value}`);
  }
  console.log(allPassed ? "\n  All bank checks passed." : "\n  Some bank checks FAILED.");
  return results;
}

function printPolicyAssertions(beforeResults, afterResults) {
  console.log("\n── Ramp assertions: Before vs After ─────────────────────");
  const pairs = [];
  for (const br of beforeResults) {
    const ar = afterResults.find(r => r.check.includes(br.check.split(": ").slice(1).join(": ")));
    if (ar) pairs.push({ check: br.check.replace("Before: ", ""), before: br, after: ar });
  }
  for (const { check, before, after } of pairs) {
    const bIcon = before.pass ? "✓" : "✗";
    const aIcon = after.pass ? "✓" : "✗";
    console.log(`  ${check}`);
    console.log(`    Before: ${bIcon} ${before.value}`);
    console.log(`    After:  ${aIcon} ${after.value}`);
  }
}

// ── HTML report ───────────────────────────────────────────────────────────────
function buildHtml(counts, total, beforeProfiles, afterProfiles, bankAssertions, beforeRampAssertions, afterRampAssertions) {
  const DEMAND_LABELS = {
    1: "D1 Low (FT)",
    2: "D2 Standard (FT)",
    3: "D3 Standard 4–5 (HT)",
    4: "D4 Standard 6–7 (HT)",
    5: "D5 High 8–9 (HT)"
  };

  const distLabels = JSON.stringify([1, 2, 3, 4, 5].map(d => DEMAND_LABELS[d]));
  const distData = JSON.stringify([1, 2, 3, 4, 5].map(d => counts[d] || 0));
  const distColors = JSON.stringify([
    "#4e9af1", "#4e9af1", "#f1a84e", "#e8604c", "#cc2020"
  ]);

  const sessionLabels = JSON.stringify(beforeProfiles[0].log.map(r => `S${r.session}`));

  function offsetDatasets(profiles, policy, colors) {
    return profiles.flatMap((p, i) => [
      {
        label: `${policy} — ${p.label.replace("HT ", "")} offset`,
        data: p.log.map(r => r.offset),
        borderColor: colors[i].offset,
        borderDash: policy === "After" ? [] : [6, 4],
        backgroundColor: "transparent",
        tension: 0.1,
        pointRadius: 3,
        yAxisID: "yOffset"
      },
      {
        label: `${policy} — ${p.label.replace("HT ", "")} mean diff`,
        data: p.log.map(r => r.meanDiff),
        borderColor: colors[i].mean,
        borderDash: policy === "After" ? [] : [6, 4],
        backgroundColor: "transparent",
        tension: 0.3,
        pointRadius: 4,
        yAxisID: "y"
      }
    ]);
  }

  const colors = [
    { offset: "#86efac", mean: "#22c55e" },
    { offset: "#fca5a5", mean: "#ef4444" }
  ];
  const sessionDatasetsJson = JSON.stringify([
    ...offsetDatasets(beforeProfiles, "Before", colors),
    ...offsetDatasets(afterProfiles, "After", colors)
  ]);

  const assertRows = [
    ...bankAssertions,
    ...beforeRampAssertions.map(r => ({ ...r, check: `[Before] ${r.check}` })),
    ...afterRampAssertions.map(r => ({ ...r, check: `[After] ${r.check}` }))
  ].map(r => `
    <tr class="${r.pass ? "pass" : "fail"}">
      <td>${r.pass ? "✓" : "✗"}</td>
      <td>${r.check}</td>
      <td>${r.value}</td>
    </tr>`).join("");

  const comparisonRows = beforeProfiles.map((b, i) => {
    const a = afterProfiles[i];
    const bUp = findSessionsToReachOffset(b.log, b.scorePct === 100 ? 2 : -2);
    const aUp = findSessionsToReachOffset(a.log, a.scorePct === 100 ? 2 : -2);
    const target = b.scorePct === 100 ? "+2" : "−2";
    return `<tr>
      <td>${b.label.replace("HT ", "")}</td>
      <td>${target}</td>
      <td>${bUp ?? "—"}</td>
      <td>${aUp ?? "—"}</td>
      <td class="${aUp != null && aUp >= THRESHOLDS.rampSessionMin && aUp <= THRESHOLDS.rampSessionMax ? "pass" : "fail"}">${aUp != null && aUp >= THRESHOLDS.rampSessionMin && aUp <= THRESHOLDS.rampSessionMax ? "✓ in range" : "✗ out of range"}</td>
    </tr>`;
  }).join("");

  const htCount = (counts[4] || 0) + (counts[5] || 0);
  const htPct = ((htCount / total) * 100).toFixed(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Difficulty Scaling Report — Physics Combined Science</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 2rem; }
    h1 { color: #f8fafc; font-size: 1.5rem; margin-bottom: 0.25rem; }
    .subtitle { color: #94a3b8; margin-bottom: 2rem; font-size: 0.9rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
    .card { background: #1e293b; border-radius: 10px; padding: 1.5rem; }
    .card h2 { font-size: 1rem; color: #cbd5e1; margin: 0 0 1rem 0; }
    .chart-wrap { position: relative; height: 280px; }
    .stats { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
    .stat { background: #1e293b; border-radius: 10px; padding: 1rem 1.5rem; flex: 1; min-width: 140px; }
    .stat .val { font-size: 2rem; font-weight: 700; color: #f8fafc; }
    .stat .lbl { color: #94a3b8; font-size: 0.8rem; margin-top: 0.2rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th { text-align: left; color: #94a3b8; padding: 0.5rem; border-bottom: 1px solid #334155; }
    td { padding: 0.5rem; border-bottom: 1px solid #1e293b; }
    tr.pass td:first-child { color: #22c55e; }
    tr.fail td:first-child { color: #ef4444; }
    tr.fail { background: #2d1b1b; }
    tr.pass { background: #1a2d1e; }
    .full { grid-column: 1 / -1; }
    @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } .full { grid-column: 1; } }
  </style>
</head>
<body>
  <h1>Difficulty Scaling Report — Physics Combined Science</h1>
  <p class="subtitle">Generated ${new Date().toLocaleString("en-GB")} · Total questions: ${total}</p>

  <div class="stats">
    <div class="stat"><div class="val">${total}</div><div class="lbl">Total Questions</div></div>
    <div class="stat"><div class="val">${htCount}</div><div class="lbl">HT Hard Questions (D4+D5)</div></div>
    <div class="stat"><div class="val">${htPct}%</div><div class="lbl">HT Hard Share</div></div>
    <div class="stat"><div class="val">${counts[5] || 0}</div><div class="lbl">Highest Difficulty (D5)</div></div>
  </div>

  <div class="grid">
    <div class="card">
      <h2>Question Bank Difficulty Distribution</h2>
      <div class="chart-wrap"><canvas id="distChart"></canvas></div>
    </div>

    <div class="card">
      <h2>Ramp Speed: Before vs After (Option A — 2-session streak)</h2>
      <div class="chart-wrap"><canvas id="sessionChart"></canvas></div>
    </div>

    <div class="card full">
      <h2>Sessions to Reach Offset Ceiling/Floor</h2>
      <table>
        <thead><tr><th>Profile</th><th>Target</th><th>Before</th><th>After</th><th>After in 4–12?</th></tr></thead>
        <tbody>${comparisonRows}</tbody>
      </table>
    </div>

    <div class="card full">
      <h2>Assertion Results</h2>
      <table>
        <thead><tr><th></th><th>Check</th><th>Value</th></tr></thead>
        <tbody>${assertRows}</tbody>
      </table>
    </div>
  </div>

  <script>
    const distLabels = ${distLabels};
    const distData = ${distData};
    const distColors = ${distColors};

    new Chart(document.getElementById("distChart"), {
      type: "bar",
      data: {
        labels: distLabels,
        datasets: [{ label: "Questions", data: distData, backgroundColor: distColors, borderRadius: 4 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = distData.reduce((a, b) => a + b, 0);
                const pct = ((ctx.raw / total) * 100).toFixed(1);
                return \` \${ctx.raw} questions (\${pct}%)\`;
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
          y: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" }, beginAtZero: true }
        }
      }
    });

    const sessionLabels = ${sessionLabels};
    const sessionDatasets = ${sessionDatasetsJson};

    new Chart(document.getElementById("sessionChart"), {
      type: "line",
      data: { labels: sessionLabels, datasets: sessionDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: "#94a3b8", boxWidth: 12 } },
          tooltip: { mode: "index", intersect: false }
        },
        scales: {
          x: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } },
          y: {
            title: { display: true, text: "Mean Difficulty (1–5)", color: "#94a3b8" },
            ticks: { color: "#94a3b8" },
            grid: { color: "#334155" },
            min: 1, max: 5
          },
          yOffset: {
            position: "right",
            title: { display: true, text: "Difficulty Offset", color: "#94a3b8" },
            ticks: { color: "#94a3b8" },
            grid: { drawOnChartArea: false },
            min: -2, max: 2
          }
        }
      }
    });
  </script>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Fetching Physics Combined Science questions from Supabase…");
  const questions = await fetchPhysicsQuestions();
  console.log(`Fetched ${questions.length} questions.`);

  // Mark each question with computed difficulty (cache on object for reuse)
  for (const q of questions) {
    q._difficulty = computeQuestionDifficulty(q);
  }

  const counts = buildDistribution(questions);
  printDistribution(counts, questions.length);

  const profileDefs = [
    { label: "HT High Achiever (score=100%)", tier: "HT", scorePct: 100 },
    { label: "HT Struggling Student (score=0%)", tier: "HT", scorePct: 0 }
  ];

  const beforeProfiles = profileDefs.map(p => ({
    ...simulateProfile(questions, p, computeGlobalOffsetUpdateLegacy),
    scorePct: p.scorePct
  }));

  const afterProfiles = profileDefs.map(p => ({
    ...simulateProfile(questions, p, computeGlobalOffsetUpdate),
    scorePct: p.scorePct
  }));

  printComparison(beforeProfiles, afterProfiles);
  printOffsetTimeline(beforeProfiles, afterProfiles);

  const bankAssertions = runAssertions(counts, questions.length, []);
  const beforeRampAssertions = runAssertions(counts, questions.length, beforeProfiles, "Before");
  const afterRampAssertions = runAssertions(counts, questions.length, afterProfiles, "After");
  printPolicyAssertions(beforeRampAssertions, afterRampAssertions);

  mkdirSync(outDir, { recursive: true });
  const html = buildHtml(
    counts,
    questions.length,
    beforeProfiles,
    afterProfiles,
    bankAssertions,
    beforeRampAssertions,
    afterRampAssertions
  );
  writeFileSync(outFile, html, "utf8");
  console.log(`\nReport written to: ${outFile}`);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
