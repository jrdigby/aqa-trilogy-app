import {
  fetchAllSpecificationPoints,
  fetchAttemptActivity,
  fetchClassRosterStats,
  fetchConceptGapAttempts,
  fetchMarkPointsForQuestions,
  fetchQuestionsMeta,
  fetchStudentAttemptsWithAO,
  fetchStudentSRSStateDetailed,
  fetchTeacherStudentProfile,
} from "./dbClient.js";
import { formatSciencePathLabel, courseTrackForProfile } from "./sciencePath.js";
import { renderMasteryHeatmap } from "./uiComponents.js";
import { addDaysISO, escapeHtml, todayISO } from "./utils.js";

const el = (id) => document.getElementById(id);

let activeStudentId = null;
let activeTab = "overview";

function formatLastActive(isoDate) {
  if (!isoDate) return "—";
  const dateOnly = String(isoDate).slice(0, 10);
  const today = todayISO();
  if (dateOnly === today) return "Today";
  if (dateOnly === addDaysISO(today, -1)) return "Yesterday";
  const parsed = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function classifyAttemptOutcome(att) {
  const total = att.score_total || 0;
  const max = att.score_max || 0;
  if (max <= 0) return "fail";
  if (total >= max) return "full";
  if (total >= Math.ceil(max / 2)) return "partial";
  return "fail";
}

function buildSpecPointMap(specPoints) {
  const map = new Map();
  for (const point of specPoints || []) {
    if (point?.id) map.set(point.id, point);
  }
  return map;
}

function computeMasteryPct(srsStates, specPoints) {
  const trackingMap = new Map((srsStates || []).map((row) => [row.spec_point_id, row]));
  let tracked = 0;
  let mastered = 0;

  for (const point of specPoints || []) {
    const srs = trackingMap.get(point.id);
    if (!srs) continue;
    tracked += 1;
    const reps = srs.repetitions ?? 0;
    const days = srs.interval_days || 0;
    const ease = srs.ease_factor ?? 2.5;
    if (reps > 0 && days > 0 && ease >= 2.0) mastered += 1;
  }

  return tracked ? Math.round((mastered / tracked) * 100) : 0;
}

function deriveStrengthsWeaknesses(srsStates, specPointMap, gapAttempts, today) {
  const strengths = [];
  const weaknesses = [];
  for (const srs of srsStates || []) {
    const point = specPointMap.get(srs.spec_point_id);
    if (!point) continue;

    const reps = srs.repetitions ?? 0;
    const days = srs.interval_days || 0;
    const ease = srs.ease_factor ?? 2.5;
    const lapses = srs.lapses ?? 0;
    const label = `${point.topic_name || "Topic"} (${point.spec_ref || "—"})`;
    const subject = point.subject || "";

    if (reps > 0 && ease >= 2.5 && days >= 3 && srs.due_date > today) {
      strengths.push({
        specPointId: srs.spec_point_id,
        label,
        subject,
        score: ease * 10 + days + reps * 2,
        detail: `Secure — interval ${days}d, ease ${ease.toFixed(1)}`,
      });
    }

    if (ease < 2.0 || lapses >= 2 || srs.due_date < today) {
      const reason =
        srs.due_date < today
          ? "Overdue for review"
          : lapses >= 2
            ? `${lapses} lapses — needs consolidation`
            : "Active concept gap";
      weaknesses.push({
        specPointId: srs.spec_point_id,
        label,
        subject,
        score: (ease < 2.0 ? 20 : 0) + lapses * 5 + (srs.due_date < today ? 15 : 0),
        detail: reason,
      });
    } else if (reps === 0 && srs.due_date <= today) {
      weaknesses.push({
        specPointId: srs.spec_point_id,
        label,
        subject,
        score: 8,
        detail: "Scheduled but not yet practised",
      });
    }
  }

  for (const attempt of gapAttempts || []) {
    const specMeta = attempt.questions?.spec_points;
    if (!specMeta) continue;
    const max = attempt.score_max || 0;
    const pct = max > 0 ? Math.round((attempt.score_total / max) * 100) : 0;
    if (pct >= 50) continue;

    const label = `${specMeta.topic_name || "Topic"} (${specMeta.spec_ref || "—"})`;
    const existing = weaknesses.find((w) => w.label === label);
    if (existing) {
      existing.score += 10;
      existing.detail = `Recent failed attempt — scored ${attempt.score_total}/${max}`;
      continue;
    }
    weaknesses.push({
      specPointId: attempt.questions?.spec_point_id,
      label,
      subject: specMeta.subject || "",
      score: 12 + (50 - pct),
      detail: `Recent failed attempt — scored ${attempt.score_total}/${max}`,
    });
  }

  strengths.sort((a, b) => b.score - a.score);
  weaknesses.sort((a, b) => b.score - a.score);

  return {
    strengths: strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 5),
  };
}

