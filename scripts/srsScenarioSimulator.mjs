/**
 * Run SRS scenario simulations and write a calendar-style HTML report.
 * Usage: node scripts/srsScenarioSimulator.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  runAllScenarios,
  WORKLOAD_SPIKE_THRESHOLD,
  CURRICULUM_61_TOTAL
} from "../tests/helpers/srsSimulator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "preview-diagrams");
const outFile = join(outDir, "srs-scenario-report.html");

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function subjectClass(subject) {
  const s = String(subject || "").toLowerCase();
  if (s === "biology") return "sub-bio";
  if (s === "chemistry") return "sub-chem";
  if (s === "physics") return "sub-phys";
  return "sub-other";
}

function parseISO(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return { y, m, d };
}

function monthKey(iso) {
  const { y, m } = parseISO(iso);
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** Monday=0 … Sunday=6 for local calendar layout. */
function mondayIndex(y, m, d) {
  const js = new Date(y, m - 1, d).getDay(); // Sun=0
  return (js + 6) % 7;
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

function buildPracticeMap(practiceDays) {
  const map = new Map();
  for (const day of practiceDays || []) {
    map.set(day.date, day.items || []);
  }
  return map;
}

function renderMonth(year, month, practiceMap, examDate, startDate, endDate) {
  const dim = daysInMonth(year, month);
  const pad = mondayIndex(year, month, 1);
  const title = `${MONTH_NAMES[month - 1]} ${year}`;
  const cells = [];

  for (let i = 0; i < pad; i++) {
    cells.push(`<div class="day day--pad"></div>`);
  }

  for (let d = 1; d <= dim; d++) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const inRange = iso >= startDate && iso <= endDate;
    const items = practiceMap.get(iso) || [];
    const isExam = iso === examDate;
    const classes = ["day"];
    if (!inRange) classes.push("day--out");
    if (items.length) classes.push("day--busy");
    if (isExam) classes.push("day--exam");

    const refs = items
      .map(
        (it) =>
          `<span class="ref ${subjectClass(it.subject)}" title="${escapeHtml(
            `${it.topic_name || ""} · next ${it.next_due || ""} · ${it.interval_days ?? "?"}d`
          )}">${escapeHtml(it.spec_ref)}</span>`
      )
      .join("");

    cells.push(`<div class="${classes.join(" ")}">
      <div class="day-head">
        <span class="day-num">${d}</span>
        ${items.length ? `<span class="day-count">${items.length}</span>` : ""}
        ${isExam ? `<span class="exam-tag">Exam</span>` : ""}
      </div>
      <div class="day-refs">${refs}</div>
    </div>`);
  }

  return `<section class="month">
    <h4>${escapeHtml(title)}</h4>
    <div class="cal-head">${DOW.map((d) => `<div>${d}</div>`).join("")}</div>
    <div class="cal">${cells.join("")}</div>
  </section>`;
}

