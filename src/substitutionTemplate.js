// Structured substitution templates — render, collect, mark, numeric rearrangement
import { escapeHtml } from "./utils.js";
import {
  isValidStudentNumber,
  numericInputPlaceholder,
  studentNumberValue,
  studentSubSlotInputStyle
} from "./parseStudentNumber.js";

const SLOT_ID_ALIASES = {
  "Δv": "delta_v",
  "Δt": "delta_t",
  "ΔE": "delta_E",
  "Δθ": "delta_theta",
  "ρ": "rho",
  "λ": "lambda"
};

/** Legacy energy slot ids unified to E in substitution templates. */
const LEGACY_ENERGY_SLOT_IDS = new Set(["E_k", "E_e", "E_p", "delta_E"]);

/** Equations that use unified E in the central catalog (even if a stored sheet row is stale). */
const UNIFIED_ENERGY_EQUATION_IDS = new Set([
  "kinetic_energy",
  "elastic_potential_energy",
  "gravitational_potential_energy",
  "specific_heat_capacity"
]);

let templateCatalog = null;
let catalogLoadPromise = null;

function catalogJsonUrl(baseUrl = "") {
  if (baseUrl) {
    const prefix = String(baseUrl).replace(/\/?$/, "/");
    return `${prefix}data/equation_sheets/substitution_templates.json`;
  }
  return new URL("../data/equation_sheets/substitution_templates.json", import.meta.url).href;
}

function ensureCatalogLoadedSync() {
  return templateCatalog || {};
}