function computeSubjectMastery(srsStates, specPointMap) {
  const subjects = { biology: { tracked: 0, mastered: 0 }, chemistry: { tracked: 0, mastered: 0 }, physics: { tracked: 0, mastered: 0 } };

  for (const srs of srsStates || []) {
    const point = specPointMap.get(srs.spec_point_id);
    if (!point?.subject) continue;
    const key = point.subject.toString().toLowerCase().trim();
    if (!subjects[key]) continue;

    subjects[key].tracked += 1;
    const reps = srs.repetitions ?? 0;
    const days = srs.interval_days || 0;
    const ease = srs.ease_factor ?? 2.5;
    if (reps > 0 && days > 0 && ease >= 2.0) subjects[key].mastered += 1;
  }

  return Object.entries(subjects).map(([subject, stats]) => ({
    subject: subject.charAt(0).toUpperCase() + subject.slice(1),
    pct: stats.tracked ? Math.round((stats.mastered / stats.tracked) * 100) : 0,
    tracked: stats.tracked,
  }));
}

function renderSummaryCards({ masteryPct, avgScorePct, dueToday, overdue, streak, totalXp }) {
  return `
    <div class="teacher-detail-stat-card">
      <span class="teacher-detail-stat-label">Overall mastery</span>
      <strong class="teacher-detail-stat-value">${masteryPct}%</strong>
      <span class="teacher-detail-stat-hint">Spec points at secure intervals</span>
    </div>
    <div class="teacher-detail-stat-card">
      <span class="teacher-detail-stat-label">Avg score (30d)</span>
      <strong class="teacher-detail-stat-value">${avgScorePct != null ? `${avgScorePct}%` : "—"}</strong>
      <span class="teacher-detail-stat-hint">Across recent practice attempts</span>
    </div>
    <div class="teacher-detail-stat-card">
      <span class="teacher-detail-stat-label">Revision health</span>
      <strong class="teacher-detail-stat-value">${dueToday} / ${overdue}</strong>
      <span class="teacher-detail-stat-hint">Due today · overdue items</span>
    </div>
    <div class="teacher-detail-stat-card">
      <span class="teacher-detail-stat-label">Total XP</span>
      <strong class="teacher-detail-stat-value">${totalXp ?? 0}</strong>
      <span class="teacher-detail-stat-hint">Practice experience points</span>
    </div>
    <div class="teacher-detail-stat-card">
      <span class="teacher-detail-stat-label">Login streak</span>
      <strong class="teacher-detail-stat-value">${streak || 0}</strong>
      <span class="teacher-detail-stat-hint">Consecutive active days</span>
    </div>
  `;
}

