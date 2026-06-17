import { getSkillByFullCode, normalizeFullCode } from "./skillFramework.js";
import { extractQuestionSkillCodes } from "./skillTagging.js";
import { escapeHtml } from "./utils.js";

const MIN_ATTEMPTS = 3;
const WEAKNESS_PCT = 50;
const STRENGTH_PCT = 75;

function normalizeCodes(codes) {
  return [...new Set((codes || []).map((c) => normalizeFullCode(c) || c).filter(Boolean))];
}

function buildQuestionSkillMap(questions) {
  const map = new Map();
  for (const q of questions || []) {
    const codes = normalizeCodes(extractQuestionSkillCodes(q));
    if (codes.length) map.set(q.id, codes);
  }
  return map;
}

function initSkillStats(codes) {
  const stats = {};
  for (const code of codes) {
    stats[code] = { earned: 0, max: 0, attempts: 0 };
  }
  return stats;
}

export function aggregateSkillPerformance(questions, attempts, validQuestionIds = null) {
  const qSkillMap = buildQuestionSkillMap(questions);
  const allCodes = new Set();
  for (const codes of qSkillMap.values()) codes.forEach((c) => allCodes.add(c));

  const stats = initSkillStats(allCodes);

  for (const att of attempts || []) {
    if (validQuestionIds && !validQuestionIds.has(att.question_id)) continue;
    const codes = qSkillMap.get(att.question_id);
    if (!codes?.length) continue;
    const earned = Number(att.score_total) || 0;
    const max = Number(att.score_max) || 0;
    for (const code of codes) {
      if (!stats[code]) stats[code] = { earned: 0, max: 0, attempts: 0 };
      stats[code].earned += earned;
      stats[code].max += max;
      stats[code].attempts += 1;
    }
  }

  return stats;
}

function buildSkillEntry(code, s) {
  const skill = getSkillByFullCode(code);
  const pct = s.max > 0 ? Math.round((Number(s.earned) / Number(s.max)) * 100) : null;
  return {
    fullCode: code,
    framework: code.startsWith("MS") ? "MS" : "WS",
    title: skill?.title || code,
    category: skill?.category || "",
    pct,
    attempts: s.attempts,
    earned: Number(s.earned) || 0,
    max: Number(s.max) || 0,
  };
}

function assignSkillStatus(entry) {
  if (entry.attempts < MIN_ATTEMPTS || entry.pct == null) {
    entry.status = "insufficient";
    return;
  }
  if (entry.pct < WEAKNESS_PCT) {
    entry.status = "weakness";
    return;
  }
  if (entry.pct >= STRENGTH_PCT) {
    entry.status = "strength";
    return;
  }
  entry.status = "developing";
}

export function classifySkillPerformance(stats) {
  const strengths = [];
  const weaknesses = [];
  const developing = [];
  const insufficient = [];

  for (const [code, s] of Object.entries(stats || {})) {
    const entry = buildSkillEntry(code, s);
    assignSkillStatus(entry);

    switch (entry.status) {
      case "weakness":
        weaknesses.push(entry);
        break;
      case "strength":
        strengths.push(entry);
        break;
      case "developing":
        developing.push(entry);
        break;
      default:
        insufficient.push(entry);
        break;
    }
  }

  weaknesses.sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));
  developing.sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));
  strengths.sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));

  return { strengths, weaknesses, developing, insufficient };
}

function isFocusArea(entry) {
  return (
    entry.attempts >= MIN_ATTEMPTS &&
    entry.pct != null &&
    entry.pct < WEAKNESS_PCT
  );
}

function isStrengthArea(entry) {
  return (
    entry.attempts >= MIN_ATTEMPTS &&
    entry.pct != null &&
    entry.pct >= STRENGTH_PCT
  );
}

function pctColor(pct, hasData) {
  if (!hasData) return "#bdc3c7";
  if (pct < WEAKNESS_PCT) return "var(--error)";
  if (pct < STRENGTH_PCT) return "#f39c12";
  return "var(--success)";
}

