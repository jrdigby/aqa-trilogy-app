// Physics calculation workflow — render, collect, validate, and mark step-by-step numeric questions
import { escapeHtml } from "./utils.js";
import { matchesSigFigs, roundToSigFigs } from "./sigFigs.js";
import { normalizeTier, courseTrackForProfile, resolveQuestionSpecMeta } from "./sciencePath.js";
import {
  buildNumericRearrangementOptions,
  collectSubstitutionPayload,
  enrichCalculationConfigFromEquationSheet,
  findEquationInSheet,
  getSlotIdsFromTemplate,
  getSubstitutionTemplate,
  isStructuredSubstitutionStep,
  refreshRearrangementSelect,
  refreshSubstitutionStepDom,
  renderSubstitutionStepInner,
  resolveEquationIdForSubstitution,
  resolveSubstitutionContext,
  substitutionPayloadIsComplete,
  substitutionSlotsMatch
} from "./substitutionTemplate.js";

const STEP_ORDER = [
  "equation_select",
  "substitution",
  "conversion",
  "rearrangement",
  "calculate",
  "sig_figs"
];

const STEP_LABELS = {
  practice: {
    equation_select: "Step: Choose the correct equation",
    substitution: "Step: Substitute values into the equation",
    conversion: "Step: Unit conversion",
    rearrangement: "Step: Choose the correct rearranged formula",
    calculate: "Step: Calculate the final answer",
    sig_figs: "Step: Answer to required significant figures"
  },
  exam: {
    equation_select: "Write the equation used",
    substitution: "Substitute the values",
    conversion: "Unit conversion",
    rearrangement: "Rearrange the equation",
    calculate: "Calculate your answer",
    sig_figs: "Give your answer to the required significant figures"
  }
};

const DEFAULT_CALCULATE_STEP = {
  type: "calculate",
  marks: 1,
  ao: "AO2",
  required: true
};

/**
 * GCSE mark scheme:
 * - Equation given: 1 substitution + 1 answer; +1 each for conversion, rearrangement, sig figs if needed
 * - From equation sheet: 0 equation select + 1 substitution + 1 rearrangement + 1 answer; +1 conversion/sig figs if needed
 */
export function markForStep(type, enabled = true) {
  if (!enabled && type !== "calculate") return 0;
  switch (type) {
    case "equation_select":
      return 0;
    case "substitution":
    case "calculate":
    case "conversion":
    case "rearrangement":
    case "sig_figs":
      return enabled ? 1 : 0;
    default:
      return 0;
  }
}

export function normalizeCalculationConfig(config) {
  if (!config?.steps?.length) return config;
  return {
    ...config,
    steps: config.steps.map((step) => ({
      ...step,
      marks: markForStep(step.type, step.required !== false)
    }))
  };
}

export function getPresentationMode(sessionMode) {
  return sessionMode === "paper_practice" ? "exam" : "practice";
}

export function getCalculationConfig(q) {
  const cfg = q?.calculation_config;
  if (cfg && Array.isArray(cfg.steps) && cfg.steps.length) {
    return normalizeCalculationConfig(cfg);
  }
  return {
    equation_given: true,
    equation_sheet_id: null,
    equation_override_distractors: null,
    steps: [DEFAULT_CALCULATE_STEP]
  };
}

export function getActiveSteps(config) {
  const steps = config?.steps || [];
  return STEP_ORDER
    .map((type) => steps.find((s) => s.type === type && s.required !== false))
    .filter(Boolean);
}

export function computeMaxMarksFromConfig(config) {
  return getActiveSteps(config).reduce((sum, s) => sum + (Number(s.marks) || 0), 0);
}

/** Final-answer-only numeric: one calculate step, no substitution / conversion / etc. */
export function isSimpleNumericMode(q, config = null) {
  const steps = getActiveSteps(config ?? getCalculationConfig(q));
  return steps.length === 1 && steps[0]?.type === "calculate";
}

/** Same as isSimpleNumericMode but reads the live admin form. */
export function isSimpleNumericModeFromForm(prefix = "") {
  return isSimpleNumericMode(null, buildCalculationConfigFromForm(prefix));
}

const FEEDBACK_FIELD_BY_TYPE = {
  equation_select: "CalcEquationFeedback",
  substitution: "CalcSubstitutionFeedback",
  conversion: "CalcConversionFeedback",
  rearrangement: "CalcRearrangeFeedback",
  calculate: "CalcCalculateFeedback",
  sig_figs: "CalcSigFigsFeedback"
};

function readStepFeedback(prefix, fieldSuffix) {
  const val = document.getElementById(prefix + fieldSuffix)?.value?.trim();
  return val || undefined;
}

function writeStepFeedback(prefix, fieldSuffix, value) {
  const el = document.getElementById(prefix + fieldSuffix);
  if (el) el.value = value || "";
}

/** Pull legacy Section 3 mark_points into calculation_config for editing. */
export function mergeLegacyNumericMarkPoints(config, markPoints) {
  if (!markPoints?.length) return config;
  const base = config || { equation_given: true, steps: [{ type: "calculate", required: true }] };
  const cfg = {
    ...base,
    steps: (base.steps || []).map((s) => ({ ...s })),
    remediation_steps: [...(base.remediation_steps || [])]
  };
  const calcTagRe = /^\[calc:(\w+)\]$/;

  for (const mp of markPoints) {
    const fb = mp.feedback_if_missing?.trim();
    if (!fb) continue;
    const match = mp.point_text?.match(calcTagRe);
    if (match) {
      const step = cfg.steps.find((s) => s.type === match[1]);
      if (step && !step.feedback_if_wrong) step.feedback_if_wrong = fb;
      continue;
    }
    if (isSimpleNumericMode(null, cfg)) {
      const exists = cfg.remediation_steps.some((s) => s.text === fb);
      if (!exists) {
        cfg.remediation_steps.push({ ao: mp.ao || "AO2", text: fb });
      }
    }
  }
  return cfg;
}

export function buildRemediationStepsFromForm(prefix = "") {
  const wrap = document.getElementById(`${prefix}CalcRemediationWrapper`);
  if (!wrap) return [];
  return Array.from(wrap.querySelectorAll(".calc-rem-row"))
    .map((row) => ({
      ao: row.querySelector(".calc-rem-ao")?.value || "AO2",
      text: row.querySelector(".calc-rem-text")?.value?.trim() || ""
    }))
    .filter((s) => s.text);
}

export function populateRemediationSteps(prefix, steps = []) {
  const wrap = document.getElementById(`${prefix}CalcRemediationWrapper`);
  if (!wrap || typeof window.addCalcRemediationRow !== "function") return;
  wrap.innerHTML = "";
  if (window.resetCalcRemediationCounter) window.resetCalcRemediationCounter(prefix);
  for (const step of steps) {
    window.addCalcRemediationRow(prefix, step.ao || "AO2", step.text || "");
  }
}

/** Show/hide numeric-specific authoring panels (Section 3 hidden for numeric). */
export function updateNumericAuthoringUi(prefix = "", questionType = null) {
  const type = questionType
    ?? (prefix === "edit"
      ? document.getElementById("editQuestionType")?.value
      : document.getElementById("qType")?.value);
  const isNumeric = type === "numeric";
  const simple = isNumeric && isSimpleNumericModeFromForm(prefix);

  const section3 = document.getElementById(prefix === "edit" ? "editMarkpointsBlock" : "creatorSectionMarkpoints");
  if (section3) section3.classList.toggle("hidden", isNumeric);

  const simplePanel = document.getElementById(`${prefix}CalcSimpleRemediationPanel`);
  const multiNote = document.getElementById(`${prefix}CalcMultiStepFeedbackNote`);
  if (simplePanel) simplePanel.classList.toggle("hidden", !simple);
  if (multiNote) multiNote.classList.toggle("hidden", !isNumeric || simple);

  const calcFeedback = document.getElementById(`${prefix}CalcPanelCalculate`);
  if (calcFeedback) calcFeedback.classList.toggle("hidden", !isNumeric);

  updateStructuredSubstitutionAuthoringUi(prefix);
}

function readSlotAnswersFromForm(prefix = "") {
  const wrap = document.getElementById(`${prefix}CalcSubstitutionSlots`);
  if (!wrap) return {};
  const answers = {};
  wrap.querySelectorAll("[data-slot-id]").forEach((row) => {
    const id = row.dataset.slotId;
    const raw = row.querySelector("input")?.value?.trim() || "";
    if (id && raw) {
      answers[id] = raw.split("|").map((s) => s.trim()).filter(Boolean);
    }
  });
  return answers;
}

function renderSubstitutionSlotRows(prefix, template, slotAnswers = {}) {
  const wrap = document.getElementById(`${prefix}CalcSubstitutionSlots`);
  if (!wrap || !template) {
    if (wrap) wrap.innerHTML = "";
    return;
  }
  const slotIds = getSlotIdsFromTemplate(template);
  wrap.innerHTML = slotIds.map((id) => {
    const vals = slotAnswers[id];
    const value = Array.isArray(vals) ? vals.join(" | ") : (vals || "");
    return `
      <div class="row" data-slot-id="${escapeHtml(id)}" style="margin-bottom:6px;align-items:center;">
        <label style="min-width:3em;font-weight:600;">${escapeHtml(id)}</label>
        <input type="text" value="${escapeHtml(value)}" placeholder="e.g. 400 or I | i" title="Use | for accepted alternates" style="flex:1;padding:6px;border:1px solid #cbd5e1;border-radius:4px;"/>
      </div>`;
  }).join("");
}