function renderStrengthWeaknessLists(strengths, weaknesses) {
  const strengthItems = strengths.length
    ? strengths
        .map(
          (item) => `
        <li class="teacher-sw-item teacher-sw-item--strength">
          <span class="teacher-sw-label">${escapeHtml(item.label)}</span>
          <span class="teacher-sw-detail">${escapeHtml(item.detail)}</span>
        </li>`
        )
        .join("")
    : `<li class="teacher-sw-empty muted">No clear strengths yet — student may still be building their revision schedule.</li>`;

  const weaknessItems = weaknesses.length
    ? weaknesses
        .map(
          (item) => `
        <li class="teacher-sw-item teacher-sw-item--weakness">
          <span class="teacher-sw-label">${escapeHtml(item.label)}</span>
          <span class="teacher-sw-detail">${escapeHtml(item.detail)}</span>
        </li>`
        )
        .join("")
    : `<li class="teacher-sw-empty muted">No active gaps identified — student is on track.</li>`;

  return `
    <div class="teacher-sw-grid">
      <section class="teacher-sw-section">
        <h3>Strengths</h3>
        <ul class="teacher-sw-list">${strengthItems}</ul>
      </section>
      <section class="teacher-sw-section">
        <h3>Weaknesses</h3>
        <ul class="teacher-sw-list">${weaknessItems}</ul>
      </section>
    </div>
  `;
}

function renderActivityChart(attempts, rangeDays = 30) {
  const today = todayISO();
  const sinceISO = addDaysISO(today, -(rangeDays - 1));
  const buckets = [];
  const bucketStats = {};

  for (let i = 0; i < rangeDays; i++) {
    const dateString = addDaysISO(sinceISO, i);
    const parsed = new Date(`${dateString}T00:00:00`);
    const label =
      dateString === today
        ? "Today"
        : parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    buckets.push({ key: dateString, label: i % 5 === 0 || dateString === today ? label : "" });
    bucketStats[dateString] = { count: 0, full: 0, partial: 0, fail: 0 };
  }

  for (const attempt of attempts || []) {
    const dateKey = String(attempt.submitted_at || "").slice(0, 10);
    if (!bucketStats[dateKey]) continue;
    bucketStats[dateKey].count += 1;
    const outcome = classifyAttemptOutcome(attempt);
    bucketStats[dateKey][outcome] += 1;
  }

  const counts = buckets.map((b) => bucketStats[b.key].count);
  const total = counts.reduce((sum, n) => sum + n, 0);
  const maxCount = Math.max(...counts, 1);

  if (total === 0) {
    return `<p class="muted teacher-detail-empty">No practice activity in the last ${rangeDays} days.</p>`;
  }

  const bars = buckets
    .map((bucket) => {
      const stats = bucketStats[bucket.key];
      const height = Math.round((stats.count / maxCount) * 80);
      const active = stats.count > 0;
      return `
        <div class="teacher-activity-col" title="${escapeHtml(bucket.label || bucket.key)}: ${stats.count} attempt(s)">
          <span class="teacher-activity-count">${active ? stats.count : ""}</span>
          <div class="teacher-activity-bar" style="height: ${active ? height : 4}px; background: ${active ? "#7c3aed" : "#e2e8f0"};"></div>
          <span class="teacher-activity-label">${escapeHtml(bucket.label)}</span>
        </div>`;
    })
    .join("");

  const dailyAvg = (total / rangeDays).toFixed(1);
  return `
    <p class="teacher-detail-tab-lead"><strong>${total}</strong> attempts · <strong>${dailyAvg}</strong>/day average (last ${rangeDays} days)</p>
    <div class="teacher-activity-chart">${bars}</div>
  `;
}

function renderAOMastery(aoStats) {
  const config = [
    { id: "AO1", name: "AO1: Recall & Concepts", color: "#3b82f6" },
    { id: "AO2", name: "AO2: Theory Application", color: "#10b981" },
    { id: "AO3", name: "AO3: Analysis & Evaluation", color: "#f59e0b" },
  ];

  return config
    .map((ao) => {
      const stats = aoStats[ao.id];
      const hasAttempts = stats.max > 0;
      const pct = hasAttempts ? Math.round((stats.earned / stats.max) * 100) : 0;
      return `
        <div class="teacher-ao-card">
          <div class="teacher-ao-header">
            <span>${ao.name}</span>
            <strong style="color:${ao.color}">${hasAttempts ? `${pct}%` : "—"}</strong>
          </div>
          <div class="teacher-ao-bar-track">
            <div class="teacher-ao-bar-fill" style="width:${pct}%; background:${ao.color}"></div>
          </div>
          <span class="teacher-ao-meta">${stats.earned} / ${stats.max} marks earned</span>
        </div>`;
    })
    .join("");
}