function frameworkLabel(framework) {
  return framework === "MS" ? "Maths skill" : "Working scientifically";
}

function renderFocusCard(entry) {
  const label = frameworkLabel(entry.framework);
  return `
    <div class="skills-focus-card">
      <div class="skills-focus-card-header">
        <div class="skills-focus-card-title">
          <span class="skills-code-badge">${escapeHtml(entry.fullCode)}</span>
          <span class="skills-framework-tag">${escapeHtml(label)}</span>
        </div>
        <span class="skills-focus-pct">${entry.pct}%</span>
      </div>
      <p class="skills-focus-desc">${escapeHtml(entry.title)}</p>
      <p class="skills-focus-meta muted">${entry.attempts} attempt${entry.attempts === 1 ? "" : "s"} · ${entry.earned}/${entry.max} marks</p>
      <button type="button" class="btn-skill-practice btn-skill-practice--focus" data-skill-code="${escapeHtml(entry.fullCode)}">Practise ${escapeHtml(entry.fullCode)}</button>
    </div>`;
}

function renderDevelopingCard(entry) {
  const label = frameworkLabel(entry.framework);
  return `
    <div class="skills-focus-card skills-developing-card">
      <div class="skills-focus-card-header">
        <div class="skills-focus-card-title">
          <span class="skills-code-badge">${escapeHtml(entry.fullCode)}</span>
          <span class="skills-framework-tag">${escapeHtml(label)}</span>
        </div>
        <span class="skills-focus-pct skills-developing-pct">${entry.pct}%</span>
      </div>
      <p class="skills-focus-desc">${escapeHtml(entry.title)}</p>
      <p class="skills-focus-meta muted">${entry.attempts} attempt${entry.attempts === 1 ? "" : "s"} · ${entry.earned}/${entry.max} marks</p>
    </div>`;
}

function renderStrengthChip(entry) {
  const label = frameworkLabel(entry.framework);
  return `
    <div class="skills-strength-chip">
      <div class="skills-strength-chip-top">
        <span class="skills-code-badge skills-code-badge--success">${escapeHtml(entry.fullCode)}</span>
        <span class="skills-strength-pct">${entry.pct}%</span>
      </div>
      <p class="skills-strength-desc">${escapeHtml(entry.title)}</p>
      <span class="skills-framework-tag skills-framework-tag--muted">${escapeHtml(label)}</span>
    </div>`;
}

function renderSkillBar(entry) {
  const hasAttempts = entry.attempts >= MIN_ATTEMPTS && entry.max > 0;
  const pct = hasAttempts ? entry.pct : 0;
  const color = pctColor(pct, entry.attempts > 0);
  const label = hasAttempts ? `${pct}%` : entry.attempts > 0 ? `${entry.attempts}/${MIN_ATTEMPTS} attempts` : "No attempts";
  const labelType = frameworkLabel(entry.framework);
  const showPractice = entry.status === "weakness" || entry.status === "developing";

  return `
    <div class="skill-mastery-row">
      <div class="skill-mastery-row-header">
        <div>
          <span class="skills-code-badge">${escapeHtml(entry.fullCode)}</span>
          <span class="skills-framework-tag">${escapeHtml(labelType)}</span>
        </div>
        <span class="skill-mastery-pct" style="color:${color};">${label}</span>
      </div>
      <p class="skill-mastery-desc">${escapeHtml(entry.title)}</p>
      <div class="skill-mastery-track">
        <div class="skill-mastery-fill" style="width:${hasAttempts ? pct : 0}%;background:${color};"></div>
      </div>
      ${showPractice
        ? `<button type="button" class="btn-skill-practice btn-skill-practice--bar" data-skill-code="${escapeHtml(entry.fullCode)}">Practise ${escapeHtml(entry.fullCode)}</button>`
        : ""}
    </div>`;
}

/**
 * Render MS/WS analytics HTML and wire practise buttons.
 */
