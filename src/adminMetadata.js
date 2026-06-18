import {
  COMMAND_WORD_OPTIONS,
  computeQuestionDifficulty,
  suggestCommandWord,
  suggestDemandLevel,
  suggestAoMarks,
  getDemandOptionsForTier,
  formatDemandLabel,
  getAuthoringGuidelinesHtml
} from "./examRules.js";

export {
  COMMAND_WORD_OPTIONS,
  computeQuestionDifficulty,
  suggestCommandWord,
  suggestDemandLevel,
  suggestAoMarks,
  getDemandOptionsForTier,
  formatDemandLabel,
  getAuthoringGuidelinesHtml
};

export function validateAoMarksSum(ao1, ao2, ao3, maxMarks) {
  const max = Number(maxMarks) || 0;
  const sum = (Number(ao1) || 0) + (Number(ao2) || 0) + (Number(ao3) || 0);
  return { valid: sum === max, sum, max };
}

export function collectCreatorMarkPoints() {
  return Array.from(document.querySelectorAll("#markPointsWrapper .mark-point-row")).map((row) => ({
    ao: row.querySelector(".mp-ao")?.value || "AO1",
    point_text: row.querySelector(".mp-text")?.value?.trim() || "",
    max_marks: 1
  })).filter((mp) => mp.point_text);
}

export function isMetadataIncomplete(q) {
  if (!q) return true;
  const hasAo =
    q.ao1_marks != null && q.ao2_marks != null && q.ao3_marks != null &&
    Number(q.ao1_marks) + Number(q.ao2_marks) + Number(q.ao3_marks) === Number(q.max_marks);
  return !q.command_word || !q.demand_level || !hasAo;
}

/** Shared combined/triple questions need triple_spec_point_id for triple students. */
export function isDualLinkIncomplete(q) {
  if (!q) return false;
  return (q.audience || "both") === "both" && !q.triple_spec_point_id;
}

export function formatAoSplit(q) {
  if (!q) return "—";
  if (q.ao1_marks == null) {
    if (q.question_type === "mcq") return "1/0/0";
    return "—";
  }
  return `${q.ao1_marks}/${q.ao2_marks}/${q.ao3_marks}`;
}

const METADATA_FIELD_IDS = {
  creator: {
    commandWord: "commandWordSelect",
    demandLevel: "demandLevelSelect",
    ao1: "ao1Marks",
    ao2: "ao2Marks",
    ao3: "ao3Marks",
    maths: "chkMathsSkill",
    rp: "chkRequiredPractical",
    rpSelect: "requiredPracticalSelect",
    aoValidation: "aoMarksValidation"
  },
  edit: {
    commandWord: "editCommandWordSelect",
    demandLevel: "editDemandLevelSelect",
    ao1: "editAo1Marks",
    ao2: "editAo2Marks",
    ao3: "editAo3Marks",
    maths: "editChkMathsSkill",
    rp: "editChkRequiredPractical",
    rpSelect: "editRequiredPracticalSelect",
    aoValidation: "editAoMarksValidation"
  }
};

function metaIds(mode = "creator") {
  return METADATA_FIELD_IDS[mode] || METADATA_FIELD_IDS.creator;
}

export function buildMetadataPayload(mode = "creator") {
  const ids = metaIds(mode);
  const ao1 = parseInt(document.getElementById(ids.ao1)?.value, 10) || 0;
  const ao2 = parseInt(document.getElementById(ids.ao2)?.value, 10) || 0;
  const ao3 = parseInt(document.getElementById(ids.ao3)?.value, 10) || 0;
  const commandWord = document.getElementById(ids.commandWord)?.value || "";
  const demandLevel = document.getElementById(ids.demandLevel)?.value || "";
  const isMaths = document.getElementById(ids.maths)?.checked || false;
  const isRp = document.getElementById(ids.rp)?.checked || false;
  const rpId = document.getElementById(ids.rpSelect)?.value || null;
  return {
    command_word: commandWord || null,
    demand_level: demandLevel || null,
    ao1_marks: ao1,
    ao2_marks: ao2,
    ao3_marks: ao3,
    is_maths_skill: isMaths,
    is_required_practical: isRp,
    required_practical_id: isRp && rpId ? rpId : null
  };
}

export function readCreatorDraftForDifficulty() {
  const maxMarksEl = document.getElementById("maxMarks");
  const meta = buildMetadataPayload("creator");
  return {
    question_type: document.getElementById("qType")?.value,
    prompt: document.getElementById("qPrompt")?.value?.trim() || "",
    tier: document.getElementById("tierSelect")?.value,
    max_marks: parseInt(maxMarksEl?.value, 10) || 1,
    ...meta
  };
}

function populateCommandWordSelect(selectEl, selected = "") {
  if (!selectEl) return;
  const cur = selected || selectEl.value;
  selectEl.innerHTML = `<option value="">— Select —</option>` +
    COMMAND_WORD_OPTIONS.map((w) => `<option value="${w}"${w === cur ? " selected" : ""}>${w}</option>`).join("");
}