function renderSubjectMasteryRows(rows) {
  if (!rows.some((r) => r.tracked > 0)) {
    return `<p class="muted teacher-detail-empty">No subject mastery data yet.</p>`;
  }

  return `
    <table class="teacher-subject-table">
      <thead>
        <tr><th>Subject</th><th>Mastery</th><th>Tracked topics</th></tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
          <tr>
            <td>${escapeHtml(row.subject)}</td>
            <td><strong>${row.pct}%</strong></td>
            <td>${row.tracked}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;
}

async function computeAOMastery(userId) {
  const attempts = await fetchStudentAttemptsWithAO(userId);
  const questionIds = [...new Set(attempts.map((a) => a.question_id))];
  const [questions, markPoints] = await Promise.all([
    fetchQuestionsMeta(questionIds),
    fetchMarkPointsForQuestions(questionIds),
  ]);

  const qMaxAOMap = {};
  for (const q of questions) {
    qMaxAOMap[q.id] = { AO1: 0, AO2: 0, AO3: 0 };
    if (q.question_type === "mcq") qMaxAOMap[q.id].AO1 = 1;
    else if (q.question_type === "numeric") qMaxAOMap[q.id].AO2 = 1;
    else if (q.question_type === "extended_response") {
      qMaxAOMap[q.id].AO1 = 2;
      qMaxAOMap[q.id].AO2 = 2;
      qMaxAOMap[q.id].AO3 = 2;
    }
  }

  for (const mp of markPoints) {
    if (!qMaxAOMap[mp.question_id]) continue;
    const aoKey = mp.ao;
    if (qMaxAOMap[mp.question_id][aoKey] !== undefined) {
      qMaxAOMap[mp.question_id][aoKey] += mp.max_marks || 1;
    }
  }

  const aoStats = {
    AO1: { earned: 0, max: 0 },
    AO2: { earned: 0, max: 0 },
    AO3: { earned: 0, max: 0 },
  };

  for (const att of attempts) {
    const caps = qMaxAOMap[att.question_id];
    if (!caps) continue;
    aoStats.AO1.earned += att.ao1_score || 0;
    aoStats.AO2.earned += att.ao2_score || 0;
    aoStats.AO3.earned += att.ao3_score || 0;
    aoStats.AO1.max += caps.AO1;
    aoStats.AO2.max += caps.AO2;
    aoStats.AO3.max += caps.AO3;
  }

  return aoStats;
}

function setActiveTab(tab) {
  activeTab = tab;
  document.querySelectorAll(".teacher-detail-tab").forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });
}

function renderTabLoading(message = "Loading…") {
  const content = el("studentDetailTabContent");
  if (content) content.innerHTML = `<p class="muted teacher-detail-loading">${escapeHtml(message)}</p>`;
}

async function loadTabContent(tab, ctx) {
  const content = el("studentDetailTabContent");
  if (!content) return;

  if (tab === "overview") {
    content.innerHTML = renderSubjectMasteryRows(ctx.subjectMastery);
    return;
  }

  if (tab === "mastery") {
    content.innerHTML = "";
    const heatmap = renderMasteryHeatmap(ctx.specPoints, ctx.srsStates, null, { readOnly: true });
    content.appendChild(heatmap);
    return;
  }

  if (tab === "activity") {
    content.innerHTML = renderActivityChart(ctx.activityAttempts, 30);
    return;
  }

  if (tab === "ao") {
    renderTabLoading("Loading AO breakdown…");
    try {
      const aoStats = await computeAOMastery(ctx.studentId);
      content.innerHTML = `<div class="teacher-ao-grid">${renderAOMastery(aoStats)}</div>`;
    } catch (err) {
      console.warn(err);
      content.innerHTML = `<p class="muted teacher-detail-empty">Could not load AO mastery data.</p>`;
    }
  }
}

function bindTabHandlers(ctx) {
  document.querySelectorAll(".teacher-detail-tab").forEach((btn) => {
    btn.onclick = () => {
      const tab = btn.dataset.tab;
      if (!tab || tab === activeTab) return;
      setActiveTab(tab);
      loadTabContent(tab, ctx);
    };
  });
}

export function closeStudentDetail() {
  const overlay = el("studentDetailOverlay");
  if (overlay) {
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  }
  activeStudentId = null;
  document.body.classList.remove("teacher-detail-open");
}

export async function openStudentDetail(studentId, displayName) {
  if (!studentId) return;

  const overlay = el("studentDetailOverlay");
  const nameEl = el("studentDetailName");
  const metaEl = el("studentDetailMeta");
  const summaryEl = el("studentDetailSummary");
  const swEl = el("studentDetailStrengthsWeaknesses");

  if (!overlay) return;

  activeStudentId = studentId;
  activeTab = "overview";
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("teacher-detail-open");

  if (nameEl) nameEl.textContent = displayName || "Student";
  if (metaEl) metaEl.textContent = "Loading student progress…";
  if (summaryEl) summaryEl.innerHTML = "";
  if (swEl) swEl.innerHTML = "";
  renderTabLoading();
  setActiveTab("overview");

  try {
    const today = todayISO();
    const sinceISO = addDaysISO(today, -29);

    const profile = await fetchTeacherStudentProfile(studentId);
    const courseTrack = courseTrackForProfile(profile || {});

    const [srsStates, specPoints, gapAttempts, activityAttempts, rosterStatsMap] =
      await Promise.all([
        fetchStudentSRSStateDetailed(studentId),
        fetchAllSpecificationPoints(courseTrack),
        fetchConceptGapAttempts(studentId),
        fetchAttemptActivity(studentId, sinceISO),
        fetchClassRosterStats([studentId]),
      ]);

    const rosterStats = rosterStatsMap[studentId] || {};
    const specPointMap = buildSpecPointMap(specPoints);
    const masteryPct = computeMasteryPct(srsStates, specPoints);
    const { strengths, weaknesses } = deriveStrengthsWeaknesses(
      srsStates,
      specPointMap,
      gapAttempts,
      today
    );
    const subjectMastery = computeSubjectMastery(srsStates, specPointMap);

    const resolvedName = profile?.display_name?.trim() || displayName || "Student";
    if (nameEl) nameEl.textContent = resolvedName;
    if (metaEl) {
      metaEl.textContent = [
        formatSciencePathLabel(profile || {}),
        profile?.onboarding_completed_at ? "Onboarded" : "Not onboarded",
        `Last active: ${formatLastActive(profile?.last_login_date)}`,
      ].join(" · ");
    }

    if (summaryEl) {
      summaryEl.innerHTML = renderSummaryCards({
        masteryPct,
        avgScorePct: rosterStats.avgScorePct,
        dueToday: rosterStats.dueToday || 0,
        overdue: rosterStats.overdue || 0,
        streak: profile?.current_streak || 0,
        totalXp: profile?.total_xp ?? 0,
      });
    }

    if (swEl) swEl.innerHTML = renderStrengthWeaknessLists(strengths, weaknesses);

    const ctx = {
      studentId,
      srsStates,
      specPoints,
      activityAttempts,
      subjectMastery,
    };

    bindTabHandlers(ctx);
    await loadTabContent("overview", ctx);
  } catch (err) {
    console.warn("Student detail load failed:", err?.message || err, err);
    if (metaEl) metaEl.textContent = "Could not load student data.";
    renderTabLoading("Unable to load progress. Please try again.");
  }
}

export function initStudentDetailPanel() {
  const overlay = el("studentDetailOverlay");
  const closeBtn = el("btnCloseStudentDetail");

  if (closeBtn) closeBtn.onclick = () => closeStudentDetail();

  if (overlay) {
    overlay.onclick = (event) => {
      if (event.target === overlay) closeStudentDetail();
    };
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeStudentId) closeStudentDetail();
  });
}
