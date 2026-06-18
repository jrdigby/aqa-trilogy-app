import {
  groupSkillsByCategory,
  normalizeFullCode,
  formatSkillBadge,
  skillAppliesToSubject,
} from "./skillFramework.js";
import {
  suggestSkillsForQuestion,
  mergeSkillSelections,
  extractQuestionSkillCodes,
} from "./skillTagging.js";
import { collectCreatorMarkPoints } from "./adminMetadata.js";

let skillCatalog = [];
let catalogByFullCode = new Map();
let catalogById = new Map();

const PANEL_IDS = {
  creator: { ms: "msSkillsPanel", ws: "wsSkillsPanel", msWrap: "msSkillsWrap", wsWrap: "wsSkillsWrap" },
  edit: { ms: "editMsSkillsPanel", ws: "editWsSkillsPanel", msWrap: "editMsSkillsWrap", wsWrap: "editWsSkillsWrap" },
};

export function getSkillCatalog() {
  return skillCatalog;
}

export function getCatalogByFullCode() {
  return catalogByFullCode;
}

function escapeTooltipText(text) {
  if (!text) return "";
  return String(text).replace(/"/g, "&quot;");
}

function buildSkillTooltip(framework, item, dbRow) {
  const title = item.title || dbRow?.title || "";
  if (framework !== "WS" || !dbRow?.description) {
    return escapeTooltipText(title);
  }
  return escapeTooltipText(`${title}\n\n${dbRow.description}`);
}

export async function loadSkillCatalog(supabaseClient) {
  const { data, error } = await supabaseClient
    .from("skill_framework_items")
    .select("id, framework, code, full_code, category, title, description, subjects, sort_order")
    .order("sort_order", { ascending: true });
  if (error) {
    console.warn("Skill catalog unavailable (run migration?):", error.message);
    skillCatalog = [];
    catalogByFullCode = new Map();
    catalogById = new Map();
    return [];
  }
  skillCatalog = data || [];
  catalogByFullCode = new Map(skillCatalog.map((s) => [s.full_code, s]));
  catalogById = new Map(skillCatalog.map((s) => [s.id, s]));
  renderSkillPanels("creator");
  syncSkillPanelsVisibility("creator");
  return skillCatalog;
}

/** Reload catalog if empty (common when page loaded before auth session). */
export async function ensureSkillCatalogLoaded(supabaseClient) {
  if (skillCatalog.length) return skillCatalog;
  return loadSkillCatalog(supabaseClient);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveSkillIdFromCheckbox(cb) {
  const attrId = cb.dataset.skillId;
  if (attrId && UUID_RE.test(attrId)) return attrId;
  const fc = cb.dataset.fullCode;
  return catalogByFullCode.get(fc)?.id || null;
}

function getSubjectForMode(mode) {
  if (mode === "edit") {
    const subj = document.getElementById("auditSubject")?.value;
    if (subj) return subj;
  }
  return document.getElementById("subjectSelect")?.value || null;
}

function isMsPanelVisible(mode) {
  const qTypeEl = mode === "edit" ? null : document.getElementById("qType");
  const qType = mode === "edit"
    ? loadedEditQuestionType()
    : qTypeEl?.value;
  const mathsChk = document.getElementById(mode === "edit" ? "editChkMathsSkill" : "chkMathsSkill");
  return qType === "numeric" || mathsChk?.checked === true;
}

function loadedEditQuestionType() {
  const qId = document.getElementById("editQuestionId")?.value;
  const cache = window.loadedQuestionsCache || [];
  const q = cache.find((x) => x.id === qId);
  return q?.question_type || "";
}

function renderSkillCheckboxes(container, framework, mode, selectedFullCodes = new Set(), autoCodes = new Set()) {
  if (!container) return;
  const subject = getSubjectForMode(mode);
  const groups = groupSkillsByCategory(framework, subject);
  const html = [];
  for (const [category, items] of groups) {
    html.push(`<div class="skill-category"><div class="skill-category-title">${category}</div><div class="skill-check-grid">`);
    for (const item of items) {
      const dbRow = catalogByFullCode.get(item.full_code);
      if (!dbRow?.id) continue;
      const id = dbRow.id;
      const checked = selectedFullCodes.has(item.full_code) ? " checked" : "";
      const autoMark = autoCodes.has(item.full_code) ? ' data-auto="true"' : "";
      const subjectHint = item.subjects?.length
        ? ` <span class="skill-subject-hint">(${item.subjects.join(", ")})</span>`
        : "";
      const tooltip = buildSkillTooltip(framework, item, dbRow);
      html.push(
        `<label class="skill-check-label" title="${tooltip}">` +
          `<input type="checkbox" class="skill-cb" data-framework="${framework}" data-full-code="${item.full_code}" data-skill-id="${id}"${checked}${autoMark}/>` +
          `<span class="skill-code">${item.full_code}</span>${subjectHint}` +
        `</label>`
      );
    }
    html.push("</div></div>");
  }
  container.innerHTML = html.join("") || `<p class="muted">No ${framework} skills for this subject.</p>`;
}

export function syncSkillPanelsVisibility(mode = "creator") {
  const ids = PANEL_IDS[mode] || PANEL_IDS.creator;
  const msPanel = document.getElementById(ids.ms);
  const wsPanel = document.getElementById(ids.ws);
  if (msPanel) msPanel.classList.toggle("hidden", !isMsPanelVisible(mode));
  if (wsPanel) wsPanel.classList.remove("hidden");
}

export function renderSkillPanels(mode = "creator", question = null, options = {}) {
  syncSkillPanelsVisibility(mode);
  const ids = PANEL_IDS[mode] || PANEL_IDS.creator;
  const selected = new Set(extractQuestionSkillCodes(question));
  const autoCodes = new Set(options.autoCodes || []);

  if (!skillCatalog.length) {
    const msg = `<p class="muted" style="font-size:0.8rem;">MS/WS catalog not loaded — refresh after signing in.</p>`;
    const msWrap = document.getElementById(ids.msWrap);
    const wsWrap = document.getElementById(ids.wsWrap);
    if (msWrap) msWrap.innerHTML = msg;
    if (wsWrap) wsWrap.innerHTML = msg;
    return;
  }

  renderSkillCheckboxes(document.getElementById(ids.msWrap), "MS", mode, selected, autoCodes);
  renderSkillCheckboxes(document.getElementById(ids.wsWrap), "WS", mode, selected, autoCodes);
}

export function collectSelectedSkillIds(mode = "creator") {
  const root = mode === "edit" ? document.getElementById("editForm") : document.getElementById("panelCreator");
  if (!root) return [];
  const ids = [];
  root.querySelectorAll(".skill-cb:checked").forEach((cb) => {
    const id = resolveSkillIdFromCheckbox(cb);
    if (id) ids.push(id);
  });
  return [...new Set(ids)];
}

export function collectSelectedFullCodes(mode = "creator") {
  const root = mode === "edit" ? document.getElementById("editForm") : document.getElementById("panelCreator");
  if (!root) return [];
  return [...root.querySelectorAll(".skill-cb:checked")].map((cb) => cb.dataset.fullCode).filter(Boolean);
}

/** Checked skills the author picked manually (excludes prior auto-detect selections). */
function collectManualSelectedFullCodes(mode = "creator") {
  const root = mode === "edit" ? document.getElementById("editForm") : document.getElementById("panelCreator");
  if (!root) return [];
  return [...root.querySelectorAll(".skill-cb:checked:not([data-auto])")]
    .map((cb) => cb.dataset.fullCode)
    .filter(Boolean);
}

export function buildQuestionDraftForSkills(mode = "creator") {
  const isEdit = mode === "edit";
  const qType = isEdit ? loadedEditQuestionType() : document.getElementById("qType")?.value;
  const prompt = (isEdit ? document.getElementById("editPrompt") : document.getElementById("qPrompt"))?.value?.trim() || "";
  const commandWord = (isEdit ? document.getElementById("editCommandWordSelect") : document.getElementById("commandWordSelect"))?.value || "";
  const isMaths = document.getElementById(isEdit ? "editChkMathsSkill" : "chkMathsSkill")?.checked || false;
  const isRp = document.getElementById(isEdit ? "editChkRequiredPractical" : "chkRequiredPractical")?.checked || false;
  let calculation_config = null;
  if (qType === "numeric" && window.CalcWorkflow) {
    calculation_config = window.CalcWorkflow.buildCalculationConfigFromForm(isEdit ? "edit" : "");
  }
  const markPoints = isEdit
    ? Array.from(document.querySelectorAll("#editMarkPointsWrapper .edit-mp-row, #editMarkPointsWrapper .mark-point-row")).map((row) => ({
        ao: row.querySelector(".edit-mp-ao")?.value,
        point_text: row.querySelector(".edit-mp-text")?.value?.trim(),
      }))
    : collectCreatorMarkPoints();
  return {
    question_type: qType,
    prompt,
    command_word: commandWord,
    is_maths_skill: isMaths,
    is_required_practical: isRp,
    calculation_config,
    subject: getSubjectForMode(mode),
  };
}

export function autoDetectSkills(mode = "creator", { mergeManual = true } = {}) {
  if (!skillCatalog.length) {
    console.warn("MS/WS skill catalog not loaded — auto-detect UI only; save will fail until catalog loads.");
  }
  const draft = buildQuestionDraftForSkills(mode);
  const markPoints = mode === "edit"
    ? Array.from(document.querySelectorAll("#editMarkPointsWrapper .edit-mp-row, #editMarkPointsWrapper .mark-point-row")).map((row) => ({
        ao: row.querySelector(".edit-mp-ao")?.value,
        point_text: row.querySelector(".edit-mp-text")?.value?.trim(),
      }))
    : collectCreatorMarkPoints();
  const suggested = suggestSkillsForQuestion(draft, markPoints);
  const autoCodes = [...suggested.ms, ...suggested.ws];
  let selected = new Set(autoCodes);
  if (mergeManual) {
    for (const code of collectManualSelectedFullCodes(mode)) selected.add(code);
  }
  renderSkillPanels(mode, { question_skills: [...selected].map((fc) => ({ skill_framework_items: { full_code: fc } })) }, { autoCodes });
  return { suggested, autoCodes };
}

export async function saveQuestionSkills(supabaseClient, questionId, skillIds) {
  const { error: deleteError } = await supabaseClient
    .from("question_skills")
    .delete()
    .eq("question_id", questionId);
  if (deleteError) throw deleteError;
  if (!skillIds?.length) return;
  const rows = skillIds.map((skill_id) => ({ question_id: questionId, skill_id }));
  const { error: insertError } = await supabaseClient.from("question_skills").insert(rows);
  if (insertError) throw insertError;
}

export async function saveSkillsFromForm(supabaseClient, questionId, mode = "creator") {
  await ensureSkillCatalogLoaded(supabaseClient);
  const selectedCodes = collectSelectedFullCodes(mode);
  let ids = collectSelectedSkillIds(mode);
  if (selectedCodes.length && !ids.length) {
    ids = selectedCodes
      .map((fc) => catalogByFullCode.get(fc)?.id)
      .filter(Boolean);
  }
  if (selectedCodes.length && !ids.length) {
    throw new Error(
      "Could not resolve MS/WS skill IDs. Sign out and back in, or confirm the MS/WS migration ran in Supabase."
    );
  }
  await saveQuestionSkills(supabaseClient, questionId, ids);
}

/** Attach question_skills rows when nested select is missing or empty. */
export async function attachSkillsToQuestions(supabaseClient, questions) {
  if (!questions?.length) return questions || [];
  const qIds = questions.map((q) => q.id).filter(Boolean);
  if (!qIds.length) return questions;

  const { data, error } = await supabaseClient
    .from("question_skills")
    .select("question_id, skill_id, skill_framework_items(full_code, framework, title)")
    .in("question_id", qIds);

  if (error) {
    console.warn("question_skills batch fetch:", error.message);
    return questions;
  }

  const byQuestion = new Map();
  for (const row of data || []) {
    if (!byQuestion.has(row.question_id)) byQuestion.set(row.question_id, []);
    byQuestion.get(row.question_id).push(row);
  }

  return questions.map((q) => ({
    ...q,
    question_skills: byQuestion.get(q.id)?.length ? byQuestion.get(q.id) : q.question_skills || [],
  }));
}

export function resolveSkillIdsFromCodeStrings(msRaw, wsRaw) {
  const codes = [
    ...(msRaw || "").split(/[;,|]/).map((s) => s.trim()).filter(Boolean),
    ...(wsRaw || "").split(/[;,|]/).map((s) => s.trim()).filter(Boolean),
  ];
  const ids = [];
  for (const raw of codes) {
    const fc = normalizeFullCode(raw);
    const row = fc ? catalogByFullCode.get(fc) : null;
    if (row?.id) ids.push(row.id);
  }
  return [...new Set(ids)];
}

export function isSkillsMetadataIncomplete(question) {
  if (!question) return false;
  const codes = extractQuestionSkillCodes(question);
  const hasMs = codes.some((c) => c.startsWith("MS"));
  if (question.question_type === "numeric" && !hasMs) return true;
  if (question.is_maths_skill && !hasMs) return true;
  return false;
}

export function formatQuestionSkillsBadge(question) {
  const codes = extractQuestionSkillCodes(question);
  return formatSkillBadge(codes);
}

export async function bulkAutoTagUntagged(supabaseClient, onProgress) {
  const selectCols =
    "id, question_type, prompt, command_word, is_maths_skill, is_required_practical, calculation_config, question_skills(skill_id, skill_framework_items(full_code)), spec_points!spec_point_id(subject)";
  let questions = [];
  const { data, error } = await supabaseClient.from("questions").select(selectCols);
  if (error) {
    const { data: fallback } = await supabaseClient
      .from("questions")
      .select("id, question_type, prompt, command_word, is_maths_skill, is_required_practical, calculation_config, spec_points!spec_point_id(subject)");
    questions = fallback || [];
  } else {
    questions = data || [];
  }

  let tagged = 0;
  let skipped = 0;
  for (const q of questions) {
    const existing = extractQuestionSkillCodes(q);
    if (existing.length) {
      skipped += 1;
      continue;
    }
    const subject = q.spec_points?.subject || null;
    const suggested = suggestSkillsForQuestion({ ...q, subject });
    const allCodes = mergeSkillSelections([], suggested);
    const skillIds = allCodes.map((fc) => catalogByFullCode.get(fc)?.id).filter(Boolean);
    if (!skillIds.length) {
      skipped += 1;
      continue;
    }
    await saveQuestionSkills(supabaseClient, q.id, skillIds);
    tagged += 1;
    onProgress?.({ tagged, skipped, total: questions.length });
  }
  return { tagged, skipped, total: questions.length };
}

export function initAdminSkillsUI(supabaseClient) {
  const debounce = (fn, ms) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  const triggerAuto = debounce(() => autoDetectSkills("creator", { mergeManual: true }), 400);

  document.getElementById("btnAutoDetectSkills")?.addEventListener("click", () => {
    autoDetectSkills("creator", { mergeManual: true });
  });
  document.getElementById("btnAutoDetectEditSkills")?.addEventListener("click", () => {
    autoDetectSkills("edit", { mergeManual: true });
  });
  document.getElementById("btnBulkAutoTagSkills")?.addEventListener("click", async () => {
    const btn = document.getElementById("btnBulkAutoTagSkills");
    if (btn) btn.disabled = true;
    try {
      const result = await bulkAutoTagUntagged(supabaseClient);
      window.showAdminToast?.(`Auto-tagged ${result.tagged} questions (${result.skipped} skipped).`);
      window.refreshAuditTable?.();
    } catch (err) {
      window.showAdminToast?.("Bulk auto-tag failed: " + err.message, true);
    } finally {
      if (btn) btn.disabled = false;
    }
  });

  ["qType", "chkMathsSkill", "chkRequiredPractical", "subjectSelect"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      syncSkillPanelsVisibility("creator");
      if (id === "subjectSelect") {
        renderSkillPanels("creator");
      } else {
        triggerAuto();
      }
    });
  });

  document.getElementById("qPrompt")?.addEventListener("blur", triggerAuto);
  document.getElementById("commandWordSelect")?.addEventListener("change", triggerAuto);

  document.getElementById("editChkMathsSkill")?.addEventListener("change", () => syncSkillPanelsVisibility("edit"));
  document.getElementById("editPrompt")?.addEventListener("blur", debounce(() => autoDetectSkills("edit", { mergeManual: true }), 400));

  [
    "CalcStepSigFigs", "CalcStepConversion", "CalcStepRearrangement", "CalcStepSubstitution", "CalcStepEquation",
    "editCalcStepSigFigs", "editCalcStepConversion", "editCalcStepRearrangement", "editCalcStepSubstitution", "editCalcStepEquation"
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      const mode = id.startsWith("edit") ? "edit" : "creator";
      autoDetectSkills(mode, { mergeManual: true });
    });
  });

  renderSkillPanels("creator");
}

export function initEditSkillsUI(question) {
  renderSkillPanels("edit", question);
}

export async function prepareEditSkillsUI(supabaseClient, question) {
  await ensureSkillCatalogLoaded(supabaseClient);
  renderSkillPanels("edit", question);
}

export function resetCreatorSkillsUI() {
  renderSkillPanels("creator");
}