function renderStructuredSubstitutionPreview(prefix, template, slotAnswers) {
  const preview = document.getElementById(`${prefix}CalcSubstitutionPreview`);
  if (!preview) return;
  if (!template) {
    preview.innerHTML = "<span class=\"muted\">Select an equation with a template to preview slot layout.</span>";
    return;
  }
  preview.innerHTML = renderSubstitutionStepInner(
    { mode: "structured", template, equationId: null },
    "padding:4px;font-size:0.85rem;border:1px solid #94a3b8;border-radius:4px;"
  );
}

function populateRearrangementSubjectSelect(prefix, template, selected = "") {
  const select = document.getElementById(`${prefix}CalcRearrangementSubject`);
  if (!select) return;
  const slotIds = getSlotIdsFromTemplate(template);
  select.innerHTML = slotIds.map((id) => {
    const sel = id === selected ? " selected" : "";
    return `<option value="${escapeHtml(id)}"${sel}>${escapeHtml(id)}</option>`;
  }).join("");
}

function updateRearrangementNumericPreview(prefix, equation, subStep, rearrStep) {
  const preview = document.getElementById(`${prefix}CalcRearrangementNumericPreview`);
  if (!preview) return;
  const mode = document.getElementById(`${prefix}CalcRearrangementMode`)?.value || rearrStep?.mode || "symbolic";
  if (mode !== "numeric" || !subStep?.slot_answers) {
    preview.textContent = "";
    return;
  }
  const subject = document.getElementById(`${prefix}CalcRearrangementSubject`)?.value
    || subStep.rearrangement_subject
    || rearrStep?.subject;
  const built = buildNumericRearrangementOptions(equation, subStep, { ...rearrStep, subject, mode: "numeric" });
  if (!built.answer) {
    preview.textContent = "Fill slot answers above to preview numeric rearrangement options.";
    return;
  }
  preview.innerHTML = `<strong>Correct:</strong> ${escapeHtml(built.answer)}<br/><strong>Distractors:</strong> ${escapeHtml((built.distractors || []).join(", ") || "—")}`;
}

/** Show structured vs free-text substitution authoring panels. */
export function updateStructuredSubstitutionAuthoringUi(prefix = "") {
  const p = (id) => document.getElementById(prefix + id);
  const mode = p("CalcSubstitutionMode")?.value || "free_text";
  const structured = mode === "structured";
  p("CalcSubstitutionStructuredPanel")?.classList.toggle("hidden", !structured);
  p("CalcSubstitutionFreeTextPanel")?.classList.toggle("hidden", structured);
  p("CalcSubstitutionEquationRow")?.classList.toggle("hidden", !structured);

  const subOn = !!p("CalcStepSubstitution")?.checked;
  const rearrOn = !!p("CalcStepRearrangement")?.checked;
  p("CalcRearrangementStructuredExtras")?.classList.toggle("hidden", !(structured && subOn && rearrOn));
}

export async function refreshStructuredSubstitutionAdmin(supabaseClient, prefix = "") {
  const p = (id) => document.getElementById(prefix + id);
  updateStructuredSubstitutionAuthoringUi(prefix);

  const mode = p("CalcSubstitutionMode")?.value || "free_text";
  if (mode !== "structured") return;

  const sheetId = p("CalcEquationSheet")?.value || "";
  const eqSelect = p("CalcSubstitutionEquation");
  if (!eqSelect) return;

  const equations = sheetId
    ? await loadEquationSheetOptions(supabaseClient, sheetId)
    : [];
  const current = eqSelect.value || eqSelect.dataset.pendingEquation || "";
  fillEquationSelectElement(eqSelect, equations, current);
  if (eqSelect.dataset.pendingEquation) delete eqSelect.dataset.pendingEquation;

  const eqId = eqSelect.value || p("CalcEquationAnswer")?.value || "";
  const equation = equations.find((e) => e.id === eqId || e.label === eqId) || null;
  const template = getSubstitutionTemplate(equation);
  const slotAnswers = readSlotAnswersFromForm(prefix);
  if (!Object.keys(slotAnswers).length && p("CalcSubstitutionSlots")?.dataset.pendingAnswers) {
    try {
      Object.assign(slotAnswers, JSON.parse(p("CalcSubstitutionSlots").dataset.pendingAnswers));
    } catch (_) { /* ignore */ }
    delete p("CalcSubstitutionSlots").dataset.pendingAnswers;
  }
  renderSubstitutionSlotRows(prefix, template, slotAnswers);
  renderStructuredSubstitutionPreview(prefix, template, slotAnswers);
  populateRearrangementSubjectSelect(
    prefix,
    template,
    p("CalcRearrangementSubject")?.value || equation?.rearrangement_forms?.default_subject || ""
  );

  const subStep = { slot_answers: readSlotAnswersFromForm(prefix), rearrangement_subject: p("CalcRearrangementSubject")?.value };
  const rearrStep = { mode: p("CalcRearrangementMode")?.value || "numeric", subject: p("CalcRearrangementSubject")?.value };
  updateRearrangementNumericPreview(prefix, equation, subStep, rearrStep);
}

export function wireStructuredSubstitutionAuthoring(prefix = "", supabaseClient, onChange) {
  const ids = [
    "CalcSubstitutionMode",
    "CalcSubstitutionEquation",
    "CalcRearrangementMode",
    "CalcRearrangementSubject"
  ];
  for (const id of ids) {
    const el = document.getElementById(prefix + id);
    el?.addEventListener("change", async () => {
      await refreshStructuredSubstitutionAdmin(supabaseClient, prefix);
      onChange?.(prefix);
    });
  }
  const slotsWrap = document.getElementById(`${prefix}CalcSubstitutionSlots`);
  slotsWrap?.addEventListener("input", async () => {
    await refreshStructuredSubstitutionAdmin(supabaseClient, prefix);
    onChange?.(prefix);
  });
}

/** Fetch equations array from a shared equation sheet row. */
export async function loadEquationSheetOptions(supabaseClient, sheetId) {
  if (!sheetId || !supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from("equation_sheets")
    .select("equations")
    .eq("id", sheetId)
    .maybeSingle();
  if (error || !data?.equations) return [];
  return Array.isArray(data.equations) ? data.equations : [];
}

/** Whether a numeric question needs equation sheet data (select step, sheet workflow, or structured substitution). */
export function questionNeedsEquationSheet(q) {
  const cfg = getCalculationConfig(q);
  const steps = getActiveSteps(cfg);
  if (steps.some((s) => s.type === "equation_select")) return true;
  if (cfg.equation_given === false) return true;
  return steps.some((s) => s.type === "substitution" && isStructuredSubstitutionStep(s));
}

/** Load equation sheet row for numeric questions that need sheet data. */
export async function loadEquationSheetForQuestion(supabaseClient, q, profile = null, { sessionTier = null } = {}) {
  if (!supabaseClient || !q) return null;

  const cfg = getCalculationConfig(q);
  if (!questionNeedsEquationSheet(q)) return null;

  let sheetId = resolveEquationSheetIdForQuestion(q, profile, { sessionTier });
  if (!sheetId && cfg.equation_sheet_id) {
    sheetId = cfg.equation_sheet_id;
  }
  if (!sheetId) return null;

  const { data, error } = await supabaseClient
    .from("equation_sheets")
    .select("id, title, equations")
    .eq("id", sheetId)
    .maybeSingle();
  if (error || !data) {
    console.warn("loadEquationSheetForQuestion:", error);
    return null;
  }
  return data;
}

/** Plain-text equation for &lt;option&gt; labels (MathJax cannot run inside options). */
export function latexToPlainOptionText(latex) {
  if (!latex) return "";
  let s = String(latex).trim();
  s = s.replace(/\\text\{([^}]*)\}/g, "$1");
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1/$2");
  s = s.replace(/\\Delta/g, "Δ");
  s = s.replace(/\\theta/g, "θ");
  s = s.replace(/\\rho/g, "ρ");
  s = s.replace(/\\lambda/g, "λ");
  s = s.replace(/\^\{?2\}?/g, "²");
  s = s.replace(/\\times/g, "×");
  s = s.replace(/\\cdot/g, "·");
  s = s.replace(/[{}\\]/g, "");
  s = s.replace(/_/g, "");
  s = s.replace(/\s+/g, " ");
  return s.trim();
}

export function formatEquationOptionText(eq) {
  const label = eq.label || eq.id || "";
  const plain = latexToPlainOptionText(eq.latex || "");
  if (!plain || plain === label) return label;
  return `${label} — ${plain}`;
}

function equationPreviewMarkup(latex) {
  if (!latex) return "";
  return `<span class="calc-eq-latex">$${latex}$</span>`;
}

export function updateEquationSelectPreview(selectEl, previewEl, equations) {
  if (!previewEl) return;
  if (!selectEl?.value) {
    previewEl.innerHTML = "";
    previewEl.style.display = "none";
    return;
  }
  const eq = (equations || []).find((e) => (e.id || e.label) === selectEl.value);
  const latex = eq?.latex || selectEl.selectedOptions?.[0]?.dataset?.latex || "";
  if (!latex) {
    previewEl.innerHTML = "";
    previewEl.style.display = "none";
    return;
  }
  previewEl.innerHTML = equationPreviewMarkup(latex);
  previewEl.style.display = "inline-flex";
}

export function wireEquationSelectPreview(selectEl, previewEl, equations, onTypeset) {
  if (!selectEl || !previewEl) return;
  if (selectEl._eqPreviewHandler) {
    selectEl.removeEventListener("change", selectEl._eqPreviewHandler);
  }
  const handler = () => {
    updateEquationSelectPreview(selectEl, previewEl, equations);
    onTypeset?.();
  };
  selectEl._eqPreviewHandler = handler;
  selectEl.addEventListener("change", handler);
  handler();
}