function populateDemandSelect(selectEl, tier, selected = "") {
  if (!selectEl) return;
  const options = getDemandOptionsForTier(tier);
  const cur = selected || selectEl.value;
  selectEl.innerHTML = options.map((o) => `<option value="${o.value}"${o.value === cur ? " selected" : ""}>${o.label}</option>`).join("");
}

export function updateAoValidationLabel(mode, maxMarks) {
  const ids = metaIds(mode === "edit" ? "edit" : "creator");
  const label = document.getElementById(ids.aoValidation);
  if (!label) return;
  const ao1 = document.getElementById(ids.ao1)?.value;
  const ao2 = document.getElementById(ids.ao2)?.value;
  const ao3 = document.getElementById(ids.ao3)?.value;
  const { valid, sum, max } = validateAoMarksSum(ao1, ao2, ao3, maxMarks);
  label.textContent = valid ? `✓ ${sum}/${max} marks allocated` : `⚠ ${sum}/${max} — must equal max marks`;
  label.className = valid ? "ao-validation ao-validation--ok" : "ao-validation ao-validation--warn";
}

export function refreshCreatorDifficultyBadge() {
  const badge = document.getElementById("difficultyBadge");
  if (!badge) return;
  badge.textContent = String(computeQuestionDifficulty(readCreatorDraftForDifficulty()));
}

export function syncCreatorMetadataFromForm({ autoDemand = false } = {}) {
  const tier = document.getElementById("tierSelect")?.value || "both";
  const prompt = document.getElementById("qPrompt")?.value || "";
  const cmdSel = document.getElementById("commandWordSelect");
  const demandSel = document.getElementById("demandLevelSelect");

  populateDemandSelect(demandSel, tier, demandSel?.value);

  if (autoDemand && cmdSel?.value) {
    demandSel.value = suggestDemandLevel(cmdSel.value, tier);
  }

  const maxMarks = parseInt(document.getElementById("maxMarks")?.value, 10) || 1;
  updateAoValidationLabel("creator", maxMarks);
  refreshCreatorDifficultyBadge();
  autoSizeAdminSelects(document.getElementById("panelCreator"));
}

export function detectCreatorCommandWord() {
  const prompt = document.getElementById("qPrompt")?.value || "";
  const word = suggestCommandWord(prompt);
  const cmdSel = document.getElementById("commandWordSelect");
  if (word && cmdSel) cmdSel.value = word;
  syncCreatorMetadataFromForm({ autoDemand: true });
  return word;
}

export function autoCreatorAoFromMarkPoints() {
  const qType = document.getElementById("qType")?.value;
  const maxMarks = parseInt(document.getElementById("maxMarks")?.value, 10) || 1;
  const mps = collectCreatorMarkPoints();
  const ao = suggestAoMarks(qType, maxMarks, mps);
  document.getElementById("ao1Marks").value = ao.ao1;
  document.getElementById("ao2Marks").value = ao.ao2;
  document.getElementById("ao3Marks").value = ao.ao3;
  const numeric = qType === "numeric";
  document.getElementById("chkMathsSkill").checked = numeric;
  syncCreatorMetadataFromForm();
}

export function validateCreatorMetadata({ block = true } = {}) {
  const qType = document.getElementById("qType")?.value;
  const maxMarks = parseInt(document.getElementById("maxMarks")?.value, 10) || 1;
  const meta = buildMetadataPayload("creator");
  const warnings = [];

  const { valid, sum } = validateAoMarksSum(meta.ao1_marks, meta.ao2_marks, meta.ao3_marks, maxMarks);
  if (!valid) {
    const msg = `AO marks (${sum}) must equal max marks (${maxMarks}).`;
    if (block) return { ok: false, error: msg, warnings };
    warnings.push(msg);
  }

  if (!meta.command_word) warnings.push("No command word selected.");
  if (!meta.demand_level) warnings.push("No demand level selected.");

  const suggested = suggestDemandLevel(meta.command_word, document.getElementById("tierSelect")?.value);
  if (meta.command_word && meta.demand_level && suggested !== meta.demand_level) {
    warnings.push(`Demand "${formatDemandLabel(meta.demand_level)}" differs from suggestion "${formatDemandLabel(suggested)}" for command word "${meta.command_word}".`);
  }

  if (qType === "numeric" && !meta.is_maths_skill) {
    warnings.push("Numeric questions are usually flagged as maths skill.");
  }

  if (meta.is_required_practical && !meta.required_practical_id) {
    const msg = "Select which required practical this question assesses.";
    if (block) return { ok: false, error: msg, warnings };
    warnings.push(msg);
  }

  return { ok: true, warnings, meta };
}

export function applyMetadataToInsertPayload(insertPayload, meta, questionDraft) {
  Object.assign(insertPayload, {
    command_word: meta.command_word,
    demand_level: meta.demand_level,
    ao1_marks: meta.ao1_marks,
    ao2_marks: meta.ao2_marks,
    ao3_marks: meta.ao3_marks,
    is_maths_skill: meta.is_maths_skill,
    is_required_practical: meta.is_required_practical,
    required_practical_id: meta.required_practical_id,
    difficulty: computeQuestionDifficulty({ ...questionDraft, ...meta })
  });
}