export function renderSkillsAnalytics(container, data, handlers = {}) {
  if (!container) return;

  const { questions, attempts, validQuestionIds } = data;
  const stats = aggregateSkillPerformance(questions, attempts, validQuestionIds);
  const classified = classifySkillPerformance(stats);
  const allEntries = [
    ...classified.weaknesses,
    ...classified.developing,
    ...classified.strengths,
    ...classified.insufficient,
  ];

  const focusAreas = allEntries.filter(isFocusArea);
  const strengthAreas = allEntries.filter(isStrengthArea);
  const developingAreas = allEntries.filter(
    (e) =>
      e.attempts >= MIN_ATTEMPTS &&
      e.pct != null &&
      e.pct >= WEAKNESS_PCT &&
      e.pct < STRENGTH_PCT
  );

  const msWithData = allEntries.filter((e) => e.framework === "MS" && e.attempts > 0);
  const wsWithData = allEntries.filter((e) => e.framework === "WS" && e.attempts > 0);

  const focusHtml = focusAreas.length
    ? `<div class="skills-card-grid">${focusAreas.slice(0, 8).map(renderFocusCard).join("")}</div>`
    : `<p class="muted skills-empty-note">No focus areas — skills below ${WEAKNESS_PCT}% appear here after ${MIN_ATTEMPTS}+ attempts.</p>`;

  const strengthHtml = strengthAreas.length
    ? `<div class="skills-card-grid skills-card-grid--strengths">${strengthAreas.slice(0, 8).map(renderStrengthChip).join("")}</div>`
    : `<p class="muted skills-empty-note">No strengths yet — skills at ${STRENGTH_PCT}% or above appear here after ${MIN_ATTEMPTS}+ attempts.</p>`;

  const developingHtml = developingAreas.length
    ? `<div class="skills-developing-wrap">
        <h4 class="skills-subheading">Still developing (${WEAKNESS_PCT}–${STRENGTH_PCT - 1}%)</h4>
        <div class="skills-card-grid skills-card-grid--developing">
          ${developingAreas.slice(0, 6).map(renderDevelopingCard).join("")}
        </div>
      </div>`
    : "";

  container.innerHTML = `
    <h3 class="scoped-panel-heading skills-analytics-heading">🧪 Maths Skills &amp; Working Scientifically</h3>
    <p class="muted skills-analytics-lead">Performance across AQA DfE maths skills (MS) and working scientifically (WS) — practise targets skills across all topics.</p>

    <div class="skills-section">
      <h4 class="skills-subheading">Focus areas</h4>
      <p class="muted skills-section-hint">Skills below ${WEAKNESS_PCT}% where extra practice will help most.</p>
      ${focusHtml}
    </div>

    <div class="skills-section">
      <h4 class="skills-subheading">Strengths</h4>
      <p class="muted skills-section-hint">Skills at ${STRENGTH_PCT}% or above — secure understanding.</p>
      ${strengthHtml}
    </div>

    ${developingHtml}

    <hr class="skills-breakdown-divider" />

    <h4 class="skills-subheading skills-breakdown-heading">Full skill breakdown</h4>
    <p class="muted skills-section-hint">Every MS and WS skill you have attempted, grouped by framework.</p>

    <details open class="skills-details-block">
      <summary class="skills-details-summary">Maths Skills (MS)</summary>
      <div class="skills-card-grid skills-card-grid--bars">
        ${msWithData.length ? msWithData.map((e) => renderSkillBar(e)).join("") : '<p class="muted skills-empty-note">No MS-tagged questions attempted in current filters.</p>'}
      </div>
    </details>

    <details open class="skills-details-block">
      <summary class="skills-details-summary">Working Scientifically (WS)</summary>
      <div class="skills-card-grid skills-card-grid--bars">
        ${wsWithData.length ? wsWithData.map((e) => renderSkillBar(e)).join("") : '<p class="muted skills-empty-note">No WS-tagged questions attempted in current filters.</p>'}
      </div>
    </details>
  `;

  container.querySelectorAll(".btn-skill-practice").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.dataset.skillCode;
      if (code && handlers.onPracticeSkill) handlers.onPracticeSkill(code);
    });
  });
}

export { MIN_ATTEMPTS, WEAKNESS_PCT, STRENGTH_PCT };