/** Wire student sandbox / practice equation dropdown preview after DOM render. */
export function wireStudentEquationSelectPreview(onTypeset, q = null, equationSheet = null) {
  const select = document.getElementById("calc_equation_select");
  const preview = document.getElementById("calc_equation_select_preview");
  const style = inputStyle();

  const rerenderStructuredSteps = () => {
    if (!q) return;
    const config = enrichCalculationConfigFromEquationSheet(getCalculationConfig(q), equationSheet);
    const steps = getActiveSteps(config);
    const subStep = steps.find((s) => s.type === "substitution");
    if (subStep) {
      refreshSubstitutionStepDom(config, equationSheet, subStep, style);
    }
    const rearrStep = steps.find((s) => s.type === "rearrangement");
    if (rearrStep?.mode === "numeric" && subStep?.slot_answers) {
      const eqId = resolveEquationIdForSubstitution(config, equationSheet, subStep);
      const eq = findEquationInSheet(equationSheet, eqId);
      const built = buildNumericRearrangementOptions(eq, subStep, rearrStep);
      refreshRearrangementSelect(rearrStep, built);
    }
  };

  if (!select || !preview) {
    rerenderStructuredSteps();
    return;
  }

  const equations = Array.from(select.options)
    .filter((opt) => opt.value)
    .map((opt) => ({
      id: opt.value,
      label: opt.textContent.split(" — ")[0] || opt.value,
      latex: opt.dataset.latex || ""
    }));

  if (select._structuredSubHandler) {
    select.removeEventListener("change", select._structuredSubHandler);
  }
  const structuredHandler = () => rerenderStructuredSteps();
  select._structuredSubHandler = structuredHandler;
  select.addEventListener("change", structuredHandler);

  wireEquationSelectPreview(select, preview, equations, () => {
    onTypeset?.();
    rerenderStructuredSteps();
  });
  rerenderStructuredSteps();
}

export function fillEquationSelectElement(selectEl, equations, selectedId = "") {
  if (!selectEl) return;
  const opts = ['<option value="">— Select correct equation —</option>'];
  for (const eq of equations) {
    const id = eq.id || eq.label || "";
    if (!id) continue;
    const sel = id === selectedId ? " selected" : "";
    const latexAttr = eq.latex ? ` data-latex="${escapeHtml(eq.latex)}"` : "";
    opts.push(
      `<option value="${escapeHtml(id)}"${latexAttr}${sel}>${escapeHtml(formatEquationOptionText(eq))}</option>`
    );
  }
  selectEl.innerHTML = opts.join("");
}

/** Refresh creator or edit equation dropdown from the selected sheet. */
export async function refreshEquationSelect(supabaseClient, prefix = "", selectedId = "") {
  const p = (id) => document.getElementById(prefix + id);
  const sheetId = p("CalcEquationSheet")?.value || "";
  const select = p("CalcEquationAnswer");
  if (!select) return [];

  if (!sheetId) {
    select.innerHTML = '<option value="">— Select an equation sheet above —</option>';
    return [];
  }

  const equations = await loadEquationSheetOptions(supabaseClient, sheetId);
  fillEquationSelectElement(select, equations, selectedId || select.value);
  const preview = p("CalcEquationAnswerPreview");
  wireEquationSelectPreview(select, preview, equations, () => {
    if (typeof window !== "undefined" && window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise().catch(() => {});
    }
  });
  return equations;
}

/** Keep max-marks select visible and synced with enabled workflow steps. */
export function syncMaxMarksSelect(prefix = "") {
  const isCreator = prefix === "";
  const qTypeEl = document.getElementById("qType");
  if (isCreator && qTypeEl?.value !== "numeric") return;

  const maxMarksEl = document.getElementById(isCreator ? "maxMarks" : "editMaxMarks");
  const maxMarksRow = isCreator ? document.getElementById("maxMarksRow") : null;
  if (!maxMarksEl) return;

  const cfg = buildCalculationConfigFromForm(prefix);
  const n = Math.max(1, computeMaxMarksFromConfig(cfg));

  if (maxMarksRow) {
    maxMarksRow.classList.remove("hidden");
    maxMarksRow.title = isCreator && qTypeEl?.value === "numeric"
      ? "Updates automatically when calculation steps change; override if needed."
      : "";
  }

  maxMarksEl.innerHTML = "";
  const limit = Math.max(6, n);
  for (let i = 1; i <= limit; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = i === 1 ? "1 mark" : `${i} marks`;
    maxMarksEl.appendChild(opt);
  }
  maxMarksEl.value = String(n);

  if (window.AdminMetadata) {
    if (isCreator) {
      window.AdminMetadata.syncCreatorMetadataFromForm?.();
    } else {
      const max = parseInt(maxMarksEl.value, 10) || n;
      window.AdminMetadata.updateAoValidationLabel?.("edit", max);
    }
  }
}

export function inferCalculationPreset(demandLevel) {
  return ["low", "standard"].includes(demandLevel) ? "given_equation" : "equation_sheet";
}

const COMBINED_SHEET_ID_RE = /^physics_(p[12])_(ft|ht)$/;
const TRIPLE_SHEET_ID_RE = /^triple_physics_(p[12])_(ft|ht)$/;

/** Map admin subject / paper / tier / course track to an equation_sheets row id. */
export function resolveEquationSheetId({ subject, paper, tier, courseTrack = "combined" }) {
  if (subject !== "physics") return null;
  const paperKey = paper === "paper1" ? "p1" : paper === "paper2" ? "p2" : null;
  if (!paperKey) return null;
  const t = String(tier || "").toLowerCase();
  const tierKey = t === "higher" || t === "ht" ? "ht" : "ft";
  const prefix = courseTrack === "triple" ? "triple_" : "";
  return `${prefix}physics_${paperKey}_${tierKey}`;
}

/** Map a stored sheet id to the student's course track (combined ↔ triple). */
export function mapEquationSheetIdForCourseTrack(sheetId, courseTrack = "combined") {
  if (!sheetId) return sheetId;
  const track = courseTrack === "triple" ? "triple" : "combined";
  if (track === "triple") {
    const combined = sheetId.match(COMBINED_SHEET_ID_RE);
    if (combined) return `triple_physics_${combined[1]}_${combined[2]}`;
    return sheetId;
  }
  const triple = sheetId.match(TRIPLE_SHEET_ID_RE);
  if (triple) return `physics_${triple[1]}_${triple[2]}`;
  return sheetId;
}

/** Remap FT ↔ HT suffix on a canonical physics sheet id. */
export function mapEquationSheetIdForTier(sheetId, tier) {
  if (!sheetId) return sheetId;
  const tierKey = normalizeTier(tier) === "HT" ? "ht" : "ft";
  if (COMBINED_SHEET_ID_RE.test(sheetId) || TRIPLE_SHEET_ID_RE.test(sheetId)) {
    return sheetId.replace(/_(ft|ht)$/, `_${tierKey}`);
  }
  return sheetId;
}

function resolveEffectiveTierForEquationSheet(q, profile, sessionTier) {
  const qt = String(q?.tier || "both").toLowerCase();
  if (qt === "ht" || qt === "higher") return "HT";
  if (qt === "ft" || qt === "foundation") return "FT";
  return normalizeTier(sessionTier || profile?.preferred_tier || "FT");
}

/**
 * Resolve which equation sheet row to load for a question and student profile.
 * Derives paper/tier from spec metadata when available, then remaps for science path and tier.
 */
export function resolveEquationSheetIdForQuestion(q, profile, { courseTrack = null, sessionTier = null } = {}) {
  const cfg = getCalculationConfig(q);
  const subStep = getActiveSteps(cfg).find((s) => s.type === "substitution");
  const needsStructuredSheet = isStructuredSubstitutionStep(subStep);

  if (cfg.equation_given !== false) {
    return needsStructuredSheet ? (cfg.equation_sheet_id || null) : null;
  }

  const track = courseTrack || courseTrackForProfile(profile);
  const effectiveTier = resolveEffectiveTierForEquationSheet(q, profile, sessionTier);
  const spec = resolveQuestionSpecMeta(q, profile);

  let sheetId = cfg.equation_sheet_id || null;
  if (spec?.subject === "physics" && spec?.paper) {
    const derived = resolveEquationSheetId({
      subject: spec.subject,
      paper: spec.paper,
      tier: effectiveTier,
      courseTrack: track
    });
    if (derived) sheetId = derived;
  }

  if (!sheetId) return null;
  sheetId = mapEquationSheetIdForCourseTrack(sheetId, track);
  return mapEquationSheetIdForTier(sheetId, effectiveTier);
}

/** Read subject, paper, tier, and course track from the creator or edit admin form. */
export function readAuthoringContext(prefix = "") {
  if (prefix === "edit") {
    return {
      subject: document.getElementById("editEqSheetSubject")?.value || "physics",
      paper: document.getElementById("editEqSheetPaper")?.value || "paper1",
      tier: document.getElementById("editTier")?.value || "both",
      courseTrack: document.getElementById("editEqSheetCourseTrack")?.value || "combined"
    };
  }
  return {
    subject: document.getElementById("subjectSelect")?.value || "physics",
    paper: document.getElementById("paperSelect")?.value || "paper1",
    tier: document.getElementById("tierSelect")?.value || "both",
    courseTrack: document.getElementById("courseTrackSelect")?.value || "combined"
  };
}