export function initCreatorMetadataUI() {
  populateCommandWordSelect(document.getElementById("commandWordSelect"));
  const guidelines = document.getElementById("authoringGuidelinesBody");
  if (guidelines) guidelines.innerHTML = getAuthoringGuidelinesHtml();

  const tierSel = document.getElementById("tierSelect");
  const qPrompt = document.getElementById("qPrompt");
  const maxMarks = document.getElementById("maxMarks");
  const qType = document.getElementById("qType");

  tierSel?.addEventListener("change", () => syncCreatorMetadataFromForm({ autoDemand: true }));
  qPrompt?.addEventListener("input", refreshCreatorDifficultyBadge);
  maxMarks?.addEventListener("change", () => syncCreatorMetadataFromForm());
  qType?.addEventListener("change", () => {
    if (qType.value === "numeric") document.getElementById("chkMathsSkill").checked = true;
    syncCreatorMetadataFromForm();
  });

  ["ao1Marks", "ao2Marks", "ao3Marks"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", () => {
      updateAoValidationLabel("creator", parseInt(maxMarks?.value, 10) || 1);
      refreshCreatorDifficultyBadge();
    });
  });

  document.getElementById("commandWordSelect")?.addEventListener("change", () => syncCreatorMetadataFromForm({ autoDemand: true }));
  document.getElementById("demandLevelSelect")?.addEventListener("change", refreshCreatorDifficultyBadge);
  document.getElementById("btnDetectCommandWord")?.addEventListener("click", detectCreatorCommandWord);
  document.getElementById("btnAutoAoFromMarkPoints")?.addEventListener("click", autoCreatorAoFromMarkPoints);
  document.getElementById("chkRequiredPractical")?.addEventListener("change", () => {
    const row = document.getElementById("requiredPracticalRow");
    if (row) row.classList.toggle("hidden", !document.getElementById("chkRequiredPractical")?.checked);
  });

  ["subjectSelect", "paperSelect", "courseTrackSelect"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      autoSizeAdminSelects(document.getElementById("panelCreator"));
    });
  });

  syncCreatorMetadataFromForm();
  autoSizeAdminSelects(document.getElementById("panelCreator"));
}

export function resetCreatorMetadataFields() {
  const cmdSel = document.getElementById("commandWordSelect");
  if (cmdSel) cmdSel.value = "";
  document.getElementById("ao1Marks").value = "";
  document.getElementById("ao2Marks").value = "";
  document.getElementById("ao3Marks").value = "";
  document.getElementById("chkMathsSkill").checked = false;
  document.getElementById("chkRequiredPractical").checked = false;
  const rpSelect = document.getElementById("requiredPracticalSelect");
  if (rpSelect) rpSelect.value = "";
  const rpRow = document.getElementById("requiredPracticalRow");
  if (rpRow) rpRow.classList.add("hidden");
  syncCreatorMetadataFromForm();
}

export function initEditMetadataUI(q) {
  populateCommandWordSelect(document.getElementById("editCommandWordSelect"), q.command_word || "");
  populateDemandSelect(document.getElementById("editDemandLevelSelect"), q.tier || "both", q.demand_level || "");
  const isMcq = q.question_type === "mcq";
  document.getElementById("editAo1Marks").value = isMcq
    ? (q.ao1_marks ?? 1)
    : (q.ao1_marks ?? "");
  document.getElementById("editAo2Marks").value = isMcq
    ? (q.ao2_marks ?? 0)
    : (q.ao2_marks ?? "");
  document.getElementById("editAo3Marks").value = isMcq
    ? (q.ao3_marks ?? 0)
    : (q.ao3_marks ?? "");
  document.getElementById("editChkMathsSkill").checked = q.is_maths_skill === true;
  document.getElementById("editChkRequiredPractical").checked = q.is_required_practical === true;
  const editRpRow = document.getElementById("editRequiredPracticalRow");
  const editRpSelect = document.getElementById("editRequiredPracticalSelect");
  if (editRpRow) editRpRow.classList.toggle("hidden", q.is_required_practical !== true);
  if (editRpSelect && q.required_practical_id) editRpSelect.value = q.required_practical_id;
  updateAoValidationLabel("edit", q.max_marks);
  autoSizeAdminSelects(document.getElementById("editForm"));
}

export function buildEditMetadataPayload() {
  return buildMetadataPayload("edit");
}

let fitSelectMeasurer = null;

export function autoSizeAdminSelects(root = document) {
  if (!fitSelectMeasurer) {
    fitSelectMeasurer = document.createElement("span");
    fitSelectMeasurer.className = "admin-select-measurer";
    document.body.appendChild(fitSelectMeasurer);
  }

  root.querySelectorAll("select.select-fit").forEach((select) => {
    const cs = getComputedStyle(select);
    fitSelectMeasurer.style.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    let maxW = 0;
    for (const opt of select.options) {
      fitSelectMeasurer.textContent = opt.textContent;
      maxW = Math.max(maxW, fitSelectMeasurer.getBoundingClientRect().width);
    }
    const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 36;
    select.style.width = `${Math.ceil(maxW + pad)}px`;
  });
}