function loadCatalogFromUrl(baseUrl = "") {
  return fetch(catalogJsonUrl(baseUrl))
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load substitution templates: ${res.status}`);
      return res.json();
    })
    .then((data) => {
      templateCatalog = data.templates || {};
      return templateCatalog;
    });
}

/** Load central substitution templates. Call once at app startup (browser or Node). */
export async function initSubstitutionTemplateCatalog(baseUrl = "") {
  if (templateCatalog && Object.keys(templateCatalog).length) return templateCatalog;
  if (!catalogLoadPromise) {
    catalogLoadPromise = loadCatalogFromUrl(baseUrl);
  }
  return catalogLoadPromise;
}

if (typeof window !== "undefined") {
  catalogLoadPromise = loadCatalogFromUrl().catch(() => {
    catalogLoadPromise = null;
    return {};
  });
}

function getCatalogEntry(equationId) {
  ensureCatalogLoadedSync();
  return templateCatalog?.[equationId] || null;
}

function templateUsesEnergyE(template, equationId = null) {
  if (getSlotIdsFromTemplate(template).includes("E")) return true;
  if (equationId && UNIFIED_ENERGY_EQUATION_IDS.has(equationId)) return true;
  const catalogTemplate = equationId ? getCatalogEntry(equationId)?.substitution_template : null;
  return !!catalogTemplate && getSlotIdsFromTemplate(catalogTemplate).includes("E");
}

/** Map legacy energy slot ids to canonical E when the equation uses unified energy symbol. */
export function canonicalSymbolSlotId(template, slotId, equationId = null) {
  if (!slotId) return slotId;
  if (templateUsesEnergyE(template, equationId) && (LEGACY_ENERGY_SLOT_IDS.has(slotId) || slotId === "E")) {
    return "E";
  }
  return slotId;
}

function patchLegacyEnergySlotsInTemplate(template) {
  if (!template) return template;
  const patchItems = (items) => (items || []).map((item) => {
    if (item.kind !== "slot" || !LEGACY_ENERGY_SLOT_IDS.has(item.id)) return item;
    return { ...item, id: "E", label: "E" };
  });
  if (template.layout === "fraction") {
    return {
      ...template,
      lhs: patchItems(template.lhs),
      numerator: patchItems(template.numerator),
      denominator: patchItems(template.denominator)
    };
  }
  return { ...template, tokens: patchItems(template.tokens) };
}

/** Overlay canonical templates from substitution_templates.json onto an equation row. */
export function enrichEquation(equation) {
  if (!equation?.id) return equation;
  const entry = getCatalogEntry(equation.id);
  if (entry) {
    return {
      ...equation,
      substitution_template: entry.substitution_template || equation.substitution_template,
      rearrangement_forms: entry.rearrangement_forms ?? equation.rearrangement_forms
    };
  }
  if (UNIFIED_ENERGY_EQUATION_IDS.has(equation.id) && equation.substitution_template) {
    return {
      ...equation,
      substitution_template: patchLegacyEnergySlotsInTemplate(equation.substitution_template)
    };
  }
  return equation;
}

export function enrichEquationSheet(sheet) {
  if (!sheet?.equations) return sheet;
  return { ...sheet, equations: sheet.equations.map(enrichEquation) };
}

/** Remap legacy energy slot keys in mark-scheme answers to canonical E. */
export function normalizeLegacySlotAnswers(slotAnswers, template) {
  if (!slotAnswers || !template) return { ...(slotAnswers || {}) };
  const ids = new Set(getSlotIdsFromTemplate(template));
  const usesUnifiedE = ids.has("E")
    || [...ids].some((id) => LEGACY_ENERGY_SLOT_IDS.has(id));
  if (!usesUnifiedE) return { ...slotAnswers };
  const out = { ...slotAnswers };
  for (const legacy of LEGACY_ENERGY_SLOT_IDS) {
    if (!(legacy in out)) continue;
    if (isBlankSlotAnswer(out.E)) {
      out.E = out[legacy];
    }
    delete out[legacy];
  }
  return out;
}

export function symbolLabelForHelper(template, slotId, equationId = null) {
  const canonical = canonicalSymbolSlotId(template, slotId, equationId);
  if (canonical === "E") return "E";
  return slotLabelFromTemplate(template, canonical) || canonical;
}

export function normalizeSlotValue(text) {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3");
}

export function findEquationInSheet(equationSheet, equationId) {
  const needle = String(equationId || "").trim();
  if (!needle || !equationSheet?.equations) return null;
  const eq = equationSheet.equations.find(
    (e) => e.id === needle || e.label === needle
  ) || null;
  return eq ? enrichEquation(eq) : null;
}

export function resolveEquationIdForSubstitution(config, equationSheet, subStep, options = {}) {
  const eqSelectStep = (config?.steps || []).find((s) => s.type === "equation_select");
  const hasEquationSelect = !!eqSelectStep;

  if (options.fromPayload?.equation_id) {
    return String(options.fromPayload.equation_id).trim() || null;
  }

  if (typeof document !== "undefined") {
    const selected = document.getElementById("calc_equation_select")?.value?.trim();
    if (selected) return selected;
    if (hasEquationSelect) return null;
  }

  if (eqSelectStep?.answer) return eqSelectStep.answer;
  if (subStep?.equation_id) return subStep.equation_id;
  return null;
}

export function getSubstitutionTemplate(equation) {
  const enriched = equation?.id ? enrichEquation(equation) : equation;
  return enriched?.substitution_template || null;
}

export function getSlotIdsFromTemplate(template) {
  if (!template) return [];
  const ids = [];
  const collect = (items) => {
    for (const item of items || []) {
      if (item.kind === "slot" && item.id) ids.push(item.id);
    }
  };
  if (template.layout === "fraction") {
    collect(template.lhs);
    collect(template.numerator);
    collect(template.denominator);
  } else {
    collect(template.tokens);
  }
  return ids;
}

/** LHS / result quantity id in a substitution template. */
export function identifyResultSlotFromTemplate(template) {
  if (!template) return null;
  if (template.layout === "fraction") {
    const lhs = template.lhs?.find((t) => t.kind === "slot");
    return lhs?.id || null;
  }
  if (template.layout === "product" || template.layout === "sum_product") {
    const eqIdx = (template.tokens || []).findIndex((t) => t.kind === "op" && t.text === "=");
    if (eqIdx < 0) return null;
    const lhsSlot = template.tokens.slice(0, eqIdx).find((t) => t.kind === "slot");
    return lhsSlot?.id || null;
  }
  const first = template.tokens?.find((t) => t.kind === "slot");
  return first?.id || null;
}

/** Rearrangement step only when required (optional steps must not affect substitution). */
export function findActiveRearrangementStep(config) {
  const step = (config?.steps || []).find((s) => s.type === "rearrangement");
  if (!step || step.required === false) return null;
  return step;
}

/** Unknown variable for substitution — only when a rearrangement step is active. */
export function resolveSubstitutionRearrangementSubject(subStep, config = null) {
  const rearrStep = config ? findActiveRearrangementStep(config) : null;
  if (!rearrStep) return null;
  return subStep?.rearrangement_subject || rearrStep.subject || null;
}

/** Slots where students type the variable symbol, not a number. */
export function isBlankSlotAnswer(vals) {
  if (vals == null) return true;
  if (Array.isArray(vals)) {
    if (!vals.length) return true;
    return vals.every((v) => !String(v ?? "").trim());
  }
  return !String(vals).trim();
}

function resolveEquationIdForSymbolSlots(subStep, config = null) {
  return subStep?.equation_id
    || config?.steps?.find((s) => s.type === "equation_select")?.answer
    || null;
}

/** Slots where students type the variable symbol (blank expected value in mark scheme). */
export function resolveSymbolSlotIds(template, subStep, config = null) {
  const equationId = resolveEquationIdForSymbolSlots(subStep, config);
  const slotAnswers = normalizeLegacySlotAnswers(subStep?.slot_answers, template);
  const ids = getSlotIdsFromTemplate(template);
  const toCanonical = (id) => canonicalSymbolSlotId(template, id, equationId);
  const hasAnyMarkSchemeValue = ids.some((id) => !isBlankSlotAnswer(slotAnswers[id]));
  if (hasAnyMarkSchemeValue) {
    const fromBlanks = ids.filter((id) => isBlankSlotAnswer(slotAnswers[id]));
    if (fromBlanks.length) return new Set(fromBlanks.map(toCanonical));
  }

  const subject = resolveSubstitutionRearrangementSubject(subStep, config);
  if (subject) return new Set([toCanonical(subject)]);
  const result = identifyResultSlotFromTemplate(template);
  return result ? new Set([toCanonical(result)]) : new Set();
}

export function slotLabelFromTemplate(template, slotId) {
  const find = (items) => {
    for (const item of items || []) {
      if (item.kind === "slot" && item.id === slotId) return item.label || item.id;
    }
    return null;
  };
  if (!template) return slotId;
  if (template.layout === "fraction") {
    return find(template.lhs) || find(template.numerator) || find(template.denominator) || slotId;
  }
  return find(template.tokens) || slotId;
}

function slotValueMatchesSymbol(slotId, studentVal, template = null) {
  const n = normalizeSlotValue(studentVal);
  if (!n) return false;
  if (n === normalizeSlotValue(slotId)) return true;
  if (slotId === "E") {
    const energyAliases = ["e", "e_k", "ek", "e_e", "ee", "e_p", "ep", "delta_e", "δe", "δE".toLowerCase()];
    if (energyAliases.includes(n)) return true;
  }
  const label = template ? slotLabelFromTemplate(template, slotId) : null;
  if (label && n === normalizeSlotValue(label)) return true;
  for (const [unicode, id] of Object.entries(SLOT_ID_ALIASES)) {
    if (id === slotId && n === normalizeSlotValue(unicode)) return true;
  }
  return false;
}

function slotValueMatchesAccepted(slotId, studentVal, acceptedList, symbolSlotIds, template = null) {
  if (symbolSlotIds?.has(slotId) && slotValueMatchesSymbol(slotId, studentVal, template)) return true;
  return slotValueMatches(studentVal, acceptedList);
}

export function renderSubstitutionHelper(template, symbolSlotIds, equationId = null) {
  if (!symbolSlotIds?.size) return "";
  const labels = [...symbolSlotIds].map((id) => symbolLabelForHelper(template, id, equationId));
  const symText = labels.length === 1 ? labels[0] : labels.join(" or ");
  return `<p class="calc-sub-hint" style="font-size:0.8rem;color:#64748b;margin:0 0 8px;line-height:1.45;">Enter values from the question in each box. For the quantity you are finding, type its symbol (<strong>${escapeHtml(symText)}</strong>).</p>`;
}

function firstMarkSchemeSlotValue(vals) {
  if (vals == null) return "";
  const raw = Array.isArray(vals) ? vals[0] : String(vals);
  return String(raw).split("|")[0].trim();
}

/** Build slot → display map for substitution feedback (symbols + numeric values). */
export function buildMarkSchemeSubstitutionSlots(template, subStep, ctx = {}) {
  const { convStep, config } = ctx;
  const symbolSlotIds = resolveSymbolSlotIds(template, subStep, config);
  const slots = {};
  for (const id of getSlotIdsFromTemplate(template)) {
    if (symbolSlotIds.has(id)) {
      slots[id] = slotLabelFromTemplate(template, id);
      continue;
    }
    if (convStep?.slot_id === id && convStep.answer != null) {
      slots[id] = String(convStep.answer);
      continue;
    }
    const v = firstMarkSchemeSlotValue(
      subStep?.si_slot_answers?.[id] ?? subStep?.slot_answers?.[id]
    );
    slots[id] = v || slotLabelFromTemplate(template, id);
  }
  return slots;
}

function formatSubstitutionTokenSequence(items, slots, template, { latex = false } = {}) {
  let out = "";
  let needSpace = false;
  for (let i = 0; i < (items || []).length; i++) {
    const item = items[i];
    if (item.kind === "slot") {
      const val = slots[item.id] ?? slotLabelFromTemplate(template, item.id);
      const next = items[i + 1];
      if (next?.kind === "op" && /^[²³]$/.test(String(next.text || ""))) {
        const pow = next.text === "²" ? "2" : "3";
        out += (needSpace ? " " : "") + (latex ? `${val}^{${pow}}` : `${val}${next.text}`);
        i++;
      } else {
        out += (needSpace ? " " : "") + val;
      }
      needSpace = true;
    } else if (item.kind === "op") {
      if (item.text === "×") {
        out += latex ? " \\times " : " × ";
        needSpace = false;
      } else if (item.text === "½") {
        out += (needSpace ? " " : "") + (latex ? "\\frac{1}{2}" : "½");
        needSpace = true;
      } else {
        out += (needSpace ? " " : "") + item.text;
        needSpace = true;
      }
    }
  }
  return out.trim();
}

/** Per-slot substitution summary, e.g. "E = 13000, m = 3.5, L" (unknown shown as symbol only). */
export function formatSubstitutionSlotSummary(template, slots, symbolSlotIds = new Set()) {
  if (!template) return "";
  const parts = [];
  for (const id of getSlotIdsFromTemplate(template)) {
    const label = slotLabelFromTemplate(template, id);
    if (symbolSlotIds.has(id)) {
      parts.push(label);
      continue;
    }
    const val = slots[id] ?? label;
    parts.push(`${label} = ${val}`);
  }
  return parts.join(", ");
}

/** Plain-text or LaTeX substitution line, e.g. E = ½ × 500 × 15² */
export function formatSubstitutionEquationDisplay(template, slots, { latex = false } = {}) {
  if (!template) return "";

  if (template.layout === "fraction") {
    const lhs = formatSubstitutionTokenSequence(template.lhs, slots, template, { latex });
    const num = formatSubstitutionTokenSequence(template.numerator, slots, template, { latex });
    const den = formatSubstitutionTokenSequence(template.denominator, slots, template, { latex });
    const eq = latex ? " = " : " = ";
    const rhs = latex ? `\\frac{${num}}{${den}}` : `${num} / ${den}`;
    return `${lhs}${eq}${rhs}`;
  }

  const segments = [];
  let buffer = [];
  const flush = () => {
    if (buffer.length) {
      segments.push(formatSubstitutionTokenSequence(buffer, slots, template, { latex }));
      buffer = [];
    }
  };
  for (const item of template.tokens || []) {
    if (item.kind === "op" && item.text === "=") {
      flush();
      segments.push(latex ? " = " : " = ");
    } else {
      buffer.push(item);
    }
  }
  flush();
  return segments.join("");
}

/** Candidate unknowns for rearrangement (excludes equation result slot). */
export function listRearrangementSubjectIds(equation) {
  const template = getSubstitutionTemplate(equation);
  const resultSlot = identifyResultSlotFromTemplate(template);
  const variants = equation?.rearrangement_forms?.variants || [];
  const fromVariants = variants
    .map((v) => v.subject)
    .filter((s) => s && s !== resultSlot);
  if (fromVariants.length) return [...new Set(fromVariants)];
  if (!template) return [];
  return getSlotIdsFromTemplate(template).filter((id) => id !== resultSlot);
}

export function isStructuredSubstitutionStep(step) {
  if (!step || step.type !== "substitution") return false;
  if (step.mode === "structured") return true;
  if (step.slot_answers && Object.keys(step.slot_answers).length > 0) return true;
  return false;
}

export function resolveSubstitutionContext(config, equationSheet, subStep, options = {}) {
  if (!isStructuredSubstitutionStep(subStep)) {
    return { mode: "free_text", template: null, equationId: null, equation: null };
  }
  const hasEquationSelect = (config?.steps || []).some((s) => s.type === "equation_select");
  const equationId = resolveEquationIdForSubstitution(config, equationSheet, subStep, options);
  if (!equationId && hasEquationSelect) {
    return { mode: "pending", template: null, equationId: null, equation: null };
  }
  const equation = findEquationInSheet(equationSheet, equationId);
  const template = getSubstitutionTemplate(equation);
  if (!template) {
    return { mode: "free_text", template: null, equationId, equation };
  }
  return { mode: "structured", template, equationId, equation };
}

function renderTokenRow(items, inputStyle) {
  let html = "";
  for (const item of items || []) {
    if (item.kind === "slot") {
      const label = item.label || item.id;
      html += `<input type="text" class="calc-sub-slot" data-slot-id="${escapeHtml(item.id)}" aria-label="Substitute ${escapeHtml(label)}" placeholder="?" title="${escapeHtml(label)} — ${numericInputPlaceholder()}" style="${studentSubSlotInputStyle(inputStyle)}"/>`;
    } else if (item.kind === "op") {
      html += `<span class="calc-sub-op" style="padding:0 4px;font-weight:600;">${escapeHtml(item.text)}</span>`;
    }
  }
  return html;
}

export function renderSubstitutionHtml(template, inputStyle) {
  if (!template) return "";

  if (template.layout === "fraction") {
    const lhs = renderTokenRow(template.lhs, inputStyle);
    const num = renderTokenRow(template.numerator, inputStyle);
    const den = renderTokenRow(template.denominator, inputStyle);
    return `
      <div class="calc-sub-layout calc-sub-fraction" style="display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <div class="calc-sub-lhs" style="display:inline-flex;align-items:center;">${lhs}</div>
        <span class="calc-sub-op" style="font-weight:600;">=</span>
        <div class="calc-sub-frac" style="display:inline-flex;flex-direction:column;align-items:center;">
          <div class="calc-sub-num" style="border-bottom:2px solid #334155;padding:2px 6px;display:inline-flex;align-items:center;gap:2px;">${num}</div>
          <div class="calc-sub-den" style="padding:2px 6px;display:inline-flex;align-items:center;gap:2px;">${den}</div>
        </div>
      </div>`;
  }

  return `
    <div class="calc-sub-layout calc-sub-${escapeHtml(template.layout || "product")}" style="display:inline-flex;align-items:center;gap:4px;flex-wrap:wrap;">
      ${renderTokenRow(template.tokens, inputStyle)}
    </div>`;
}

export function renderFreeTextSubstitution(inputStyle) {
  return `<input id="calc_substitution" type="text" placeholder="e.g. E = 0.5 × 2.0 × 4.0²" style="${inputStyle} width:100%;"/>`;
}

export function renderPendingEquationSelectSubstitution() {
  return `<p class="calc-sub-pending" style="font-size:0.85rem;color:#64748b;margin:0;font-style:italic;">Select an equation in the step above first.</p>`;
}

export function renderSubstitutionStepInner(ctx, inputStyle, renderOpts = {}) {
  if (ctx.mode === "pending") {
    return renderPendingEquationSelectSubstitution();
  }
  if (ctx.mode !== "structured" || !ctx.template) {
    return renderFreeTextSubstitution(inputStyle);
  }
  const symbolSlotIds = renderOpts.symbolSlotIds
    ?? resolveSymbolSlotIds(ctx.template, renderOpts.subStep, renderOpts.config);
  const helper = renderSubstitutionHelper(ctx.template, symbolSlotIds, ctx.equationId);
  return `${helper}<div id="calc_substitution_structured" data-equation-id="${escapeHtml(ctx.equationId || "")}">${renderSubstitutionHtml(ctx.template, inputStyle)}</div>`;
}

export function collectStructuredSubstitution(template, root = null) {
  const slots = {};
  if (!template) return slots;
  const scope = root || document;
  const queryAll = scope.querySelectorAll?.bind(scope) || document.querySelectorAll.bind(document);
  queryAll(".calc-sub-slot").forEach((el) => {
    const id = el.dataset.slotId;
    if (id) slots[id] = el.value.trim();
  });
  return slots;
}

export function serializeSubstitutionToText(template, slots) {
  if (!template || !slots) return "";
  const parts = [];
  const appendItems = (items) => {
    for (const item of items || []) {
      if (item.kind === "slot") {
        parts.push(slots[item.id] ?? "");
      } else if (item.kind === "op") {
        parts.push(item.text);
      }
    }
  };
  if (template.layout === "fraction") {
    appendItems(template.lhs);
    parts.push("=");
    appendItems(template.numerator);
    parts.push("/");
    appendItems(template.denominator);
  } else {
    appendItems(template.tokens);
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function collectSubstitutionPayload(config, equationSheet, subStep, workflowRoot = null) {
  const ctx = resolveSubstitutionContext(config, equationSheet, subStep);
  if (ctx.mode === "pending") {
    return { mode: "structured", equation_id: null, slots: {}, text: "" };
  }
  if (ctx.mode === "structured" && ctx.template) {
    const root = workflowRoot ?? resolveCalculationWorkflowRoot();
    const slots = collectStructuredSubstitution(ctx.template, root);
    return {
      mode: "structured",
      equation_id: ctx.equationId,
      slots,
      text: serializeSubstitutionToText(ctx.template, slots)
    };
  }
  const el = document.getElementById("calc_substitution");
  const text = el ? el.value.trim() : "";
  return { mode: "free_text", text };
}

export function substitutionPayloadIsComplete(payload) {
  if (!payload) return false;
  if (payload.mode === "free_text") return !!payload.text;
  if (!payload.equation_id) return false;
  const slots = payload.slots || {};
  return Object.values(slots).every((v) => String(v ?? "").trim() !== "");
}

function normalizeAcceptedSlotValues(accepted) {
  if (Array.isArray(accepted)) return accepted;
  if (accepted == null || accepted === "") return null;
  return [String(accepted)];
}

function slotValueMatches(studentVal, acceptedList) {
  const normalized = normalizeSlotValue(studentVal);
  if (!normalized) return false;
  const list = normalizeAcceptedSlotValues(acceptedList) || [];
  return list.some((a) => {
    const na = normalizeSlotValue(a);
    if (na === normalized) return true;
    const sNum = studentNumberValue(normalized);
    const aNum = studentNumberValue(na);
    if (Number.isFinite(sNum) && Number.isFinite(aNum) && Math.abs(sNum - aNum) < 1e-9) {
      return true;
    }
    return false;
  });
}

export function substitutionSlotsMatch(payload, subStep, template) {
  return substitutionSlotsMatchCommutative(payload, subStep, template);
}

/** Collect token rows from product, fraction, or sum_product layouts. */
function getTemplateTokenRows(template) {
  if (!template) return [];
  if (template.layout === "fraction") {
    return [
      { items: template.lhs || [] },
      { items: template.numerator || [] },
      { items: template.denominator || [] }
    ];
  }
  return [{ items: template.tokens || [] }];
}

function slotHasPowerSuffix(items, index) {
  const next = items[index + 1];
  return next?.kind === "op" && /^[²³2^3]$/.test(String(next.text || "").trim());
}

/** Parse ×-chains per region; slots with ²/³ suffix are positional. */
export function parseCommutativeGroups(template) {
  const fixedSlots = [];
  const commutativeGroups = [];
  const seenFixed = new Set();
  const seenGroups = new Set();

  for (const { items } of getTemplateTokenRows(template)) {
    const regions = [];
    let current = [];
    for (const item of items) {
      if (item.kind === "op" && item.text === "=") {
        if (current.length) regions.push(current);
        current = [];
      } else {
        current.push(item);
      }
    }
    if (current.length) regions.push(current);

    for (const region of regions) {
      let i = 0;
      while (i < region.length) {
        const item = region[i];
        if (item.kind !== "slot") {
          i++;
          continue;
        }
        if (slotHasPowerSuffix(region, i)) {
          if (!seenFixed.has(item.id)) {
            seenFixed.add(item.id);
            fixedSlots.push(item.id);
          }
          i += 2;
          continue;
        }

        const chain = [];
        let j = i;
        while (j < region.length) {
          const slot = region[j];
          if (slot.kind !== "slot" || slotHasPowerSuffix(region, j)) break;
          chain.push(slot.id);
          j++;
          const op = region[j];
          if (op?.kind === "op" && /×/.test(String(op.text))) {
            j++;
            continue;
          }
          break;
        }

        if (chain.length > 1) {
          const key = chain.join(",");
          if (!seenGroups.has(key)) {
            seenGroups.add(key);
            commutativeGroups.push([...chain]);
          }
        } else if (chain.length === 1 && !seenFixed.has(chain[0])) {
          seenFixed.add(chain[0]);
          fixedSlots.push(chain[0]);
        }
        i = j;
      }
    }
  }

  return { fixedSlots, commutativeGroups };
}

function matchCommutativeGroup(groupSlotIds, payload, slotAnswers, symbolSlotIds, template) {
  if (!groupSlotIds.length) return true;
  if (groupSlotIds.length === 1) {
    const id = groupSlotIds[0];
    return slotValueMatchesAccepted(
      id,
      payload.slots?.[id],
      slotAnswers[id],
      symbolSlotIds,
      template
    );
  }

  const assigned = new Set();
  function tryAssign(idx) {
    if (idx >= groupSlotIds.length) return true;
    const expId = groupSlotIds[idx];
    const accepted = slotAnswers[expId];
    for (const studId of groupSlotIds) {
      if (assigned.has(studId)) continue;
      if (!slotValueMatchesAccepted(expId, payload.slots?.[studId], accepted, symbolSlotIds, template)) continue;
      assigned.add(studId);
      if (tryAssign(idx + 1)) return true;
      assigned.delete(studId);
    }
    return false;
  }
  return tryAssign(0);
}

/** Template-aware substitution match with commutative × groups. */
export function substitutionSlotsMatchCommutative(payload, subStep, template, config = null) {
  if (!payload || payload.mode !== "structured" || !subStep?.slot_answers) return false;
  if (!payload.equation_id) return false;
  if (!template) return false;

  const symbolSlotIds = resolveSymbolSlotIds(template, subStep, config);
  const { fixedSlots, commutativeGroups } = parseCommutativeGroups(template);
  const allGrouped = new Set([...fixedSlots, ...commutativeGroups.flat()]);

  for (const id of fixedSlots) {
    const accepted = normalizeAcceptedSlotValues(subStep.slot_answers[id]);
    if (!accepted?.length && !symbolSlotIds.has(id)) return false;
    if (!slotValueMatchesAccepted(id, payload.slots?.[id], accepted, symbolSlotIds, template)) return false;
  }

  for (const group of commutativeGroups) {
    if (!group.length) continue;
    const hasAnswers = group.every((id) =>
      symbolSlotIds.has(id) || normalizeAcceptedSlotValues(subStep.slot_answers[id])?.length
    );
    if (!hasAnswers) return false;
    const positionalOnly = group.some((id) => symbolSlotIds.has(id));
    if (positionalOnly) {
      const ok = group.every((id) =>
        slotValueMatchesAccepted(id, payload.slots?.[id], subStep.slot_answers[id], symbolSlotIds, template)
      );
      if (!ok) return false;
    } else if (!matchCommutativeGroup(group, payload, subStep.slot_answers, symbolSlotIds, template)) {
      return false;
    }
  }

  for (const id of getSlotIdsFromTemplate(template)) {
    if (allGrouped.has(id)) continue;
    const accepted = normalizeAcceptedSlotValues(subStep.slot_answers[id]);
    if (!accepted?.length && !symbolSlotIds.has(id)) return false;
    if (!slotValueMatchesAccepted(id, payload.slots?.[id], accepted, symbolSlotIds, template)) return false;
  }

  return true;
}

function canonicalizeRearrangementToken(token) {
  const t = String(token ?? "").trim();
  if (!t) return "";
  const n = parseFloat(t);
  if (Number.isFinite(n)) return `n:${n}`;
  return `s:${t.toLowerCase()}`;
}

function canonicalizeMulOperands(operands) {
  return [...operands].map(canonicalizeRearrangementToken).sort().join("*");
}

function normalizeRearrangementText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/[{}]/g, "");
}

/** Parse rearranged formula into subject + RHS structure for comparison. */
export function parseRearrangementExpr(expr) {
  const raw = String(expr || "").trim();
  const eqIdx = raw.indexOf("=");
  if (eqIdx < 0) return null;

  const subject = normalizeRearrangementText(raw.slice(0, eqIdx));
  const rhs = raw.slice(eqIdx + 1).trim();

  const stripParens = (s) => {
    let t = String(s).trim();
    while (t.startsWith("(") && t.endsWith(")")) {
      t = t.slice(1, -1).trim();
    }
    return t;
  };

  const parseSide = (side) => {
    const cleaned = stripParens(side);
    const mulParts = cleaned.split(/×|\*/).map((s) => stripParens(s)).filter(Boolean);
    if (mulParts.length > 1) return canonicalizeMulOperands(mulParts);
    return canonicalizeRearrangementToken(cleaned);
  };

  const divParts = rhs.split("/").map((s) => s.trim()).filter(Boolean);
  if (divParts.length === 2) {
    return {
      subject,
      rhs: {
        op: "div",
        num: parseSide(divParts[0]),
        den: parseSide(divParts[1])
      }
    };
  }

  const mulParts = rhs.split(/×|\*/).map((s) => stripParens(s)).filter(Boolean);
  if (mulParts.length >= 2) {
    return { subject, rhs: { op: "mul", operands: canonicalizeMulOperands(mulParts) } };
  }

  return {
    subject,
    rhs: { op: "atom", value: canonicalizeRearrangementToken(stripParens(rhs)) }
  };
}

function canonicalRhs(rhs) {
  if (!rhs) return "";
  if (rhs.op === "div") return `div(${rhs.num},${rhs.den})`;
  if (rhs.op === "mul") return `mul(${rhs.operands})`;
  return `atom(${rhs.value})`;
}

/** Structural rearrangement compare (spacing-insensitive; × operands commutative). */
export function rearrangementStructurallyMatches(studentVal, expectedAnswer) {
  if (!expectedAnswer || !studentVal) return false;
  const a = parseRearrangementExpr(studentVal);
  const b = parseRearrangementExpr(expectedAnswer);
  if (!a || !b) {
    return normalizeRearrangementText(studentVal) === normalizeRearrangementText(expectedAnswer);
  }
  if (a.subject !== b.subject) return false;
  return canonicalRhs(a.rhs) === canonicalRhs(b.rhs);
}

function lookupSlotValue(slotAnswers, slotId) {
  const vals = slotAnswers?.[slotId];
  if (vals == null || vals === "") return null;
  if (Array.isArray(vals)) {
    if (!vals.length) return null;
    return String(vals[0]);
  }
  return String(vals);
}

function replaceIdsInFragment(text, slotAnswers, { subjectSymbol = null, lhs = false } = {}) {
  let result = String(text || "");
  const ids = Object.keys(slotAnswers || {}).sort((a, b) => b.length - a.length);
  for (const id of ids) {
    let val = lookupSlotValue(slotAnswers, id);
    if (val == null) continue;
    if (lhs && subjectSymbol && id === subjectSymbol) {
      val = subjectSymbol;
    }
    const label = Object.entries(SLOT_ID_ALIASES).find(([, v]) => v === id)?.[0];
    const patterns = [id, label].filter(Boolean);
    for (const p of patterns) {
      result = result.replace(new RegExp(`\\b${escapeRegex(p)}\\b`, "g"), val);
    }
  }
  return result.replace(/\s+/g, " ").trim();
}

function replaceSlotIdsInExpression(expr, slotAnswers, { subjectSymbol = null } = {}) {
  const raw = String(expr || "");
  const eqIdx = raw.indexOf("=");
  if (eqIdx < 0) {
    return replaceIdsInFragment(raw, slotAnswers, { subjectSymbol, lhs: false });
  }
  const lhs = replaceIdsInFragment(raw.slice(0, eqIdx), slotAnswers, { subjectSymbol, lhs: true });
  const rhs = replaceIdsInFragment(raw.slice(eqIdx + 1), slotAnswers, { subjectSymbol, lhs: false });
  return `${lhs} = ${rhs}`.replace(/\s+/g, " ").trim();
}

/** Numeric values from student slots for step 3; unknown subject slot is excluded (LHS uses symbol). */
function templateSlotIds(equation) {
  return (equation?.substitution_template?.tokens || [])
    .filter((t) => t.kind === "slot")
    .map((t) => t.id);
}

function isNumericSlotValue(text) {
  return isValidStudentNumber(text);
}

/**
 * Map student step-2 slot values to numeric substitutions for step 3.
 * Ignores the unknown (subject) slot for normal mapping, but if the student typed
 * a number there (e.g. 400 in I when the layout reads 12 = I × 400), assigns it
 * to the one formula variable still missing a numeric value.
 */
function studentNumericSlotsForRearrangement(rawSlots, subjectSymbol, slotIds = null) {
  const ids = slotIds?.length ? slotIds : Object.keys(rawSlots || {});
  const numericById = {};
  for (const id of ids) {
    const text = String(rawSlots?.[id] ?? "").trim();
    if (isNumericSlotValue(text)) numericById[id] = text;
  }

  const out = {};
  for (const [id, val] of Object.entries(numericById)) {
    if (subjectSymbol && id === subjectSymbol) continue;
    out[id] = val;
  }

  if (subjectSymbol && numericById[subjectSymbol] != null) {
    const unfilled = ids.filter((id) => id !== subjectSymbol && out[id] == null);
    if (unfilled.length === 1) {
      out[unfilled[0]] = numericById[subjectSymbol];
    }
  }

  return slotValuesForExpression(out);
}

function resolveRearrangementSubject(rearrStep, subStep, equation, rawStudentSlots) {
  const configured = rearrStep?.subject || subStep?.rearrangement_subject
    || equation?.rearrangement_forms?.default_subject;
  const variants = equation?.rearrangement_forms?.variants || [];
  const subjectIds = new Set(variants.map((v) => v.subject));

  if (configured && subjectIds.has(configured)) {
    return configured;
  }

  for (const [id, val] of Object.entries(rawStudentSlots || {})) {
    if (!subjectIds.has(id)) continue;
    const text = String(val ?? "").trim();
    if (text && !isValidStudentNumber(text)) {
      return id;
    }
  }

  return configured || variants[0]?.subject || null;
}

/** Normalize student slots or mark-scheme slot_answers for expression substitution. */
export function slotValuesForExpression(slotValues) {
  if (!slotValues) return {};
  const out = {};
  for (const [id, val] of Object.entries(slotValues)) {
    const text = Array.isArray(val) ? val[0] : val;
    if (text == null || String(text).trim() === "") continue;
    out[id] = [String(text).trim()];
  }
  return out;
}

/**
 * Mark-scheme slot answers for substitution when a unit-conversion step is present.
 * Uses SI values (not stem display units) and the student's converted value when conversion is correct.
 */
export function resolveSubstitutionMarkScheme(subStep, convStep, resp = null, conversionEcf = null) {
  const base = subStep?.si_slot_answers || subStep?.slot_answers || {};
  const slotAnswers = {};
  for (const [id, vals] of Object.entries(base)) {
    const ms = Array.isArray(vals) ? vals : [String(vals)];
    slotAnswers[id] = [...ms];
  }

  if (!convStep?.slot_id) {
    return { ...subStep, slot_answers: slotAnswers };
  }

  const convSlotId = convStep.slot_id;
  const siVal = lookupSlotValue(subStep?.si_slot_answers, convSlotId)
    ?? lookupSlotValue(slotAnswers, convSlotId)
    ?? lookupSlotValue(subStep?.slot_answers, convSlotId);
  if (convStep.answer != null && String(convStep.answer).trim() !== "") {
    slotAnswers[convSlotId] = [String(convStep.answer)];
  } else if (siVal != null) {
    slotAnswers[convSlotId] = [String(siVal)];
  }

  const studentConv = parseFloat(resp?.steps?.conversion);
  const target = parseFloat(convStep.answer);
  const tol = parseFloat(convStep.tolerance ?? 0.001);
  if (conversionEcf?.slotId === convSlotId && Number.isFinite(conversionEcf.studentVal)) {
    slotAnswers[convSlotId] = [String(conversionEcf.studentVal)];
  } else if (
    Number.isFinite(studentConv)
    && Number.isFinite(target)
    && Math.abs(studentConv - target) <= tol
  ) {
    slotAnswers[convSlotId] = [String(studentConv)];
  }

  return { ...subStep, slot_answers: slotAnswers };
}

/**
 * SI slot map for rearrangement — after conversion, substitution uses SI values in all slots.
 */
export function buildSiSlotAnswersForRearrangement(
  subStep,
  convStep,
  resp = null,
  studentSlots = null,
  conversionEcf = null
) {
  const convSlotId = convStep?.slot_id;
  const studentConv = resp?.steps?.conversion;

  const out = {};
  const base = subStep?.si_slot_answers || subStep?.slot_answers || {};
  for (const [id, vals] of Object.entries(base)) {
    const ms = Array.isArray(vals) ? vals[0] : vals;
    if (ms != null && String(ms).trim() !== "") out[id] = String(ms).trim();
  }

  if (studentSlots) {
    for (const [id, val] of Object.entries(studentSlots)) {
      const t = String(val ?? "").trim();
      if (t && isValidStudentNumber(t)) out[id] = t;
    }
  }

  if (convSlotId && out[convSlotId] == null) {
    if (studentConv != null && Number.isFinite(parseFloat(studentConv))) {
      out[convSlotId] = String(studentConv);
    }
  }

  if (conversionEcf?.slotId != null && Number.isFinite(conversionEcf.studentVal)) {
    out[conversionEcf.slotId] = String(conversionEcf.studentVal);
  }

  return slotValuesForExpression(out);
}

export function resolveMarkSchemeEquationId(config, subStep) {
  const eqSelectStep = (config?.steps || []).find((s) => s.type === "equation_select");
  return subStep?.equation_id || eqSelectStep?.answer || null;
}

export function equationIdsMatch(idA, idB, equationSheet) {
  const a = String(idA || "").trim();
  const b = String(idB || "").trim();
  if (!a || !b) return false;
  if (a === b) return true;
  const eqA = findEquationInSheet(equationSheet, a);
  const eqB = findEquationInSheet(equationSheet, b);
  const canonA = eqA?.id || a;
  const canonB = eqB?.id || b;
  return canonA === canonB;
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lhsSubjectFromExpression(expr) {
  const parts = String(expr || "").split("=");
  return parts[0]?.trim() || null;
}

function applyDistractorPattern(correctExpr, pattern, slotAnswers, subject) {
  const sub = lhsSubjectFromExpression(correctExpr) || subject;
  const parts = correctExpr.split("=").map((s) => s.trim());
  if (parts.length < 2) return null;
  const rhs = parts[1];

  if (pattern === "multiply_instead") {
    const nums = Object.keys(slotAnswers || {})
      .filter((k) => k !== subject)
      .map((k) => lookupSlotValue(slotAnswers, k))
      .filter((v) => v && !Number.isNaN(parseFloat(v)));
    if (nums.length >= 2) {
      return `${sub} = ${nums[0]} × ${nums[1]}`;
    }
    return `${sub} = ${rhs.replace(/\//g, "×")}`;
  }

  if (pattern === "invert_fraction") {
    const fracMatch = rhs.match(/^(.+?)\s*\/\s*(.+)$/);
    if (fracMatch) {
      return `${sub} = ${fracMatch[2].trim()} / ${fracMatch[1].trim()}`;
    }
    const nums = Object.keys(slotAnswers || {})
      .filter((k) => k !== subject)
      .map((k) => lookupSlotValue(slotAnswers, k))
      .filter((v) => v && !Number.isNaN(parseFloat(v)));
    if (nums.length >= 2) {
      return `${sub} = ${nums[1]} / ${nums[0]}`;
    }
  }

  if (pattern === "swap_operands") {
    const fracMatch = rhs.match(/^(.+?)\s*\/\s*(.+)$/);
    if (fracMatch) {
      return `${sub} = ${fracMatch[1].trim()} / ${fracMatch[2].trim()}`;
    }
    const mulMatch = rhs.match(/^(.+?)\s*×\s*(.+)$/);
    if (mulMatch) {
      return `${sub} = ${mulMatch[2].trim()} / ${mulMatch[1].trim()}`;
    }
  }

  return null;
}

export function getRearrangementVariant(equation, subject) {
  const forms = equation?.rearrangement_forms;
  if (!forms?.variants?.length) return null;
  const needle = String(subject || forms.default_subject || "").trim();
  return forms.variants.find((v) => v.subject === needle)
    || forms.variants.find((v) => v.subject === forms.default_subject)
    || forms.variants[0];
}

export function buildNumericRearrangementOptions(equation, subStep, rearrStep, options = {}) {
  const configuredSubject = rearrStep?.subject || subStep?.rearrangement_subject
    || equation?.rearrangement_forms?.default_subject;
  const usingStudentSlots = options.slotValues != null && !options.siSlotAnswers;
  const subject = usingStudentSlots
    ? resolveRearrangementSubject(rearrStep, subStep, equation, options.slotValues)
    : configuredSubject;
  const variant = getRearrangementVariant(equation, subject);
  const slotIds = templateSlotIds(equation);
  let slotAnswers;
  if (options.siSlotAnswers) {
    slotAnswers = options.siSlotAnswers;
  } else if (usingStudentSlots) {
    slotAnswers = studentNumericSlotsForRearrangement(options.slotValues, subject, slotIds);
  } else {
    slotAnswers = slotValuesForExpression(subStep?.si_slot_answers || subStep?.slot_answers);
  }
  if (!variant) {
    return { answer: "", distractors: [], subject: configuredSubject || subject };
  }

  const subjectSymbol = variant.subject;
  const replaceOpts = { subjectSymbol };

  const correct = replaceSlotIdsInExpression(variant.correct, slotAnswers, replaceOpts);
  const distractors = [];
  const seen = new Set([correct]);

  for (const pattern of variant.distractor_patterns || []) {
    const d = applyDistractorPattern(variant.correct, pattern, slotAnswers, subjectSymbol);
    if (d) {
      const numeric = replaceSlotIdsInExpression(d, slotAnswers, replaceOpts);
      if (numeric && !seen.has(numeric)) {
        seen.add(numeric);
        distractors.push(numeric);
      }
    }
  }

  return { answer: correct, distractors, subject: variant.subject };
}

export function resolveCalculationWorkflowRoot() {
  const sandbox = document.getElementById("sandboxStage");
  const sandboxOpen = sandbox
    && !document.getElementById("sandboxModalOverlay")?.classList.contains("hidden");
  if (sandboxOpen) {
    const sandboxPanel = sandbox.querySelector(".calc-workflow-panel");
    if (sandboxPanel) return sandboxPanel;
    return sandbox;
  }

  const fromSelect = document.getElementById("calc_equation_select")?.closest(".calc-workflow-panel");
  if (fromSelect) return fromSelect;
  const fromStructured = document.getElementById("calc_substitution_structured")?.closest(".calc-workflow-panel");
  if (fromStructured) return fromStructured;
  const sandboxPanel = sandbox?.querySelector(".calc-workflow-panel");
  if (sandboxPanel) return sandboxPanel;
  if (sandbox) return sandbox;
  return null;
}

/** Active conversion step from config (required !== false), if any. */
export function getActiveConversionStep(config) {
  const step = (config?.steps || []).find((s) => s.type === "conversion");
  return step && step.required !== false ? step : null;
}

/** True when no conversion step exists, or the student has entered a conversion value. */
export function isConversionInputComplete(convStep) {
  if (!convStep) return true;
  const el = document.getElementById("calc_conversion");
  if (!el) return true;
  if (String(el.value).trim() === "") return false;
  return isValidStudentNumber(el.value);
}

/** True when conversion (if any) and substitution slot inputs are complete for rearrangement. */
export function isRearrangementInputReady(config, equationSheet, subStep, root = null) {
  const convStep = getActiveConversionStep(config);
  if (convStep && !isConversionInputComplete(convStep)) return false;

  const ctx = resolveSubstitutionContext(config, equationSheet, subStep);
  if (ctx.mode !== "structured" || !ctx.template) return true;

  const workflowRoot = root || resolveCalculationWorkflowRoot();
  let slots = collectStructuredSubstitution(ctx.template, workflowRoot);
  if (!Object.values(slots).some((v) => String(v ?? "").trim()) && workflowRoot) {
    slots = collectStructuredSubstitution(ctx.template, document);
  }
  for (const id of getSlotIdsFromTemplate(ctx.template)) {
    if (!String(slots[id] ?? "").trim()) return false;
  }
  return true;
}

/** Rebuild step 3 dropdown from live student slot inputs + selected equation (Option B UI). */
export function refreshRearrangementFromStudentSlots(config, equationSheet, subStep, rearrStep, root = null) {
  if (!rearrStep || rearrStep.mode !== "numeric") return;
  const eqId = resolveEquationIdForSubstitution(config, equationSheet, subStep);
  if (!eqId) {
    refreshRearrangementSelect(rearrStep, { answer: "", distractors: [] });
    return;
  }
  const eq = findEquationInSheet(equationSheet, eqId);
  if (!eq) {
    refreshRearrangementSelect(rearrStep, { answer: "", distractors: [] });
    return;
  }
  const convStep = getActiveConversionStep(config);
  const workflowRoot = root || resolveCalculationWorkflowRoot();
  if (!isRearrangementInputReady(config, equationSheet, subStep, workflowRoot)) {
    const needsConversion = !!getActiveConversionStep(config);
    refreshRearrangementSelect(rearrStep, {
      locked: true,
      lockReason: needsConversion ? "conversion" : "substitution"
    });
    return;
  }
  const ctx = resolveSubstitutionContext(config, equationSheet, subStep);
  let studentSlots = ctx.mode === "structured" && ctx.template
    ? collectStructuredSubstitution(ctx.template, workflowRoot)
    : {};
  if (ctx.template && !Object.values(studentSlots).some((v) => String(v ?? "").trim()) && workflowRoot) {
    studentSlots = collectStructuredSubstitution(ctx.template, document);
  }
  const convEl = document.getElementById("calc_conversion");
  const convRaw = convEl ? String(convEl.value).trim() : "";
  const studentConv = convRaw !== "" && isValidStudentNumber(convRaw) ? studentNumberValue(convRaw) : null;
  const resp = Number.isFinite(studentConv) ? { steps: { conversion: studentConv } } : null;
  const siSlots = buildSiSlotAnswersForRearrangement(subStep, convStep, resp, studentSlots);
  const built = buildNumericRearrangementOptions(eq, subStep, rearrStep, { siSlotAnswers: siSlots });
  refreshRearrangementSelect(rearrStep, built);
}

export function refreshSubstitutionStepDom(config, equationSheet, subStep, inputStyle) {
  const container = document.querySelector('.calc-step[data-step="substitution"] .calc-sub-step-inner');
  if (!container) return;
  const ctx = resolveSubstitutionContext(config, equationSheet, subStep);
  container.innerHTML = renderSubstitutionStepInner(ctx, inputStyle, { config, subStep });
}

export function refreshRearrangementSelect(rearrStep, options) {
  const select = document.getElementById("calc_rearrangement");
  if (!select || !options) return;
  if (options.locked) {
    select.disabled = true;
    const hint = options.lockReason === "substitution"
      ? "— Complete substitution first —"
      : "— Complete conversion and substitution first —";
    select.innerHTML = `<option value="">${hint}</option>`;
    return;
  }
  select.disabled = false;
  const choices = [options.answer, ...(options.distractors || [])].filter(Boolean);
  const unique = [...new Set(choices)];
  select.innerHTML = `<option value="">— Select formula —</option>${unique.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("")}`;
}

export function enrichCalculationConfigFromEquationSheet(config, equationSheet) {
  if (!config?.steps || !equationSheet?.equations) return config;
  const subStep = config.steps.find((s) => s.type === "substitution");
  const rearrStep = config.steps.find((s) => s.type === "rearrangement");
  if (!subStep || !isStructuredSubstitutionStep(subStep)) return config;

  const equationId = subStep.equation_id || config.steps.find((s) => s.type === "equation_select")?.answer;
  const equation = findEquationInSheet(equationSheet, equationId);
  if (!equation) return config;

  const template = getSubstitutionTemplate(equation);
  const convStep = config.steps.find((s) => s.type === "conversion");
  const canonicalSubject = (subject) => (
    subject ? canonicalSymbolSlotId(template, subject, equationId) : subject
  );
  const normalizedSub = {
    ...subStep,
    slot_answers: normalizeLegacySlotAnswers(subStep.slot_answers, template),
    si_slot_answers: normalizeLegacySlotAnswers(
      subStep.si_slot_answers || subStep.slot_answers,
      template
    ),
    rearrangement_subject: canonicalSubject(subStep.rearrangement_subject)
  };

  const steps = config.steps.map((step) => {
    if (step.type === "substitution") {
      if (convStep) {
        const resolved = resolveSubstitutionMarkScheme(normalizedSub, convStep);
        return { ...resolved, si_slot_answers: resolved.slot_answers };
      }
      return normalizedSub;
    }
    if (step.type !== "rearrangement") return step;
    if (step.mode === "symbolic") {
      return { ...step, subject: canonicalSubject(step.subject) };
    }
    const subForRearr = convStep
      ? resolveSubstitutionMarkScheme(normalizedSub, convStep)
      : normalizedSub;
    if (!subForRearr.slot_answers) return step;
    const siSlots = buildSiSlotAnswersForRearrangement(subForRearr, convStep);
    const built = buildNumericRearrangementOptions(equation, subForRearr, step, { siSlotAnswers: siSlots });
    if (!built.answer) return step;
    return {
      ...step,
      mode: "numeric",
      subject: canonicalSubject(built.subject || step.subject),
      answer: built.answer,
      distractors: built.distractors
    };
  });

  return { ...config, steps };
}