function usesEquationSheetAuthoring(prefix = "") {
  const p = (id) => document.getElementById(prefix + id);
  if (p("CalcEquationGiven")?.checked) return false;

  const presetEl = document.getElementById(prefix === "edit" ? "editCalcPreset" : "CalcPreset");
  const preset = presetEl?.value || "";
  if (preset === "equation_sheet") return true;
  if (preset === "auto") {
    const demandEl = document.getElementById("demandLevelSelect");
    if (demandEl) {
      return inferCalculationPreset(demandEl.value) === "equation_sheet";
    }
  }
  return !!p("CalcStepEquation")?.checked;
}

/** Fetch equation sheet rows for admin dropdowns (optional subject filter). */
export async function loadEquationSheetCatalog(supabaseClient, subject = null, courseTrack = null) {
  if (!supabaseClient) return [];
  let query = supabaseClient
    .from("equation_sheets")
    .select("id, subject, title, tier, paper, exam_series, course_track")
    .order("id");
  if (subject) query = query.eq("subject", subject);
  if (courseTrack) query = query.eq("course_track", courseTrack);
  const { data, error } = await query;
  if (error) {
    console.warn("loadEquationSheetCatalog:", error);
    return [];
  }
  return data || [];
}

export function fillEquationSheetSelect(selectEl, sheets, selectedId = "") {
  if (!selectEl) return;
  const opts = ['<option value="">— None —</option>'];
  for (const row of sheets) {
    const id = row.id || "";
    const label = row.title || id;
    if (!id) continue;
    const sel = id === selectedId ? " selected" : "";
    opts.push(`<option value="${escapeHtml(id)}"${sel}>${escapeHtml(label)}</option>`);
  }
  selectEl.innerHTML = opts.join("");
}

/** Set equation sheet dropdown from subject / paper / tier when sheet mode is active. */
export function applyAutoEquationSheet(prefix, context = null) {
  if (!usesEquationSheetAuthoring(prefix)) return null;
  const ctx = context || readAuthoringContext(prefix);
  const sheetId = resolveEquationSheetId(ctx);
  const select = document.getElementById(prefix + "CalcEquationSheet");
  if (!select) return null;

  if (!sheetId) {
    select.value = "";
    return null;
  }

  const hasOption = Array.from(select.options).some((o) => o.value === sheetId);
  if (hasOption) select.value = sheetId;
  return hasOption ? sheetId : null;
}

function getStepLabel(type, presentation, step) {
  const base = STEP_LABELS[presentation]?.[type] || STEP_LABELS.practice[type] || type;
  if (type === "conversion" && step?.label) {
    return `${base} (${step.label})`;
  }
  if (type === "sig_figs" && step?.sig_figs) {
    return `${base} (${step.sig_figs} s.f.)`;
  }
  return base;
}

function getEquationOptions(config, equationSheet) {
  let options = [];
  if (equationSheet?.equations?.length) {
    options = equationSheet.equations;
  } else {
    const step = (config.steps || []).find((s) => s.type === "equation_select");
    if (step?.distractors?.length) {
      options = step.distractors.map((d) =>
        typeof d === "string" ? { id: d, label: d, latex: d } : d
      );
    }
  }

  const overrideIds = config.equation_override_distractors;
  if (Array.isArray(overrideIds) && overrideIds.length && options.length) {
    const idSet = new Set(overrideIds.map((id) => String(id).trim()).filter(Boolean));
    const filtered = options.filter((eq) => idSet.has(eq.id || eq.label));
    if (filtered.length) return filtered;
  }

  return options;
}

function findEquationOption(value, config, equationSheet) {
  const needle = String(value || "").trim();
  if (!needle) return null;
  const options = getEquationOptions(config, equationSheet);
  const lower = needle.toLowerCase();
  return (
    options.find(
      (eq) =>
        eq.id === needle ||
        eq.label === needle ||
        String(eq.id || "").toLowerCase() === lower ||
        String(eq.label || "").toLowerCase() === lower
    ) || null
  );
}

function resolveEquationCanonicalId(value, config, equationSheet) {
  const eq = findEquationOption(value, config, equationSheet);
  return eq ? eq.id || eq.label : String(value || "").trim();
}

function resolveEquationStepTarget(step, config) {
  const raw = step?.answer ?? step?.correct ?? config?.equation_answer ?? "";
  return String(raw).trim();
}

function equationSelectionMatches(studentVal, step, config, equationSheet) {
  if (!studentVal) return false;
  const target = resolveEquationStepTarget(step, config);
  if (!target) return !!studentVal;
  return (
    resolveEquationCanonicalId(studentVal, config, equationSheet) ===
    resolveEquationCanonicalId(target, config, equationSheet)
  );
}

function renderEquationSheetPanel(config, equationSheet, presentation) {
  if (config.equation_given || !equationSheet?.equations?.length) return "";

  const equations = equationSheet.equations;
  const isExam = presentation === "exam";
  const openAttr = isExam ? " open" : "";

  return `
    <details class="calc-equation-sheet"${openAttr} style="margin-top:12px; border:1px solid #cbd5e1; border-radius:8px; padding:10px 14px; background:#fff;">
      <summary style="font-weight:700; font-size:0.85rem; cursor:pointer; color:var(--primary, #4a90e2);">
        Equation sheet — ${escapeHtml(equationSheet.title || "Reference")}
      </summary>
      <ul style="margin:10px 0 0; padding-left:0; list-style:none; font-size:0.85rem; line-height:1.6;">
        ${equations.map((eq) => `
          <li style="margin-bottom:8px; padding:6px 8px; background:#f8fafc; border-radius:4px;">
            <strong>${escapeHtml(eq.label || eq.id)}:</strong>
            <span class="calc-eq-latex">$${eq.latex || eq.label || eq.id}$</span>
          </li>
        `).join("")}
      </ul>
    </details>
  `;
}