function renderCalendar(result) {
  const practiceMap = buildPracticeMap(result.practiceDays);
  const startDate = result.startDate;
  const endDate = result.final?.today || startDate;
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  const months = [];
  let y = start.y;
  let m = start.m;
  while (y < end.y || (y === end.y && m <= end.m)) {
    months.push(
      renderMonth(y, m, practiceMap, result.examDate, startDate, endDate)
    );
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months.join("\n");
}

function renderTopicTable(topics) {
  const rows = [...(topics || [])]
    .sort((a, b) => {
      const sub = String(a.subject || "").localeCompare(String(b.subject || ""));
      if (sub !== 0) return sub;
      return String(a.spec_ref || "").localeCompare(String(b.spec_ref || ""));
    })
    .map(
      (t) => `<tr>
      <td>${escapeHtml(t.spec_ref || t.spec_point_id)}</td>
      <td>${escapeHtml(t.subject || "")}</td>
      <td>${escapeHtml(t.topic_name || "")}</td>
      <td>${escapeHtml(t.due_date || "")}</td>
      <td>${t.interval_days ?? ""}</td>
      <td>${t.ease_factor != null ? Number(t.ease_factor).toFixed(3) : ""}</td>
      <td>${t.attempts ?? 0}</td>
      <td>${t.repetitions ?? 0}</td>
      <td>${t.lapses ?? 0}</td>
      <td>${t.last_quality ?? ""}</td>
      <td><code>${escapeHtml(t.mastery || "")}</code></td>
    </tr>`
    )
    .join("");
  return `<div class="table-wrap"><table class="topic-table">
    <thead><tr>
      <th>Ref</th><th>Subject</th><th>Topic</th><th>Due</th>
      <th>Interval</th><th>EF</th><th>Attempts</th><th>Reps</th><th>Lapses</th>
      <th>Last Q</th><th>Mastery</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderMatrixCounts(counts) {
  const order = [
    ["cell-unattempted", "Unattempted", "#cbd5e1"],
    ["cell-scheduled", "Scheduled", "#dbeafe"],
    ["cell-gap", "Concept gap", "#f59e0b"],
    ["cell-mastery-l1", "Mastery L1", "#bbf7d0"],
    ["cell-mastery-l2", "Mastery L2", "#4ade80"],
    ["cell-mastery-l3", "Mastery L3", "#16a34a"]
  ];
  return `<div class="matrix-counts">${order
    .map(
      ([key, label, color]) =>
        `<div class="chip" style="border-color:${color}"><span class="swatch" style="background:${color}"></span>${escapeHtml(label)}: <strong>${counts[key] || 0}</strong></div>`
    )
    .join("")}</div>`;
}

function renderScenario(result) {
  const size = result.curriculumSize || result.final.curriculumSize || "?";
  const tracked = result.final.trackedCount;
  const unattempted = result.final.unattempted ?? result.final.matrixCounts?.["cell-unattempted"] ?? 0;
  const maxInterval = Math.max(0, ...(result.final.topics || []).map((t) => t.interval_days || 0));
  const practiceSessions = (result.practiceDays || []).reduce(
    (n, d) => n + (d.items?.length || 0),
    0
  );

  return `
  <section class="scenario" id="${escapeHtml(result.name)}">
    <h2>${escapeHtml(result.name)}</h2>
    <p class="meta">
      Start <strong>${escapeHtml(result.startDate)}</strong> ·
      ${result.days} simulated days ·
      quality <strong>${result.name === "final_months_pace_61" ? "always 5" : "3→4→5 (early then secure)"}</strong> ·
      curriculum <strong>${tracked} / ${size}</strong> tracked ·
      unattempted <strong>${unattempted}</strong> ·
      ${result.examDate ? `exam <strong>${escapeHtml(result.examDate)}</strong> · ` : ""}
      practice days <strong>${result.practiceDayCount ?? 0}</strong> ·
      topic-sessions <strong>${practiceSessions}</strong> ·
      max due any school day <strong>${result.maxDueOnAnyDay}</strong> ·
      max interval <strong>${maxInterval}d</strong> ·
      at ceiling <strong>${result.longIntervalTopics.length}</strong>
    </p>
    <h3>Mastery at end of run</h3>
    ${renderMatrixCounts(result.final.matrixCounts)}
    <h3>Topic overview (final state)</h3>
    ${renderTopicTable(result.final.topics)}
    <div class="legend">
      <span class="ref sub-bio">Biology</span>
      <span class="ref sub-chem">Chemistry</span>
      <span class="ref sub-phys">Physics</span>
      <span class="legend-note">Calendar: spec refs practised that day. Hover ref for topic + next due.</span>
    </div>
    <h3>Practice calendar</h3>
    ${renderCalendar(result)}
  </section>`;
}

const results = runAllScenarios();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>SRS Scenario Report</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: "Segoe UI", system-ui, sans-serif; margin: 0; padding: 24px; background: #f1f5f9; color: #0f172a; }
    h1 { margin: 0 0 8px; }
    .intro { color: #475569; max-width: 920px; margin-bottom: 20px; line-height: 1.45; }
    .toc { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
    .toc a { background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 12px; text-decoration: none; color: #0f172a; font-size: 0.9rem; }
    .scenario { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 28px; }
    .scenario h2 { margin: 0 0 6px; text-transform: capitalize; }
    .meta { color: #64748b; font-size: 0.9rem; line-height: 1.5; }
    .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 12px 0 8px; }
    .legend-note { color: #64748b; font-size: 0.8rem; }
    .matrix-counts { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 0; }
    .chip { display: inline-flex; align-items: center; gap: 6px; border: 1px solid; border-radius: 8px; padding: 6px 10px; font-size: 0.85rem; background: #fff; }
    .swatch { width: 12px; height: 12px; border-radius: 3px; }
    .month { margin: 16px 0 24px; }
    .month h4 { margin: 0 0 8px; font-size: 1rem; }
    .cal-head, .cal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; }
    .cal-head { margin-bottom: 4px; }
    .cal-head div { text-align: center; font-size: 0.7rem; color: #64748b; font-weight: 600; }
    .day {
      min-height: 72px; border: 1px solid #e2e8f0; border-radius: 6px;
      padding: 4px; background: #f8fafc; font-size: 0.65rem;
    }
    .day--pad { border: none; background: transparent; min-height: 0; }
    .day--out { opacity: 0.35; }
    .day--busy { background: #fff; border-color: #cbd5e1; }
    .day--exam { outline: 2px solid #dc2626; outline-offset: -1px; }
    .day-head { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
    .day-num { font-weight: 700; font-size: 0.75rem; color: #334155; }
    .day-count {
      margin-left: auto; background: #0f172a; color: #fff;
      border-radius: 999px; padding: 0 5px; font-size: 0.65rem; font-weight: 700;
    }
    .exam-tag { color: #dc2626; font-weight: 700; font-size: 0.65rem; }
    .table-wrap { overflow-x: auto; margin: 8px 0 20px; max-height: 420px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; }
    .topic-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    .topic-table th, .topic-table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
    .topic-table th { position: sticky; top: 0; background: #f8fafc; color: #64748b; font-weight: 600; z-index: 1; }
    .topic-table code { font-size: 0.75rem; }
    .day-refs { display: flex; flex-wrap: wrap; gap: 2px; }
    .ref {
      display: inline-block; border-radius: 3px; padding: 1px 4px;
      font-weight: 600; font-size: 0.62rem; line-height: 1.3; white-space: nowrap;
    }
    .sub-bio { background: #dcfce7; color: #166534; }
    .sub-chem { background: #e0e7ff; color: #3730a3; }
    .sub-phys { background: #ffedd5; color: #9a3412; }
    .sub-other { background: #e2e8f0; color: #334155; }
    @media (max-width: 900px) {
      .day { min-height: 56px; }
      .ref { font-size: 0.55rem; padding: 0 2px; }
    }
  </style>
</head>
<body>
  <h1>SRS Scenario Report</h1>
  <p class="intro">
    Horizon-paced SM-2 on a <strong>${CURRICULUM_61_TOTAL}-topic</strong> combined-shaped curriculum
    (19 biology / 21 chemistry / 21 physics).
    Every review uses <strong>quality = 5</strong> for final_months;
    Y10/Y11 use <strong>3 → 4 → 5</strong> as repetitions grow (more realistic early attempts).
    Bootstrap seeds <strong>6</strong> topics across the first week with <strong>2</strong> due on day 1.
    Caps: final_months ≤21d, y11 ≤42d, y10 ≤60d. Due dates never past the exam;
    final-week passes park until after the paper.
    Topics are introduced Bio → Chem → Phys (round-robin).
    Workload spike threshold (internal): ${WORKLOAD_SPIKE_THRESHOLD}/day.
    Generated ${new Date().toISOString()}.
  </p>
  <nav class="toc">
    ${results.map((r) => `<a href="#${escapeHtml(r.name)}">${escapeHtml(r.name)}</a>`).join("")}
  </nav>
  ${results.map(renderScenario).join("\n")}
</body>
</html>`;

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, html, "utf8");
console.log(`Wrote ${outFile}`);
for (const r of results) {
  const size = r.curriculumSize || r.final.curriculumSize;
  console.log(
    `- ${r.name}: tracked=${r.final.trackedCount}/${size} practiceDays=${r.practiceDayCount} maxDue=${r.maxDueOnAnyDay}`
  );
}