function getRearrangementChoices(step) {
  const answer = (step.answer || "").trim();
  const distractors = step.distractors || [];
  const combined = answer ? [answer, ...distractors] : [...distractors];
  const seen = new Set();
  return combined.filter((item) => {
    const key = String(item).trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatStepMarksBadge(step, marksOverride = null) {
  const marks = marksOverride != null ? Number(marksOverride) : (Number(step.marks) || 0);
  const baseStyle = "font-size:0.72rem;font-weight:700;padding:2px 8px;border-radius:999px;margin-left:8px;vertical-align:middle;";
  if (step.type === "equation_select" && marks === 0) {
    return `<span class="calc-step-marks calc-step-marks--none" style="${baseStyle}background:#f1f5f9;color:#64748b;border:1px solid #cbd5e1;">Not marked</span>`;
  }
  if (marks <= 0) return "";
  const label = marks === 1 ? "1 mark" : `${marks} marks`;
  return `<span class="calc-step-marks" style="${baseStyle}background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;">${label}</span>`;
}

function renderStepLabel(numberedLabel, step, marksOverride = null) {
  return `<span>${escapeHtml(numberedLabel)}</span>${formatStepMarksBadge(step, marksOverride)}`;
}

function inputStyle() {
  return "padding:6px; font-size:0.85rem; border-radius:4px; border:1px solid #cbd5e1; box-sizing:border-box;";
}

function selectStyle() {
  return `${inputStyle()} width:fit-content; max-width:100%; min-width:12ch;`;
}

export function renderCalculationWorkflow(q, currentKey, presentation = "practice", equationSheet = null) {
  const rawConfig = getCalculationConfig(q);
  const config = enrichCalculationConfigFromEquationSheet(rawConfig, equationSheet);
  const steps = getActiveSteps(config);
  const simpleMode = isSimpleNumericMode(q, config);
  const unit = currentKey?.key_payload?.unit || "";
  const unitBadge = unit
    ? `<span class="unit-badge" style="font-size:0.85rem;font-weight:700;color:#475569;background:#f1f5f9;border:1px solid #cbd5e1;padding:6px 12px;border-radius:4px;margin-left:8px;">${escapeHtml(unit)}</span>`
    : "";

  const hasMultiStep = steps.length > 1 || steps[0]?.type !== "calculate";
  const headerText = presentation === "exam"
    ? "Show your working — complete each step as you would on the exam paper"
    : "Calculation steps";

  let html = renderEquationSheetPanel(config, equationSheet, presentation);

  if (hasMultiStep) {
    html += `<div class="calc-workflow-panel item" style="border:1px solid #e2e8f0;padding:15px;border-radius:8px;background:#f8fafc;margin-top:12px;">`;
    html += `<h4 style="margin:0 0 12px;color:var(--primary);font-size:0.9rem;">${escapeHtml(headerText)}</h4>`;
  }

  let stepNum = 0;
  for (const step of steps) {
    stepNum += 1;
    const label = getStepLabel(step.type, presentation, step);
    const numberedLabel = hasMultiStep && presentation === "practice"
      ? `${stepNum}. ${label}`
      : label;

    if (step.type === "equation_select") {
      const options = getEquationOptions(config, equationSheet);
      html += `
        <div class="calc-step" data-step="equation_select" style="margin-bottom:12px;">
          <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${renderStepLabel(numberedLabel, step)}:</label>
          <div class="calc-eq-select-row" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <select id="calc_equation_select" style="${selectStyle()}">
              <option value="">— Select equation —</option>
              ${options.map((eq) => {
                const val = eq.id || eq.label;
                const latexAttr = eq.latex ? ` data-latex="${escapeHtml(eq.latex)}"` : "";
                return `<option value="${escapeHtml(val)}"${latexAttr}>${escapeHtml(formatEquationOptionText(eq))}</option>`;
              }).join("")}
            </select>
            <span id="calc_equation_select_preview" class="calc-eq-select-preview" style="display:none;align-items:center;padding:6px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;font-size:0.9rem;min-height:38px;"></span>
          </div>
        </div>
      `;
    } else if (step.type === "substitution") {
      const ctx = resolveSubstitutionContext(config, equationSheet, step);
      html += `
        <div class="calc-step" data-step="substitution" style="margin-bottom:12px;">
          <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${renderStepLabel(numberedLabel, step)}:</label>
          <div class="calc-sub-step-inner">${renderSubstitutionStepInner(ctx, inputStyle())}</div>
        </div>
      `;
    } else if (step.type === "conversion") {
      html += `
        <div class="calc-step" data-step="conversion" style="margin-bottom:12px;">
          <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${renderStepLabel(numberedLabel, step)}:</label>
          <input id="calc_conversion" type="number" step="any" style="${inputStyle()} width:120px;"/>
        </div>
      `;
    } else if (step.type === "rearrangement") {
      let choices;
      const subStep = steps.find((s) => s.type === "substitution");
      if (step.mode === "numeric" && subStep?.slot_answers && equationSheet) {
        const eqId = resolveEquationIdForSubstitution(config, equationSheet, subStep);
        const eq = findEquationInSheet(equationSheet, eqId);
        const built = buildNumericRearrangementOptions(eq, subStep, step);
        choices = getRearrangementChoices({
          ...step,
          answer: built.answer || step.answer,
          distractors: built.distractors || step.distractors
        });
      } else {
        choices = getRearrangementChoices(step);
      }
      html += `
        <div class="calc-step" data-step="rearrangement" style="margin-bottom:12px;">
          <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${renderStepLabel(numberedLabel, step)}:</label>
          <select id="calc_rearrangement" style="${selectStyle()}">
            <option value="">— Select formula —</option>
            ${choices.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("")}
          </select>
        </div>
      `;
    } else if (step.type === "calculate") {
      const sigStep = (config.steps || []).find((s) => s.type === "sig_figs" && s.required !== false && s.enforce_on_final);
      const sfNote = sigStep?.sig_figs ? ` <span style="font-weight:600;color:#64748b;">(to ${sigStep.sig_figs} s.f.)</span>` : "";
      const sigAttr = sigStep ? ' data-sig-enforced="true"' : "";
      const calcMarksOverride = simpleMode ? (q.max_marks || 1) : null;
      const calcLabel = renderStepLabel(numberedLabel, step, calcMarksOverride);
      const sigBadge = sigStep ? formatStepMarksBadge(sigStep) : "";
      html += `
        <div class="calc-step" data-step="calculate"${sigAttr} style="margin-bottom:${hasMultiStep ? "0" : "12px"};">
          <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${calcLabel}${sigBadge}${sfNote}:</label>
          <div style="display:inline-flex;align-items:center;">
            <input id="numAns" type="number" step="any" style="${inputStyle()} width:120px;"/>
            ${unitBadge}
          </div>
        </div>
      `;
    } else if (step.type === "sig_figs" && !step.enforce_on_final) {
      html += `
        <div class="calc-step" data-step="sig_figs" style="margin-bottom:12px;">
          <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${renderStepLabel(numberedLabel, step)}:</label>
          <input id="calc_sig_figs" type="number" step="any" style="${inputStyle()} width:120px;"/>
        </div>
      `;
    }
  }

  if (!steps.some((s) => s.type === "calculate")) {
    html += `
      <div class="calc-step" data-step="calculate">
        <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${escapeHtml(getStepLabel("calculate", presentation))}:</label>
        <div style="display:inline-flex;align-items:center;">
          <input id="numAns" type="number" step="any" style="${inputStyle()} width:120px;"/>
          ${unitBadge}
        </div>
      </div>
    `;
  }

  if (hasMultiStep) {
    html += `</div>`;
  } else if (!html.includes('id="numAns"')) {
    html += `
      <div class="item" style="display:flex;align-items:center;margin-top:12px;">
        <label style="font-size:0.9rem;font-weight:600;">Answer:
          <input id="numAns" type="number" step="any" style="${inputStyle()} width:120px;margin-left:4px;"/>
        </label>
        ${unitBadge}
      </div>
    `;
  }

  return html;
}

function readNumericInput(id) {
  const el = document.getElementById(id);
  if (!el || el.value === "") return null;
  const val = parseFloat(el.value);
  return Number.isFinite(val) ? val : null;
}

function readTextInput(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

export function collectCalculationResponse(q, sessionMode, equationSheet = null) {
  const sheet = equationSheet || q?._equationSheet || null;
  const config = getCalculationConfig(q);
  const steps = getActiveSteps(config);
  const stepValues = {};

  for (const step of steps) {
    if (step.type === "equation_select") {
      stepValues.equation_select = readTextInput("calc_equation_select");
    } else if (step.type === "substitution") {
      stepValues.substitution = collectSubstitutionPayload(config, sheet, step);
    } else if (step.type === "conversion") {
      stepValues.conversion = readNumericInput("calc_conversion");
    } else if (step.type === "rearrangement") {
      stepValues.rearrangement = readTextInput("calc_rearrangement");
    } else if (step.type === "calculate") {
      stepValues.calculate = readNumericInput("numAns");
    } else if (step.type === "sig_figs" && !step.enforce_on_final) {
      stepValues.sig_figs = readNumericInput("calc_sig_figs");
    }
  }

  if (stepValues.calculate == null) {
    stepValues.calculate = readNumericInput("numAns");
  }

  return {
    type: "numeric",
    sessionMode: getPresentationMode(sessionMode),
    steps: stepValues,
    value: stepValues.calculate,
    unit: ""
  };
}

export function validateCalculationResponse(q, resp, sessionMode) {
  const config = getCalculationConfig(q);
  const presentation = getPresentationMode(sessionMode);
  const missing = [];

  for (const step of getActiveSteps(config)) {
    const val = resp.steps?.[step.type];
    if (step.type === "calculate" || step.type === "conversion" || step.type === "sig_figs") {
      if (val == null || val === "") {
        missing.push(getStepLabel(step.type, presentation, step));
      }
    } else if (step.type === "substitution") {
      if (typeof val === "object" && val?.mode === "structured") {
        if (!substitutionPayloadIsComplete(val)) {
          missing.push(getStepLabel(step.type, presentation, step));
        }
      } else if (!val || (typeof val === "object" && !val.text)) {
        missing.push(getStepLabel(step.type, presentation, step));
      }
    } else if (!val) {
      missing.push(getStepLabel(step.type, presentation, step));
    }
  }

  if (presentation === "exam" && missing.length) {
    return { valid: false, message: `Complete all steps before submitting: ${missing.join("; ")}` };
  }
  if (presentation === "practice" && missing.length) {
    return { valid: true, warn: `Some steps are empty: ${missing.join("; ")}` };
  }
  return { valid: true };
}

export function normalizeSubstitution(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/[{}]/g, "");
}

function substitutionMatches(studentText, step) {
  const normalized = normalizeSubstitution(studentText);
  const accepted = step.accepted || (step.answer ? [step.answer] : []);
  return accepted.some((a) => normalizeSubstitution(a) === normalized);
}

function matchSubstitutionStep(studentVal, step, config, equationSheet) {
  if (typeof studentVal === "object" && studentVal?.mode === "structured") {
    const ctx = resolveSubstitutionContext(config, equationSheet, step);
    if (ctx.mode === "structured" && ctx.template) {
      return substitutionSlotsMatch(studentVal, step, ctx.template);
    }
    return substitutionMatches(studentVal.text, step);
  }
  const text = typeof studentVal === "string" ? studentVal : studentVal?.text || "";
  return substitutionMatches(text, step);
}

function getStepFeedback(step, markPoints, stepType, defaultText) {
  const inline = step?.feedback_if_wrong?.trim();
  if (inline) return inline;
  const tag = `[calc:${stepType}]`;
  const mp = markPoints?.find((p) => p.point_text === tag);
  return mp?.feedback_if_missing?.trim() || defaultText;
}

function resolveSimpleNumericMaxAo(max, markPoints) {
  const maxAo = { AO1: 0, AO2: 0, AO3: 0 };
  if (markPoints?.length > 0) {
    for (const mp of markPoints) {
      if (mp.ao && maxAo[mp.ao] !== undefined) {
        maxAo[mp.ao] += Number(mp.max_marks) || 1;
      }
    }
    return maxAo;
  }
  maxAo.AO2 = max;
  return maxAo;
}

function awardSimpleNumericAo(max, markPoints, stepAo) {
  const ao = { AO1: 0, AO2: 0, AO3: 0 };
  if (markPoints?.length > 0) {
    for (const mp of markPoints) {
      const mpAo = mp.ao || "AO2";
      if (ao[mpAo] !== undefined) {
        ao[mpAo] += Number(mp.max_marks) || 1;
      }
    }
    return ao;
  }
  ao[stepAo] = max;
  return ao;
}

function buildSimpleNumericMissing(config, markPoints, cleanUrl, key, steps) {
  const ansTarget = parseFloat(key?.key_payload?.answer);
  const unit = key?.key_payload?.unit || "";
  const calcStep = steps?.find((s) => s.type === "calculate");

  const fromConfig = (config?.remediation_steps || [])
    .filter((s) => s.text?.trim())
    .map((s) => ({
      ao: s.ao || "AO2",
      stepType: "calculate",
      text: s.text.trim(),
      url: cleanUrl,
      image_url: s.image_url || ""
    }));
  if (fromConfig.length > 0) return fromConfig;

  const pedagogical = (markPoints || []).filter((mp) => mp.feedback_if_missing?.trim());
  if (pedagogical.length > 0) {
    return pedagogical.map((mp) => ({
      ao: mp.ao || "AO2",
      stepType: "calculate",
      text: mp.feedback_if_missing.trim(),
      url: cleanUrl,
      image_url: mp.image_url || ""
    }));
  }

  if (calcStep?.feedback_if_wrong?.trim()) {
    return [{
      ao: calcStep.ao || "AO2",
      stepType: "calculate",
      text: calcStep.feedback_if_wrong.trim(),
      url: cleanUrl
    }];
  }

  return [{
    ao: "AO2",
    stepType: "calculate",
    text: `The correct answer is ${ansTarget}${unit ? " " + unit : ""}. Review your calculation.`,
    url: cleanUrl
  }];
}

function findEquationLabel(config, equationSheet, answerId) {
  const needle = String(answerId || "").trim();
  if (!needle) return "the required equation";
  const eq = findEquationOption(needle, config, equationSheet);
  if (eq?.label) return eq.label;
  if (eq?.latex) return latexToPlainOptionText(eq.latex) || needle;
  return needle;
}

export function markCalculationResponse(q, resp, key, markPoints, cleanUrl, equationSheet = null) {
  const config = getCalculationConfig(q);
  const steps = getActiveSteps(config);
  let total = 0;
  let max = 0;
  const ao = { AO1: 0, AO2: 0, AO3: 0 };
  const maxAo = { AO1: 0, AO2: 0, AO3: 0 };
  const missing = [];

  let conversionStudent = null;
  let conversionTarget = null;
  let conversionCorrect = false;
  let conversionTol = 0.001;

  const ansTarget = parseFloat(key?.key_payload?.answer);
  const ansTol = parseFloat(key?.key_payload?.tolerance ?? 0);
  const unit = key?.key_payload?.unit || "";
  const stepResults = {};

  if (isSimpleNumericMode(q, config)) {
    const max = q.max_marks || 1;
    const maxAo = resolveSimpleNumericMaxAo(max, markPoints);
    const stepAo = steps[0]?.ao || "AO2";
    const studentVal = resp.steps?.calculate ?? resp.value;
    const isCorrect = studentVal != null && Math.abs(studentVal - ansTarget) <= ansTol;
    const total = isCorrect ? max : 0;
    const ao = isCorrect ? awardSimpleNumericAo(max, markPoints, stepAo) : { AO1: 0, AO2: 0, AO3: 0 };
    const missing = isCorrect ? [] : buildSimpleNumericMissing(config, markPoints, cleanUrl, key, steps);
    stepResults.calculate = {
      earned: total,
      max,
      correct: isCorrect,
      ecf: false,
      enforceOnFinal: false
    };
    const quality = total === max && max > 0 ? 5 : 1;
    return { total, max, ao, maxAo, missing, quality, stepResults };
  }

  for (const step of steps) {
    const marks = Number(step.marks) || 0;
    const stepAo = step.ao || (step.type === "equation_select" ? "AO1" : "AO2");
    max += marks;
    maxAo[stepAo] = (maxAo[stepAo] || 0) + marks;

    const studentVal = resp.steps?.[step.type];
    let earned = 0;
    let isCorrect = false;
    let isEcf = false;

    if (step.type === "equation_select") {
      const target = resolveEquationStepTarget(step, config);
      isCorrect = equationSelectionMatches(studentVal, step, config, equationSheet);
      if (isCorrect) {
        earned = marks;
      } else if (target) {
        const expectedLabel = findEquationLabel(config, equationSheet, target);
        missing.push({
          ao: stepAo,
          stepType: step.type,
          text: getStepFeedback(
            step,
            markPoints,
            "equation_select",
            `Equation incorrect: the correct equation is "${expectedLabel}".`
          ),
          url: cleanUrl
        });
      }
    } else if (step.type === "substitution") {
      if (matchSubstitutionStep(studentVal, step, config, equationSheet)) {
        earned = marks;
        isCorrect = true;
      } else {
        missing.push({
          ao: stepAo,
          stepType: step.type,
          text: getStepFeedback(
            step,
            markPoints,
            "substitution",
            "Substitution incorrect: check that you have inserted the correct values from the question."
          ),
          url: cleanUrl
        });
      }
    } else if (step.type === "conversion") {
      conversionStudent = studentVal;
      conversionTarget = parseFloat(step.answer);
      conversionTol = parseFloat(step.tolerance ?? 0.001);
      if (studentVal != null && Math.abs(studentVal - conversionTarget) <= conversionTol) {
        earned = marks;
        conversionCorrect = true;
        isCorrect = true;
      } else {
        missing.push({
          ao: stepAo,
          stepType: step.type,
          text: getStepFeedback(
            step,
            markPoints,
            "conversion",
            `Unit conversion incorrect: expected ${conversionTarget}${step.label ? ` (${step.label})` : ""}.`
          ),
          url: cleanUrl
        });
      }
    } else if (step.type === "rearrangement") {
      if (studentVal === step.answer && step.answer) {
        earned = marks;
        isCorrect = true;
      } else {
        missing.push({
          ao: stepAo,
          stepType: step.type,
          text: getStepFeedback(
            step,
            markPoints,
            "rearrangement",
            `Rearrangement incorrect: the correct form is "${step.answer}".`
          ),
          url: cleanUrl
        });
      }
    } else if (step.type === "calculate") {
      let target = ansTarget;
      const sigStep = steps.find((s) => s.type === "sig_figs");
      const sigMergedIntoCalculate = sigStep?.enforce_on_final && !(Number(sigStep.marks) > 0);
      if (sigMergedIntoCalculate && sigStep?.sig_figs) {
        target = roundToSigFigs(ansTarget, sigStep.sig_figs);
      }

      let calcCorrect = studentVal != null && Math.abs(studentVal - target) <= ansTol;
      isCorrect = calcCorrect;

      if (!isCorrect && !conversionCorrect && conversionStudent != null && conversionTarget) {
        const ratio = conversionStudent / conversionTarget;
        const ecfTarget = target * ratio;
        const scaledTol = Math.max(ansTol, ansTol * Math.abs(ratio));
        if (Math.abs(studentVal - ecfTarget) <= scaledTol) {
          isCorrect = true;
          calcCorrect = true;
          isEcf = true;
          missing.push({
            ao: stepAo,
            stepType: step.type,
            text: `Error Carried Forward (ECF): final calculation marked correct using your converted value of ${conversionStudent}.`,
            isEcf: true
          });
        }
      }

      if (isCorrect) {
        earned = marks;
      } else {
        missing.push({
          ao: stepAo,
          stepType: step.type,
          text: getStepFeedback(
            step,
            markPoints,
            "calculate",
            `Final calculation incorrect: expected ${target}${unit ? " " + unit : ""}.`
          ),
          url: cleanUrl
        });
      }
    } else if (step.type === "sig_figs") {
      const calcVal = resp.steps?.calculate ?? resp.value;
      if (step.enforce_on_final) {
        if (matchesSigFigs(calcVal, ansTarget, step.sig_figs, ansTol)) {
          earned = marks;
          isCorrect = true;
        } else if (marks > 0) {
          missing.push({
            ao: stepAo,
            stepType: step.type,
            text: getStepFeedback(
              step,
              markPoints,
              "sig_figs",
              `Significant figures incorrect: give your answer to ${step.sig_figs} significant figures.`
            ),
            url: cleanUrl
          });
        }
      } else if (studentVal != null && matchesSigFigs(studentVal, ansTarget, step.sig_figs, ansTol)) {
        earned = marks;
        isCorrect = true;
      } else if (marks > 0) {
        missing.push({
          ao: stepAo,
          stepType: step.type,
          text: getStepFeedback(
            step,
            markPoints,
            "sig_figs",
            `Significant figures incorrect: expected ${roundToSigFigs(ansTarget, step.sig_figs)} (${step.sig_figs} s.f.).`
          ),
          url: cleanUrl
        });
      }
    }

    total += earned;
    ao[stepAo] = (ao[stepAo] || 0) + earned;
    stepResults[step.type] = {
      earned,
      max: marks,
      correct: isCorrect,
      ecf: isEcf,
      enforceOnFinal: !!step.enforce_on_final
    };
  }

  const quality = total === max && max > 0 ? 5 : total > 0 ? 3 : steps.length > 1 ? 0 : 1;

  return { total, max, ao, maxAo, missing, quality, stepResults };
}

function combineCalcAndSigResults(calcResult, sigResult) {
  if (!calcResult) return sigResult;
  if (!sigResult || !sigResult.enforceOnFinal) return calcResult;
  const earned = (calcResult.earned || 0) + (sigResult.earned || 0);
  const max = (calcResult.max || 0) + (sigResult.max || 0);
  return {
    earned,
    max,
    correct: calcResult.correct && sigResult.correct,
    ecf: calcResult.ecf,
    calcCorrect: calcResult.correct,
    sigCorrect: sigResult.correct,
    enforceOnFinal: true
  };
}

function styleCalculationStepElement(el, result) {
  if (!el || !result) return;

  const { earned, max, correct, ecf, calcCorrect, sigCorrect, enforceOnFinal } = result;

  el.style.borderRadius = "8px";
  el.style.padding = "10px 12px";
  el.style.transition = "border-color 0.2s, background 0.2s";

  if (ecf) {
    el.style.border = "2px solid #10b981";
    el.style.background = "#ecfdf5";
  } else if (enforceOnFinal && max > 0 && calcCorrect && !sigCorrect) {
    el.style.border = "2px solid #f59e0b";
    el.style.background = "#fffbeb";
  } else if (correct || (max === 0 && correct)) {
    el.style.border = "2px solid #10b981";
    el.style.background = "#f0fdf4";
  } else if (max === 0) {
    el.style.border = correct ? "2px solid #10b981" : "2px solid #ef4444";
    el.style.background = correct ? "#f0fdf4" : "#fef2f2";
  } else {
    el.style.border = "2px solid #ef4444";
    el.style.background = "#fef2f2";
  }

  let badge = el.querySelector(".calc-step-result");
  if (!badge) {
    badge = document.createElement("div");
    badge.className = "calc-step-result";
    badge.style.cssText = "font-size:0.78rem;font-weight:700;margin-top:8px;line-height:1.35;";
    el.appendChild(badge);
  }

  if (max === 0) {
    badge.textContent = correct
      ? "✓ Correct equation — not marked on this question"
      : "✗ Incorrect equation — not marked on this question";
    badge.style.color = correct ? "#065f46" : "#991b1b";
  } else if (enforceOnFinal && calcCorrect !== undefined && sigCorrect !== undefined) {
    badge.textContent = ecf
      ? `✓ ${earned}/${max} marks (ECF applied)`
      : `✓ ${earned}/${max} marks — value ${calcCorrect ? "correct" : "incorrect"}, significant figures ${sigCorrect ? "correct" : "incorrect"}`;
    badge.style.color = earned === max ? "#065f46" : "#991b1b";
  } else {
    badge.textContent = ecf
      ? `✓ ${earned}/${max} mark${max !== 1 ? "s" : ""} (ECF)`
      : `${earned === max ? "✓" : "✗"} ${earned}/${max} mark${max !== 1 ? "s" : ""}`;
    badge.style.color = earned === max ? "#065f46" : "#991b1b";
  }

  el.querySelectorAll("input, select, textarea").forEach((input) => {
    input.disabled = true;
  });
}

/** Apply green/red step boxes after submit (student UI). */
export function applyCalculationStepHighlighting(stepResults) {
  if (!stepResults) return;

  document.querySelectorAll(".calc-step[data-step]").forEach((el) => {
    const type = el.dataset.step;
    let result = stepResults[type];

    if (type === "calculate" && el.dataset.sigEnforced === "true") {
      result = combineCalcAndSigResults(stepResults.calculate, stepResults.sig_figs);
    }

    if (result) styleCalculationStepElement(el, result);
  });
}

const STEP_SUMMARY_LABELS = {
  equation_select: "Equation choice",
  substitution: "Substitution",
  conversion: "Unit conversion",
  rearrangement: "Rearrangement",
  calculate: "Final answer",
  sig_figs: "Significant figures"
};

function getStepExpectedHint(step, config, key, equationSheet) {
  switch (step.type) {
    case "equation_select": {
      const target = resolveEquationStepTarget(step, config);
      const label = findEquationLabel(config, equationSheet, target);
      return `Correct equation: ${label}`;
    }
    case "substitution":
      if (step.mode === "structured" && step.slot_answers) {
        const parts = Object.entries(step.slot_answers).map(([id, vals]) => {
          const v = Array.isArray(vals) ? vals[0] : vals;
          return `${id} → ${v}`;
        });
        return parts.length ? `Expected slots: ${parts.join(", ")}` : "Fill each box with the correct value or symbol.";
      }
      return step.accepted?.[0]
        ? `Example: ${step.accepted[0]}`
        : "Substitute values into the equation correctly.";
    case "conversion":
      return `Convert to: ${step.answer}${step.label ? ` (${step.label})` : ""}`;
    case "rearrangement":
      return `Correct form: ${step.answer}`;
    case "calculate": {
      const ans = key?.key_payload?.answer;
      const unit = key?.key_payload?.unit || "";
      return ans != null ? `Answer: ${ans}${unit ? ` ${unit}` : ""}` : "Calculate the final value.";
    }
    case "sig_figs":
      return step.enforce_on_final ? null : `Round to ${step.sig_figs} significant figures`;
    default:
      return "";
  }
}

/** Ordered step lines for multistep numeric flashcards (all steps, with ✓/✗). */
export function buildNumericFlashcardInsights(q, key, feedbackPayload, equationSheet = null) {
  const config = getCalculationConfig(q);
  const steps = getActiveSteps(config);
  const isMultistep = steps.length > 1 || steps[0]?.type !== "calculate";
  if (!isMultistep) return null;

  const stepResults = feedbackPayload?.stepResults || {};
  const missingByType = {};
  for (const m of feedbackPayload?.missing || []) {
    if (m.isEcf || !m.stepType) continue;
    missingByType[m.stepType] = m.flashcard_text || m.text;
  }

  const lines = [];
  for (const step of steps) {
    if (step.type === "sig_figs" && step.enforce_on_final) continue;

    let sr = stepResults[step.type];
    if (step.type === "calculate" && stepResults.sig_figs?.enforceOnFinal) {
      sr = combineCalcAndSigResults(stepResults.calculate, stepResults.sig_figs);
    }

    const label = STEP_SUMMARY_LABELS[step.type] || step.type;
    let correct;
    if (sr) {
      correct = !!sr.correct;
    } else {
      correct = !missingByType[step.type];
    }

    const detail = missingByType[step.type]
      || getStepExpectedHint(step, config, key, equationSheet);
    if (!detail) continue;

    lines.push(`${correct ? "✓" : "✗"} ${label}: ${detail}`);
  }

  return lines.length ? lines : null;
}

export function renderCalculationStepSummary(stepResults) {
  if (!stepResults || !Object.keys(stepResults).length) return "";

  const rows = STEP_ORDER.map((type) => {
    if (!stepResults[type]) return "";
    if (type === "sig_figs" && stepResults.sig_figs?.enforceOnFinal) return "";

    let r = stepResults[type];
    if (type === "calculate" && stepResults.sig_figs?.enforceOnFinal) {
      r = combineCalcAndSigResults(stepResults.calculate, stepResults.sig_figs);
    }

    const label = STEP_SUMMARY_LABELS[type] || type;
    let status;
    if (r.max === 0) {
      status = r.correct ? "✓ Correct (not marked)" : "✗ Incorrect (not marked)";
    } else if (r.ecf) {
      status = `✓ ${r.earned}/${r.max} (ECF)`;
    } else {
      status = `${r.earned === r.max ? "✓" : "✗"} ${r.earned}/${r.max} mark${r.max !== 1 ? "s" : ""}`;
    }
    const color = r.max === 0
      ? (r.correct ? "#065f46" : "#991b1b")
      : (r.earned === r.max ? "#065f46" : "#991b1b");
    return `<li style="margin-bottom:4px;color:${color};"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(status)}</li>`;
  }).filter(Boolean).join("");

  if (!rows) return "";

  return `
    <hr/>
    <div><strong>Mark breakdown by step</strong></div>
    <ul style="margin:8px 0 0;padding-left:18px;font-size:0.85rem;line-height:1.5;">${rows}</ul>
  `;
}

export function buildCalculationConfigFromForm(prefix = "") {
  const p = (id) => document.getElementById(prefix + id);
  const chk = (id) => !!p(id)?.checked;
  const fb = (type) => readStepFeedback(prefix, FEEDBACK_FIELD_BY_TYPE[type]);

  const equationGiven = chk("CalcEquationGiven");

  const steps = [];

  if (chk("CalcStepEquation")) {
    steps.push({
      type: "equation_select",
      marks: markForStep("equation_select", true),
      ao: "AO1",
      required: true,
      answer: p("CalcEquationAnswer")?.value?.trim() || "",
      distractors: (p("CalcEquationDistractors")?.value || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      feedback_if_wrong: fb("equation_select")
    });
  }

  if (chk("CalcStepSubstitution")) {
    const mode = p("CalcSubstitutionMode")?.value || "free_text";
    const subStep = {
      type: "substitution",
      marks: markForStep("substitution", true),
      ao: "AO2",
      required: true,
      mode,
      feedback_if_wrong: fb("substitution")
    };
    if (mode === "structured") {
      subStep.equation_id = p("CalcSubstitutionEquation")?.value?.trim()
        || p("CalcEquationAnswer")?.value?.trim()
        || "";
      subStep.slot_answers = readSlotAnswersFromForm(prefix);
      subStep.rearrangement_subject = p("CalcRearrangementSubject")?.value?.trim() || undefined;
    } else {
      subStep.accepted = (p("CalcSubstitutionAccepted")?.value || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    steps.push(subStep);
  }

  if (chk("CalcStepConversion")) {
    steps.push({
      type: "conversion",
      marks: markForStep("conversion", true),
      ao: "AO2",
      required: true,
      label: p("CalcConversionLabel")?.value?.trim() || "",
      answer: parseFloat(p("CalcConversionAnswer")?.value),
      tolerance: parseFloat(p("CalcConversionTol")?.value) || 0.001,
      feedback_if_wrong: fb("conversion")
    });
  }

  if (chk("CalcStepRearrangement")) {
    const distractors = (p("CalcRearrangeDistractors")?.value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const subMode = p("CalcSubstitutionMode")?.value || "free_text";
    const rearrMode = subMode === "structured"
      ? (p("CalcRearrangementMode")?.value || "numeric")
      : "symbolic";
    const rearrStep = {
      type: "rearrangement",
      marks: markForStep("rearrangement", true),
      ao: "AO2",
      required: true,
      mode: rearrMode,
      answer: p("CalcRearrangeAnswer")?.value?.trim() || "",
      distractors,
      feedback_if_wrong: fb("rearrangement")
    };
    if (rearrMode === "numeric") {
      rearrStep.subject = p("CalcRearrangementSubject")?.value?.trim() || undefined;
    }
    steps.push(rearrStep);
  }

  steps.push({
    type: "calculate",
    marks: markForStep("calculate", true),
    ao: "AO2",
    required: true,
    feedback_if_wrong: fb("calculate")
  });

  if (chk("CalcStepSigFigs")) {
    const n = parseInt(p("CalcSigFigsCount")?.value, 10) || 2;
    steps.push({
      type: "sig_figs",
      marks: markForStep("sig_figs", true),
      ao: "AO2",
      required: true,
      sig_figs: n,
      enforce_on_final: true,
      feedback_if_wrong: fb("sig_figs")
    });
  }

  const overrideRaw = p("CalcEquationOverride")?.value?.trim();
  let equation_override_distractors = null;
  if (overrideRaw) {
    equation_override_distractors = overrideRaw.split(",").map((s) => s.trim()).filter(Boolean);
  }

  const remediation_steps = buildRemediationStepsFromForm(prefix);

  return normalizeCalculationConfig({
    equation_given: equationGiven,
    equation_sheet_id: p("CalcEquationSheet")?.value || null,
    equation_override_distractors,
    remediation_steps: remediation_steps.length ? remediation_steps : undefined,
    steps
  });
}

/** Auto-fill numeric rearrangement answer/distractors from slot answers + equation template at save time. */
export function finalizeCalculationConfigForSave(config, equations = []) {
  if (!config?.steps?.length || !equations?.length) return config;
  const subStep = config.steps.find((s) => s.type === "substitution");
  const rearrIdx = config.steps.findIndex((s) => s.type === "rearrangement");
  if (!subStep || rearrIdx < 0) return config;
  const rearrStep = config.steps[rearrIdx];
  if (rearrStep.mode !== "numeric" || !subStep.slot_answers) return config;

  const eqId = subStep.equation_id;
  const equation = equations.find((e) => e.id === eqId || e.label === eqId);
  if (!equation) return config;

  const built = buildNumericRearrangementOptions(equation, subStep, rearrStep);
  if (!built.answer) return config;

  const steps = [...config.steps];
  steps[rearrIdx] = {
    ...rearrStep,
    mode: "numeric",
    subject: built.subject || rearrStep.subject,
    answer: built.answer,
    distractors: built.distractors
  };
  return { ...config, steps };
}

export function populateCalculationForm(prefix, config) {
  const p = (id) => document.getElementById(prefix + id);
  const setChk = (id, val) => { if (p(id)) p(id).checked = !!val; };

  const cfg = config || { equation_given: true, steps: [{ type: "calculate", required: true }] };
  const steps = cfg.steps || [];

  setChk("CalcEquationGiven", cfg.equation_given !== false);
  if (p("CalcEquationSheet")) p("CalcEquationSheet").value = cfg.equation_sheet_id || "";
  if (p("CalcEquationOverride")) {
    p("CalcEquationOverride").value = Array.isArray(cfg.equation_override_distractors)
      ? cfg.equation_override_distractors.join(", ")
      : "";
  }

  const has = (type) => steps.some((s) => s.type === type && s.required !== false);
  setChk("CalcStepEquation", has("equation_select"));
  setChk("CalcStepSubstitution", has("substitution"));
  setChk("CalcStepConversion", has("conversion"));
  setChk("CalcStepRearrangement", has("rearrangement"));
  setChk("CalcStepSigFigs", has("sig_figs"));

  const eqStep = steps.find((s) => s.type === "equation_select");
  if (eqStep && p("CalcEquationAnswer")) {
    fillEquationSelectElement(p("CalcEquationAnswer"), [], eqStep.answer || "");
    p("CalcEquationAnswer").dataset.pendingAnswer = eqStep.answer || "";
  }
  if (eqStep && p("CalcEquationDistractors")) {
    p("CalcEquationDistractors").value = (eqStep.distractors || []).join(", ");
  }
  writeStepFeedback(prefix, FEEDBACK_FIELD_BY_TYPE.equation_select, eqStep?.feedback_if_wrong);

  const subStep = steps.find((s) => s.type === "substitution");
  if (subStep) {
    const mode = subStep.mode || (subStep.slot_answers ? "structured" : "free_text");
    if (p("CalcSubstitutionMode")) p("CalcSubstitutionMode").value = mode;
    if (subStep.equation_id && p("CalcSubstitutionEquation")) {
      p("CalcSubstitutionEquation").dataset.pendingEquation = subStep.equation_id;
    }
    if (subStep.slot_answers && p("CalcSubstitutionSlots")) {
      p("CalcSubstitutionSlots").dataset.pendingAnswers = JSON.stringify(subStep.slot_answers);
    }
    if (subStep.accepted && p("CalcSubstitutionAccepted")) {
      p("CalcSubstitutionAccepted").value = (subStep.accepted || []).join("\n");
    }
    if (subStep.rearrangement_subject && p("CalcRearrangementSubject")) {
      p("CalcRearrangementSubject").value = subStep.rearrangement_subject;
    }
  }
  writeStepFeedback(prefix, FEEDBACK_FIELD_BY_TYPE.substitution, subStep?.feedback_if_wrong);

  const convStep = steps.find((s) => s.type === "conversion");
  if (convStep) {
    if (p("CalcConversionLabel")) p("CalcConversionLabel").value = convStep.label || "";
    if (p("CalcConversionAnswer")) p("CalcConversionAnswer").value = convStep.answer ?? "";
    if (p("CalcConversionTol")) p("CalcConversionTol").value = convStep.tolerance ?? 0.001;
  }
  writeStepFeedback(prefix, FEEDBACK_FIELD_BY_TYPE.conversion, convStep?.feedback_if_wrong);

  const rearrStep = steps.find((s) => s.type === "rearrangement");
  if (rearrStep) {
    if (p("CalcRearrangeAnswer")) p("CalcRearrangeAnswer").value = rearrStep.answer || "";
    if (p("CalcRearrangeDistractors")) {
      p("CalcRearrangeDistractors").value = (rearrStep.distractors || []).join(", ");
    }
    if (p("CalcRearrangementMode")) {
      p("CalcRearrangementMode").value = rearrStep.mode || "symbolic";
    }
    if (rearrStep.subject && p("CalcRearrangementSubject")) {
      p("CalcRearrangementSubject").value = rearrStep.subject;
    }
  }
  writeStepFeedback(prefix, FEEDBACK_FIELD_BY_TYPE.rearrangement, rearrStep?.feedback_if_wrong);

  const calcStep = steps.find((s) => s.type === "calculate");
  writeStepFeedback(prefix, FEEDBACK_FIELD_BY_TYPE.calculate, calcStep?.feedback_if_wrong);

  const sigStep = steps.find((s) => s.type === "sig_figs");
  if (sigStep && p("CalcSigFigsCount")) {
    p("CalcSigFigsCount").value = sigStep.sig_figs ?? 2;
  }
  writeStepFeedback(prefix, FEEDBACK_FIELD_BY_TYPE.sig_figs, sigStep?.feedback_if_wrong);

  populateRemediationSteps(prefix, cfg.remediation_steps || []);

  ["CalcStepEquation", "CalcStepSubstitution", "CalcStepConversion", "CalcStepRearrangement", "CalcStepSigFigs"].forEach((chkId) => {
    const panelMap = {
      CalcStepEquation: "CalcPanelEquation",
      CalcStepSubstitution: "CalcPanelSubstitution",
      CalcStepConversion: "CalcPanelConversion",
      CalcStepRearrangement: "CalcPanelRearrangement",
      CalcStepSigFigs: "CalcPanelSigFigs"
    };
    const panel = p(panelMap[chkId]);
    if (panel && p(chkId)) {
      panel.classList.toggle("hidden", !p(chkId).checked);
    }
  });

  updateNumericAuthoringUi(prefix);
}

export function wireCalculationFormToggles(prefix = "", onChange) {
  const pairs = [
    ["CalcStepEquation", "CalcPanelEquation"],
    ["CalcStepSubstitution", "CalcPanelSubstitution"],
    ["CalcStepConversion", "CalcPanelConversion"],
    ["CalcStepRearrangement", "CalcPanelRearrangement"],
    ["CalcStepSigFigs", "CalcPanelSigFigs"]
  ];
  const notify = () => {
    syncMaxMarksSelect(prefix);
    updateNumericAuthoringUi(prefix);
    onChange?.(prefix);
  };

  for (const [chkId, panelId] of pairs) {
    const chkEl = document.getElementById(prefix + chkId);
    const panel = document.getElementById(prefix + panelId);
    if (!chkEl || !panel) continue;
    const sync = () => {
      panel.classList.toggle("hidden", !chkEl.checked);
      notify();
    };
    chkEl.addEventListener("change", sync);
    sync();
  }

  for (const extraId of ["CalcEquationGiven"]) {
    const el = document.getElementById(prefix + extraId);
    el?.addEventListener("change", notify);
  }
}

export function applyCalculationPreset(prefix, preset, demandLevel) {
  const p = (id) => document.getElementById(prefix + id);
  const setChk = (id, val) => { if (p(id)) p(id).checked = !!val; };

  const effective = preset === "auto"
    ? inferCalculationPreset(demandLevel)
    : preset;

  if (effective === "given_equation") {
    setChk("CalcEquationGiven", true);
    setChk("CalcStepEquation", false);
    setChk("CalcStepSubstitution", true);
    setChk("CalcStepConversion", false);
    setChk("CalcStepRearrangement", false);
    setChk("CalcStepSigFigs", false);
  } else if (effective === "equation_sheet") {
    setChk("CalcEquationGiven", false);
    setChk("CalcStepEquation", true);
    setChk("CalcStepSubstitution", true);
    setChk("CalcStepRearrangement", true);
    setChk("CalcStepConversion", false);
    setChk("CalcStepSigFigs", false);
    applyAutoEquationSheet(prefix);
  }

  populateCalculationForm(prefix, buildCalculationConfigFromForm(prefix));
  syncMaxMarksSelect(prefix);
}
