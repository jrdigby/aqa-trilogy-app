var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/utils.js
var escapeHtml;
var init_utils = __esm({
  "src/utils.js"() {
    escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
});

// src/parseStudentNumber.js
function expandUnicodeSuperscripts(text) {
  return String(text).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/g, (ch) => UNICODE_SUPERSCRIPT[ch] ?? ch);
}
function stripThousandsSeparators(text) {
  return String(text).replace(/,/g, "");
}
function normalizeInputText(raw) {
  let text = stripThousandsSeparators(String(raw ?? "").trim());
  text = text.replace(/10([⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+)/g, (_, exp) => `10^${expandUnicodeSuperscripts(exp)}`);
  return text.replace(/\s+/g, " ").trim();
}
function parseStandardFormParts(text) {
  const match = normalizeInputText(text).match(STANDARD_FORM_RE);
  if (!match) return null;
  const mantissa = parseFloat(match[1]);
  const exponent = parseInt(match[2], 10);
  if (!Number.isFinite(mantissa) || !Number.isFinite(exponent)) return null;
  return { mantissa, exponent };
}
function valueFromStandardForm(mantissa, exponent) {
  return mantissa * Math.pow(10, exponent);
}
function promptRequiresStandardForm(promptText) {
  const p = String(promptText || "").toLowerCase();
  return /\bin\s+standard\s+form\b/.test(p) || /\bgive\s+(?:your\s+)?answer\s+in\s+standard\s+form\b/.test(p);
}
function isStandardFormPresentation(raw) {
  const parts = parseStandardFormParts(raw);
  if (!parts) return false;
  const absMantissa = Math.abs(parts.mantissa);
  return absMantissa >= 1 && absMantissa < 10;
}
function parseStudentNumber(raw) {
  const original = String(raw ?? "").trim();
  if (!original) {
    return { value: null, raw: "", valid: false, standardForm: false };
  }
  const normalized = normalizeInputText(original);
  if (!normalized) {
    return { value: null, raw: original, valid: false, standardForm: false };
  }
  const sfParts = parseStandardFormParts(normalized);
  if (sfParts) {
    const value = valueFromStandardForm(sfParts.mantissa, sfParts.exponent);
    if (!Number.isFinite(value)) {
      return { value: null, raw: original, valid: false, standardForm: false };
    }
    return {
      value,
      raw: original,
      valid: true,
      standardForm: isStandardFormPresentation(original)
    };
  }
  const plain = parseFloat(normalized);
  if (Number.isFinite(plain) && /^-?\d*\.?\d+(?:e[+-]?\d+)?$/i.test(normalized.replace(/\s/g, ""))) {
    return { value: plain, raw: original, valid: true, standardForm: false };
  }
  return { value: null, raw: original, valid: false, standardForm: false };
}
function studentNumberValue(raw) {
  return parseStudentNumber(raw).value;
}
function isValidStudentNumber(raw) {
  return parseStudentNumber(raw).valid;
}
function formatPlainNumberLatex(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e6 || abs > 0 && abs < 1e-3) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = n / Math.pow(10, exp);
    const mantissaStr = String(Number(mantissa.toPrecision(10)));
    return `${mantissaStr} \\times 10^{${exp}}`;
  }
  return String(n);
}
function formatNumberLatexPreview(raw) {
  const parsed = parseStudentNumber(raw);
  if (!parsed.valid || parsed.value == null) return "";
  const sfParts = parseStandardFormParts(raw);
  if (sfParts && isStandardFormPresentation(raw)) {
    const mantissaStr = String(sfParts.mantissa);
    return `${mantissaStr} \\times 10^{${sfParts.exponent}}`;
  }
  const normalized = normalizeInputText(raw);
  if (/e[+-]?\d+$/i.test(normalized.replace(/\s/g, ""))) {
    const [mantissa, expPart] = normalized.toLowerCase().split("e");
    const exponent = parseInt(expPart, 10);
    if (Number.isFinite(exponent)) {
      return `${mantissa.trim()} \\times 10^{${exponent}}`;
    }
  }
  return formatPlainNumberLatex(parsed.value);
}
function numericInputPlaceholder(requiresStandardForm = false) {
  return requiresStandardForm ? "e.g. 3.2x10^6" : "e.g. 4500 or 3.2x10^3";
}
function studentSubSlotInputStyle(baseInputStyle) {
  return `${baseInputStyle} width:${STUDENT_SUB_SLOT_INPUT_WIDTH}; min-width:${STUDENT_SUB_SLOT_INPUT_MIN_WIDTH}; max-width:${STUDENT_SUB_SLOT_INPUT_MAX_WIDTH}; text-align:center; box-sizing:border-box; font-variant-numeric:tabular-nums;`;
}
function studentNumericInputStyle(baseInputStyle) {
  return `${baseInputStyle} width:${STUDENT_NUMERIC_INPUT_WIDTH}; min-width:${STUDENT_NUMERIC_INPUT_MIN_WIDTH}; max-width:100%; box-sizing:border-box; font-variant-numeric:tabular-nums;`;
}
function renderStandardFormInputHelper({ requiresStandardForm = false } = {}) {
  const border = requiresStandardForm ? "#7dd3fc" : "#e2e8f0";
  const bg = requiresStandardForm ? "#f0f9ff" : "#f8fafc";
  const openAttr = requiresStandardForm ? " open" : "";
  const summary = requiresStandardForm ? "How to type your answer in standard form" : "How to type numbers";
  const codeStyle = "background:#fff;padding:2px 6px;border-radius:3px;border:1px solid #e2e8f0;font-family:ui-monospace,Consolas,monospace;font-size:0.92em;";
  const requiredNote = requiresStandardForm ? `<p style="margin:10px 0 0;font-size:0.82rem;font-weight:600;color:#0369a1;">
        This question requires standard form \u2014 use the <code style="${codeStyle}">x10^</code> pattern below
        (not plain <code style="${codeStyle}">334000</code> or calculator <code style="${codeStyle}">3.34e5</code>).
      </p>` : "";
  return `
    <details class="calc-numeric-format-helper"${openAttr}
      style="margin:12px 0 0;border:1px solid ${border};border-radius:8px;background:${bg};padding:8px 12px;font-size:0.82rem;color:#334155;line-height:1.45;">
      <summary style="cursor:pointer;font-weight:700;color:#0f172a;list-style-position:outside;">
        ${summary}
      </summary>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid ${border};">
        <p style="margin:0 0 6px;font-weight:600;">Standard form \u2014 type on your keyboard:</p>
        <p style="margin:0 0 8px;padding:8px 10px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;">
          <code style="${codeStyle}">a</code>
          <span style="color:var(--text-muted);"> then </span>
          <code style="${codeStyle}">x10^</code>
          <span style="color:var(--text-muted);"> then the power </span>
          <code style="${codeStyle}">n</code>
          <span style="color:var(--text-muted);"> &nbsp;\u2192&nbsp; e.g. </span>
          <code style="${codeStyle}">3.2x10^6</code>
        </p>
        <p style="margin:0 0 6px;">Examples to type:</p>
        <ul style="margin:0 0 8px;padding-left:18px;">
          <li style="margin-bottom:4px;">
            <code style="${codeStyle}">3.2x10^6</code>
            <span style="color:var(--text-muted);"> or </span>
            <code style="${codeStyle}">3.2\xD710^6</code>
            <span style="color:var(--text-muted);"> \u2192 </span>
            $3.2 \\times 10^{6}$
          </li>
          <li style="margin-bottom:4px;">
            <code style="${codeStyle}">4.5x10^3</code>
            <span style="color:var(--text-muted);"> \u2192 </span>
            $4.5 \\times 10^{3}$
          </li>
          <li style="margin-bottom:4px;">
            <code style="${codeStyle}">1.2x10^-4</code>
            <span style="color:var(--text-muted);"> (negative power) \u2192 </span>
            $1.2 \\times 10^{-4}$
          </li>
          <li>
            <strong>Ordinary numbers</strong> also work:
            <code style="${codeStyle}">4500</code>,
            <code style="${codeStyle}">0.003</code>,
            <code style="${codeStyle}">3.2e8</code>
          </li>
        </ul>
        <p style="margin:0;font-size:0.78rem;color:var(--text-muted);">
          Use <strong>x</strong> or <strong>\xD7</strong> before 10; use <strong>^</strong> before the exponent.
          Spaces are optional (<code style="${codeStyle}">3.2 x 10^6</code>).
        </p>
        ${requiredNote}
      </div>
    </details>`;
}
var UNICODE_SUPERSCRIPT, STANDARD_FORM_RE, STUDENT_NUMERIC_INPUT_WIDTH, STUDENT_NUMERIC_INPUT_MIN_WIDTH, STUDENT_SUB_SLOT_INPUT_WIDTH, STUDENT_SUB_SLOT_INPUT_MIN_WIDTH, STUDENT_SUB_SLOT_INPUT_MAX_WIDTH;
var init_parseStudentNumber = __esm({
  "src/parseStudentNumber.js"() {
    UNICODE_SUPERSCRIPT = {
      "\u2070": "0",
      "\xB9": "1",
      "\xB2": "2",
      "\xB3": "3",
      "\u2074": "4",
      "\u2075": "5",
      "\u2076": "6",
      "\u2077": "7",
      "\u2078": "8",
      "\u2079": "9",
      "\u207B": "-",
      "\u207A": "+"
    };
    STANDARD_FORM_RE = /^(-?\d+(?:\.\d+)?)\s*[×x*]\s*10\s*(?:\^|\*\*)?\s*(-?\d+)\s*$/i;
    STUDENT_NUMERIC_INPUT_WIDTH = "15ch";
    STUDENT_NUMERIC_INPUT_MIN_WIDTH = "13ch";
    STUDENT_SUB_SLOT_INPUT_WIDTH = "15ch";
    STUDENT_SUB_SLOT_INPUT_MIN_WIDTH = "14ch";
    STUDENT_SUB_SLOT_INPUT_MAX_WIDTH = "20ch";
  }
});

// src/sigFigs.js
function mantissaForSigFigs(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const parsed = parseStudentNumber(raw);
  if (parsed.valid && /[×x*]\s*10/i.test(raw)) {
    const match = raw.replace(/,/g, "").match(/^(-?\d+(?:\.\d+)?)\s*[×x*]\s*10/i);
    if (match) return match[1];
  }
  return raw;
}
function countSigFigs(value) {
  if (value == null || value === "") return 0;
  let s = mantissaForSigFigs(value).replace(/,/g, "");
  if (!s || s === "-" || s === "+") return 0;
  const isNegative = s.startsWith("-");
  if (isNegative) s = s.slice(1);
  if (/e/i.test(s)) {
    const [mantissa] = s.toLowerCase().split("e");
    return countSigFigs(isNegative ? `-${mantissa}` : mantissa);
  }
  if (s.includes(".")) {
    const firstSig = s.search(/[1-9]/);
    if (firstSig < 0) return 0;
    let count = 0;
    for (let i = firstSig; i < s.length; i++) {
      if (s[i] >= "0" && s[i] <= "9") count++;
    }
    return count;
  }
  s = s.replace(/0+$/, "");
  return s.replace(/[^0-9]/g, "").length || 0;
}
function roundToSigFigs(value, n) {
  const num = Number(value);
  if (!Number.isFinite(num) || n < 1) return num;
  if (num === 0) return 0;
  const sign = num < 0 ? -1 : 1;
  const abs = Math.abs(num);
  const power = Math.floor(Math.log10(abs));
  const factor = Math.pow(10, n - 1 - power);
  return sign * Math.round(abs * factor) / factor;
}
function matchesSigFigs(studentValue, expectedValue, n, tolerance = 0, options = {}) {
  const requireSigFigCount = !!options.requireSigFigCount;
  const studentRaw = String(studentValue ?? "");
  const studentParsed = parseStudentNumber(studentRaw);
  const student = studentParsed.valid ? studentParsed.value : Number(studentValue);
  const expected = Number(expectedValue);
  if (!Number.isFinite(student) || !Number.isFinite(expected)) return false;
  const roundedExpected = roundToSigFigs(expected, n);
  const tol = Math.max(Math.abs(tolerance), Math.abs(roundedExpected) * 1e-9, 1e-9);
  const studentSf = countSigFigs(studentRaw);
  if (Math.abs(student - roundedExpected) <= tol) {
    if (!requireSigFigCount || studentSf === n) return true;
    if (student === roundedExpected) return true;
    return false;
  }
  if (requireSigFigCount && studentSf !== n) return false;
  return Math.abs(student - roundedExpected) <= tol * 10;
}
var init_sigFigs = __esm({
  "src/sigFigs.js"() {
    init_parseStudentNumber();
  }
});

// src/substitutionTemplate.js
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
  return fetch(catalogJsonUrl(baseUrl)).then((res) => {
    if (!res.ok) throw new Error(`Failed to load substitution templates: ${res.status}`);
    return res.json();
  }).then((data) => {
    templateCatalog = data.templates || {};
    return templateCatalog;
  });
}
async function initSubstitutionTemplateCatalog(baseUrl = "") {
  if (templateCatalog && Object.keys(templateCatalog).length) return templateCatalog;
  if (!catalogLoadPromise) {
    catalogLoadPromise = loadCatalogFromUrl(baseUrl);
  }
  return catalogLoadPromise;
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
function canonicalSymbolSlotId(template, slotId, equationId = null) {
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
function enrichEquation(equation) {
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
function enrichEquationSheet(sheet) {
  if (!sheet?.equations) return sheet;
  return { ...sheet, equations: sheet.equations.map(enrichEquation) };
}
function normalizeLegacySlotAnswers(slotAnswers, template) {
  if (!slotAnswers || !template) return { ...slotAnswers || {} };
  const ids = new Set(getSlotIdsFromTemplate(template));
  const usesUnifiedE = ids.has("E") || [...ids].some((id) => LEGACY_ENERGY_SLOT_IDS.has(id));
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
function symbolLabelForHelper(template, slotId, equationId = null) {
  const canonical = canonicalSymbolSlotId(template, slotId, equationId);
  if (canonical === "E") return "E";
  return slotLabelFromTemplate(template, canonical) || canonical;
}
function normalizeSlotValue(text) {
  return String(text ?? "").trim().toLowerCase().replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/²/g, "^2").replace(/³/g, "^3");
}
function findEquationInSheet(equationSheet, equationId) {
  const needle = String(equationId || "").trim();
  if (!needle || !equationSheet?.equations) return null;
  const eq = equationSheet.equations.find(
    (e) => e.id === needle || e.label === needle
  ) || null;
  return eq ? enrichEquation(eq) : null;
}
function resolveEquationIdForSubstitution(config, equationSheet, subStep, options = {}) {
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
function getSubstitutionTemplate(equation) {
  const enriched = equation?.id ? enrichEquation(equation) : equation;
  return enriched?.substitution_template || null;
}
function getSlotIdsFromTemplate(template) {
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
function identifyResultSlotFromTemplate(template) {
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
function findActiveRearrangementStep(config) {
  const step = (config?.steps || []).find((s) => s.type === "rearrangement");
  if (!step || step.required === false) return null;
  return step;
}
function resolveSubstitutionRearrangementSubject(subStep, config = null) {
  const rearrStep = config ? findActiveRearrangementStep(config) : null;
  if (!rearrStep) return null;
  return subStep?.rearrangement_subject || rearrStep.subject || null;
}
function isBlankSlotAnswer(vals) {
  if (vals == null) return true;
  if (Array.isArray(vals)) {
    if (!vals.length) return true;
    return vals.every((v) => !String(v ?? "").trim());
  }
  return !String(vals).trim();
}
function resolveEquationIdForSymbolSlots(subStep, config = null) {
  return subStep?.equation_id || config?.steps?.find((s) => s.type === "equation_select")?.answer || null;
}
function resolveSymbolSlotIds(template, subStep, config = null) {
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
  if (subject) return /* @__PURE__ */ new Set([toCanonical(subject)]);
  const result = identifyResultSlotFromTemplate(template);
  return result ? /* @__PURE__ */ new Set([toCanonical(result)]) : /* @__PURE__ */ new Set();
}
function slotLabelFromTemplate(template, slotId) {
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
    const energyAliases = ["e", "e_k", "ek", "e_e", "ee", "e_p", "ep", "delta_e", "\u03B4e", "\u03B4E".toLowerCase()];
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
function renderSubstitutionHelper(template, symbolSlotIds, equationId = null) {
  if (!symbolSlotIds?.size) return "";
  const labels = [...symbolSlotIds].map((id) => symbolLabelForHelper(template, id, equationId));
  const symText = labels.length === 1 ? labels[0] : labels.join(" or ");
  return `<p class="calc-sub-hint" style="font-size:0.8rem;color:var(--text-muted);margin:0 0 8px;line-height:1.45;">Enter values from the question in each box. For the quantity you are finding, type its symbol (<strong>${escapeHtml(symText)}</strong>).</p>`;
}
function firstMarkSchemeSlotValue(vals) {
  if (vals == null) return "";
  const raw = Array.isArray(vals) ? vals[0] : String(vals);
  return String(raw).split("|")[0].trim();
}
function buildMarkSchemeSubstitutionSlots(template, subStep, ctx = {}) {
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
        const pow = next.text === "\xB2" ? "2" : "3";
        out += (needSpace ? " " : "") + (latex ? `${val}^{${pow}}` : `${val}${next.text}`);
        i++;
      } else {
        out += (needSpace ? " " : "") + val;
      }
      needSpace = true;
    } else if (item.kind === "op") {
      if (item.text === "\xD7") {
        out += latex ? " \\times " : " \xD7 ";
        needSpace = false;
      } else if (item.text === "\xBD") {
        out += (needSpace ? " " : "") + (latex ? "\\frac{1}{2}" : "\xBD");
        needSpace = true;
      } else {
        out += (needSpace ? " " : "") + item.text;
        needSpace = true;
      }
    }
  }
  return out.trim();
}
function formatSubstitutionSlotSummary(template, slots, symbolSlotIds = /* @__PURE__ */ new Set()) {
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
function formatSubstitutionEquationDisplay(template, slots, { latex = false } = {}) {
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
function listRearrangementSubjectIds(equation) {
  const template = getSubstitutionTemplate(equation);
  const resultSlot = identifyResultSlotFromTemplate(template);
  const variants = equation?.rearrangement_forms?.variants || [];
  const fromVariants = variants.map((v) => v.subject).filter((s) => s && s !== resultSlot);
  if (fromVariants.length) return [...new Set(fromVariants)];
  if (!template) return [];
  return getSlotIdsFromTemplate(template).filter((id) => id !== resultSlot);
}
function isStructuredSubstitutionStep(step) {
  if (!step || step.type !== "substitution") return false;
  if (step.mode === "structured") return true;
  if (step.slot_answers && Object.keys(step.slot_answers).length > 0) return true;
  return false;
}
function resolveSubstitutionContext(config, equationSheet, subStep, options = {}) {
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
function renderTokenRow(items, inputStyle2) {
  let html = "";
  for (const item of items || []) {
    if (item.kind === "slot") {
      const label = item.label || item.id;
      html += `<input type="text" class="calc-sub-slot" data-slot-id="${escapeHtml(item.id)}" aria-label="Substitute ${escapeHtml(label)}" placeholder="?" title="${escapeHtml(label)} \u2014 ${numericInputPlaceholder()}" style="${studentSubSlotInputStyle(inputStyle2)}"/>`;
    } else if (item.kind === "op") {
      html += `<span class="calc-sub-op" style="padding:0 4px;font-weight:600;">${escapeHtml(item.text)}</span>`;
    }
  }
  return html;
}
function renderSubstitutionHtml(template, inputStyle2) {
  if (!template) return "";
  if (template.layout === "fraction") {
    const lhs = renderTokenRow(template.lhs, inputStyle2);
    const num = renderTokenRow(template.numerator, inputStyle2);
    const den = renderTokenRow(template.denominator, inputStyle2);
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
      ${renderTokenRow(template.tokens, inputStyle2)}
    </div>`;
}
function renderFreeTextSubstitution(inputStyle2) {
  return `<input id="calc_substitution" type="text" placeholder="e.g. E = 0.5 \xD7 2.0 \xD7 4.0\xB2" style="${inputStyle2} width:100%;"/>`;
}
function renderPendingEquationSelectSubstitution() {
  return `<p class="calc-sub-pending" style="font-size:0.85rem;color:var(--text-muted);margin:0;font-style:italic;">Select an equation in the step above first.</p>`;
}
function renderSubstitutionStepInner(ctx, inputStyle2, renderOpts = {}) {
  if (ctx.mode === "pending") {
    return renderPendingEquationSelectSubstitution();
  }
  if (ctx.mode !== "structured" || !ctx.template) {
    return renderFreeTextSubstitution(inputStyle2);
  }
  const symbolSlotIds = renderOpts.symbolSlotIds ?? resolveSymbolSlotIds(ctx.template, renderOpts.subStep, renderOpts.config);
  const helper = renderSubstitutionHelper(ctx.template, symbolSlotIds, ctx.equationId);
  return `${helper}<div id="calc_substitution_structured" data-equation-id="${escapeHtml(ctx.equationId || "")}">${renderSubstitutionHtml(ctx.template, inputStyle2)}</div>`;
}
function collectStructuredSubstitution(template, root = null) {
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
function serializeSubstitutionToText(template, slots) {
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
function collectSubstitutionPayload(config, equationSheet, subStep, workflowRoot = null) {
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
function substitutionPayloadIsComplete(payload) {
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
function parseCommutativeGroups(template) {
  const fixedSlots = [];
  const commutativeGroups = [];
  const seenFixed = /* @__PURE__ */ new Set();
  const seenGroups = /* @__PURE__ */ new Set();
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
  const assigned = /* @__PURE__ */ new Set();
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
function substitutionSlotsMatchCommutative(payload, subStep, template, config = null) {
  if (!payload || payload.mode !== "structured" || !subStep?.slot_answers) return false;
  if (!payload.equation_id) return false;
  if (!template) return false;
  const symbolSlotIds = resolveSymbolSlotIds(template, subStep, config);
  const { fixedSlots, commutativeGroups } = parseCommutativeGroups(template);
  const allGrouped = /* @__PURE__ */ new Set([...fixedSlots, ...commutativeGroups.flat()]);
  for (const id of fixedSlots) {
    const accepted = normalizeAcceptedSlotValues(subStep.slot_answers[id]);
    if (!accepted?.length && !symbolSlotIds.has(id)) return false;
    if (!slotValueMatchesAccepted(id, payload.slots?.[id], accepted, symbolSlotIds, template)) return false;
  }
  for (const group of commutativeGroups) {
    if (!group.length) continue;
    const hasAnswers = group.every(
      (id) => symbolSlotIds.has(id) || normalizeAcceptedSlotValues(subStep.slot_answers[id])?.length
    );
    if (!hasAnswers) return false;
    if (!matchCommutativeGroup(group, payload, subStep.slot_answers, symbolSlotIds, template)) {
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
  return String(text || "").toLowerCase().replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/²/g, "^2").replace(/³/g, "^3").replace(/[{}]/g, "");
}
function parseRearrangementExpr(expr) {
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
    const mulParts2 = cleaned.split(/×|\*/).map((s) => stripParens(s)).filter(Boolean);
    if (mulParts2.length > 1) return canonicalizeMulOperands(mulParts2);
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
function rearrangementStructurallyMatches(studentVal, expectedAnswer) {
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
function templateSlotIds(equation) {
  return (equation?.substitution_template?.tokens || []).filter((t) => t.kind === "slot").map((t) => t.id);
}
function isNumericSlotValue(text) {
  return isValidStudentNumber(text);
}
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
  const configured = rearrStep?.subject || subStep?.rearrangement_subject || equation?.rearrangement_forms?.default_subject;
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
function slotValuesForExpression(slotValues) {
  if (!slotValues) return {};
  const out = {};
  for (const [id, val] of Object.entries(slotValues)) {
    const text = Array.isArray(val) ? val[0] : val;
    if (text == null || String(text).trim() === "") continue;
    out[id] = [String(text).trim()];
  }
  return out;
}
function resolveSubstitutionMarkScheme(subStep, convStep, resp = null, conversionEcf = null) {
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
  const siVal = lookupSlotValue(subStep?.si_slot_answers, convSlotId) ?? lookupSlotValue(slotAnswers, convSlotId) ?? lookupSlotValue(subStep?.slot_answers, convSlotId);
  if (convStep.answer != null && String(convStep.answer).trim() !== "") {
    slotAnswers[convSlotId] = [String(convStep.answer)];
  } else if (siVal != null) {
    slotAnswers[convSlotId] = [String(siVal)];
  }
  const studentConv = parseFloat(resp?.steps?.conversion);
  const target = parseFloat(convStep.answer);
  const tol = parseFloat(convStep.tolerance ?? 1e-3);
  if (conversionEcf?.slotId === convSlotId && Number.isFinite(conversionEcf.studentVal)) {
    slotAnswers[convSlotId] = [String(conversionEcf.studentVal)];
  } else if (Number.isFinite(studentConv) && Number.isFinite(target) && Math.abs(studentConv - target) <= tol) {
    slotAnswers[convSlotId] = [String(studentConv)];
  }
  return { ...subStep, slot_answers: slotAnswers };
}
function buildSiSlotAnswersForRearrangement(subStep, convStep, resp = null, studentSlots = null, conversionEcf = null) {
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
function resolveMarkSchemeEquationId(config, subStep) {
  const eqSelectStep = (config?.steps || []).find((s) => s.type === "equation_select");
  return subStep?.equation_id || eqSelectStep?.answer || null;
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
  if (pattern === "flip_sign") {
    if (!/[+\-−]/.test(rhs)) return null;
    const flipped = rhs.replace(/\+/g, "\0").replace(/−|-/g, "+").replace(/\u0000/g, "-");
    return `${sub} = ${flipped}`;
  }
  if (pattern === "multiply_instead") {
    const nums = Object.keys(slotAnswers || {}).filter((k) => k !== subject).map((k) => lookupSlotValue(slotAnswers, k)).filter((v) => v && !Number.isNaN(parseFloat(v)));
    if (nums.length >= 2) {
      return `${sub} = ${nums[0]} \xD7 ${nums[1]}`;
    }
    return `${sub} = ${rhs.replace(/\//g, "\xD7")}`;
  }
  if (pattern === "invert_fraction") {
    const fracMatch = rhs.match(/^(.+?)\s*\/\s*(.+)$/);
    if (fracMatch) {
      return `${sub} = ${fracMatch[2].trim()} / ${fracMatch[1].trim()}`;
    }
    const nums = Object.keys(slotAnswers || {}).filter((k) => k !== subject).map((k) => lookupSlotValue(slotAnswers, k)).filter((v) => v && !Number.isNaN(parseFloat(v)));
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
function getRearrangementVariant(equation, subject) {
  const forms = equation?.rearrangement_forms;
  if (!forms?.variants?.length) return null;
  const needle = String(subject || forms.default_subject || "").trim();
  return forms.variants.find((v) => v.subject === needle) || forms.variants.find((v) => v.subject === forms.default_subject) || forms.variants[0];
}
function buildNumericRearrangementOptions(equation, subStep, rearrStep, options = {}) {
  const configuredSubject = rearrStep?.subject || subStep?.rearrangement_subject || equation?.rearrangement_forms?.default_subject;
  const usingStudentSlots = options.slotValues != null && !options.siSlotAnswers;
  const subject = usingStudentSlots ? resolveRearrangementSubject(rearrStep, subStep, equation, options.slotValues) : configuredSubject;
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
  const seen = /* @__PURE__ */ new Set([correct]);
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
function resolveCalculationWorkflowRoot() {
  const sandbox = document.getElementById("sandboxStage");
  const sandboxOpen = sandbox && !document.getElementById("sandboxModalOverlay")?.classList.contains("hidden");
  if (sandboxOpen) {
    const sandboxPanel2 = sandbox.querySelector(".calc-workflow-panel");
    if (sandboxPanel2) return sandboxPanel2;
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
function getActiveConversionStep(config) {
  const step = (config?.steps || []).find((s) => s.type === "conversion");
  return step && step.required !== false ? step : null;
}
function isConversionInputComplete(convStep) {
  if (!convStep) return true;
  const el = document.getElementById("calc_conversion");
  if (!el) return true;
  if (String(el.value).trim() === "") return false;
  return isValidStudentNumber(el.value);
}
function isRearrangementInputReady(config, equationSheet, subStep, root = null) {
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
function refreshRearrangementFromStudentSlots(config, equationSheet, subStep, rearrStep, root = null) {
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
  let studentSlots = ctx.mode === "structured" && ctx.template ? collectStructuredSubstitution(ctx.template, workflowRoot) : {};
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
function refreshSubstitutionStepDom(config, equationSheet, subStep, inputStyle2) {
  const container = document.querySelector('.calc-step[data-step="substitution"] .calc-sub-step-inner');
  if (!container) return;
  const ctx = resolveSubstitutionContext(config, equationSheet, subStep);
  container.innerHTML = renderSubstitutionStepInner(ctx, inputStyle2, { config, subStep });
}
function refreshRearrangementSelect(rearrStep, options) {
  const select = document.getElementById("calc_rearrangement");
  if (!select || !options) return;
  if (options.locked) {
    select.disabled = true;
    const hint = options.lockReason === "substitution" ? "\u2014 Complete substitution first \u2014" : "\u2014 Complete conversion and substitution first \u2014";
    select.innerHTML = `<option value="">${hint}</option>`;
    return;
  }
  select.disabled = false;
  const choices = [options.answer, ...options.distractors || []].filter(Boolean);
  const unique = [...new Set(choices)];
  select.innerHTML = `<option value="">\u2014 Select formula \u2014</option>${unique.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("")}`;
}
function enrichCalculationConfigFromEquationSheet(config, equationSheet) {
  if (!config?.steps || !equationSheet?.equations) return config;
  const subStep = config.steps.find((s) => s.type === "substitution");
  const rearrStep = config.steps.find((s) => s.type === "rearrangement");
  if (!subStep || !isStructuredSubstitutionStep(subStep)) return config;
  const equationId = subStep.equation_id || config.steps.find((s) => s.type === "equation_select")?.answer;
  const equation = findEquationInSheet(equationSheet, equationId);
  if (!equation) return config;
  const template = getSubstitutionTemplate(equation);
  const convStep = config.steps.find((s) => s.type === "conversion");
  const canonicalSubject = (subject) => subject ? canonicalSymbolSlotId(template, subject, equationId) : subject;
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
    const subForRearr = convStep ? resolveSubstitutionMarkScheme(normalizedSub, convStep) : normalizedSub;
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
var SLOT_ID_ALIASES, LEGACY_ENERGY_SLOT_IDS, UNIFIED_ENERGY_EQUATION_IDS, templateCatalog, catalogLoadPromise;
var init_substitutionTemplate = __esm({
  "src/substitutionTemplate.js"() {
    init_utils();
    init_parseStudentNumber();
    SLOT_ID_ALIASES = {
      "\u0394v": "delta_v",
      "\u0394t": "delta_t",
      "\u0394E": "delta_E",
      "\u0394\u03B8": "delta_theta",
      "\u03C1": "rho",
      "\u03BB": "lambda"
    };
    LEGACY_ENERGY_SLOT_IDS = /* @__PURE__ */ new Set(["E_k", "E_e", "E_p", "delta_E"]);
    UNIFIED_ENERGY_EQUATION_IDS = /* @__PURE__ */ new Set([
      "kinetic_energy",
      "elastic_potential_energy",
      "gravitational_potential_energy",
      "specific_heat_capacity"
    ]);
    templateCatalog = null;
    catalogLoadPromise = null;
    if (typeof window !== "undefined") {
      catalogLoadPromise = loadCatalogFromUrl().catch(() => {
        catalogLoadPromise = null;
        return {};
      });
    }
  }
});

// src/skillFramework.js
var SKILL_FRAMEWORK_ITEMS, byFullCode, byFramework;
var init_skillFramework = __esm({
  "src/skillFramework.js"() {
    SKILL_FRAMEWORK_ITEMS = [
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
      { framework: "MS", code: "3a", full_code: "MS3a", category: "Algebra", title: "Understand and use symbols (=, <, <<, >>, >, \u221D, ~)", subjects: null, sort_order: 13 },
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
      { framework: "WS", code: "4.6", full_code: "WS4.6", category: "Scientific vocabulary and units", title: "Use an appropriate number of significant figures in calculation", subjects: null, sort_order: 406 }
    ];
    byFullCode = new Map(SKILL_FRAMEWORK_ITEMS.map((s) => [s.full_code, s]));
    byFramework = {
      MS: SKILL_FRAMEWORK_ITEMS.filter((s) => s.framework === "MS"),
      WS: SKILL_FRAMEWORK_ITEMS.filter((s) => s.framework === "WS")
    };
  }
});

// src/skillTagging.js
var init_skillTagging = __esm({
  "src/skillTagging.js"() {
    init_skillFramework();
  }
});

// src/sciencePath.js
function normalizeTier(tier) {
  if (tier === "foundation") return "FT";
  if (tier === "higher") return "HT";
  return tier === "HT" ? "HT" : "FT";
}
function getSciencePath(profile) {
  const path = profile?.science_path;
  return path === "triple" ? "triple" : "combined";
}
function courseTrackForProfile(profile) {
  return getSciencePath(profile);
}
function resolveQuestionSpecMeta(question, profile = null) {
  if (!question) return null;
  const track = profile ? courseTrackForProfile(profile) : "combined";
  if (track === "triple" && question.triple_spec_point) return question.triple_spec_point;
  if (track === "triple" && question.audience === "triple_only" && question.spec_points) {
    return question.spec_points;
  }
  return question.spec_points || question.triple_spec_point || null;
}
var init_sciencePath = __esm({
  "src/sciencePath.js"() {
  }
});

// src/examRules.js
var init_examRules = __esm({
  "src/examRules.js"() {
  }
});

// src/numericQuestionGenerator.js
function slotNumericValue(slots, slotId) {
  const v = slots[slotId];
  if (v == null || v === "") return NaN;
  return parseFloat(v);
}
function resolveSlotUnit(equation, slotId) {
  const eqUnit = equation?.id ? EQUATION_SLOT_UNITS[equation.id]?.[slotId] : null;
  if (eqUnit) return eqUnit;
  if (SUBJECT_UNITS[slotId]) return SUBJECT_UNITS[slotId];
  return "";
}
function identifyResultSlot(template) {
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
  return null;
}
function collectRhsSlots(template) {
  if (template.layout === "fraction") {
    return { numerator: template.numerator || [], denominator: template.denominator || [] };
  }
  const eqIdx = (template.tokens || []).findIndex((t) => t.kind === "op" && t.text === "=");
  const rhs = eqIdx >= 0 ? template.tokens.slice(eqIdx + 1) : template.tokens || [];
  return { tokens: rhs };
}
function evalFractionPart(items, slots) {
  let product = 1;
  let hasValue = false;
  for (const item of items || []) {
    if (item.kind === "slot") {
      const v = slotNumericValue(slots, item.id);
      if (!Number.isFinite(v)) return NaN;
      product *= v;
      hasValue = true;
    } else if (item.kind === "op" && item.text === "1") {
      product *= 1;
      hasValue = true;
    }
  }
  return hasValue ? product : NaN;
}
function evalRhsTokens(tokens, slots) {
  let result = 1;
  let pendingHalf = false;
  let started = false;
  const items = tokens || [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "op") {
      if (item.text === "\xBD" || item.text === "1/2") pendingHalf = true;
      continue;
    }
    if (item.kind !== "slot") continue;
    let v = slotNumericValue(slots, item.id);
    if (!Number.isFinite(v)) return NaN;
    if (pendingHalf) {
      v *= 0.5;
      pendingHalf = false;
    }
    const next = items[i + 1];
    if (next?.kind === "op" && (next.text === "\xB2" || next.text === "^2")) {
      v = v * v;
    }
    if (!started) {
      result = v;
      started = true;
    } else {
      result *= v;
    }
  }
  return started ? result : NaN;
}
function evaluateEquation(equation, slots) {
  const template = getSubstitutionTemplate(equation);
  if (!template) {
    throw new Error(`No substitution template for equation "${equation?.id}"`);
  }
  let answer;
  if (equation.id === "suvat") {
    const u = slotNumericValue(slots, "u");
    const a = slotNumericValue(slots, "a");
    const s = slotNumericValue(slots, "s");
    if (!Number.isFinite(u) || !Number.isFinite(a) || !Number.isFinite(s)) {
      throw new Error(`Cannot evaluate suvat \u2014 missing u, a, or s`);
    }
    const radicand = u * u + 2 * a * s;
    if (radicand < 0) {
      throw new Error(`Cannot evaluate suvat \u2014 negative radicand`);
    }
    answer = Math.sqrt(radicand);
  } else if (template.layout === "fraction") {
    const num = evalFractionPart(template.numerator, slots);
    const den = evalFractionPart(template.denominator, slots);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
      throw new Error(`Cannot evaluate fraction for "${equation.id}"`);
    }
    answer = num / den;
  } else if (template.layout === "product" || template.layout === "sum_product") {
    answer = evalRhsTokens(collectRhsSlots(template).tokens, slots);
  } else {
    throw new Error(`Unsupported template layout "${template.layout}" for "${equation.id}"`);
  }
  if (!Number.isFinite(answer)) {
    throw new Error(`Evaluation failed for "${equation.id}"`);
  }
  const unit = EQUATION_UNITS[equation.id] || "";
  return { answer, unit, resultSlot: identifyResultSlot(template) };
}
function solveForSubject(equation, slots, subject) {
  const template = getSubstitutionTemplate(equation);
  const resultSlot = identifyResultSlot(template);
  const val = (id) => slotNumericValue(slots, id);
  if (equation.id === "suvat") {
    const u = val("u");
    const v = val("v");
    const a = val("a");
    const s = val("s");
    if (subject === "v") {
      if (Number.isFinite(u) && Number.isFinite(a) && Number.isFinite(s)) {
        const radicand = u * u + 2 * a * s;
        if (radicand >= 0) return Math.sqrt(radicand);
      }
    } else if (subject === "u") {
      if (Number.isFinite(v) && Number.isFinite(a) && Number.isFinite(s)) {
        const radicand = v * v - 2 * a * s;
        if (radicand >= 0) return Math.sqrt(radicand);
      }
    } else if (subject === "a") {
      if (Number.isFinite(v) && Number.isFinite(u) && Number.isFinite(s) && s !== 0) {
        return (v * v - u * u) / (2 * s);
      }
    } else if (subject === "s") {
      if (Number.isFinite(v) && Number.isFinite(u) && Number.isFinite(a) && a !== 0) {
        return (v * v - u * u) / (2 * a);
      }
    }
    throw new Error(`Cannot solve for "${subject}" in equation "suvat"`);
  }
  if (subject === resultSlot) {
    return evaluateEquation(equation, slots).answer;
  }
  if (template.layout === "sum_product") {
    const energy = () => val("E") ?? val("E_k") ?? val("E_e") ?? val("E_p");
    if (subject === "v") {
      const Ek = energy();
      const m = val("m");
      if (Number.isFinite(Ek) && Number.isFinite(m) && m > 0) return Math.sqrt(2 * Ek / m);
    }
    if (subject === "m") {
      const Ek = energy();
      const v = val("v");
      if (Number.isFinite(Ek) && Number.isFinite(v) && v > 0) return 2 * Ek / (v * v);
    }
    if (subject === "e") {
      const Ee = energy();
      const k = val("k");
      if (Number.isFinite(Ee) && Number.isFinite(k) && k > 0) return Math.sqrt(2 * Ee / k);
    }
    if (subject === "k") {
      const Ee = energy();
      const e = val("e");
      if (Number.isFinite(Ee) && Number.isFinite(e) && e > 0) return 2 * Ee / (e * e);
    }
    if (subject === "I") {
      const P = val("P");
      const R = val("R");
      if (Number.isFinite(P) && Number.isFinite(R) && R > 0) return Math.sqrt(P / R);
    }
    if (subject === "R") {
      const P = val("P");
      const I = val("I");
      if (Number.isFinite(P) && Number.isFinite(I) && I > 0) return P / (I * I);
    }
  }
  if (equation.id === "transformer") {
    const Vp = val("V_p");
    const Ip = val("I_p");
    const Vs = val("V_s");
    const Is = val("I_s");
    if (subject === "V_s" && Number.isFinite(Vp) && Number.isFinite(Ip) && Number.isFinite(Is) && Is !== 0) {
      return Vp * Ip / Is;
    }
    if (subject === "V_p" && Number.isFinite(Vs) && Number.isFinite(Is) && Number.isFinite(Ip) && Ip !== 0) {
      return Vs * Is / Ip;
    }
    if (subject === "I_p" && Number.isFinite(Vs) && Number.isFinite(Is) && Number.isFinite(Vp) && Vp !== 0) {
      return Vs * Is / Vp;
    }
    if (subject === "I_s" && Number.isFinite(Vp) && Number.isFinite(Ip) && Number.isFinite(Vs) && Vs !== 0) {
      return Vp * Ip / Vs;
    }
  }
  if (equation.id === "transformer_turns") {
    const Vp = val("V_p");
    const Vs = val("V_s");
    const np = val("n_p");
    const ns = val("n_s");
    if (subject === "V_s" && Number.isFinite(Vp) && Number.isFinite(ns) && Number.isFinite(np) && np !== 0) {
      return Vp * ns / np;
    }
    if (subject === "V_p" && Number.isFinite(Vs) && Number.isFinite(np) && Number.isFinite(ns) && ns !== 0) {
      return Vs * np / ns;
    }
    if (subject === "n_p" && Number.isFinite(Vp) && Number.isFinite(ns) && Number.isFinite(Vs) && Vs !== 0) {
      return Vp * ns / Vs;
    }
    if (subject === "n_s" && Number.isFinite(Vs) && Number.isFinite(np) && Number.isFinite(Vp) && Vp !== 0) {
      return Vs * np / Vp;
    }
  }
  if (template.layout === "product") {
    const ids = getSlotIdsFromTemplate(template).filter((id) => id !== resultSlot);
    let res = val(resultSlot);
    if (!Number.isFinite(res)) {
      res = evaluateEquation(equation, slots).answer;
    }
    const others = ids.filter((id) => id !== subject);
    if (others.length === 1) {
      const other = val(others[0]);
      if (Number.isFinite(res) && Number.isFinite(other) && other !== 0) return res / other;
    }
    if (others.length >= 2) {
      let product = 1;
      for (const id of others) {
        const v = val(id);
        if (!Number.isFinite(v) || v === 0) {
          product = NaN;
          break;
        }
        product *= v;
      }
      if (Number.isFinite(product) && product !== 0 && Number.isFinite(res)) {
        return res / product;
      }
    }
  }
  if (template.layout === "fraction") {
    const numSlots = (template.numerator || []).filter((t) => t.kind === "slot").map((t) => t.id);
    const denSlots = (template.denominator || []).filter((t) => t.kind === "slot").map((t) => t.id);
    let res = val(resultSlot);
    if (!Number.isFinite(res)) {
      const num = evalFractionPart(template.numerator, slots);
      const den = evalFractionPart(template.denominator, slots);
      if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) res = num / den;
    }
    if (numSlots.includes(subject)) {
      const den = evalFractionPart(template.denominator, slots);
      const otherNums = numSlots.filter((id) => id !== subject);
      let numOthers = 1;
      for (const id of otherNums) {
        const v = val(id);
        if (!Number.isFinite(v) || v === 0) {
          numOthers = NaN;
          break;
        }
        numOthers *= v;
      }
      if (Number.isFinite(res) && Number.isFinite(den) && Number.isFinite(numOthers) && numOthers !== 0) {
        return res * den / numOthers;
      }
    }
    if (denSlots.includes(subject)) {
      const num = evalFractionPart(template.numerator, slots);
      const otherDens = denSlots.filter((id) => id !== subject);
      let denOthers = 1;
      for (const id of otherDens) {
        const v = val(id);
        if (!Number.isFinite(v) || v === 0) {
          denOthers = NaN;
          break;
        }
        denOthers *= v;
      }
      if (Number.isFinite(res) && Number.isFinite(num) && Number.isFinite(denOthers) && res !== 0 && denOthers !== 0) {
        return num / (res * denOthers);
      }
    }
  }
  throw new Error(`Cannot solve for "${subject}" in equation "${equation.id}"`);
}
function getSubjectUnit(equation, subject) {
  const slotUnit = resolveSlotUnit(equation, subject);
  if (slotUnit) return slotUnit;
  return EQUATION_UNITS[equation.id] || "";
}
var EQUATION_UNITS, SUBJECT_UNITS, EQUATION_SLOT_UNITS, CONVERSION_CATALOG;
var init_numericQuestionGenerator = __esm({
  "src/numericQuestionGenerator.js"() {
    init_substitutionTemplate();
    init_calculationWorkflow();
    init_skillTagging();
    init_sciencePath();
    init_examRules();
    EQUATION_UNITS = {
      kinetic_energy: "J",
      gravitational_potential_energy: "J",
      elastic_potential_energy: "J",
      power: "W",
      power_energy: "W",
      power_work: "W",
      power_vi: "W",
      power_i2r: "W",
      charge: "C",
      potential_difference: "V",
      energy_pt: "J",
      energy_qv: "J",
      weight: "N",
      work_done: "J",
      spring_force: "N",
      force: "N",
      momentum: "kg m/s",
      specific_latent_heat: "J",
      wave_speed: "m/s",
      moment: "Nm",
      force_on_conductor: "N",
      pressure_column: "Pa",
      specific_heat_capacity: "J",
      transformer: "V",
      transformer_turns: "V",
      density: "kg/m\xB3",
      acceleration: "m/s\xB2",
      period: "s",
      pressure: "Pa",
      force_momentum: "N",
      distance_speed: "m",
      frequency: "Hz",
      suvat: "m/s"
    };
    SUBJECT_UNITS = {
      v: "m/s",
      u: "m/s",
      e: "m",
      m: "kg",
      s: "m",
      t: "s",
      I: "A",
      V: "V",
      R: "\u03A9",
      F: "N",
      a: "m/s\xB2",
      delta_v: "m/s",
      f: "Hz",
      lambda: "m",
      P: "W",
      E: "J",
      E_k: "J",
      E_e: "J",
      Q: "C",
      k: "N/m",
      p: "kg m/s",
      rho: "kg/m\xB3",
      W: "N",
      g: "N/kg",
      c: "J/(kg \xB0C)",
      L: "J/kg",
      h: "m",
      l: "m",
      B: "T",
      T: "s",
      E_useful: "J",
      E_in: "J",
      P_useful: "W",
      P_in: "W",
      V_p: "V",
      V_s: "V",
      I_p: "A",
      I_s: "A",
      n_p: "turns",
      n_s: "turns",
      vol: "m\xB3"
    };
    EQUATION_SLOT_UNITS = {
      work_done: { W: "J" },
      power_work: { W: "J" },
      density: { V: "m\xB3", vol: "m\xB3" }
    };
    CONVERSION_CATALOG = [
      { slotPattern: /^(s|h|d|e|lambda|l)$/, fromUnit: "km", toUnit: "m", factor: 1e3 },
      { slotPattern: /^(s|h|d|e|lambda|l)$/, fromUnit: "cm", toUnit: "m", factor: 0.01 },
      { slotPattern: /^(s|h|d|e|lambda|l)$/, fromUnit: "mm", toUnit: "m", factor: 1e-3 },
      { slotPattern: /^(v|u|delta_v)$/, fromUnit: "km/h", toUnit: "m/s", factor: 1e3 / 3600 },
      { slotPattern: /^m$/, fromUnit: "g", toUnit: "kg", factor: 1e-3 },
      { slotPattern: /^m$/, fromUnit: "t", toUnit: "kg", factor: 1e3 },
      { slotPattern: /^t$|^T$/, fromUnit: "min", toUnit: "s", factor: 60 },
      { slotPattern: /^t$|^T$/, fromUnit: "ms", toUnit: "s", factor: 1e-3 },
      { slotPattern: /^I$|^I_p$|^I_s$/, fromUnit: "mA", toUnit: "A", factor: 1e-3 },
      { slotPattern: /^I$|^I_p$|^I_s$/, fromUnit: "\xB5A", toUnit: "A", factor: 1e-6 },
      { slotPattern: /^I$|^I_p$|^I_s$/, fromUnit: "uA", toUnit: "A", factor: 1e-6 },
      { slotPattern: /^V$|^V_p$|^V_s$/, fromUnit: "mV", toUnit: "V", factor: 1e-3 },
      { slotPattern: /^V$|^V_p$|^V_s$/, fromUnit: "kV", toUnit: "V", factor: 1e3 },
      // Density (and other volume slots): V means m³, not volts — matched via toUnit === SI unit.
      { slotPattern: /^V$|^vol$/, fromUnit: "cm\xB3", toUnit: "m\xB3", factor: 1e-6 },
      { slotPattern: /^B$/, fromUnit: "mT", toUnit: "T", factor: 1e-3 },
      { slotPattern: /^B$/, fromUnit: "\xB5T", toUnit: "T", factor: 1e-6 },
      { slotPattern: /^B$/, fromUnit: "uT", toUnit: "T", factor: 1e-6 },
      { slotPattern: /^F$/, fromUnit: "mN", toUnit: "N", factor: 1e-3 },
      { slotPattern: /^F$/, fromUnit: "kN", toUnit: "N", factor: 1e3 },
      { slotPattern: /^P$|^P_useful$|^P_in$/, fromUnit: "kW", toUnit: "W", factor: 1e3 },
      { slotPattern: /^P$|^P_useful$|^P_in$/, fromUnit: "MW", toUnit: "W", factor: 1e6 },
      {
        slotPattern: /^E$|^E_k$|^E_e$|^E_p$|^delta_E$|^W$|^E_useful$|^E_in$/,
        fromUnit: "kJ",
        toUnit: "J",
        factor: 1e3
      },
      {
        slotPattern: /^E$|^E_k$|^E_e$|^E_p$|^delta_E$|^E_useful$|^E_in$/,
        fromUnit: "MJ",
        toUnit: "J",
        factor: 1e6
      },
      { slotPattern: /^efficiency$/, fromUnit: "%", toUnit: "", factor: 0.01 },
      { slotPattern: /^Q$/, fromUnit: "mC", toUnit: "C", factor: 1e-3 },
      { slotPattern: /^k$/, fromUnit: "N/cm", toUnit: "N/m", factor: 100 },
      { slotPattern: /^k$/, fromUnit: "N/mm", toUnit: "N/m", factor: 1e3 }
    ];
  }
});

// src/calculationWorkflow.js
var calculationWorkflow_exports = {};
__export(calculationWorkflow_exports, {
  applyAutoEquationSheet: () => applyAutoEquationSheet,
  applyCalculationPreset: () => applyCalculationPreset,
  applyCalculationStepHighlighting: () => applyCalculationStepHighlighting,
  applyDefaultStepFeedbackToConfig: () => applyDefaultStepFeedbackToConfig,
  buildCalculationConfigForVariant: () => buildCalculationConfigForVariant,
  buildCalculationConfigFromForm: () => buildCalculationConfigFromForm,
  buildDefaultStepFeedback: () => buildDefaultStepFeedback,
  buildNumericFlashcardInsights: () => buildNumericFlashcardInsights,
  buildRemediationStepsFromForm: () => buildRemediationStepsFromForm,
  buildSubstitutionFeedbackContent: () => buildSubstitutionFeedbackContent,
  buildSubstitutionFeedbackText: () => buildSubstitutionFeedbackText,
  buildSubstitutionStepFeedback: () => buildSubstitutionStepFeedback,
  buildWrongEquationFeedback: () => buildWrongEquationFeedback,
  cloneCalculationConfig: () => cloneCalculationConfig,
  collectCalculationResponse: () => collectCalculationResponse,
  computeMaxMarksFromConfig: () => computeMaxMarksFromConfig,
  fillEquationSelectElement: () => fillEquationSelectElement,
  fillEquationSheetSelect: () => fillEquationSheetSelect,
  finalizeCalculationConfigForSave: () => finalizeCalculationConfigForSave,
  formatEquationOptionText: () => formatEquationOptionText,
  getActiveSteps: () => getActiveSteps,
  getCalculationConfig: () => getCalculationConfig,
  getPresentationMode: () => getPresentationMode,
  inferCalculationPreset: () => inferCalculationPreset,
  isSimpleNumericMode: () => isSimpleNumericMode,
  isSimpleNumericModeFromForm: () => isSimpleNumericModeFromForm,
  latexToPlainOptionText: () => latexToPlainOptionText,
  loadEquationSheetCatalog: () => loadEquationSheetCatalog,
  loadEquationSheetForQuestion: () => loadEquationSheetForQuestion,
  loadEquationSheetOptions: () => loadEquationSheetOptions,
  mapEquationSheetIdForCourseTrack: () => mapEquationSheetIdForCourseTrack,
  mapEquationSheetIdForTier: () => mapEquationSheetIdForTier,
  markBalanceFromMassesResponse: () => markBalanceFromMassesResponse,
  markCalculationResponse: () => markCalculationResponse,
  markForStep: () => markForStep,
  markLimitingReactantResponse: () => markLimitingReactantResponse,
  markMolesMassResponse: () => markMolesMassResponse,
  markMultiPathCalculationResponse: () => markMultiPathCalculationResponse,
  markPercentByMassResponse: () => markPercentByMassResponse,
  mergeLegacyNumericMarkPoints: () => mergeLegacyNumericMarkPoints,
  normalizeCalculationConfig: () => normalizeCalculationConfig,
  normalizeSubstitution: () => normalizeSubstitution,
  populateCalculationForm: () => populateCalculationForm,
  populateRemediationSteps: () => populateRemediationSteps,
  questionNeedsEquationSheet: () => questionNeedsEquationSheet,
  readAuthoringContext: () => readAuthoringContext,
  refreshEquationSelect: () => refreshEquationSelect,
  refreshRearrangementSubjectFromForm: () => refreshRearrangementSubjectFromForm,
  refreshStructuredSubstitutionAdmin: () => refreshStructuredSubstitutionAdmin,
  renderCalculationStepSummary: () => renderCalculationStepSummary,
  renderCalculationWorkflow: () => renderCalculationWorkflow,
  resetCalculationAuthoringForm: () => resetCalculationAuthoringForm,
  resolveAnswerDisplayUnit: () => resolveAnswerDisplayUnit,
  resolveConversionEcfState: () => resolveConversionEcfState,
  resolveEquationSheetId: () => resolveEquationSheetId,
  resolveEquationSheetIdForQuestion: () => resolveEquationSheetIdForQuestion,
  resolveMarkingContext: () => resolveMarkingContext,
  resolveWorkflowDerivedAnswer: () => resolveWorkflowDerivedAnswer,
  syncAuthoringStepFeedbackFromForm: () => syncAuthoringStepFeedbackFromForm,
  syncMaxMarksSelect: () => syncMaxMarksSelect,
  updateEquationSelectPreview: () => updateEquationSelectPreview,
  updateNumericAuthoringUi: () => updateNumericAuthoringUi,
  updateRearrangementAuthoringUi: () => updateRearrangementAuthoringUi,
  updateStructuredSubstitutionAuthoringUi: () => updateStructuredSubstitutionAuthoringUi,
  validateCalculationResponse: () => validateCalculationResponse,
  wireCalculationFormToggles: () => wireCalculationFormToggles,
  wireCalculationTabOrder: () => wireCalculationTabOrder,
  wireEquationSelectPreview: () => wireEquationSelectPreview,
  wireMultiPathWorkingReveals: () => wireMultiPathWorkingReveals,
  wireStructuredSubstitutionAuthoring: () => wireStructuredSubstitutionAuthoring,
  wireStudentEquationSelectPreview: () => wireStudentEquationSelectPreview,
  wireStudentNumericInputPreviews: () => wireStudentNumericInputPreviews
});
function markForStep(type, enabled = true) {
  if (!enabled && type !== "calculate") return 0;
  switch (type) {
    case "equation_select":
    case "working_1":
    case "working_2":
      return 0;
    case "substitution":
    case "calculate":
    case "conversion":
    case "rearrangement":
    case "sig_figs":
    case "element_mass":
    case "mass_ratio":
      return enabled ? 1 : 0;
    default:
      return 0;
  }
}
function normalizeCalculationConfig(config) {
  if (!config?.steps?.length) return config;
  return {
    ...config,
    steps: config.steps.map((step) => {
      const explicit = step.marks != null && step.marks !== "" ? Number(step.marks) : null;
      return {
        ...step,
        marks: Number.isFinite(explicit) ? explicit : markForStep(step.type, step.required !== false)
      };
    })
  };
}
function getPresentationMode(sessionMode) {
  return sessionMode === "paper_practice" ? "exam" : "practice";
}
function getCalculationConfig(q) {
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
function getActiveSteps(config) {
  if (config?.marking_mode === "multi_path" || CHEM_HT_MARKING_MODES.has(config?.marking_mode)) {
    return (config.steps || []).filter((s) => s && s.type);
  }
  if (config?.marking_mode === "percent_by_mass") {
    return STEP_ORDER.map((type) => (config.steps || []).find((s) => s.type === type && s.required !== false)).filter(Boolean);
  }
  const steps = config?.steps || [];
  return STEP_ORDER.map((type) => steps.find((s) => s.type === type && s.required !== false)).filter(Boolean);
}
function computeMaxMarksFromConfig(config) {
  if (config?.marking_mode === "multi_path" && Number(config.max_marks) > 0) {
    return Number(config.max_marks);
  }
  if (config?.marking_mode === "percent_by_mass" && Number(config.max_marks) > 0) {
    return Number(config.max_marks);
  }
  if (CHEM_HT_MARKING_MODES.has(config?.marking_mode) && Number(config.max_marks) > 0) {
    return Number(config.max_marks);
  }
  return getActiveSteps(config).reduce((sum, s) => sum + (Number(s.marks) || 0), 0);
}
function isSimpleNumericMode(q, config = null) {
  const steps = getActiveSteps(config ?? getCalculationConfig(q));
  return steps.length === 1 && steps[0]?.type === "calculate";
}
function isSimpleNumericModeFromForm(prefix = "") {
  return isSimpleNumericMode(null, buildCalculationConfigFromForm(prefix));
}
function readStepFeedback(prefix, fieldSuffix) {
  const val = document.getElementById(prefix + fieldSuffix)?.value?.trim();
  return val || void 0;
}
function writeStepFeedback(prefix, fieldSuffix, value) {
  const el = document.getElementById(prefix + fieldSuffix);
  if (el) el.value = value || "";
}
function writeAutoStepFeedback(prefix, fieldSuffix, value) {
  const el = document.getElementById(prefix + fieldSuffix);
  if (!el) return;
  if (!el.value.trim() || el.dataset.autoFeedback === "1") {
    el.dataset.programmaticFeedback = "1";
    el.value = value || "";
    if (value) el.dataset.autoFeedback = "1";
    else delete el.dataset.autoFeedback;
    delete el.dataset.programmaticFeedback;
  }
}
function wireAutoFeedbackInputs(prefix = "") {
  for (const fieldSuffix of Object.values(FEEDBACK_FIELD_BY_TYPE)) {
    const el = document.getElementById(prefix + fieldSuffix);
    if (!el || el.dataset.autoFeedbackWired) continue;
    el.dataset.autoFeedbackWired = "1";
    el.addEventListener("input", () => {
      if (el.dataset.programmaticFeedback) return;
      delete el.dataset.autoFeedback;
    });
  }
}
function firstSlotAnswerValue(vals) {
  if (vals == null) return "";
  const raw = Array.isArray(vals) ? vals[0] : String(vals);
  return String(raw).split("|")[0].trim();
}
function buildSubstitutionFeedbackContent(subStep, equation, ctx = {}) {
  const { convStep, config, slotEdits, promptOverrides } = ctx;
  if (!equation) {
    return { text: "Substitute the correct values from the question." };
  }
  const template = getSubstitutionTemplate(equation);
  if (!template) {
    return { text: "Substitute the correct values from the question." };
  }
  const symbolSlotIds = resolveSymbolSlotIds(template, subStep, config);
  const slots = buildMarkSchemeSubstitutionSlots(template, subStep, { convStep, config });
  for (const id of getSlotIdsFromTemplate(template)) {
    if (symbolSlotIds.has(id)) continue;
    if (convStep?.slot_id === id) {
      if (convStep.answer != null) slots[id] = String(convStep.answer);
      continue;
    }
    if (slotEdits?.[id]) {
      const edit = slotEdits[id];
      slots[id] = edit.isConversionSlot ? edit.si ?? edit.display : edit.display;
    } else if (promptOverrides?.[id]) {
      slots[id] = promptOverrides[id];
    }
  }
  const plainEq = formatSubstitutionEquationDisplay(template, slots, { latex: false });
  const latexEq = formatSubstitutionEquationDisplay(template, slots, { latex: true });
  const slotSummary = formatSubstitutionSlotSummary(template, slots, symbolSlotIds);
  if (!slotSummary && !plainEq) {
    return { text: "Substitute the correct values from the question." };
  }
  return {
    text: slotSummary ? `Substitute ${slotSummary}` : `Substitute ${plainEq}`,
    html: latexEq ? equationPreviewMarkup(latexEq) : ""
  };
}
function buildSubstitutionFeedbackText(subStep, equation, ctx = {}) {
  return buildSubstitutionFeedbackContent(subStep, equation, ctx).text;
}
function buildSubstitutionStepFeedback(studentVal, subStep, equation, ctx = {}) {
  const content = buildSubstitutionFeedbackContent(subStep, equation, ctx);
  if (typeof studentVal !== "object" || studentVal?.mode !== "structured" || !studentVal.slots) {
    return content;
  }
  const template = getSubstitutionTemplate(equation);
  if (!template) return content;
  const symbolSlotIds = resolveSymbolSlotIds(template, subStep, ctx.config);
  const expectedSlots = buildMarkSchemeSubstitutionSlots(template, subStep, ctx);
  const expectedSummary = formatSubstitutionSlotSummary(template, expectedSlots, symbolSlotIds);
  const studentSummary = formatSubstitutionSlotSummary(template, studentVal.slots, symbolSlotIds);
  if (expectedSummary && studentSummary === expectedSummary) {
    return {
      text: "Your substitution looks correct \u2014 check the rearrangement or final calculation step.",
      html: content.html
    };
  }
  if (expectedSummary && studentSummary) {
    return {
      text: `Check substitution \u2014 expected ${expectedSummary}. You entered ${studentSummary}.`,
      html: content.html
    };
  }
  return content;
}
function buildDefaultStepFeedback(step, config, ctx = {}) {
  if (!step?.type) return "";
  const {
    equation,
    equationSheet,
    answer,
    unit = "",
    slotEdits,
    promptOverrides,
    rearrangementSubject
  } = ctx;
  switch (step.type) {
    case "equation_select": {
      const label = findEquationLabel(config, equationSheet, step.answer);
      return `Equation: the correct equation is "${label}".`;
    }
    case "substitution": {
      const convStep = (config?.steps || []).find((s) => s.type === "conversion");
      return buildSubstitutionFeedbackText(step, equation, {
        slotEdits,
        promptOverrides,
        convStep,
        config
      });
    }
    case "conversion": {
      const target = step.answer;
      const label = step.label ? ` (${step.label})` : "";
      if (target == null || target === "") {
        return label ? `Unit conversion: expected value${label}.` : "Unit conversion: check your converted value.";
      }
      return `Unit conversion: expected ${target}${label}.`;
    }
    case "rearrangement":
      return step.answer?.trim() ? `Rearrangement: the correct form is "${step.answer.trim()}".` : "Rearrangement: check your rearranged formula.";
    case "calculate": {
      if (answer == null || !Number.isFinite(Number(answer))) {
        return "Final calculation: check your arithmetic step by step.";
      }
      const formatted = formatAnswerForFeedback(answer);
      return `Final calculation: expected ${formatted}${unit ? ` ${unit}` : ""}.`;
    }
    case "sig_figs": {
      if (answer == null || !Number.isFinite(Number(answer)) || !step.sig_figs) {
        return step.sig_figs ? `Significant figures: give your answer to ${step.sig_figs} s.f.` : "Significant figures: check the required precision.";
      }
      const rounded = roundToSigFigs(Number(answer), step.sig_figs);
      return `Significant figures: expected ${formatAnswerForFeedback(rounded)} (${step.sig_figs} s.f.).`;
    }
    default:
      return "";
  }
}
function applyDefaultStepFeedbackToConfig(config, ctx = {}, { overwrite = false } = {}) {
  if (!config?.steps?.length) return config;
  const cfg = cloneCalculationConfig(config);
  cfg.steps = cfg.steps.map((step) => {
    if (!overwrite && step.feedback_if_wrong?.trim()) return step;
    const text = buildDefaultStepFeedback(step, cfg, ctx);
    return text ? { ...step, feedback_if_wrong: text } : step;
  });
  return cfg;
}
function resolveAuthoringAnswer(prefix, equation, slotAnswers) {
  const ansEl = document.getElementById(prefix === "edit" ? "editNumAns" : "numAnsVal");
  const raw = parseFloat(ansEl?.value);
  if (Number.isFinite(raw)) return raw;
  if (!equation || !slotAnswers || !Object.keys(slotAnswers).length) return null;
  try {
    const slots = {};
    for (const [id, vals] of Object.entries(slotAnswers)) {
      const v = parseFloat(firstSlotAnswerValue(vals));
      if (!Number.isFinite(v)) return null;
      slots[id] = v;
    }
    return evaluateEquation(equation, slots).answer;
  } catch {
    return null;
  }
}
function resolveAuthoringUnit(prefix, equation, slotAnswers) {
  const unitEl = document.getElementById(prefix === "edit" ? "editNumUnit" : "numAnsUnit");
  const unit = unitEl?.value?.trim();
  if (unit) return unit;
  if (!equation || !slotAnswers) return "";
  try {
    const slots = {};
    for (const [id, vals] of Object.entries(slotAnswers)) {
      const v = parseFloat(firstSlotAnswerValue(vals));
      if (!Number.isFinite(v)) return "";
      slots[id] = v;
    }
    return evaluateEquation(equation, slots).unit || "";
  } catch {
    return "";
  }
}
function syncAuthoringStepFeedbackFromForm(prefix = "", supabaseClient = null) {
  if (typeof document === "undefined") return;
  const p = (id) => document.getElementById(prefix + id);
  let config;
  try {
    config = buildCalculationConfigFromForm(prefix);
  } catch {
    return;
  }
  const eqId = p("CalcSubstitutionEquation")?.value?.trim() || p("CalcEquationAnswer")?.value?.trim() || "";
  let equations = getCachedEquationSheetOptions(prefix);
  let equation = equations.find((e) => e.id === eqId || e.label === eqId) || null;
  const sheetId = p("CalcEquationSheet")?.value || "";
  const finish = (eq) => {
    const subStep = config.steps.find((s) => s.type === "substitution");
    const slotAnswers = subStep?.slot_answers || readSlotAnswersFromForm(prefix);
    const answer = resolveAuthoringAnswer(prefix, eq, slotAnswers);
    const unit = resolveAuthoringUnit(prefix, eq, slotAnswers);
    const enriched = applyDefaultStepFeedbackToConfig(config, {
      equation: eq,
      equationSheet: equations.length ? { equations } : null,
      answer,
      unit,
      rearrangementSubject: p("CalcRearrangementSubject")?.value?.trim() || subStep?.rearrangement_subject
    }, { overwrite: false });
    for (const step of enriched.steps || []) {
      const field = FEEDBACK_FIELD_BY_TYPE[step.type];
      if (field && step.feedback_if_wrong) {
        writeAutoStepFeedback(prefix, field, step.feedback_if_wrong);
      }
    }
  };
  if (equation || !sheetId || !supabaseClient) {
    finish(equation);
    return;
  }
  loadEquationSheetOptions(supabaseClient, sheetId).then((loaded) => {
    equations = loaded;
    equation = loaded.find((e) => e.id === eqId || e.label === eqId) || null;
    finish(equation);
  }).catch(() => finish(null));
}
function cloneCalculationConfig(config) {
  if (!config) return null;
  return JSON.parse(JSON.stringify(config));
}
function authoringContextKey(prefix = "") {
  return prefix || "creator";
}
function clearAuthoringContext(prefix = "") {
  authoringContexts[authoringContextKey(prefix)] = {
    questionId: null,
    pendingSlotAnswers: void 0
  };
}
function setAuthoringContext(prefix, questionId, slotAnswers) {
  authoringContexts[authoringContextKey(prefix)] = {
    questionId: questionId ?? null,
    pendingSlotAnswers: slotAnswers === void 0 ? void 0 : cloneCalculationConfig(slotAnswers) || {}
  };
}
function consumePendingSlotAnswers(prefix) {
  const ctx = authoringContexts[authoringContextKey(prefix)];
  if (!ctx || ctx.pendingSlotAnswers === void 0) return null;
  const answers = ctx.pendingSlotAnswers;
  ctx.pendingSlotAnswers = void 0;
  return answers;
}
function resetCalculationFormFields(prefix = "") {
  const p = (id) => document.getElementById(prefix + id);
  clearAuthoringContext(prefix);
  for (const fieldSuffix of Object.values(FEEDBACK_FIELD_BY_TYPE)) {
    writeStepFeedback(prefix, fieldSuffix, "");
  }
  if (p("CalcEquationSheet")) p("CalcEquationSheet").value = "";
  if (p("CalcEquationOverride")) p("CalcEquationOverride").value = "";
  if (p("CalcEquationAnswer")) {
    p("CalcEquationAnswer").value = "";
    delete p("CalcEquationAnswer").dataset.pendingAnswer;
  }
  if (p("CalcEquationDistractors")) p("CalcEquationDistractors").value = "";
  if (p("CalcSubstitutionMode")) p("CalcSubstitutionMode").value = "free_text";
  if (p("CalcSubstitutionEquation")) {
    p("CalcSubstitutionEquation").value = "";
    delete p("CalcSubstitutionEquation").dataset.pendingEquation;
  }
  if (p("CalcSubstitutionSlots")) {
    p("CalcSubstitutionSlots").innerHTML = "";
    delete p("CalcSubstitutionSlots").dataset.pendingAnswers;
  }
  if (p("CalcSubstitutionAccepted")) p("CalcSubstitutionAccepted").value = "";
  if (p("CalcSubstitutionPreview")) p("CalcSubstitutionPreview").innerHTML = "";
  if (p("CalcConversionLabel")) p("CalcConversionLabel").value = "";
  if (p("CalcConversionAnswer")) p("CalcConversionAnswer").value = "";
  if (p("CalcConversionTol")) p("CalcConversionTol").value = "0.001";
  if (p("CalcRearrangeAnswer")) p("CalcRearrangeAnswer").value = "";
  if (p("CalcRearrangeDistractors")) p("CalcRearrangeDistractors").value = "";
  if (p("CalcRearrangementMode")) p("CalcRearrangementMode").value = "numeric";
  if (p("CalcRearrangementSubject")) p("CalcRearrangementSubject").innerHTML = "";
  if (p("CalcRearrangementNumericPreview")) p("CalcRearrangementNumericPreview").textContent = "";
  if (p("CalcSigFigsCount")) p("CalcSigFigsCount").value = "2";
  populateRemediationSteps(prefix, []);
}
function resetCalculationAuthoringForm(prefix = "") {
  resetCalculationFormFields(prefix);
  updateNumericAuthoringUi(prefix);
}
function buildEmptyConfigForPreset(preset) {
  if (preset === "given_equation") {
    return {
      equation_given: true,
      equation_sheet_id: null,
      steps: [
        { type: "substitution", required: true, mode: "free_text" },
        { type: "calculate", required: true }
      ]
    };
  }
  if (preset === "equation_sheet") {
    return {
      equation_given: false,
      steps: [
        { type: "equation_select", required: true, answer: "", distractors: [] },
        { type: "substitution", required: true, mode: "structured" },
        { type: "calculate", required: true }
      ]
    };
  }
  return { equation_given: true, steps: [{ type: "calculate", required: true }] };
}
function mergeLegacyNumericMarkPoints(config, markPoints) {
  if (!markPoints?.length) return config;
  const base = cloneCalculationConfig(config) || { equation_given: true, steps: [{ type: "calculate", required: true }] };
  const cfg = {
    ...base,
    steps: (base.steps || []).map((s) => ({ ...s })),
    remediation_steps: [...base.remediation_steps || []]
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
function buildRemediationStepsFromForm(prefix = "") {
  const wrap = document.getElementById(`${prefix}CalcRemediationWrapper`);
  if (!wrap) return [];
  return Array.from(wrap.querySelectorAll(".calc-rem-row")).map((row) => ({
    ao: row.querySelector(".calc-rem-ao")?.value || "AO2",
    text: row.querySelector(".calc-rem-text")?.value?.trim() || ""
  })).filter((s) => s.text);
}
function populateRemediationSteps(prefix, steps = []) {
  const wrap = document.getElementById(`${prefix}CalcRemediationWrapper`);
  if (!wrap || typeof window.addCalcRemediationRow !== "function") return;
  wrap.innerHTML = "";
  if (window.resetCalcRemediationCounter) window.resetCalcRemediationCounter(prefix);
  for (const step of steps) {
    window.addCalcRemediationRow(prefix, step.ao || "AO2", step.text || "");
  }
}
function updateNumericAuthoringUi(prefix = "", questionType = null) {
  const type = questionType ?? (prefix === "edit" ? document.getElementById("editQuestionType")?.value : document.getElementById("qType")?.value);
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
  const active = document.activeElement;
  const focusedRow = active?.closest?.(`[data-slot-id]`);
  const focusedSlotId = focusedRow?.closest?.(`#${prefix}CalcSubstitutionSlots`) ? focusedRow.dataset.slotId : null;
  const selectionStart = active?.selectionStart;
  const selectionEnd = active?.selectionEnd;
  wrap.innerHTML = slotIds.map((id) => {
    const vals = slotAnswers[id];
    const value = Array.isArray(vals) ? vals.join(" | ") : vals || "";
    const label = slotLabelFromTemplate(template, id);
    return `
      <div class="row" data-slot-id="${escapeHtml(id)}" style="margin-bottom:6px;align-items:center;">
        <label style="min-width:3em;font-weight:600;">${escapeHtml(label)}</label>
        <input type="text" value="${escapeHtml(value)}" placeholder="e.g. 400 or I | i" title="Use | for accepted alternates" style="flex:1;padding:6px;border:1px solid #cbd5e1;border-radius:4px;"/>
      </div>`;
  }).join("");
  if (focusedSlotId) {
    const input = wrap.querySelector(`[data-slot-id="${CSS.escape(focusedSlotId)}"] input`);
    if (input) {
      input.focus();
      if (typeof selectionStart === "number" && typeof selectionEnd === "number") {
        try {
          input.setSelectionRange(selectionStart, selectionEnd);
        } catch (_) {
        }
      }
    }
  }
}
function renderStructuredSubstitutionPreview(prefix, template, slotAnswers) {
  const preview = document.getElementById(`${prefix}CalcSubstitutionPreview`);
  if (!preview) return;
  if (!template) {
    preview.innerHTML = '<span class="muted">Select an equation with a template to preview slot layout.</span>';
    return;
  }
  const p = (id) => document.getElementById(prefix + id);
  const rearrangementActive = !!p("CalcStepRearrangement")?.checked;
  const subject = rearrangementActive ? p("CalcRearrangementSubject")?.value?.trim() : "";
  const previewConfig = rearrangementActive ? { steps: [{ type: "rearrangement", required: true, subject }] } : null;
  preview.innerHTML = renderSubstitutionStepInner(
    { mode: "structured", template, equationId: null },
    "padding:4px;font-size:0.85rem;border:1px solid #94a3b8;border-radius:4px;",
    { config: previewConfig, subStep: subject ? { rearrangement_subject: subject } : null }
  );
}
function populateRearrangementSubjectSelect(prefix, equation, selected = "") {
  const select = document.getElementById(`${prefix}CalcRearrangementSubject`);
  if (!select) return;
  const subjects = equation ? listRearrangementSubjectIds(equation) : [];
  if (!subjects.length) {
    select.innerHTML = '<option value="">\u2014 Select equation first \u2014</option>';
    return;
  }
  const pick = selected && subjects.includes(selected) ? selected : subjects[0];
  select.innerHTML = subjects.map((id) => {
    const sel = id === pick ? " selected" : "";
    return `<option value="${escapeHtml(id)}"${sel}>${escapeHtml(id)}</option>`;
  }).join("");
  if (!selected && pick) select.value = pick;
}
function updateRearrangementAuthoringUi(prefix = "") {
  const p = (id) => document.getElementById(prefix + id);
  const rearrOn = !!p("CalcStepRearrangement")?.checked;
  const subOn = !!p("CalcStepSubstitution")?.checked;
  const structured = (p("CalcSubstitutionMode")?.value || "free_text") === "structured";
  const numericMode = structured && subOn && (p("CalcRearrangementMode")?.value || "numeric") === "numeric";
  p("CalcRearrangementSubjectRow")?.classList.toggle("hidden", !rearrOn);
  p("CalcRearrangementStructuredExtras")?.classList.toggle("hidden", !(rearrOn && structured && subOn));
  p("CalcRearrangementSymbolicRow")?.classList.toggle("hidden", !rearrOn || numericMode);
}
async function refreshRearrangementSubjectFromForm(prefix = "", supabaseClient = null) {
  const p = (id) => document.getElementById(prefix + id);
  updateRearrangementAuthoringUi(prefix);
  if (!p("CalcStepRearrangement")?.checked) return;
  let equations = getCachedEquationSheetOptions(prefix);
  if (!equations.length && supabaseClient) {
    const sheetId = p("CalcEquationSheet")?.value || "";
    if (sheetId) {
      try {
        equations = await loadEquationSheetOptions(supabaseClient, sheetId);
      } catch (_) {
        equations = [];
      }
    }
  }
  const eqId = p("CalcSubstitutionEquation")?.value?.trim() || p("CalcEquationAnswer")?.value?.trim() || "";
  const equation = equations.find((e) => e.id === eqId || e.label === eqId) || null;
  const current = p("CalcRearrangementSubject")?.value?.trim() || equation?.rearrangement_forms?.default_subject || "";
  populateRearrangementSubjectSelect(prefix, equation, current);
}
function updateRearrangementNumericPreview(prefix, equation, subStep, rearrStep) {
  const preview = document.getElementById(`${prefix}CalcRearrangementNumericPreview`);
  if (!preview) return;
  const mode = document.getElementById(`${prefix}CalcRearrangementMode`)?.value || rearrStep?.mode || "symbolic";
  if (mode !== "numeric" || !subStep?.slot_answers) {
    preview.textContent = "";
    return;
  }
  const subject = document.getElementById(`${prefix}CalcRearrangementSubject`)?.value || subStep.rearrangement_subject || rearrStep?.subject;
  const built = buildNumericRearrangementOptions(equation, subStep, { ...rearrStep, subject, mode: "numeric" });
  if (!built.answer) {
    preview.textContent = "Fill slot answers above to preview numeric rearrangement options.";
    return;
  }
  preview.innerHTML = `<strong>Correct:</strong> ${escapeHtml(built.answer)}<br/><strong>Distractors:</strong> ${escapeHtml((built.distractors || []).join(", ") || "\u2014")}`;
}
function updateStructuredSubstitutionAuthoringUi(prefix = "") {
  const p = (id) => document.getElementById(prefix + id);
  const mode = p("CalcSubstitutionMode")?.value || "free_text";
  const structured = mode === "structured";
  p("CalcSubstitutionStructuredPanel")?.classList.toggle("hidden", !structured);
  p("CalcSubstitutionFreeTextPanel")?.classList.toggle("hidden", structured);
  p("CalcSubstitutionEquationRow")?.classList.toggle("hidden", !structured);
  const subOn = !!p("CalcStepSubstitution")?.checked;
  const rearrOn = !!p("CalcStepRearrangement")?.checked;
  p("CalcRearrangementStructuredExtras")?.classList.toggle("hidden", !(structured && subOn && rearrOn));
  updateRearrangementAuthoringUi(prefix);
}
async function refreshStructuredSubstitutionAdmin(supabaseClient, prefix = "") {
  const p = (id) => document.getElementById(prefix + id);
  updateStructuredSubstitutionAuthoringUi(prefix);
  const mode = p("CalcSubstitutionMode")?.value || "free_text";
  if (mode !== "structured") return;
  const sheetId = p("CalcEquationSheet")?.value || "";
  const eqSelect = p("CalcSubstitutionEquation");
  if (!eqSelect) return;
  const equations = sheetId ? await loadEquationSheetOptions(supabaseClient, sheetId) : [];
  const current = eqSelect.value || eqSelect.dataset.pendingEquation || "";
  fillEquationSelectElement(eqSelect, equations, current);
  if (eqSelect.dataset.pendingEquation) delete eqSelect.dataset.pendingEquation;
  const eqId = eqSelect.value || p("CalcEquationAnswer")?.value || "";
  const equation = equations.find((e) => e.id === eqId || e.label === eqId) || null;
  const template = getSubstitutionTemplate(equation);
  let slotAnswers = consumePendingSlotAnswers(prefix);
  if (slotAnswers === null) {
    slotAnswers = readSlotAnswersFromForm(prefix);
  }
  renderSubstitutionSlotRows(prefix, template, slotAnswers);
  renderStructuredSubstitutionPreview(prefix, template, slotAnswers);
  populateRearrangementSubjectSelect(
    prefix,
    equation,
    p("CalcRearrangementSubject")?.value || equation?.rearrangement_forms?.default_subject || ""
  );
  const subStep = { slot_answers: readSlotAnswersFromForm(prefix), rearrangement_subject: p("CalcRearrangementSubject")?.value };
  const rearrStep = { mode: p("CalcRearrangementMode")?.value || "numeric", subject: p("CalcRearrangementSubject")?.value };
  updateRearrangementNumericPreview(prefix, equation, subStep, rearrStep);
  syncAuthoringStepFeedbackFromForm(prefix, supabaseClient);
}
function getCachedEquationSheetOptions(prefix = "") {
  if (typeof window === "undefined") return [];
  const cacheKey = prefix || "creator";
  const cached = window._calcEquationOptions?.[cacheKey];
  return Array.isArray(cached) ? cached : [];
}
function updateStructuredSubstitutionDerivedUi(prefix = "", supabaseClient = null) {
  const p = (id) => document.getElementById(prefix + id);
  const mode = p("CalcSubstitutionMode")?.value || "free_text";
  if (mode !== "structured") return;
  const eqId = p("CalcSubstitutionEquation")?.value || p("CalcEquationAnswer")?.value || "";
  if (!eqId) return;
  let equations = getCachedEquationSheetOptions(prefix);
  if (!equations.length && supabaseClient) {
    const sheetId = p("CalcEquationSheet")?.value || "";
    if (!sheetId) return;
    loadEquationSheetOptions(supabaseClient, sheetId).then((loaded) => {
      const equation2 = loaded.find((e) => e.id === eqId || e.label === eqId) || null;
      if (!equation2) return;
      const slotAnswers2 = readSlotAnswersFromForm(prefix);
      const subStep2 = {
        slot_answers: slotAnswers2,
        rearrangement_subject: p("CalcRearrangementSubject")?.value
      };
      const rearrStep2 = {
        mode: p("CalcRearrangementMode")?.value || "numeric",
        subject: p("CalcRearrangementSubject")?.value
      };
      updateRearrangementNumericPreview(prefix, equation2, subStep2, rearrStep2);
      syncAuthoringStepFeedbackFromForm(prefix, supabaseClient);
    }).catch(() => {
    });
    return;
  }
  const equation = equations.find((e) => e.id === eqId || e.label === eqId) || null;
  if (!equation) return;
  const slotAnswers = readSlotAnswersFromForm(prefix);
  const subStep = {
    slot_answers: slotAnswers,
    rearrangement_subject: p("CalcRearrangementSubject")?.value
  };
  const rearrStep = {
    mode: p("CalcRearrangementMode")?.value || "numeric",
    subject: p("CalcRearrangementSubject")?.value
  };
  updateRearrangementNumericPreview(prefix, equation, subStep, rearrStep);
  syncAuthoringStepFeedbackFromForm(prefix, supabaseClient);
}
function wireStructuredSubstitutionAuthoring(prefix = "", supabaseClient, onChange) {
  const ids = [
    "CalcSubstitutionMode",
    "CalcSubstitutionEquation",
    "CalcRearrangementMode",
    "CalcRearrangementSubject",
    "CalcStepRearrangement",
    "CalcEquationAnswer"
  ];
  for (const id of ids) {
    const el = document.getElementById(prefix + id);
    el?.addEventListener("change", async () => {
      if (id === "CalcStepRearrangement" || id === "CalcRearrangementSubject" || id === "CalcEquationAnswer") {
        await refreshRearrangementSubjectFromForm(prefix, supabaseClient);
      }
      await refreshStructuredSubstitutionAdmin(supabaseClient, prefix);
    });
  }
  const slotsWrap = document.getElementById(`${prefix}CalcSubstitutionSlots`);
  slotsWrap?.addEventListener("input", () => {
    updateStructuredSubstitutionDerivedUi(prefix, supabaseClient);
  });
}
async function loadEquationSheetOptions(supabaseClient, sheetId) {
  if (!sheetId || !supabaseClient) return [];
  await initSubstitutionTemplateCatalog();
  const { data, error } = await supabaseClient.from("equation_sheets").select("equations").eq("id", sheetId).maybeSingle();
  if (error || !data?.equations) return [];
  const equations = Array.isArray(data.equations) ? data.equations : [];
  return enrichEquationSheet({ equations }).equations;
}
function questionNeedsEquationSheet(q) {
  const cfg = getCalculationConfig(q);
  const steps = getActiveSteps(cfg);
  if (steps.some((s) => s.type === "equation_select")) return true;
  if (cfg.equation_given === false) return true;
  return steps.some((s) => s.type === "substitution" && isStructuredSubstitutionStep(s));
}
async function loadEquationSheetForQuestion(supabaseClient, q, profile = null, { sessionTier = null } = {}) {
  if (!supabaseClient || !q) return null;
  const cfg = getCalculationConfig(q);
  if (!questionNeedsEquationSheet(q)) return null;
  let sheetId = resolveEquationSheetIdForQuestion(q, profile, { sessionTier });
  if (!sheetId && cfg.equation_sheet_id) {
    sheetId = cfg.equation_sheet_id;
  }
  if (!sheetId) return null;
  await initSubstitutionTemplateCatalog();
  const { data, error } = await supabaseClient.from("equation_sheets").select("id, title, equations").eq("id", sheetId).maybeSingle();
  if (error || !data) {
    console.warn("loadEquationSheetForQuestion:", error);
    return null;
  }
  return enrichEquationSheet(data);
}
function latexToPlainOptionText(latex) {
  if (!latex) return "";
  let s = String(latex).trim();
  s = s.replace(/\\text\{([^}]*)\}/g, "$1");
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1/$2");
  s = s.replace(/\\Delta/g, "\u0394");
  s = s.replace(/\\theta/g, "\u03B8");
  s = s.replace(/\\rho/g, "\u03C1");
  s = s.replace(/\\lambda/g, "\u03BB");
  s = s.replace(/\^\{?2\}?/g, "\xB2");
  s = s.replace(/\\times/g, "\xD7");
  s = s.replace(/\\cdot/g, "\xB7");
  s = s.replace(/[{}\\]/g, "");
  s = s.replace(/_/g, "");
  s = s.replace(/\s+/g, " ");
  return s.trim();
}
function formatEquationOptionText(eq) {
  const label = eq.label || eq.id || "";
  const plain = latexToPlainOptionText(eq.latex || "");
  if (!plain || plain === label) return label;
  return `${label} \u2014 ${plain}`;
}
function equationPreviewMarkup(latex) {
  if (!latex) return "";
  return `<span class="calc-eq-latex">$${latex}$</span>`;
}
function resolveMarkingContext(config, resp, equationSheet, steps) {
  const subStep = steps.find((s) => s.type === "substitution");
  const eqSelectStep = steps.find((s) => s.type === "equation_select");
  const markSchemeEqId = resolveMarkSchemeEquationId(config, subStep);
  const subPayload = resp?.steps?.substitution;
  const selectedEqId = resp?.steps?.equation_select || typeof subPayload === "object" && subPayload?.equation_id || subStep?.equation_id || markSchemeEqId;
  if (!eqSelectStep) {
    const markSchemeEquation = findEquationInSheet(equationSheet, markSchemeEqId);
    return {
      hasEquationSelect: false,
      equationCorrect: true,
      markSchemeEqId,
      selectedEqId,
      markSchemeEquation,
      selectedEquation: findEquationInSheet(equationSheet, selectedEqId)
    };
  }
  const equationCorrect = equationSelectionMatches(
    resp?.steps?.equation_select,
    eqSelectStep,
    config,
    equationSheet
  );
  return {
    hasEquationSelect: true,
    equationCorrect,
    markSchemeEqId,
    selectedEqId,
    markSchemeEquation: findEquationInSheet(equationSheet, markSchemeEqId),
    selectedEquation: findEquationInSheet(equationSheet, selectedEqId)
  };
}
function buildWrongEquationFeedback(markSchemeEquation, cleanUrl, steps, markPoints, stepResults = {}) {
  const items = [];
  const eqStep = steps.find((s) => s.type === "equation_select");
  const latex = markSchemeEquation?.latex || "";
  const plainEquation = latexToPlainOptionText(latex) || markSchemeEquation?.label || markSchemeEquation?.id || "";
  if (eqStep) {
    items.push({
      ao: eqStep.ao || "AO1",
      stepType: "equation_select",
      text: plainEquation ? `The correct equation is: ${plainEquation}` : "The correct equation is:",
      html: latex ? equationPreviewMarkup(latex) : "",
      url: cleanUrl
    });
  }
  const convStep = steps.find((s) => s.type === "conversion");
  const subStep = steps.find((s) => s.type === "substitution");
  if (subStep && (Number(subStep.marks) || 0) > 0 && !stepResults.substitution?.correct) {
    const subFb = buildSubstitutionFeedbackContent(subStep, markSchemeEquation, {
      convStep,
      config: { steps }
    });
    const subText = getStepFeedback(
      subStep,
      markPoints,
      "substitution",
      subFb.text,
      { steps }
    );
    items.push({
      ao: subStep.ao || "AO2",
      stepType: "substitution",
      text: subText,
      html: subText === subFb.text ? subFb.html : "",
      url: cleanUrl
    });
  }
  const rearrStep = steps.find((s) => s.type === "rearrangement");
  if (rearrStep && (Number(rearrStep.marks) || 0) > 0 && !stepResults.rearrangement?.correct) {
    items.push({
      ao: rearrStep.ao || "AO2",
      stepType: "rearrangement",
      text: getStepFeedback(
        rearrStep,
        markPoints,
        "rearrangement",
        "Rearrangement: wrong variables used."
      ),
      url: cleanUrl
    });
  }
  const calcStep = steps.find((s) => s.type === "calculate");
  if (calcStep && (Number(calcStep.marks) || 0) > 0 && !stepResults.calculate?.correct) {
    items.push({
      ao: calcStep.ao || "AO2",
      stepType: "calculate",
      text: getStepFeedback(
        calcStep,
        markPoints,
        "calculate",
        "Answer: check you used the correct equation."
      ),
      url: cleanUrl
    });
  }
  return items;
}
function updateEquationSelectPreview(selectEl, previewEl, equations) {
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
function wireEquationSelectPreview(selectEl, previewEl, equations, onTypeset) {
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
function wireStudentEquationSelectPreview(onTypeset, q = null, equationSheet = null) {
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
    if (rearrStep?.mode === "numeric" && subStep) {
      refreshRearrangementFromStudentSlots(config, equationSheet, subStep, rearrStep);
    }
  };
  const refreshRearrangementOnly = () => {
    if (!q) return;
    const config = enrichCalculationConfigFromEquationSheet(getCalculationConfig(q), equationSheet);
    const steps = getActiveSteps(config);
    const subStep = steps.find((s) => s.type === "substitution");
    const rearrStep = steps.find((s) => s.type === "rearrangement");
    if (rearrStep?.mode === "numeric" && subStep) {
      refreshRearrangementFromStudentSlots(config, equationSheet, subStep, rearrStep);
    }
  };
  if (!select || !preview) {
    rerenderStructuredSteps();
    wireSubstitutionSlotInputListener(refreshRearrangementOnly);
    wireConversionInputListener(refreshRearrangementOnly);
    wireStudentNumericInputPreviews(onTypeset, q);
    wireMultiPathWorkingReveals(q);
    wireCalculationTabOrder();
    return;
  }
  const equations = Array.from(select.options).filter((opt) => opt.value).map((opt) => ({
    id: opt.value,
    label: opt.textContent.split(" \u2014 ")[0] || opt.value,
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
  wireSubstitutionSlotInputListener(refreshRearrangementOnly);
  wireConversionInputListener(refreshRearrangementOnly);
  wireStudentNumericInputPreviews(onTypeset, q);
  wireMultiPathWorkingReveals(q);
  wireCalculationTabOrder();
  rerenderStructuredSteps();
}
function wireSubstitutionSlotInputListener(onInput, root = null) {
  const panel = root || resolveCalculationWorkflowRoot() || document;
  if (typeof onInput !== "function") return;
  if (panel._calcSubSlotHandler) {
    panel.removeEventListener("input", panel._calcSubSlotHandler);
  }
  panel._calcSubSlotHandler = (e) => {
    if (e.target?.classList?.contains("calc-sub-slot")) onInput();
  };
  panel.addEventListener("input", panel._calcSubSlotHandler);
}
function wireConversionInputListener(onInput) {
  const convEl = document.getElementById("calc_conversion");
  if (!convEl || typeof onInput !== "function") return;
  if (convEl._calcConvHandler) {
    convEl.removeEventListener("input", convEl._calcConvHandler);
  }
  convEl._calcConvHandler = () => onInput();
  convEl.addEventListener("input", convEl._calcConvHandler);
}
function fillEquationSelectElement(selectEl, equations, selectedId = "") {
  if (!selectEl) return;
  const opts = ['<option value="">\u2014 Select correct equation \u2014</option>'];
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
async function refreshEquationSelect(supabaseClient, prefix = "", selectedId = "") {
  const p = (id) => document.getElementById(prefix + id);
  const sheetId = p("CalcEquationSheet")?.value || "";
  const select = p("CalcEquationAnswer");
  if (!select) return [];
  if (!sheetId) {
    select.innerHTML = '<option value="">\u2014 Select an equation sheet above \u2014</option>';
    return [];
  }
  const equations = await loadEquationSheetOptions(supabaseClient, sheetId);
  fillEquationSelectElement(select, equations, selectedId || select.value);
  const preview = p("CalcEquationAnswerPreview");
  wireEquationSelectPreview(select, preview, equations, () => {
    if (typeof window !== "undefined" && window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise().catch(() => {
      });
    }
  });
  return equations;
}
function syncMaxMarksSelect(prefix = "") {
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
    maxMarksRow.title = isCreator && qTypeEl?.value === "numeric" ? "Updates automatically when calculation steps change; override if needed." : "";
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
function inferCalculationPreset(demandLevel) {
  return ["low", "standard"].includes(demandLevel) ? "given_equation" : "equation_sheet";
}
function resolveEquationSheetId({ subject, paper, tier, courseTrack = "combined" }) {
  if (subject !== "physics") return null;
  const paperKey = paper === "paper1" ? "p1" : paper === "paper2" ? "p2" : null;
  if (!paperKey) return null;
  const t = String(tier || "").toLowerCase();
  const tierKey = t === "higher" || t === "ht" ? "ht" : "ft";
  const prefix = courseTrack === "triple" ? "triple_" : "";
  return `${prefix}physics_${paperKey}_${tierKey}`;
}
function mapEquationSheetIdForCourseTrack(sheetId, courseTrack = "combined") {
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
function mapEquationSheetIdForTier(sheetId, tier) {
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
function resolveEquationSheetIdForQuestion(q, profile, { courseTrack = null, sessionTier = null } = {}) {
  const cfg = getCalculationConfig(q);
  const subStep = getActiveSteps(cfg).find((s) => s.type === "substitution");
  const needsStructuredSheet = isStructuredSubstitutionStep(subStep);
  if (cfg.equation_given !== false) {
    return needsStructuredSheet ? cfg.equation_sheet_id || null : null;
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
function readAuthoringContext(prefix = "") {
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
async function loadEquationSheetCatalog(supabaseClient, subject = null, courseTrack = null) {
  if (!supabaseClient) return [];
  let query = supabaseClient.from("equation_sheets").select("id, subject, title, tier, paper, exam_series, course_track").order("id");
  if (subject) query = query.eq("subject", subject);
  if (courseTrack) query = query.eq("course_track", courseTrack);
  const { data, error } = await query;
  if (error) {
    console.warn("loadEquationSheetCatalog:", error);
    return [];
  }
  return data || [];
}
function fillEquationSheetSelect(selectEl, sheets, selectedId = "") {
  if (!selectEl) return;
  const opts = ['<option value="">\u2014 None \u2014</option>'];
  for (const row of sheets) {
    const id = row.id || "";
    const label = row.title || id;
    if (!id) continue;
    const sel = id === selectedId ? " selected" : "";
    opts.push(`<option value="${escapeHtml(id)}"${sel}>${escapeHtml(label)}</option>`);
  }
  selectEl.innerHTML = opts.join("");
}
function applyAutoEquationSheet(prefix, context = null) {
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
  if (step?.label && (type === "element_mass" || type === "mass_ratio" || type === "insert_values" || type === "mole_table" || type === "mole_ratio" || type === "limiting_select" || type === "balance_coeffs" || type === "working_1" || type === "working_2" || type === "calculate")) {
    return step.label;
  }
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
      options = step.distractors.map(
        (d) => typeof d === "string" ? { id: d, label: d, latex: d } : d
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
  return options.find(
    (eq) => eq.id === needle || eq.label === needle || String(eq.id || "").toLowerCase() === lower || String(eq.label || "").toLowerCase() === lower
  ) || null;
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
  return resolveEquationCanonicalId(studentVal, config, equationSheet) === resolveEquationCanonicalId(target, config, equationSheet);
}
function renderEquationSheetPanel(config, equationSheet, presentation) {
  if (config.equation_given || !equationSheet?.equations?.length) return "";
  const equations = equationSheet.equations;
  const isExam = presentation === "exam";
  const openAttr = isExam ? " open" : "";
  return `
    <details class="calc-equation-sheet"${openAttr} style="margin-top:12px; border:1px solid #cbd5e1; border-radius:8px; padding:10px 14px; background:#fff;">
      <summary style="font-weight:700; font-size:0.85rem; cursor:pointer; color:var(--primary, #4a90e2);">
        Equation sheet \u2014 ${escapeHtml(equationSheet.title || "Reference")}
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
function resolveExpectedRearrangementAnswer(step, config, steps, resp, equationSheet, conversionEcf = null) {
  const subStep = steps.find((s) => s.type === "substitution");
  if (!subStep?.slot_answers || !equationSheet) return step.answer || "";
  const isNumeric = step.mode === "numeric" || isStructuredSubstitutionStep(subStep) && step.mode !== "symbolic";
  if (!isNumeric) return step.answer || "";
  const subPayload = resp?.steps?.substitution;
  const selectedEq = typeof subPayload === "object" && subPayload?.equation_id || resp?.steps?.equation_select || subStep.equation_id;
  const markSchemeEq = resolveMarkSchemeEquationId(config, subStep);
  const eq = findEquationInSheet(equationSheet, markSchemeEq || selectedEq);
  if (!eq) return step.answer || "";
  const convStep = steps.find((s) => s.type === "conversion");
  const studentSlots = typeof subPayload === "object" ? subPayload?.slots : null;
  const siSlots = buildSiSlotAnswersForRearrangement(
    subStep,
    convStep,
    resp,
    studentSlots,
    conversionEcf
  );
  const built = buildNumericRearrangementOptions(eq, subStep, step, { siSlotAnswers: siSlots });
  return built.answer || step.answer || "";
}
function resolveConversionEcfState(steps, resp) {
  const convStep = steps.find((s) => s.type === "conversion");
  if (!convStep) return null;
  const studentVal = parseFloat(resp?.steps?.conversion);
  const target = parseFloat(convStep.answer);
  const tol = parseFloat(convStep.tolerance ?? 1e-3);
  if (!Number.isFinite(studentVal) || !Number.isFinite(target) || target === 0) return null;
  if (Math.abs(studentVal - target) <= tol) return null;
  return {
    ratio: studentVal / target,
    studentVal,
    target,
    slotId: convStep.slot_id || null,
    tol
  };
}
function buildConversionEcfNotice(stepType, conversionEcf) {
  const valueText = conversionEcf?.studentVal != null ? `your converted value of ${conversionEcf.studentVal}` : "your conversion";
  return `Error Carried Forward (ECF): ${stepType} marked correct using ${valueText}.`;
}
function resolveWorkflowDerivedAnswer(config, steps, resp, equationSheet, conversionEcf = null) {
  const subStep = steps.find((s) => s.type === "substitution");
  if (!subStep?.slot_answers || !equationSheet) return null;
  const markSchemeEqId = resolveMarkSchemeEquationId(config, subStep);
  const subPayload = resp?.steps?.substitution;
  const eqId = markSchemeEqId || typeof subPayload === "object" && subPayload?.equation_id || subStep.equation_id;
  const equation = findEquationInSheet(equationSheet, eqId);
  if (!equation) return null;
  const convStep = steps.find((s) => s.type === "conversion");
  const studentSlots = typeof subPayload === "object" ? subPayload?.slots : null;
  const siSlots = buildSiSlotAnswersForRearrangement(
    subStep,
    convStep,
    resp,
    studentSlots,
    conversionEcf
  );
  const slots = {};
  for (const [id, val] of Object.entries(siSlots)) {
    const n = parseFloat(val);
    if (Number.isFinite(n)) slots[id] = n;
  }
  try {
    const subject = subStep.rearrangement_subject;
    if (subject) return solveForSubject(equation, slots, subject);
    return evaluateEquation(equation, slots).answer;
  } catch {
    return null;
  }
}
function formatAnswerForFeedback(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  const abs = Math.abs(n);
  if (abs >= 1e4 || abs > 0 && abs < 1e-3) {
    const exp = Math.floor(Math.log10(abs));
    const mant = n / 10 ** exp;
    return `${parseFloat(mant.toPrecision(4))} \xD7 10^${exp}`;
  }
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toPrecision(6)));
}
function rearrangementAnswerMatches(studentVal, expectedAnswer) {
  return rearrangementStructurallyMatches(studentVal, expectedAnswer);
}
function getRearrangementChoices(step) {
  const answer = (step.answer || "").trim();
  const distractors = step.distractors || [];
  const combined = answer ? [answer, ...distractors] : [...distractors];
  const seen = /* @__PURE__ */ new Set();
  return combined.filter((item) => {
    const key = String(item).trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function formatStepMarksBadge(step, marksOverride = null) {
  const marks = marksOverride != null ? Number(marksOverride) : Number(step.marks) || 0;
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
function renderInsertValuesStep(numberedLabel, step) {
  const lhs = escapeHtml(step.lhs || (step.op === "mul" ? "m" : "n"));
  const useSf = !!step.standard_form;
  const bare = { placeholder: "", hidePreview: !useSf, requiresStandardForm: useSf };
  const labelHtml = `<label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:8px;">${renderStepLabel(numberedLabel, step)}</label>`;
  if (step.op === "div") {
    return `
    <div class="calc-step" data-step="insert_values" style="margin-bottom:12px;">
      ${labelHtml}
      <div style="display:inline-flex;align-items:center;gap:12px;">
        <span style="font-weight:700;color:#334155;">${lhs} =</span>
        <div style="display:inline-flex;flex-direction:column;align-items:stretch;min-width:8rem;">
          ${renderNumericInputField("calc_insert_left", bare)}
          <div aria-hidden="true" style="border-top:2px solid #334155;margin:6px 0;"></div>
          ${renderNumericInputField("calc_insert_right", bare)}
        </div>
      </div>
    </div>`;
  }
  return `
    <div class="calc-step" data-step="insert_values" style="margin-bottom:12px;">
      ${labelHtml}
      <div style="display:inline-flex;align-items:center;gap:8px;flex-wrap:nowrap;">
        <span style="font-weight:700;color:#334155;line-height:1;">${lhs} =</span>
        ${renderNumericInputField("calc_insert_left", bare)}
        <span style="font-weight:700;color:#475569;line-height:1;font-size:1.1rem;">\xD7</span>
        ${renderNumericInputField("calc_insert_right", bare)}
      </div>
    </div>`;
}
function renderMoleTableStep(numberedLabel, step) {
  const rows = (step.species || []).map((sp, i) => {
    const label = escapeHtml(sp.name ? `${sp.name} (${sp.formula})` : sp.formula || sp.id || `species ${i + 1}`);
    return `
      <tr>
        <td style="padding:4px 10px 4px 0;font-size:0.85rem;">${label}</td>
        <td style="padding:4px 0;">${renderNumericInputField(`calc_mole_table_${i}`, { placeholder: "mol" })}</td>
      </tr>`;
  }).join("");
  return `
    <div class="calc-step" data-step="mole_table" style="margin-bottom:12px;">
      <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${renderStepLabel(numberedLabel, step)}:</label>
      <table style="border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;font-size:0.75rem;color:#64748b;font-weight:600;padding:0 10px 4px 0;">Substance</th>
            <th style="text-align:left;font-size:0.75rem;color:#64748b;font-weight:600;padding:0 0 4px;">Moles</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
function renderMoleRatioStep(numberedLabel, step) {
  const leftLabel = escapeHtml(
    step.left?.name ? `${step.left.name} (${step.left.formula})` : step.left?.formula || "A"
  );
  const rightLabel = escapeHtml(
    step.right?.name ? `${step.right.name} (${step.right.formula})` : step.right?.formula || "B"
  );
  const col = (label, inputId) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;min-width:7.5rem;">
      <span style="font-size:0.82rem;font-weight:700;text-align:center;line-height:1.25;">${label}</span>
      ${renderNumericInputField(inputId, { placeholder: "", hidePreview: true })}
    </div>`;
  return `
    <div class="calc-step" data-step="mole_ratio" style="margin-bottom:12px;">
      <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:8px;">${renderStepLabel(numberedLabel, step)}:</label>
      <div style="display:inline-flex;align-items:flex-end;gap:14px;">
        ${col(leftLabel, "calc_mole_ratio_left")}
        <span style="font-weight:800;font-size:1.45rem;color:#334155;line-height:2.2rem;padding-bottom:2px;">:</span>
        ${col(rightLabel, "calc_mole_ratio_right")}
      </div>
    </div>
  `;
}
function renderLimitingSelectStep(numberedLabel, step) {
  const options = (step.options || []).map((opt) => {
    const id = escapeHtml(opt.id);
    const label = escapeHtml(opt.label || opt.name || opt.id);
    return `
      <label style="display:flex;align-items:center;gap:6px;font-size:0.9rem;margin-right:12px;">
        <input type="radio" name="calc_limiting_select" value="${id}" />
        <span>${label}</span>
      </label>`;
  }).join("");
  return `
    <div class="calc-step" data-step="limiting_select" style="margin-bottom:12px;">
      <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${renderStepLabel(numberedLabel, step)}:</label>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">${options}</div>
    </div>
  `;
}
function renderBalanceCoeffsStep(numberedLabel, step) {
  const species = step.species || [];
  const coeffStyle = "width:2.4rem;min-width:2.4rem;padding:4px;border:2px solid #2563eb;border-radius:4px;text-align:center;font-weight:700;font-size:0.95rem;";
  const parts = [];
  species.forEach((sp, i) => {
    const prev = species[i - 1];
    if (i > 0 && prev && stoichSide(sp) !== stoichSide(prev)) {
      parts.push(`<span style="font-weight:700;padding:0 6px;">\u2192</span>`);
    } else if (i > 0) {
      parts.push(`<span style="font-weight:700;padding:0 6px;">+</span>`);
    }
    const formula = escapeHtml(sp.formula || sp.id || "");
    parts.push(`
      <span style="display:inline-flex;align-items:center;gap:4px;white-space:nowrap;">
        <input id="calc_coeff_${i}" type="text" inputmode="numeric" class="calc-numeric-input" data-preview-for="calc_coeff_${i}_preview"
          placeholder="1" aria-label="Coefficient for ${formula}"
          style="${coeffStyle}" />
        <span style="font-weight:700;">${formula}</span>
      </span>
    `);
  });
  return `
    <div class="calc-step" data-step="balance_coeffs" style="margin-bottom:12px;">
      <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${renderStepLabel(numberedLabel, step)}:</label>
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:4px;font-size:1.05rem;">${parts.join("")}</div>
    </div>
  `;
}
function stoichSide(sp) {
  const s = String(sp?.side || "");
  if (s === "left" || s === "reactant") return "left";
  return "right";
}
function renderNumericInputField(id, { requiresStandardForm = false, placeholder = null, hidePreview = false } = {}) {
  const ph = placeholder === "" || placeholder === false ? "" : placeholder != null ? placeholder : numericInputPlaceholder(requiresStandardForm);
  const preview = hidePreview ? "" : `<span id="${id}_preview" class="calc-numeric-preview" aria-live="polite" tabindex="-1"
        style="font-size:0.82rem;color:#64748b;min-height:1.15em;padding:0 2px;min-width:100%;width:max-content;max-width:32ch;overflow:visible;white-space:nowrap;line-height:1.3;"></span>`;
  return `
    <div class="calc-numeric-input-wrap" style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px;">
      <input id="${id}" type="text" inputmode="decimal" autocomplete="off" spellcheck="false"
        class="calc-numeric-input" ${hidePreview ? "" : `data-preview-for="${id}_preview"`}
        placeholder="${escapeHtml(ph)}"
        style="${studentNumericInputStyle(inputStyle())}"/>
      ${preview}
    </div>
  `;
}
function updateNumericPreview(inputEl, previewEl, onTypeset) {
  if (!inputEl || !previewEl) return;
  const latex = formatNumberLatexPreview(inputEl.value);
  if (!latex) {
    previewEl.textContent = "";
    previewEl.innerHTML = "";
    return;
  }
  previewEl.innerHTML = `$${latex}$`;
  onTypeset?.(previewEl);
  previewEl.setAttribute("tabindex", "-1");
  const normalizeMjx = () => {
    previewEl.querySelectorAll("mjx-container").forEach((el) => {
      el.style.overflow = "visible";
      el.style.maxWidth = "none";
      el.setAttribute("tabindex", "-1");
    });
  };
  setTimeout(normalizeMjx, 100);
  setTimeout(normalizeMjx, 300);
}
function wireStudentNumericInputPreviews(onTypeset, q = null) {
  const requiresStandardForm = promptRequiresStandardForm(q?.prompt);
  const inputs = document.querySelectorAll(".calc-numeric-input");
  for (const input of inputs) {
    const previewId = input.dataset.previewFor;
    const preview = previewId ? document.getElementById(previewId) : null;
    if (!preview) continue;
    if (requiresStandardForm && !input.placeholder.includes("\xD710")) {
      input.placeholder = numericInputPlaceholder(true);
    }
    const refresh = () => updateNumericPreview(input, preview, onTypeset);
    if (input._calcNumericPreviewHandler) {
      input.removeEventListener("input", input._calcNumericPreviewHandler);
    }
    input._calcNumericPreviewHandler = refresh;
    input.addEventListener("input", refresh);
    refresh();
  }
}
function calculationTabStops(root) {
  const scope = root || document;
  const nodes = [...scope.querySelectorAll(
    "input.calc-numeric-input, input.calc-sub-slot, #calc_equation_select, #calc_rearrangement, input[name='calc_limiting_select']"
  )];
  const seenRadio = /* @__PURE__ */ new Set();
  const stops = [];
  for (const el of nodes) {
    if (el.disabled || el.getAttribute("tabindex") === "-1") continue;
    if (el.type === "radio") {
      if (seenRadio.has(el.name)) continue;
      seenRadio.add(el.name);
      const checked = scope.querySelector(`input[type="radio"][name="${el.name}"]:checked`);
      stops.push(checked || el);
      continue;
    }
    stops.push(el);
  }
  return stops;
}
function wireCalculationTabOrder() {
  const root = document.querySelector(".calc-workflow-panel") || document.getElementById("sandboxStage") || document.getElementById("questionStage");
  if (!root) return;
  if (root._calcTabHandler) {
    root.removeEventListener("keydown", root._calcTabHandler);
  }
  root._calcTabHandler = (e) => {
    if (e.key !== "Tab") return;
    const stops = calculationTabStops(root);
    if (stops.length < 2) return;
    const active = document.activeElement;
    let idx = stops.indexOf(active);
    if (idx < 0) {
      const wrap = active?.closest?.(".calc-numeric-input-wrap, .calc-step, .calc-eq-term");
      const nested = wrap ? stops.find((el) => wrap.contains(el)) : null;
      idx = nested ? stops.indexOf(nested) : -1;
    }
    if (idx < 0) return;
    if (e.shiftKey) {
      if (idx <= 0) return;
      e.preventDefault();
      const prev = stops[idx - 1];
      prev?.focus();
      if (typeof prev?.select === "function") prev.select();
      return;
    }
    if (idx >= stops.length - 1) return;
    e.preventDefault();
    const next = stops[idx + 1];
    next?.focus();
    if (typeof next?.select === "function") next.select();
  };
  root.addEventListener("keydown", root._calcTabHandler);
  root.querySelectorAll(".calc-numeric-preview, mjx-container").forEach((el) => {
    el.setAttribute("tabindex", "-1");
  });
}
function wireMultiPathWorkingReveals(q = null) {
  const config = q ? getCalculationConfig(q) : null;
  if (!config || config.marking_mode !== "multi_path") return;
  const tol = parseFloat(q?.calculation_config?.tolerance ?? 0.05);
  const bind = (inputId, carryId, stepId) => {
    const input = document.getElementById(inputId);
    const carry = document.getElementById(carryId);
    if (!input || !carry) return;
    const refresh = () => {
      const raw = String(input.value || "").trim();
      if (!raw) {
        carry.textContent = "";
        return;
      }
      const num = evaluateSimpleArithmetic(raw);
      if (!Number.isFinite(num)) {
        carry.textContent = "";
        return;
      }
      if (studentMatchesAnyPathStep(config.paths, stepId, num, tol)) {
        carry.textContent = `= ${formatAnswerForFeedback(num)}`;
        carry.style.color = "#0f766e";
      } else {
        carry.textContent = "";
      }
    };
    if (input._multiPathCarryHandler) {
      input.removeEventListener("input", input._multiPathCarryHandler);
      input.removeEventListener("blur", input._multiPathCarryHandler);
    }
    input._multiPathCarryHandler = refresh;
    input.addEventListener("input", refresh);
    input.addEventListener("blur", refresh);
    refresh();
  };
  bind("calc_working_1", "calc_working_1_carry", "s1");
  bind("calc_working_2", "calc_working_2_carry", "s2");
}
function usesMergedSigFigsOnCalculate(sigStep) {
  return !!sigStep && sigStep.required !== false && !!sigStep.enforce_on_final && !(Number(sigStep.marks) > 0);
}
function usesSeparateSigFigsBox(sigStep) {
  return !!sigStep && sigStep.required !== false && !usesMergedSigFigsOnCalculate(sigStep);
}
function findActiveSigFigsStep(config) {
  return (config?.steps || []).find((s) => s.type === "sig_figs" && s.required !== false) || null;
}
function selectStyle() {
  return `${inputStyle()} width:fit-content; max-width:100%; min-width:12ch;`;
}
function resolveAnswerDisplayUnit(config, key, equationSheet) {
  const keyUnit = key?.key_payload?.unit?.trim() || "";
  const rearrStep = findActiveRearrangementStep(config);
  if (!rearrStep) return keyUnit;
  const subStep = (config?.steps || []).find((s) => s.type === "substitution");
  const subject = rearrStep.subject || subStep?.rearrangement_subject;
  if (!subject) return keyUnit;
  const eqId = resolveMarkSchemeEquationId(config, subStep) || subStep?.equation_id;
  const equation = findEquationInSheet(equationSheet, eqId);
  if (!equation) return keyUnit;
  return getSubjectUnit(equation, subject) || keyUnit;
}
function renderCalculationWorkflow(q, currentKey, presentation = "practice", equationSheet = null) {
  const rawConfig = getCalculationConfig(q);
  const config = enrichCalculationConfigFromEquationSheet(rawConfig, equationSheet);
  const steps = getActiveSteps(config);
  const simpleMode = isSimpleNumericMode(q, config);
  const unit = resolveAnswerDisplayUnit(config, currentKey, equationSheet);
  const requiresStandardForm = promptRequiresStandardForm(q?.prompt);
  const standardFormNote = requiresStandardForm ? ` <span style="font-weight:600;color:#64748b;">(in standard form)</span>` : "";
  const unitBadge = unit ? `<span class="unit-badge" style="font-size:0.85rem;font-weight:700;color:#475569;background:#f1f5f9;border:1px solid #cbd5e1;padding:6px 12px;border-radius:4px;margin-left:8px;">${escapeHtml(unit)}</span>` : "";
  const hasMultiStep = steps.length > 1 || steps[0]?.type !== "calculate";
  const headerText = presentation === "exam" ? "Show your working \u2014 complete each step as you would on the exam paper" : "Calculation steps";
  let html = renderEquationSheetPanel(config, equationSheet, presentation);
  const formatHelper = config.marking_mode === "moles_mass" && !requiresStandardForm ? "" : renderStandardFormInputHelper({ requiresStandardForm });
  if (hasMultiStep) {
    html += `<div class="calc-workflow-panel item" style="border:1px solid #e2e8f0;padding:15px;border-radius:8px;background:#f8fafc;margin-top:12px;">`;
    html += `<h4 style="margin:0 0 12px;color:var(--primary);font-size:0.9rem;">${escapeHtml(headerText)}</h4>`;
    html += formatHelper;
  } else {
    html += formatHelper;
  }
  let stepNum = 0;
  for (const step of steps) {
    stepNum += 1;
    const label = getStepLabel(step.type, presentation, step);
    const numberedLabel = hasMultiStep && presentation === "practice" ? `${stepNum}. ${label}` : label;
    if (step.type === "equation_select") {
      const options = getEquationOptions(config, equationSheet);
      html += `
        <div class="calc-step" data-step="equation_select" style="margin-bottom:12px;">
          <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${renderStepLabel(numberedLabel, step)}:</label>
          <div class="calc-eq-select-row" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <select id="calc_equation_select" style="${selectStyle()}">
              <option value="">\u2014 Select equation \u2014</option>
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
          <div class="calc-sub-step-inner">${renderSubstitutionStepInner(ctx, inputStyle(), { config, subStep: step })}</div>
        </div>
      `;
    } else if (step.type === "conversion") {
      html += `
        <div class="calc-step" data-step="conversion" style="margin-bottom:12px;">
          <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${renderStepLabel(numberedLabel, step)}:</label>
          ${renderNumericInputField("calc_conversion")}
        </div>
      `;
    } else if (step.type === "element_mass") {
      html += `
        <div class="calc-step" data-step="element_mass" style="margin-bottom:12px;">
          <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${renderStepLabel(numberedLabel, step)}:</label>
          ${renderNumericInputField("calc_element_mass")}
        </div>
      `;
    } else if (step.type === "mass_ratio") {
      html += `
        <div class="calc-step" data-step="mass_ratio" style="margin-bottom:12px;">
          <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${renderStepLabel(numberedLabel, step)}:</label>
          <div style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;">
            ${renderNumericInputField("calc_mass_ratio_num")}
            <span style="font-weight:700;color:#475569;">/</span>
            ${renderNumericInputField("calc_mass_ratio_den")}
          </div>
        </div>
      `;
    } else if (step.type === "insert_values") {
      html += renderInsertValuesStep(numberedLabel, step);
    } else if (step.type === "mole_table") {
      html += renderMoleTableStep(numberedLabel, step);
    } else if (step.type === "mole_ratio") {
      html += renderMoleRatioStep(numberedLabel, step);
    } else if (step.type === "limiting_select") {
      html += renderLimitingSelectStep(numberedLabel, step);
    } else if (step.type === "balance_coeffs") {
      html += renderBalanceCoeffsStep(numberedLabel, step);
    } else if (step.type === "working_1") {
      html += `
        <div class="calc-step" data-step="working_1" style="margin-bottom:12px;">
          <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${renderStepLabel(numberedLabel, step)}:</label>
          <div style="display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap;">
            ${renderNumericInputField("calc_working_1", { placeholder: step.placeholder != null ? step.placeholder : "e.g. 0.2" })}
            <span class="calc-step-carry" id="calc_working_1_carry" aria-live="polite"
              style="font-size:0.9rem;font-weight:700;color:#0f766e;min-height:1.2em;"></span>
          </div>
        </div>
      `;
    } else if (step.type === "working_2") {
      html += `
        <div class="calc-step" data-step="working_2" style="margin-bottom:12px;">
          <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${renderStepLabel(numberedLabel, step)}:</label>
          <div style="display:inline-flex;align-items:center;gap:10px;flex-wrap:wrap;">
            ${renderNumericInputField("calc_working_2", { placeholder: step.placeholder != null ? step.placeholder : "e.g. 12.8/0.2 or 64" })}
            <span class="calc-step-carry" id="calc_working_2_carry" aria-live="polite"
              style="font-size:0.9rem;font-weight:700;color:#0f766e;min-height:1.2em;"></span>
          </div>
        </div>
      `;
    } else if (step.type === "rearrangement") {
      let choices = [];
      const subStep = steps.find((s) => s.type === "substitution");
      const convStep = getActiveConversionStep(config);
      const workflowRoot = resolveCalculationWorkflowRoot();
      const rearrLocked = step.mode === "numeric" && subStep && equationSheet && !isRearrangementInputReady(config, equationSheet, subStep, workflowRoot);
      if (step.mode === "numeric" && subStep && equationSheet && !rearrLocked) {
        const eqId = resolveEquationIdForSubstitution(config, equationSheet, subStep);
        if (eqId) {
          const eq = findEquationInSheet(equationSheet, eqId);
          const ctx = resolveSubstitutionContext(config, equationSheet, subStep);
          const studentSlots = ctx.mode === "structured" && ctx.template ? collectStructuredSubstitution(ctx.template, resolveCalculationWorkflowRoot()) : {};
          const siSlots = buildSiSlotAnswersForRearrangement(subStep, convStep, null, studentSlots);
          const built = buildNumericRearrangementOptions(eq, subStep, step, { siSlotAnswers: siSlots });
          choices = getRearrangementChoices({
            answer: built.answer,
            distractors: built.distractors
          });
        }
      } else if (!rearrLocked) {
        choices = getRearrangementChoices(step);
      }
      const rearrPlaceholder = rearrLocked ? convStep ? "\u2014 Complete conversion and substitution first \u2014" : "\u2014 Complete substitution first \u2014" : "\u2014 Select formula \u2014";
      html += `
        <div class="calc-step" data-step="rearrangement" style="margin-bottom:12px;">
          <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${renderStepLabel(numberedLabel, step)}:</label>
          <select id="calc_rearrangement" style="${selectStyle()}"${rearrLocked ? " disabled" : ""}>
            <option value="">${escapeHtml(rearrPlaceholder)}</option>
            ${choices.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join("")}
          </select>
        </div>
      `;
    } else if (step.type === "calculate") {
      const sigStep = findActiveSigFigsStep(config);
      const mergedSig = usesMergedSigFigsOnCalculate(sigStep);
      const sfNote = mergedSig && sigStep?.sig_figs ? ` <span style="font-weight:600;color:#64748b;">(to ${sigStep.sig_figs} s.f.)</span>` : "";
      const sigAttr = mergedSig ? ' data-sig-enforced="true"' : "";
      const calcMarksOverride = simpleMode ? q.max_marks || 1 : null;
      const calcLabel = renderStepLabel(numberedLabel, step, calcMarksOverride);
      const sigBadge = mergedSig && sigStep ? formatStepMarksBadge(sigStep) : "";
      html += `
        <div class="calc-step" data-step="calculate"${sigAttr} style="margin-bottom:${hasMultiStep ? "0" : "12px"};">
          <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${calcLabel}${sigBadge}${sfNote}${standardFormNote}:</label>
          <div style="display:inline-flex;align-items:flex-start;gap:8px;flex-wrap:wrap;">
            ${renderNumericInputField("numAns", { requiresStandardForm })}
            ${unitBadge}
          </div>
        </div>
      `;
    } else if (step.type === "sig_figs" && usesSeparateSigFigsBox(step)) {
      html += `
        <div class="calc-step" data-step="sig_figs" style="margin-bottom:12px;">
          <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${renderStepLabel(numberedLabel, step)}:</label>
          ${renderNumericInputField("calc_sig_figs", { requiresStandardForm })}
        </div>
      `;
    }
  }
  const skipCalculateFallback = config.marking_mode === "balance_from_masses";
  if (!steps.some((s) => s.type === "calculate") && !skipCalculateFallback) {
    html += `
      <div class="calc-step" data-step="calculate">
        <label style="display:block;font-size:0.82rem;font-weight:700;margin-bottom:4px;">${escapeHtml(getStepLabel("calculate", presentation))}${standardFormNote}:</label>
        <div style="display:inline-flex;align-items:flex-start;gap:8px;flex-wrap:wrap;">
          ${renderNumericInputField("numAns", { requiresStandardForm })}
          ${unitBadge}
        </div>
      </div>
    `;
  }
  if (hasMultiStep) {
    html += `</div>`;
  } else if (!html.includes('id="numAns"')) {
    html += `
      <div class="item" style="display:flex;align-items:flex-start;margin-top:12px;gap:8px;flex-wrap:wrap;">
        <label style="font-size:0.9rem;font-weight:600;">Answer${standardFormNote}:</label>
        ${renderNumericInputField("numAns", { requiresStandardForm })}
        ${unitBadge}
      </div>
    `;
  }
  return html;
}
function readNumericInput(id) {
  const el = document.getElementById(id);
  if (!el || el.value.trim() === "") return { value: null, raw: "" };
  const parsed = parseStudentNumber(el.value);
  return {
    value: parsed.valid ? parsed.value : null,
    raw: el.value.trim()
  };
}
function standardFormPresentationFails(q, resp) {
  if (!promptRequiresStandardForm(q?.prompt)) return false;
  const raw = resp?.stepRaw?.calculate ?? "";
  return !raw || !isStandardFormPresentation(raw);
}
function buildStandardFormMissing(stepAo, cleanUrl, markPoints, step) {
  return {
    ao: stepAo,
    stepType: "calculate",
    text: getStepFeedback(
      step,
      markPoints,
      "calculate",
      "Give your answer in standard form, e.g. 3.2x10^6."
    ),
    url: cleanUrl
  };
}
function readTextInput(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}
function collectCalculationResponse(q, sessionMode, equationSheet = null, workflowRoot = null) {
  const sheet = equationSheet || q?._equationSheet || null;
  const config = getCalculationConfig(q);
  const steps = getActiveSteps(config);
  const stepValues = {};
  const stepRaw = {};
  const root = workflowRoot ?? resolveCalculationWorkflowRoot();
  for (const step of steps) {
    if (step.type === "equation_select") {
      stepValues.equation_select = readTextInput("calc_equation_select");
    } else if (step.type === "substitution") {
      stepValues.substitution = collectSubstitutionPayload(config, sheet, step, root);
    } else if (step.type === "conversion") {
      const conv = readNumericInput("calc_conversion");
      stepValues.conversion = conv.value;
      stepRaw.conversion = conv.raw;
    } else if (step.type === "element_mass") {
      const em = readNumericInput("calc_element_mass");
      stepValues.element_mass = em.value;
      stepRaw.element_mass = em.raw;
    } else if (step.type === "mass_ratio") {
      const num = readNumericInput("calc_mass_ratio_num");
      const den = readNumericInput("calc_mass_ratio_den");
      stepValues.mass_ratio = { numerator: num.value, denominator: den.value };
      stepRaw.mass_ratio = { numerator: num.raw, denominator: den.raw };
    } else if (step.type === "insert_values") {
      const left = readNumericInput("calc_insert_left");
      const right = readNumericInput("calc_insert_right");
      stepValues.insert_values = { left: left.value, right: right.value };
      stepRaw.insert_values = { left: left.raw, right: right.raw };
    } else if (step.type === "mole_table") {
      const species = step.species || [];
      const values = {};
      const raw = {};
      species.forEach((sp, i) => {
        const read = readNumericInput(`calc_mole_table_${i}`);
        const key = sp.id || sp.formula || String(i);
        values[key] = read.value;
        raw[key] = read.raw;
      });
      stepValues.mole_table = values;
      stepRaw.mole_table = raw;
    } else if (step.type === "mole_ratio") {
      const left = readNumericInput("calc_mole_ratio_left");
      const right = readNumericInput("calc_mole_ratio_right");
      stepValues.mole_ratio = { left: left.value, right: right.value };
      stepRaw.mole_ratio = { left: left.raw, right: right.raw };
    } else if (step.type === "limiting_select") {
      const chosen = document.querySelector('input[name="calc_limiting_select"]:checked');
      stepValues.limiting_select = chosen ? chosen.value : "";
    } else if (step.type === "balance_coeffs") {
      const species = step.species || [];
      stepValues.balance_coeffs = species.map((_, i) => {
        const el = document.getElementById(`calc_coeff_${i}`);
        const raw = el ? el.value.trim() : "";
        if (raw === "") return null;
        const parsed = parseStudentNumber(raw);
        return parsed.valid ? parsed.value : null;
      });
      stepRaw.balance_coeffs = species.map((_, i) => {
        const el = document.getElementById(`calc_coeff_${i}`);
        return el ? el.value.trim() : "";
      });
    } else if (step.type === "working_1") {
      const w = readNumericInput("calc_working_1");
      stepValues.working_1 = coerceWorkingNumeric(w.value, w.raw);
      stepRaw.working_1 = w.raw;
    } else if (step.type === "working_2") {
      const w = readNumericInput("calc_working_2");
      stepValues.working_2 = coerceWorkingNumeric(w.value, w.raw);
      stepRaw.working_2 = w.raw;
    } else if (step.type === "rearrangement") {
      stepValues.rearrangement = readTextInput("calc_rearrangement");
    } else if (step.type === "calculate") {
      const calc = readNumericInput("numAns");
      stepValues.calculate = calc.value;
      stepRaw.calculate = calc.raw;
    } else if (step.type === "sig_figs" && usesSeparateSigFigsBox(step)) {
      const sig = readNumericInput("calc_sig_figs");
      stepValues.sig_figs = sig.value;
      stepRaw.sig_figs = sig.raw;
    }
  }
  if (stepValues.calculate == null) {
    const calc = readNumericInput("numAns");
    stepValues.calculate = calc.value;
    stepRaw.calculate = calc.raw;
  }
  return {
    type: "numeric",
    sessionMode: getPresentationMode(sessionMode),
    steps: stepValues,
    stepRaw,
    value: stepValues.calculate,
    unit: ""
  };
}
function validateCalculationResponse(q, resp, sessionMode) {
  const config = getCalculationConfig(q);
  const equationSheet = q?._equationSheet || null;
  const presentation = getPresentationMode(sessionMode);
  const missing = [];
  for (const step of getActiveSteps(config)) {
    if (step.type === "working_1" || step.type === "working_2") continue;
    if (step.required === false) continue;
    const val = resp.steps?.[step.type];
    const raw = resp.stepRaw?.[step.type] ?? "";
    if (step.type === "calculate" || step.type === "conversion" || step.type === "element_mass") {
      if (val == null || val === "" || raw && !isValidStudentNumber(raw)) {
        missing.push(getStepLabel(step.type, presentation, step));
      }
    } else if (step.type === "mass_ratio") {
      const num = val?.numerator;
      const den = val?.denominator;
      const rawNum = raw?.numerator ?? "";
      const rawDen = raw?.denominator ?? "";
      if (num == null || den == null || rawNum && !isValidStudentNumber(rawNum) || rawDen && !isValidStudentNumber(rawDen)) {
        missing.push(getStepLabel(step.type, presentation, step));
      }
    } else if (step.type === "insert_values") {
      const left = val?.left;
      const right = val?.right;
      const rawLeft = raw?.left ?? "";
      const rawRight = raw?.right ?? "";
      if (left == null || right == null || rawLeft && !isValidStudentNumber(rawLeft) || rawRight && !isValidStudentNumber(rawRight)) {
        missing.push(getStepLabel(step.type, presentation, step));
      }
    } else if (step.type === "mole_table") {
      const species = step.species || [];
      const incomplete = species.some((sp, i) => {
        const key = sp.id || sp.formula || String(i);
        const v = val?.[key];
        const r = raw?.[key] ?? "";
        return v == null || v === "" || r && !isValidStudentNumber(r);
      });
      if (incomplete) missing.push(getStepLabel(step.type, presentation, step));
    } else if (step.type === "mole_ratio") {
      const left = val?.left;
      const right = val?.right;
      if (left == null || right == null) {
        missing.push(getStepLabel(step.type, presentation, step));
      }
    } else if (step.type === "limiting_select") {
      if (!val) missing.push(getStepLabel(step.type, presentation, step));
    } else if (step.type === "balance_coeffs") {
      const rawList = Array.isArray(raw) ? raw : [];
      const anyEntered = rawList.some((r) => String(r || "").trim() !== "");
      if (!anyEntered) missing.push(getStepLabel(step.type, presentation, step));
    } else if (step.type === "sig_figs" && usesSeparateSigFigsBox(step)) {
      if (val == null || val === "" || raw && !isValidStudentNumber(raw)) {
        missing.push(getStepLabel(step.type, presentation, step));
      }
    } else if (step.type === "substitution") {
      if (typeof val === "object" && val?.mode === "structured") {
        if (!substitutionPayloadIsComplete(val)) {
          missing.push(getStepLabel(step.type, presentation, step));
        }
      } else if (!val || typeof val === "object" && !val.text) {
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
function normalizeSubstitution(text) {
  return String(text || "").toLowerCase().replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/²/g, "^2").replace(/³/g, "^3").replace(/[{}]/g, "");
}
function substitutionMatches(studentText, step) {
  const normalized = normalizeSubstitution(studentText);
  const accepted = step.accepted || (step.answer ? [step.answer] : []);
  return accepted.some((a) => normalizeSubstitution(a) === normalized);
}
function matchSubstitutionStep(studentVal, step, config, equationSheet, markingCtx, conversionEcf = null, resp = null) {
  if (markingCtx && !markingCtx.equationCorrect) return { match: false, ecf: false };
  if (typeof studentVal === "object" && studentVal?.mode === "structured") {
    if (!studentVal.equation_id) return { match: false, ecf: false };
    const markSchemeEq = resolveMarkSchemeEquationId(config, step);
    const equation = findEquationInSheet(equationSheet, markSchemeEq || studentVal.equation_id);
    const template = getSubstitutionTemplate(equation);
    const convStep = (config?.steps || []).find((s) => s.type === "conversion");
    const subStepForMark = resolveSubstitutionMarkScheme(
      {
        ...step,
        rearrangement_subject: resolveSubstitutionRearrangementSubject(step, config)
      },
      convStep,
      resp,
      conversionEcf
    );
    if (template && substitutionSlotsMatchCommutative(studentVal, subStepForMark, template, config)) {
      return { match: true, ecf: !!conversionEcf };
    }
    return { match: substitutionMatches(studentVal.text, step), ecf: false };
  }
  const text = typeof studentVal === "string" ? studentVal : studentVal?.text || "";
  return { match: substitutionMatches(text, step), ecf: false };
}
function getStepFeedback(step, markPoints, stepType, defaultText, config = null) {
  const inline = step?.feedback_if_wrong?.trim();
  if (inline && !shouldIgnoreInlineStepFeedback(step, stepType, config)) return inline;
  const tag = `[calc:${stepType}]`;
  const mp = markPoints?.find((p) => p.point_text === tag);
  return mp?.feedback_if_missing?.trim() || defaultText;
}
function shouldIgnoreInlineStepFeedback(step, stepType, config) {
  if (stepType !== "substitution" || !config?.steps) return false;
  const convStep = config.steps.find((s) => s.type === "conversion");
  if (!convStep?.slot_id) return false;
  const inline = step?.feedback_if_wrong?.trim();
  if (!inline) return false;
  if (convStep.display_value != null && inline.includes(String(convStep.display_value))) {
    return true;
  }
  const slotId = convStep.slot_id;
  const si = firstSlotAnswerValue(
    step?.si_slot_answers?.[slotId] ?? step?.slot_answers?.[slotId]
  );
  if (si && convStep.answer != null && String(si) === String(convStep.answer)) {
    const stemPattern = new RegExp(`${slotId}\\s*=\\s*${convStep.display_value}`, "i");
    if (stemPattern.test(inline)) return true;
  }
  return true;
}
function buildLiveSubstitutionFeedback(step, config, equationSheet, studentVal = null) {
  const convStep = (config?.steps || []).find((s) => s.type === "conversion");
  const equation = findEquationInSheet(equationSheet, step.equation_id);
  const subStepForMark = resolveSubstitutionMarkScheme(
    {
      ...step,
      rearrangement_subject: resolveSubstitutionRearrangementSubject(step, config)
    },
    convStep
  );
  return buildSubstitutionStepFeedback(studentVal, subStepForMark, equation, { config, convStep });
}
function resolveSimpleNumericMaxAo(max, markPoints) {
  const maxAo = { AO1: 0, AO2: 0, AO3: 0 };
  if (markPoints?.length > 0) {
    for (const mp of markPoints) {
      if (mp.ao && maxAo[mp.ao] !== void 0) {
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
      if (ao[mpAo] !== void 0) {
        ao[mpAo] += Number(mp.max_marks) || 1;
      }
    }
    return ao;
  }
  ao[stepAo] = max;
  return ao;
}
function buildSimpleNumericMissing(config, markPoints, cleanUrl, key, steps) {
  const ansTarget = resolveExactAnswer(key);
  const unit = key?.key_payload?.unit || "";
  const calcStep = steps?.find((s) => s.type === "calculate");
  const fromConfig = (config?.remediation_steps || []).filter((s) => s.text?.trim()).map((s) => ({
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
function resolveExactAnswer(key) {
  const payload = key?.key_payload || {};
  const exact = parseFloat(payload.exact_answer);
  if (Number.isFinite(exact)) return exact;
  return parseFloat(payload.answer);
}
function stepTypeOrderIndex(stepType, steps) {
  const idx = steps.findIndex((s) => s.type === stepType);
  if (idx >= 0) return idx;
  const fallback = STEP_ORDER.indexOf(stepType);
  return fallback >= 0 ? fallback : 99;
}
function sortMissingFeedbackByStepOrder(missing, steps) {
  if (!missing?.length || missing.length < 2) return missing;
  return [...missing].sort(
    (a, b) => stepTypeOrderIndex(a.stepType, steps) - stepTypeOrderIndex(b.stepType, steps)
  );
}
function dedupeMissingFeedback(missing) {
  if (!missing?.length) return missing;
  const seen = /* @__PURE__ */ new Set();
  return missing.filter((m) => {
    if (m.isEcf || !m.stepType) return true;
    if (seen.has(m.stepType)) return false;
    seen.add(m.stepType);
    return true;
  });
}
function conversionStepWasCorrect(convStep, resp) {
  if (!convStep) return false;
  const studentVal = parseFloat(resp?.steps?.conversion);
  const target = parseFloat(convStep.answer);
  const tol = parseFloat(convStep.tolerance ?? 1e-3);
  return Number.isFinite(studentVal) && Number.isFinite(target) && Math.abs(studentVal - target) <= tol;
}
function studentUsedStemValueInSubstitution(convStep, subPayload) {
  if (!convStep?.slot_id || convStep.display_value == null) return false;
  const slots = subPayload?.slots || {};
  const entered = parseFloat(slots[convStep.slot_id]);
  const display = parseFloat(convStep.display_value);
  if (!Number.isFinite(entered) || !Number.isFinite(display)) return false;
  return Math.abs(entered - display) < 1e-9;
}
function valuesMatchNumeric(student, target, tol = 0.05) {
  const s = parseFloat(student);
  const t = parseFloat(target);
  if (!Number.isFinite(s) || !Number.isFinite(t)) return false;
  const absTol = Math.max(Number(tol) || 0, Math.abs(t) * 1e-9);
  return Math.abs(s - t) <= absTol;
}
function evaluateSimpleArithmetic(raw) {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw).trim().replace(/,/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/\s+/g, "").replace(/x/gi, "*");
  if (!s) return null;
  const num = "(-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)";
  const directRe = new RegExp(`^${num}$`);
  const directMatch = s.match(directRe);
  if (directMatch) {
    const v = parseFloat(directMatch[1]);
    return Number.isFinite(v) ? v : null;
  }
  const opRe = new RegExp(`^${num}([*/])${num}$`);
  const m = s.match(opRe);
  if (!m) return null;
  const a = parseFloat(m[1]);
  const b = parseFloat(m[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (m[2] === "/" && b === 0) return null;
  return m[2] === "*" ? a * b : a / b;
}
function coerceWorkingNumeric(value, raw) {
  if (value != null && Number.isFinite(Number(value))) return Number(value);
  return evaluateSimpleArithmetic(raw);
}
function acceptRuleMatches(studentVal, rule, tol = 0.05) {
  if (!rule || studentVal == null || studentVal === "") return false;
  const coerced = coerceWorkingNumeric(studentVal, studentVal);
  if (rule.value != null) return valuesMatchNumeric(coerced, rule.value, tol);
  if (rule.op === "div" && Array.isArray(rule.values) && rule.values.length === 2) {
    const [a, b] = rule.values;
    if (!b) return false;
    return valuesMatchNumeric(coerced, a / b, tol);
  }
  if (rule.op === "mul" && Array.isArray(rule.values) && rule.values.length === 2) {
    const [a, b] = rule.values;
    return valuesMatchNumeric(coerced, a * b, tol);
  }
  return false;
}
function acceptListMatches(studentVal, acceptList, tol = 0.05) {
  if (!Array.isArray(acceptList)) return false;
  return acceptList.some((rule) => acceptRuleMatches(studentVal, rule, tol));
}
function scoreMultiPathWorking(path, workingValues, tol = 0.05) {
  let earned = 0;
  const max = (path.steps || []).reduce((s, st) => s + (Number(st.marks) || 0), 0);
  const stepVals = {
    s1: workingValues[0],
    s2: workingValues[1],
    s3: workingValues[2]
  };
  const resolved = {};
  const stepOk = { s1: false, s2: false, s3: false };
  for (const step of path.steps || []) {
    const marks = Number(step.marks) || 0;
    const studentVal = stepVals[step.id];
    let ok = acceptListMatches(studentVal, step.accept, tol);
    if (!ok && step.ecf_from && resolved[step.ecf_from] != null) {
      const prior = resolved[step.ecf_from];
      if (valuesMatchNumeric(studentVal, prior, tol)) {
        ok = true;
      } else {
        const priorStep = (path.steps || []).find((s) => s.id === step.ecf_from);
        const correctPrior = priorStep?.accept?.find((r) => r.value != null)?.value;
        for (const rule of step.accept || []) {
          if (rule.op === "div" && Array.isArray(rule.values) && rule.values.length === 2) {
            const [a, b] = rule.values;
            if (correctPrior != null && valuesMatchNumeric(b, correctPrior, tol)) {
              if (valuesMatchNumeric(studentVal, a / prior, tol)) ok = true;
            } else if (correctPrior != null && valuesMatchNumeric(a, correctPrior, tol)) {
              if (valuesMatchNumeric(studentVal, prior / b, tol)) ok = true;
            }
          }
          if (rule.op === "mul" && Array.isArray(rule.values) && rule.values.length === 2) {
            const [a, b] = rule.values;
            if (correctPrior != null && valuesMatchNumeric(a, correctPrior, tol)) {
              if (valuesMatchNumeric(studentVal, prior * b, tol)) ok = true;
            }
            if (correctPrior != null && valuesMatchNumeric(b, correctPrior, tol)) {
              if (valuesMatchNumeric(studentVal, a * prior, tol)) ok = true;
            }
          }
        }
      }
    }
    if (ok) {
      earned += marks;
      stepOk[step.id] = true;
    }
    const coerced = coerceWorkingNumeric(studentVal, studentVal);
    if (coerced != null) resolved[step.id] = coerced;
  }
  return { earned, max, pathId: path.id, stepOk };
}
function multiPathStepAcceptValue(path, stepId) {
  const step = (path?.steps || []).find((s) => s.id === stepId);
  const rule = step?.accept?.find((r) => r.value != null);
  return rule?.value ?? null;
}
function studentMatchesAnyPathStep(paths, stepId, studentVal, tol) {
  for (const path of paths || []) {
    const step = (path.steps || []).find((s) => s.id === stepId);
    if (acceptListMatches(studentVal, step?.accept, tol)) return true;
  }
  return false;
}
function markMultiPathCalculationResponse(q, resp, key, markPoints, cleanUrl, config) {
  const max = Number(config.max_marks) || Number(q.max_marks) || 3;
  const ao = { AO1: 0, AO2: 0, AO3: 0 };
  const maxAo = { AO1: 0, AO2: max, AO3: 0 };
  const missing = [];
  const stepResults = {};
  const ansTol = parseFloat(key?.key_payload?.tolerance ?? 0.05);
  const unit = config.unit || key?.key_payload?.unit || "";
  const finalAns = coerceWorkingNumeric(
    resp?.steps?.calculate ?? resp?.value,
    resp?.stepRaw?.calculate
  );
  const w1 = coerceWorkingNumeric(resp?.steps?.working_1, resp?.stepRaw?.working_1);
  const w2 = coerceWorkingNumeric(resp?.steps?.working_2, resp?.stepRaw?.working_2);
  let bandMarks = 0;
  for (const band of config.answer_bands || []) {
    if (acceptListMatches(finalAns, band.accept, ansTol)) {
      bandMarks = Math.max(bandMarks, Number(band.marks) || 0);
    }
  }
  const working = [w1, w2, finalAns];
  let bestPath = { earned: 0, max: 0, pathId: null, stepOk: { s1: false, s2: false, s3: false } };
  for (const path of config.paths || []) {
    const scored = scoreMultiPathWorking(path, working, ansTol);
    if (scored.earned > bestPath.earned) bestPath = scored;
  }
  const total = Math.min(max, Math.max(bandMarks, bestPath.earned));
  ao.AO2 = total;
  if (total < max) {
    const expected = key?.key_payload?.exact_answer ?? key?.key_payload?.answer ?? config.answer;
    missing.push({
      ao: "AO2",
      stepType: "calculate",
      text: `Expected ${formatAnswerForFeedback(expected)}${unit ? ` ${unit}` : ""}.`,
      url: cleanUrl
    });
  }
  const revealPath = (config.paths || []).find((p) => p.id === bestPath.pathId) || (config.paths || []).find((p) => p.id === config.primary_path_id) || config.paths?.[0];
  const s1Reveal = multiPathStepAcceptValue(revealPath, "s1");
  const s2Reveal = multiPathStepAcceptValue(revealPath, "s2");
  const s3Reveal = multiPathStepAcceptValue(revealPath, "s3");
  const primaryScored = scoreMultiPathWorking(revealPath || { steps: [] }, working, ansTol);
  const w1Ok = !!(primaryScored.stepOk?.s1 || studentMatchesAnyPathStep(config.paths, "s1", w1, ansTol));
  const w2Ok = !!(primaryScored.stepOk?.s2 || studentMatchesAnyPathStep(config.paths, "s2", w2, ansTol));
  const calcCorrect = !!(primaryScored.stepOk?.s3 || acceptListMatches(finalAns, [{ value: config.answer }], ansTol));
  stepResults.working_1 = {
    earned: w1Ok ? 1 : 0,
    max: 1,
    correct: w1Ok,
    revealAnswer: s1Reveal != null ? formatAnswerForFeedback(s1Reveal) : null
  };
  stepResults.working_2 = {
    earned: w2Ok ? 1 : 0,
    max: 1,
    correct: w2Ok,
    revealAnswer: s2Reveal != null ? formatAnswerForFeedback(s2Reveal) : null
  };
  stepResults.calculate = {
    earned: calcCorrect ? 1 : 0,
    max: 1,
    correct: calcCorrect,
    revealAnswer: s3Reveal != null ? formatAnswerForFeedback(s3Reveal) : null,
    // Overall total may still be 3 via answer band when working is empty
    bandTotal: total,
    ecf: bandMarks < total && bestPath.earned === total,
    enforceOnFinal: false
  };
  const quality = total === max && max > 0 ? 5 : total > 0 ? 3 : 1;
  return { total, max, ao, maxAo, missing, quality, stepResults };
}
function markPercentByMassResponse(q, resp, key, markPoints, cleanUrl, config) {
  const steps = getActiveSteps(config);
  let total = 0;
  let max = 0;
  const ao = { AO1: 0, AO2: 0, AO3: 0 };
  const maxAo = { AO1: 0, AO2: 0, AO3: 0 };
  const missing = [];
  const stepResults = {};
  const ansTol = parseFloat(key?.key_payload?.tolerance ?? 0.5);
  const mr = parseFloat(config.mr);
  const correctElem = parseFloat(steps.find((s) => s.type === "element_mass")?.answer);
  const studentElem = parseFloat(resp?.steps?.element_mass);
  const elemTol = parseFloat(steps.find((s) => s.type === "element_mass")?.tolerance ?? 0.05);
  let elemCorrect = false;
  let elemEcfValue = null;
  for (const step of steps) {
    const marks = Number(step.marks) || 0;
    const stepAo = step.ao || "AO2";
    max += marks;
    maxAo[stepAo] = (maxAo[stepAo] || 0) + marks;
    let earned = 0;
    let isCorrect = false;
    let isEcf = false;
    if (step.type === "element_mass") {
      isCorrect = valuesMatchNumeric(studentElem, correctElem, elemTol);
      elemCorrect = isCorrect;
      if (isCorrect) {
        earned = marks;
        elemEcfValue = correctElem;
      } else if (Number.isFinite(studentElem)) {
        elemEcfValue = studentElem;
      }
      if (!isCorrect) {
        missing.push({
          ao: stepAo,
          stepType: step.type,
          text: getStepFeedback(step, markPoints, "element_mass", `Mass of element: expected ${formatAnswerForFeedback(correctElem)}.`),
          url: cleanUrl
        });
      }
    } else if (step.type === "mass_ratio") {
      const ratio = resp?.steps?.mass_ratio || {};
      const num = parseFloat(ratio.numerator);
      const den = parseFloat(ratio.denominator);
      const expectedNum = correctElem;
      const expectedDen = mr;
      const exactOk = valuesMatchNumeric(num, expectedNum, elemTol) && valuesMatchNumeric(den, expectedDen, elemTol);
      const ecfOk = Number.isFinite(elemEcfValue) && valuesMatchNumeric(num, elemEcfValue, elemTol) && valuesMatchNumeric(den, expectedDen, elemTol);
      if (exactOk) {
        isCorrect = true;
        earned = marks;
      } else if (ecfOk && !elemCorrect) {
        isCorrect = true;
        isEcf = true;
        earned = marks;
        missing.push({
          ao: stepAo,
          stepType: step.type,
          text: "Error carried forward from element mass.",
          isEcf: true,
          url: cleanUrl
        });
      } else {
        missing.push({
          ao: stepAo,
          stepType: step.type,
          text: getStepFeedback(step, markPoints, "mass_ratio", `Expected ${formatAnswerForFeedback(expectedNum)} / ${formatAnswerForFeedback(expectedDen)}.`),
          url: cleanUrl
        });
      }
    } else if (step.type === "calculate") {
      const studentVal = resp?.steps?.calculate ?? resp?.value;
      const exactPct = correctElem / mr * 100;
      const exactOk = valuesMatchNumeric(studentVal, exactPct, ansTol);
      const ecfPct = Number.isFinite(elemEcfValue) ? elemEcfValue / mr * 100 : null;
      const ecfOk = ecfPct != null && valuesMatchNumeric(studentVal, ecfPct, ansTol);
      if (exactOk) {
        isCorrect = true;
        earned = marks;
      } else if (ecfOk && !elemCorrect) {
        isCorrect = true;
        isEcf = true;
        earned = marks;
        missing.push({
          ao: stepAo,
          stepType: step.type,
          text: "Error carried forward from element mass.",
          isEcf: true,
          url: cleanUrl
        });
      } else {
        missing.push({
          ao: stepAo,
          stepType: step.type,
          text: getStepFeedback(
            step,
            markPoints,
            "calculate",
            `Expected ${formatAnswerForFeedback(exactPct)}%.`
          ),
          url: cleanUrl
        });
      }
    }
    total += earned;
    if (earned > 0) ao[stepAo] = (ao[stepAo] || 0) + earned;
    stepResults[step.type] = {
      earned,
      max: marks,
      correct: isCorrect && !isEcf,
      ecf: isEcf,
      enforceOnFinal: false
    };
  }
  const quality = total === max && max > 0 ? 5 : total > 0 ? 3 : 1;
  return { total, max, ao, maxAo, missing, quality, stepResults };
}
function insertValuesMatch(student, step, tol) {
  const left = parseFloat(student?.left);
  const right = parseFloat(student?.right);
  const expL = parseFloat(step.left?.value);
  const expR = parseFloat(step.right?.value);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  if (valuesMatchNumeric(left, expL, tol) && valuesMatchNumeric(right, expR, tol)) return true;
  if (step.op === "mul" && valuesMatchNumeric(left, expR, tol) && valuesMatchNumeric(right, expL, tol)) {
    return true;
  }
  return false;
}
function insertValuesProduct(student, step) {
  const left = parseFloat(student?.left);
  const right = parseFloat(student?.right);
  if (!Number.isFinite(left) || !Number.isFinite(right) || right === 0 && step.op === "div") return null;
  return step.op === "mul" ? left * right : left / right;
}
function markMolesMassResponse(q, resp, key, markPoints, cleanUrl, config) {
  const steps = getActiveSteps(config);
  const max = Number(config.max_marks) || Number(q.max_marks) || 2;
  const ao = { AO1: 0, AO2: 0, AO3: 0 };
  const maxAo = { AO1: 0, AO2: max, AO3: 0 };
  const missing = [];
  const stepResults = {};
  const ansTol = parseFloat(key?.key_payload?.tolerance ?? 0.05);
  const insertStep = steps.find((s) => s.type === "insert_values");
  const calcStep = steps.find((s) => s.type === "calculate");
  const sigStep = steps.find((s) => s.type === "sig_figs");
  const expected = parseFloat(key?.key_payload?.exact_answer ?? key?.key_payload?.answer ?? config.answer);
  const studentFinal = resp?.steps?.calculate ?? resp?.value;
  const insertOk = insertStep ? insertValuesMatch(resp?.steps?.insert_values, insertStep, ansTol) : false;
  const valueExact = valuesMatchNumeric(studentFinal, expected, ansTol);
  const sfFail = standardFormPresentationFails(q, resp);
  const exactFinal = valueExact && !sfFail;
  const ecfFromInsert = insertValuesProduct(resp?.steps?.insert_values, insertStep);
  const ecfFinal = !exactFinal && !insertOk && ecfFromInsert != null && valuesMatchNumeric(studentFinal, ecfFromInsert, ansTol) && !sfFail;
  let total = 0;
  if (insertStep) {
    const marks = Number(insertStep.marks) || 1;
    const earned = insertOk || valueExact ? marks : 0;
    total += earned;
    if (!insertOk && !valueExact) {
      missing.push({
        ao: "AO2",
        stepType: "insert_values",
        text: getStepFeedback(
          insertStep,
          markPoints,
          "insert_values",
          `Substitute ${formatAnswerForFeedback(insertStep.left?.value)} and ${formatAnswerForFeedback(insertStep.right?.value)}.`
        ),
        url: cleanUrl
      });
    }
    stepResults.insert_values = {
      earned,
      max: marks,
      correct: insertOk,
      ecf: !insertOk && valueExact,
      enforceOnFinal: false
    };
  }
  if (calcStep) {
    const marks = Number(calcStep.marks) || 1;
    let earned = 0;
    let isEcf = false;
    if (exactFinal) {
      earned = marks;
    } else if (ecfFinal) {
      earned = marks;
      isEcf = true;
      missing.push({
        ao: "AO2",
        stepType: "calculate",
        text: "Error carried forward from substituted values.",
        isEcf: true,
        url: cleanUrl
      });
    } else if (valueExact && sfFail) {
      missing.push(buildStandardFormMissing("AO2", cleanUrl, markPoints, calcStep));
    } else {
      missing.push({
        ao: "AO2",
        stepType: "calculate",
        text: getStepFeedback(
          calcStep,
          markPoints,
          "calculate",
          `Expected ${formatAnswerForFeedback(expected)}${config.unit ? ` ${config.unit}` : ""}.`
        ),
        url: cleanUrl
      });
    }
    total += earned;
    stepResults.calculate = {
      earned,
      max: marks,
      correct: exactFinal,
      ecf: isEcf,
      enforceOnFinal: false
    };
  }
  if (sigStep && Number(sigStep.marks) > 0) {
    const marks = Number(sigStep.marks) || 1;
    const calcNum = parseFloat(studentFinal);
    const sigTarget = Number.isFinite(calcNum) ? calcNum : expected;
    const sigValue = resp?.steps?.sig_figs;
    const sigRaw = resp?.stepRaw?.sig_figs ?? "";
    const sigOk = sigValue != null && sigValue !== "" && matchesSigFigs(sigRaw || sigValue, sigTarget, sigStep.sig_figs, ansTol, { requireSigFigCount: true });
    const earned = sigOk ? marks : 0;
    total += earned;
    if (!sigOk) {
      const sigRounded = roundToSigFigs(sigTarget, sigStep.sig_figs);
      const sigEcfNote = Number.isFinite(calcNum) && !exactFinal ? " based on your calculated value" : "";
      missing.push({
        ao: "AO2",
        stepType: "sig_figs",
        text: getStepFeedback(
          sigStep,
          markPoints,
          "sig_figs",
          `Significant figures: expected ${formatAnswerForFeedback(sigRounded)} (${sigStep.sig_figs} s.f.)${sigEcfNote}.`
        ),
        url: cleanUrl
      });
    }
    stepResults.sig_figs = {
      earned,
      max: marks,
      correct: sigOk,
      ecf: sigOk && !exactFinal && Number.isFinite(calcNum),
      enforceOnFinal: true
    };
  }
  total = Math.min(max, total);
  ao.AO2 = total;
  const quality = total === max && max > 0 ? 5 : total > 0 ? 3 : 1;
  return { total, max, ao, maxAo, missing, quality, stepResults };
}
function gcdInt(a, b) {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}
function impliedWholeCoeff(value) {
  if (value == null || value === "") return 1;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const r = Math.round(n);
  if (Math.abs(n - r) > 1e-6) return null;
  return r;
}
function normalizeWholeCoeffs(arr) {
  const nums = (arr || []).map(impliedWholeCoeff);
  if (nums.some((n) => n == null)) return null;
  const g = nums.reduce((a, b) => gcdInt(a, b), nums[0]);
  return nums.map((n) => n / g);
}
function coeffsMatchNormalized(student, target) {
  const a = normalizeWholeCoeffs(student);
  const b = normalizeWholeCoeffs(target);
  if (!a || !b || a.length !== b.length) return false;
  return a.every((n, i) => n === b[i]);
}
function ratiosEquivalent(a1, b1, a2, b2) {
  const x1 = Number(a1);
  const y1 = Number(b1);
  const x2 = Number(a2);
  const y2 = Number(b2);
  if (![x1, y1, x2, y2].every(Number.isFinite) || y1 === 0 || y2 === 0) return false;
  return Math.abs(x1 * y2 - y1 * x2) <= 1e-6 * Math.max(1, Math.abs(x1 * y2), Math.abs(y1 * x2));
}
function markBalanceFromMassesResponse(q, resp, key, markPoints, cleanUrl, config) {
  const steps = getActiveSteps(config);
  const max = Number(config.max_marks) || Number(q.max_marks) || 2;
  const ao = { AO1: 0, AO2: 0, AO3: 0 };
  const maxAo = { AO1: 0, AO2: max, AO3: 0 };
  const missing = [];
  const stepResults = {};
  const ansTol = parseFloat(key?.key_payload?.tolerance ?? 0.05);
  let total = 0;
  for (const step of steps) {
    const marks = Number(step.marks) || 1;
    let earned = 0;
    let isCorrect = false;
    if (step.type === "mole_table") {
      const student = resp?.steps?.mole_table || {};
      const allOk = (step.species || []).every((sp, i) => {
        const keyId = sp.id || sp.formula || String(i);
        return valuesMatchNumeric(student[keyId], sp.answer, ansTol);
      });
      isCorrect = allOk;
      earned = allOk ? marks : 0;
      if (!allOk) {
        const expected = (step.species || []).map((sp) => `${sp.formula}: ${formatAnswerForFeedback(sp.answer)}`).join(", ");
        missing.push({
          ao: "AO2",
          stepType: "mole_table",
          text: getStepFeedback(step, markPoints, "mole_table", `Expected moles: ${expected}.`),
          url: cleanUrl
        });
      }
    } else if (step.type === "balance_coeffs") {
      const student = resp?.steps?.balance_coeffs || [];
      isCorrect = coeffsMatchNormalized(student, step.coeffs);
      earned = isCorrect ? marks : 0;
      if (!isCorrect) {
        missing.push({
          ao: "AO2",
          stepType: "balance_coeffs",
          text: getStepFeedback(
            step,
            markPoints,
            "balance_coeffs",
            `Expected coefficients: [${(step.coeffs || []).join(", ")}].`
          ),
          url: cleanUrl
        });
      }
    }
    total += earned;
    if (earned > 0) ao.AO2 += earned;
    stepResults[step.type] = { earned, max: marks, correct: isCorrect, ecf: false, enforceOnFinal: false };
  }
  total = Math.min(max, total);
  ao.AO2 = total;
  const quality = total === max && max > 0 ? 5 : total > 0 ? 3 : 1;
  return { total, max, ao, maxAo, missing, quality, stepResults };
}
function markLimitingReactantResponse(q, resp, key, markPoints, cleanUrl, config) {
  const steps = getActiveSteps(config);
  const max = Number(config.max_marks) || Number(q.max_marks) || 4;
  const ao = { AO1: 0, AO2: 0, AO3: 0 };
  const maxAo = { AO1: 0, AO2: max, AO3: 0 };
  const missing = [];
  const stepResults = {};
  const ansTol = parseFloat(key?.key_payload?.tolerance ?? 0.05);
  const expectedMass = parseFloat(key?.key_payload?.exact_answer ?? key?.key_payload?.answer ?? config.answer);
  let total = 0;
  const moleStep = steps.find((s) => s.type === "mole_table");
  const studentMoles = resp?.steps?.mole_table || {};
  let limitingMolesStudent = null;
  const limitingId = config.limiting_id;
  if (moleStep && limitingId) {
    const sp = (moleStep.species || []).find((s) => s.id === limitingId);
    const keyId = sp?.id || limitingId;
    const v = parseFloat(studentMoles[keyId]);
    if (Number.isFinite(v)) limitingMolesStudent = v;
  }
  for (const step of steps) {
    const marks = Number(step.marks) || 1;
    let earned = 0;
    let isCorrect = false;
    let isEcf = false;
    if (step.type === "mole_table") {
      const allOk = (step.species || []).every((sp, i) => {
        const keyId = sp.id || sp.formula || String(i);
        return valuesMatchNumeric(studentMoles[keyId], sp.answer, ansTol);
      });
      isCorrect = allOk;
      earned = allOk ? marks : 0;
      if (!allOk) {
        const expected = (step.species || []).map((sp) => `${sp.formula}: ${formatAnswerForFeedback(sp.answer)}`).join(", ");
        missing.push({
          ao: "AO2",
          stepType: "mole_table",
          text: getStepFeedback(step, markPoints, "mole_table", `Expected moles: ${expected}.`),
          url: cleanUrl
        });
      }
    } else if (step.type === "mole_ratio") {
      const student = resp?.steps?.mole_ratio || {};
      isCorrect = ratiosEquivalent(student.left, student.right, step.left?.value, step.right?.value);
      earned = isCorrect ? marks : 0;
      if (!isCorrect) {
        missing.push({
          ao: "AO2",
          stepType: "mole_ratio",
          text: getStepFeedback(
            step,
            markPoints,
            "mole_ratio",
            `Expected ${formatAnswerForFeedback(step.left?.value)} : ${formatAnswerForFeedback(step.right?.value)}.`
          ),
          url: cleanUrl
        });
      }
    } else if (step.type === "limiting_select") {
      const chosen = String(resp?.steps?.limiting_select || "");
      isCorrect = chosen === String(step.answer);
      earned = isCorrect ? marks : 0;
      if (!isCorrect) {
        const label = (step.options || []).find((o) => o.id === step.answer)?.label || step.answer;
        missing.push({
          ao: "AO2",
          stepType: "limiting_select",
          text: getStepFeedback(step, markPoints, "limiting_select", `Limiting reactant: ${label}.`),
          url: cleanUrl
        });
      }
    } else if (step.type === "calculate") {
      const studentVal = resp?.steps?.calculate ?? resp?.value;
      const exactOk = valuesMatchNumeric(studentVal, expectedMass, ansTol);
      const ratio = Number(config.product_coeff) / Number(config.limiting_coeff || 1);
      const mrP = Number(config.product_mr);
      const ecfMass = limitingMolesStudent != null && Number.isFinite(ratio) && Number.isFinite(mrP) ? limitingMolesStudent * ratio * mrP : null;
      const molesOk = moleStep && stepResults.mole_table?.correct;
      if (exactOk) {
        isCorrect = true;
        earned = marks;
      } else if (!molesOk && ecfMass != null && valuesMatchNumeric(studentVal, ecfMass, ansTol)) {
        isCorrect = true;
        isEcf = true;
        earned = marks;
        missing.push({
          ao: "AO2",
          stepType: "calculate",
          text: "Error carried forward from moles of the limiting reactant.",
          isEcf: true,
          url: cleanUrl
        });
      } else {
        missing.push({
          ao: "AO2",
          stepType: "calculate",
          text: getStepFeedback(
            step,
            markPoints,
            "calculate",
            `Expected ${formatAnswerForFeedback(expectedMass)} g.`
          ),
          url: cleanUrl
        });
      }
    }
    total += earned;
    if (earned > 0) ao.AO2 += earned;
    stepResults[step.type] = {
      earned,
      max: marks,
      correct: isCorrect && !isEcf,
      ecf: isEcf,
      enforceOnFinal: false
    };
  }
  total = Math.min(max, total);
  ao.AO2 = total;
  const quality = total === max && max > 0 ? 5 : total > 0 ? 3 : 1;
  return { total, max, ao, maxAo, missing, quality, stepResults };
}
function markCalculationResponse(q, resp, key, markPoints, cleanUrl, equationSheet = null) {
  const rawConfig = getCalculationConfig(q);
  const config = enrichCalculationConfigFromEquationSheet(rawConfig, equationSheet);
  if (config.marking_mode === "multi_path") {
    return markMultiPathCalculationResponse(q, resp, key, markPoints, cleanUrl, config);
  }
  if (config.marking_mode === "percent_by_mass") {
    return markPercentByMassResponse(q, resp, key, markPoints, cleanUrl, config);
  }
  if (config.marking_mode === "moles_mass") {
    return markMolesMassResponse(q, resp, key, markPoints, cleanUrl, config);
  }
  if (config.marking_mode === "balance_from_masses") {
    return markBalanceFromMassesResponse(q, resp, key, markPoints, cleanUrl, config);
  }
  if (config.marking_mode === "limiting_reactant") {
    return markLimitingReactantResponse(q, resp, key, markPoints, cleanUrl, config);
  }
  const steps = getActiveSteps(config);
  let total = 0;
  let max = 0;
  const ao = { AO1: 0, AO2: 0, AO3: 0 };
  const maxAo = { AO1: 0, AO2: 0, AO3: 0 };
  const missing = [];
  let conversionTarget = null;
  let conversionTol = 1e-3;
  const exactAnswer = resolveExactAnswer(key);
  const ansTol = parseFloat(key?.key_payload?.tolerance ?? 0);
  const unit = resolveAnswerDisplayUnit(config, key, equationSheet);
  const stepResults = {};
  const markingCtx = resolveMarkingContext(config, resp, equationSheet, steps);
  const wrongEquationPath = markingCtx.hasEquationSelect && !markingCtx.equationCorrect;
  const conversionEcf = resolveConversionEcfState(steps, resp);
  const workflowAnswer = conversionEcf ? resolveWorkflowDerivedAnswer(config, steps, resp, equationSheet, conversionEcf) : null;
  if (isSimpleNumericMode(q, config)) {
    const max2 = q.max_marks || 1;
    const maxAo2 = resolveSimpleNumericMaxAo(max2, markPoints);
    const stepAo = steps[0]?.ao || "AO2";
    const calcStep = steps.find((s) => s.type === "calculate") || steps[0];
    const studentVal = resp.steps?.calculate ?? resp.value;
    const valueCorrect = studentVal != null && Math.abs(studentVal - exactAnswer) <= ansTol;
    const presentationOk = !standardFormPresentationFails(q, resp);
    const isCorrect = valueCorrect && presentationOk;
    const total2 = isCorrect ? max2 : 0;
    const ao2 = isCorrect ? awardSimpleNumericAo(max2, markPoints, stepAo) : { AO1: 0, AO2: 0, AO3: 0 };
    const missing2 = isCorrect ? [] : buildSimpleNumericMissing(config, markPoints, cleanUrl, key, steps);
    if (valueCorrect && !presentationOk) {
      missing2.push(buildStandardFormMissing(stepAo, cleanUrl, markPoints, calcStep));
    }
    stepResults.calculate = {
      earned: total2,
      max: max2,
      correct: isCorrect,
      ecf: false,
      enforceOnFinal: false
    };
    const quality2 = total2 === max2 && max2 > 0 ? 5 : 1;
    return { total: total2, max: max2, ao: ao2, maxAo: maxAo2, missing: missing2, quality: quality2, stepResults };
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
      } else if (target && !wrongEquationPath) {
        const expectedLabel = findEquationLabel(config, equationSheet, target);
        missing.push({
          ao: stepAo,
          stepType: step.type,
          text: getStepFeedback(
            step,
            markPoints,
            "equation_select",
            `Equation: the correct equation is "${expectedLabel}".`
          ),
          url: cleanUrl
        });
      }
    } else if (step.type === "substitution") {
      const convStep = steps.find((s) => s.type === "conversion");
      const subMatch = matchSubstitutionStep(
        studentVal,
        step,
        config,
        equationSheet,
        markingCtx,
        conversionEcf,
        resp
      );
      if (subMatch.match) {
        earned = marks;
        isCorrect = true;
        if (subMatch.ecf) {
          isEcf = true;
          missing.push({
            ao: stepAo,
            stepType: step.type,
            text: buildConversionEcfNotice("substitution", conversionEcf),
            isEcf: true
          });
        }
      } else if (!wrongEquationPath) {
        if (convStep && conversionStepWasCorrect(convStep, resp) && studentUsedStemValueInSubstitution(convStep, studentVal)) {
          const unitSuffix = convStep.to_unit ? ` ${convStep.to_unit}` : "";
          missing.push({
            ao: convStep.ao || stepAo,
            stepType: "conversion",
            text: getStepFeedback(
              convStep,
              markPoints,
              "conversion",
              `After converting to${unitSuffix}, substitute ${convStep.answer}${unitSuffix} into the equation \u2014 not the value from the question stem (${convStep.display_value} ${convStep.from_unit || ""}).`.trim()
            ),
            url: cleanUrl
          });
        }
        const subFb = buildLiveSubstitutionFeedback(step, config, equationSheet, studentVal);
        const subText = getStepFeedback(
          step,
          markPoints,
          "substitution",
          subFb.text,
          config
        );
        missing.push({
          ao: stepAo,
          stepType: step.type,
          text: subText,
          html: subText === subFb.text ? subFb.html : "",
          url: cleanUrl
        });
      }
    } else if (step.type === "conversion") {
      conversionTarget = parseFloat(step.answer);
      conversionTol = parseFloat(step.tolerance ?? 1e-3);
      const convCorrect = studentVal != null && studentVal !== "" && Math.abs(studentVal - conversionTarget) <= conversionTol;
      if (convCorrect) {
        earned = marks;
        isCorrect = true;
      } else {
        missing.push({
          ao: stepAo,
          stepType: step.type,
          text: getStepFeedback(
            step,
            markPoints,
            "conversion",
            `Unit conversion: expected ${conversionTarget}${step.label ? ` (${step.label})` : ""}.`,
            config
          ),
          url: cleanUrl
        });
      }
    } else if (step.type === "rearrangement") {
      const expectedAnswer = resolveExpectedRearrangementAnswer(
        step,
        config,
        steps,
        resp,
        equationSheet,
        conversionEcf
      );
      const answerOk = rearrangementAnswerMatches(studentVal, expectedAnswer);
      if (markingCtx.equationCorrect && answerOk) {
        earned = marks;
        isCorrect = true;
        if (conversionEcf) {
          isEcf = true;
          missing.push({
            ao: stepAo,
            stepType: step.type,
            text: buildConversionEcfNotice("rearrangement", conversionEcf),
            isEcf: true
          });
        }
      } else if (!wrongEquationPath) {
        const defaultText = expectedAnswer ? `Rearrangement: the correct form is "${expectedAnswer}".` : "Rearrangement: check your rearranged formula.";
        missing.push({
          ao: stepAo,
          stepType: step.type,
          text: getStepFeedback(
            step,
            markPoints,
            "rearrangement",
            defaultText
          ),
          url: cleanUrl
        });
      }
    } else if (step.type === "calculate") {
      let target = exactAnswer;
      const sigStep = steps.find((s) => s.type === "sig_figs");
      if (usesMergedSigFigsOnCalculate(sigStep) && sigStep?.sig_figs) {
        target = roundToSigFigs(exactAnswer, sigStep.sig_figs);
      }
      let calcCorrect = markingCtx.equationCorrect && studentVal != null && Math.abs(studentVal - target) <= ansTol;
      isCorrect = calcCorrect;
      if (!calcCorrect && markingCtx.equationCorrect && conversionEcf) {
        const ecfTarget = workflowAnswer ?? target * conversionEcf.ratio;
        const scaledTol = workflowAnswer != null ? ansTol : Math.max(ansTol, ansTol * Math.abs(conversionEcf.ratio));
        if (Number.isFinite(ecfTarget) && Math.abs(studentVal - ecfTarget) <= scaledTol) {
          isCorrect = true;
          calcCorrect = true;
          isEcf = true;
          missing.push({
            ao: stepAo,
            stepType: step.type,
            text: buildConversionEcfNotice("final calculation", conversionEcf),
            isEcf: true
          });
        }
      }
      if (calcCorrect && standardFormPresentationFails(q, resp)) {
        calcCorrect = false;
        isCorrect = false;
      }
      if (isCorrect) {
        earned = marks;
      } else if (!wrongEquationPath) {
        const valueMatches = studentVal != null && (Math.abs(studentVal - target) <= ansTol || conversionEcf && workflowAnswer != null && Math.abs(studentVal - workflowAnswer) <= ansTol);
        if (valueMatches && standardFormPresentationFails(q, resp)) {
          missing.push(buildStandardFormMissing(stepAo, cleanUrl, markPoints, step));
        } else {
          const expectedForFeedback = conversionEcf && workflowAnswer != null ? workflowAnswer : target;
          const ecfNote = conversionEcf && workflowAnswer != null ? " (based on your substituted values)" : "";
          missing.push({
            ao: stepAo,
            stepType: step.type,
            text: getStepFeedback(
              step,
              markPoints,
              "calculate",
              `Final calculation: expected ${formatAnswerForFeedback(expectedForFeedback)}${unit ? " " + unit : ""}${ecfNote}.`
            ),
            url: cleanUrl
          });
        }
      }
    } else if (step.type === "sig_figs") {
      const sigExpected = conversionEcf && workflowAnswer != null ? workflowAnswer : exactAnswer;
      const sigRounded = roundToSigFigs(sigExpected, step.sig_figs);
      const sigEcfNote = conversionEcf && workflowAnswer != null ? " based on your substituted values" : "";
      const mergedSig = usesMergedSigFigsOnCalculate(step);
      const sigValue = mergedSig ? resp.steps?.calculate ?? resp.value : studentVal;
      const sigRaw = mergedSig ? resp.stepRaw?.calculate ?? "" : resp.stepRaw?.sig_figs ?? "";
      if (sigValue != null && sigValue !== "" && matchesSigFigs(sigRaw || sigValue, sigExpected, step.sig_figs, ansTol, { requireSigFigCount: true })) {
        earned = marks;
        isCorrect = true;
      } else if (marks > 0 && !wrongEquationPath) {
        missing.push({
          ao: stepAo,
          stepType: step.type,
          text: getStepFeedback(
            step,
            markPoints,
            "sig_figs",
            `Significant figures: expected ${formatAnswerForFeedback(sigRounded)} (${step.sig_figs} s.f.)${sigEcfNote}.`
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
      enforceOnFinal: usesMergedSigFigsOnCalculate(step)
    };
  }
  if (wrongEquationPath && markingCtx.markSchemeEquation) {
    missing.unshift(...buildWrongEquationFeedback(
      markingCtx.markSchemeEquation,
      cleanUrl,
      steps,
      markPoints,
      stepResults
    ));
  }
  const orderedMissing = dedupeMissingFeedback(sortMissingFeedbackByStepOrder(missing, steps));
  const quality = total === max && max > 0 ? 5 : total > 0 ? 3 : steps.length > 1 ? 0 : 1;
  return { total, max, ao, maxAo, missing: orderedMissing, quality, stepResults };
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
  const { earned, max, correct, ecf, calcCorrect, sigCorrect, enforceOnFinal, revealAnswer } = result;
  el.style.borderRadius = "8px";
  el.style.padding = "10px 12px";
  el.style.transition = "border-color 0.2s, background 0.2s";
  if (ecf) {
    el.style.border = "2px solid #10b981";
    el.style.background = "#ecfdf5";
  } else if (enforceOnFinal && max > 0 && calcCorrect && !sigCorrect) {
    el.style.border = "2px solid #f59e0b";
    el.style.background = "#fffbeb";
  } else if (correct || max === 0 && correct) {
    el.style.border = "2px solid #10b981";
    el.style.background = "#f0fdf4";
  } else if (max === 0) {
    el.style.border = correct ? "2px solid #10b981" : "2px solid #ef4444";
    el.style.background = correct ? "#f0fdf4" : "#fef2f2";
  } else {
    el.style.border = "2px solid #ef4444";
    el.style.background = "#fef2f2";
  }
  if (revealAnswer != null && String(revealAnswer).trim() !== "") {
    const carry = el.querySelector(".calc-step-carry");
    if (carry) {
      carry.textContent = `= ${revealAnswer}`;
      carry.style.color = correct ? "#0f766e" : "#b45309";
    }
  }
  let badge = el.querySelector(".calc-step-result");
  if (!badge) {
    badge = document.createElement("div");
    badge.className = "calc-step-result";
    badge.style.cssText = "font-size:0.78rem;font-weight:700;margin-top:8px;line-height:1.35;";
    el.appendChild(badge);
  }
  if (max === 0) {
    badge.textContent = correct ? "\u2713 Correct equation \u2014 not marked on this question" : "\u2717 Incorrect equation \u2014 not marked on this question";
    badge.style.color = correct ? "#065f46" : "#991b1b";
  } else if (enforceOnFinal && calcCorrect !== void 0 && sigCorrect !== void 0) {
    badge.textContent = ecf ? `\u2713 ${earned}/${max} marks (ECF applied)` : `\u2713 ${earned}/${max} marks \u2014 value ${calcCorrect ? "correct" : "incorrect"}, significant figures ${sigCorrect ? "correct" : "incorrect"}`;
    badge.style.color = earned === max ? "#065f46" : "#991b1b";
  } else {
    badge.textContent = ecf ? `\u2713 ${earned}/${max} mark${max !== 1 ? "s" : ""} (ECF)` : `${earned === max ? "\u2713" : "\u2717"} ${earned}/${max} mark${max !== 1 ? "s" : ""}`;
    badge.style.color = earned === max ? "#065f46" : "#991b1b";
  }
  el.querySelectorAll("input, select, textarea").forEach((input) => {
    input.disabled = true;
  });
}
function applyCalculationStepHighlighting(stepResults) {
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
          return `${id} \u2192 ${v}`;
        });
        return parts.length ? `Expected slots: ${parts.join(", ")}` : "Enter values from the question; type the symbol for the quantity you are finding.";
      }
      return step.accepted?.[0] ? `Example: ${step.accepted[0]}` : "Substitute values into the equation correctly.";
    case "conversion":
      return `Convert to: ${step.answer}${step.label ? ` (${step.label})` : ""}`;
    case "rearrangement":
      return `Correct form: ${step.answer}`;
    case "calculate": {
      const ans = key?.key_payload?.answer;
      const unit = key?.key_payload?.unit || "";
      return ans != null ? `Answer: ${ans}${unit ? ` ${unit}` : ""}` : "Calculate the final value.";
    }
    case "insert_values":
      return `Substitute ${step.left?.value} ${step.op === "mul" ? "\xD7" : "\xF7"} ${step.right?.value}`;
    case "mole_table":
      return (step.species || []).map((sp) => `${sp.formula}: ${sp.answer}`).join(", ");
    case "mole_ratio":
      return `${step.left?.formula} : ${step.right?.formula} = ${step.left?.value} : ${step.right?.value}`;
    case "limiting_select":
      return `Limiting reactant: ${step.answer}`;
    case "balance_coeffs":
      return `Coefficients: [${(step.coeffs || []).join(", ")}]`;
    case "sig_figs":
      return `Round to ${step.sig_figs} significant figures`;
    default:
      return "";
  }
}
function buildNumericFlashcardInsights(q, key, feedbackPayload, equationSheet = null) {
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
    if (step.type === "sig_figs" && usesMergedSigFigsOnCalculate(step)) continue;
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
    const detail = missingByType[step.type] || getStepExpectedHint(step, config, key, equationSheet);
    if (!detail) continue;
    lines.push(`${correct ? "\u2713" : "\u2717"} ${label}: ${detail}`);
  }
  return lines.length ? lines : null;
}
function renderCalculationStepSummary(stepResults) {
  if (!stepResults || !Object.keys(stepResults).length) return "";
  const types = [.../* @__PURE__ */ new Set([...STEP_ORDER, ...Object.keys(stepResults)])];
  const rows = types.map((type) => {
    if (!stepResults[type]) return "";
    if (type === "sig_figs" && stepResults.sig_figs?.enforceOnFinal) return "";
    let r = stepResults[type];
    if (type === "calculate" && stepResults.sig_figs?.enforceOnFinal) {
      r = combineCalcAndSigResults(stepResults.calculate, stepResults.sig_figs);
    }
    const label = STEP_SUMMARY_LABELS[type] || type;
    let status;
    if (r.max === 0) {
      status = r.correct ? "\u2713 Correct (not marked)" : "\u2717 Incorrect (not marked)";
    } else if (r.ecf) {
      status = `\u2713 ${r.earned}/${r.max} (ECF)`;
    } else {
      status = `${r.earned === r.max ? "\u2713" : "\u2717"} ${r.earned}/${r.max} mark${r.max !== 1 ? "s" : ""}`;
    }
    const color = r.max === 0 ? r.correct ? "#065f46" : "#991b1b" : r.earned === r.max ? "#065f46" : "#991b1b";
    return `<li style="margin-bottom:4px;color:${color};"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(status)}</li>`;
  }).filter(Boolean).join("");
  if (!rows) return "";
  return `
    <hr/>
    <div><strong>Mark breakdown by step</strong></div>
    <ul style="margin:8px 0 0;padding-left:18px;font-size:0.85rem;line-height:1.5;">${rows}</ul>
  `;
}
function buildCalculationConfigFromForm(prefix = "") {
  assertEditAuthoringScope(prefix);
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
      distractors: (p("CalcEquationDistractors")?.value || "").split(",").map((s) => s.trim()).filter(Boolean),
      feedback_if_wrong: fb("equation_select")
    });
  }
  if (chk("CalcStepConversion")) {
    steps.push({
      type: "conversion",
      marks: markForStep("conversion", true),
      ao: "AO2",
      required: true,
      label: p("CalcConversionLabel")?.value?.trim() || "",
      answer: parseFloat(p("CalcConversionAnswer")?.value),
      tolerance: parseFloat(p("CalcConversionTol")?.value) || 1e-3,
      feedback_if_wrong: fb("conversion")
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
      subStep.equation_id = p("CalcSubstitutionEquation")?.value?.trim() || p("CalcEquationAnswer")?.value?.trim() || "";
      subStep.slot_answers = readSlotAnswersFromForm(prefix);
      subStep.rearrangement_subject = p("CalcRearrangementSubject")?.value?.trim() || void 0;
    } else {
      subStep.accepted = (p("CalcSubstitutionAccepted")?.value || "").split("\n").map((s) => s.trim()).filter(Boolean);
    }
    steps.push(subStep);
  }
  if (chk("CalcStepRearrangement")) {
    const distractors = (p("CalcRearrangeDistractors")?.value || "").split(",").map((s) => s.trim()).filter(Boolean);
    const subMode = p("CalcSubstitutionMode")?.value || "free_text";
    const rearrMode = subMode === "structured" ? p("CalcRearrangementMode")?.value || "numeric" : "symbolic";
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
    if (rearrMode === "numeric" || rearrMode === "symbolic") {
      rearrStep.subject = p("CalcRearrangementSubject")?.value?.trim() || void 0;
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
    remediation_steps: remediation_steps.length ? remediation_steps : void 0,
    steps
  });
}
function assertEditAuthoringScope(prefix) {
  if (prefix !== "edit") return;
  const formQuestionId = document.getElementById("editQuestionId")?.value || null;
  const ctxQuestionId = authoringContexts.edit?.questionId;
  if (formQuestionId && ctxQuestionId && formQuestionId !== ctxQuestionId) {
    throw new Error("Calculation form is out of sync with the open question. Close and reopen the edit panel.");
  }
}
function buildCalculationConfigForVariant(baseVariant, opts = {}) {
  const {
    equationId,
    sheetId = null,
    slotAnswers = {},
    siSlotAnswers = null,
    conversion = null,
    sigFigs = null,
    rearrangementSubject = null,
    includeRearrangement = false
  } = opts;
  let base = baseVariant;
  let withRearrangement = includeRearrangement;
  if (baseVariant === "substitution_only" || baseVariant === "substitute") {
    base = "substitute";
  } else if (baseVariant === "equation_recall" || baseVariant === "recall") {
    base = "recall";
  } else if (baseVariant === "rearrangement") {
    base = "recall";
    withRearrangement = true;
  }
  const steps = [];
  if (base === "recall") {
    steps.push({
      type: "equation_select",
      required: true,
      answer: equationId,
      distractors: []
    });
  }
  if (conversion) {
    steps.push({
      type: "conversion",
      required: true,
      label: conversion.label || "",
      answer: conversion.answer,
      tolerance: conversion.tolerance ?? 1e-3,
      slot_id: conversion.slot_id,
      display_value: conversion.display_value,
      display_factor: conversion.display_factor,
      from_unit: conversion.from_unit,
      to_unit: conversion.to_unit
    });
  }
  steps.push({
    type: "substitution",
    required: true,
    mode: "structured",
    equation_id: equationId,
    slot_answers: slotAnswers,
    si_slot_answers: siSlotAnswers || slotAnswers,
    rearrangement_subject: withRearrangement ? rearrangementSubject || void 0 : void 0
  });
  if (withRearrangement) {
    steps.push({
      type: "rearrangement",
      required: true,
      mode: "numeric",
      subject: rearrangementSubject || void 0
    });
  }
  steps.push({ type: "calculate", required: true });
  if (sigFigs != null && sigFigs > 0) {
    steps.push({
      type: "sig_figs",
      required: true,
      sig_figs: sigFigs,
      enforce_on_final: true
    });
  }
  return normalizeCalculationConfig({
    equation_given: base === "substitute",
    equation_sheet_id: sheetId,
    steps
  });
}
function finalizeCalculationConfigForSave(config, equations = []) {
  if (!config?.steps?.length || !equations?.length) return config;
  const subStep = config.steps.find((s) => s.type === "substitution");
  const rearrIdx = config.steps.findIndex((s) => s.type === "rearrangement");
  if (!subStep || rearrIdx < 0) return config;
  const rearrStep = config.steps[rearrIdx];
  if (rearrStep.mode !== "numeric" || !subStep.slot_answers) return config;
  const eqId = subStep.equation_id;
  const equation = equations.find((e) => e.id === eqId || e.label === eqId);
  if (!equation) return config;
  const convStep = config.steps.find((s) => s.type === "conversion");
  const siSlots = buildSiSlotAnswersForRearrangement(subStep, convStep);
  const built = buildNumericRearrangementOptions(equation, subStep, rearrStep, { siSlotAnswers: siSlots });
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
function populateCalculationForm(prefix, config, questionId = null) {
  const p = (id) => document.getElementById(prefix + id);
  const setChk = (id, val) => {
    if (p(id)) p(id).checked = !!val;
  };
  resetCalculationFormFields(prefix);
  const cfg = cloneCalculationConfig(config) || { equation_given: true, steps: [{ type: "calculate", required: true }] };
  const steps = cfg.steps || [];
  setChk("CalcEquationGiven", cfg.equation_given !== false);
  if (p("CalcEquationSheet")) p("CalcEquationSheet").value = cfg.equation_sheet_id || "";
  if (p("CalcEquationOverride")) {
    p("CalcEquationOverride").value = Array.isArray(cfg.equation_override_distractors) ? cfg.equation_override_distractors.join(", ") : "";
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
    if (mode === "structured") {
      setAuthoringContext(prefix, questionId, subStep.slot_answers || {});
    } else {
      setAuthoringContext(prefix, questionId, void 0);
    }
    if (mode === "free_text" && p("CalcSubstitutionAccepted")) {
      p("CalcSubstitutionAccepted").value = (subStep.accepted || []).join("\n");
    }
    if (subStep.rearrangement_subject && p("CalcRearrangementSubject")) {
      p("CalcRearrangementSubject").value = subStep.rearrangement_subject;
    }
  } else {
    setAuthoringContext(prefix, questionId, void 0);
  }
  writeStepFeedback(prefix, FEEDBACK_FIELD_BY_TYPE.substitution, subStep?.feedback_if_wrong);
  const convStep = steps.find((s) => s.type === "conversion");
  if (convStep) {
    if (p("CalcConversionLabel")) p("CalcConversionLabel").value = convStep.label || "";
    if (p("CalcConversionAnswer")) p("CalcConversionAnswer").value = convStep.answer ?? "";
    if (p("CalcConversionTol")) p("CalcConversionTol").value = convStep.tolerance ?? 1e-3;
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
function wireCalculationFormToggles(prefix = "", onChange, supabaseClient = null) {
  wireAutoFeedbackInputs(prefix);
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
    const sync = async () => {
      panel.classList.toggle("hidden", !chkEl.checked);
      if (chkId === "CalcStepRearrangement") {
        await refreshRearrangementSubjectFromForm(prefix, supabaseClient);
      }
      notify();
    };
    chkEl.addEventListener("change", () => {
      sync().catch(() => {
      });
    });
    sync().catch(() => {
    });
  }
  for (const extraId of ["CalcEquationGiven"]) {
    const el = document.getElementById(prefix + extraId);
    el?.addEventListener("change", notify);
  }
  for (const fieldId of ["CalcConversionLabel", "CalcConversionAnswer", "CalcRearrangeAnswer", "CalcSigFigsCount"]) {
    const el = document.getElementById(prefix + fieldId);
    el?.addEventListener("input", () => syncAuthoringStepFeedbackFromForm(prefix, supabaseClient));
    el?.addEventListener("change", () => syncAuthoringStepFeedbackFromForm(prefix, supabaseClient));
  }
  const numAnsId = prefix === "edit" ? "editNumAns" : "numAnsVal";
  const numUnitId = prefix === "edit" ? "editNumUnit" : "numAnsUnit";
  for (const fieldId of [numAnsId, numUnitId]) {
    const el = document.getElementById(fieldId);
    el?.addEventListener("input", () => syncAuthoringStepFeedbackFromForm(prefix, supabaseClient));
  }
}
function applyCalculationPreset(prefix, preset, demandLevel) {
  const effective = preset === "auto" ? inferCalculationPreset(demandLevel) : preset;
  if (effective === "given_equation") {
    populateCalculationForm(prefix, buildEmptyConfigForPreset("given_equation"));
  } else if (effective === "equation_sheet") {
    populateCalculationForm(prefix, buildEmptyConfigForPreset("equation_sheet"));
    applyAutoEquationSheet(prefix);
  } else {
    const preserved = buildCalculationConfigFromForm(prefix);
    populateCalculationForm(prefix, preserved);
  }
  syncMaxMarksSelect(prefix);
}
var CHEM_HT_MARKING_MODES, STEP_ORDER, STEP_LABELS, DEFAULT_CALCULATE_STEP, FEEDBACK_FIELD_BY_TYPE, authoringContexts, COMBINED_SHEET_ID_RE, TRIPLE_SHEET_ID_RE, STEP_SUMMARY_LABELS;
var init_calculationWorkflow = __esm({
  "src/calculationWorkflow.js"() {
    init_utils();
    init_sigFigs();
    init_parseStudentNumber();
    init_numericQuestionGenerator();
    init_sciencePath();
    init_substitutionTemplate();
    CHEM_HT_MARKING_MODES = /* @__PURE__ */ new Set([
      "moles_mass",
      "balance_from_masses",
      "limiting_reactant"
    ]);
    STEP_ORDER = [
      "equation_select",
      "conversion",
      "element_mass",
      "mass_ratio",
      "insert_values",
      "mole_table",
      "mole_ratio",
      "limiting_select",
      "working_1",
      "working_2",
      "substitution",
      "rearrangement",
      "balance_coeffs",
      "calculate",
      "sig_figs"
    ];
    STEP_LABELS = {
      practice: {
        equation_select: "Step: Choose the correct equation",
        substitution: "Step: Substitute values into the equation",
        conversion: "Step: Unit conversion",
        element_mass: "Step: Mass of the element in the formula",
        mass_ratio: "Step: Mass of element \xF7 relative formula mass",
        insert_values: "Step: Substitute values into the equation",
        mole_table: "Step: Calculate moles from the given masses",
        mole_ratio: "Step: Mole ratio from the equation",
        limiting_select: "Step: Identify the limiting reactant",
        working_1: "Step: First calculation",
        working_2: "Step: Second calculation",
        rearrangement: "Step: Choose the correct rearranged formula",
        balance_coeffs: "Step: Balance the equation",
        calculate: "Step: Calculate the final answer",
        sig_figs: "Step: Answer to required significant figures"
      },
      exam: {
        equation_select: "Write the equation used",
        substitution: "Substitute the values",
        conversion: "Unit conversion",
        element_mass: "Mass of the element in the formula",
        mass_ratio: "Mass of element \xF7 relative formula mass",
        insert_values: "Substitute values into the equation",
        mole_table: "Calculate moles from the given masses",
        mole_ratio: "Mole ratio from the equation",
        limiting_select: "Identify the limiting reactant",
        working_1: "First calculation",
        working_2: "Second calculation",
        rearrangement: "Rearrange the equation",
        balance_coeffs: "Balance the equation",
        calculate: "Calculate your answer",
        sig_figs: "Give your answer to the required significant figures"
      }
    };
    DEFAULT_CALCULATE_STEP = {
      type: "calculate",
      marks: 1,
      ao: "AO2",
      required: true
    };
    FEEDBACK_FIELD_BY_TYPE = {
      equation_select: "CalcEquationFeedback",
      substitution: "CalcSubstitutionFeedback",
      conversion: "CalcConversionFeedback",
      rearrangement: "CalcRearrangeFeedback",
      calculate: "CalcCalculateFeedback",
      sig_figs: "CalcSigFigsFeedback"
    };
    authoringContexts = {
      creator: { questionId: null, pendingSlotAnswers: void 0 },
      edit: { questionId: null, pendingSlotAnswers: void 0 }
    };
    COMBINED_SHEET_ID_RE = /^physics_(p[12])_(ft|ht)$/;
    TRIPLE_SHEET_ID_RE = /^triple_physics_(p[12])_(ft|ht)$/;
    STEP_SUMMARY_LABELS = {
      equation_select: "Equation choice",
      substitution: "Substitution",
      insert_values: "Substitute values",
      mole_table: "Moles from masses",
      mole_ratio: "Mole ratio",
      limiting_select: "Limiting reactant",
      balance_coeffs: "Balanced equation",
      conversion: "Unit conversion",
      rearrangement: "Rearrangement",
      calculate: "Final answer",
      sig_figs: "Significant figures"
    };
  }
});

// src/mathEngine.js
function ensureMathJaxLoaded() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.MathJax?.typesetPromise) {
    return Promise.resolve();
  }
  if (mathJaxLoadPromise) {
    return mathJaxLoadPromise;
  }
  mathJaxLoadPromise = new Promise((resolve, reject) => {
    window.MathJax = {
      loader: { load: ["[tex]/mhchem"] },
      tex: {
        packages: { "[+]": ["mhchem"] },
        inlineMath: [["$", "$"], ["\\(", "\\)"]],
        displayMath: [["$$", "$$"], ["\\[", "\\]"]]
      },
      options: {
        skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"]
      }
    };
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js";
    script.async = true;
    script.id = "MathJax-script";
    script.onload = () => resolve();
    script.onerror = () => {
      mathJaxLoadPromise = null;
      reject(new Error("MathJax failed to load"));
    };
    document.head.appendChild(script);
  });
  return mathJaxLoadPromise;
}
function triggerMathTypeset(scope) {
  const scopedElements = scope ? Array.isArray(scope) ? scope : [scope] : null;
  const runTypeset = () => {
    try {
      if (window.MathJax?.typesetPromise) {
        window.MathJax.typesetPromise(scopedElements || void 0).catch(
          (err) => console.warn("MathJax typesetPromise failed:", err)
        );
      } else if (window.MathJax?.Hub?.Queue) {
        if (scopedElements?.length) {
          window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub, scopedElements]);
        } else {
          window.MathJax.Hub.Queue(["Typeset", window.MathJax.Hub]);
        }
      } else if (typeof window.renderMathInElement === "function") {
        const target = scopedElements?.[0] || document.body;
        window.renderMathInElement(target, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false }
          ],
          throwOnError: false
        });
      }
    } catch (err) {
      console.warn("Math typesetting call bypassed or failed:", err);
    }
  };
  ensureMathJaxLoaded().then(() => {
    runTypeset();
    setTimeout(runTypeset, 60);
  }).catch((err) => console.warn("MathJax load skipped:", err));
}
var mathJaxLoadPromise;
var init_mathEngine = __esm({
  "src/mathEngine.js"() {
    mathJaxLoadPromise = null;
  }
});

// src/carbonAllotropeDiagrams.js
function renderCarbonAllotropeSvg(allotropeId) {
  const id = String(allotropeId || "").trim();
  return SVGS[id] || "";
}
var CARBON_ALLOTROPE_LABELS, SVGS;
var init_carbonAllotropeDiagrams = __esm({
  "src/carbonAllotropeDiagrams.js"() {
    CARBON_ALLOTROPE_LABELS = {
      "graphite": "Graphite",
      "diamond": "Diamond",
      "buckminsterfullerene": "Buckminsterfullerene",
      "carbon_nanotube": "Carbon nanotube"
    };
    SVGS = { "graphite": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 340" width="100%" role="img" aria-labelledby="title desc" class="chem-svg chem-svg--fluid" style="max-width:560px;height:auto;display:block;margin:0 auto;">\n  <title id="title">Carbon structure</title>\n  <desc id="desc">GCSE chemistry diagram of a carbon allotrope structure</desc>\n  <rect width="560" height="340" fill="#ffffff"/>\n  <g font-family="system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif">\n<line x1="158.4" y1="2.0" x2="156.3" y2="120.4" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 4"/><line x1="240.4" y1="6.3" x2="230.6" y2="121.4" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 4"/><line x1="318.0" y1="10.4" x2="301.4" y2="122.3" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 4"/><line x1="391.7" y1="14.3" x2="368.8" y2="123.2" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 4"/><line x1="206.4" y1="29.3" x2="199.1" y2="153.9" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 4"/><line x1="293.8" y1="33.2" x2="277.9" y2="154.1" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 4"/><line x1="376.1" y1="36.8" x2="352.6" y2="154.2" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 4"/><line x1="453.9" y1="40.2" x2="423.5" y2="154.4" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 4"/><line x1="156.3" y1="120.4" x2="154.5" y2="218.0" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 4"/><line x1="230.6" y1="121.4" x2="222.5" y2="216.7" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 4"/><line x1="301.4" y1="122.3" x2="287.5" y2="215.4" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 4"/><line x1="368.8" y1="123.2" x2="349.8" y2="214.2" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 4"/><line x1="199.1" y1="153.9" x2="193.2" y2="255.2" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 4"/><line x1="277.9" y1="154.1" x2="264.9" y2="252.9" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 4"/><line x1="352.6" y1="154.2" x2="333.2" y2="250.7" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 4"/><line x1="423.5" y1="154.4" x2="398.4" y2="248.6" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 4"/><line x1="158.4" y1="2.0" x2="202.0" y2="12.0" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="202.0" y1="12.0" x2="206.4" y2="29.3" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="206.4" y1="29.3" x2="161.6" y2="36.9" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="161.6" y1="36.9" x2="113.5" y2="25.2" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="113.5" y1="25.2" x2="115.0" y2="7.7" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="115.0" y1="7.7" x2="158.4" y2="2.0" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="240.4" y1="6.3" x2="284.1" y2="16.1" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="284.1" y1="16.1" x2="293.8" y2="33.2" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="293.8" y1="33.2" x2="254.7" y2="40.7" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="254.7" y1="40.7" x2="206.4" y2="29.3" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="202.0" y1="12.0" x2="240.4" y2="6.3" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="318.0" y1="10.4" x2="361.8" y2="20.0" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="361.8" y1="20.0" x2="376.1" y2="36.8" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="376.1" y1="36.8" x2="342.2" y2="44.3" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="342.2" y1="44.3" x2="293.8" y2="33.2" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="284.1" y1="16.1" x2="318.0" y2="10.4" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="391.7" y1="14.3" x2="435.5" y2="23.7" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="435.5" y1="23.7" x2="453.9" y2="40.2" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="453.9" y1="40.2" x2="424.5" y2="47.7" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="424.5" y1="47.7" x2="376.1" y2="36.8" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="361.8" y1="20.0" x2="391.7" y2="14.3" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="254.7" y1="40.7" x2="263.4" y2="61.7" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="263.4" y1="61.7" x2="217.3" y2="71.8" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="217.3" y1="71.8" x2="163.5" y2="58.3" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="163.5" y1="58.3" x2="161.6" y2="36.9" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="342.2" y1="44.3" x2="356.8" y2="64.8" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="356.8" y1="64.8" x2="317.4" y2="74.8" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="317.4" y1="74.8" x2="263.4" y2="61.7" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="424.5" y1="47.7" x2="444.4" y2="67.8" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="444.4" y1="67.8" x2="410.9" y2="77.6" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="410.9" y1="77.6" x2="356.8" y2="64.8" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="453.9" y1="40.2" x2="502.2" y2="50.9" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="502.2" y1="50.9" x2="526.6" y2="70.6" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="526.6" y1="70.6" x2="498.4" y2="80.2" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="498.4" y1="80.2" x2="444.4" y2="67.8" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="156.3" y1="120.4" x2="195.5" y2="131.3" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="195.5" y1="131.3" x2="199.1" y2="153.9" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="199.1" y1="153.9" x2="158.8" y2="166.4" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="158.8" y1="166.4" x2="115.9" y2="153.7" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="115.9" y1="153.7" x2="117.1" y2="130.5" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="117.1" y1="130.5" x2="156.3" y2="120.4" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="230.6" y1="121.4" x2="270.0" y2="132.0" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="270.0" y1="132.0" x2="277.9" y2="154.1" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="277.9" y1="154.1" x2="242.2" y2="166.2" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="242.2" y1="166.2" x2="199.1" y2="153.9" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="195.5" y1="131.3" x2="230.6" y2="121.4" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="301.4" y1="122.3" x2="340.9" y2="132.7" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="340.9" y1="132.7" x2="352.6" y2="154.2" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="352.6" y1="154.2" x2="321.1" y2="166.0" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="321.1" y1="166.0" x2="277.9" y2="154.1" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="270.0" y1="132.0" x2="301.4" y2="122.3" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="368.8" y1="123.2" x2="408.4" y2="133.3" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="408.4" y1="133.3" x2="423.5" y2="154.4" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="423.5" y1="154.4" x2="395.8" y2="165.9" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="395.8" y1="165.9" x2="352.6" y2="154.2" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="340.9" y1="132.7" x2="368.8" y2="123.2" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="242.2" y1="166.2" x2="249.1" y2="193.0" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="249.1" y1="193.0" x2="207.8" y2="208.5" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="207.8" y1="208.5" x2="160.3" y2="194.0" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="160.3" y1="194.0" x2="158.8" y2="166.4" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="321.1" y1="166.0" x2="332.8" y2="192.0" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="332.8" y1="192.0" x2="296.7" y2="207.0" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="296.7" y1="207.0" x2="249.1" y2="193.0" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="395.8" y1="165.9" x2="411.8" y2="191.1" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="411.8" y1="191.1" x2="380.5" y2="205.6" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="380.5" y1="205.6" x2="332.8" y2="192.0" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="423.5" y1="154.4" x2="466.7" y2="165.7" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="466.7" y1="165.7" x2="486.5" y2="190.3" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="486.5" y1="190.3" x2="459.4" y2="204.3" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="459.4" y1="204.3" x2="411.8" y2="191.1" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="154.5" y1="218.0" x2="190.3" y2="229.3" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="190.3" y1="229.3" x2="193.2" y2="255.2" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="193.2" y1="255.2" x2="156.6" y2="270.6" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="156.6" y1="270.6" x2="117.9" y2="257.6" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="117.9" y1="257.6" x2="118.8" y2="231.0" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="118.8" y1="231.0" x2="154.5" y2="218.0" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="222.5" y1="216.7" x2="258.4" y2="227.7" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="258.4" y1="227.7" x2="264.9" y2="252.9" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="264.9" y1="252.9" x2="232.1" y2="267.8" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="232.1" y1="267.8" x2="193.2" y2="255.2" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="190.3" y1="229.3" x2="222.5" y2="216.7" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="287.5" y1="215.4" x2="323.5" y2="226.2" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="323.5" y1="226.2" x2="333.2" y2="250.7" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="333.2" y1="250.7" x2="303.9" y2="265.2" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="303.9" y1="265.2" x2="264.9" y2="252.9" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="258.4" y1="227.7" x2="287.5" y2="215.4" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="349.8" y1="214.2" x2="385.7" y2="224.7" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="385.7" y1="224.7" x2="398.4" y2="248.6" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="398.4" y1="248.6" x2="372.3" y2="262.7" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="372.3" y1="262.7" x2="333.2" y2="250.7" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="323.5" y1="226.2" x2="349.8" y2="214.2" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="232.1" y1="267.8" x2="237.7" y2="297.9" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="237.7" y1="297.9" x2="200.2" y2="316.4" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="200.2" y1="316.4" x2="157.8" y2="301.6" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="157.8" y1="301.6" x2="156.6" y2="270.6" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="303.9" y1="265.2" x2="313.5" y2="294.3" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="313.5" y1="294.3" x2="280.3" y2="312.2" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="280.3" y1="312.2" x2="237.7" y2="297.9" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="372.3" y1="262.7" x2="385.4" y2="290.9" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="385.4" y1="290.9" x2="356.1" y2="308.1" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="356.1" y1="308.1" x2="313.5" y2="294.3" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="398.4" y1="248.6" x2="437.4" y2="260.3" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="437.4" y1="260.3" x2="453.8" y2="287.7" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="453.8" y1="287.7" x2="428.0" y2="304.3" stroke="#334155" stroke-width="2" stroke-linecap="round"/><line x1="428.0" y1="304.3" x2="385.4" y2="290.9" stroke="#334155" stroke-width="2" stroke-linecap="round"/><circle cx="158.4" cy="2.0" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="202.0" cy="12.0" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="206.4" cy="29.3" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="161.6" cy="36.9" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="113.5" cy="25.2" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="115.0" cy="7.7" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="240.4" cy="6.3" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="284.1" cy="16.1" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="293.8" cy="33.2" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="254.7" cy="40.7" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="318.0" cy="10.4" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="361.8" cy="20.0" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="376.1" cy="36.8" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="342.2" cy="44.3" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="391.7" cy="14.3" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="435.5" cy="23.7" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="453.9" cy="40.2" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="424.5" cy="47.7" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="263.4" cy="61.7" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="217.3" cy="71.8" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="163.5" cy="58.3" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="356.8" cy="64.8" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="317.4" cy="74.8" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="444.4" cy="67.8" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="410.9" cy="77.6" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="502.2" cy="50.9" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="526.6" cy="70.6" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="498.4" cy="80.2" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="156.3" cy="120.4" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="195.5" cy="131.3" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="199.1" cy="153.9" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="158.8" cy="166.4" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="115.9" cy="153.7" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="117.1" cy="130.5" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="230.6" cy="121.4" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="270.0" cy="132.0" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="277.9" cy="154.1" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="242.2" cy="166.2" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="301.4" cy="122.3" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="340.9" cy="132.7" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="352.6" cy="154.2" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="321.1" cy="166.0" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="368.8" cy="123.2" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="408.4" cy="133.3" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="423.5" cy="154.4" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="395.8" cy="165.9" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="249.1" cy="193.0" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="207.8" cy="208.5" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="160.3" cy="194.0" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="332.8" cy="192.0" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="296.7" cy="207.0" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="411.8" cy="191.1" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="380.5" cy="205.6" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="466.7" cy="165.7" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="486.5" cy="190.3" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="459.4" cy="204.3" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="154.5" cy="218.0" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="190.3" cy="229.3" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="193.2" cy="255.2" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="156.6" cy="270.6" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="117.9" cy="257.6" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="118.8" cy="231.0" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="222.5" cy="216.7" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="258.4" cy="227.7" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="264.9" cy="252.9" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="232.1" cy="267.8" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="287.5" cy="215.4" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="323.5" cy="226.2" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="333.2" cy="250.7" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="303.9" cy="265.2" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="349.8" cy="214.2" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="385.7" cy="224.7" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="398.4" cy="248.6" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="372.3" cy="262.7" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="237.7" cy="297.9" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="200.2" cy="316.4" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="157.8" cy="301.6" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="313.5" cy="294.3" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="280.3" cy="312.2" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="385.4" cy="290.9" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="356.1" cy="308.1" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="437.4" cy="260.3" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="453.8" cy="287.7" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/><circle cx="428.0" cy="304.3" r="5.8" fill="#1e293b" stroke="#0f172a" stroke-width="1.1"/>\n\n  </g>\n</svg>', "diamond": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 360" width="100%" role="img" aria-labelledby="title desc" class="chem-svg chem-svg--fluid" style="max-width:560px;height:auto;display:block;margin:0 auto;">\n  <title id="title">Carbon structure</title>\n  <desc id="desc">GCSE chemistry diagram of a carbon allotrope structure</desc>\n  <rect width="560" height="360" fill="#ffffff"/>\n  <g font-family="system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif">\n<line x1="178.2" y1="167.1" x2="203.1" y2="147.5" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="180.2" y1="198.4" x2="178.2" y2="167.1" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="203.1" y1="147.5" x2="232.9" y2="161.3" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="180.2" y1="198.4" x2="210.3" y2="211.8" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="235.8" y1="192.6" x2="232.9" y2="161.3" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="210.3" y1="211.8" x2="235.8" y2="192.6" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="203.1" y1="147.5" x2="200.4" y2="144.2" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="180.2" y1="198.4" x2="176.5" y2="197.5" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="235.8" y1="192.6" x2="234.6" y2="191.4" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="168.5" y1="129.4" x2="166.6" y2="97.6" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="142.8" y1="150.5" x2="168.5" y2="129.4" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="144.3" y1="183.2" x2="142.8" y2="150.5" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="119.0" y1="203.4" x2="144.3" y2="183.2" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="168.5" y1="129.4" x2="200.4" y2="144.2" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="144.3" y1="183.2" x2="176.5" y2="197.5" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="227.1" y1="122.9" x2="224.2" y2="91.1" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="200.4" y1="144.2" x2="227.1" y2="122.9" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="202.9" y1="177.0" x2="200.4" y2="144.2" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="176.5" y1="197.5" x2="202.9" y2="177.0" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="178.5" y1="231.3" x2="176.5" y2="197.5" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="227.1" y1="122.9" x2="258.5" y2="137.9" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="152.5" y1="250.9" x2="178.5" y2="231.3" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="202.9" y1="177.0" x2="234.6" y2="191.4" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="178.5" y1="231.3" x2="210.6" y2="245.1" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="262.1" y1="170.8" x2="258.5" y2="137.9" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="234.6" y1="191.4" x2="262.1" y2="170.8" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="237.7" y1="225.3" x2="234.6" y2="191.4" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="210.6" y1="245.1" x2="237.7" y2="225.3" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="262.1" y1="170.8" x2="293.4" y2="185.3" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="237.7" y1="225.3" x2="269.3" y2="239.3" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="168.5" y1="129.4" x2="164.0" y2="125.1" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="144.3" y1="183.2" x2="138.6" y2="181.5" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="227.1" y1="122.9" x2="225.4" y2="118.3" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="202.9" y1="177.0" x2="200.0" y2="175.0" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="178.5" y1="231.3" x2="174.5" y2="231.9" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="262.1" y1="170.8" x2="262.1" y2="168.4" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="237.7" y1="225.3" x2="236.5" y2="225.6" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="103.3" y1="131.8" x2="129.8" y2="109.2" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="104.1" y1="166.2" x2="103.3" y2="131.8" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="129.8" y1="109.2" x2="164.0" y2="125.1" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="104.1" y1="166.2" x2="138.6" y2="181.5" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="191.7" y1="102.2" x2="189.3" y2="68.9" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="164.0" y1="125.1" x2="191.7" y2="102.2" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="165.9" y1="159.5" x2="164.0" y2="125.1" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="138.6" y1="181.5" x2="165.9" y2="159.5" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="140.1" y1="217.0" x2="138.6" y2="181.5" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="191.7" y1="102.2" x2="225.4" y2="118.3" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="113.2" y1="238.0" x2="140.1" y2="217.0" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="165.9" y1="159.5" x2="200.0" y2="175.0" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="225.4" y1="118.3" x2="254.4" y2="95.2" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="140.1" y1="217.0" x2="174.5" y2="231.9" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="228.6" y1="152.8" x2="225.4" y2="118.3" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="200.0" y1="175.0" x2="228.6" y2="152.8" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="202.7" y1="210.6" x2="200.0" y2="175.0" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="254.4" y1="95.2" x2="287.5" y2="111.4" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="174.5" y1="231.9" x2="202.7" y2="210.6" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="176.7" y1="268.6" x2="174.5" y2="231.9" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="228.6" y1="152.8" x2="262.1" y2="168.4" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="202.7" y1="210.6" x2="236.5" y2="225.6" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="291.9" y1="146.0" x2="287.5" y2="111.4" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="262.1" y1="168.4" x2="291.9" y2="146.0" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="176.7" y1="268.6" x2="210.9" y2="282.9" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="265.9" y1="204.2" x2="262.1" y2="168.4" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="236.5" y1="225.6" x2="265.9" y2="204.2" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="239.9" y1="262.5" x2="236.5" y2="225.6" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="210.9" y1="282.9" x2="239.9" y2="262.5" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="265.9" y1="204.2" x2="299.3" y2="219.3" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="129.8" y1="109.2" x2="123.0" y2="103.6" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="104.1" y1="166.2" x2="96.0" y2="163.5" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="191.7" y1="102.2" x2="188.1" y2="96.2" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="165.9" y1="159.5" x2="161.0" y2="156.5" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="140.1" y1="217.0" x2="133.8" y2="216.9" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="254.4" y1="95.2" x2="253.9" y2="88.8" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="228.6" y1="152.8" x2="226.8" y2="149.4" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="202.7" y1="210.6" x2="199.6" y2="210.2" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="176.7" y1="268.6" x2="172.2" y2="271.2" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="291.9" y1="146.0" x2="293.4" y2="142.2" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="265.9" y1="204.2" x2="266.1" y2="203.4" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="239.9" y1="262.5" x2="238.7" y2="264.7" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="124.3" y1="139.8" x2="123.0" y2="103.6" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="96.0" y1="163.5" x2="124.3" y2="139.8" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="124.3" y1="139.8" x2="161.0" y2="156.5" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="190.7" y1="132.5" x2="188.1" y2="96.2" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="161.0" y1="156.5" x2="190.7" y2="132.5" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="163.0" y1="194.0" x2="161.0" y2="156.5" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="133.8" y1="216.9" x2="163.0" y2="194.0" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="190.7" y1="132.5" x2="226.8" y2="149.4" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="163.0" y1="194.0" x2="199.6" y2="210.2" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="257.9" y1="125.1" x2="253.9" y2="88.8" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="226.8" y1="149.4" x2="257.9" y2="125.1" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="230.2" y1="187.0" x2="226.8" y2="149.4" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="199.6" y1="210.2" x2="230.2" y2="187.0" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="202.4" y1="249.1" x2="199.6" y2="210.2" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="257.9" y1="125.1" x2="293.4" y2="142.2" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="172.2" y1="271.2" x2="202.4" y2="249.1" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="230.2" y1="187.0" x2="266.1" y2="203.4" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="202.4" y1="249.1" x2="238.7" y2="264.7" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="190.7" y1="132.5" x2="186.7" y2="127.8" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="163.0" y1="194.0" x2="157.6" y2="192.7" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="230.2" y1="187.0" x2="228.4" y2="185.3" stroke="#475569" stroke-width="1.7" stroke-linecap="round"/><line x1="119.0" y1="203.4" x2="112.8" y2="213.8" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="119.0" y1="203.4" x2="107.4" y2="209.3" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="119.0" y1="203.4" x2="110.8" y2="207.9" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="152.5" y1="250.9" x2="146.2" y2="261.1" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="152.5" y1="250.9" x2="140.8" y2="256.7" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="152.5" y1="250.9" x2="143.9" y2="254.9" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="113.2" y1="238.0" x2="106.7" y2="248.9" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="113.2" y1="238.0" x2="100.9" y2="244.2" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="113.2" y1="238.0" x2="104.5" y2="242.4" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="176.7" y1="268.6" x2="166.3" y2="276.2" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="210.9" y1="282.9" x2="215.8" y2="295.1" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="210.9" y1="282.9" x2="209.2" y2="291.4" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="239.9" y1="262.5" x2="252.4" y2="267.9" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="172.2" y1="271.2" x2="158.5" y2="276.6" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="172.2" y1="271.2" x2="165.2" y2="280.5" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="202.4" y1="249.1" x2="201.2" y2="249.7" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="238.7" y1="264.7" x2="248.8" y2="266.1" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="238.7" y1="264.7" x2="249.8" y2="274.1" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="104.1" y1="166.2" x2="94.3" y2="174.3" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="103.3" y1="131.8" x2="96.1" y2="132.4" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="103.3" y1="131.8" x2="94.4" y2="124.4" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="129.8" y1="109.2" x2="129.3" y2="96.7" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="96.0" y1="163.5" x2="82.0" y2="168.3" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="96.0" y1="163.5" x2="88.0" y2="171.2" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="124.3" y1="139.8" x2="121.6" y2="138.3" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="133.8" y1="216.9" x2="119.9" y2="222.0" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="133.8" y1="216.9" x2="126.3" y2="225.4" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="157.6" y1="192.7" x2="152.4" y2="187.7" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="157.6" y1="192.7" x2="153.3" y2="197.1" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="157.6" y1="192.7" x2="160.9" y2="191.6" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="228.4" y1="185.3" x2="224.5" y2="180.2" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="228.4" y1="185.3" x2="225.5" y2="189.6" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="228.4" y1="185.3" x2="233.2" y2="184.0" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="123.0" y1="103.6" x2="117.4" y2="89.9" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="123.0" y1="103.6" x2="123.7" y2="92.1" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="186.7" y1="127.8" x2="182.1" y2="121.6" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="186.7" y1="127.8" x2="183.0" y2="130.9" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="186.7" y1="127.8" x2="190.6" y2="125.4" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="180.2" y1="198.4" x2="171.0" y2="205.5" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="178.2" y1="167.1" x2="170.9" y2="167.2" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="178.2" y1="167.1" x2="169.7" y2="160.3" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="203.1" y1="147.5" x2="202.2" y2="136.1" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="210.3" y1="211.8" x2="214.6" y2="222.7" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="210.3" y1="211.8" x2="208.9" y2="220.0" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="235.8" y1="192.6" x2="246.9" y2="197.7" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="210.6" y1="245.1" x2="215.2" y2="256.6" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="210.6" y1="245.1" x2="209.0" y2="253.4" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="269.3" y1="239.3" x2="282.3" y2="242.7" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="269.3" y1="239.3" x2="278.4" y2="248.1" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="269.3" y1="239.3" x2="279.8" y2="241.5" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="299.3" y1="219.3" x2="313.1" y2="222.9" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="299.3" y1="219.3" x2="308.8" y2="228.8" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="299.3" y1="219.3" x2="310.2" y2="221.8" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="142.8" y1="150.5" x2="135.6" y2="150.7" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="142.8" y1="150.5" x2="134.1" y2="143.3" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="166.6" y1="97.6" x2="164.4" y2="88.9" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="166.6" y1="97.6" x2="163.3" y2="85.2" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="166.6" y1="97.6" x2="170.2" y2="86.3" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="254.4" y1="95.2" x2="253.0" y2="82.7" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="291.9" y1="146.0" x2="304.2" y2="151.9" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="257.9" y1="125.1" x2="257.8" y2="123.3" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="266.1" y1="203.4" x2="276.6" y2="203.9" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="266.1" y1="203.4" x2="277.4" y2="212.2" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="293.4" y1="142.2" x2="304.3" y2="141.8" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="293.4" y1="142.2" x2="304.9" y2="150.5" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="189.3" y1="68.9" x2="186.7" y2="59.9" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="189.3" y1="68.9" x2="185.7" y2="55.8" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="189.3" y1="68.9" x2="193.0" y2="57.1" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="188.1" y1="96.2" x2="182.8" y2="82.4" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="188.1" y1="96.2" x2="189.6" y2="84.6" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="253.9" y1="88.8" x2="248.9" y2="74.8" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="253.9" y1="88.8" x2="256.4" y2="77.0" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="232.9" y1="161.3" x2="243.9" y2="157.3" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="232.9" y1="161.3" x2="237.9" y2="155.0" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="293.4" y1="185.3" x2="306.4" y2="188.7" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="293.4" y1="185.3" x2="302.3" y2="194.3" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="293.4" y1="185.3" x2="303.6" y2="188.0" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="224.2" y1="91.1" x2="221.4" y2="82.4" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="224.2" y1="91.1" x2="220.8" y2="78.7" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="224.2" y1="91.1" x2="227.5" y2="79.8" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="258.5" y1="137.9" x2="270.1" y2="133.8" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="258.5" y1="137.9" x2="263.6" y2="131.5" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="287.5" y1="111.4" x2="299.7" y2="107.2" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><line x1="287.5" y1="111.4" x2="292.5" y2="105.0" stroke="#64748b" stroke-width="1.4" stroke-linecap="round"/><circle cx="178.2" cy="167.1" r="6.5" fill="#1e293b"/><circle cx="176.6" cy="165.5" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="232.9" cy="161.3" r="6.5" fill="#1e293b"/><circle cx="231.3" cy="159.7" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="210.3" cy="211.8" r="6.5" fill="#1e293b"/><circle cx="208.7" cy="210.2" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="203.1" cy="147.5" r="6.5" fill="#1e293b"/><circle cx="201.5" cy="145.9" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="180.2" cy="198.4" r="6.5" fill="#1e293b"/><circle cx="178.6" cy="196.8" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="235.8" cy="192.6" r="6.5" fill="#1e293b"/><circle cx="234.2" cy="191.0" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="166.6" cy="97.6" r="6.5" fill="#1e293b"/><circle cx="165.0" cy="96.0" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="142.8" cy="150.5" r="6.5" fill="#1e293b"/><circle cx="141.2" cy="148.9" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="119.0" cy="203.4" r="6.5" fill="#1e293b"/><circle cx="117.4" cy="201.8" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="224.2" cy="91.1" r="6.5" fill="#1e293b"/><circle cx="222.6" cy="89.5" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="200.4" cy="144.2" r="6.5" fill="#1e293b"/><circle cx="198.8" cy="142.6" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="176.5" cy="197.5" r="6.5" fill="#1e293b"/><circle cx="174.9" cy="195.9" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="152.5" cy="250.9" r="6.5" fill="#1e293b"/><circle cx="150.9" cy="249.3" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="258.5" cy="137.9" r="6.5" fill="#1e293b"/><circle cx="256.9" cy="136.3" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="234.6" cy="191.4" r="6.5" fill="#1e293b"/><circle cx="233.0" cy="189.8" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="210.6" cy="245.1" r="6.5" fill="#1e293b"/><circle cx="209.0" cy="243.5" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="168.5" cy="129.4" r="6.5" fill="#1e293b"/><circle cx="166.9" cy="127.8" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="293.4" cy="185.3" r="6.5" fill="#1e293b"/><circle cx="291.8" cy="183.7" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="144.3" cy="183.2" r="6.5" fill="#1e293b"/><circle cx="142.7" cy="181.6" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="269.3" cy="239.3" r="6.5" fill="#1e293b"/><circle cx="267.7" cy="237.7" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="227.1" cy="122.9" r="6.5" fill="#1e293b"/><circle cx="225.5" cy="121.3" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="202.9" cy="177.0" r="6.5" fill="#1e293b"/><circle cx="201.3" cy="175.4" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="178.5" cy="231.3" r="6.5" fill="#1e293b"/><circle cx="176.9" cy="229.7" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="262.1" cy="170.8" r="6.5" fill="#1e293b"/><circle cx="260.5" cy="169.2" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="237.7" cy="225.3" r="6.5" fill="#1e293b"/><circle cx="236.1" cy="223.7" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="103.3" cy="131.8" r="6.5" fill="#1e293b"/><circle cx="101.7" cy="130.2" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="189.3" cy="68.9" r="6.5" fill="#1e293b"/><circle cx="187.7" cy="67.3" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="164.0" cy="125.1" r="6.5" fill="#1e293b"/><circle cx="162.4" cy="123.5" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="138.6" cy="181.5" r="6.5" fill="#1e293b"/><circle cx="137.0" cy="179.9" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="113.2" cy="238.0" r="6.5" fill="#1e293b"/><circle cx="111.6" cy="236.4" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="225.4" cy="118.3" r="6.5" fill="#1e293b"/><circle cx="223.8" cy="116.7" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="200.0" cy="175.0" r="6.5" fill="#1e293b"/><circle cx="198.4" cy="173.4" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="174.5" cy="231.9" r="6.5" fill="#1e293b"/><circle cx="172.9" cy="230.3" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="287.5" cy="111.4" r="6.5" fill="#1e293b"/><circle cx="285.9" cy="109.8" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="129.8" cy="109.2" r="6.5" fill="#1e293b"/><circle cx="128.2" cy="107.6" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="262.1" cy="168.4" r="6.5" fill="#1e293b"/><circle cx="260.5" cy="166.8" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="104.1" cy="166.2" r="6.5" fill="#1e293b"/><circle cx="102.5" cy="164.6" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="236.5" cy="225.6" r="6.5" fill="#1e293b"/><circle cx="234.9" cy="224.0" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="210.9" cy="282.9" r="6.5" fill="#1e293b"/><circle cx="209.3" cy="281.3" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="191.7" cy="102.2" r="6.5" fill="#1e293b"/><circle cx="190.1" cy="100.6" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="165.9" cy="159.5" r="6.5" fill="#1e293b"/><circle cx="164.3" cy="157.9" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="299.3" cy="219.3" r="6.5" fill="#1e293b"/><circle cx="297.7" cy="217.7" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="140.1" cy="217.0" r="6.5" fill="#1e293b"/><circle cx="138.5" cy="215.4" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="254.4" cy="95.2" r="6.5" fill="#1e293b"/><circle cx="252.8" cy="93.6" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="228.6" cy="152.8" r="6.5" fill="#1e293b"/><circle cx="227.0" cy="151.2" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="202.7" cy="210.6" r="6.5" fill="#1e293b"/><circle cx="201.1" cy="209.0" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="176.7" cy="268.6" r="6.5" fill="#1e293b"/><circle cx="175.1" cy="267.0" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="291.9" cy="146.0" r="6.5" fill="#1e293b"/><circle cx="290.3" cy="144.4" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="265.9" cy="204.2" r="6.5" fill="#1e293b"/><circle cx="264.3" cy="202.6" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="239.9" cy="262.5" r="6.5" fill="#1e293b"/><circle cx="238.3" cy="260.9" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="123.0" cy="103.6" r="6.5" fill="#1e293b"/><circle cx="121.4" cy="102.0" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="96.0" cy="163.5" r="6.5" fill="#1e293b"/><circle cx="94.4" cy="161.9" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="188.1" cy="96.2" r="6.5" fill="#1e293b"/><circle cx="186.5" cy="94.6" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="161.0" cy="156.5" r="6.5" fill="#1e293b"/><circle cx="159.4" cy="154.9" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="133.8" cy="216.9" r="6.5" fill="#1e293b"/><circle cx="132.2" cy="215.3" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="253.9" cy="88.8" r="6.5" fill="#1e293b"/><circle cx="252.3" cy="87.2" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="226.8" cy="149.4" r="6.5" fill="#1e293b"/><circle cx="225.2" cy="147.8" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="199.6" cy="210.2" r="6.5" fill="#1e293b"/><circle cx="198.0" cy="208.6" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="172.2" cy="271.2" r="6.5" fill="#1e293b"/><circle cx="170.6" cy="269.6" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="293.4" cy="142.2" r="6.5" fill="#1e293b"/><circle cx="291.8" cy="140.6" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="124.3" cy="139.8" r="6.5" fill="#1e293b"/><circle cx="122.7" cy="138.2" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="266.1" cy="203.4" r="6.5" fill="#1e293b"/><circle cx="264.5" cy="201.8" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="238.7" cy="264.7" r="6.5" fill="#1e293b"/><circle cx="237.1" cy="263.1" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="190.7" cy="132.5" r="6.5" fill="#1e293b"/><circle cx="189.1" cy="130.9" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="163.0" cy="194.0" r="6.5" fill="#1e293b"/><circle cx="161.4" cy="192.4" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="257.9" cy="125.1" r="6.5" fill="#1e293b"/><circle cx="256.3" cy="123.5" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="230.2" cy="187.0" r="6.5" fill="#1e293b"/><circle cx="228.6" cy="185.4" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="202.4" cy="249.1" r="6.5" fill="#1e293b"/><circle cx="200.8" cy="247.5" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="186.7" cy="127.8" r="6.5" fill="#1e293b"/><circle cx="185.1" cy="126.2" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="157.6" cy="192.7" r="6.5" fill="#1e293b"/><circle cx="156.0" cy="191.1" r="2" fill="#64748b" fill-opacity="0.55"/><circle cx="228.4" cy="185.3" r="6.5" fill="#1e293b"/><circle cx="226.8" cy="183.7" r="2" fill="#64748b" fill-opacity="0.55"/>\n\n  </g>\n</svg>', "buckminsterfullerene": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 340" width="100%" role="img" aria-labelledby="title desc" class="chem-svg chem-svg--fluid" style="max-width:560px;height:auto;display:block;margin:0 auto;">\n  <title id="title">Carbon structure</title>\n  <desc id="desc">GCSE chemistry diagram of a carbon allotrope structure</desc>\n  <rect width="560" height="340" fill="#ffffff"/>\n  <g font-family="system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif">\n<line x1="189.5" y1="180.9" x2="218.5" y2="159.2" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="155.8" y1="168.1" x2="189.5" y2="180.9" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="189.5" y1="180.9" x2="191.3" y2="216.5" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="218.5" y1="159.2" x2="214.8" y2="123.2" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="251.6" y1="171.6" x2="218.5" y2="159.2" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="150.3" y1="132.0" x2="155.8" y2="168.1" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="134.1" y1="196.1" x2="155.8" y2="168.1" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="214.8" y1="123.2" x2="180.4" y2="108.8" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="180.4" y1="108.8" x2="150.3" y2="132.0" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="191.3" y1="216.5" x2="224.2" y2="231.8" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="191.3" y1="216.5" x2="156.8" y2="227.5" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="214.8" y1="123.2" x2="247.0" y2="110.5" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="255.7" y1="208.6" x2="251.6" y2="171.6" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="156.8" y1="227.5" x2="134.1" y2="196.1" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="271.3" y1="142.0" x2="251.6" y2="171.6" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="224.2" y1="231.8" x2="255.7" y2="208.6" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="150.3" y1="132.0" x2="120.8" y2="119.4" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="173.6" y1="78.3" x2="180.4" y2="108.8" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="247.0" y1="110.5" x2="271.3" y2="142.0" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="134.1" y1="196.1" x2="102.6" y2="188.7" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="225.7" y1="262.1" x2="224.2" y2="231.8" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="151.8" y1="257.4" x2="156.8" y2="227.5" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="255.7" y1="208.6" x2="281.9" y2="221.2" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="246.0" y1="78.9" x2="247.0" y2="110.5" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="299.7" y1="147.9" x2="271.3" y2="142.0" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="94.5" y1="147.9" x2="120.8" y2="119.4" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="120.8" y1="119.4" x2="134.1" y2="83.8" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="134.1" y1="83.8" x2="173.6" y2="78.3" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="94.5" y1="147.9" x2="102.6" y2="188.7" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="173.6" y1="78.3" x2="206.7" y2="60.9" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="225.7" y1="262.1" x2="187.8" y2="277.1" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="151.8" y1="257.4" x2="187.8" y2="277.1" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="246.0" y1="78.9" x2="206.7" y2="60.9" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="102.6" y1="188.7" x2="91.5" y2="217.1" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="263.6" y1="257.4" x2="225.7" y2="262.1" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="281.9" y1="221.2" x2="263.6" y2="257.4" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="281.9" y1="221.2" x2="306.6" y2="190.4" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="118.3" y1="255.0" x2="151.8" y2="257.4" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="306.6" y1="190.4" x2="299.7" y2="147.9" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="274.2" y1="78.1" x2="246.0" y2="78.9" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="76.1" y1="144.1" x2="94.5" y2="147.9" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="120.8" y1="71.3" x2="134.1" y2="83.8" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="299.7" y1="147.9" x2="304.2" y2="116.2" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="118.3" y1="255.0" x2="91.5" y2="217.1" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="206.7" y1="60.9" x2="203.1" y2="44.9" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="187.8" y1="277.1" x2="181.6" y2="291.1" stroke="#d1d5db" stroke-width="1.15" stroke-linecap="round"/><line x1="274.2" y1="78.1" x2="304.2" y2="116.2" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="91.5" y1="217.1" x2="73.1" y2="191.4" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="268.0" y1="268.9" x2="263.6" y2="257.4" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="317.2" y1="192.4" x2="306.6" y2="190.4" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="133.1" y1="276.2" x2="118.3" y2="255.0" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="73.1" y1="191.4" x2="76.1" y2="144.1" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="249.2" y1="55.8" x2="274.2" y2="78.1" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="88.7" y1="102.9" x2="76.1" y2="144.1" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="120.8" y1="71.3" x2="88.7" y2="102.9" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="156.3" y1="49.6" x2="120.8" y2="71.3" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="304.2" y1="116.2" x2="316.0" y2="141.0" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="181.6" y1="291.1" x2="133.1" y2="276.2" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="203.1" y1="44.9" x2="249.2" y2="55.8" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="203.1" y1="44.9" x2="156.3" y2="49.6" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="181.6" y1="291.1" x2="223.7" y2="287.9" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="316.0" y1="141.0" x2="317.2" y2="192.4" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="223.7" y1="287.9" x2="268.0" y2="268.9" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="268.0" y1="268.9" x2="297.1" y2="235.0" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="297.1" y1="235.0" x2="317.2" y2="192.4" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="83.3" y1="206.1" x2="73.1" y2="191.4" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="133.1" y1="276.2" x2="117.2" y2="254.1" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="88.7" y1="102.9" x2="101.4" y2="105.4" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="254.8" y1="74.9" x2="249.2" y2="55.8" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="149.1" y1="67.9" x2="156.3" y2="49.6" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="316.0" y1="141.0" x2="292.4" y2="123.1" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="83.3" y1="206.1" x2="117.2" y2="254.1" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="219.1" y1="266.0" x2="223.7" y2="287.9" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="297.1" y1="235.0" x2="270.3" y2="228.8" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="101.4" y1="105.4" x2="149.1" y2="67.9" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="99.2" y1="161.9" x2="83.3" y2="206.1" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="292.4" y1="123.1" x2="254.8" y2="74.9" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="101.4" y1="105.4" x2="99.2" y2="161.9" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="117.2" y1="254.1" x2="160.2" y2="246.5" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="254.8" y1="74.9" x2="201.5" y2="82.9" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="149.1" y1="67.9" x2="201.5" y2="82.9" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="270.3" y1="228.8" x2="219.1" y2="266.0" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="219.1" y1="266.0" x2="160.2" y2="246.5" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="266.4" y1="167.7" x2="292.4" y2="123.1" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="266.4" y1="167.7" x2="270.3" y2="228.8" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="150.5" y1="184.8" x2="99.2" y2="161.9" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="160.2" y1="246.5" x2="150.5" y2="184.8" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="201.5" y1="82.9" x2="205.6" y2="143.0" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="205.6" y1="143.0" x2="266.4" y2="167.7" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><line x1="150.5" y1="184.8" x2="205.6" y2="143.0" stroke="#334155" stroke-width="1.7" stroke-linecap="round"/><circle cx="189.5" cy="180.9" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="218.5" cy="159.2" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="155.8" cy="168.1" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="191.3" cy="216.5" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="214.8" cy="123.2" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="251.6" cy="171.6" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="150.3" cy="132.0" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="180.4" cy="108.8" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="134.1" cy="196.1" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="224.2" cy="231.8" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="156.8" cy="227.5" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="255.7" cy="208.6" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="247.0" cy="110.5" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="271.3" cy="142.0" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="120.8" cy="119.4" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="173.6" cy="78.3" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="102.6" cy="188.7" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="225.7" cy="262.1" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="151.8" cy="257.4" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="281.9" cy="221.2" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="94.5" cy="147.9" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="246.0" cy="78.9" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="134.1" cy="83.8" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="299.7" cy="147.9" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="206.7" cy="60.9" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="187.8" cy="277.1" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="263.6" cy="257.4" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="306.6" cy="190.4" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="91.5" cy="217.1" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="118.3" cy="255.0" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="274.2" cy="78.1" r="4" fill="#c0c6ce" stroke="#94a3b8" stroke-width="0.7"/><circle cx="304.2" cy="116.2" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="76.1" cy="144.1" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="120.8" cy="71.3" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="203.1" cy="44.9" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="181.6" cy="291.1" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="73.1" cy="191.4" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="268.0" cy="268.9" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="133.1" cy="276.2" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="317.2" cy="192.4" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="88.7" cy="102.9" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="249.2" cy="55.8" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="156.3" cy="49.6" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="316.0" cy="141.0" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="223.7" cy="287.9" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="297.1" cy="235.0" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="83.3" cy="206.1" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="117.2" cy="254.1" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="101.4" cy="105.4" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="254.8" cy="74.9" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="149.1" cy="67.9" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="292.4" cy="123.1" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="219.1" cy="266.0" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="270.3" cy="228.8" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="99.2" cy="161.9" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="160.2" cy="246.5" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="201.5" cy="82.9" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="266.4" cy="167.7" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="150.5" cy="184.8" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="205.6" cy="143.0" r="5.1" fill="#1e293b" stroke="#0f172a" stroke-width="1"/>\n\n  </g>\n</svg>', "carbon_nanotube": '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 320" width="100%" role="img" aria-labelledby="title desc" class="chem-svg chem-svg--fluid" style="max-width:560px;height:auto;display:block;margin:0 auto;">\n  <title id="title">Carbon structure</title>\n  <desc id="desc">GCSE chemistry diagram of a carbon allotrope structure</desc>\n  <rect width="560" height="320" fill="#ffffff"/>\n  <g font-family="system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif">\n<line x1="342.6" y1="139.8" x2="362.1" y2="157.8" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="349.5" y1="112.0" x2="342.0" y2="137.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="362.1" y1="157.8" x2="366.2" y2="178.8" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="320.9" y1="145.9" x2="342.6" y2="139.8" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="342.0" y1="137.6" x2="320.2" y2="143.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="342.2" y1="91.9" x2="349.5" y2="112.0" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="320.5" y1="144.8" x2="318.3" y2="170.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="305.3" y1="123.9" x2="320.5" y2="144.8" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="318.8" y1="171.7" x2="320.9" y2="145.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="320.2" y1="143.6" x2="305.2" y2="122.7" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="366.2" y1="178.8" x2="344.5" y2="186.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="319.5" y1="96.6" x2="342.2" y2="91.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="364.2" y1="68.3" x2="342.8" y2="89.8" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="346.1" y1="188.2" x2="367.9" y2="180.3" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="342.8" y1="89.8" x2="320.1" y2="94.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="344.5" y1="186.6" x2="318.8" y2="171.7" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="305.2" y1="122.7" x2="319.5" y2="96.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="319.4" y1="172.7" x2="345.3" y2="187.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="319.8" y1="95.5" x2="305.2" y2="121.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="318.3" y1="170.6" x2="294.2" y2="178.3" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="280.7" y1="129.8" x2="305.3" y2="123.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="295.4" y1="180.5" x2="319.4" y2="172.7" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="305.2" y1="121.5" x2="280.6" y2="127.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="294.2" y1="178.3" x2="272.2" y2="158.3" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="272.2" y1="158.3" x2="280.7" y2="129.8" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="272.6" y1="159.6" x2="294.8" y2="179.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="280.7" y1="128.6" x2="271.9" y2="157.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="369.6" y1="56.2" x2="364.2" y2="68.3" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="316.7" y1="77.4" x2="319.8" y2="95.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="320.1" y1="94.4" x2="317.3" y2="76.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="294.8" y1="179.4" x2="295.9" y2="204.0" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="245.6" y1="167.2" x2="272.6" y2="159.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="271.9" y1="157.1" x2="244.9" y2="164.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="268.9" y1="107.1" x2="280.7" y2="128.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="296.6" y1="204.9" x2="295.4" y2="180.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="280.6" y1="127.4" x2="269.1" y2="105.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="245.3" y1="165.9" x2="240.4" y2="195.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="225.8" y1="143.2" x2="245.3" y2="165.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="241.0" y1="196.7" x2="245.6" y2="167.2" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="244.9" y1="164.6" x2="225.7" y2="141.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="290.4" y1="82.0" x2="316.7" y2="77.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="317.3" y1="76.5" x2="345.4" y2="60.0" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="345.4" y1="60.0" x2="369.6" y2="56.2" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="269.1" y1="105.9" x2="290.4" y2="82.0" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="295.9" y1="204.0" x2="268.6" y2="213.8" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="317.9" y1="75.6" x2="291.5" y2="80.2" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="346.3" y1="59.4" x2="317.9" y2="75.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="240.5" y1="112.9" x2="268.9" y2="107.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="290.9" y1="81.1" x2="269.3" y2="104.8" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="270.1" y1="215.7" x2="297.4" y2="205.8" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="371.6" y1="55.2" x2="347.3" y2="59.0" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="269.3" y1="104.8" x2="240.9" y2="110.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="268.6" y1="213.8" x2="241.0" y2="196.7" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="225.7" y1="141.9" x2="240.5" y2="112.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="241.5" y1="197.9" x2="269.4" y2="214.7" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="240.7" y1="111.7" x2="225.6" y2="140.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="240.4" y1="195.5" x2="210.1" y2="205.2" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="194.9" y1="150.7" x2="225.8" y2="143.2" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="211.3" y1="207.7" x2="241.5" y2="197.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="225.6" y1="140.5" x2="194.6" y2="147.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="210.1" y1="205.2" x2="184.6" y2="182.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="184.6" y1="182.9" x2="194.9" y2="150.7" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="185.0" y1="184.3" x2="210.7" y2="206.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="194.8" y1="149.3" x2="184.2" y2="181.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="290.6" y1="68.5" x2="290.9" y2="81.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="231.0" y1="92.5" x2="240.7" y2="111.7" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="291.5" y1="80.2" x2="291.4" y2="68.0" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="240.9" y1="110.5" x2="231.4" y2="91.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="210.7" y1="206.4" x2="207.0" y2="235.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="150.7" y1="194.0" x2="185.0" y2="184.3" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="184.2" y1="181.5" x2="149.9" y2="191.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="176.3" y1="126.2" x2="194.8" y2="149.3" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="207.6" y1="237.0" x2="211.3" y2="207.7" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="194.6" y1="147.9" x2="176.3" y2="124.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="150.3" y1="192.6" x2="141.5" y2="227.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="124.8" y1="167.7" x2="150.3" y2="192.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="142.0" y1="228.5" x2="150.7" y2="194.0" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="149.9" y1="191.1" x2="124.5" y2="166.2" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="197.2" y1="98.4" x2="231.0" y2="92.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="231.4" y1="91.5" x2="259.4" y2="73.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="259.4" y1="73.4" x2="290.6" y2="68.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="176.3" y1="124.9" x2="197.2" y2="98.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="207.0" y1="235.9" x2="171.9" y2="248.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="231.8" y1="90.6" x2="197.8" y2="96.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="260.1" y1="72.9" x2="231.8" y2="90.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="139.8" y1="133.7" x2="176.3" y2="126.2" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="197.5" y1="97.5" x2="176.4" y2="123.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="173.1" y1="250.8" x2="208.3" y2="238.0" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="292.2" y1="67.5" x2="260.9" y2="72.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="176.4" y1="123.6" x2="139.6" y2="131.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="171.9" y1="248.5" x2="142.0" y2="228.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="124.5" y1="166.2" x2="139.8" y2="133.7" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="142.5" y1="229.9" x2="172.5" y2="249.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="139.7" y1="132.4" x2="124.2" y2="164.8" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="141.5" y1="227.1" x2="102.2" y2="239.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="84.8" y1="177.4" x2="124.8" y2="167.7" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="103.2" y1="242.6" x2="142.5" y2="229.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="124.2" y1="164.8" x2="84.1" y2="174.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="102.2" y1="239.6" x2="71.9" y2="214.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="71.9" y1="214.6" x2="84.8" y2="177.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="72.4" y1="216.2" x2="102.7" y2="241.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="84.4" y1="175.9" x2="71.5" y2="213.0" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="187.5" y1="84.6" x2="197.5" y2="97.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="119.4" y1="112.1" x2="139.7" y2="132.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="197.8" y1="96.5" x2="188.1" y2="84.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="139.6" y1="131.1" x2="119.5" y2="111.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="102.7" y1="241.1" x2="91.1" y2="277.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="27.3" y1="228.9" x2="72.4" y2="216.2" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="71.5" y1="213.0" x2="26.3" y2="225.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="55.6" y1="151.1" x2="84.4" y2="175.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="91.5" y1="278.8" x2="103.2" y2="242.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="84.1" y1="174.4" x2="55.3" y2="149.7" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="11.9" y1="270.3" x2="27.3" y2="228.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="26.3" y1="225.6" x2="-8.4" y2="198.3" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="74.4" y1="120.1" x2="119.4" y2="112.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="119.5" y1="111.1" x2="145.9" y2="91.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="145.9" y1="91.1" x2="187.5" y2="84.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="55.3" y1="149.7" x2="74.4" y2="120.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="91.1" y1="277.4" x2="44.2" y2="294.2" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="119.6" y1="110.1" x2="74.2" y2="118.0" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="146.3" y1="90.6" x2="119.6" y2="110.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="6.8" y1="161.2" x2="55.6" y2="151.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="74.3" y1="119.0" x2="55.0" y2="148.3" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="44.9" y1="297.1" x2="92.0" y2="280.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="188.6" y1="83.6" x2="146.7" y2="90.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="55.0" y1="148.3" x2="5.8" y2="158.3" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="44.2" y1="294.2" x2="11.9" y2="270.3" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="-8.4" y1="198.3" x2="6.8" y2="161.2" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="47.7" y1="106.5" x2="74.3" y2="119.0" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="74.2" y1="118.0" x2="47.7" y2="105.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="5.8" y1="158.3" x2="-32.2" y2="137.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="-32.2" y1="137.6" x2="-10.6" y2="115.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="-10.6" y1="115.6" x2="47.7" y2="106.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="47.7" y1="105.4" x2="-11.2" y2="114.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="367.9" y1="180.3" x2="397.3" y2="187.7" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="345.3" y1="187.4" x2="352.0" y2="204.7" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="352.9" y1="205.2" x2="346.1" y2="188.2" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="327.1" y1="214.4" x2="296.6" y2="204.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="297.4" y1="205.8" x2="328.1" y2="214.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="405.2" y1="48.7" x2="371.6" y2="55.2" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="269.4" y1="214.7" x2="271.0" y2="236.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="271.9" y1="237.0" x2="270.1" y2="215.7" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="354.1" y1="56.3" x2="346.3" y2="59.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="347.3" y1="59.0" x2="355.3" y2="56.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="239.1" y1="248.9" x2="207.6" y2="237.0" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="208.3" y1="238.0" x2="239.9" y2="249.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="291.4" y1="68.0" x2="325.7" y2="60.7" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="326.8" y1="60.7" x2="292.2" y2="67.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="172.5" y1="249.6" x2="165.8" y2="277.7" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="166.4" y1="278.5" x2="173.1" y2="250.8" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="260.3" y1="70.7" x2="260.1" y2="72.9" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="260.9" y1="72.4" x2="261.2" y2="70.8" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="123.3" y1="294.3" x2="91.5" y2="278.8" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="92.0" y1="280.1" x2="123.8" y2="295.3" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="188.1" y1="84.1" x2="222.3" y2="76.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="223.1" y1="76.6" x2="188.6" y2="83.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="23.4" y1="334.7" x2="44.9" y2="297.1" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="132.7" y1="90.1" x2="146.3" y2="90.6" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="146.7" y1="90.1" x2="133.3" y2="90.3" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="47.7" y1="105.9" x2="79.3" y2="98.3" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="79.7" y1="98.5" x2="47.7" y2="105.4" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="-11.2" y1="114.6" x2="-51.0" y2="118.5" stroke="#d1d5db" stroke-width="1.25" stroke-linecap="round"/><line x1="397.3" y1="187.7" x2="408.2" y2="195.5" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="352.0" y1="204.7" x2="327.1" y2="214.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="385.5" y1="204.9" x2="352.9" y2="205.2" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="408.2" y1="195.5" x2="385.5" y2="204.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="329.0" y1="215.4" x2="353.9" y2="205.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="353.9" y1="205.6" x2="386.6" y2="204.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="387.6" y1="204.8" x2="410.3" y2="195.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="410.3" y1="195.4" x2="442.5" y2="183.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="328.1" y1="214.9" x2="334.3" y2="226.2" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="335.3" y1="226.2" x2="329.0" y2="215.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="442.5" y1="183.7" x2="448.9" y2="170.5" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="386.6" y1="204.9" x2="394.9" y2="203.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="417.6" y1="57.0" x2="405.2" y2="48.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="395.9" y1="203.2" x2="387.6" y2="204.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="450.2" y1="168.2" x2="470.2" y2="136.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="453.3" y1="75.1" x2="419.9" y2="58.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="271.0" y1="236.4" x2="239.1" y2="248.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="448.9" y1="170.5" x2="425.0" y2="180.0" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="305.2" y1="238.2" x2="271.9" y2="237.0" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="334.3" y1="226.2" x2="305.2" y2="238.2" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="392.3" y1="61.4" x2="417.6" y2="57.0" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="240.7" y1="250.3" x2="272.7" y2="237.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="272.7" y1="237.6" x2="306.1" y2="238.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="425.0" y1="180.0" x2="395.9" y2="203.2" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="426.3" y1="177.6" x2="450.2" y2="168.2" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="368.5" y1="214.9" x2="335.3" y2="226.2" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="394.9" y1="203.8" x2="368.5" y2="214.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="355.3" y1="56.4" x2="392.3" y2="61.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="419.9" y1="58.3" x2="394.6" y2="62.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="396.8" y1="202.6" x2="425.7" y2="178.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="325.7" y1="60.7" x2="354.1" y2="56.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="307.0" y1="238.4" x2="336.3" y2="226.2" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="336.3" y1="226.2" x2="369.4" y2="214.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="393.4" y1="62.0" x2="356.4" y2="56.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="370.2" y1="213.7" x2="396.8" y2="202.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="356.4" y1="56.4" x2="327.9" y2="60.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="470.2" y1="136.6" x2="456.5" y2="109.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="455.6" y1="106.0" x2="453.3" y2="75.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="425.7" y1="178.8" x2="421.0" y2="155.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="401.6" y1="84.9" x2="393.4" y2="62.0" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="421.2" y1="153.7" x2="426.3" y2="177.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="456.5" y1="109.1" x2="431.5" y2="116.2" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="430.6" y1="113.0" x2="455.6" y2="106.0" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="394.6" y1="62.7" x2="402.5" y2="86.2" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="239.9" y1="249.6" x2="238.1" y2="266.0" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="238.9" y1="266.2" x2="240.7" y2="250.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="369.4" y1="214.3" x2="370.1" y2="201.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="306.1" y1="238.3" x2="307.5" y2="240.5" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="334.0" y1="71.4" x2="326.8" y2="60.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="370.7" y1="200.7" x2="370.2" y2="213.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="308.2" y1="239.9" x2="307.0" y2="238.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="327.9" y1="60.8" x2="335.1" y2="72.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="431.5" y1="116.2" x2="421.2" y2="153.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="402.5" y1="86.2" x2="430.6" y2="113.0" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="421.3" y1="152.1" x2="431.0" y2="114.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="431.0" y1="114.6" x2="403.4" y2="87.5" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="421.0" y1="155.3" x2="392.8" y2="165.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="372.3" y1="91.2" x2="401.6" y2="84.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="392.9" y1="161.9" x2="421.3" y2="152.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="403.4" y1="87.5" x2="374.1" y2="94.0" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="392.8" y1="165.3" x2="370.7" y2="200.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="335.1" y1="72.1" x2="372.3" y2="91.2" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="371.2" y1="199.4" x2="392.9" y2="163.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="373.2" y1="92.6" x2="336.2" y2="72.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="165.8" y1="277.7" x2="123.3" y2="294.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="370.1" y1="201.9" x2="338.3" y2="214.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="199.3" y1="282.1" x2="166.4" y2="278.5" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="238.1" y1="266.0" x2="199.3" y2="282.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="300.2" y1="77.1" x2="334.0" y2="71.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="124.2" y1="296.2" x2="167.0" y2="279.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="167.0" y1="279.4" x2="199.9" y2="282.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="338.3" y1="214.6" x2="308.2" y2="239.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="339.3" y1="212.0" x2="371.2" y2="199.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="272.1" y1="255.3" x2="238.9" y2="266.2" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="307.5" y1="240.5" x2="272.1" y2="255.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="261.2" y1="70.8" x2="300.2" y2="77.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="336.2" y1="72.9" x2="302.3" y2="78.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="309.0" y1="239.3" x2="338.8" y2="213.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="222.3" y1="76.5" x2="260.3" y2="70.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="200.5" y1="282.7" x2="239.6" y2="266.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="239.6" y1="266.4" x2="272.8" y2="254.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="301.2" y1="78.0" x2="262.2" y2="70.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="273.4" y1="254.2" x2="309.0" y2="239.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="262.2" y1="70.9" x2="224.0" y2="76.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="392.9" y1="163.6" x2="373.4" y2="132.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="372.4" y1="129.2" x2="373.2" y2="92.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="372.9" y1="131.0" x2="392.9" y2="161.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="374.1" y1="94.0" x2="372.9" y2="131.0" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="338.8" y1="213.3" x2="326.5" y2="188.5" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="303.6" y1="106.0" x2="301.2" y2="78.0" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="326.5" y1="186.7" x2="339.3" y2="212.0" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="373.4" y1="132.8" x2="339.5" y2="142.5" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="338.4" y1="138.7" x2="372.4" y2="129.2" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="302.3" y1="78.8" x2="304.5" y2="107.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="123.8" y1="295.3" x2="107.7" y2="320.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="108.0" y1="320.6" x2="124.2" y2="296.2" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="272.8" y1="254.8" x2="263.3" y2="244.5" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="199.9" y1="282.4" x2="188.7" y2="290.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="220.5" y1="90.8" x2="223.1" y2="76.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="263.7" y1="243.2" x2="273.4" y2="254.2" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="189.1" y1="289.9" x2="200.5" y2="282.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="224.0" y1="76.7" x2="221.5" y2="91.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="339.5" y1="142.5" x2="326.5" y2="186.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="304.5" y1="107.6" x2="338.4" y2="138.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="326.4" y1="184.9" x2="338.9" y2="140.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="338.9" y1="140.6" x2="305.4" y2="109.2" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="326.5" y1="188.5" x2="287.3" y2="202.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="262.9" y1="114.7" x2="303.6" y2="106.0" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="287.1" y1="198.5" x2="326.4" y2="184.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="305.4" y1="109.2" x2="264.7" y2="118.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="287.3" y1="202.3" x2="263.7" y2="243.2" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="221.5" y1="91.8" x2="262.9" y2="114.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="264.0" y1="241.8" x2="287.2" y2="200.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="263.8" y1="116.4" x2="222.4" y2="92.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="263.3" y1="244.5" x2="218.8" y2="262.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="53.3" y1="342.7" x2="23.4" y2="334.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="107.7" y1="320.1" x2="53.3" y2="342.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="173.2" y1="98.9" x2="220.5" y2="90.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="218.8" y1="262.3" x2="189.1" y2="289.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="219.1" y1="259.6" x2="264.0" y2="241.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="139.0" y1="311.1" x2="108.0" y2="320.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="188.7" y1="290.3" x2="139.0" y2="311.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="133.3" y1="90.3" x2="173.2" y2="98.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="222.4" y1="92.8" x2="174.9" y2="101.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="189.5" y1="289.4" x2="219.0" y2="260.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="79.3" y1="98.3" x2="132.7" y2="90.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="53.4" y1="343.9" x2="108.3" y2="321.0" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="108.3" y1="321.0" x2="139.2" y2="310.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="174.0" y1="100.0" x2="133.8" y2="90.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="139.4" y1="310.3" x2="189.5" y2="289.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="133.8" y1="90.6" x2="80.1" y2="98.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="287.2" y1="200.4" x2="258.4" y2="165.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="257.3" y1="161.4" x2="263.8" y2="116.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="257.9" y1="163.5" x2="287.1" y2="198.5" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="264.7" y1="118.1" x2="257.9" y2="163.5" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="219.0" y1="260.9" x2="192.6" y2="235.5" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="164.8" y1="135.9" x2="174.0" y2="100.0" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="192.3" y1="233.4" x2="219.1" y2="259.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="258.4" y1="165.6" x2="209.6" y2="179.6" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="208.3" y1="175.0" x2="257.3" y2="161.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="174.9" y1="101.1" x2="165.6" y2="137.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="139.2" y1="310.7" x2="110.4" y2="305.5" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="58.0" y1="118.7" x2="79.7" y2="98.5" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="110.2" y1="304.1" x2="139.4" y2="310.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="17.7" y1="361.7" x2="53.4" y2="343.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="80.1" y1="98.8" x2="58.5" y2="119.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="209.6" y1="179.6" x2="192.3" y2="233.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="165.6" y1="137.9" x2="208.3" y2="175.0" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="192.0" y1="231.3" x2="209.0" y2="177.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="209.0" y1="177.3" x2="166.4" y2="139.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="192.6" y1="235.5" x2="134.7" y2="255.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="104.7" y1="148.8" x2="164.8" y2="135.9" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="133.8" y1="251.4" x2="192.0" y2="231.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="166.4" y1="139.8" x2="106.3" y2="153.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="134.7" y1="255.9" x2="110.2" y2="304.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="58.5" y1="119.9" x2="104.7" y2="148.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="110.0" y1="302.8" x2="134.3" y2="253.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="105.5" y1="151.0" x2="59.0" y2="121.3" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="110.4" y1="305.5" x2="43.6" y2="332.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="-13.1" y1="130.8" x2="58.0" y2="118.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="43.6" y1="332.1" x2="17.7" y2="361.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="42.5" y1="329.4" x2="110.0" y2="302.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="-51.0" y1="118.5" x2="-13.1" y2="130.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="59.0" y1="121.3" x2="-12.6" y2="133.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="134.3" y1="253.7" x2="88.7" y2="214.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="87.2" y1="208.8" x2="105.5" y2="151.0" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="87.9" y1="211.5" x2="133.8" y2="251.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="106.3" y1="153.1" x2="87.9" y2="211.5" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="-12.3" y1="304.7" x2="42.5" y2="329.4" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="88.7" y1="214.1" x2="12.5" y2="235.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="10.9" y1="230.1" x2="87.2" y2="208.8" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="-12.6" y1="133.8" x2="-46.4" y2="184.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="12.5" y1="235.8" x2="-12.3" y2="304.7" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><line x1="-46.4" y1="184.1" x2="10.9" y2="230.1" stroke="#334155" stroke-width="1.9" stroke-linecap="round"/><circle cx="362.1" cy="157.8" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="349.5" cy="112.0" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="342.6" cy="139.8" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="342.0" cy="137.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="320.5" cy="144.8" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="320.9" cy="145.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="320.2" cy="143.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="366.2" cy="178.8" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="342.2" cy="91.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="367.9" cy="180.3" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="342.8" cy="89.8" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="318.3" cy="170.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="305.3" cy="123.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="318.8" cy="171.7" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="305.2" cy="122.7" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="319.4" cy="172.7" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="305.2" cy="121.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="364.2" cy="68.3" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="344.5" cy="186.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="319.5" cy="96.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="345.3" cy="187.4" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="319.8" cy="95.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="346.1" cy="188.2" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="320.1" cy="94.4" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="294.2" cy="178.3" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="280.7" cy="129.8" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="294.8" cy="179.4" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="280.7" cy="128.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="295.4" cy="180.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="280.6" cy="127.4" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="272.2" cy="158.3" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="272.6" cy="159.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="271.9" cy="157.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="245.3" cy="165.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="245.6" cy="167.2" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="244.9" cy="164.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="316.7" cy="77.4" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="317.3" cy="76.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="369.6" cy="56.2" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="295.9" cy="204.0" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="317.9" cy="75.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="268.9" cy="107.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="296.6" cy="204.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="269.1" cy="105.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="297.4" cy="205.8" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="371.6" cy="55.2" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="269.3" cy="104.8" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="240.4" cy="195.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="225.8" cy="143.2" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="241.0" cy="196.7" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="225.7" cy="141.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="241.5" cy="197.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="225.6" cy="140.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="290.4" cy="82.0" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="290.9" cy="81.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="345.4" cy="60.0" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="268.6" cy="213.8" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="291.5" cy="80.2" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="240.5" cy="112.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="346.3" cy="59.4" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="269.4" cy="214.7" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="240.7" cy="111.7" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="270.1" cy="215.7" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="347.3" cy="59.0" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="240.9" cy="110.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="210.1" cy="205.2" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="194.9" cy="150.7" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="210.7" cy="206.4" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="194.8" cy="149.3" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="211.3" cy="207.7" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="194.6" cy="147.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="184.6" cy="182.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="185.0" cy="184.3" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="184.2" cy="181.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="150.3" cy="192.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="150.7" cy="194.0" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="149.9" cy="191.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="231.0" cy="92.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="231.4" cy="91.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="290.6" cy="68.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="207.0" cy="235.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="231.8" cy="90.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="176.3" cy="126.2" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="291.4" cy="68.0" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="207.6" cy="237.0" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="176.3" cy="124.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="208.3" cy="238.0" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="292.2" cy="67.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="176.4" cy="123.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="141.5" cy="227.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="124.8" cy="167.7" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="142.0" cy="228.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="124.5" cy="166.2" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="142.5" cy="229.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="124.2" cy="164.8" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="197.2" cy="98.4" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="197.5" cy="97.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="259.4" cy="73.4" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="171.9" cy="248.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="197.8" cy="96.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="139.8" cy="133.7" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="260.1" cy="72.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="172.5" cy="249.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="139.7" cy="132.4" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="173.1" cy="250.8" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="260.9" cy="72.4" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="139.6" cy="131.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="102.2" cy="239.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="84.8" cy="177.4" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="102.7" cy="241.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="84.4" cy="175.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="103.2" cy="242.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="84.1" cy="174.4" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="71.9" cy="214.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="72.4" cy="216.2" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="71.5" cy="213.0" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="27.3" cy="228.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="26.3" cy="225.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="119.4" cy="112.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="119.5" cy="111.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="187.5" cy="84.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="91.1" cy="277.4" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="119.6" cy="110.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="55.6" cy="151.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="188.1" cy="84.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="91.5" cy="278.8" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="55.3" cy="149.7" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="92.0" cy="280.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="188.6" cy="83.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="55.0" cy="148.3" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="11.9" cy="270.3" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="-8.4" cy="198.3" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="74.4" cy="120.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="74.3" cy="119.0" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="145.9" cy="91.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="44.2" cy="294.2" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="74.2" cy="118.0" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="6.8" cy="161.2" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="146.3" cy="90.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="44.9" cy="297.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="146.7" cy="90.1" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="5.8" cy="158.3" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="-32.2" cy="137.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="47.7" cy="106.5" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="47.7" cy="105.9" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="47.7" cy="105.4" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="-10.6" cy="115.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="-11.2" cy="114.6" r="4.3" fill="#c0c6ce" stroke="#b0b7c0" stroke-width="0.6"/><circle cx="397.3" cy="187.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="352.0" cy="204.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="352.9" cy="205.2" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="408.2" cy="195.5" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="353.9" cy="205.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="410.3" cy="195.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="327.1" cy="214.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="328.1" cy="214.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="385.5" cy="204.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="329.0" cy="215.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="386.6" cy="204.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="387.6" cy="204.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="442.5" cy="183.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="405.2" cy="48.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="271.0" cy="236.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="448.9" cy="170.5" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="271.9" cy="237.0" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="334.3" cy="226.2" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="417.6" cy="57.0" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="272.7" cy="237.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="335.3" cy="226.2" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="450.2" cy="168.2" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="394.9" cy="203.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="419.9" cy="58.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="354.1" cy="56.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="336.3" cy="226.2" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="395.9" cy="203.2" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="355.3" cy="56.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="396.8" cy="202.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="356.4" cy="56.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="470.2" cy="136.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="453.3" cy="75.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="239.1" cy="248.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="425.0" cy="180.0" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="239.9" cy="249.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="305.2" cy="238.2" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="392.3" cy="61.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="425.7" cy="178.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="240.7" cy="250.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="393.4" cy="62.0" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="306.1" cy="238.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="426.3" cy="177.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="368.5" cy="214.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="394.6" cy="62.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="325.7" cy="60.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="307.0" cy="238.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="369.4" cy="214.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="326.8" cy="60.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="370.2" cy="213.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="456.5" cy="109.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="455.6" cy="106.0" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="327.9" cy="60.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="431.5" cy="116.2" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="430.6" cy="113.0" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="431.0" cy="114.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="421.0" cy="155.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="401.6" cy="84.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="421.2" cy="153.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="402.5" cy="86.2" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="421.3" cy="152.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="403.4" cy="87.5" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="165.8" cy="277.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="370.1" cy="201.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="166.4" cy="278.5" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="238.1" cy="266.0" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="334.0" cy="71.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="370.7" cy="200.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="167.0" cy="279.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="335.1" cy="72.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="238.9" cy="266.2" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="371.2" cy="199.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="307.5" cy="240.5" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="336.2" cy="72.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="260.3" cy="70.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="239.6" cy="266.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="308.2" cy="239.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="261.2" cy="70.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="309.0" cy="239.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="262.2" cy="70.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="392.8" cy="165.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="372.3" cy="91.2" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="392.9" cy="163.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="373.2" cy="92.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="392.9" cy="161.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="374.1" cy="94.0" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="123.3" cy="294.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="338.3" cy="214.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="123.8" cy="295.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="199.3" cy="282.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="300.2" cy="77.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="338.8" cy="213.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="124.2" cy="296.2" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="301.2" cy="78.0" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="199.9" cy="282.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="339.3" cy="212.0" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="272.1" cy="255.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="302.3" cy="78.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="222.3" cy="76.5" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="200.5" cy="282.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="272.8" cy="254.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="223.1" cy="76.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="273.4" cy="254.2" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="373.4" cy="132.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="372.4" cy="129.2" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="372.9" cy="131.0" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="224.0" cy="76.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="339.5" cy="142.5" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="338.4" cy="138.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="338.9" cy="140.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="326.5" cy="188.5" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="303.6" cy="106.0" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="326.5" cy="186.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="304.5" cy="107.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="326.4" cy="184.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="305.4" cy="109.2" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="263.3" cy="244.5" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="23.4" cy="334.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="107.7" cy="320.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="220.5" cy="90.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="263.7" cy="243.2" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="221.5" cy="91.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="108.0" cy="320.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="264.0" cy="241.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="188.7" cy="290.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="222.4" cy="92.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="132.7" cy="90.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="108.3" cy="321.0" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="189.1" cy="289.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="133.3" cy="90.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="189.5" cy="289.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="133.8" cy="90.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="287.3" cy="202.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="262.9" cy="114.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="287.2" cy="200.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="263.8" cy="116.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="287.1" cy="198.5" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="264.7" cy="118.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="218.8" cy="262.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="53.3" cy="342.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="173.2" cy="98.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="219.0" cy="260.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="174.0" cy="100.0" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="219.1" cy="259.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="139.0" cy="311.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="174.9" cy="101.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="79.3" cy="98.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="53.4" cy="343.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="139.2" cy="310.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="79.7" cy="98.5" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="139.4" cy="310.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="258.4" cy="165.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="257.3" cy="161.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="257.9" cy="163.5" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="80.1" cy="98.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="209.6" cy="179.6" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="208.3" cy="175.0" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="209.0" cy="177.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="192.6" cy="235.5" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="164.8" cy="135.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="192.3" cy="233.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="165.6" cy="137.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="192.0" cy="231.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="166.4" cy="139.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="110.4" cy="305.5" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="58.0" cy="118.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="110.2" cy="304.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="58.5" cy="119.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="110.0" cy="302.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="59.0" cy="121.3" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="17.7" cy="361.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="-51.0" cy="118.5" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="134.7" cy="255.9" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="104.7" cy="148.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="134.3" cy="253.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="105.5" cy="151.0" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="133.8" cy="251.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="106.3" cy="153.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="43.6" cy="332.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="-13.1" cy="130.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="42.5" cy="329.4" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="-12.6" cy="133.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="88.7" cy="214.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="87.2" cy="208.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="87.9" cy="211.5" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="12.5" cy="235.8" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="10.9" cy="230.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="-12.3" cy="304.7" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/><circle cx="-46.4" cy="184.1" r="5.2" fill="#1e293b" stroke="#0f172a" stroke-width="1"/>\n\n  </g>\n</svg>' };
  }
});

// src/chemistryWorkflow.js
var chemistryWorkflow_exports = {};
__export(chemistryWorkflow_exports, {
  CHEMISTRY_PRESETS: () => CHEMISTRY_PRESETS,
  ELEMENT_DATA: () => ELEMENT_DATA,
  answerStateFromKey: () => answerStateFromKey,
  applyChemistryPresetToForm: () => applyChemistryPresetToForm,
  buildAtomConfigFromForm: () => buildAtomConfigFromForm,
  buildAtomDiagramConfig: () => buildAtomDiagramConfig,
  buildChemistryConfigFromForm: () => buildChemistryConfigFromForm,
  buildChemistryStemHtml: () => buildChemistryStemHtml,
  buildOrganicConfigFromForm: () => buildOrganicConfigFromForm,
  buildOrganicDiagramConfig: () => buildOrganicDiagramConfig,
  chemistryStemSourceFromQuestion: () => chemistryStemSourceFromQuestion,
  collectChemistryResponse: () => collectChemistryResponse,
  covSharedElectronStyle: () => covSharedElectronStyle,
  covalentSharedElectronPositions: () => covalentSharedElectronPositions,
  displayStateFromPresetOrConfig: () => displayStateFromPresetOrConfig,
  distributeElectrons: () => distributeElectrons,
  equationHasStudentFormulas: () => equationHasStudentFormulas,
  equationRequiresStates: () => equationRequiresStates,
  finalizeBalanceEquationConfig: () => finalizeBalanceEquationConfig,
  formatEquationSpeciesList: () => formatEquationSpeciesList,
  formatEquationSpeciesToken: () => formatEquationSpeciesToken,
  getChemistryConfig: () => getChemistryConfig,
  halfEquationLayout: () => halfEquationLayout,
  initialStateForConfig: () => initialStateForConfig,
  isIonFormula: () => isIonFormula,
  layoutCovalentAtoms: () => layoutCovalentAtoms,
  listStemDiagramPresets: () => listStemDiagramPresets,
  markChemistryResponse: () => markChemistryResponse,
  normalizeIonFormula: () => normalizeIonFormula,
  normalizeMoleculeAtomSymbols: () => normalizeMoleculeAtomSymbols,
  normalizeMoleculeBondEdges: () => normalizeMoleculeBondEdges,
  normalizeMoleculeGraph: () => normalizeMoleculeGraph,
  parseEquationSpeciesList: () => parseEquationSpeciesList,
  parseEquationSpeciesToken: () => parseEquationSpeciesToken,
  parseHalfSlot: () => parseHalfSlot,
  populateChemistryPresetSelect: () => populateChemistryPresetSelect,
  questionHasChemistryStem: () => questionHasChemistryStem,
  renderChemistryModelAnswerHtml: () => renderChemistryModelAnswerHtml,
  renderChemistryWorkflow: () => renderChemistryWorkflow,
  renderDisplayedFormulaSvg: () => renderDisplayedFormulaSvg,
  renderIonicLatticeSvg: () => renderIonicLatticeSvg,
  renderMetallicBondingSvg: () => renderMetallicBondingSvg,
  renderMoleculeBuilderSvg: () => renderMoleculeBuilderSvg,
  renderParticleModelSvg: () => renderParticleModelSvg,
  renderPolymerRepeatUnitSvg: () => renderPolymerRepeatUnitSvg,
  renderStemDiagramSvg: () => renderStemDiagramSvg,
  resolveStemDiagramSource: () => resolveStemDiagramSource,
  shellsForElement: () => shellsForElement,
  stemPreviewHtml: () => stemPreviewHtml,
  svgMarkupToPngBlob: () => svgMarkupToPngBlob,
  symbolFromProtons: () => symbolFromProtons,
  wireChemistryWorkflow: () => wireChemistryWorkflow
});
function getChemistryConfig(q) {
  let cfg = q?.chemistry_config;
  if (!cfg) return null;
  if (typeof cfg === "string") {
    try {
      cfg = JSON.parse(cfg);
    } catch {
      return null;
    }
  }
  if (!cfg || typeof cfg !== "object") return null;
  return cfg;
}
function questionHasChemistryStem(q) {
  const cfg = getChemistryConfig(q);
  if (!cfg?.kind || !cfg?.answer) return false;
  if (!CHEM_STEM_KINDS.has(cfg.kind)) return false;
  if (q?.question_type === "chemistry_interactive") return false;
  if ((q?.image_url || "").trim()) return false;
  return true;
}
function chemistryStemSourceFromQuestion(q) {
  const cfg = getChemistryConfig(q);
  if (!cfg?.answer) return null;
  return {
    kind: cfg.kind,
    template: cfg.template || {},
    answer: cfg.answer
  };
}
function buildChemistryStemHtml(q) {
  if (!questionHasChemistryStem(q)) return "";
  const src = chemistryStemSourceFromQuestion(q);
  if (!src) return "";
  return stemPreviewHtml(src);
}
function shellsForElement(symbol, ionElectrons = null) {
  const data = ELEMENT_DATA[symbol];
  if (!data) return [0];
  if (ionElectrons == null) return [...data.shells];
  return distributeElectrons(ionElectrons);
}
function distributeElectrons(n) {
  const shells = [];
  let remaining = Math.max(0, Math.floor(n));
  for (const cap of SHELL_CAPS) {
    if (remaining <= 0) break;
    const take = Math.min(cap, remaining);
    shells.push(take);
    remaining -= take;
  }
  if (remaining > 0) shells.push(remaining);
  return shells.length ? shells : [0];
}
function escapeHtml2(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}
function parseEquationSpeciesToken(raw) {
  const part = String(raw || "").trim();
  if (!part) return null;
  const pieces = part.split(":");
  let side = "left";
  let formulaPart = part;
  if (pieces.length >= 2) {
    const last = pieces[pieces.length - 1].trim().toLowerCase();
    if (last === "left" || last === "right") {
      side = last;
      formulaPart = pieces.slice(0, -1).join(":").trim();
    }
  }
  let studentEntersFormula = false;
  if (formulaPart.startsWith("?")) {
    studentEntersFormula = true;
    formulaPart = formulaPart.slice(1).trim();
  }
  let state = "";
  const stateMatch = formulaPart.match(STATE_SUFFIX_RE);
  if (stateMatch) {
    formulaPart = stateMatch[1].trim();
    state = stateMatch[2].toLowerCase();
  }
  if (!formulaPart) return null;
  const species = { formula: formulaPart, side };
  if (state) species.state = state;
  if (studentEntersFormula) species.studentEntersFormula = true;
  return species;
}
function parseEquationSpeciesList(raw) {
  return String(raw || "").split(",").map((part) => parseEquationSpeciesToken(part)).filter(Boolean);
}
function formatEquationSpeciesToken(sp) {
  if (!sp?.formula) return "";
  const prefix = sp.studentEntersFormula ? "?" : "";
  const state = sp.state ? `(${sp.state})` : "";
  return `${prefix}${sp.formula}${state}:${sp.side || "left"}`;
}
function formatEquationSpeciesList(species) {
  return (species || []).map(formatEquationSpeciesToken).filter(Boolean).join(", ");
}
function equationRequiresStates(species) {
  return (species || []).some((sp) => STATE_SYMBOLS.includes(String(sp?.state || "")));
}
function equationHasStudentFormulas(species) {
  return (species || []).some((sp) => sp?.studentEntersFormula);
}
function normalizeIonFormula(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  s = s.replace(/[\u00B9\u00B2\u00B3\u2070-\u207F\u2212\u2013\u2014]/g, (ch) => SUPER_DIGIT_MAP[ch] || ch);
  s = s.replace(/\s+/g, "");
  s = s.replace(/\^\{([^}]+)\}/g, "$1");
  s = s.replace(/\^([0-9]*[+-])/g, "$1");
  if (/^e[-+]?$/i.test(s)) return "e-";
  return s;
}
function isIonFormula(formula) {
  const n = normalizeIonFormula(formula);
  return /[0-9]*[+-]$/.test(n);
}
function parseHalfSlot(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  let coeff = 1;
  let rest = trimmed;
  const m = rest.match(/^(\d+)\s*([A-Za-z].*)$/);
  if (m) {
    coeff = Number(m[1]);
    rest = m[2];
  }
  const formula = normalizeIonFormula(rest);
  if (!formula) return null;
  return { coeff, formula };
}
function isElectronFormula(formula) {
  return normalizeIonFormula(formula) === "e-";
}
function halfEquationLayout(answer, template) {
  const explicit = template?.halfLayout || answer?.halfLayout;
  if (explicit === "anion" || explicit === "cation") return explicit;
  const extras = answer?.extraSpecies || template?.extraSpecies || [];
  const eOnRight = extras.some((x) => isElectronFormula(x.formula) && x.side === "right");
  return eOnRight ? "anion" : "cation";
}
function equationTermsFromAnswer(answer, cfg) {
  const species = answer?.species || cfg?.template?.species || [];
  const coeffs = answer?.coeffs || [];
  const extras = answer?.extraSpecies || cfg?.template?.extraSpecies || [];
  const terms = species.map((sp, i) => ({
    side: sp.side === "right" ? "right" : "left",
    formula: sp.formula,
    coeff: impliedCoeff(coeffs[i]),
    state: sp.state || ""
  }));
  extras.forEach((ex) => {
    terms.push({
      side: ex.side === "right" ? "right" : "left",
      formula: ex.formula,
      coeff: impliedCoeff(ex.coeff),
      state: ex.state || ""
    });
  });
  return terms;
}
function formulaCountMap(terms) {
  const left = {};
  const right = {};
  for (const t of terms || []) {
    const bag = t.side === "right" ? right : left;
    const key = normalizeIonFormula(t.formula);
    if (!key) continue;
    bag[key] = (bag[key] || 0) + (Number(t.coeff) || 1);
  }
  return { left, right };
}
function sameFormulaKeys(a, b) {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  return keysA.length === keysB.length && keysA.every((k, i) => k === keysB[i]);
}
function gcdOfMaps(...maps) {
  const vals = maps.flatMap((m) => Object.values(m)).filter((n) => n > 0);
  return vals.length ? vals.reduce((a, b) => gcd(a, b), vals[0]) : 1;
}
function scaleCoeffMap(map, g) {
  const out = {};
  for (const [k, v] of Object.entries(map)) out[k] = v / g;
  return out;
}
function mapsEqual(a, b) {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => a[k] === b[k]);
}
function sameBalancedEquation(want, got) {
  const gWant = gcdOfMaps(want.left, want.right);
  const gGot = gcdOfMaps(got.left, got.right);
  return mapsEqual(scaleCoeffMap(want.left, gWant), scaleCoeffMap(got.left, gGot)) && mapsEqual(scaleCoeffMap(want.right, gWant), scaleCoeffMap(got.right, gGot));
}
function formulaMarkFeedback(formulaSpecies, resp, species) {
  let sawIon = false;
  let sawCase = false;
  for (const sp of formulaSpecies) {
    const idx = species.indexOf(sp);
    const got = String(resp.formulas?.[idx] ?? "").trim();
    const want = sp.formula;
    if (normalizeIonFormula(got) === normalizeIonFormula(want)) continue;
    const caseOnly = normalizeIonFormula(got).toLowerCase() === normalizeIonFormula(want).toLowerCase();
    if (caseOnly) sawCase = true;
    else if (isIonFormula(want)) sawIon = true;
    else sawCase = true;
  }
  if (sawIon) return "Ion formula is incorrect.";
  if (sawCase) return "Check chemical formula case (Co is cobalt, CO is carbon monoxide).";
  return "Chemical formula is incorrect.";
}
function formatBalanceCaption(answer, cfg) {
  const terms = equationTermsFromAnswer(answer, cfg);
  if (!terms.length) {
    const coeffs = answer?.coeffs || [];
    return Array.isArray(coeffs) ? `Coefficients: [${coeffs.join(", ")}]` : "";
  }
  const omitStates = (cfg?.template?.subtype || answer?.subtype) === "half";
  const fmt = (t) => {
    const coeffLabel = t.coeff > 1 ? String(t.coeff) : "";
    const st = !omitStates && t.state ? `(${t.state})` : "";
    return `${coeffLabel}${t.formula}${st}`;
  };
  const left = terms.filter((t) => t.side !== "right").map(fmt);
  const right = terms.filter((t) => t.side === "right").map(fmt);
  return `${left.join(" + ")} \u2192 ${right.join(" + ")}`;
}
function renderStateSelect(value, attr, extra = false) {
  const selected = String(value || "");
  const cls = extra ? "chem-state-select chem-extra-state" : "chem-state-select";
  const options = [
    ["", "\u2014"],
    ["s", "(s)"],
    ["l", "(l)"],
    ["g", "(g)"],
    ["aq", "(aq)"]
  ].map(([v, lab]) => `<option value="${v}"${selected === v ? " selected" : ""}>${lab}</option>`).join("");
  return `<select class="${cls}" ${attr} aria-label="State symbol">${options}</select>`;
}
function electronPositions(cx, cy, r, count, shellIndex = 1) {
  const pts = [];
  const n = Math.max(0, count);
  if (n === 0) return pts;
  if (shellIndex === 0) {
    const angles = [-Math.PI / 2, Math.PI / 2];
    for (let i = 0; i < n; i++) {
      const angle = angles[i % angles.length];
      pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }
    return pts;
  }
  if (n > 8) {
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + 2 * Math.PI * i / n;
      pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    }
    return pts;
  }
  const pairCentres = [-Math.PI / 2, Math.PI / 2, Math.PI, 0];
  const spread = 0.28;
  for (let i = 0; i < n; i++) {
    const centre = pairCentres[Math.floor(i / 2) % 4];
    const angle = centre + (i % 2 === 0 ? -spread : spread);
    pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return pts;
}
function atomOuterRadius(shellCount, baseR = 28, gap = 22) {
  return baseR + Math.max(shellCount - 1, 0) * gap;
}
function renderIonBrackets(cx, cy, outerR, charge) {
  const pad = 14;
  const left = cx - outerR - pad;
  const right = cx + outerR + pad;
  const top = cy - outerR - pad;
  const bottom = cy + outerR + pad;
  const tip = 14;
  let svg = "";
  svg += `<path d="M${left + tip} ${top} L${left} ${top} L${left} ${bottom} L${left + tip} ${bottom}" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"/>`;
  svg += `<path d="M${right - tip} ${top} L${right} ${top} L${right} ${bottom} L${right - tip} ${bottom}" fill="none" stroke="#0f172a" stroke-width="3" stroke-linecap="square" stroke-linejoin="miter"/>`;
  if (charge != null && charge !== 0) {
    svg += `<text x="${right + 6}" y="${top + 18}" fill="#b91c1c" font-size="20" font-weight="800">${fmtCharge(charge)}</text>`;
  }
  return svg;
}
function renderAtomSvg(opts) {
  const {
    cx,
    cy,
    symbol,
    shells,
    showNucleus = true,
    protons,
    neutrons,
    charge = null,
    interactive = true,
    atomId = "atom",
    maxShells = null,
    brackets = false,
    baseR = 28,
    gap = 22
  } = opts;
  const shellList = Array.isArray(shells) ? shells : [];
  const shellCount = maxShells || Math.max(shellList.length, 1);
  let svg = "";
  if (showNucleus) {
    svg += `<circle class="chem-nucleus" data-atom="${escapeHtml2(atomId)}" cx="${cx}" cy="${cy}" r="18" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>`;
    const p = protons ?? ELEMENT_DATA[symbol]?.Z ?? "?";
    const n = neutrons ?? Math.round((ELEMENT_DATA[symbol]?.A || p) - p);
    svg += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" fill="#f8fafc" font-size="10" font-weight="700">${escapeHtml2(symbol)}</text>`;
    svg += `<text x="${cx}" y="${cy + 9}" text-anchor="middle" fill="#94a3b8" font-size="8">${p}p ${n}n</text>`;
  } else {
    svg += `<circle cx="${cx}" cy="${cy}" r="14" fill="#334155"/>`;
    svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#f8fafc" font-size="11" font-weight="700">${escapeHtml2(symbol)}</text>`;
  }
  if (!brackets && charge != null && charge !== 0) {
    const label = charge > 0 ? `+${charge}` : `${charge}`;
    svg += `<text x="${cx + 22}" y="${cy - 20}" fill="#dc2626" font-size="14" font-weight="800">${label}</text>`;
  }
  if (interactive) {
    for (let s = shellCount - 1; s >= 0; s--) {
      const r = baseR + s * gap;
      svg += `<circle class="chem-shell-hitarea" data-atom="${escapeHtml2(atomId)}" data-shell="${s}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#93c5fd" stroke-opacity="0.35" stroke-width="18" pointer-events="stroke" tabindex="0" role="button" aria-label="Add electron to shell ${s + 1}" style="cursor:pointer"/>`;
    }
  }
  for (let s = 0; s < shellCount; s++) {
    const r = baseR + s * gap;
    const count = shellList[s] || 0;
    svg += `<circle class="chem-shell" data-atom="${escapeHtml2(atomId)}" data-shell="${s}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4 3" style="pointer-events:none"/>`;
    const pts = electronPositions(cx, cy, r, count, s);
    pts.forEach((pt, ei) => {
      const fill = interactive ? "#2563eb" : "#059669";
      const stroke = interactive ? "#1e40af" : "#047857";
      const pe = interactive ? "all" : "none";
      svg += `<circle class="chem-electron" data-atom="${escapeHtml2(atomId)}" data-shell="${s}" data-e="${ei}" cx="${pt.x}" cy="${pt.y}" r="6" fill="${fill}" stroke="${stroke}" stroke-width="1" tabindex="${interactive ? "0" : "-1"}" role="${interactive ? "button" : "presentation"}" aria-label="${interactive ? `Remove electron from shell ${s + 1}` : ""}" style="cursor:${interactive ? "pointer" : "default"};pointer-events:${pe}"/>`;
      if (interactive) {
        svg += `<circle class="chem-electron-hit" data-atom="${escapeHtml2(atomId)}" data-shell="${s}" data-e="${ei}" cx="${pt.x}" cy="${pt.y}" r="12" fill="transparent" stroke="none" tabindex="-1" aria-hidden="true" style="cursor:pointer;pointer-events:all"/>`;
      }
    });
  }
  if (brackets) {
    svg += renderIonBrackets(cx, cy, atomOuterRadius(shellCount, baseR, gap), charge);
  }
  return svg;
}
function renderCovElectron(x, y, style = "dot", color = "#2563eb") {
  if (style === "cross") {
    const s = 5;
    return `<g stroke="${color}" stroke-width="2.2" stroke-linecap="round">
      <line x1="${x - s}" y1="${y - s}" x2="${x + s}" y2="${y + s}"/>
      <line x1="${x + s}" y1="${y - s}" x2="${x - s}" y2="${y + s}"/>
    </g>`;
  }
  return `<circle cx="${x}" cy="${y}" r="4.5" fill="${color}" stroke="${color}" stroke-width="1"/>`;
}
function renderChemistryModelAnswerHtml(answer, opts = {}) {
  if (!answer || typeof answer !== "object") return "";
  const title = opts.title || "Correct answer";
  const compare = opts.compare || null;
  const kind = answer.kind;
  let diagram = "";
  let caption = "";
  if (kind === "electron_shell" || Array.isArray(answer.shells)) {
    const symbol = answer.symbol || "X";
    const shells = answer.shells || [];
    const answerShells = Math.max(shells.length, 1);
    const studentShells = compare && Array.isArray(compare.shells) ? occupiedShellCount(compare.shells) : answerShells;
    const { size, baseR, gap, cx, cy, maxShells } = shellAnswerViewport(
      Math.max(answerShells, studentShells, 1)
    );
    const atomOpts = {
      cx,
      cy,
      symbol,
      shells,
      protons: answer.nucleus?.p,
      neutrons: answer.nucleus?.n,
      charge: null,
      brackets: false,
      interactive: false,
      maxShells,
      baseR,
      gap
    };
    diagram = `<svg class="chem-svg chem-answer-svg chem-answer-svg--shell" viewBox="0 0 ${size} ${size}" width="100%" style="height:auto;display:block;margin:0 auto;" aria-label="Model electron shell diagram">
      ${renderAtomSvg({ ...atomOpts, atomId: "answer" })}
    </svg>`;
    caption = `Shells [${shells.join(", ")}]`;
    if (compare && Array.isArray(compare.shells)) {
      const studentSvg = `<svg class="chem-svg chem-answer-svg chem-answer-svg--shell" viewBox="0 0 ${size} ${size}" width="100%" style="height:auto;display:block;margin:0 auto;" aria-label="Your electron shell diagram">
        ${renderAtomSvg({
        cx,
        cy,
        symbol: compare.symbol || symbol,
        shells: compare.shells || [],
        protons: compare.nucleus?.p ?? answer.nucleus?.p,
        neutrons: compare.nucleus?.n ?? answer.nucleus?.n,
        charge: null,
        brackets: false,
        interactive: false,
        atomId: "student",
        maxShells,
        baseR,
        gap
      })}
      </svg>`;
      return `
        <div class="chem-model-answer">
          <div class="chem-model-answer-title">${escapeHtml2(title)}</div>
          <div class="chem-answer-compare">
            <div class="chem-answer-panel">
              <div class="chem-answer-panel-label">Your answer</div>
              ${studentSvg}
              <div class="chem-answer-caption">[${(compare.shells || []).join(", ")}]</div>
            </div>
            <div class="chem-answer-panel chem-answer-panel-correct">
              <div class="chem-answer-panel-label">Mark scheme</div>
              ${diagram}
              <div class="chem-answer-caption">${escapeHtml2(caption)}</div>
            </div>
          </div>
        </div>`;
    }
  } else if (kind === "ionic_bonding") {
    const ions = ionicAnswerAtoms(answer);
    if (!ions.length) return "";
    const { w, h, positions, baseR, gap } = layoutIonicAtoms(ions);
    const ionSvgs = ions.map((ion, i) => renderIonicDotCrossAtomSvg({
      cx: positions[i].x,
      cy: positions[i].y,
      symbol: ion.symbol,
      shells: ion.shells,
      style: ion.style || (i % 2 === 0 ? "dot" : "cross"),
      brackets: ion.brackets !== false,
      charge: ion.charge,
      interactive: false,
      atomIdx: i,
      baseR,
      gap
    })).join("");
    diagram = `<svg class="chem-svg chem-answer-svg chem-answer-svg--wide chem-svg--fluid" viewBox="0 0 ${w} ${h}" width="100%" style="display:block;margin:0 auto;" preserveAspectRatio="xMidYMid meet">${ionSvgs}</svg>`;
    caption = ions.map((ion) => `${ion.symbol}${fmtCharge(ion.charge)}`).join(" + ");
  } else if (kind === "organic_structure") {
    diagram = renderDisplayedFormulaSvg({
      carbons: answer.carbons,
      carbonBonds: answer.carbonBonds || [],
      groups: answer.groups || [],
      name: answer.name || answer.family || "",
      family: answer.family
    }, { interactive: false });
    caption = answer.name || answer.family || "organic structure";
  } else if (kind === "polymer_structure") {
    diagram = renderPolymerDisplaySvg(answer, { template: opts.template || {} });
    caption = answer.name || answer.selectedRepeat || "polymer";
  } else if (kind === "molecule_builder") {
    diagram = renderMoleculeBuilderSvg(answer, { interactive: false });
    caption = moleculeBuilderCaption(answer);
  } else if (kind === "metallic_bonding") {
    diagram = renderMetallicBondingSvg(answer);
    caption = "Metal atoms \u2192 positive ions in a sea of delocalised electrons";
  } else if (kind === "particle_model") {
    diagram = renderParticleModelSvg(answer);
    const stateLabel = particleModelStateLabel(answer.state || answer.phase);
    caption = stateLabel ? `Particle model \u2014 ${stateLabel}` : "Particle model";
  } else if (kind === "carbon_allotrope") {
    diagram = renderCarbonAllotropeSvg(answer.allotrope);
    caption = CARBON_ALLOTROPE_LABELS[answer.allotrope] || answer.allotrope || "Carbon allotrope";
  } else if (kind === "balance_equation" && Array.isArray(answer.coeffs)) {
    caption = formatBalanceCaption(answer, { template: opts.template || {} });
  } else if (kind === "covalent_bonding") {
    const wrap = renderCovalentDiagram({
      kind: "covalent_bonding",
      atoms: answer.atoms || [],
      bonds: answer.bonds || []
    }, { interactive: false });
    const match = wrap.match(/<svg[\s\S]*<\/svg>/);
    diagram = match ? match[0] : "";
    const pairs = (answer.bonds || []).map((b) => b.sharedPairs).join(", ");
    caption = `Shared pairs: [${pairs || "\u2014"}]`;
  } else {
    return "";
  }
  return `
    <div class="chem-model-answer">
      <div class="chem-model-answer-title">${escapeHtml2(title)}</div>
      ${diagram}
      ${caption ? `<div class="chem-answer-caption">${escapeHtml2(caption)}</div>` : ""}
    </div>`;
}
function initialStateForConfig(cfg) {
  if (!cfg) return {};
  const kind = cfg.kind;
  if (kind === "electron_shell") {
    const symbol = cfg.template?.symbol || "C";
    const data = ELEMENT_DATA[symbol] || ELEMENT_DATA.C;
    const shellCount = cfg.template?.shellCount || data.shells.length;
    return {
      kind,
      symbol,
      shells: Array(shellCount).fill(0),
      nucleus: {
        p: cfg.template?.protons ?? data.Z,
        n: cfg.template?.neutrons ?? Math.round(data.A - data.Z)
      }
    };
  }
  if (kind === "ionic_bonding") {
    const specs = ionicTemplateAtoms(cfg.template);
    return {
      kind,
      atoms: specs.map((spec) => ({
        symbol: spec.symbol,
        shells: shellsForElement(spec.symbol),
        charge: 0,
        brackets: false,
        style: spec.style
      })),
      selectedElectron: null,
      transferred: 0
    };
  }
  if (kind === "covalent_bonding") {
    const atoms = cfg.template?.atoms || [
      { symbol: "H", lonePairs: 0 },
      { symbol: "H", lonePairs: 0 }
    ];
    const bonds = cfg.template?.bonds || [{ a: 0, b: 1, maxPairs: 1 }];
    return {
      kind,
      atoms: atoms.map((a) => ({
        symbol: a.symbol,
        loneElectrons: emptyLoneElectronCounts()
      })),
      bonds: bonds.map((b) => ({
        a: b.a,
        b: b.b,
        sharedCount: 0,
        maxPairs: b.maxPairs ?? 1
      }))
    };
  }
  if (kind === "organic_structure") {
    const carbons = cfg.template?.carbons ?? 2;
    const family = cfg.template?.family || "alkane";
    const cBonds = [];
    for (let i = 0; i < carbons - 1; i++) {
      cBonds.push({ from: i, to: i + 1, order: 1 });
    }
    return {
      kind,
      family,
      carbons,
      carbonBonds: cBonds,
      groups: Array(carbons).fill(null).map(() => []),
      selectedGroup: family === "alcohol" ? "OH" : family === "carboxylic_acid" ? "COOH" : family === "ester" ? "COO" : null
    };
  }
  if (kind === "polymer_structure") {
    return {
      kind,
      mode: cfg.template?.mode || "addition",
      selectedRepeat: null,
      selectedLinkage: null
    };
  }
  if (kind === "molecule_builder") {
    const allowed = cfg.template?.allowedSymbols || ["H", "C", "N", "O", "Cl"];
    return {
      kind,
      atoms: [],
      bonds: [],
      selectedSymbol: allowed[0] || "H",
      mode: "add",
      bondFrom: null,
      nextAtomId: 1
    };
  }
  if (kind === "balance_equation") {
    const species = cfg.template?.species || [];
    const subtype = cfg.template?.subtype || "symbol";
    return {
      kind,
      subtype,
      coeffs: species.map(() => null),
      formulas: species.map(() => ""),
      states: species.map(() => ""),
      extraSpecies: [],
      halfSlots: subtype === "half" ? ["", "", ""] : []
    };
  }
  return { kind };
}
function answerStateFromKey(cfg, key) {
  const payload = key?.key_payload || cfg?.answer || {};
  if (!payload || !payload.kind) {
    const state = initialStateForConfig(cfg);
    if (cfg?.kind === "electron_shell" && payload.shells) {
      state.shells = [...payload.shells];
      if (payload.nucleus) state.nucleus = { ...payload.nucleus };
    }
    return Object.keys(payload).length ? { ...state, ...payload, kind: cfg.kind } : state;
  }
  return deepClone(payload);
}
function toolbarHtml(cfg) {
  const kind = cfg.kind;
  let tools = "";
  if (kind === "electron_shell") {
    tools = `<p class="chem-hint">Tap a shell ring to add an electron. Tap an electron to remove it.</p>`;
  }
  if (kind === "ionic_bonding") {
    tools = `<p class="chem-hint">Tap an electron to select it, then tap another atom to transfer it. Toggle square brackets and set ion charges manually for each atom.</p>`;
  }
  if (kind === "covalent_bonding") {
    tools = `<p class="chem-hint">Tap a bond overlap or shell edge to add one electron (\u25CF / \u2715). Tap an electron to remove it.</p>`;
  }
  if (kind === "organic_structure") {
    const family = cfg.template?.family || "alkane";
    const groupButtons = [];
    if (family === "alcohol" || family === "alkane" || family === "alkene") {
      groupButtons.push(`<button type="button" class="btn chem-btn chem-group-btn" data-chem-group="OH">\u2013OH</button>`);
    }
    if (family === "carboxylic_acid") {
      groupButtons.push(`<button type="button" class="btn chem-btn chem-group-btn" data-chem-group="COOH">\u2013COOH</button>`);
    }
    if (family === "ester") {
      groupButtons.push(`<button type="button" class="btn chem-btn chem-group-btn" data-chem-group="COO">\u2013COO\u2013</button>`);
    }
    groupButtons.push(`<button type="button" class="btn chem-btn chem-group-btn" data-chem-group="H">\u2013H</button>`);
    groupButtons.push(`<button type="button" class="btn chem-btn chem-group-btn" data-chem-group="clear">Clear C</button>`);
    tools = `
      <p class="chem-hint">Tap a C\u2013C bond to toggle single/double. Select a group, then tap a carbon to attach it.</p>
      <div class="chem-toolbar">${groupButtons.join("")}</div>`;
  }
  if (kind === "polymer_structure") {
    tools = `<p class="chem-hint">Choose the correct repeat unit${cfg.template?.mode === "condensation" ? " and linkage" : ""}.</p>`;
  }
  if (kind === "molecule_builder") {
    tools = `<p class="chem-hint">Pick an element, add atoms on the canvas, then add bonds to connect elements.</p>`;
  }
  if (kind === "balance_equation") {
    const subtype = cfg.template?.subtype || "symbol";
    if (subtype === "half") {
      tools = `<p class="chem-hint">Type the ion, electrons and element in the boxes (for example Al3+, 3e-, Al). Include charges. The two species on the same side of the arrow can be in either order.</p>`;
    } else if (subtype === "ionic") {
      tools = `<p class="chem-hint">Enter the missing ion formula including its charge (for example Cl- or Mg2+). Select a state symbol for each species. Leave a coefficient box blank for 1.</p>`;
    } else {
      tools = `<p class="chem-hint">Enter the smallest whole-number coefficients that balance the equation. Leave a box blank for 1.</p>`;
    }
  }
  return tools;
}
function occupiedShellCount(shells) {
  const list = Array.isArray(shells) ? shells : [];
  let n = list.length;
  while (n > 1 && !(Number(list[n - 1]) > 0)) n -= 1;
  return Math.max(n, 1);
}
function ionicTemplateAtoms(template) {
  if (Array.isArray(template?.atoms) && template.atoms.length) {
    return template.atoms.map((a, i) => ({
      symbol: a.symbol,
      style: a.style || (i % 2 === 0 ? "dot" : "cross")
    }));
  }
  const left = template?.left || { symbol: "Na" };
  const right = template?.right || { symbol: "Cl" };
  return [
    { symbol: left.symbol, style: "dot" },
    { symbol: right.symbol, style: "cross" }
  ];
}
function ionicAnswerAtoms(obj) {
  if (Array.isArray(obj?.atoms) && obj.atoms.length) return obj.atoms;
  if (obj?.left && obj?.right) return [obj.left, obj.right];
  return [];
}
function ionicStateAtoms(state) {
  return ionicAnswerAtoms(state);
}
function ionicOuterShellDisplay(shells, charge = 0, symbol = "") {
  const list = Array.isArray(shells) ? shells.map((n) => Number(n) || 0) : [];
  const idx = Math.max(0, list.length - 1);
  const count = list[idx] || 0;
  const ch = Number(charge) || 0;
  const data = ELEMENT_DATA[symbol];
  const Z = data?.Z;
  const totalE = list.reduce((a, b) => a + b, 0);
  const isMetal = data && Array.isArray(data.shells) && data.shells.length >= 2 && data.shells[data.shells.length - 1] <= 2;
  if (count === 0 && list.length > 0) {
    return { shellIndex: idx, count: 0 };
  }
  if (isMetal && ch > 0 && count > 0 && Z != null && totalE < Z) {
    return { shellIndex: idx + 1, count: 0 };
  }
  return { shellIndex: idx, count };
}
function renderIonicDotCrossAtomSvg(opts) {
  const {
    cx,
    cy,
    symbol,
    shells,
    style = "dot",
    brackets = false,
    charge = 0,
    interactive = true,
    atomIdx = 0,
    selectedElectron = null,
    baseR = 28,
    gap = 22
  } = opts;
  const shellList = Array.isArray(shells) ? shells : [];
  const color = style === "cross" ? "#dc2626" : "#2563eb";
  let svg = "";
  svg += `<circle cx="${cx}" cy="${cy}" r="14" fill="#1e293b"/>`;
  svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="#f8fafc" font-size="11" font-weight="700" pointer-events="none">${escapeHtml2(symbol)}</text>`;
  const { shellIndex: outerIdx, count: outerCount } = ionicOuterShellDisplay(shellList, charge, symbol);
  const r = baseR;
  if (interactive) {
    svg += `<circle class="chem-ion-shell-hit" data-atom-idx="${atomIdx}" data-shell="${outerIdx}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#93c5fd" stroke-opacity="0.35" stroke-width="18" pointer-events="stroke" tabindex="0" role="button" aria-label="Transfer electron to ${escapeHtml2(symbol)}" style="cursor:pointer"/>`;
  }
  svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4 3" style="pointer-events:none"/>`;
  const pts = electronPositions(cx, cy, r, outerCount, Math.min(outerIdx, 3));
  pts.forEach((pt, ei) => {
    const sel = selectedElectron?.atomIdx === atomIdx && selectedElectron?.shell === outerIdx && selectedElectron?.e === ei;
    if (sel) {
      svg += `<circle cx="${pt.x}" cy="${pt.y}" r="10" fill="none" stroke="#f59e0b" stroke-width="2.5" pointer-events="none"/>`;
    }
    svg += renderCovElectron(pt.x, pt.y, style, color);
    if (interactive) {
      svg += `<circle class="chem-ion-electron" data-atom-idx="${atomIdx}" data-shell="${outerIdx}" data-e="${ei}" cx="${pt.x}" cy="${pt.y}" r="14" fill="transparent" stroke="none" tabindex="0" role="button" aria-label="Select electron on ${escapeHtml2(symbol)}" style="cursor:pointer;pointer-events:all"/>`;
    }
  });
  if (brackets) {
    svg += renderIonBrackets(cx, cy, atomOuterRadius(1, baseR, gap), charge);
  } else if (charge != null && Number(charge) !== 0) {
    svg += `<text x="${cx + baseR + 10}" y="${cy - baseR + 4}" fill="#b91c1c" font-size="18" font-weight="800">${fmtCharge(Number(charge))}</text>`;
  }
  return svg;
}
function transferIonicElectron(state, fromIdx, fromShell, toIdx) {
  const atoms = state.atoms;
  if (!atoms || fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return false;
  const from = atoms[fromIdx];
  const to = atoms[toIdx];
  if (!from || !to) return false;
  const fromShells = [...from.shells];
  if ((fromShells[fromShell] || 0) <= 0) return false;
  fromShells[fromShell] -= 1;
  from.shells = fromShells;
  const toShells = [...to.shells];
  let toShell = Math.max(0, toShells.length - 1);
  const cap = SHELL_CAPS[toShell] ?? 8;
  if ((toShells[toShell] || 0) >= cap) {
    toShells.push(0);
    toShell = toShells.length - 1;
  }
  toShells[toShell] = (toShells[toShell] || 0) + 1;
  to.shells = toShells;
  state.transferred = (state.transferred || 0) + 1;
  return true;
}
function shellAnswerViewport(shellCount, { baseR = 36, gap = 28, pad = 10, brackets = false } = {}) {
  const n = Math.max(1, shellCount);
  const outer = atomOuterRadius(n, baseR, gap);
  if (!brackets) {
    const size = Math.ceil((outer + pad) * 2);
    return { size, width: size, height: size, baseR, gap, cx: size / 2, cy: size / 2, maxShells: n };
  }
  const bracketOuter = 18;
  const chargeW = 42;
  const height = Math.ceil((outer + bracketOuter + pad) * 2);
  const width = Math.ceil(outer * 2 + bracketOuter * 2 + chargeW + pad * 2);
  const cx = Math.floor((width - chargeW) / 2);
  const cy = height / 2;
  return { size: Math.max(width, height), width, height, baseR, gap, cx, cy, maxShells: n };
}
function renderShellDiagram(state, cfg) {
  const maxShells = state.shells?.length || 2;
  const baseR = 36;
  const gap = 28;
  const pad = 22;
  const size = Math.ceil((atomOuterRadius(maxShells, baseR, gap) + pad) * 2);
  const w = size;
  const h = size;
  const cx = w / 2;
  const cy = h / 2;
  const protons = state.nucleus?.p ?? cfg.template?.protons;
  const svgInner = renderAtomSvg({
    cx,
    cy,
    symbol: state.symbol || cfg.template?.symbol || "C",
    shells: state.shells,
    protons,
    neutrons: state.nucleus?.n,
    charge: null,
    brackets: false,
    interactive: true,
    atomId: "main",
    maxShells,
    baseR,
    gap
  });
  return `
    <div class="chem-diagram-wrap">
      <svg class="chem-svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:420px;touch-action:manipulation;">${svgInner}</svg>
      <div class="chem-status" id="chemStatus">Shells: [${(state.shells || []).join(", ")}]</div>
    </div>`;
}
function ionicAtomExtent(atom, { baseR = 28, gap = 22 } = {}) {
  const shellCount = 1;
  const outer = atomOuterRadius(shellCount, baseR, gap);
  const hasCharge = atom?.charge != null && Number(atom.charge) !== 0;
  const bracketPad = atom?.brackets ? 18 : 8;
  const chargeW = atom?.brackets || hasCharge ? 36 : 0;
  return {
    shellCount,
    halfW: outer + bracketPad + chargeW / 2,
    halfH: outer + bracketPad,
    chargeW
  };
}
function layoutIonicAtoms(atoms, { baseR = 28, gap = 22, titleH = 8 } = {}) {
  const n = Math.max(atoms.length, 1);
  const extents = atoms.map((a) => ionicAtomExtent(a, { baseR, gap }));
  const padX = 16;
  const padY = 12;
  const minGap = 28;
  const rowWidths = (row) => {
    let w2 = padX * 2;
    row.forEach((i, idx) => {
      w2 += extents[i].halfW * 2;
      if (idx < row.length - 1) w2 += minGap;
    });
    return w2;
  };
  let rows;
  if (n <= 2) {
    rows = [atoms.map((_, i) => i)];
  } else {
    const all = atoms.map((_, i) => i);
    if (rowWidths(all) <= 520) {
      rows = [all];
    } else {
      const mid = Math.ceil(n / 2);
      rows = [all.slice(0, mid), all.slice(mid)];
    }
  }
  const rowHs = rows.map((row) => Math.max(...row.map((i) => extents[i].halfH * 2), 80));
  const rowWs = rows.map((row) => rowWidths(row));
  const w = Math.max(...rowWs, 280);
  const h = titleH + padY + rowHs.reduce((a, b) => a + b, 0) + (rows.length - 1) * 20 + padY;
  const positions = new Array(n);
  let yCursor = titleH + padY;
  rows.forEach((row, ri) => {
    const rowH = rowHs[ri];
    const cy = yCursor + rowH / 2;
    const totalAtomW = row.reduce((s, i) => s + extents[i].halfW * 2, 0);
    const gaps = Math.max(row.length - 1, 0);
    const free = Math.max(w - padX * 2 - totalAtomW, gaps * minGap);
    const gapEach = gaps ? free / gaps : 0;
    let x = padX;
    row.forEach((i, idx) => {
      const half = extents[i].halfW;
      const chargeBias = extents[i].chargeW / 2;
      positions[i] = { x: x + half - chargeBias / 2, y: cy, ...extents[i] };
      x += half * 2 + (idx < gaps ? gapEach : 0);
    });
    yCursor += rowH + 20;
  });
  return { w: Math.ceil(w), h: Math.ceil(h), positions, baseR, gap };
}
function renderIonicDiagram(state) {
  const atoms = ionicStateAtoms(state);
  const { w, h, positions, baseR, gap } = layoutIonicAtoms(atoms);
  const selected = state.selectedElectron || null;
  const ionSvgs = atoms.map((atom, i) => renderIonicDotCrossAtomSvg({
    cx: positions[i].x,
    cy: positions[i].y,
    symbol: atom.symbol,
    shells: atom.shells,
    style: atom.style || (i % 2 === 0 ? "dot" : "cross"),
    brackets: !!atom.brackets,
    charge: atom.charge,
    interactive: true,
    atomIdx: i,
    selectedElectron: selected,
    baseR,
    gap
  })).join("");
  const controls = atoms.map((atom, i) => `
    <div class="chem-ion-controls" data-atom-idx="${i}">
      <span class="chem-ion-label">${escapeHtml2(atom.symbol)}</span>
      <button type="button" class="btn chem-btn chem-ion-btn${atom.brackets ? " chem-ion-btn--active" : ""}" data-chem-action="toggle-brackets" data-atom-idx="${i}" title="Toggle square brackets">[ ]</button>
      <button type="button" class="btn chem-btn chem-ion-btn" data-chem-action="charge-down" data-atom-idx="${i}" title="Decrease charge">\u2212</button>
      <span class="chem-ion-charge">${fmtCharge(atom.charge) || "0"}</span>
      <button type="button" class="btn chem-btn chem-ion-btn" data-chem-action="charge-up" data-atom-idx="${i}" title="Increase charge">+</button>
    </div>`).join("");
  const chargeSummary = atoms.map((a) => `${a.symbol}${fmtCharge(a.charge) || ""}`).join("  ");
  return `
    <div class="chem-diagram-wrap chem-diagram-wrap--responsive">
      <svg class="chem-svg chem-svg--fluid" viewBox="0 0 ${w} ${h}" width="100%" style="touch-action:manipulation;" preserveAspectRatio="xMidYMid meet">
        ${ionSvgs}
      </svg>
      <div class="chem-ion-controls-row">${controls}</div>
      <div class="chem-status" id="chemStatus">Transferred: ${state.transferred || 0} e\u207B \xB7 ${chargeSummary}</div>
    </div>`;
}
function toSuperscriptDigits(n) {
  return String(Math.abs(n)).replace(/[0-9]/g, (d) => SUPER_DIGITS[Number(d)]);
}
function fmtCharge(c) {
  if (!c) return "";
  const mag = Math.abs(c);
  const sign = c > 0 ? "\u207A" : "\u207B";
  return mag === 1 ? sign : `${toSuperscriptDigits(mag)}${sign}`;
}
function emptyLoneElectronCounts() {
  return { top: 0, bottom: 0, left: 0, right: 0 };
}
function covElectronStyle(ai) {
  return ai % 2 === 0 ? "dot" : "cross";
}
function covElectronColor(ai) {
  return ai % 2 === 0 ? "#2563eb" : "#dc2626";
}
function covSharedElectronStyle(bond, atomIdx) {
  return atomIdx === bond.a ? "dot" : "cross";
}
function covSharedElectronColor(bond, atomIdx) {
  return atomIdx === bond.a ? "#2563eb" : "#dc2626";
}
function lonePairsFromElectronCounts(loneElectrons) {
  if (!loneElectrons) return 0;
  return COVALENT_LONE_SLOTS.filter((slot) => (loneElectrons[slot] || 0) >= 2).length;
}
function sharedPairsFromElectronCount(sharedCount) {
  return Math.floor(Math.max(0, Number(sharedCount) || 0) / 2);
}
function renderCovElectronInteractive(x, y, style, color, attrs = "") {
  return `${renderCovElectron(x, y, style, color)}<circle class="chem-cov-electron-hit" cx="${x}" cy="${y}" r="${COVALENT_ELECTRON_HIT_R}" fill="transparent" stroke="none" tabindex="0" role="button" style="cursor:pointer;pointer-events:all" ${attrs}/>`;
}
function covalentAtomMetrics(symbol) {
  switch (symbol) {
    case "H":
      return { shellR: 30, coreR: 9, fontSize: 11 };
    case "C":
    case "N":
    case "O":
      return { shellR: 50, coreR: 15, fontSize: 13 };
    case "Cl":
    case "S":
    case "P":
      return { shellR: 46, coreR: 14, fontSize: 12 };
    default:
      return { shellR: 44, coreR: 13, fontSize: 12 };
  }
}
function covalentBondDistance(rA, rB) {
  return rA + rB - COVALENT_SHELL_OVERLAP;
}
function covalentSharedCap(bond) {
  return Math.max(COVALENT_MAX_SHARED_CAP, Number(bond?.maxPairs || 1) + 2);
}
function covalentMaxSharedElectrons(bond) {
  return covalentSharedCap(bond) * 2;
}
function covalentViewBounds(positions, shellRadii, pad = 36) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  positions.forEach((p, i) => {
    const r = shellRadii[i] || 44;
    minX = Math.min(minX, p.x - r);
    maxX = Math.max(maxX, p.x + r);
    minY = Math.min(minY, p.y - r);
    maxY = Math.max(maxY, p.y + r);
  });
  return {
    w: Math.ceil(maxX - minX + pad * 2),
    h: Math.ceil(maxY - minY + pad * 2),
    offsetX: minX - pad,
    offsetY: minY - pad
  };
}
function shiftCovalentLayout(positions, bounds) {
  return positions.map((p) => ({
    x: p.x - bounds.offsetX,
    y: p.y - bounds.offsetY
  }));
}
function covalentLoneSlotsFromCount(atom, bondDirs, count) {
  const n = Math.max(0, Number(count) || 0);
  if (!n) return [];
  const free = COVALENT_LONE_SLOTS.filter((slot) => {
    const ang = COVALENT_LONE_SLOT_ANGLES[slot];
    return !(bondDirs || []).some((d) => {
      let diff = Math.abs(ang - d) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      return diff < 0.65;
    });
  });
  const slots = free.length ? free : COVALENT_LONE_SLOTS;
  return slots.slice(0, n);
}
function getAtomLoneElectronCounts(atom, bondDirs) {
  if (atom?.loneElectrons && typeof atom.loneElectrons === "object") {
    return { ...emptyLoneElectronCounts(), ...atom.loneElectrons };
  }
  if (Array.isArray(atom?.lonePairSlots)) {
    const counts2 = emptyLoneElectronCounts();
    atom.lonePairSlots.forEach((slot) => {
      if (counts2[slot] != null) counts2[slot] = COVALENT_LONE_ELECTRONS_PER_SLOT;
    });
    return counts2;
  }
  const pairCount = Number(atom?.lonePairs) || 0;
  const slots = covalentLoneSlotsFromCount(atom, bondDirs, pairCount);
  const counts = emptyLoneElectronCounts();
  slots.forEach((slot) => {
    counts[slot] = COVALENT_LONE_ELECTRONS_PER_SLOT;
  });
  return counts;
}
function getBondSharedCount(bond) {
  if (bond?.sharedCount != null) return Math.max(0, Number(bond.sharedCount) || 0);
  return Math.max(0, Number(bond?.sharedPairs) || 0) * 2;
}
function ensureBondSharedCount(bond) {
  if (bond.sharedCount == null) bond.sharedCount = getBondSharedCount(bond);
  return bond;
}
function covalentSharedElectronPositions(bond, positions, shellRadii) {
  const pa = positions[bond.a];
  const pb = positions[bond.b];
  if (!pa || !pb) return [];
  const rA = shellRadii[bond.a];
  const rB = shellRadii[bond.b];
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const nx = -uy;
  const ny = ux;
  const sharedCount = getBondSharedCount(bond);
  const pts = [];
  for (let ei = 0; ei < sharedCount; ei++) {
    const pairIdx = Math.floor(ei / 2);
    const stack = (pairIdx - (Math.ceil(sharedCount / 2) - 1) / 2) * 10;
    const isFirstInPair = ei % 2 === 0;
    if (isFirstInPair) {
      pts.push({
        x: pa.x + ux * rA + nx * stack,
        y: pa.y + uy * rA + ny * stack,
        atom: bond.a
      });
    } else {
      pts.push({
        x: pb.x - ux * rB + nx * stack,
        y: pb.y - uy * rB + ny * stack,
        atom: bond.b
      });
    }
  }
  return pts;
}
function nearestCovalentLoneSlot(atomX, atomY, clickX, clickY) {
  const ang = Math.atan2(clickY - atomY, clickX - atomX);
  let best = COVALENT_LONE_SLOTS[0];
  let bestDiff = Infinity;
  for (const slot of COVALENT_LONE_SLOTS) {
    let diff = Math.abs(ang - COVALENT_LONE_SLOT_ANGLES[slot]);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = slot;
    }
  }
  return best;
}
function addCovalentLoneElectron(state, atomIdx, slot) {
  const atom = state.atoms?.[atomIdx];
  if (!atom || !slot) return false;
  if (!atom.loneElectrons) atom.loneElectrons = emptyLoneElectronCounts();
  const current = atom.loneElectrons[slot] || 0;
  if (current >= COVALENT_LONE_ELECTRONS_PER_SLOT) return false;
  atom.loneElectrons[slot] = current + 1;
  return true;
}
function removeCovalentLoneElectron(state, atomIdx, slot, eIdx) {
  const atom = state.atoms?.[atomIdx];
  if (!atom?.loneElectrons || !slot) return false;
  const current = atom.loneElectrons[slot] || 0;
  if (current <= 0) return false;
  atom.loneElectrons[slot] = current - 1;
  return true;
}
function layoutCovalentAtoms(atoms, bonds) {
  const n = atoms.length;
  const shellRadii = atoms.map((a) => covalentAtomMetrics(a.symbol).shellR);
  const positions = new Array(n);
  if (n <= 2) {
    const r0 = shellRadii[0];
    const r1 = n === 2 ? shellRadii[1] : r0;
    const dist = n === 2 ? covalentBondDistance(r0, r1) : 0;
    const bounds2 = covalentViewBounds(
      n === 1 ? [{ x: 0, y: 0 }] : [{ x: -dist / 2, y: 0 }, { x: dist / 2, y: 0 }],
      n === 1 ? [r0] : [r0, r1]
    );
    if (n === 1) {
      positions[0] = { x: bounds2.w / 2, y: bounds2.h / 2 };
    } else {
      positions[0] = { x: bounds2.w / 2 - dist / 2, y: bounds2.h / 2 };
      positions[1] = { x: bounds2.w / 2 + dist / 2, y: bounds2.h / 2 };
    }
    return { w: bounds2.w, h: bounds2.h, positions, shellRadii };
  }
  const degree = atoms.map(() => 0);
  (bonds || []).forEach((b) => {
    if (degree[b.a] != null) degree[b.a] += 1;
    if (degree[b.b] != null) degree[b.b] += 1;
  });
  let centre = 0;
  let best = -1;
  atoms.forEach((a, i) => {
    const score = degree[i] * 10 + (a.symbol === "H" ? 0 : 5);
    if (score > best) {
      best = score;
      centre = i;
    }
  });
  const satellites = atoms.map((_, i) => i).filter((i) => i !== centre);
  positions[centre] = { x: 0, y: 0 };
  let angles;
  if (satellites.length === 2) {
    const half = 104 * Math.PI / 180 / 2;
    angles = [Math.PI / 2 + half, Math.PI / 2 - half];
  } else if (satellites.length === 3) {
    angles = [0, 1, 2].map((i) => Math.PI / 2 + (i - 1) * (2 * Math.PI) / 3);
  } else if (satellites.length === 4) {
    angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  } else {
    angles = satellites.map((_, idx) => -Math.PI / 2 + idx * 2 * Math.PI / satellites.length);
  }
  const rCentre = shellRadii[centre];
  satellites.forEach((si, idx) => {
    const dist = covalentBondDistance(rCentre, shellRadii[si]);
    const ang = angles[idx] ?? 0;
    positions[si] = {
      x: dist * Math.cos(ang),
      y: dist * Math.sin(ang)
    };
  });
  const bounds = covalentViewBounds(positions, shellRadii);
  return {
    w: bounds.w,
    h: bounds.h,
    positions: shiftCovalentLayout(positions, bounds),
    shellRadii
  };
}
function renderCovalentDiagram(state, { interactive = true } = {}) {
  const atoms = state.atoms || [];
  const bonds = state.bonds || [];
  const { w, h, positions, shellRadii } = layoutCovalentAtoms(atoms, bonds);
  let svg = "";
  const bondDirs = atoms.map(() => []);
  bonds.forEach((bond) => {
    const pa = positions[bond.a];
    const pb = positions[bond.b];
    if (!pa || !pb) return;
    const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    bondDirs[bond.a].push(ang);
    bondDirs[bond.b].push(ang + Math.PI);
  });
  atoms.forEach((atom, ai) => {
    const p = positions[ai];
    const { coreR, fontSize } = covalentAtomMetrics(atom.symbol);
    const shellR = shellRadii[ai];
    svg += `<circle cx="${p.x}" cy="${p.y}" r="${shellR}" fill="rgba(241,245,249,0.55)" stroke="#475569" stroke-width="2"/>`;
    svg += `<circle class="chem-cov-atom" data-atom-idx="${ai}" cx="${p.x}" cy="${p.y}" r="${coreR}" fill="#1e293b" tabindex="-1" role="presentation" aria-hidden="true"/>`;
    svg += `<text x="${p.x}" y="${p.y + 5}" text-anchor="middle" fill="#f8fafc" font-size="${fontSize}" font-weight="700" pointer-events="none">${escapeHtml2(atom.symbol)}</text>`;
  });
  bonds.forEach((bond, bi) => {
    const sharedPts = covalentSharedElectronPositions(bond, positions, shellRadii);
    sharedPts.forEach((pt, ei) => {
      const style = covSharedElectronStyle(bond, pt.atom);
      const color = covSharedElectronColor(bond, pt.atom);
      if (interactive) {
        svg += renderCovElectronInteractive(
          pt.x,
          pt.y,
          style,
          color,
          `data-cov-kind="shared" data-bond="${bi}" data-e="${ei}" aria-label="Remove shared electron ${ei + 1} on bond ${bi + 1}"`
        );
      } else {
        svg += renderCovElectron(pt.x, pt.y, style, color);
      }
    });
    if (interactive && getBondSharedCount(bond) < covalentMaxSharedElectrons(bond)) {
      const pa = positions[bond.a];
      const pb = positions[bond.b];
      const mx = (pa.x + pb.x) / 2;
      const my = (pa.y + pb.y) / 2;
      const hitR = Math.max(shellRadii[bond.a], shellRadii[bond.b]) * 0.45;
      svg += `<circle class="chem-bond-hit" data-bond="${bi}" cx="${mx}" cy="${my}" r="${hitR}" fill="transparent" tabindex="0" role="button" aria-label="Add one shared electron on bond ${bi + 1}" style="cursor:pointer"/>`;
    }
  });
  atoms.forEach((atom, ai) => {
    const p = positions[ai];
    const shellR = shellRadii[ai];
    const style = covElectronStyle(ai);
    const color = covElectronColor(ai);
    const loneCounts = getAtomLoneElectronCounts(atom, bondDirs[ai]);
    COVALENT_LONE_SLOTS.forEach((slot) => {
      const ang = COVALENT_LONE_SLOT_ANGLES[slot];
      const lx = p.x + shellR * Math.cos(ang);
      const ly = p.y + shellR * Math.sin(ang);
      const count = loneCounts[slot] || 0;
      const tx = -Math.sin(ang) * 5;
      const ty = Math.cos(ang) * 5;
      if (count >= 1) {
        const attrs = `data-cov-kind="lone" data-atom-idx="${ai}" data-slot="${slot}" data-e="0" aria-label="Remove lone electron on ${escapeHtml2(atom.symbol)} ${slot}"`;
        if (count >= 2) {
          if (interactive) {
            svg += renderCovElectronInteractive(lx - tx, ly - ty, style, color, attrs);
            svg += renderCovElectronInteractive(
              lx + tx,
              ly + ty,
              style,
              color,
              `data-cov-kind="lone" data-atom-idx="${ai}" data-slot="${slot}" data-e="1" aria-label="Remove lone electron on ${escapeHtml2(atom.symbol)} ${slot}"`
            );
          } else {
            svg += renderCovElectron(lx - tx, ly - ty, style, color);
            svg += renderCovElectron(lx + tx, ly + ty, style, color);
          }
        } else if (interactive) {
          svg += renderCovElectronInteractive(lx, ly, style, color, attrs);
        } else {
          svg += renderCovElectron(lx, ly, style, color);
        }
      }
      if (interactive && count < COVALENT_LONE_ELECTRONS_PER_SLOT) {
        svg += `<circle class="chem-lone-slot-hit${count > 0 ? " chem-lone-slot-hit--active" : ""}" data-atom-idx="${ai}" data-slot="${slot}" cx="${lx}" cy="${ly}" r="16" fill="transparent" tabindex="0" role="button" aria-label="Add one lone electron ${slot} on ${escapeHtml2(atom.symbol)}" style="cursor:pointer"/>`;
      }
    });
    if (interactive) {
      svg += `<circle class="chem-cov-shell-hit" data-atom-idx="${ai}" cx="${p.x}" cy="${p.y}" r="${shellR}" fill="none" stroke="transparent" stroke-width="20" pointer-events="stroke" tabindex="0" role="button" aria-label="Add lone electron on ${escapeHtml2(atom.symbol)} outer shell" style="cursor:pointer"/>`;
    }
  });
  const statusHtml = interactive ? `<div class="chem-status" id="chemStatus">Tap overlap or shell edge to add one electron \xB7 tap an electron to remove it</div>` : "";
  return `
    <div class="chem-diagram-wrap chem-diagram-wrap--responsive">
      <svg class="chem-svg chem-svg--fluid" viewBox="0 0 ${w} ${h}" width="100%" style="touch-action:manipulation;" preserveAspectRatio="xMidYMid meet">${svg}</svg>
      ${statusHtml}
    </div>`;
}
function renderOrganicDiagram(state, cfg) {
  const family = state.family || cfg.template?.family || "alkane";
  const svg = renderDisplayedFormulaSvg(
    { ...state, name: state.name || cfg.template?.name || family },
    { interactive: true }
  );
  return `
    <div class="chem-diagram-wrap">
      <div class="chem-family-label">${escapeHtml2(family.replace(/_/g, " "))}${cfg.template?.track === "triple" || family === "alcohol" || family === "carboxylic_acid" || family === "ester" ? " \xB7 Triple" : ""}</div>
      ${svg}
      <div class="chem-status" id="chemStatus">Selected group: ${escapeHtml2(state.selectedGroup || "none")}</div>
    </div>`;
}
function renderPolymerDiagram(state, cfg) {
  const options = cfg.template?.repeatOptions || [
    { id: "ch2ch2", label: "\u2013CH\u2082\u2013CH\u2082\u2013" },
    { id: "chch2", label: "\u2013CH=CH\u2082\u2013" },
    { id: "ch3", label: "\u2013CH\u2083" }
  ];
  const linkages = cfg.template?.linkageOptions || [];
  const mode = cfg.template?.mode || "addition";
  const chosen = options.find((o) => o.id === state.selectedRepeat);
  const fallbackLabel = chosen?.label || "Select a repeat unit";
  const svg = renderPolymerRepeatUnitSvg(state.selectedRepeat, {
    fallbackLabel,
    showTitle: false
  });
  const chips = options.map((o) => `
    <button type="button" class="btn chem-chip ${state.selectedRepeat === o.id ? "chem-chip-active" : ""}" data-chem-repeat="${escapeHtml2(o.id)}">${escapeHtml2(o.label)}</button>
  `).join("");
  let linkHtml = "";
  if (mode === "condensation" && linkages.length) {
    linkHtml = `
      <p class="chem-hint" style="margin-top:8px;">Linkage type</p>
      <div class="chem-toolbar">
        ${linkages.map((l) => `
          <button type="button" class="btn chem-chip ${state.selectedLinkage === l.id ? "chem-chip-active" : ""}" data-chem-linkage="${escapeHtml2(l.id)}">${escapeHtml2(l.label)}</button>
        `).join("")}
      </div>`;
  }
  return `
    <div class="chem-diagram-wrap">
      ${svg}
      <p class="chem-hint">Select the repeat unit</p>
      <div class="chem-toolbar">${chips}</div>
      ${linkHtml}
      <div class="chem-status" id="chemStatus"></div>
    </div>`;
}
function renderHalfSlot(state, idx, label) {
  return `<input type="text" class="chem-half-slot" data-half-slot="${idx}" value="${escapeHtml2(state.halfSlots?.[idx] || "")}" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="${escapeHtml2(label)}" placeholder="" style="width:7.5rem;min-width:5.5rem;padding:6px 8px;border:none;border-bottom:2px solid #2563eb;border-radius:0;font-weight:700;text-align:center;font-size:1.05rem;background:transparent;vertical-align:middle;" />`;
}
function renderHalfEquationSlots(state, cfg) {
  const layout = halfEquationLayout(cfg.answer, cfg.template);
  const op = "display:inline-flex;align-items:center;flex:0 0 auto;white-space:nowrap;font-weight:700;padding:0 6px;";
  const parts = layout === "anion" ? [
    renderHalfSlot(state, 0, "Reactant"),
    `<span class="chem-eq-arrow" style="${op}">\u2192</span>`,
    renderHalfSlot(state, 1, "Product 1"),
    `<span class="chem-eq-plus" style="${op}">+</span>`,
    renderHalfSlot(state, 2, "Product 2")
  ] : [
    renderHalfSlot(state, 0, "Reactant 1"),
    `<span class="chem-eq-plus" style="${op}">+</span>`,
    renderHalfSlot(state, 1, "Reactant 2"),
    `<span class="chem-eq-arrow" style="${op}">\u2192</span>`,
    renderHalfSlot(state, 2, "Product")
  ];
  return `
    <div class="chem-diagram-wrap chem-equation-wrap" style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
      <div class="chem-equation chem-half-equation" style="display:flex;flex-wrap:nowrap;align-items:flex-end;gap:4px;justify-content:flex-start;font-size:1.05rem;padding:12px 0;overflow-x:auto;white-space:nowrap;max-width:100%;">${parts.join("")}</div>
      <div class="chem-status" id="chemStatus"></div>
    </div>`;
}
function renderBalanceEquation(state, cfg) {
  if ((state.subtype || cfg.template?.subtype) === "half") {
    return renderHalfEquationSlots(state, cfg);
  }
  const species = cfg.template?.species || [];
  const arrow = cfg.template?.arrow || "->";
  const requireStates = equationRequiresStates(species);
  const coeffStyle = "width:2rem;min-width:2rem;max-width:2.4rem;padding:2px;border:2px solid #2563eb;border-radius:4px;text-align:center;font-weight:700;font-size:0.95rem;line-height:1.2;box-sizing:border-box;vertical-align:middle;";
  const termStyle = "display:inline-flex;align-items:center;gap:3px;flex:0 0 auto;white-space:nowrap;vertical-align:middle;";
  const parts = [];
  species.forEach((sp, i) => {
    if (i > 0 && sp.side !== species[i - 1].side) {
      parts.push(`<span class="chem-eq-arrow" style="display:inline-flex;align-items:center;flex:0 0 auto;white-space:nowrap;font-weight:700;">${arrow === "->" ? "\u2192" : escapeHtml2(arrow)}</span>`);
    } else if (i > 0) {
      parts.push(`<span class="chem-eq-plus" style="display:inline-flex;align-items:center;flex:0 0 auto;white-space:nowrap;font-weight:700;">+</span>`);
    }
    const ionHint = sp.studentEntersFormula && isIonFormula(sp.formula);
    const formulaHtml = sp.studentEntersFormula ? `<input type="text" class="chem-formula-input" data-formula-idx="${i}" value="${escapeHtml2(state.formulas?.[i] || "")}" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="${ionHint ? "e.g. Na+" : ""}" aria-label="${ionHint ? "Ion formula including charge" : "Chemical formula"}" style="width:88px;padding:4px 6px;border:2px solid #2563eb;border-radius:6px;font-weight:700;vertical-align:middle;" />` : `<span class="chem-species" style="display:inline;white-space:nowrap;vertical-align:middle;">$\\ce{${sp.formula}}$</span>`;
    const stateHtml = requireStates ? renderStateSelect(state.states?.[i] || "", `data-state-idx="${i}"`) : "";
    const coeffVal = state.coeffs?.[i];
    const coeffDisplay = coeffVal == null || coeffVal === "" ? "" : String(coeffVal);
    parts.push(`<span class="chem-eq-term" style="${termStyle}"><input type="number" min="0" max="99" inputmode="numeric" class="chem-coeff" data-coeff-idx="${i}" value="${escapeHtml2(coeffDisplay)}" placeholder="" aria-label="Coefficient" style="${coeffStyle}" />${formulaHtml}${stateHtml}</span>`);
  });
  return `
    <div class="chem-diagram-wrap chem-equation-wrap" style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
      <div class="chem-equation" style="display:flex;flex-wrap:nowrap;align-items:center;gap:4px;justify-content:flex-start;font-size:1.05rem;padding:8px 0;overflow-x:auto;white-space:nowrap;max-width:100%;">${parts.join("")}</div>
      <div class="chem-status" id="chemStatus"></div>
    </div>`;
}
function renderBody(state, cfg) {
  switch (cfg.kind) {
    case "electron_shell":
      return renderShellDiagram(state, cfg);
    case "ionic_bonding":
      return renderIonicDiagram(state);
    case "covalent_bonding":
      return renderCovalentDiagram(state);
    case "organic_structure":
      return renderOrganicDiagram(state, cfg);
    case "polymer_structure":
      return renderPolymerDiagram(state, cfg);
    case "molecule_builder":
      return renderMoleculeBuilderDiagram(state, cfg);
    case "balance_equation":
      return renderBalanceEquation(state, cfg);
    default:
      return `<p class="bad">Unknown chemistry kind: ${escapeHtml2(cfg.kind)}</p>`;
  }
}
function renderChemistryWorkflow(q, key, presentation = "practice") {
  const cfg = getChemistryConfig(q);
  if (!cfg) {
    return `<div class="item"><p class="bad">This chemistry question is missing chemistry_config.</p></div>`;
  }
  const state = initialStateForConfig(cfg);
  liveState = deepClone(state);
  liveConfig = deepClone(cfg);
  const kindLabels = {
    electron_shell: "Electron shell diagram",
    ionic_bonding: "",
    covalent_bonding: "",
    organic_structure: "Organic structure",
    polymer_structure: "Polymer structure",
    molecule_builder: "",
    balance_equation: ""
  };
  const kindLabel = Object.prototype.hasOwnProperty.call(kindLabels, cfg.kind) ? kindLabels[cfg.kind] : "Chemistry";
  return `
    <div class="item chem-workflow" id="chemistryWorkflowRoot" data-chem-kind="${escapeHtml2(cfg.kind)}">
      ${kindLabel ? `<div class="chem-title">${escapeHtml2(kindLabel)}</div>` : ""}
      ${toolbarHtml(cfg)}
      <div id="chemDiagramMount">${renderBody(state, cfg)}</div>
      <button type="button" class="btn chem-btn" data-chem-action="reset" style="margin-top:8px;">${cfg.kind === "balance_equation" ? "Reset" : "Reset diagram"}</button>
    </div>`;
}
function readState() {
  return liveState ? liveState : null;
}
function writeState(state) {
  liveState = state;
}
function readConfig() {
  return liveConfig ? liveConfig : null;
}
function forceInlineChemMath(root) {
  const scope = root || document.getElementById("chemDiagramMount") || document;
  scope.querySelectorAll?.(".chem-equation-wrap mjx-container")?.forEach((el) => {
    el.style.display = "inline";
    el.style.margin = "0";
    el.removeAttribute("display");
  });
}
function refreshDiagram() {
  const state = readState();
  const cfg = readConfig();
  const mount = document.getElementById("chemDiagramMount");
  if (!state || !cfg || !mount) return;
  mount.innerHTML = renderBody(state, cfg);
  const status = document.getElementById("chemStatus");
  if (status && cfg.kind === "electron_shell") {
    status.textContent = `Shells: [${(state.shells || []).join(", ")}]`;
  }
  if (cfg.kind === "balance_equation") {
    triggerMathTypeset(mount);
    setTimeout(() => forceInlineChemMath(mount), 80);
    setTimeout(() => forceInlineChemMath(mount), 250);
  }
}
function addElectron(shells, shellIndex, cap) {
  const next = [...shells];
  while (next.length <= shellIndex) next.push(0);
  const limit = cap ?? SHELL_CAPS[shellIndex] ?? 8;
  if (next[shellIndex] < limit) next[shellIndex] += 1;
  return next;
}
function removeElectron(shells, shellIndex) {
  const next = [...shells];
  if (next[shellIndex] > 0) next[shellIndex] -= 1;
  return next;
}
function wireChemistryWorkflow(q = null) {
  const root = document.getElementById("chemistryWorkflowRoot");
  if (!root) return;
  if (!liveState || !liveConfig) {
    const cfg = q ? getChemistryConfig(q) : null;
    if (cfg) {
      liveConfig = deepClone(cfg);
      liveState = initialStateForConfig(cfg);
    }
  }
  if (root.dataset.wired === "1") return;
  root.dataset.wired = "1";
  const cfg0 = readConfig();
  if (cfg0?.kind === "balance_equation") {
    const mount = document.getElementById("chemDiagramMount");
    triggerMathTypeset(mount || root);
    setTimeout(() => forceInlineChemMath(mount || root), 80);
    setTimeout(() => forceInlineChemMath(mount || root), 250);
  }
  const shellTarget = (el) => {
    if (!el || typeof el.closest !== "function") return null;
    return el.closest(".chem-shell-hitarea") || el.closest(".chem-shell");
  };
  root.addEventListener("click", (e) => {
    const state = readState();
    const cfg = readConfig();
    if (!state || !cfg) return;
    const t = e.target;
    const actionBtn = typeof t.closest === "function" ? t.closest("[data-chem-action]") : null;
    const action = actionBtn?.getAttribute("data-chem-action");
    if (action === "reset") {
      writeState(initialStateForConfig(cfg));
      refreshDiagram();
      return;
    }
    if (cfg.kind === "electron_shell") {
      const hit = shellTarget(t);
      if (hit) {
        e.preventDefault();
        const shell = Number(hit.getAttribute("data-shell"));
        state.shells = addElectron(state.shells, shell);
        writeState(state);
        refreshDiagram();
        return;
      }
      const elec = typeof t.closest === "function" ? t.closest(".chem-electron") || t.closest(".chem-electron-hit") : null;
      if (elec) {
        e.preventDefault();
        const shell = Number(elec.getAttribute("data-shell"));
        state.shells = removeElectron(state.shells, shell);
        writeState(state);
        refreshDiagram();
        return;
      }
    }
    if (cfg.kind === "ionic_bonding") {
      const ionElec = typeof t.closest === "function" ? t.closest(".chem-ion-electron") : null;
      if (ionElec) {
        e.preventDefault();
        const atomIdx = Number(ionElec.getAttribute("data-atom-idx"));
        const shell = Number(ionElec.getAttribute("data-shell"));
        const eIdx = Number(ionElec.getAttribute("data-e"));
        const sel = state.selectedElectron;
        if (sel && sel.atomIdx === atomIdx && sel.shell === shell && sel.e === eIdx) {
          state.selectedElectron = null;
        } else if (sel && (sel.atomIdx !== atomIdx || sel.shell !== shell || sel.e !== eIdx)) {
          if (transferIonicElectron(state, sel.atomIdx, sel.shell, atomIdx)) {
            state.selectedElectron = null;
          }
        } else {
          state.selectedElectron = { atomIdx, shell, e: eIdx };
        }
        writeState(state);
        refreshDiagram();
        return;
      }
      const ionShell = typeof t.closest === "function" ? t.closest(".chem-ion-shell-hit") : null;
      if (ionShell) {
        e.preventDefault();
        const atomIdx = Number(ionShell.getAttribute("data-atom-idx"));
        const sel = state.selectedElectron;
        if (sel && sel.atomIdx !== atomIdx) {
          if (transferIonicElectron(state, sel.atomIdx, sel.shell, atomIdx)) {
            state.selectedElectron = null;
          }
          writeState(state);
          refreshDiagram();
        }
        return;
      }
      if (action === "toggle-brackets") {
        const ai = Number(actionBtn?.getAttribute("data-atom-idx"));
        if (state.atoms?.[ai]) {
          state.atoms[ai].brackets = !state.atoms[ai].brackets;
          writeState(state);
          refreshDiagram();
        }
        return;
      }
      if (action === "charge-up" || action === "charge-down") {
        const ai = Number(actionBtn?.getAttribute("data-atom-idx"));
        const atom = state.atoms?.[ai];
        if (atom) {
          const delta = action === "charge-up" ? 1 : -1;
          atom.charge = Math.max(-3, Math.min(3, (Number(atom.charge) || 0) + delta));
          writeState(state);
          refreshDiagram();
        }
        return;
      }
    }
    if (cfg.kind === "covalent_bonding") {
      const covElecHit = typeof t.closest === "function" ? t.closest(".chem-cov-electron-hit") : null;
      if (covElecHit) {
        e.preventDefault();
        const kind = covElecHit.getAttribute("data-cov-kind");
        if (kind === "shared") {
          const bi = Number(covElecHit.getAttribute("data-bond"));
          const bond = ensureBondSharedCount(state.bonds[bi]);
          if (bond && bond.sharedCount > 0) {
            bond.sharedCount -= 1;
            writeState(state);
            refreshDiagram();
          }
        } else if (kind === "lone") {
          const ai = Number(covElecHit.getAttribute("data-atom-idx"));
          const slot = covElecHit.getAttribute("data-slot");
          if (removeCovalentLoneElectron(state, ai, slot)) {
            writeState(state);
            refreshDiagram();
          }
        }
        return;
      }
      const bondHit = typeof t.closest === "function" ? t.closest(".chem-bond-hit") : null;
      if (bondHit) {
        e.preventDefault();
        const bi = Number(bondHit.getAttribute("data-bond"));
        const bond = ensureBondSharedCount(state.bonds[bi]);
        if (bond && bond.sharedCount < covalentMaxSharedElectrons(bond)) {
          bond.sharedCount += 1;
          writeState(state);
          refreshDiagram();
        }
        return;
      }
      const slotHit = typeof t.closest === "function" ? t.closest(".chem-lone-slot-hit") : null;
      if (slotHit) {
        e.preventDefault();
        const ai = Number(slotHit.getAttribute("data-atom-idx"));
        const slot = slotHit.getAttribute("data-slot");
        if (addCovalentLoneElectron(state, ai, slot)) {
          writeState(state);
          refreshDiagram();
        }
        return;
      }
      const shellHit = typeof t.closest === "function" ? t.closest(".chem-cov-shell-hit") : null;
      if (shellHit) {
        e.preventDefault();
        const ai = Number(shellHit.getAttribute("data-atom-idx"));
        const svg = shellHit.ownerSVGElement;
        const { positions } = layoutCovalentAtoms(state.atoms || [], state.bonds || []);
        const p = positions[ai];
        if (svg && p) {
          const pt = svg.createSVGPoint();
          pt.x = e.clientX;
          pt.y = e.clientY;
          const ctm = svg.getScreenCTM()?.inverse();
          if (ctm) {
            const loc = pt.matrixTransform(ctm);
            const slot = nearestCovalentLoneSlot(p.x, p.y, loc.x, loc.y);
            if (addCovalentLoneElectron(state, ai, slot)) {
              writeState(state);
              refreshDiagram();
            }
          }
        }
        return;
      }
    }
    if (cfg.kind === "organic_structure") {
      const groupBtn = typeof t.closest === "function" ? t.closest("[data-chem-group]") : null;
      if (groupBtn) {
        const g = groupBtn.getAttribute("data-chem-group");
        state.selectedGroup = g === "clear" ? "clear" : g;
        writeState(state);
        refreshDiagram();
        return;
      }
      const bondHit = typeof t.closest === "function" ? t.closest(".chem-org-bond") : null;
      if (bondHit) {
        const bi = Number(bondHit.getAttribute("data-bond"));
        const bond = state.carbonBonds[bi];
        if (bond) {
          const maxOrder = cfg.template?.family === "alkane" ? 1 : 3;
          bond.order = bond.order >= maxOrder ? 1 : bond.order + 1;
          writeState(state);
          refreshDiagram();
        }
        return;
      }
      const carbonHit = typeof t.closest === "function" ? t.closest(".chem-org-carbon") : null;
      if (carbonHit && state.selectedGroup) {
        const ci = Number(carbonHit.getAttribute("data-carbon"));
        if (!state.groups[ci]) state.groups[ci] = [];
        if (state.selectedGroup === "clear") {
          state.groups[ci] = [];
        } else {
          state.groups[ci] = [state.selectedGroup];
        }
        writeState(state);
        refreshDiagram();
        return;
      }
    }
    if (cfg.kind === "polymer_structure") {
      const rep = typeof t.closest === "function" ? t.closest("[data-chem-repeat]") : null;
      if (rep) {
        state.selectedRepeat = rep.getAttribute("data-chem-repeat");
        writeState(state);
        refreshDiagram();
        return;
      }
      const link = typeof t.closest === "function" ? t.closest("[data-chem-linkage]") : null;
      if (link) {
        state.selectedLinkage = link.getAttribute("data-chem-linkage");
        writeState(state);
        refreshDiagram();
        return;
      }
    }
    if (cfg.kind === "molecule_builder") {
      const symBtn = typeof t.closest === "function" ? t.closest("[data-mol-symbol]") : null;
      if (symBtn) {
        state.selectedSymbol = symBtn.getAttribute("data-mol-symbol");
        writeState(state);
        refreshDiagram();
        return;
      }
      const modeBtn = typeof t.closest === "function" ? t.closest("[data-mol-mode]") : null;
      if (modeBtn) {
        state.mode = modeBtn.getAttribute("data-mol-mode") === "bond" ? "bond" : "add";
        state.bondFrom = null;
        writeState(state);
        refreshDiagram();
        return;
      }
      const bondHit = typeof t.closest === "function" ? t.closest("[data-mol-bond]") : null;
      if (bondHit) {
        const bondIdx = Number(bondHit.getAttribute("data-mol-bond"));
        if (Number.isFinite(bondIdx) && state.bonds?.[bondIdx]) {
          state.bonds.splice(bondIdx, 1);
          state.bondFrom = null;
        }
        writeState(state);
        refreshDiagram();
        return;
      }
      const atomHit = typeof t.closest === "function" ? t.closest("[data-mol-atom]") : null;
      if (atomHit) {
        const atomId = atomHit.getAttribute("data-mol-atom");
        if (state.mode === "bond") {
          if (!state.bondFrom) {
            state.bondFrom = atomId;
          } else if (state.bondFrom === atomId) {
            state.bondFrom = null;
          } else {
            addMoleculeBond(state, state.bondFrom, atomId);
            state.bondFrom = null;
          }
        }
        writeState(state);
        refreshDiagram();
        const status = document.getElementById("chemStatus");
        if (status) status.textContent = state.bondFrom ? "Tap the second atom to bond" : "";
        return;
      }
      const canvasHit = typeof t.closest === "function" ? t.closest(".chem-mol-canvas-bg, .chem-mol-svg") : null;
      if (canvasHit && state.mode !== "bond" && !atomHit && !bondHit) {
        const svg = document.getElementById("chemMolBuilderSvg");
        if (svg) {
          const pt = svgPointFromClient(svg, e.clientX, e.clientY);
          if (addMoleculeAtom(state, cfg, pt.x, pt.y)) {
            writeState(state);
            refreshDiagram();
            const status = document.getElementById("chemStatus");
            if (status) status.textContent = "";
          }
        }
        return;
      }
    }
    if (cfg.kind === "balance_equation") {
      const tokenBtn = typeof t.closest === "function" ? t.closest("[data-chem-token]") : null;
      if (tokenBtn) {
        state.extraSpecies = state.extraSpecies || [];
        state.extraSpecies.push({
          formula: tokenBtn.getAttribute("data-chem-token"),
          coeff: null,
          side: "left",
          state: ""
        });
        writeState(state);
        refreshDiagram();
        return;
      }
      const removeBtn = typeof t.closest === "function" ? t.closest("[data-chem-remove-extra]") : null;
      if (removeBtn) {
        const idx = Number(removeBtn.getAttribute("data-chem-remove-extra"));
        state.extraSpecies.splice(idx, 1);
        writeState(state);
        refreshDiagram();
      }
    }
  });
  root.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const t = e.target;
    if (!t || typeof t.closest !== "function") return;
    const interactive = t.closest(
      ".chem-shell-hitarea, .chem-electron, .chem-bond-hit, .chem-lone-slot-hit, .chem-cov-shell-hit, .chem-cov-electron-hit, .chem-org-bond, .chem-org-carbon, .chem-mol-atom-hit, .chem-mol-bond-hit"
    );
    if (!interactive || !root.contains(interactive)) return;
    if (interactive.getAttribute("tabindex") === "-1") return;
    e.preventDefault();
    interactive.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
  });
  root.addEventListener("change", (e) => {
    const state = readState();
    const cfg = readConfig();
    if (!state || !cfg) return;
    const t = e.target;
    if (t.id === "chemNucleusP") {
      state.nucleus = state.nucleus || {};
      state.nucleus.p = Number(t.value) || 0;
      writeState(state);
      return;
    }
    if (t.id === "chemNucleusN") {
      state.nucleus = state.nucleus || {};
      state.nucleus.n = Number(t.value) || 0;
      writeState(state);
      return;
    }
    if (t.classList?.contains("chem-coeff")) {
      const i = Number(t.getAttribute("data-coeff-idx"));
      state.coeffs[i] = t.value.trim() === "" ? null : Number(t.value) || 0;
      writeState(state);
      return;
    }
    if (t.classList?.contains("chem-extra-coeff")) {
      const i = Number(t.getAttribute("data-extra-idx"));
      if (state.extraSpecies[i]) {
        state.extraSpecies[i].coeff = t.value.trim() === "" ? null : Number(t.value) || 0;
      }
      writeState(state);
      return;
    }
    if (t.classList?.contains("chem-extra-side")) {
      const i = Number(t.getAttribute("data-extra-idx"));
      if (state.extraSpecies[i]) state.extraSpecies[i].side = t.value;
      writeState(state);
      return;
    }
    if (t.classList?.contains("chem-state-select") && t.hasAttribute("data-state-idx")) {
      const i = Number(t.getAttribute("data-state-idx"));
      state.states = state.states || [];
      state.states[i] = t.value || "";
      writeState(state);
      return;
    }
    if (t.classList?.contains("chem-extra-state")) {
      const i = Number(t.getAttribute("data-extra-state-idx"));
      if (state.extraSpecies[i]) state.extraSpecies[i].state = t.value || "";
      writeState(state);
    }
  });
  root.addEventListener("input", (e) => {
    const t = e.target;
    const state = readState();
    if (!state) return;
    if (t.id === "chemNucleusP") {
      state.nucleus = state.nucleus || {};
      state.nucleus.p = Number(t.value) || 0;
      writeState(state);
    } else if (t.id === "chemNucleusN") {
      state.nucleus = state.nucleus || {};
      state.nucleus.n = Number(t.value) || 0;
      writeState(state);
    } else if (t.classList?.contains("chem-coeff")) {
      const i = Number(t.getAttribute("data-coeff-idx"));
      state.coeffs[i] = t.value.trim() === "" ? null : Number(t.value) || 0;
      writeState(state);
    } else if (t.classList?.contains("chem-extra-coeff")) {
      const i = Number(t.getAttribute("data-extra-idx"));
      if (state.extraSpecies?.[i]) {
        state.extraSpecies[i].coeff = t.value.trim() === "" ? null : Number(t.value) || 0;
      }
      writeState(state);
    } else if (t.classList?.contains("chem-formula-input")) {
      const i = Number(t.getAttribute("data-formula-idx"));
      state.formulas = state.formulas || [];
      state.formulas[i] = t.value;
      writeState(state);
    } else if (t.classList?.contains("chem-half-slot")) {
      const i = Number(t.getAttribute("data-half-slot"));
      state.halfSlots = state.halfSlots || ["", "", ""];
      state.halfSlots[i] = t.value;
      writeState(state);
    }
  });
}
function collectChemistryResponse(q) {
  const cfg = getChemistryConfig(q);
  const state = readState() || initialStateForConfig(cfg);
  const cloned = deepClone(state);
  if (cloned.kind === "ionic_bonding" && Array.isArray(cloned.atoms)) {
    cloned.atoms = cloned.atoms.map((a) => ({
      symbol: a.symbol,
      shells: normalizeShellArray(a.shells),
      charge: Number(a.charge) || 0,
      brackets: !!a.brackets,
      style: a.style
    }));
    delete cloned.selectedElectron;
  }
  if (cloned.kind === "covalent_bonding") {
    cloned.atoms = (cloned.atoms || []).map((a) => ({
      symbol: a.symbol,
      lonePairs: lonePairsFromElectronCounts(a.loneElectrons)
    }));
    cloned.bonds = (cloned.bonds || []).map((b) => ({
      a: b.a,
      b: b.b,
      sharedPairs: sharedPairsFromElectronCount(getBondSharedCount(b)),
      maxPairs: b.maxPairs
    }));
  }
  if (cloned.kind === "molecule_builder") {
    cloned.atoms = (cloned.atoms || []).map(({ id, symbol, x, y }) => ({ id, symbol, x, y }));
    cloned.bonds = (cloned.bonds || []).map(({ a, b }) => ({ a, b }));
    delete cloned.selectedSymbol;
    delete cloned.mode;
    delete cloned.bondFrom;
    delete cloned.nextAtomId;
  }
  return { type: "chemistry", kind: cfg?.kind, ...cloned };
}
function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((v, i) => Number(v) === Number(b[i]));
}
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}
function impliedCoeff(n) {
  if (n == null || n === "") return 1;
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return 1;
  return Math.floor(num);
}
function normalizeCoeffs(arr) {
  const nums = (arr || []).map(impliedCoeff);
  if (!nums.length) return nums;
  const g = nums.reduce((a, b) => gcd(a, b), nums[0]);
  return nums.map((n) => n / g);
}
function normalizeShellArray(shells) {
  const arr = (Array.isArray(shells) ? shells : []).map((n) => Number(n) || 0);
  while (arr.length > 1 && arr[arr.length - 1] === 0) arr.pop();
  return arr;
}
function markShell(resp, answer) {
  const okShells = arraysEqual(normalizeShellArray(resp.shells), normalizeShellArray(answer.shells));
  if (okShells) {
    return { correct: true, detail: "Electron arrangement correct" };
  }
  return {
    correct: false,
    detail: `Electron arrangement incorrect (expected [${normalizeShellArray(answer.shells).join(", ")}])`
  };
}
function markIonic(resp, answer) {
  const rAtoms = ionicAnswerAtoms(resp);
  const ansAtoms = ionicAnswerAtoms(answer);
  const points = [];
  if (!ansAtoms.length) {
    return {
      correct: false,
      earned: 0,
      available: 0,
      points: [],
      detail: "No mark scheme for ionic bonding"
    };
  }
  const shellsOk = rAtoms.length === ansAtoms.length && ansAtoms.every((a, i) => arraysEqual(
    normalizeShellArray(rAtoms[i]?.shells),
    normalizeShellArray(a.shells)
  ));
  const chargesOk = rAtoms.length === ansAtoms.length && ansAtoms.every((a, i) => Number(rAtoms[i]?.charge) === Number(a.charge));
  const bracketsOk = rAtoms.length === ansAtoms.length && ansAtoms.every((a, i) => !!rAtoms[i]?.brackets === !!a.brackets);
  points.push({
    id: "shells",
    label: "Electron arrangements",
    marks: 1,
    correct: shellsOk,
    feedback: shellsOk ? null : "Electron arrangement incorrect"
  });
  points.push({
    id: "charges",
    label: "Ion charges",
    marks: 1,
    correct: chargesOk,
    feedback: chargesOk ? null : "Check the charge on each ion (group number)."
  });
  points.push({
    id: "brackets",
    label: "Square brackets",
    marks: 1,
    correct: bracketsOk,
    feedback: bracketsOk ? null : "Show square brackets around each ion."
  });
  const needsRatio = answer.ratioMark === true || ansAtoms.length > 2 || answer.left == null && ansAtoms.length > 2;
  if (needsRatio) {
    const countBy = (list) => {
      const m = {};
      (list || []).forEach((a) => {
        const s = a?.symbol || "?";
        m[s] = (m[s] || 0) + 1;
      });
      return m;
    };
    const aCounts = countBy(ansAtoms);
    const rCounts = countBy(rAtoms);
    const ratioOk = Object.keys(aCounts).length > 0 && Object.keys(aCounts).every((s) => aCounts[s] === rCounts[s]) && Object.keys(rCounts).every((s) => aCounts[s] === rCounts[s]) && shellsOk;
    const formula = Object.entries(aCounts).map(([s, c]) => c > 1 ? `${s}\xD7${c}` : s).join(" : ");
    points.push({
      id: "ratio",
      label: "Ion ratio / formula",
      marks: 1,
      correct: ratioOk,
      feedback: ratioOk ? null : `Show the correct ratio of ions (${formula}).`
    });
  }
  const earned = points.filter((p) => p.correct).reduce((s, p) => s + p.marks, 0);
  const available = points.reduce((s, p) => s + p.marks, 0);
  const wrong = points.filter((p) => !p.correct);
  let detail = "Ionic structures correct";
  if (wrong.length) {
    const shellsPoint = points.find((p) => p.id === "shells");
    if (shellsPoint && !shellsPoint.correct) {
      detail = "Electron arrangement incorrect";
    } else {
      detail = wrong.map((p) => p.feedback || p.label).join(" ");
    }
  }
  return {
    correct: earned === available && available > 0,
    earned,
    available,
    points,
    detail
  };
}
function markCovalent(resp, answer) {
  const bondsOk = (answer.bonds || []).every((b, i) => Number(resp.bonds?.[i]?.sharedPairs) === Number(b.sharedPairs));
  const loneOk = (answer.atoms || []).every((a, i) => Number(resp.atoms?.[i]?.lonePairs) === Number(a.lonePairs));
  const points = [
    {
      id: "shared",
      label: "Shared pairs",
      marks: 1,
      correct: bondsOk,
      feedback: bondsOk ? null : "Check the number of shared electron pairs in each bond."
    },
    {
      id: "lone",
      label: "Lone pairs",
      marks: 1,
      correct: loneOk,
      feedback: loneOk ? null : "Check the non-bonding (lone) pairs on each atom."
    }
  ];
  const earned = points.filter((p) => p.correct).reduce((s, p) => s + p.marks, 0);
  const available = points.reduce((s, p) => s + p.marks, 0);
  const detail = earned === available ? "Covalent structure correct" : points.filter((p) => !p.correct).map((p) => p.feedback || p.label).join(" ");
  return {
    correct: earned === available && available > 0,
    earned,
    available,
    points,
    detail
  };
}
function normalizeGroups(groups) {
  return (groups || []).map((g) => {
    const arr = Array.isArray(g) ? [...g].filter(Boolean).sort() : [];
    return arr.join(",");
  });
}
function markOrganic(resp, answer) {
  const bondsOk = (answer.carbonBonds || []).every((b, i) => Number(resp.carbonBonds?.[i]?.order) === Number(b.order));
  const answerHasGroups = (answer.groups || []).some((g) => Array.isArray(g) && g.some((x) => x && x !== "H"));
  const groupsOk = !answerHasGroups || JSON.stringify(normalizeGroups(resp.groups)) === JSON.stringify(normalizeGroups(answer.groups));
  const ok = bondsOk && groupsOk;
  return { correct: ok, detail: ok ? "Organic structure correct" : "Check bond orders and functional groups" };
}
function markPolymer(resp, answer) {
  const repOk = resp.selectedRepeat === answer.selectedRepeat;
  const linkOk = answer.selectedLinkage == null || resp.selectedLinkage === answer.selectedLinkage;
  return { correct: repOk && linkOk, detail: repOk && linkOk ? "Polymer repeat unit correct" : "Incorrect repeat unit or linkage" };
}
function markHalfEquation(resp, answer, cfg = null) {
  const expected = equationTermsFromAnswer(answer, cfg);
  const layout = halfEquationLayout(answer, cfg?.template);
  const slots = Array.isArray(resp.halfSlots) ? resp.halfSlots : [];
  const parsed = [0, 1, 2].map((i) => parseHalfSlot(slots[i]));
  const studentTerms = [];
  if (layout === "anion") {
    if (parsed[0]) studentTerms.push({ ...parsed[0], side: "left" });
    if (parsed[1]) studentTerms.push({ ...parsed[1], side: "right" });
    if (parsed[2]) studentTerms.push({ ...parsed[2], side: "right" });
  } else {
    if (parsed[0]) studentTerms.push({ ...parsed[0], side: "left" });
    if (parsed[1]) studentTerms.push({ ...parsed[1], side: "left" });
    if (parsed[2]) studentTerms.push({ ...parsed[2], side: "right" });
  }
  const want = formulaCountMap(expected);
  const got = formulaCountMap(studentTerms);
  const speciesOk = parsed.every(Boolean) && sameFormulaKeys(want.left, got.left) && sameFormulaKeys(want.right, got.right);
  const balanceOk = speciesOk && sameBalancedEquation(want, got);
  const points = [
    {
      id: "species",
      label: "Ion, electrons and element",
      marks: 1,
      correct: speciesOk,
      feedback: speciesOk ? null : "Check the ion, electrons and element are in the correct places."
    },
    {
      id: "balance",
      label: "Balancing",
      marks: 1,
      correct: balanceOk,
      feedback: balanceOk ? null : "Equation not balanced"
    }
  ];
  const earned = points.filter((p) => p.correct).reduce((s, p) => s + p.marks, 0);
  const available = points.reduce((s, p) => s + p.marks, 0);
  const allOk = earned === available && available > 0;
  const detail = allOk ? "Equation balanced" : points.filter((p) => !p.correct).map((p) => p.feedback || p.label).join(" ");
  return {
    correct: allOk,
    earned,
    available,
    points,
    detail
  };
}
function markBalance(resp, answer, cfg = null) {
  const subtype = cfg?.template?.subtype || answer.subtype || resp.subtype;
  if (subtype === "half") return markHalfEquation(resp, answer, cfg);
  const species = answer.species || cfg?.template?.species || [];
  const student = normalizeCoeffs(resp.coeffs || []);
  const target = normalizeCoeffs(answer.coeffs || []);
  const coeffsOk = arraysEqual(student, target);
  const extrasNeedStates = (answer.extraSpecies || []).some((x) => STATE_SYMBOLS.includes(String(x?.state || "")));
  let extrasOk = true;
  if (Array.isArray(answer.extraSpecies) && answer.extraSpecies.length) {
    const norm = (list) => list.map((x) => {
      const base = `${x.side}:${x.formula}:${normalizeCoeffs([x.coeff])[0]}`;
      return extrasNeedStates ? `${base}:${x.state || ""}` : base;
    }).sort().join("|");
    extrasOk = norm(resp.extraSpecies || []) === norm(answer.extraSpecies || []);
  }
  const formulaSpecies = species.filter((sp) => sp.studentEntersFormula);
  const formulasInPlay = formulaSpecies.length > 0;
  const formulasOk = !formulasInPlay || formulaSpecies.every((sp) => {
    const idx = species.indexOf(sp);
    const got = String(resp.formulas?.[idx] ?? "").trim();
    return normalizeIonFormula(got) === normalizeIonFormula(sp.formula);
  });
  const statesInPlay = equationRequiresStates(species);
  const statesOk = !statesInPlay || species.every((sp, i) => {
    if (!STATE_SYMBOLS.includes(String(sp.state || ""))) return true;
    return String(resp.states?.[i] || "") === sp.state;
  });
  const points = [
    {
      id: "coeffs",
      label: "Coefficients",
      marks: 1,
      correct: coeffsOk && extrasOk,
      feedback: coeffsOk && extrasOk ? null : "Equation not balanced"
    }
  ];
  if (formulasInPlay) {
    points.push({
      id: "formulas",
      label: "Chemical formulas",
      marks: 1,
      correct: formulasOk,
      feedback: formulasOk ? null : formulaMarkFeedback(formulaSpecies, resp, species)
    });
  }
  if (statesInPlay) {
    points.push({
      id: "states",
      label: "State symbols",
      marks: 1,
      correct: statesOk,
      feedback: statesOk ? null : "Select appropriate state symbols"
    });
  }
  const earned = points.filter((p) => p.correct).reduce((s, p) => s + p.marks, 0);
  const available = points.reduce((s, p) => s + p.marks, 0);
  const allOk = earned === available && available > 0;
  const detail = allOk ? "Equation balanced" : points.filter((p) => !p.correct).map((p) => p.feedback || p.label).join(" ");
  return {
    correct: allOk,
    earned,
    available,
    points,
    detail
  };
}
function markChemistryResponse(q, resp, key, markPoints, cleanUrl) {
  const cfg = getChemistryConfig(q);
  const max = q.max_marks || 1;
  const ao = { AO1: 0, AO2: 0, AO3: 0 };
  const maxAo = { AO1: max, AO2: 0, AO3: 0 };
  const answer = key?.key_payload || cfg?.answer || {};
  const kind = cfg?.kind || resp?.kind || answer.kind;
  let result = { correct: false, detail: "Unable to mark", earned: 0, available: 0, points: [] };
  if (kind === "electron_shell") {
    const r = markShell(resp, answer);
    result = {
      ...r,
      earned: r.correct ? 1 : 0,
      available: 1,
      points: [{ id: "shells", label: "Electron arrangement", marks: 1, correct: r.correct }]
    };
  } else if (kind === "ionic_bonding") result = markIonic(resp, answer);
  else if (kind === "covalent_bonding") result = markCovalent(resp, answer);
  else if (kind === "organic_structure") {
    const r = markOrganic(resp, answer);
    result = { ...r, earned: r.correct ? 1 : 0, available: 1, points: [{ id: "organic", label: "Structure", marks: 1, correct: r.correct }] };
  } else if (kind === "polymer_structure") {
    const r = markPolymer(resp, answer);
    result = { ...r, earned: r.correct ? 1 : 0, available: 1, points: [{ id: "polymer", label: "Repeat unit", marks: 1, correct: r.correct }] };
  } else if (kind === "molecule_builder") {
    result = markMoleculeBuilder(resp, answer);
  } else if (kind === "balance_equation") {
    result = markBalance(resp, answer, cfg);
  }
  let total;
  let appliedPoints = result.points || [];
  if (kind === "balance_equation" && appliedPoints.length) {
    if (max <= 1) {
      total = appliedPoints.every((p) => p.correct) ? max : 0;
    } else {
      let remaining = max;
      appliedPoints = appliedPoints.map((p) => {
        const take = Math.min(p.marks, remaining);
        remaining -= take;
        return { ...p, marks: take, active: take > 0 };
      }).filter((p) => p.active);
      total = appliedPoints.filter((p) => p.correct).reduce((s, p) => s + p.marks, 0);
    }
  } else if ((kind === "ionic_bonding" || kind === "covalent_bonding" || kind === "molecule_builder") && appliedPoints.length) {
    let remaining = max;
    appliedPoints = appliedPoints.map((p) => {
      const take = Math.min(p.marks, remaining);
      remaining -= take;
      return { ...p, marks: take, active: take > 0 };
    }).filter((p) => p.active);
    total = appliedPoints.filter((p) => p.correct).reduce((s, p) => s + p.marks, 0);
  } else {
    total = result.correct ? max : 0;
  }
  if (total) ao.AO1 = total;
  const missing = [];
  const shellsFailed = appliedPoints.some((p) => p.id === "shells" && !p.correct);
  const pointsForMissing = kind === "ionic_bonding" && shellsFailed ? appliedPoints.filter((p) => p.id === "shells") : appliedPoints.filter((p) => !p.correct);
  pointsForMissing.filter((p) => !p.correct).forEach((p) => {
    const tip = p.feedback || p.label || result.detail;
    missing.push({
      ao: "AO1",
      label: p.label,
      feedback: tip,
      text: tip,
      flashcard_text: tip,
      resource_url: cleanUrl || null
    });
  });
  if (!appliedPoints.length && !result.correct) {
    const tip = answer.feedback || result.detail || "Check the diagram against the mark scheme.";
    missing.push({
      ao: "AO1",
      label: result.detail,
      feedback: tip,
      text: tip,
      flashcard_text: tip,
      resource_url: cleanUrl || null
    });
  }
  const quality = total >= max && max > 0 ? 5 : total > 0 ? 3 : 1;
  let modelTitle = "Model answer";
  return {
    total,
    max,
    ao,
    maxAo,
    missing,
    quality,
    feedbackPayload: {
      missing,
      chemistry: {
        kind,
        correct: total >= max && max > 0,
        detail: result.detail,
        modelTitle,
        earned: total,
        available: max,
        points: appliedPoints,
        student: deepClone(resp),
        expected: deepClone(answer)
      }
    }
  };
}
function finalizeBalanceEquationConfig({ subtype, species, coeffs, baseConfig = null } = {}) {
  const baseTpl = baseConfig?.template || {};
  const baseAns = baseConfig?.answer || {};
  const resolvedSpecies = species?.length ? deepClone(species) : deepClone(baseAns.species || baseTpl.species || []);
  const extraSpecies = baseAns.extraSpecies?.length ? deepClone(baseAns.extraSpecies) : deepClone(baseTpl.extraSpecies || []);
  const allowedTokens = baseTpl.allowedTokens || ["e-", "H+", "H2O", "OH-"];
  const halfLayout = baseTpl.halfLayout;
  return {
    kind: "balance_equation",
    template: {
      subtype: subtype || baseTpl.subtype || "symbol",
      arrow: baseTpl.arrow || "->",
      species: deepClone(resolvedSpecies),
      allowedTokens,
      extraSpecies: deepClone(extraSpecies),
      ...halfLayout ? { halfLayout } : {}
    },
    answer: {
      kind: "balance_equation",
      coeffs,
      extraSpecies: deepClone(extraSpecies),
      species: deepClone(resolvedSpecies)
    }
  };
}
function buildChemistryConfigFromForm(prefix = "", baseConfig = null) {
  const p = prefix || "";
  const kind = document.getElementById(`${p}ChemKind`)?.value || "electron_shell";
  const presetId = document.getElementById(`${p}ChemPreset`)?.value || "";
  if (presetId && CHEMISTRY_PRESETS[presetId]) {
    const preset = CHEMISTRY_PRESETS[presetId];
    return {
      kind: preset.kind,
      template: deepClone(preset.template),
      answer: deepClone(preset.answer)
    };
  }
  if (kind === "electron_shell") {
    const atomCfg = buildAtomConfigFromForm(p);
    const shellsStr = document.getElementById(`${p}ChemShellsAnswer`)?.value?.trim();
    if (shellsStr) {
      const shells = shellsStr.split(",").map((s) => Number(s.trim()) || 0);
      atomCfg.answer.shells = shells;
      atomCfg.template.shellCount = Math.max(shells.length, 1);
      const eTotal = shells.reduce((a, b) => a + b, 0);
      atomCfg.template.electrons = eTotal;
      atomCfg.answer.charge = atomCfg.answer.nucleus.p - eTotal;
      atomCfg.template.charge = atomCfg.answer.charge;
    }
    return atomCfg;
  }
  if (kind === "organic_structure") {
    return buildOrganicConfigFromForm(p);
  }
  if (kind === "balance_equation") {
    const raw = document.getElementById(`${p}ChemEqSpecies`)?.value || "H2:left, O2:left, H2O:right";
    const coeffsRaw = document.getElementById(`${p}ChemEqCoeffs`)?.value || "2,1,2";
    const subtype = document.getElementById(`${p}ChemEqSubtype`)?.value || "symbol";
    const species = parseEquationSpeciesList(raw);
    const coeffs = coeffsRaw.split(",").map((c) => Number(c.trim()) || 0);
    return finalizeBalanceEquationConfig({ subtype, species, coeffs, baseConfig });
  }
  const fallback = Object.values(CHEMISTRY_PRESETS).find((pr) => pr.kind === kind);
  if (fallback) {
    return {
      kind: fallback.kind,
      template: deepClone(fallback.template),
      answer: deepClone(fallback.answer)
    };
  }
  return {
    kind,
    template: {},
    answer: { kind }
  };
}
function applyChemistryPresetToForm(prefix, presetId) {
  const p = prefix || "";
  const preset = CHEMISTRY_PRESETS[presetId];
  if (!preset) return;
  const kindEl = document.getElementById(`${p}ChemKind`);
  if (kindEl) kindEl.value = preset.kind;
  if (preset.recommendedMaxMarks) {
    const maxEl = document.getElementById(p === "edit" ? "editMaxMarks" : "maxMarks");
    if (maxEl) {
      const v = String(preset.recommendedMaxMarks);
      if (![...maxEl.options].some((o) => o.value === v)) {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = Number(v) === 1 ? "1 mark" : `${v} marks`;
        maxEl.appendChild(opt);
      }
      maxEl.value = v;
    }
  }
  if (preset.kind === "ionic_bonding" || preset.kind === "covalent_bonding") {
    const mode = p === "edit" ? "edit" : "creator";
    setTimeout(() => {
      if (window.AdminMetadata?.syncBondingDiagramAoAndSkills) {
        window.AdminMetadata.syncBondingDiagramAoAndSkills(mode);
      }
    }, 0);
  }
  if (preset.kind === "electron_shell") {
    const t = preset.template;
    const a = preset.answer;
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v;
    };
    set(`${p}ChemSymbol`, t.symbol);
    set(`${p}ChemShellsAnswer`, (a.shells || []).join(","));
    set(`${p}ChemProtons`, t.protons);
    set(`${p}ChemNeutrons`, t.neutrons);
    set(`${p}ChemElectrons`, t.electrons ?? (a.shells || []).reduce((x, y) => x + y, 0));
  }
  if (preset.kind === "organic_structure") {
    const t = preset.template;
    const a = preset.answer;
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v;
    };
    set(`${p}ChemOrgFamily`, t.family || a.family || "alkane");
    set(`${p}ChemOrgCarbons`, t.carbons ?? a.carbons ?? 2);
    set(`${p}ChemOrgName`, t.name || a.name || "");
    const dblFromAns = (a.carbonBonds || []).find((b) => Number(b.order) === 2);
    const dblAt0 = t.doubleBondAt ?? (dblFromAns ? dblFromAns.from : 0);
    set(`${p}ChemOrgDoubleAt`, Math.max(1, Number(dblAt0) + 1));
    const gIdx = (a.groups || []).findIndex((g) => Array.isArray(g) && g.some((x) => x && x !== "H"));
    const gType = gIdx >= 0 ? a.groups[gIdx].find((x) => x && x !== "H") || "" : "";
    set(`${p}ChemOrgGroupCarbon`, gIdx >= 0 ? gIdx + 1 : "");
    set(`${p}ChemOrgGroupType`, gType);
  }
  if (preset.kind === "balance_equation") {
    const t = preset.template;
    const a = preset.answer;
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v;
    };
    set(`${p}ChemEqSubtype`, t.subtype || "symbol");
    set(`${p}ChemEqSpecies`, formatEquationSpeciesList(t.species || a.species || []));
    set(`${p}ChemEqCoeffs`, (a.coeffs || []).join(","));
  }
}
function populateChemistryPresetSelect(selectEl, filterKind = null) {
  if (!selectEl) return;
  const entries = Object.entries(CHEMISTRY_PRESETS).filter(([, p]) => !filterKind || p.kind === filterKind);
  selectEl.innerHTML = `<option value="">\u2014 Custom / manual \u2014</option>` + entries.map(
    ([id, p]) => `<option value="${escapeHtml2(id)}">${escapeHtml2(p.label)}</option>`
  ).join("");
}
function symbolFromProtons(protons) {
  const z = Number(protons);
  const hit = Object.entries(ELEMENT_DATA).find(([, d]) => d.Z === z);
  return hit ? hit[0] : "";
}
function buildAtomDiagramConfig({ symbol, protons, neutrons, electrons, showIonBrackets } = {}) {
  const p = Math.max(0, Math.floor(Number(protons) || 0));
  const n = Math.max(0, Math.floor(Number(neutrons) || 0));
  const eCount = electrons == null || electrons === "" ? p : Math.max(0, Math.floor(Number(electrons) || 0));
  const shells = distributeElectrons(eCount);
  const charge = p - eCount;
  let sym = String(symbol || "").trim();
  if (!sym) sym = symbolFromProtons(p) || "X";
  const asIon = showIonBrackets === true || showIonBrackets !== false && charge !== 0;
  return {
    kind: "electron_shell",
    template: {
      symbol: sym,
      shellCount: Math.max(shells.length, 1),
      protons: p,
      neutrons: n,
      electrons: eCount,
      charge,
      showIonBrackets: asIon
    },
    answer: {
      kind: "electron_shell",
      shells,
      nucleus: { p, n },
      symbol: sym,
      charge,
      showIonBrackets: asIon
    }
  };
}
function buildOrganicDiagramConfig(spec = {}) {
  const family = spec.family || "alkane";
  const carbons = Math.min(8, Math.max(1, Math.floor(Number(spec.carbons) || 1)));
  const doubleBondAt = Math.min(
    Math.max(0, Math.floor(Number(spec.doubleBondAt) || 0)),
    Math.max(0, carbons - 2)
  );
  const carbonBonds = [];
  for (let i = 0; i < carbons - 1; i++) {
    const order = family === "alkene" && i === doubleBondAt ? 2 : 1;
    carbonBonds.push({ from: i, to: i + 1, order });
  }
  const groups = Array.from({ length: carbons }, () => []);
  let groupType = spec.groupType || null;
  let groupCarbon = spec.groupCarbon;
  if (groupCarbon == null || groupCarbon === "") {
    if (family === "alcohol") {
      groupType = "OH";
      groupCarbon = carbons - 1;
    } else if (family === "carboxylic_acid") {
      groupType = "COOH";
      groupCarbon = carbons - 1;
    } else if (family === "ester") {
      groupType = "COO";
      groupCarbon = Math.min(1, carbons - 1);
    }
  }
  if (groupType && groupCarbon != null && groupCarbon !== "") {
    const gi = Math.min(carbons - 1, Math.max(0, Math.floor(Number(groupCarbon))));
    groups[gi] = [groupType];
  }
  const name = String(spec.name || "").trim() || `${family.replace(/_/g, " ")} (C${carbons})`;
  return {
    kind: "organic_structure",
    template: {
      family,
      carbons,
      name,
      doubleBondAt,
      groupCarbon: groupCarbon == null ? null : Number(groupCarbon),
      groupType
    },
    answer: {
      kind: "organic_structure",
      family,
      carbons,
      name,
      carbonBonds,
      groups
    }
  };
}
function buildAtomConfigFromForm(prefix = "") {
  const p = prefix || "";
  return buildAtomDiagramConfig({
    symbol: document.getElementById(`${p}ChemSymbol`)?.value,
    protons: document.getElementById(`${p}ChemProtons`)?.value,
    neutrons: document.getElementById(`${p}ChemNeutrons`)?.value,
    electrons: document.getElementById(`${p}ChemElectrons`)?.value,
    // Interactive electron-shell questions never draw ion brackets
    showIonBrackets: false
  });
}
function buildOrganicConfigFromForm(prefix = "") {
  const p = prefix || "";
  const doubleRaw = document.getElementById(`${p}ChemOrgDoubleAt`)?.value;
  const groupRaw = document.getElementById(`${p}ChemOrgGroupCarbon`)?.value;
  return buildOrganicDiagramConfig({
    carbons: document.getElementById(`${p}ChemOrgCarbons`)?.value,
    family: document.getElementById(`${p}ChemOrgFamily`)?.value,
    name: document.getElementById(`${p}ChemOrgName`)?.value,
    doubleBondAt: doubleRaw === "" || doubleRaw == null ? 0 : Math.max(0, Math.floor(Number(doubleRaw) || 1) - 1),
    groupCarbon: groupRaw === "" || groupRaw == null ? null : Math.max(0, Math.floor(Number(groupRaw) || 1) - 1),
    groupType: document.getElementById(`${p}ChemOrgGroupType`)?.value || null
  });
}
function listStemDiagramPresets() {
  return Object.entries(CHEMISTRY_PRESETS).filter(([, p]) => p.kind !== "balance_equation").map(([id, p]) => ({ id, label: p.label, kind: p.kind, track: p.track || "combined" }));
}
function resolveStemDiagramSource(presetIdOrConfig) {
  if (!presetIdOrConfig) return null;
  if (typeof presetIdOrConfig === "string") {
    return CHEMISTRY_PRESETS[presetIdOrConfig] || null;
  }
  return presetIdOrConfig;
}
function displayStateFromPresetOrConfig(presetOrConfig) {
  const cfg = presetOrConfig?.answer ? { kind: presetOrConfig.kind, template: presetOrConfig.template, answer: presetOrConfig.answer } : presetOrConfig;
  if (!cfg) return null;
  const answer = cfg.answer || {};
  const kind = cfg.kind || answer.kind;
  if (kind === "electron_shell") {
    const symbol = answer.symbol || cfg.template?.symbol || "C";
    const data = ELEMENT_DATA[symbol] || ELEMENT_DATA.C;
    const shells = [...answer.shells || data.shells];
    const p = answer.nucleus?.p ?? cfg.template?.protons ?? data.Z;
    const n = answer.nucleus?.n ?? cfg.template?.neutrons ?? Math.round(data.A - data.Z);
    const charge = answer.charge ?? cfg.template?.charge ?? p - shells.reduce((a, b) => a + b, 0);
    const showIonBrackets = answer.showIonBrackets ?? cfg.template?.showIonBrackets ?? (charge != null && charge !== 0);
    return {
      kind,
      symbol,
      shells,
      nucleus: { p, n },
      charge,
      showIonBrackets: !!showIonBrackets
    };
  }
  if (kind === "ionic_bonding") {
    const atoms = ionicAnswerAtoms(answer);
    return { kind, atoms: deepClone(atoms), transferred: answer.transferred };
  }
  if (kind === "ionic_lattice") {
    return {
      kind,
      compound: answer.compound || cfg.template?.compound || "NaCl",
      style: answer.style || cfg.template?.style || "ball_stick",
      size: answer.size || cfg.template?.size || 3
    };
  }
  if (kind === "covalent_bonding") {
    return deepClone({ kind, ...answer });
  }
  if (kind === "organic_structure") {
    return {
      kind,
      family: answer.family || cfg.template?.family || "alkane",
      carbons: answer.carbons ?? cfg.template?.carbons ?? 2,
      carbonBonds: deepClone(answer.carbonBonds || []),
      groups: deepClone(answer.groups || []),
      name: answer.name || cfg.template?.name || "",
      selectedGroup: null
    };
  }
  if (kind === "polymer_structure") {
    return {
      kind,
      mode: cfg.template?.mode || "addition",
      selectedRepeat: answer.selectedRepeat,
      selectedLinkage: answer.selectedLinkage,
      name: answer.name || cfg.template?.name || ""
    };
  }
  if (kind === "molecule_builder") {
    return deepClone({
      kind,
      atoms: answer.atoms || [],
      bonds: answer.bonds || []
    });
  }
  if (kind === "metallic_bonding") {
    return { kind: "metallic_bonding" };
  }
  if (kind === "particle_model") {
    return {
      kind: "particle_model",
      state: answer.state || answer.phase || cfg.template?.state || "solid",
      showLabel: !!(answer.showLabel || cfg.template?.showLabel)
    };
  }
  if (kind === "carbon_allotrope") {
    return {
      kind: "carbon_allotrope",
      allotrope: answer.allotrope || cfg.template?.allotrope || "graphite"
    };
  }
  return null;
}
function renderDisplayedFormulaSvg(state, { interactive = false } = {}) {
  const carbons = state.carbons || 1;
  const bonds = state.carbonBonds || [];
  const groups = state.groups || [];
  const spacing = 44;
  const marginX = 48;
  const w = marginX * 2 + Math.max(carbons - 1, 0) * spacing;
  const h = 200;
  const cy = 100;
  const xs = Array.from({ length: carbons }, (_, i) => marginX + i * spacing);
  let svg = "";
  const letterGap = 8;
  const bondOrder = (from, to) => {
    const b = bonds.find((x) => x.from === from && x.to === to || x.from === to && x.to === from);
    return b?.order || 1;
  };
  const hasDoubleBond = (i) => {
    if (i > 0 && bondOrder(i - 1, i) >= 2) return true;
    if (i < carbons - 1 && bondOrder(i, i + 1) >= 2) return true;
    return false;
  };
  for (let i = 0; i < carbons - 1; i++) {
    const order = bondOrder(i, i + 1);
    const x1 = xs[i] + letterGap;
    const x2 = xs[i + 1] - letterGap;
    if (order === 1) {
      svg += `<line x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="#0f172a" stroke-width="2.5"/>`;
    } else if (order === 2) {
      svg += `<line x1="${x1}" y1="${cy - 4}" x2="${x2}" y2="${cy - 4}" stroke="#0f172a" stroke-width="2.5"/>`;
      svg += `<line x1="${x1}" y1="${cy + 4}" x2="${x2}" y2="${cy + 4}" stroke="#0f172a" stroke-width="2.5"/>`;
    } else if (order >= 3) {
      svg += `<line x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="#0f172a" stroke-width="2.5"/>`;
      svg += `<line x1="${x1}" y1="${cy - 7}" x2="${x2}" y2="${cy - 7}" stroke="#0f172a" stroke-width="2.5"/>`;
      svg += `<line x1="${x1}" y1="${cy + 7}" x2="${x2}" y2="${cy + 7}" stroke="#0f172a" stroke-width="2.5"/>`;
    }
    if (interactive) {
      const mx = (xs[i] + xs[i + 1]) / 2;
      const bi = bonds.findIndex((x) => x.from === i && x.to === i + 1);
      svg += `<rect class="chem-org-bond" data-bond="${bi >= 0 ? bi : i}" x="${mx - 18}" y="${cy - 28}" width="36" height="56" fill="transparent" tabindex="0" role="button" aria-label="Cycle bond order" style="cursor:pointer"/>`;
    }
  }
  const specialAt = (i) => {
    const g = groups[i];
    if (!Array.isArray(g) || !g.length) return null;
    return g.find((x) => x && x !== "H") || null;
  };
  for (let i = 0; i < carbons; i++) {
    const x = xs[i];
    let used = 0;
    if (i > 0) used += bondOrder(i - 1, i);
    if (i < carbons - 1) used += bondOrder(i, i + 1);
    const special = specialAt(i);
    if (special === "OH" || special === "COOH" || special === "COO") used += 1;
    const hCount = Math.max(0, 4 - used);
    const onDouble = hasDoubleBond(i);
    if (interactive) {
      svg += `<circle class="chem-org-carbon" data-carbon="${i}" cx="${x}" cy="${cy}" r="16" fill="transparent" stroke="none" tabindex="0" role="button" aria-label="Apply selected group to carbon ${i + 1}" style="cursor:pointer"/>`;
    }
    svg += `<text x="${x}" y="${cy + 5}" text-anchor="middle" font-size="16" font-weight="700" fill="#0f172a" pointer-events="none">C</text>`;
    const hasLeftBond = i > 0;
    const hasRightBond = i < carbons - 1;
    const blocked = /* @__PURE__ */ new Set();
    if (special === "COOH") blocked.add("right");
    if (special === "OH" || special === "COO") blocked.add("down");
    const dirOrder = [];
    if (onDouble) {
      dirOrder.push("up", "down");
      if (!hasLeftBond) dirOrder.push("left");
      if (!hasRightBond) dirOrder.push("right");
    } else {
      if (!hasLeftBond) dirOrder.push("left");
      if (!hasRightBond) dirOrder.push("right");
      dirOrder.push("up", "down", "left", "right");
    }
    const chosen = [];
    for (const d of dirOrder) {
      if (chosen.length >= hCount) break;
      if (blocked.has(d) || chosen.includes(d)) continue;
      chosen.push(d);
    }
    chosen.forEach((d) => {
      if (d === "up") {
        svg += `<line x1="${x}" y1="${cy - 12}" x2="${x}" y2="${cy - 30}" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${x}" y="${cy - 34}" text-anchor="middle" font-size="15" font-weight="600" fill="#0f172a">H</text>`;
      } else if (d === "down") {
        svg += `<line x1="${x}" y1="${cy + 12}" x2="${x}" y2="${cy + 30}" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${x}" y="${cy + 46}" text-anchor="middle" font-size="15" font-weight="600" fill="#0f172a">H</text>`;
      } else if (d === "left") {
        svg += `<line x1="${x - 12}" y1="${cy}" x2="${x - 28}" y2="${cy}" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${x - 38}" y="${cy + 5}" text-anchor="middle" font-size="15" font-weight="600" fill="#0f172a">H</text>`;
      } else if (d === "right") {
        svg += `<line x1="${x + 12}" y1="${cy}" x2="${x + 28}" y2="${cy}" stroke="#0f172a" stroke-width="2"/>`;
        svg += `<text x="${x + 38}" y="${cy + 5}" text-anchor="middle" font-size="15" font-weight="600" fill="#0f172a">H</text>`;
      }
    });
    if (special === "OH") {
      svg += `<line x1="${x}" y1="${cy + 12}" x2="${x}" y2="${cy + 34}" stroke="#0f172a" stroke-width="2"/>`;
      svg += `<text x="${x}" y="${cy + 52}" text-anchor="middle" font-size="13" font-weight="700" fill="#0369a1">OH</text>`;
    } else if (special === "COOH") {
      svg += `<line x1="${x + 12}" y1="${cy}" x2="${x + 34}" y2="${cy}" stroke="#0f172a" stroke-width="2"/>`;
      svg += `<text x="${x + 68}" y="${cy + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#0369a1">OOH</text>`;
      svg += `<line x1="${x + 34}" y1="${cy}" x2="${x + 34}" y2="${cy - 26}" stroke="#0f172a" stroke-width="2"/>`;
      svg += `<line x1="${x + 28}" y1="${cy - 26}" x2="${x + 40}" y2="${cy - 26}" stroke="#0f172a" stroke-width="2"/>`;
      svg += `<text x="${x + 34}" y="${cy - 34}" text-anchor="middle" font-size="13" font-weight="700" fill="#0369a1">O</text>`;
    } else if (special === "COO") {
      svg += `<line x1="${x}" y1="${cy + 12}" x2="${x}" y2="${cy + 32}" stroke="#0f172a" stroke-width="2"/>`;
      svg += `<text x="${x}" y="${cy + 50}" text-anchor="middle" font-size="12" font-weight="700" fill="#0369a1">COO</text>`;
    }
  }
  const label = state.name || state.family || "";
  return `<svg xmlns="http://www.w3.org/2000/svg" class="chem-svg" viewBox="0 0 ${Math.max(w, 160)} ${h}" width="100%" style="max-width:${Math.max(w, 220)}px;display:block;margin:0 auto;">
    ${label ? `<text x="${Math.max(w, 160) / 2}" y="22" text-anchor="middle" fill="#64748b" font-size="12">${escapeHtml2(String(label))}</text>` : ""}
    ${svg}
  </svg>`;
}
function polymerRepeatSpec(repeatId, fallbackLabel = "") {
  const spec = POLYMER_REPEAT_STRUCTURES[repeatId];
  if (spec) return spec;
  if (fallbackLabel) return { type: "text", label: fallbackLabel };
  return { type: "text", label: repeatId || "repeat unit" };
}
function renderPolymerCarbonSubstituent(cx, cy, symbol, dir, stroke = "#0f172a") {
  const gap = 8;
  const arm = 24;
  if (dir === "top") {
    return `
      <line x1="${cx}" y1="${cy - gap}" x2="${cx}" y2="${cy - arm}" stroke="${stroke}" stroke-width="2.5"/>
      <text x="${cx}" y="${cy - arm - 4}" text-anchor="middle" font-size="18" font-weight="700" fill="${stroke}">${escapeHtml2(symbol)}</text>`;
  }
  return `
    <line x1="${cx}" y1="${cy + gap}" x2="${cx}" y2="${cy + arm}" stroke="${stroke}" stroke-width="2.5"/>
    <text x="${cx}" y="${cy + arm + 14}" text-anchor="middle" font-size="18" font-weight="700" fill="${stroke}">${escapeHtml2(symbol)}</text>`;
}
function renderPolymerRepeatUnitSvg(repeatId, {
  title = "",
  showTitle = false,
  fallbackLabel = "",
  linkage = ""
} = {}) {
  const spec = polymerRepeatSpec(repeatId, fallbackLabel);
  const w = 320;
  const h = showTitle ? 130 : 112;
  const titleY = 20;
  const cy = showTitle ? 68 : 58;
  const cx1 = 118;
  const cx2 = 202;
  const gap = 9;
  const extLeft = 28;
  const extRight = 292;
  const parenTop = cy - 34;
  const parenBot = cy + 34;
  const stroke = "#0f172a";
  let inner = "";
  if (spec.type === "text") {
    inner = `
      <text x="${w / 2}" y="${cy + 6}" text-anchor="middle" font-size="16" font-weight="700" fill="${stroke}">${escapeHtml2(spec.label)}</text>`;
  } else {
    const [c1, c2] = spec.carbons;
    inner += `<line x1="${extLeft}" y1="${cy}" x2="${cx1 - gap}" y2="${cy}" stroke="${stroke}" stroke-width="2.5"/>`;
    inner += `<line x1="${cx2 + gap}" y1="${cy}" x2="${extRight}" y2="${cy}" stroke="${stroke}" stroke-width="2.5"/>`;
    inner += `<path d="M 94 ${parenTop} Q 84 ${cy} 94 ${parenBot}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
    inner += `<path d="M 226 ${parenTop} Q 236 ${cy} 226 ${parenBot}" fill="none" stroke="${stroke}" stroke-width="2"/>`;
    inner += `<line x1="${cx1 + gap}" y1="${cy}" x2="${cx2 - gap}" y2="${cy}" stroke="${stroke}" stroke-width="2.5"/>`;
    inner += `<text x="${cx1}" y="${cy + 6}" text-anchor="middle" font-size="18" font-weight="700" fill="${stroke}">C</text>`;
    inner += `<text x="${cx2}" y="${cy + 6}" text-anchor="middle" font-size="18" font-weight="700" fill="${stroke}">C</text>`;
    inner += renderPolymerCarbonSubstituent(cx1, cy, c1.top, "top", stroke);
    inner += renderPolymerCarbonSubstituent(cx1, cy, c1.bottom, "bottom", stroke);
    inner += renderPolymerCarbonSubstituent(cx2, cy, c2.top, "top", stroke);
    inner += renderPolymerCarbonSubstituent(cx2, cy, c2.bottom, "bottom", stroke);
  }
  const titleHtml = showTitle && title ? `<text x="${w / 2}" y="${titleY}" text-anchor="middle" fill="#64748b" font-size="12">${escapeHtml2(title)}</text>` : "";
  const linkHtml = linkage ? `<text x="${w / 2}" y="${h - 6}" text-anchor="middle" fill="#0369a1" font-size="11">Linkage: ${escapeHtml2(linkage)}</text>` : "";
  return `<svg class="chem-svg chem-polymer-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:360px;display:block;margin:0 auto;">
    ${titleHtml}
    ${inner}
    <text x="248" y="${parenBot + 8}" font-size="16" font-weight="700" fill="${stroke}">n</text>
    ${linkHtml}
  </svg>`;
}
function renderPolymerDisplaySvg(state, cfg = {}) {
  const template = cfg.template || {};
  const options = template.repeatOptions || [];
  const chosen = options.find((o) => o.id === state.selectedRepeat);
  const linkage = state.selectedLinkage ? (template.linkageOptions || []).find((l) => l.id === state.selectedLinkage)?.label || state.selectedLinkage : "";
  const title = state.name || template.name || template.monomerLabel || "polymer";
  return renderPolymerRepeatUnitSvg(state.selectedRepeat, {
    showTitle: false,
    fallbackLabel: chosen?.label || state.selectedRepeat || "repeat unit",
    linkage
  });
}
function moleculeBuilderCaption(state) {
  const atoms = state?.atoms || [];
  const bonds = state?.bonds || [];
  if (!atoms.length) return "No atoms placed";
  const counts = {};
  atoms.forEach((a) => {
    counts[a.symbol] = (counts[a.symbol] || 0) + 1;
  });
  const formula = Object.entries(counts).map(([s, n]) => n > 1 ? `${s}${n}` : s).join("");
  return `${formula || "molecule"} \xB7 ${bonds.length} bond${bonds.length === 1 ? "" : "s"}`;
}
function atomBondAnchors(ax, ay, bx, by, inset = 11) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x1: ax + dx / len * inset,
    y1: ay + dy / len * inset,
    x2: bx - dx / len * inset,
    y2: by - dy / len * inset
  };
}
function renderMoleculeBuilderSvg(state, { interactive = false, w = 400, h = 260 } = {}) {
  const atoms = state?.atoms || [];
  const bonds = state?.bonds || [];
  const bondFrom = state?.bondFrom ?? null;
  const stroke = "#0f172a";
  let svg = `<rect class="chem-mol-canvas-bg" x="0" y="0" width="${w}" height="${h}" fill="#fff" ${interactive ? 'style="cursor:crosshair"' : ""}/>`;
  bonds.forEach((bond, bondIdx) => {
    const a = atoms.find((x) => x.id === bond.a);
    const b = atoms.find((x) => x.id === bond.b);
    if (!a || !b) return;
    const pts = atomBondAnchors(a.x, a.y, b.x, b.y);
    svg += `<line x1="${pts.x1}" y1="${pts.y1}" x2="${pts.x2}" y2="${pts.y2}" stroke="${stroke}" stroke-width="2.5"/>`;
    if (interactive) {
      svg += `<line class="chem-mol-bond-hit" data-mol-bond="${bondIdx}" x1="${pts.x1}" y1="${pts.y1}" x2="${pts.x2}" y2="${pts.y2}" stroke="transparent" stroke-width="16" style="cursor:pointer" tabindex="0" role="button" aria-label="Remove bond"/>`;
    }
  });
  atoms.forEach((atom) => {
    const selected = bondFrom === atom.id;
    if (interactive) {
      svg += `<circle class="chem-mol-atom-hit" data-mol-atom="${escapeHtml2(atom.id)}" cx="${atom.x}" cy="${atom.y}" r="20" fill="transparent" tabindex="0" role="button" aria-label="${escapeHtml2(atom.symbol)} atom" style="cursor:pointer"/>`;
      if (selected) {
        svg += `<circle cx="${atom.x}" cy="${atom.y}" r="22" fill="none" stroke="#2563eb" stroke-width="2" pointer-events="none"/>`;
      }
    }
    svg += `<text x="${atom.x}" y="${atom.y + 6}" text-anchor="middle" font-size="18" font-weight="700" fill="${stroke}" pointer-events="none">${escapeHtml2(atom.symbol)}</text>`;
  });
  const xmlns = interactive ? "" : ' xmlns="http://www.w3.org/2000/svg"';
  return `<svg class="chem-svg chem-mol-svg" id="chemMolBuilderSvg"${xmlns} viewBox="0 0 ${w} ${h}" width="100%" style="max-width:440px;touch-action:manipulation;" preserveAspectRatio="xMidYMid meet">${svg}</svg>`;
}
function renderMoleculeBuilderDiagram(state, cfg) {
  const allowed = cfg.template?.allowedSymbols || MOLECULE_BUILDER_SYMBOLS;
  const svg = renderMoleculeBuilderSvg(state, { interactive: true });
  const symbolChips = allowed.map((sym) => `
    <button type="button" class="btn chem-chip ${state.selectedSymbol === sym ? "chem-chip-active" : ""}" data-mol-symbol="${escapeHtml2(sym)}">${escapeHtml2(sym)}</button>
  `).join("");
  const bondHint = state.bondFrom ? `<span class="muted" style="font-size:0.8rem;align-self:center;">Tap the second atom to bond</span>` : "";
  return `
    <div class="chem-diagram-wrap chem-diagram-wrap--responsive">
      ${svg}
      <div class="chem-toolbar" style="margin-top:8px;">
        ${symbolChips}
      </div>
      <div class="chem-toolbar">
        <button type="button" class="btn chem-chip ${state.mode !== "bond" ? "chem-chip-active" : ""}" data-mol-mode="add">Add atom</button>
        <button type="button" class="btn chem-chip ${state.mode === "bond" ? "chem-chip-active" : ""}" data-mol-mode="bond">Add bond</button>
        ${bondHint}
      </div>
      <div class="chem-status" id="chemStatus">${state.bondFrom ? "Tap the second atom to bond" : ""}</div>
    </div>`;
}
function normalizeMoleculeGraph(state) {
  const atoms = [...state?.atoms || []].filter((a) => a?.id && a?.symbol);
  const bonds = (state?.bonds || []).filter((b) => b?.a && b?.b);
  const sorted = atoms.sort((a, b) => a.symbol.localeCompare(b.symbol) || String(a.id).localeCompare(String(b.id)));
  const idMap = new Map(sorted.map((a, i) => [a.id, i]));
  const syms = sorted.map((a) => a.symbol).join(",");
  const edges = bonds.map((b) => {
    const i = idMap.get(b.a);
    const j = idMap.get(b.b);
    if (i == null || j == null) return null;
    return i < j ? `${i}-${j}` : `${j}-${i}`;
  }).filter(Boolean).sort().join(",");
  return `${syms}|${edges}`;
}
function normalizeMoleculeAtomSymbols(state) {
  const counts = {};
  (state?.atoms || []).forEach((a) => {
    if (a?.symbol) counts[a.symbol] = (counts[a.symbol] || 0) + 1;
  });
  return Object.keys(counts).sort().map((k) => `${k}:${counts[k]}`).join(",");
}
function normalizeMoleculeBondEdges(state) {
  const atoms = [...state?.atoms || []].filter((a) => a?.id && a?.symbol);
  const bonds = (state?.bonds || []).filter((b) => b?.a && b?.b);
  const sorted = atoms.sort((a, b) => a.symbol.localeCompare(b.symbol) || String(a.id).localeCompare(String(b.id)));
  const idMap = new Map(sorted.map((a, i) => [a.id, i]));
  return bonds.map((b) => {
    const i = idMap.get(b.a);
    const j = idMap.get(b.b);
    if (i == null || j == null) return null;
    return i < j ? `${i}-${j}` : `${j}-${i}`;
  }).filter(Boolean).sort().join(",");
}
function markMoleculeBuilder(resp, answer) {
  const atomsOk = normalizeMoleculeAtomSymbols(resp) === normalizeMoleculeAtomSymbols(answer);
  const bondsOk = atomsOk && normalizeMoleculeBondEdges(resp) === normalizeMoleculeBondEdges(answer);
  const points = [
    {
      id: "atoms",
      label: "Correct atoms",
      marks: 1,
      correct: atomsOk,
      feedback: atomsOk ? null : "Check you have the correct number of each atom."
    },
    {
      id: "bonds",
      label: "Correct bonds",
      marks: 1,
      correct: bondsOk,
      feedback: bondsOk ? null : atomsOk ? "Check which atoms are joined by single bonds." : "Fix the atoms first, then check the bonds."
    }
  ];
  const earned = points.filter((p) => p.correct).reduce((s, p) => s + p.marks, 0);
  const available = points.reduce((s, p) => s + p.marks, 0);
  const detail = earned === available ? "Molecule structure correct" : points.filter((p) => !p.correct).map((p) => p.feedback || p.label).join(" ");
  return {
    correct: earned === available && available > 0,
    earned,
    available,
    points,
    detail
  };
}
function svgPointFromClient(svg, clientX, clientY) {
  if (!svg?.createSVGPoint) return { x: 0, y: 0 };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const sp = pt.matrixTransform(ctm.inverse());
  return { x: sp.x, y: sp.y };
}
function addMoleculeAtom(state, cfg, x, y) {
  const maxAtoms = cfg.template?.maxAtoms || 12;
  if ((state.atoms || []).length >= maxAtoms) return false;
  const id = `a${state.nextAtomId || 1}`;
  state.nextAtomId = (state.nextAtomId || 1) + 1;
  state.atoms = state.atoms || [];
  state.atoms.push({
    id,
    symbol: state.selectedSymbol || "H",
    x: Math.round(x),
    y: Math.round(y)
  });
  return true;
}
function addMoleculeBond(state, aId, bId) {
  if (!aId || !bId || aId === bId) return false;
  state.bonds = state.bonds || [];
  const exists = state.bonds.some((b) => b.a === aId && b.b === bId || b.a === bId && b.b === aId);
  if (exists) return false;
  state.bonds.push({ a: aId, b: bId });
  return true;
}
function metallicElectronPoint(cx, cy, shellR, deg) {
  const rad = deg * Math.PI / 180;
  return { x: cx + shellR * Math.cos(rad), y: cy + shellR * Math.sin(rad) };
}
function renderMetalAtomSvg(cx, cy, {
  outerR = 22,
  shellR = 14,
  electronDeg = 0,
  stroke = "#0f172a"
} = {}) {
  const e = metallicElectronPoint(cx, cy, shellR, electronDeg);
  return `
    <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="#fff" stroke="${stroke}" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${shellR}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-dasharray="4 3"/>
    <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="16" font-weight="700" fill="${stroke}">+</text>
    <circle cx="${e.x}" cy="${e.y}" r="5" fill="#fff" stroke="${stroke}" stroke-width="1.2"/>
    <text x="${e.x}" y="${e.y + 3.5}" text-anchor="middle" font-size="9" font-weight="700" fill="${stroke}">\u2212</text>`;
}
function renderMetalIonSvg(cx, cy, {
  r = 14,
  stroke = "#0f172a"
} = {}) {
  const fontSize = r <= 14 ? 12 : 16;
  const textY = cy + (r <= 14 ? 4 : 5);
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${stroke}" stroke-width="1.5" stroke-dasharray="5 4"/>
    <text x="${cx}" y="${textY}" text-anchor="middle" font-size="${fontSize}" font-weight="700" fill="${stroke}">+</text>`;
}
function renderMetallicBondingSvg(_state = {}) {
  const outerR = 22;
  const ionR = 14;
  const stroke = "#0f172a";
  const leftOx = 34;
  const leftOy = 26;
  const rightOx = 246;
  const rightOy = 26;
  const clusterW = 88;
  const clusterH = 76;
  const clusterBoxW = clusterW + outerR * 2;
  const clusterBoxH = clusterH + outerR * 2;
  let leftSvg = "";
  METALLIC_LATTICE_SITES.forEach((site, i) => {
    leftSvg += renderMetalAtomSvg(
      leftOx + outerR + site.x,
      leftOy + outerR + site.y,
      { electronDeg: METALLIC_ELECTRON_ANGLES[i] || 0, stroke }
    );
  });
  const arrowY = leftOy + outerR + clusterH / 2;
  const arrowSvg = `
    <line x1="168" y1="${arrowY}" x2="214" y2="${arrowY}" stroke="${stroke}" stroke-width="3.5" stroke-linecap="round"/>
    <polygon points="${214},${arrowY} ${206},${arrowY - 7} ${206},${arrowY + 7}" fill="${stroke}"/>`;
  const seaX = rightOx;
  const seaY = rightOy;
  const seaW = clusterBoxW;
  const seaH = clusterBoxH;
  const seaRx = 14;
  const seaFill = "#e5e7eb";
  let rightSvg = `
    <rect x="${seaX}" y="${seaY}" width="${seaW}" height="${seaH}" rx="${seaRx}" ry="${seaRx}" fill="${seaFill}" stroke="none"/>`;
  METALLIC_LATTICE_SITES.forEach((site) => {
    rightSvg += renderMetalIonSvg(
      rightOx + outerR + site.x,
      rightOy + outerR + site.y,
      { r: ionR, stroke }
    );
  });
  const gapX = rightOx + outerR + 44;
  const gapY = rightOy + outerR + 38;
  const labelY = seaY + seaH + 28;
  const leaderFoot = labelY - 11;
  const labelSvg = `
    <line x1="${gapX}" y1="${gapY}" x2="${gapX}" y2="${leaderFoot}" stroke="${stroke}" stroke-width="1"/>
    <text x="${gapX}" y="${labelY}" text-anchor="middle" font-size="13" font-weight="600" fill="${stroke}">Delocalised electrons</text>`;
  const w = 420;
  const h = labelY + 12;
  return `<svg class="chem-svg chem-metallic-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:440px;display:block;margin:0 auto;" preserveAspectRatio="xMidYMid meet" aria-label="Metallic bonding diagram">
    ${leftSvg}
    ${arrowSvg}
    ${rightSvg}
    ${labelSvg}
  </svg>`;
}
function particleModelStateLabel(state) {
  const key = String(state || "").toLowerCase();
  if (key === "solid") return "Solid";
  if (key === "liquid") return "Liquid";
  if (key === "gas") return "Gas";
  return "";
}
function solidParticlePositions(box = PARTICLE_MODEL_BOX, r = PARTICLE_MODEL_R) {
  const step = 2 * r;
  const n = Math.floor((box - 2) / step);
  const used = (n - 1) * step;
  const pad = (box - used) / 2;
  const pts = [];
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      pts.push({ x: pad + col * step, y: pad + row * step });
    }
  }
  return pts;
}
function liquidParticlePositions(box = PARTICLE_MODEL_BOX, r = PARTICLE_MODEL_R) {
  const left = 1 + r;
  const right = box - 1 - r;
  const bottom = box - 1 - r;
  const topLimit = 1 + r + 2;
  const minDist = 2 * r;
  const pts = [];
  let seed = 77;
  const rnd = () => {
    seed = Math.imul(seed, 1664525) + 1013904223 >>> 0;
    return (seed >>> 8) / 16777215;
  };
  const canPlace = (x2, y, ignoreIdx = -1) => {
    if (x2 < left - 0.02 || x2 > right + 0.02 || y < topLimit - 0.02 || y > bottom + 0.02) return false;
    for (let i = 0; i < pts.length; i++) {
      if (i === ignoreIdx) continue;
      if (Math.hypot(pts[i].x - x2, pts[i].y - y) < minDist - 0.02) return false;
    }
    return true;
  };
  pts.push({ x: left, y: bottom });
  let x = left + minDist;
  let gapsLeft = 2;
  while (x < right - minDist * 0.55) {
    if (gapsLeft > 0 && rnd() < 0.25) {
      x += r * (0.55 + rnd() * 0.65);
      gapsLeft -= 1;
    }
    if (canPlace(x, bottom)) pts.push({ x, y: bottom });
    x += minDist + (rnd() - 0.5) * r * 0.15;
  }
  if (canPlace(right, bottom)) pts.push({ x: right, y: bottom });
  const target = 92;
  for (let attempt = 0; attempt < 1e4 && pts.length < target; attempt++) {
    const base = pts[Math.floor(rnd() * pts.length)];
    const ang = rnd() * Math.PI * 2;
    const dist = rnd() < 0.28 ? minDist + r * (0.45 + rnd() * 0.9) : minDist + (rnd() - 0.5) * 0.25;
    const nx = Math.min(right, Math.max(left, base.x + Math.cos(ang) * dist));
    const ny = Math.min(bottom, Math.max(topLimit, base.y + Math.sin(ang) * dist));
    if (canPlace(nx, ny)) pts.push({ x: nx, y: ny });
  }
  for (let k = 1; k <= 5; k++) {
    const wy = bottom - k * minDist * (0.85 + rnd() * 0.2);
    if (wy < topLimit + r) continue;
    if (canPlace(left, wy)) pts.push({ x: left, y: wy });
    if (canPlace(right, wy)) pts.push({ x: right, y: wy });
  }
  for (let iter = 0; iter < 40; iter++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const d = Math.hypot(dx, dy) || 1e-3;
        if (d < minDist) {
          const push = (minDist - d) / 2 + 0.01;
          const ux = dx / d;
          const uy = dy / d;
          pts[i].x -= ux * push;
          pts[i].y -= uy * push;
          pts[j].x += ux * push;
          pts[j].y += uy * push;
        }
      }
      pts[i].x = Math.min(right, Math.max(left, pts[i].x));
      pts[i].y = Math.min(bottom, Math.max(topLimit, pts[i].y));
    }
  }
  for (const p of pts) {
    if (p.y > bottom - 1) p.y = bottom;
  }
  const floor = pts.filter((p) => p.y >= bottom - 0.5).sort((a, b) => a.x - b.x);
  if (floor.length) {
    floor[0].x = left;
    floor[floor.length - 1].x = right;
  }
  for (let iter = 0; iter < 25; iter++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const d = Math.hypot(dx, dy) || 1e-3;
        if (d < minDist) {
          const push = (minDist - d) / 2 + 0.01;
          const ux = dx / d;
          const uy = dy / d;
          pts[i].x -= ux * push;
          pts[i].y -= uy * push;
          pts[j].x += ux * push;
          pts[j].y += uy * push;
        }
      }
      pts[i].x = Math.min(right, Math.max(left, pts[i].x));
      pts[i].y = Math.min(bottom, Math.max(topLimit, pts[i].y));
    }
  }
  for (const p of pts) {
    if (p.y > bottom - 1) p.y = bottom;
  }
  const floor2 = pts.filter((p) => p.y >= bottom - 0.5).sort((a, b) => a.x - b.x);
  if (floor2.length >= 2) {
    floor2[0].x = left;
    floor2[floor2.length - 1].x = right;
  }
  for (let iter = 0; iter < 12; iter++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j].x - pts[i].x;
        const dy = pts[j].y - pts[i].y;
        const d = Math.hypot(dx, dy) || 1e-3;
        if (d < minDist) {
          const push = (minDist - d) / 2 + 0.02;
          const ux = dx / d;
          const uy = dy / d;
          const iFloor = pts[i].y >= bottom - 0.5;
          const jFloor = pts[j].y >= bottom - 0.5;
          if (iFloor && !jFloor) {
            pts[j].x += ux * push * 2;
            pts[j].y += uy * push * 2;
          } else if (jFloor && !iFloor) {
            pts[i].x -= ux * push * 2;
            pts[i].y -= uy * push * 2;
          } else {
            pts[i].x -= ux * push;
            pts[i].y -= uy * push;
            pts[j].x += ux * push;
            pts[j].y += uy * push;
          }
        }
      }
      pts[i].x = Math.min(right, Math.max(left, pts[i].x));
      pts[i].y = Math.min(bottom, Math.max(topLimit, pts[i].y));
      if (pts[i].y > bottom - 1) pts[i].y = bottom;
    }
  }
  return pts;
}
function gasParticlePositions(box = PARTICLE_MODEL_BOX) {
  return [
    { x: 34, y: 28 },
    { x: 98, y: 22 },
    { x: 162, y: 38 },
    { x: 52, y: 72 },
    { x: 128, y: 68 },
    { x: 178, y: 95 },
    { x: 28, y: 118 },
    { x: 88, y: 112 },
    { x: 148, y: 138 },
    { x: 58, y: 168 },
    { x: 118, y: 178 },
    { x: 172, y: 162 }
  ].map((p) => ({
    x: p.x / 200 * box,
    y: p.y / 200 * box
  }));
}
function particlePositionsForState(state, box = PARTICLE_MODEL_BOX, r = PARTICLE_MODEL_R) {
  const key = String(state || "solid").toLowerCase();
  if (key === "liquid") return liquidParticlePositions(box, r);
  if (key === "gas") return gasParticlePositions(box);
  return solidParticlePositions(box, r);
}
function renderParticleModelSvg(stateOrPhase = {}) {
  const state = typeof stateOrPhase === "string" ? stateOrPhase : stateOrPhase.state || stateOrPhase.phase || "solid";
  const showLabel = typeof stateOrPhase === "object" ? !!stateOrPhase.showLabel : false;
  const box = PARTICLE_MODEL_BOX;
  const r = PARTICLE_MODEL_R;
  const stroke = PARTICLE_MODEL_STROKE;
  const label = particleModelStateLabel(state);
  const pts = particlePositionsForState(state, box, r);
  let particles = "";
  for (const p of pts) {
    particles += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="none" stroke="${stroke}" stroke-width="1.4"/>`;
  }
  const labelY = box + 22;
  const labelSvg = showLabel && label ? `<text x="${box / 2}" y="${labelY}" text-anchor="middle" font-size="15" font-weight="600" fill="${stroke}">${escapeHtml2(label)}</text>` : "";
  const h = showLabel && label ? box + 30 : box + 2;
  const aria = label ? `${label} particle model` : "Particle model";
  return `<svg class="chem-svg chem-particle-svg chem-particle-svg--${escapeHtml2(String(state).toLowerCase())}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${h}" width="100%" style="max-width:220px;display:block;margin:0 auto;" preserveAspectRatio="xMidYMid meet" aria-label="${escapeHtml2(aria)}">
    <rect x="1" y="1" width="${box - 2}" height="${box - 2}" fill="#fff" stroke="${stroke}" stroke-width="1.6"/>
    ${particles}
    ${labelSvg}
  </svg>`;
}
function cubeLatticePoint(i, j, k, { ox, oy, s }) {
  const left = s * 0.7;
  const up = s * 0.45;
  return {
    x: ox + i * s - j * left,
    y: oy - k * s - j * up,
    // Back furthest; within a face, higher ions slightly further so bottom sits in front
    depth: j * 1e3 + k * 20 - i
  };
}
function latticeIonAt(i, j, k, compound) {
  const isCation = (i + j + k) % 2 === 0;
  return isCation ? compound.cation : compound.anion;
}
function latticeIonRadius(site, space) {
  return space ? site.ion.rSpace : site.ion.rBall;
}
function shortenBondToSurfaces(a, b, ra, rb) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const ux = dx / len;
  const uy = dy / len;
  if (ra + rb >= len - 0.5) return null;
  return {
    x1: a.x + ux * ra,
    y1: a.y + uy * ra,
    x2: b.x - ux * rb,
    y2: b.y - uy * rb
  };
}
function clipSegmentByCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (a < 1e-12 || disc <= 0) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    return (mx - cx) ** 2 + (my - cy) ** 2 >= r * r ? [[0, 1]] : [];
  }
  const sqrt = Math.sqrt(disc);
  let t0 = (-b - sqrt) / (2 * a);
  let t1 = (-b + sqrt) / (2 * a);
  if (t0 > t1) [t0, t1] = [t1, t0];
  const parts = [];
  if (t0 > 0) parts.push([0, Math.min(1, t0)]);
  if (t1 < 1) parts.push([Math.max(0, t1), 1]);
  return parts.filter(([u, v]) => v - u > 0.02);
}
function subtractCircleFromSegments(segs, x1, y1, x2, y2, cx, cy, r) {
  const next = [];
  for (const [u, v] of segs) {
    const sx1 = x1 + (x2 - x1) * u;
    const sy1 = y1 + (y2 - y1) * u;
    const sx2 = x1 + (x2 - x1) * v;
    const sy2 = y1 + (y2 - y1) * v;
    const kept = clipSegmentByCircle(sx1, sy1, sx2, sy2, cx, cy, r);
    for (const [a, b] of kept) {
      next.push([u + (v - u) * a, u + (v - u) * b]);
    }
  }
  return next;
}
function renderIonicLatticeSvg(state = {}) {
  const compoundId = state.compound || "NaCl";
  const compound = IONIC_LATTICE_COMPOUNDS[compoundId] || IONIC_LATTICE_COMPOUNDS.NaCl;
  const style = state.style || "ball_stick";
  const size = Math.max(2, Math.min(4, Number(state.size) || 3));
  if (style === "compare") {
    const left = renderIonicLatticePanel(compound, "ball_stick", size);
    const right = renderIonicLatticePanel(compound, "space_filling", size);
    const gap = 36;
    const w = left.w + gap + right.w;
    const h = Math.max(left.h, right.h) + 28;
    return `<svg xmlns="http://www.w3.org/2000/svg" class="chem-svg chem-svg--fluid" viewBox="0 0 ${w} ${h}" width="100%" style="max-width:760px;height:auto;display:block;margin:0 auto;" preserveAspectRatio="xMidYMid meet">
      <g transform="translate(0,0)">${left.inner}</g>
      <g transform="translate(${left.w + gap},0)">${right.inner}</g>
      <text x="${left.w / 2}" y="${h - 8}" text-anchor="middle" fill="#475569" font-size="12">Ball-and-stick</text>
      <text x="${left.w + gap + right.w / 2}" y="${h - 8}" text-anchor="middle" fill="#475569" font-size="12">Space-filling</text>
    </svg>`;
  }
  const panel = renderIonicLatticePanel(compound, style, size);
  const maxW = style === "ball_stick" ? 520 : 440;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="chem-svg chem-svg--fluid" viewBox="0 0 ${panel.w} ${panel.h}" width="100%" style="max-width:${maxW}px;height:auto;display:block;margin:0 auto;" preserveAspectRatio="xMidYMid meet">${panel.inner}</svg>`;
}
function renderIonicLatticePanel(compound, style, size) {
  const space = style === "space_filling";
  const showKey = !space;
  const s = space ? compound.cation.rSpace + compound.anion.rSpace - 2 : 48;
  const maxR = space ? Math.max(compound.cation.rSpace, compound.anion.rSpace) : Math.max(compound.cation.rBall, compound.anion.rBall);
  const keyW = showKey ? 100 : 0;
  const pad = maxR + 20;
  const corners = [
    [0, 0, 0],
    [size - 1, 0, 0],
    [0, size - 1, 0],
    [size - 1, size - 1, 0],
    [0, 0, size - 1],
    [size - 1, 0, size - 1],
    [0, size - 1, size - 1],
    [size - 1, size - 1, size - 1]
  ].map(([i, j, k]) => cubeLatticePoint(i, j, k, { ox: 0, oy: 0, s }));
  const minX = Math.min(...corners.map((p) => p.x));
  const maxX = Math.max(...corners.map((p) => p.x));
  const minY = Math.min(...corners.map((p) => p.y));
  const maxY = Math.max(...corners.map((p) => p.y));
  const ox = pad - minX;
  const oy = pad - minY;
  const latticeW = Math.ceil(maxX - minX + pad * 2);
  const w = latticeW + keyW;
  const h = Math.ceil(maxY - minY + pad * 2);
  const sites = [];
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      for (let k = 0; k < size; k++) {
        const p = cubeLatticePoint(i, j, k, { ox, oy, s });
        sites.push({
          i,
          j,
          k,
          ...p,
          ion: latticeIonAt(i, j, k, compound),
          r: 0
        });
      }
    }
  }
  for (const site of sites) site.r = latticeIonRadius(site, space);
  const drawables = [];
  if (!space) {
    const byKey = new Map(sites.map((site) => [`${site.i},${site.j},${site.k}`, site]));
    const seen = /* @__PURE__ */ new Set();
    for (const site of sites) {
      for (const [di, dj, dk] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
        const ni = site.i + di;
        const nj = site.j + dj;
        const nk = site.k + dk;
        if (ni >= size || nj >= size || nk >= size) continue;
        if (di === 1 && dj === 0 && dk === 0 && site.k > 0 && site.k < size - 1) continue;
        const t = byKey.get(`${ni},${nj},${nk}`);
        if (!t) continue;
        const bkey = `${site.i},${site.j},${site.k}-${ni},${nj},${nk}`;
        if (seen.has(bkey)) continue;
        seen.add(bkey);
        const shortened = shortenBondToSurfaces(site, t, site.r, t.r);
        if (!shortened) continue;
        let segs = [[0, 1]];
        const bondDepth = (site.depth + t.depth) / 2;
        for (const other of sites) {
          if (other === site || other === t) continue;
          if (other.depth >= bondDepth) continue;
          segs = subtractCircleFromSegments(
            segs,
            shortened.x1,
            shortened.y1,
            shortened.x2,
            shortened.y2,
            other.x,
            other.y,
            other.r + 0.8
          );
          if (!segs.length) break;
        }
        for (const [u, v] of segs) {
          if (v - u < 0.03) continue;
          drawables.push({
            type: "bond",
            depth: bondDepth,
            x1: shortened.x1 + (shortened.x2 - shortened.x1) * u,
            y1: shortened.y1 + (shortened.y2 - shortened.y1) * u,
            x2: shortened.x1 + (shortened.x2 - shortened.x1) * v,
            y2: shortened.y1 + (shortened.y2 - shortened.y1) * v
          });
        }
      }
    }
  }
  for (const site of sites) {
    drawables.push({
      type: "sphere",
      depth: site.depth,
      x: site.x,
      y: site.y,
      r: site.r,
      fill: space ? site.ion.fillAlt : site.ion.fill,
      charge: site.ion.charge,
      isAnion: site.ion === compound.anion
    });
  }
  drawables.sort((a, b) => {
    if (b.depth !== a.depth) return b.depth - a.depth;
    if (a.type === b.type) return 0;
    return a.type === "bond" ? -1 : 1;
  });
  let inner = "";
  for (const d of drawables) {
    if (d.type === "bond") {
      inner += `<line x1="${d.x1}" y1="${d.y1}" x2="${d.x2}" y2="${d.y2}" stroke="#475569" stroke-width="2" stroke-linecap="round"/>`;
      continue;
    }
    inner += `<circle cx="${d.x}" cy="${d.y}" r="${d.r}" fill="${d.fill}" stroke="#0f172a" stroke-width="1.2"/>`;
    if (space) {
      const labelFill = d.isAnion ? "#f8fafc" : "#0f172a";
      inner += `<text x="${d.x}" y="${d.y + 5}" text-anchor="middle" fill="${labelFill}" font-size="13" font-weight="800">${d.charge}</text>`;
    }
  }
  if (showKey) {
    const kx = latticeW + 12;
    const ky = Math.max(36, h / 2 - 36);
    inner += `<text x="${kx}" y="${ky - 18}" fill="#0f172a" font-size="13" font-weight="700">Key</text>`;
    inner += `<circle cx="${kx + 10}" cy="${ky}" r="${compound.cation.rBall}" fill="${compound.cation.fill}" stroke="#0f172a" stroke-width="1"/>`;
    inner += `<text x="${kx + 28}" y="${ky + 4}" fill="#0f172a" font-size="13" font-weight="600">${escapeHtml2(compound.cation.symbol)}\u207A</text>`;
    inner += `<circle cx="${kx + 10}" cy="${ky + 40}" r="${compound.anion.rBall}" fill="${compound.anion.fill}" stroke="#0f172a" stroke-width="1"/>`;
    inner += `<text x="${kx + 28}" y="${ky + 44}" fill="#0f172a" font-size="13" font-weight="600">${escapeHtml2(compound.anion.symbol)}\u207B</text>`;
  }
  return { w, h, inner };
}
function renderStemDiagramSvg(presetIdOrConfig) {
  const preset = typeof presetIdOrConfig === "string" ? CHEMISTRY_PRESETS[presetIdOrConfig] : presetIdOrConfig;
  if (!preset) return "";
  const cfg = preset.answer ? { kind: preset.kind, template: preset.template || {}, answer: preset.answer } : preset;
  const state = displayStateFromPresetOrConfig(cfg);
  if (!state) return "";
  if (state.kind === "electron_shell") {
    const shellCount = Math.max(occupiedShellCount(state.shells), state.shells?.length || 1, 1);
    const charge = Number(state.charge) || 0;
    const brackets = !!state.showIonBrackets && charge !== 0;
    const { width, height, baseR, gap, cx, cy, maxShells } = shellAnswerViewport(shellCount, { brackets });
    return `<svg xmlns="http://www.w3.org/2000/svg" class="chem-svg" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${brackets ? 360 : 300}px;height:auto;display:block;margin:0 auto;">
      ${renderAtomSvg({
      cx,
      cy,
      symbol: state.symbol,
      shells: state.shells,
      protons: state.nucleus?.p,
      neutrons: state.nucleus?.n,
      charge: brackets ? charge : null,
      brackets,
      interactive: false,
      atomId: "stem",
      maxShells,
      baseR,
      gap
    })}
    </svg>`;
  }
  if (state.kind === "ionic_bonding") {
    const ions = ionicStateAtoms(state);
    const { w, h, positions, baseR, gap } = layoutIonicAtoms(ions);
    const ionSvgs = ions.map((ion, i) => renderIonicDotCrossAtomSvg({
      cx: positions[i].x,
      cy: positions[i].y,
      symbol: ion.symbol,
      shells: ion.shells,
      style: ion.style || (i % 2 === 0 ? "dot" : "cross"),
      brackets: ion.brackets !== false,
      charge: ion.charge,
      interactive: false,
      atomIdx: i,
      baseR,
      gap
    })).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" class="chem-svg chem-svg--fluid" viewBox="0 0 ${w} ${h}" width="100%" style="display:block;margin:0 auto;" preserveAspectRatio="xMidYMid meet">${ionSvgs}</svg>`;
  }
  if (state.kind === "ionic_lattice") {
    return renderIonicLatticeSvg(state);
  }
  if (state.kind === "covalent_bonding") {
    const wrap = renderCovalentDiagram(state, { interactive: false });
    const match = wrap.match(/<svg[\s\S]*<\/svg>/);
    if (match) {
      return match[0].replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return "";
  }
  if (state.kind === "organic_structure") {
    return renderDisplayedFormulaSvg(state, { interactive: false });
  }
  if (state.kind === "polymer_structure") {
    return renderPolymerDisplaySvg(state, cfg);
  }
  if (state.kind === "molecule_builder") {
    return renderMoleculeBuilderSvg(state, { interactive: false });
  }
  if (state.kind === "metallic_bonding") {
    return renderMetallicBondingSvg(state);
  }
  if (state.kind === "particle_model") {
    return renderParticleModelSvg(state);
  }
  if (state.kind === "carbon_allotrope") {
    return renderCarbonAllotropeSvg(state.allotrope);
  }
  return "";
}
function svgMarkupToPngBlob(svgMarkup, { width = 720, height = 560, scale = 2 } = {}) {
  return new Promise((resolve, reject) => {
    let svg = String(svgMarkup || "").trim();
    if (!svg) {
      reject(new Error("Empty SVG"));
      return;
    }
    if (!svg.includes("xmlns=")) {
      svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!/width=/.test(svg)) {
      svg = svg.replace("<svg", `<svg width="${width}" height="${height}"`);
    }
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = Math.max(img.naturalWidth || width, 200) * scale;
        const h = Math.max(img.naturalHeight || height, 200) * scale;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((png) => {
          URL.revokeObjectURL(url);
          if (!png) reject(new Error("PNG encode failed"));
          else resolve(png);
        }, "image/png");
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG image load failed"));
    };
    img.src = url;
  });
}
function stemPreviewHtml(presetIdOrConfig) {
  const svg = renderStemDiagramSvg(presetIdOrConfig);
  if (!svg) return `<p class="muted">No diagram for this selection.</p>`;
  const state = displayStateFromPresetOrConfig(
    typeof presetIdOrConfig === "string" ? CHEMISTRY_PRESETS[presetIdOrConfig] : presetIdOrConfig
  );
  let caption = "";
  if (state?.kind === "electron_shell") {
    const charge = Number(state.charge) || 0;
    const shells = (state.shells || []).join(", ");
    if (state.showIonBrackets && charge !== 0) {
      const label = charge > 0 ? charge === 1 ? "+" : `+${charge}` : charge === -1 ? "\u2212" : `\u2212${Math.abs(charge)}`;
      caption = `<p class="muted" style="margin:6px 0 0;font-size:0.75rem;text-align:center;">Ion ${escapeHtml2(state.symbol)}<sup>${label}</sup> \xB7 shells [${escapeHtml2(shells)}] \xB7 square brackets included</p>`;
    } else {
      caption = `<p class="muted" style="margin:6px 0 0;font-size:0.75rem;text-align:center;">${escapeHtml2(state.symbol)} \xB7 shells [${escapeHtml2(shells)}]</p>`;
    }
  } else if (state?.kind === "ionic_lattice") {
    const styleLabel = state.style === "space_filling" ? "space-filling" : state.style === "compare" ? "ball-and-stick + space-filling" : "ball-and-stick";
    caption = `<p class="muted" style="margin:6px 0 0;font-size:0.75rem;text-align:center;">${escapeHtml2(state.compound || "NaCl")} giant ionic lattice \xB7 ${styleLabel}</p>`;
  } else if (state?.kind === "metallic_bonding") {
    caption = `<p class="muted" style="margin:6px 0 0;font-size:0.75rem;text-align:center;">Metallic bonding \xB7 delocalised electrons</p>`;
  } else if (state?.kind === "particle_model") {
    const stateLabel = particleModelStateLabel(state.state);
    caption = `<p class="muted" style="margin:6px 0 0;font-size:0.75rem;text-align:center;">Particle model \xB7 ${escapeHtml2(stateLabel || "state of matter")}</p>`;
  }
  return `<div class="chem-stem-preview">${svg}${caption}</div>`;
}
var ELEMENT_DATA, SHELL_CAPS, CHEM_STEM_KINDS, STATE_SYMBOLS, STATE_SUFFIX_RE, SUPER_DIGIT_MAP, SUPER_DIGITS, COVALENT_SHELL_OVERLAP, COVALENT_MAX_SHARED_CAP, COVALENT_LONE_SLOTS, COVALENT_LONE_SLOT_ANGLES, COVALENT_ELECTRON_HIT_R, COVALENT_LONE_ELECTRONS_PER_SLOT, liveState, liveConfig, CHEMISTRY_PRESETS, POLYMER_REPEAT_STRUCTURES, MOLECULE_BUILDER_SYMBOLS, METALLIC_LATTICE_SITES, METALLIC_ELECTRON_ANGLES, PARTICLE_MODEL_BOX, PARTICLE_MODEL_R, PARTICLE_MODEL_STROKE, IONIC_LATTICE_COMPOUNDS;
var init_chemistryWorkflow = __esm({
  "src/chemistryWorkflow.js"() {
    init_mathEngine();
    init_carbonAllotropeDiagrams();
    ELEMENT_DATA = {
      H: { Z: 1, A: 1, shells: [1] },
      He: { Z: 2, A: 4, shells: [2] },
      Li: { Z: 3, A: 7, shells: [2, 1] },
      Be: { Z: 4, A: 9, shells: [2, 2] },
      B: { Z: 5, A: 11, shells: [2, 3] },
      C: { Z: 6, A: 12, shells: [2, 4] },
      N: { Z: 7, A: 14, shells: [2, 5] },
      O: { Z: 8, A: 16, shells: [2, 6] },
      F: { Z: 9, A: 19, shells: [2, 7] },
      Ne: { Z: 10, A: 20, shells: [2, 8] },
      Na: { Z: 11, A: 23, shells: [2, 8, 1] },
      Mg: { Z: 12, A: 24, shells: [2, 8, 2] },
      Al: { Z: 13, A: 27, shells: [2, 8, 3] },
      Si: { Z: 14, A: 28, shells: [2, 8, 4] },
      P: { Z: 15, A: 31, shells: [2, 8, 5] },
      S: { Z: 16, A: 32, shells: [2, 8, 6] },
      Cl: { Z: 17, A: 35.5, shells: [2, 8, 7] },
      Ar: { Z: 18, A: 40, shells: [2, 8, 8] },
      K: { Z: 19, A: 39, shells: [2, 8, 8, 1] },
      Ca: { Z: 20, A: 40, shells: [2, 8, 8, 2] },
      Br: { Z: 35, A: 80, shells: [2, 8, 18, 7] }
    };
    SHELL_CAPS = [2, 8, 8, 18];
    CHEM_STEM_KINDS = /* @__PURE__ */ new Set([
      "electron_shell",
      "ionic_bonding",
      "covalent_bonding",
      "ionic_lattice",
      "metallic_bonding",
      "particle_model",
      "carbon_allotrope",
      "organic_structure",
      "polymer_structure",
      "molecule_builder"
    ]);
    STATE_SYMBOLS = ["s", "l", "g", "aq"];
    STATE_SUFFIX_RE = /^(.*)\((s|l|g|aq)\)$/i;
    SUPER_DIGIT_MAP = {
      "\u2070": "0",
      "\xB9": "1",
      "\xB2": "2",
      "\xB3": "3",
      "\u2074": "4",
      "\u2075": "5",
      "\u2076": "6",
      "\u2077": "7",
      "\u2078": "8",
      "\u2079": "9",
      "\u207A": "+",
      "\u207B": "-",
      "\u2212": "-",
      "\u2013": "-",
      "\u2014": "-"
    };
    SUPER_DIGITS = "\u2070\xB9\xB2\xB3\u2074\u2075\u2076\u2077\u2078\u2079";
    COVALENT_SHELL_OVERLAP = 16;
    COVALENT_MAX_SHARED_CAP = 4;
    COVALENT_LONE_SLOTS = ["top", "bottom", "left", "right"];
    COVALENT_LONE_SLOT_ANGLES = {
      top: -Math.PI / 2,
      bottom: Math.PI / 2,
      left: Math.PI,
      right: 0
    };
    COVALENT_ELECTRON_HIT_R = 12;
    COVALENT_LONE_ELECTRONS_PER_SLOT = 2;
    liveState = null;
    liveConfig = null;
    CHEMISTRY_PRESETS = {
      carbon12: {
        label: "Carbon-12 electron shells",
        kind: "electron_shell",
        template: { symbol: "C", shellCount: 2, protons: 6, neutrons: 6 },
        answer: { kind: "electron_shell", shells: [2, 4], nucleus: { p: 6, n: 6 }, symbol: "C" }
      },
      sodium: {
        label: "Sodium atom shells",
        kind: "electron_shell",
        template: { symbol: "Na", shellCount: 3, protons: 11, neutrons: 12 },
        answer: { kind: "electron_shell", shells: [2, 8, 1], nucleus: { p: 11, n: 12 }, symbol: "Na" }
      },
      nacl: {
        label: "NaCl ionic bonding",
        kind: "ionic_bonding",
        recommendedMaxMarks: 3,
        template: { atoms: [{ symbol: "Na", style: "dot" }, { symbol: "Cl", style: "cross" }] },
        answer: {
          kind: "ionic_bonding",
          atoms: [
            { symbol: "Na", shells: [2, 8], charge: 1, brackets: true, style: "dot" },
            { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true, style: "cross" }
          ],
          transferred: 1
        }
      },
      licl: {
        label: "LiCl ionic bonding",
        kind: "ionic_bonding",
        recommendedMaxMarks: 3,
        template: { atoms: [{ symbol: "Li", style: "dot" }, { symbol: "Cl", style: "cross" }] },
        answer: {
          kind: "ionic_bonding",
          atoms: [
            { symbol: "Li", shells: [2], charge: 1, brackets: true, style: "dot" },
            { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true, style: "cross" }
          ],
          transferred: 1
        }
      },
      kbr: {
        label: "KBr ionic bonding",
        kind: "ionic_bonding",
        recommendedMaxMarks: 3,
        template: { atoms: [{ symbol: "K", style: "dot" }, { symbol: "Br", style: "cross" }] },
        answer: {
          kind: "ionic_bonding",
          atoms: [
            { symbol: "K", shells: [2, 8, 8], charge: 1, brackets: true, style: "dot" },
            { symbol: "Br", shells: [2, 8, 18, 8], charge: -1, brackets: true, style: "cross" }
          ],
          transferred: 1
        }
      },
      mgo: {
        label: "MgO ionic bonding",
        kind: "ionic_bonding",
        recommendedMaxMarks: 3,
        template: { atoms: [{ symbol: "Mg", style: "dot" }, { symbol: "O", style: "cross" }] },
        answer: {
          kind: "ionic_bonding",
          atoms: [
            { symbol: "Mg", shells: [2, 8], charge: 2, brackets: true, style: "dot" },
            { symbol: "O", shells: [2, 8], charge: -2, brackets: true, style: "cross" }
          ],
          transferred: 2
        }
      },
      cao: {
        label: "CaO ionic bonding",
        kind: "ionic_bonding",
        recommendedMaxMarks: 3,
        template: { atoms: [{ symbol: "Ca", style: "dot" }, { symbol: "O", style: "cross" }] },
        answer: {
          kind: "ionic_bonding",
          atoms: [
            { symbol: "Ca", shells: [2, 8, 8], charge: 2, brackets: true, style: "dot" },
            { symbol: "O", shells: [2, 8], charge: -2, brackets: true, style: "cross" }
          ],
          transferred: 2
        }
      },
      na2o: {
        label: "Na\u2082O ionic bonding (2:1)",
        kind: "ionic_bonding",
        recommendedMaxMarks: 4,
        template: {
          atoms: [
            { symbol: "Na", style: "dot" },
            { symbol: "Na", style: "dot" },
            { symbol: "O", style: "cross" }
          ]
        },
        answer: {
          kind: "ionic_bonding",
          ratioMark: true,
          atoms: [
            { symbol: "Na", shells: [2, 8], charge: 1, brackets: true, style: "dot" },
            { symbol: "Na", shells: [2, 8], charge: 1, brackets: true, style: "dot" },
            { symbol: "O", shells: [2, 8], charge: -2, brackets: true, style: "cross" }
          ],
          transferred: 2
        }
      },
      k2s: {
        label: "K\u2082S ionic bonding (2:1)",
        kind: "ionic_bonding",
        recommendedMaxMarks: 4,
        template: {
          atoms: [
            { symbol: "K", style: "dot" },
            { symbol: "K", style: "dot" },
            { symbol: "S", style: "cross" }
          ]
        },
        answer: {
          kind: "ionic_bonding",
          ratioMark: true,
          atoms: [
            { symbol: "K", shells: [2, 8, 8], charge: 1, brackets: true, style: "dot" },
            { symbol: "K", shells: [2, 8, 8], charge: 1, brackets: true, style: "dot" },
            { symbol: "S", shells: [2, 8, 8], charge: -2, brackets: true, style: "cross" }
          ],
          transferred: 2
        }
      },
      li2o: {
        label: "Li\u2082O ionic bonding (2:1)",
        kind: "ionic_bonding",
        recommendedMaxMarks: 4,
        template: {
          atoms: [
            { symbol: "Li", style: "dot" },
            { symbol: "Li", style: "dot" },
            { symbol: "O", style: "cross" }
          ]
        },
        answer: {
          kind: "ionic_bonding",
          ratioMark: true,
          atoms: [
            { symbol: "Li", shells: [2], charge: 1, brackets: true, style: "dot" },
            { symbol: "Li", shells: [2], charge: 1, brackets: true, style: "dot" },
            { symbol: "O", shells: [2, 8], charge: -2, brackets: true, style: "cross" }
          ],
          transferred: 2
        }
      },
      mgcl2: {
        label: "MgCl\u2082 ionic bonding (1:2)",
        kind: "ionic_bonding",
        recommendedMaxMarks: 4,
        template: {
          atoms: [
            { symbol: "Mg", style: "dot" },
            { symbol: "Cl", style: "cross" },
            { symbol: "Cl", style: "cross" }
          ]
        },
        answer: {
          kind: "ionic_bonding",
          ratioMark: true,
          atoms: [
            { symbol: "Mg", shells: [2, 8], charge: 2, brackets: true, style: "dot" },
            { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true, style: "cross" },
            { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true, style: "cross" }
          ],
          transferred: 2
        }
      },
      cacl2: {
        label: "CaCl\u2082 ionic bonding (1:2)",
        kind: "ionic_bonding",
        recommendedMaxMarks: 4,
        template: {
          atoms: [
            { symbol: "Ca", style: "dot" },
            { symbol: "Cl", style: "cross" },
            { symbol: "Cl", style: "cross" }
          ]
        },
        answer: {
          kind: "ionic_bonding",
          ratioMark: true,
          atoms: [
            { symbol: "Ca", shells: [2, 8, 8], charge: 2, brackets: true, style: "dot" },
            { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true, style: "cross" },
            { symbol: "Cl", shells: [2, 8, 8], charge: -1, brackets: true, style: "cross" }
          ],
          transferred: 2
        }
      },
      nacl_lattice_ball: {
        label: "NaCl giant ionic lattice (ball-and-stick)",
        kind: "ionic_lattice",
        track: "combined",
        template: { compound: "NaCl", style: "ball_stick", size: 3 },
        answer: { kind: "ionic_lattice", compound: "NaCl", style: "ball_stick", size: 3 }
      },
      nacl_lattice_space: {
        label: "NaCl giant ionic lattice (space-filling)",
        kind: "ionic_lattice",
        track: "combined",
        template: { compound: "NaCl", style: "space_filling", size: 3 },
        answer: { kind: "ionic_lattice", compound: "NaCl", style: "space_filling", size: 3 }
      },
      nacl_lattice_compare: {
        label: "NaCl giant ionic lattice (both models)",
        kind: "ionic_lattice",
        track: "combined",
        template: { compound: "NaCl", style: "compare", size: 3 },
        answer: { kind: "ionic_lattice", compound: "NaCl", style: "compare", size: 3 }
      },
      metallic_bonding: {
        label: "Metallic bonding \u2014 delocalised electrons",
        kind: "metallic_bonding",
        track: "combined",
        template: {},
        answer: { kind: "metallic_bonding" }
      },
      particle_solid: {
        label: "Particle model \u2014 solid",
        kind: "particle_model",
        track: "combined",
        template: { state: "solid" },
        answer: { kind: "particle_model", state: "solid" }
      },
      particle_liquid: {
        label: "Particle model \u2014 liquid",
        kind: "particle_model",
        track: "combined",
        template: { state: "liquid" },
        answer: { kind: "particle_model", state: "liquid" }
      },
      particle_gas: {
        label: "Particle model \u2014 gas",
        kind: "particle_model",
        track: "combined",
        template: { state: "gas" },
        answer: { kind: "particle_model", state: "gas" }
      },
      carbon_graphite: {
        label: "Graphite (carbon allotrope)",
        kind: "carbon_allotrope",
        track: "combined",
        template: { allotrope: "graphite" },
        answer: { kind: "carbon_allotrope", allotrope: "graphite" }
      },
      carbon_diamond: {
        label: "Diamond (carbon allotrope)",
        kind: "carbon_allotrope",
        track: "combined",
        template: { allotrope: "diamond" },
        answer: { kind: "carbon_allotrope", allotrope: "diamond" }
      },
      carbon_buckminsterfullerene: {
        label: "Buckminsterfullerene (C\u2086\u2080)",
        kind: "carbon_allotrope",
        track: "combined",
        template: { allotrope: "buckminsterfullerene" },
        answer: { kind: "carbon_allotrope", allotrope: "buckminsterfullerene" }
      },
      carbon_nanotube: {
        label: "Carbon nanotube",
        kind: "carbon_allotrope",
        track: "combined",
        template: { allotrope: "carbon_nanotube" },
        answer: { kind: "carbon_allotrope", allotrope: "carbon_nanotube" }
      },
      h2: {
        label: "H\u2082 covalent",
        kind: "covalent_bonding",
        recommendedMaxMarks: 2,
        template: {
          atoms: [{ symbol: "H", maxLone: 0 }, { symbol: "H", maxLone: 0 }],
          bonds: [{ a: 0, b: 1, maxPairs: 1 }]
        },
        answer: {
          kind: "covalent_bonding",
          atoms: [{ symbol: "H", lonePairs: 0 }, { symbol: "H", lonePairs: 0 }],
          bonds: [{ a: 0, b: 1, sharedPairs: 1, maxPairs: 1 }]
        }
      },
      cl2: {
        label: "Cl\u2082 covalent",
        kind: "covalent_bonding",
        recommendedMaxMarks: 2,
        template: {
          atoms: [{ symbol: "Cl", maxLone: 3 }, { symbol: "Cl", maxLone: 3 }],
          bonds: [{ a: 0, b: 1, maxPairs: 1 }]
        },
        answer: {
          kind: "covalent_bonding",
          atoms: [{ symbol: "Cl", lonePairs: 3 }, { symbol: "Cl", lonePairs: 3 }],
          bonds: [{ a: 0, b: 1, sharedPairs: 1, maxPairs: 1 }]
        }
      },
      o2: {
        label: "O\u2082 covalent (double)",
        kind: "covalent_bonding",
        recommendedMaxMarks: 2,
        template: {
          atoms: [{ symbol: "O", maxLone: 2 }, { symbol: "O", maxLone: 2 }],
          bonds: [{ a: 0, b: 1, maxPairs: 2 }]
        },
        answer: {
          kind: "covalent_bonding",
          atoms: [{ symbol: "O", lonePairs: 2 }, { symbol: "O", lonePairs: 2 }],
          bonds: [{ a: 0, b: 1, sharedPairs: 2, maxPairs: 2 }]
        }
      },
      n2: {
        label: "N\u2082 covalent (triple)",
        kind: "covalent_bonding",
        recommendedMaxMarks: 2,
        template: {
          atoms: [{ symbol: "N", maxLone: 1 }, { symbol: "N", maxLone: 1 }],
          bonds: [{ a: 0, b: 1, maxPairs: 3 }]
        },
        answer: {
          kind: "covalent_bonding",
          atoms: [{ symbol: "N", lonePairs: 1 }, { symbol: "N", lonePairs: 1 }],
          bonds: [{ a: 0, b: 1, sharedPairs: 3, maxPairs: 3 }]
        }
      },
      hcl: {
        label: "HCl covalent",
        kind: "covalent_bonding",
        recommendedMaxMarks: 2,
        template: {
          atoms: [{ symbol: "H", maxLone: 0 }, { symbol: "Cl", maxLone: 3 }],
          bonds: [{ a: 0, b: 1, maxPairs: 1 }]
        },
        answer: {
          kind: "covalent_bonding",
          atoms: [{ symbol: "H", lonePairs: 0 }, { symbol: "Cl", lonePairs: 3 }],
          bonds: [{ a: 0, b: 1, sharedPairs: 1, maxPairs: 1 }]
        }
      },
      h2o: {
        label: "H\u2082O covalent (water)",
        kind: "covalent_bonding",
        recommendedMaxMarks: 2,
        template: {
          atoms: [
            { symbol: "O", maxLone: 2 },
            { symbol: "H", maxLone: 0 },
            { symbol: "H", maxLone: 0 }
          ],
          bonds: [
            { a: 0, b: 1, maxPairs: 1 },
            { a: 0, b: 2, maxPairs: 1 }
          ]
        },
        answer: {
          kind: "covalent_bonding",
          atoms: [
            { symbol: "O", lonePairs: 2 },
            { symbol: "H", lonePairs: 0 },
            { symbol: "H", lonePairs: 0 }
          ],
          bonds: [
            { a: 0, b: 1, sharedPairs: 1, maxPairs: 1 },
            { a: 0, b: 2, sharedPairs: 1, maxPairs: 1 }
          ]
        }
      },
      nh3: {
        label: "NH\u2083 covalent (ammonia)",
        kind: "covalent_bonding",
        recommendedMaxMarks: 2,
        template: {
          atoms: [
            { symbol: "N", maxLone: 1 },
            { symbol: "H", maxLone: 0 },
            { symbol: "H", maxLone: 0 },
            { symbol: "H", maxLone: 0 }
          ],
          bonds: [
            { a: 0, b: 1, maxPairs: 1 },
            { a: 0, b: 2, maxPairs: 1 },
            { a: 0, b: 3, maxPairs: 1 }
          ]
        },
        answer: {
          kind: "covalent_bonding",
          atoms: [
            { symbol: "N", lonePairs: 1 },
            { symbol: "H", lonePairs: 0 },
            { symbol: "H", lonePairs: 0 },
            { symbol: "H", lonePairs: 0 }
          ],
          bonds: [
            { a: 0, b: 1, sharedPairs: 1, maxPairs: 1 },
            { a: 0, b: 2, sharedPairs: 1, maxPairs: 1 },
            { a: 0, b: 3, sharedPairs: 1, maxPairs: 1 }
          ]
        }
      },
      ch4_covalent: {
        label: "CH\u2084 covalent (methane)",
        kind: "covalent_bonding",
        recommendedMaxMarks: 2,
        template: {
          atoms: [
            { symbol: "C", maxLone: 0 },
            { symbol: "H", maxLone: 0 },
            { symbol: "H", maxLone: 0 },
            { symbol: "H", maxLone: 0 },
            { symbol: "H", maxLone: 0 }
          ],
          bonds: [
            { a: 0, b: 1, maxPairs: 1 },
            { a: 0, b: 2, maxPairs: 1 },
            { a: 0, b: 3, maxPairs: 1 },
            { a: 0, b: 4, maxPairs: 1 }
          ]
        },
        answer: {
          kind: "covalent_bonding",
          atoms: [
            { symbol: "C", lonePairs: 0 },
            { symbol: "H", lonePairs: 0 },
            { symbol: "H", lonePairs: 0 },
            { symbol: "H", lonePairs: 0 },
            { symbol: "H", lonePairs: 0 }
          ],
          bonds: [
            { a: 0, b: 1, sharedPairs: 1, maxPairs: 1 },
            { a: 0, b: 2, sharedPairs: 1, maxPairs: 1 },
            { a: 0, b: 3, sharedPairs: 1, maxPairs: 1 },
            { a: 0, b: 4, sharedPairs: 1, maxPairs: 1 }
          ]
        }
      },
      ethene: {
        label: "Ethene (alkene)",
        kind: "organic_structure",
        track: "combined",
        template: { family: "alkene", carbons: 2, name: "ethene" },
        answer: {
          kind: "organic_structure",
          family: "alkene",
          carbons: 2,
          name: "ethene",
          carbonBonds: [{ from: 0, to: 1, order: 2 }],
          groups: [[], []]
        }
      },
      ethane: {
        label: "Ethane (alkane)",
        kind: "organic_structure",
        track: "combined",
        template: { family: "alkane", carbons: 2, name: "ethane" },
        answer: {
          kind: "organic_structure",
          family: "alkane",
          carbons: 2,
          name: "ethane",
          carbonBonds: [{ from: 0, to: 1, order: 1 }],
          groups: [[], []]
        }
      },
      methane: {
        label: "Methane (alkane)",
        kind: "organic_structure",
        track: "combined",
        template: { family: "alkane", carbons: 1, name: "methane" },
        answer: {
          kind: "organic_structure",
          family: "alkane",
          carbons: 1,
          name: "methane",
          carbonBonds: [],
          groups: [[]]
        }
      },
      propane: {
        label: "Propane (alkane)",
        kind: "organic_structure",
        track: "combined",
        template: { family: "alkane", carbons: 3, name: "propane" },
        answer: {
          kind: "organic_structure",
          family: "alkane",
          carbons: 3,
          name: "propane",
          carbonBonds: [
            { from: 0, to: 1, order: 1 },
            { from: 1, to: 2, order: 1 }
          ],
          groups: [[], [], []]
        }
      },
      propene: {
        label: "Propene (alkene)",
        kind: "organic_structure",
        track: "combined",
        template: { family: "alkene", carbons: 3, name: "propene" },
        answer: {
          kind: "organic_structure",
          family: "alkene",
          carbons: 3,
          name: "propene",
          carbonBonds: [
            { from: 0, to: 1, order: 2 },
            { from: 1, to: 2, order: 1 }
          ],
          groups: [[], [], []]
        }
      },
      methanol: {
        label: "Methanol (alcohol) \u2014 Triple",
        kind: "organic_structure",
        track: "triple",
        template: { family: "alcohol", carbons: 1, name: "methanol" },
        answer: {
          kind: "organic_structure",
          family: "alcohol",
          carbons: 1,
          name: "methanol",
          carbonBonds: [],
          groups: [["OH"]]
        }
      },
      ethanol: {
        label: "Ethanol (alcohol) \u2014 Triple",
        kind: "organic_structure",
        track: "triple",
        template: { family: "alcohol", carbons: 2, name: "ethanol" },
        answer: {
          kind: "organic_structure",
          family: "alcohol",
          carbons: 2,
          name: "ethanol",
          carbonBonds: [{ from: 0, to: 1, order: 1 }],
          groups: [[], ["OH"]]
        }
      },
      propanol: {
        label: "Propanol (alcohol) \u2014 Triple",
        kind: "organic_structure",
        track: "triple",
        template: { family: "alcohol", carbons: 3, name: "propanol" },
        answer: {
          kind: "organic_structure",
          family: "alcohol",
          carbons: 3,
          name: "propanol",
          carbonBonds: [
            { from: 0, to: 1, order: 1 },
            { from: 1, to: 2, order: 1 }
          ],
          groups: [[], [], ["OH"]]
        }
      },
      ethanoic: {
        label: "Ethanoic acid \u2014 Triple",
        kind: "organic_structure",
        track: "triple",
        template: { family: "carboxylic_acid", carbons: 2, name: "ethanoic acid" },
        answer: {
          kind: "organic_structure",
          family: "carboxylic_acid",
          carbons: 2,
          name: "ethanoic acid",
          carbonBonds: [{ from: 0, to: 1, order: 1 }],
          groups: [[], ["COOH"]]
        }
      },
      ethyl_ethanoate: {
        label: "Ethyl ethanoate (ester) \u2014 Triple",
        kind: "organic_structure",
        track: "triple",
        template: { family: "ester", carbons: 3, name: "ethyl ethanoate" },
        answer: {
          kind: "organic_structure",
          family: "ester",
          carbons: 3,
          name: "ethyl ethanoate",
          carbonBonds: [
            { from: 0, to: 1, order: 1 },
            { from: 1, to: 2, order: 1 }
          ],
          groups: [[], ["COO"], []]
        }
      },
      polyethene: {
        label: "Poly(ethene) addition polymer",
        kind: "polymer_structure",
        track: "combined",
        template: {
          mode: "addition",
          monomerLabel: "ethene",
          name: "poly(ethene)",
          repeatOptions: [
            { id: "ch2ch2", label: "\u2013CH\u2082\u2013CH\u2082\u2013" },
            { id: "chch2", label: "\u2013CH=CH\u2082" },
            { id: "ch3ch3", label: "\u2013CH\u2083\u2013CH\u2083\u2013" }
          ]
        },
        answer: { kind: "polymer_structure", selectedRepeat: "ch2ch2", selectedLinkage: null, name: "poly(ethene)" }
      },
      polychloroethene: {
        label: "Poly(chloroethene) / PVC",
        kind: "polymer_structure",
        track: "combined",
        template: {
          mode: "addition",
          monomerLabel: "chloroethene",
          name: "poly(chloroethene)",
          repeatOptions: [
            { id: "ch2chcl", label: "\u2013CH\u2082\u2013CHCl\u2013" },
            { id: "ch2ch2", label: "\u2013CH\u2082\u2013CH\u2082\u2013" },
            { id: "chclchcl", label: "\u2013CHCl\u2013CHCl\u2013" }
          ]
        },
        answer: { kind: "polymer_structure", selectedRepeat: "ch2chcl", selectedLinkage: null, name: "poly(chloroethene)" }
      },
      polyester: {
        label: "Polyester condensation \u2014 Triple",
        kind: "polymer_structure",
        track: "triple",
        template: {
          mode: "condensation",
          monomerLabel: "diol + dicarboxylic acid",
          name: "polyester",
          repeatOptions: [
            { id: "ester_ru", label: "\u2013OOC\u2013R\u2013COO\u2013R\u2013" },
            { id: "amide_ru", label: "\u2013NH\u2013R\u2013CO\u2013" },
            { id: "alkene_ru", label: "\u2013CH\u2082\u2013CH\u2082\u2013" }
          ],
          linkageOptions: [
            { id: "ester", label: "Ester (\u2013COO\u2013)" },
            { id: "amide", label: "Amide (\u2013CONH\u2013)" }
          ]
        },
        answer: { kind: "polymer_structure", selectedRepeat: "ester_ru", selectedLinkage: "ester", name: "polyester" }
      },
      polyamide: {
        label: "Polyamide (nylon) condensation \u2014 Triple",
        kind: "polymer_structure",
        track: "triple",
        template: {
          mode: "condensation",
          monomerLabel: "diamine + dicarboxylic acid",
          name: "polyamide",
          repeatOptions: [
            { id: "amide_ru", label: "\u2013NH\u2013R\u2013CO\u2013NH\u2013R\u2013CO\u2013" },
            { id: "ester_ru", label: "\u2013OOC\u2013R\u2013COO\u2013R\u2013" },
            { id: "alkene_ru", label: "\u2013CH\u2082\u2013CH\u2082\u2013" }
          ],
          linkageOptions: [
            { id: "amide", label: "Amide (\u2013CONH\u2013)" },
            { id: "ester", label: "Ester (\u2013COO\u2013)" }
          ]
        },
        answer: { kind: "polymer_structure", selectedRepeat: "amide_ru", selectedLinkage: "amide", name: "polyamide" }
      },
      nh3_molecule: {
        label: "Build NH\u2083 (molecule builder)",
        kind: "molecule_builder",
        recommendedMaxMarks: 2,
        template: {
          allowedSymbols: ["H", "N", "C", "O", "Cl"],
          maxAtoms: 8
        },
        answer: {
          kind: "molecule_builder",
          atoms: [
            { id: "n", symbol: "N", x: 200, y: 120 },
            { id: "h1", symbol: "H", x: 130, y: 120 },
            { id: "h2", symbol: "H", x: 270, y: 120 },
            { id: "h3", symbol: "H", x: 200, y: 190 }
          ],
          bonds: [
            { a: "n", b: "h1" },
            { a: "n", b: "h2" },
            { a: "n", b: "h3" }
          ]
        }
      },
      water_balance: {
        label: "Balance H\u2082 + O\u2082 \u2192 H\u2082O",
        kind: "balance_equation",
        template: {
          subtype: "symbol",
          arrow: "->",
          species: [
            { formula: "H2", side: "left" },
            { formula: "O2", side: "left" },
            { formula: "H2O", side: "right" }
          ]
        },
        answer: { kind: "balance_equation", coeffs: [2, 1, 2], extraSpecies: [] }
      },
      water_balance_states: {
        label: "Balance H\u2082(g) + O\u2082(g) \u2192 H\u2082O(l)",
        kind: "balance_equation",
        recommendedMaxMarks: 2,
        template: {
          subtype: "symbol",
          arrow: "->",
          species: [
            { formula: "H2", side: "left", state: "g" },
            { formula: "O2", side: "left", state: "g" },
            { formula: "H2O", side: "right", state: "l" }
          ]
        },
        answer: {
          kind: "balance_equation",
          coeffs: [2, 1, 2],
          extraSpecies: [],
          species: [
            { formula: "H2", side: "left", state: "g" },
            { formula: "O2", side: "left", state: "g" },
            { formula: "H2O", side: "right", state: "l" }
          ]
        }
      },
      nacl_aq_formula: {
        label: "Complete Na\u207A + Cl\u207B \u2192 NaCl(aq)",
        kind: "balance_equation",
        recommendedMaxMarks: 3,
        template: {
          subtype: "ionic",
          arrow: "->",
          species: [
            { formula: "Na^{+}", side: "left", state: "aq" },
            { formula: "Cl^{-}", side: "left", state: "aq" },
            { formula: "NaCl", side: "right", state: "aq", studentEntersFormula: true }
          ]
        },
        answer: {
          kind: "balance_equation",
          coeffs: [1, 1, 1],
          extraSpecies: [],
          species: [
            { formula: "Na^{+}", side: "left", state: "aq" },
            { formula: "Cl^{-}", side: "left", state: "aq" },
            { formula: "NaCl", side: "right", state: "aq", studentEntersFormula: true }
          ]
        }
      },
      half_cu: {
        label: "Half-equation Cu\xB2\u207A + 2e\u207B \u2192 Cu",
        kind: "balance_equation",
        recommendedMaxMarks: 2,
        template: {
          subtype: "half",
          halfLayout: "cation",
          arrow: "->",
          species: [
            { formula: "Cu2+", side: "left" },
            { formula: "Cu", side: "right" }
          ]
        },
        answer: {
          kind: "balance_equation",
          coeffs: [1, 1],
          extraSpecies: [{ formula: "e-", coeff: 2, side: "left" }],
          species: [
            { formula: "Cu2+", side: "left" },
            { formula: "Cu", side: "right" }
          ]
        }
      }
    };
    POLYMER_REPEAT_STRUCTURES = {
      ch2ch2: { carbons: [{ top: "H", bottom: "H" }, { top: "H", bottom: "H" }] },
      ch2chcl: { carbons: [{ top: "H", bottom: "H" }, { top: "H", bottom: "Cl" }] },
      chclchcl: { carbons: [{ top: "H", bottom: "Cl" }, { top: "H", bottom: "Cl" }] },
      chch2: { type: "text", label: "\u2013CH=CH\u2082\u2013" },
      ch3: { type: "text", label: "\u2013CH\u2083" },
      ch3ch3: { type: "text", label: "\u2013CH\u2083\u2013CH\u2083\u2013" },
      ester_ru: { type: "text", label: "\u2013OOC\u2013R\u2013COO\u2013R\u2013" },
      amide_ru: { type: "text", label: "\u2013NH\u2013R\u2013CO\u2013" },
      alkene_ru: { type: "text", label: "\u2013CH\u2082\u2013CH\u2082\u2013" }
    };
    MOLECULE_BUILDER_SYMBOLS = ["H", "C", "N", "O", "Cl"];
    METALLIC_LATTICE_SITES = [
      { x: 0, y: 0 },
      { x: 44, y: 0 },
      { x: 88, y: 0 },
      { x: 22, y: 38 },
      { x: 66, y: 38 },
      { x: 0, y: 76 },
      { x: 44, y: 76 }
    ];
    METALLIC_ELECTRON_ANGLES = [35, 150, 265, 65, 195, 115, 310];
    PARTICLE_MODEL_BOX = 200;
    PARTICLE_MODEL_R = 8.5;
    PARTICLE_MODEL_STROKE = "#0f172a";
    IONIC_LATTICE_COMPOUNDS = {
      NaCl: {
        // Ball-and-stick: small dark Na⁺, larger pale Cl⁻ (+ key) — compact radii so sticks show
        // Space-filling: small pale Na⁺, larger dark Cl⁻ with +/- labels
        cation: { symbol: "Na", charge: "+", rBall: 5, rSpace: 15, fill: "#4b5563", fillAlt: "#c4c9d1" },
        anion: { symbol: "Cl", charge: "\u2212", rBall: 8, rSpace: 23, fill: "#d1d5db", fillAlt: "#374151" }
      }
    };
  }
});

// src/lazyChemistryWorkflow.js
var lazyChemistryWorkflow_exports = {};
__export(lazyChemistryWorkflow_exports, {
  loadChemistryWorkflow: () => loadChemistryWorkflow
});
function loadChemistryWorkflow() {
  if (!chemistryWorkflowPromise) {
    chemistryWorkflowPromise = Promise.resolve().then(() => (init_chemistryWorkflow(), chemistryWorkflow_exports));
  }
  return chemistryWorkflowPromise;
}
var chemistryWorkflowPromise;
var init_lazyChemistryWorkflow = __esm({
  "src/lazyChemistryWorkflow.js"() {
    chemistryWorkflowPromise = null;
  }
});

// src/diagramSvgUtils.js
function escapeHtml3(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function deepClone2(v) {
  return JSON.parse(JSON.stringify(v));
}
function svgMarkupToPngBlob2(svgMarkup, { width = 720, height = 560, scale = 2 } = {}) {
  return new Promise((resolve, reject) => {
    let svg = String(svgMarkup || "").trim();
    if (!svg) {
      reject(new Error("Empty SVG"));
      return;
    }
    if (!svg.includes("xmlns=")) {
      svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!/width=/.test(svg)) {
      svg = svg.replace("<svg", `<svg width="${width}" height="${height}"`);
    }
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const w = Math.max(img.naturalWidth || width, 200) * scale;
        const h = Math.max(img.naturalHeight || height, 200) * scale;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((png) => {
          URL.revokeObjectURL(url);
          if (!png) reject(new Error("PNG encode failed"));
          else resolve(png);
        }, "image/png");
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG image load failed"));
    };
    img.src = url;
  });
}
function wrapSvg(inner, { width = 640, height = 360, className = "diagram-svg", maxWidth = 560 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" class="${className}" viewBox="0 0 ${width} ${height}" width="100%" style="max-width:${maxWidth}px;height:auto;display:block;margin:0 auto;background:#fff;">
  ${inner}
</svg>`;
}
var init_diagramSvgUtils = __esm({
  "src/diagramSvgUtils.js"() {
  }
});

// src/circuitWorkflow.js
var circuitWorkflow_exports = {};
__export(circuitWorkflow_exports, {
  CIRCUIT_PRESETS: () => CIRCUIT_PRESETS,
  CIRCUIT_SYMBOLS: () => CIRCUIT_SYMBOLS,
  CIRCUIT_SYMBOL_IDS: () => CIRCUIT_SYMBOL_IDS,
  applyCircuitPresetToForm: () => applyCircuitPresetToForm,
  buildCircuitConfigFromForm: () => buildCircuitConfigFromForm,
  buildLayoutFromTemplate: () => buildLayoutFromTemplate,
  collectCircuitResponse: () => collectCircuitResponse,
  getCircuitConfig: () => getCircuitConfig,
  initialStateForConfig: () => initialStateForConfig2,
  listCircuitPresets: () => listCircuitPresets,
  listStemCircuitPresets: () => listStemCircuitPresets,
  markCircuitResponse: () => markCircuitResponse,
  populateCircuitPresetSelect: () => populateCircuitPresetSelect,
  renderCircuitModelAnswerHtml: () => renderCircuitModelAnswerHtml,
  renderCircuitSvg: () => renderCircuitSvg,
  renderCircuitWorkflow: () => renderCircuitWorkflow,
  renderStemDiagramSvg: () => renderStemDiagramSvg2,
  renderSymbolAt: () => renderSymbolAt,
  stemPreviewHtml: () => stemPreviewHtml2,
  svgMarkupToPngBlob: () => svgMarkupToPngBlob2,
  wireCircuitWorkflow: () => wireCircuitWorkflow,
  wrapSvg: () => wrapSvg
});
function renderSymbolAt(type, cx, cy, { highlight = false, slot = false, id = "" } = {}) {
  const stroke = highlight ? "#2563eb" : "#0f172a";
  const sw = highlight ? 2.5 : 2;
  const half = CELL / 2;
  const left = cx - half;
  const right = cx + half;
  const midY = cy;
  let body = "";
  const wiresTo = (edge) => {
    const e = Math.max(0, edge - 1.5);
    return `
    <line x1="${left}" y1="${midY}" x2="${cx - e}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="butt"/>
    <line x1="${cx + e}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="butt"/>`;
  };
  const arrowHead = (tipX, tipY, dx, dy, size = 7) => {
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const bx = tipX - ux * size;
    const by = tipY - uy * size;
    const wing = size * 0.6;
    const p1x = bx + px * wing;
    const p1y = by + py * wing;
    const p2x = bx - px * wing;
    const p2y = by - py * wing;
    return `<polygon points="${tipX},${tipY} ${p1x},${p1y} ${p2x},${p2y}" fill="${stroke}" stroke="${stroke}" stroke-width="0.5" stroke-linejoin="round"/>`;
  };
  switch (type) {
    case "cell":
      body = `
        <line x1="${left}" y1="${midY}" x2="${cx - 6}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + 6}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx - 6}" y1="${cy - 16}" x2="${cx - 6}" y2="${cy + 16}" stroke="${stroke}" stroke-width="3"/>
        <line x1="${cx + 6}" y1="${cy - 8}" x2="${cx + 6}" y2="${cy + 8}" stroke="${stroke}" stroke-width="2"/>
        <text x="${cx - 14}" y="${cy - 20}" text-anchor="middle" font-size="13" font-weight="700" fill="${stroke}" font-family="system-ui,sans-serif">+</text>
      `;
      break;
    case "battery":
      body = `
        <line x1="${left}" y1="${midY}" x2="${cx - 18}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + 18}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx - 18}" y1="${cy - 16}" x2="${cx - 18}" y2="${cy + 16}" stroke="${stroke}" stroke-width="3"/>
        <line x1="${cx - 10}" y1="${cy - 8}" x2="${cx - 10}" y2="${cy + 8}" stroke="${stroke}" stroke-width="2"/>
        <line x1="${cx - 7}" y1="${midY}" x2="${cx - 4.5}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx - 2.5}" y1="${midY}" x2="${cx}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + 2}" y1="${midY}" x2="${cx + 4.5}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + 6.5}" y1="${midY}" x2="${cx + 9}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + 10}" y1="${cy - 16}" x2="${cx + 10}" y2="${cy + 16}" stroke="${stroke}" stroke-width="3"/>
        <line x1="${cx + 18}" y1="${cy - 8}" x2="${cx + 18}" y2="${cy + 8}" stroke="${stroke}" stroke-width="2"/>
        <text x="${cx - 26}" y="${cy - 18}" text-anchor="middle" font-size="13" font-weight="700" fill="${stroke}" font-family="system-ui,sans-serif">+</text>
      `;
      break;
    case "switch_open":
      body = `
        <line x1="${left}" y1="${midY}" x2="${cx - 14}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <circle cx="${cx - 14}" cy="${midY}" r="4" fill="#ffffff" stroke="${stroke}" stroke-width="1.5"/>
        <line x1="${cx - 14}" y1="${midY}" x2="${cx + 12}" y2="${cy - 14}" stroke="${stroke}" stroke-width="${sw}"/>
        <circle cx="${cx + 14}" cy="${midY}" r="4" fill="#ffffff" stroke="${stroke}" stroke-width="1.5"/>
        <line x1="${cx + 14}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
      `;
      break;
    case "switch_closed":
      body = `
        <line x1="${left}" y1="${midY}" x2="${cx - 14}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <circle cx="${cx - 14}" cy="${midY}" r="4" fill="#ffffff" stroke="${stroke}" stroke-width="1.5"/>
        <line x1="${cx - 14}" y1="${midY}" x2="${cx + 14}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <circle cx="${cx + 14}" cy="${midY}" r="4" fill="#ffffff" stroke="${stroke}" stroke-width="1.5"/>
        <line x1="${cx + 14}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
      `;
      break;
    case "lamp":
      body = `
        <line x1="${left}" y1="${midY}" x2="${cx - 14}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + 14}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <circle cx="${cx}" cy="${cy}" r="14" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx - 10}" y1="${cy - 10}" x2="${cx + 10}" y2="${cy + 10}" stroke="${stroke}" stroke-width="1.5"/>
        <line x1="${cx + 10}" y1="${cy - 10}" x2="${cx - 10}" y2="${cy + 10}" stroke="${stroke}" stroke-width="1.5"/>
      `;
      break;
    case "fuse":
      body = `
        <line x1="${left}" y1="${midY}" x2="${cx - 16}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + 16}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <rect x="${cx - 16}" y="${cy - 8}" width="32" height="16" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx - 16}" y1="${cy}" x2="${cx + 16}" y2="${cy}" stroke="${stroke}" stroke-width="${sw}"/>
      `;
      break;
    case "ammeter":
      body = `
        <line x1="${left}" y1="${midY}" x2="${cx - 14}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + 14}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <circle cx="${cx}" cy="${cy}" r="14" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="${stroke}" font-family="system-ui,sans-serif">A</text>
      `;
      break;
    case "voltmeter":
      body = `
        <line x1="${left}" y1="${midY}" x2="${cx - 14}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + 14}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <circle cx="${cx}" cy="${cy}" r="14" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>
        <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="${stroke}" font-family="system-ui,sans-serif">V</text>
      `;
      break;
    case "diode":
      body = `
        <circle cx="${cx}" cy="${cy}" r="16" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${left}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <polygon points="${cx - 8},${cy - 10} ${cx - 8},${cy + 10} ${cx + 8},${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + 8}" y1="${cy - 10}" x2="${cx + 8}" y2="${cy + 10}" stroke="${stroke}" stroke-width="${sw}"/>
      `;
      break;
    case "led":
      body = `
        <circle cx="${cx}" cy="${cy}" r="16" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${left}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <polygon points="${cx - 8},${cy - 10} ${cx - 8},${cy + 10} ${cx + 8},${cy}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + 8}" y1="${cy - 10}" x2="${cx + 8}" y2="${cy + 10}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + 12}" y1="${cy - 18}" x2="${cx + 22}" y2="${cy - 30}" stroke="${stroke}" stroke-width="1.6"/>
        <line x1="${cx + 22}" y1="${cy - 30}" x2="${cx + 16}" y2="${cy - 29}" stroke="${stroke}" stroke-width="1.6"/>
        <line x1="${cx + 22}" y1="${cy - 30}" x2="${cx + 21}" y2="${cy - 24}" stroke="${stroke}" stroke-width="1.6"/>
        <line x1="${cx + 18}" y1="${cy - 14}" x2="${cx + 28}" y2="${cy - 26}" stroke="${stroke}" stroke-width="1.6"/>
        <line x1="${cx + 28}" y1="${cy - 26}" x2="${cx + 22}" y2="${cy - 25}" stroke="${stroke}" stroke-width="1.6"/>
        <line x1="${cx + 28}" y1="${cy - 26}" x2="${cx + 27}" y2="${cy - 20}" stroke="${stroke}" stroke-width="1.6"/>
      `;
      break;
    case "resistor": {
      const rw = 40;
      const rh = 16;
      body = `
        <line x1="${left}" y1="${midY}" x2="${cx - rw / 2}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + rw / 2}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <rect x="${cx - rw / 2}" y="${cy - rh / 2}" width="${rw}" height="${rh}" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>
      `;
      break;
    }
    case "variable_resistor": {
      const rw = 40;
      const rh = 16;
      const overhang = rw * 0.25;
      const d = rh / 2 + overhang;
      body = `
        <line x1="${left}" y1="${midY}" x2="${cx - rw / 2}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + rw / 2}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <rect x="${cx - rw / 2}" y="${cy - rh / 2}" width="${rw}" height="${rh}" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx - d}" y1="${cy + d}" x2="${cx + d}" y2="${cy - d}" stroke="${stroke}" stroke-width="${sw}"/>
        ${arrowHead(cx + d, cy - d, d * 2, -d * 2, 6)}
      `;
      break;
    }
    case "thermistor": {
      const rw = 40;
      const rh = 16;
      const bottomY = cy + rh / 2;
      const belowGap = rh * 0.5;
      const hy = bottomY + belowGap;
      const crossX = cx - rw / 2 + 0.45 * rw;
      const hx0 = cx - rw / 2;
      const hx1 = crossX - belowGap / Math.tan(60 * Math.PI / 180);
      const tipY = cy - rh / 2 - rw * 0.25;
      const tipX = hx1 + (hy - tipY) / Math.tan(60 * Math.PI / 180);
      body = `
        <line x1="${left}" y1="${midY}" x2="${cx - rw / 2}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx + rw / 2}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <rect x="${cx - rw / 2}" y="${cy - rh / 2}" width="${rw}" height="${rh}" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${hx0}" y1="${hy}" x2="${hx1}" y2="${hy}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="square"/>
        <line x1="${hx1}" y1="${hy}" x2="${tipX}" y2="${tipY}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="square"/>
      `;
      break;
    }
    case "ldr": {
      const cr = 14;
      const rw = 18;
      const rh = 7.2;
      body = `
        <circle cx="${cx}" cy="${cy}" r="${cr}" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${left}" y1="${midY}" x2="${right}" y2="${midY}" stroke="${stroke}" stroke-width="${sw}"/>
        <rect x="${cx - rw / 2}" y="${cy - rh / 2}" width="${rw}" height="${rh}" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>
        <line x1="${cx - 26}" y1="${cy - 32}" x2="${cx - 16}" y2="${cy - 22}" stroke="${stroke}" stroke-width="1.6"/>
        <line x1="${cx - 16}" y1="${cy - 22}" x2="${cx - 22}" y2="${cy - 23}" stroke="${stroke}" stroke-width="1.6"/>
        <line x1="${cx - 16}" y1="${cy - 22}" x2="${cx - 17}" y2="${cy - 28}" stroke="${stroke}" stroke-width="1.6"/>
        <line x1="${cx - 16}" y1="${cy - 34}" x2="${cx - 6}" y2="${cy - 24}" stroke="${stroke}" stroke-width="1.6"/>
        <line x1="${cx - 6}" y1="${cy - 24}" x2="${cx - 12}" y2="${cy - 25}" stroke="${stroke}" stroke-width="1.6"/>
        <line x1="${cx - 6}" y1="${cy - 24}" x2="${cx - 7}" y2="${cy - 30}" stroke="${stroke}" stroke-width="1.6"/>
      `;
      break;
    }
    default:
      body = `
        ${wiresTo(16)}
        <rect x="${cx - 16}" y="${cy - 12}" width="32" height="24" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 3" rx="4"/>
        <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui,sans-serif">?</text>
      `;
  }
  if (slot && !type) {
    body = `
      <line x1="${left}" y1="${midY}" x2="${cx - 20}" y2="${midY}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 3"/>
      <line x1="${cx + 20}" y1="${midY}" x2="${right}" y2="${midY}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="4 3"/>
      <rect x="${cx - 20}" y="${cy - 16}" width="40" height="32" fill="#eff6ff" stroke="#2563eb" stroke-width="2" stroke-dasharray="5 3" rx="4"/>
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="12" fill="#2563eb" font-family="system-ui,sans-serif">?</text>
    `;
  }
  const ring = highlight ? `<rect x="${cx - half - 4}" y="${cy - half + 8}" width="${CELL + 8}" height="${CELL - 8}" fill="none" stroke="#93c5fd" stroke-width="2" rx="6"/>` : "";
  return `<g data-circuit-id="${escapeHtml3(id)}" data-circuit-type="${escapeHtml3(type || "")}">${ring}${body}</g>`;
}
function layoutSeries(components) {
  const n = components.length;
  const width = PAD * 2 + n * CELL + (n > 0 ? (n - 1) * 8 : 0);
  const height = 160;
  const y = 70;
  const items = components.map((c, i) => {
    const x = PAD + CELL / 2 + i * (CELL + 8);
    return { ...c, x, y };
  });
  const leftX = items[0]?.x - CELL / 2 || PAD;
  const rightX = items[n - 1]?.x + CELL / 2 || PAD + CELL;
  const returnY = 130;
  const wires = `
    <line x1="${leftX}" y1="${y}" x2="${leftX}" y2="${returnY}" stroke="#0f172a" stroke-width="2"/>
    <line x1="${leftX}" y1="${returnY}" x2="${rightX}" y2="${returnY}" stroke="#0f172a" stroke-width="2"/>
    <line x1="${rightX}" y1="${returnY}" x2="${rightX}" y2="${y}" stroke="#0f172a" stroke-width="2"/>
  `;
  return { width: Math.max(width, 280), height, items, wires };
}
function layoutParallel(supply, branches) {
  const branchCount = Math.max(branches.length, 1);
  const maxLen = Math.max(...branches.map((b) => b.length), 1);
  const width = PAD * 2 + CELL + 24 + maxLen * (CELL + 8) + 24;
  const height = PAD * 2 + branchCount * 90;
  const supplyX = PAD + CELL / 2;
  const supplyY = height / 2;
  const railLeft = supplyX + CELL / 2 + 12;
  const railRight = width - PAD;
  const items = [{ ...supply, x: supplyX, y: supplyY }];
  branches.forEach((branch, bi) => {
    const y = PAD + 40 + bi * 90;
    branch.forEach((c, ci) => {
      const x = railLeft + 20 + CELL / 2 + ci * (CELL + 8);
      items.push({ ...c, x, y });
    });
  });
  let wires = `
    <line x1="${supplyX + CELL / 2}" y1="${supplyY}" x2="${railLeft}" y2="${supplyY}" stroke="#0f172a" stroke-width="2"/>
    <line x1="${railLeft}" y1="${PAD + 40}" x2="${railLeft}" y2="${PAD + 40 + (branchCount - 1) * 90}" stroke="#0f172a" stroke-width="2"/>
    <line x1="${railRight}" y1="${PAD + 40}" x2="${railRight}" y2="${PAD + 40 + (branchCount - 1) * 90}" stroke="#0f172a" stroke-width="2"/>
    <line x1="${railRight}" y1="${supplyY}" x2="${supplyX - CELL / 2}" y2="${supplyY}" stroke="#0f172a" stroke-width="2"/>
    <line x1="${supplyX - CELL / 2}" y1="${supplyY}" x2="${supplyX - CELL / 2}" y2="${supplyY}" stroke="#0f172a" stroke-width="2"/>
  `;
  branches.forEach((branch, bi) => {
    const y = PAD + 40 + bi * 90;
    wires += `<line x1="${railLeft}" y1="${y}" x2="${railLeft + 20}" y2="${y}" stroke="#0f172a" stroke-width="2"/>`;
    const lastX = railLeft + 20 + branch.length * (CELL + 8);
    wires += `<line x1="${lastX}" y1="${y}" x2="${railRight}" y2="${y}" stroke="#0f172a" stroke-width="2"/>`;
  });
  return { width: Math.max(width, 360), height: Math.max(height, 200), items, wires };
}
function layoutSingle(component) {
  return {
    width: 220,
    height: 140,
    items: [{ ...component, x: 110, y: 70 }],
    wires: ""
  };
}
function buildLayoutFromTemplate(template) {
  const t = template || {};
  if (t.layout === "single" && t.component) {
    return layoutSingle({ id: t.component.id || "c1", type: t.component.type });
  }
  if (t.layout === "parallel") {
    return layoutParallel(
      t.supply || { id: "supply", type: "cell" },
      t.branches || [[{ id: "b0", type: "lamp" }]]
    );
  }
  const comps = (t.series || []).map((c, i) => {
    if (typeof c === "string") return { id: `c${i}`, type: c };
    return { id: c.id || `c${i}`, type: c.type || null, slot: !!c.slot, slotId: c.slotId };
  });
  return layoutSeries(comps.length ? comps : [{ id: "c0", type: "cell" }]);
}
function renderCircuitSvg(template, state = {}, { interactive = false } = {}) {
  const layout = buildLayoutFromTemplate(template);
  const highlightId = template?.highlightId || state.highlightId || null;
  const slotChoices = state.slotChoices || {};
  const parts = layout.items.map((item) => {
    const isSlot = item.slot || item.type == null;
    let type = item.type;
    if (isSlot && slotChoices[item.slotId || item.id]) {
      type = slotChoices[item.slotId || item.id];
    }
    const highlight = highlightId && (item.id === highlightId || item.slotId === highlightId);
    return renderSymbolAt(type, item.x, item.y, {
      highlight,
      slot: isSlot && !type,
      id: item.slotId || item.id
    });
  });
  return wrapSvg(`${layout.wires}${parts.join("\n")}`, {
    width: layout.width,
    height: layout.height,
    className: "circuit-svg",
    maxWidth: 560
  });
}
function getCircuitConfig(q) {
  const cfg = q?.circuit_config;
  if (!cfg || typeof cfg !== "object") return null;
  return cfg;
}
function listCircuitPresets(kindFilter = "") {
  return Object.entries(CIRCUIT_PRESETS).filter(([, p]) => !kindFilter || p.kind === kindFilter).map(([id, p]) => ({ id, label: p.label, kind: p.kind }));
}
function populateCircuitPresetSelect(selectEl, kindFilter = "") {
  if (!selectEl) return;
  const keep = selectEl.value;
  selectEl.innerHTML = `<option value="">\u2014 Custom / manual \u2014</option>`;
  for (const { id, label } of listCircuitPresets(kindFilter)) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = label;
    selectEl.appendChild(opt);
  }
  if (keep && [...selectEl.options].some((o) => o.value === keep)) selectEl.value = keep;
}
function applyCircuitPresetToForm(prefix, presetId) {
  const p = prefix || "";
  const preset = CIRCUIT_PRESETS[presetId];
  if (!preset) return;
  const kindEl = document.getElementById(`${p}CircuitKind`);
  if (kindEl) kindEl.value = preset.kind;
}
function buildCircuitConfigFromForm(prefix = "") {
  const p = prefix || "";
  const presetId = document.getElementById(`${p}CircuitPreset`)?.value || "";
  if (presetId && CIRCUIT_PRESETS[presetId]) {
    const preset = CIRCUIT_PRESETS[presetId];
    return {
      kind: preset.kind,
      template: deepClone2(preset.template),
      answer: deepClone2(preset.answer)
    };
  }
  const kind = document.getElementById(`${p}CircuitKind`)?.value || "identify_component";
  if (kind === "identify_component") {
    const type = document.getElementById(`${p}CircuitSymbol`)?.value || "lamp";
    return {
      kind,
      template: {
        layout: "single",
        component: { id: "c0", type },
        highlightId: "c0"
      },
      answer: { kind, type }
    };
  }
  if (kind === "complete_slots") {
    const slotType = document.getElementById(`${p}CircuitSlotAnswer`)?.value || "lamp";
    const before = (document.getElementById(`${p}CircuitBefore`)?.value || "cell,switch_closed").split(",").map((s) => s.trim()).filter(Boolean);
    const after = (document.getElementById(`${p}CircuitAfter`)?.value || "").split(",").map((s) => s.trim()).filter(Boolean);
    const series = [
      ...before.map((type, i) => ({ id: `c${i}`, type })),
      { id: "s1", type: null, slot: true, slotId: "s1" },
      ...after.map((type, i) => ({ id: `a${i}`, type }))
    ];
    return {
      kind,
      template: { layout: "series", series },
      answer: { kind, slots: { s1: slotType } }
    };
  }
  const t0 = document.getElementById(`${p}CircuitBuild0`)?.value || "cell";
  const t1 = document.getElementById(`${p}CircuitBuild1`)?.value || "lamp";
  return {
    kind: "build_preset",
    template: {
      layout: "series",
      series: [
        { id: "s0", type: null, slot: true, slotId: "s0" },
        { id: "s1", type: null, slot: true, slotId: "s1" }
      ]
    },
    answer: { kind: "build_preset", seriesTypes: [t0, t1] }
  };
}
function listStemCircuitPresets() {
  return Object.entries(CIRCUIT_PRESETS).map(([id, p]) => ({ id, label: p.label }));
}
function renderStemDiagramSvg2(presetIdOrConfig) {
  const preset = typeof presetIdOrConfig === "string" ? CIRCUIT_PRESETS[presetIdOrConfig] : presetIdOrConfig;
  if (!preset) return "";
  const template = preset.template || preset;
  const answer = preset.answer || {};
  const filled = deepClone2(template);
  if (filled.series && answer.slots) {
    filled.series = filled.series.map((c) => {
      if (c.slot || c.type == null) {
        const t = answer.slots[c.slotId || c.id];
        return t ? { ...c, type: t, slot: false } : c;
      }
      return c;
    });
  }
  if (filled.series && answer.seriesTypes) {
    filled.series = answer.seriesTypes.map((type, i) => ({ id: `c${i}`, type }));
  }
  return renderCircuitSvg(filled, {}, { interactive: false });
}
function stemPreviewHtml2(presetIdOrConfig) {
  const svg = renderStemDiagramSvg2(presetIdOrConfig);
  return svg || `<p class="muted">No preview</p>`;
}
function symbolOptionsHtml(selected = "") {
  return CIRCUIT_SYMBOL_IDS.map((id) => {
    const sel = id === selected ? " selected" : "";
    return `<option value="${id}"${sel}>${escapeHtml3(CIRCUIT_SYMBOLS[id].label)}</option>`;
  }).join("");
}
function initialStateForConfig2(cfg) {
  const kind = cfg?.kind || "identify_component";
  if (kind === "identify_component") {
    return { kind, selectedType: "" };
  }
  if (kind === "complete_slots" || kind === "build_preset") {
    const slots = {};
    const series = cfg?.template?.series || [];
    series.forEach((c) => {
      if (c.slot || c.type == null) slots[c.slotId || c.id] = "";
    });
    return { kind, slotChoices: slots };
  }
  return { kind };
}
function readState2() {
  return _circuitState;
}
function writeState2(s) {
  _circuitState = s;
}
function renderCircuitWorkflow(q, key, presentation = "practice") {
  const cfg = getCircuitConfig(q);
  if (!cfg) {
    return `<div class="item"><p class="bad">This circuit question is missing circuit_config.</p></div>`;
  }
  const state = initialStateForConfig2(cfg);
  writeState2(state);
  const kindLabel = cfg.kind === "identify_component" ? "Identify the circuit symbol" : cfg.kind === "complete_slots" ? "Complete the circuit" : "Build the circuit";
  let controls = "";
  if (cfg.kind === "identify_component") {
    controls = `
      <label style="font-size:0.85rem;font-weight:600;">This symbol is a:</label>
      <select id="circuitIdentifySelect" class="select-fit" style="margin-top:6px;max-width:280px;">
        <option value="">\u2014 Choose \u2014</option>
        ${symbolOptionsHtml()}
      </select>`;
  } else {
    const series = cfg.template?.series || [];
    const slotIds = series.filter((c) => c.slot || c.type == null).map((c) => c.slotId || c.id);
    controls = slotIds.map(
      (sid, i) => `
      <div style="margin-bottom:8px;">
        <label style="font-size:0.85rem;font-weight:600;">Slot ${i + 1}</label>
        <select data-circuit-slot="${escapeHtml3(sid)}" class="select-fit" style="display:block;margin-top:4px;max-width:280px;">
          <option value="">\u2014 Choose component \u2014</option>
          ${symbolOptionsHtml()}
        </select>
      </div>`
    ).join("");
  }
  return `
    <div class="item circuit-workflow" id="circuitWorkflowRoot" data-circuit-kind="${escapeHtml3(cfg.kind)}">
      <div class="chem-title" style="font-weight:700;margin-bottom:8px;">${escapeHtml3(kindLabel)}</div>
      <div id="circuitDiagramMount">${renderCircuitSvg(cfg.template, state, { interactive: true })}</div>
      <div style="margin-top:12px;">${controls}</div>
      <button type="button" class="btn btn-secondary" data-circuit-action="reset" style="margin-top:10px;padding:6px 12px;font-size:0.8rem;">Reset</button>
    </div>`;
}
function wireCircuitWorkflow(q) {
  const cfg = getCircuitConfig(q);
  if (!cfg) return;
  const root = document.getElementById("circuitWorkflowRoot");
  if (!root) return;
  const refresh = () => {
    const mount = document.getElementById("circuitDiagramMount");
    const state = readState2() || initialStateForConfig2(cfg);
    if (mount) mount.innerHTML = renderCircuitSvg(cfg.template, state, { interactive: true });
  };
  root.querySelector("#circuitIdentifySelect")?.addEventListener("change", (e) => {
    const state = readState2() || initialStateForConfig2(cfg);
    state.selectedType = e.target.value;
    writeState2(state);
  });
  root.querySelectorAll("[data-circuit-slot]").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const state = readState2() || initialStateForConfig2(cfg);
      if (!state.slotChoices) state.slotChoices = {};
      state.slotChoices[e.target.getAttribute("data-circuit-slot")] = e.target.value;
      writeState2(state);
      refresh();
    });
  });
  root.querySelector('[data-circuit-action="reset"]')?.addEventListener("click", () => {
    writeState2(initialStateForConfig2(cfg));
    const idSel = root.querySelector("#circuitIdentifySelect");
    if (idSel) idSel.value = "";
    root.querySelectorAll("[data-circuit-slot]").forEach((sel) => {
      sel.value = "";
    });
    refresh();
  });
}
function collectCircuitResponse(q) {
  const cfg = getCircuitConfig(q);
  const state = readState2() || initialStateForConfig2(cfg);
  return { type: "circuit", kind: cfg?.kind, ...deepClone2(state) };
}
function markIdentify(resp, answer) {
  const ok = resp.selectedType && resp.selectedType === answer.type;
  return {
    correct: ok,
    detail: ok ? "Symbol identified correctly" : `Expected ${CIRCUIT_SYMBOLS[answer.type]?.label || answer.type}`
  };
}
function markSlots(resp, answer) {
  const expected = answer.slots || {};
  const got = resp.slotChoices || {};
  const keys = Object.keys(expected);
  if (!keys.length && answer.seriesTypes) {
    return markBuild(resp, answer);
  }
  const ok = keys.every((k) => got[k] === expected[k]);
  return {
    correct: ok,
    detail: ok ? "Circuit completed correctly" : "One or more components are incorrect"
  };
}
function markBuild(resp, answer) {
  if (answer.seriesTypes) {
    const slots = resp.slotChoices || {};
    const keys = Object.keys(slots).sort();
    const values = keys.map((k) => slots[k]);
    const ordered = answer.seriesTypes.every((t, i) => (slots[`s${i}`] || values[i]) === t);
    return {
      correct: ordered,
      detail: ordered ? "Circuit built correctly" : `Expected: ${answer.seriesTypes.map((t) => CIRCUIT_SYMBOLS[t]?.label || t).join(" \u2192 ")}`
    };
  }
  if (answer.branches) {
    return { correct: true, detail: "Parallel layout shown" };
  }
  return { correct: false, detail: "Unable to mark build" };
}
function markCircuitResponse(q, resp, key, markPoints, cleanUrl) {
  const cfg = getCircuitConfig(q);
  const max = q.max_marks || 1;
  const ao = { AO1: 0, AO2: 0, AO3: 0 };
  const maxAo = { AO1: max, AO2: 0, AO3: 0 };
  const answer = key?.key_payload || cfg?.answer || {};
  const kind = cfg?.kind || resp?.kind || answer.kind;
  let result = { correct: false, detail: "Unable to mark" };
  if (kind === "identify_component") result = markIdentify(resp, answer);
  else if (kind === "complete_slots") result = markSlots(resp, answer);
  else if (kind === "build_preset") result = markBuild(resp, answer);
  const total = result.correct ? max : 0;
  if (total) ao.AO1 = max;
  const missing = [];
  if (!result.correct) {
    const tip = answer.feedback || result.detail || "Check the circuit symbols against the mark scheme.";
    missing.push({
      ao: "AO1",
      label: result.detail,
      feedback: tip,
      text: tip,
      flashcard_text: tip,
      resource_url: cleanUrl || null
    });
  }
  return {
    total,
    max,
    ao,
    maxAo,
    missing,
    quality: total ? 5 : 1,
    feedbackPayload: {
      missing,
      circuit: { student: resp, expected: answer, detail: result.detail }
    }
  };
}
function renderCircuitModelAnswerHtml(expected, { title = "Model answer" } = {}) {
  const type = expected?.type;
  const slots = expected?.slots;
  const series = expected?.seriesTypes;
  let body = "";
  if (type) {
    body = `<p style="margin:0;">Correct symbol: <strong>${escapeHtml3(CIRCUIT_SYMBOLS[type]?.label || type)}</strong></p>`;
  } else if (slots && Object.keys(slots).length) {
    body = `<ul style="margin:0;padding-left:18px;">${Object.entries(slots).map(([k, v]) => `<li>${escapeHtml3(k)}: ${escapeHtml3(CIRCUIT_SYMBOLS[v]?.label || v)}</li>`).join("")}</ul>`;
  } else if (series) {
    body = `<p style="margin:0;">${escapeHtml3(series.map((t) => CIRCUIT_SYMBOLS[t]?.label || t).join(" \u2192 "))}</p>`;
  }
  return `
    <div style="margin-top:12px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <strong>${escapeHtml3(title)}</strong>
      <div style="margin-top:8px;">${body}</div>
    </div>`;
}
var CIRCUIT_SYMBOLS, CIRCUIT_SYMBOL_IDS, CELL, PAD, CIRCUIT_PRESETS, _circuitState;
var init_circuitWorkflow = __esm({
  "src/circuitWorkflow.js"() {
    init_diagramSvgUtils();
    CIRCUIT_SYMBOLS = {
      cell: { label: "Cell", short: "cell" },
      battery: { label: "Battery", short: "battery" },
      switch_open: { label: "Switch (open)", short: "switch open" },
      switch_closed: { label: "Switch (closed)", short: "switch closed" },
      lamp: { label: "Filament lamp", short: "lamp" },
      fuse: { label: "Fuse", short: "fuse" },
      ammeter: { label: "Ammeter", short: "ammeter" },
      voltmeter: { label: "Voltmeter", short: "voltmeter" },
      diode: { label: "Diode", short: "diode" },
      led: { label: "LED", short: "LED" },
      resistor: { label: "Fixed resistor", short: "resistor" },
      variable_resistor: { label: "Variable resistor", short: "variable resistor" },
      thermistor: { label: "Thermistor", short: "thermistor" },
      ldr: { label: "LDR", short: "LDR" }
    };
    CIRCUIT_SYMBOL_IDS = Object.keys(CIRCUIT_SYMBOLS);
    CELL = 72;
    PAD = 40;
    CIRCUIT_PRESETS = {
      series_lamp: {
        label: "Series: cell, switch, lamp",
        kind: "complete_slots",
        template: {
          layout: "series",
          series: [
            { id: "c0", type: "cell" },
            { id: "c1", type: "switch_closed" },
            { id: "c2", type: "lamp" }
          ]
        },
        answer: {
          kind: "complete_slots",
          slots: {},
          seriesTypes: ["cell", "switch_closed", "lamp"]
        }
      },
      series_identify_lamp: {
        label: "Identify: filament lamp",
        kind: "identify_component",
        template: {
          layout: "single",
          component: { id: "c0", type: "lamp" },
          highlightId: "c0"
        },
        answer: { kind: "identify_component", type: "lamp" }
      },
      series_identify_ammeter: {
        label: "Identify: ammeter",
        kind: "identify_component",
        template: {
          layout: "single",
          component: { id: "c0", type: "ammeter" },
          highlightId: "c0"
        },
        answer: { kind: "identify_component", type: "ammeter" }
      },
      series_identify_ldr: {
        label: "Identify: LDR",
        kind: "identify_component",
        template: {
          layout: "single",
          component: { id: "c0", type: "ldr" },
          highlightId: "c0"
        },
        answer: { kind: "identify_component", type: "ldr" }
      },
      series_missing_lamp: {
        label: "Complete: missing lamp in series",
        kind: "complete_slots",
        template: {
          layout: "series",
          series: [
            { id: "c0", type: "cell" },
            { id: "c1", type: "switch_closed" },
            { id: "s1", type: null, slot: true, slotId: "s1" }
          ]
        },
        answer: { kind: "complete_slots", slots: { s1: "lamp" } }
      },
      series_missing_ammeter: {
        label: "Complete: missing ammeter",
        kind: "complete_slots",
        template: {
          layout: "series",
          series: [
            { id: "c0", type: "cell" },
            { id: "s1", type: null, slot: true, slotId: "s1" },
            { id: "c2", type: "lamp" }
          ]
        },
        answer: { kind: "complete_slots", slots: { s1: "ammeter" } }
      },
      parallel_two_lamps: {
        label: "Parallel: two lamps",
        kind: "build_preset",
        template: {
          layout: "parallel",
          supply: { id: "supply", type: "cell" },
          branches: [
            [{ id: "b0", type: "lamp" }],
            [{ id: "b1", type: "lamp" }]
          ]
        },
        answer: {
          kind: "build_preset",
          supply: "cell",
          branches: [["lamp"], ["lamp"]]
        }
      },
      build_series_cell_lamp: {
        label: "Build: series cell + lamp",
        kind: "build_preset",
        template: {
          layout: "series",
          series: [
            { id: "s0", type: null, slot: true, slotId: "s0" },
            { id: "s1", type: null, slot: true, slotId: "s1" }
          ]
        },
        answer: {
          kind: "build_preset",
          seriesTypes: ["cell", "lamp"]
        }
      },
      diode_forward: {
        label: "Series: cell, diode, lamp",
        kind: "complete_slots",
        template: {
          layout: "series",
          series: [
            { id: "c0", type: "cell" },
            { id: "c1", type: "diode" },
            { id: "c2", type: "lamp" }
          ]
        },
        answer: { kind: "complete_slots", slots: {}, seriesTypes: ["cell", "diode", "lamp"] }
      },
      thermistor_series: {
        label: "Series: cell, thermistor, lamp",
        kind: "identify_component",
        template: {
          layout: "series",
          series: [
            { id: "c0", type: "cell" },
            { id: "c1", type: "thermistor" },
            { id: "c2", type: "lamp" }
          ],
          highlightId: "c1"
        },
        answer: { kind: "identify_component", type: "thermistor" }
      }
    };
    _circuitState = null;
  }
});

// src/lazyCircuitWorkflow.js
var lazyCircuitWorkflow_exports = {};
__export(lazyCircuitWorkflow_exports, {
  loadCircuitWorkflow: () => loadCircuitWorkflow
});
function loadCircuitWorkflow() {
  if (!circuitWorkflowPromise) {
    circuitWorkflowPromise = Promise.resolve().then(() => (init_circuitWorkflow(), circuitWorkflow_exports));
  }
  return circuitWorkflowPromise;
}
var circuitWorkflowPromise;
var init_lazyCircuitWorkflow = __esm({
  "src/lazyCircuitWorkflow.js"() {
    circuitWorkflowPromise = null;
  }
});

// src/equipmentWorkflow.js
var equipmentWorkflow_exports = {};
__export(equipmentWorkflow_exports, {
  APPARATUS: () => APPARATUS,
  APPARATUS_IDS: () => APPARATUS_IDS,
  EQUIPMENT_PRESETS: () => EQUIPMENT_PRESETS,
  apparatusIdsForSubject: () => apparatusIdsForSubject,
  applyEquipmentPresetToForm: () => applyEquipmentPresetToForm,
  buildEquipmentConfigFromForm: () => buildEquipmentConfigFromForm,
  collectEquipmentResponse: () => collectEquipmentResponse,
  getEquipmentConfig: () => getEquipmentConfig,
  initialStateForConfig: () => initialStateForConfig3,
  listEquipmentPresets: () => listEquipmentPresets,
  listStemEquipmentPresets: () => listStemEquipmentPresets,
  markEquipmentResponse: () => markEquipmentResponse,
  populateApparatusSelect: () => populateApparatusSelect,
  populateEquipmentPresetSelect: () => populateEquipmentPresetSelect,
  renderEquipmentModelAnswerHtml: () => renderEquipmentModelAnswerHtml,
  renderEquipmentSvg: () => renderEquipmentSvg,
  renderEquipmentWorkflow: () => renderEquipmentWorkflow,
  renderStemDiagramSvg: () => renderStemDiagramSvg3,
  stemPreviewHtml: () => stemPreviewHtml3,
  svgMarkupToPngBlob: () => svgMarkupToPngBlob2,
  wireEquipmentWorkflow: () => wireEquipmentWorkflow
});
function apparatusIdsForSubject(subject) {
  if (!subject || subject === "all") return APPARATUS_IDS;
  return APPARATUS_IDS.filter((id) => {
    const s = APPARATUS[id].subjects;
    return s.includes(subject) || s.includes("shared");
  });
}
function renderEquipmentSvg(template, { showLabels = false, hotspotNumbers = false } = {}) {
  const items = template?.items || [];
  const width = template?.width || Math.max(280, items.length * 140);
  const height = template?.height || 200;
  const parts = items.map((item, i) => {
    const def = APPARATUS[item.apparatusId];
    if (!def) return "";
    const x = item.x ?? 70 + i * 130;
    const y = item.y ?? height / 2;
    const scale = item.scale ?? 1;
    let label = "";
    if (showLabels) {
      label = `<text x="${x}" y="${y + 58 * scale}" text-anchor="middle" font-size="12" fill="#334155" font-family="system-ui,sans-serif">${escapeHtml3(def.label)}</text>`;
    }
    let hotspot = "";
    if (hotspotNumbers) {
      const num = item.hotspot ?? i + 1;
      hotspot = `
        <circle cx="${x + 40}" cy="${y - 48}" r="12" fill="#2563eb"/>
        <text x="${x + 40}" y="${y - 44}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff" font-family="system-ui,sans-serif">${num}</text>`;
    }
    return `${def.draw(x, y, scale)}${label}${hotspot}`;
  });
  return wrapSvg(parts.join("\n"), { width, height, className: "equipment-svg", maxWidth: 560 });
}
function getEquipmentConfig(q) {
  const cfg = q?.equipment_config;
  if (!cfg || typeof cfg !== "object") return null;
  return cfg;
}
function listEquipmentPresets(kindFilter = "", subject = "") {
  return Object.entries(EQUIPMENT_PRESETS).filter(([, p]) => {
    if (kindFilter && p.kind !== kindFilter) return false;
    if (!subject || subject === "all") return true;
    const ids = (p.template?.items || []).map((i) => i.apparatusId);
    return ids.every((id) => {
      const s = APPARATUS[id]?.subjects || [];
      return s.includes(subject) || s.includes("shared");
    });
  }).map(([id, p]) => ({ id, label: p.label, kind: p.kind }));
}
function populateEquipmentPresetSelect(selectEl, kindFilter = "", subject = "") {
  if (!selectEl) return;
  const keep = selectEl.value;
  selectEl.innerHTML = `<option value="">\u2014 Custom / manual \u2014</option>`;
  for (const { id, label } of listEquipmentPresets(kindFilter, subject)) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = label;
    selectEl.appendChild(opt);
  }
  if (keep && [...selectEl.options].some((o) => o.value === keep)) selectEl.value = keep;
}
function populateApparatusSelect(selectEl, subject = "") {
  if (!selectEl) return;
  const keep = selectEl.value;
  selectEl.innerHTML = "";
  for (const id of apparatusIdsForSubject(subject)) {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = APPARATUS[id].label;
    selectEl.appendChild(opt);
  }
  if (keep && [...selectEl.options].some((o) => o.value === keep)) selectEl.value = keep;
}
function applyEquipmentPresetToForm(prefix, presetId) {
  const p = prefix || "";
  const preset = EQUIPMENT_PRESETS[presetId];
  if (!preset) return;
  const kindEl = document.getElementById(`${p}EquipKind`);
  if (kindEl) kindEl.value = preset.kind;
  const appEl = document.getElementById(`${p}EquipApparatus`);
  if (appEl && preset.answer?.apparatusId) appEl.value = preset.answer.apparatusId;
}
function buildEquipmentConfigFromForm(prefix = "") {
  const p = prefix || "";
  const presetId = document.getElementById(`${p}EquipPreset`)?.value || "";
  if (presetId && EQUIPMENT_PRESETS[presetId]) {
    const preset = EQUIPMENT_PRESETS[presetId];
    return {
      kind: preset.kind,
      template: deepClone2(preset.template),
      answer: deepClone2(preset.answer)
    };
  }
  const kind = document.getElementById(`${p}EquipKind`)?.value || "identify";
  const apparatusId = document.getElementById(`${p}EquipApparatus`)?.value || "beaker";
  const tallSingle = apparatusId === "measuring_cylinder";
  const singleTemplate = {
    items: [{ apparatusId, x: 140, y: tallSingle ? 115 : 90 }],
    width: 280,
    height: tallSingle ? 240 : 180
  };
  if (kind === "identify") {
    return {
      kind,
      template: singleTemplate,
      answer: { kind, apparatusId }
    };
  }
  return {
    kind: "label_hotspots",
    template: {
      items: [{ apparatusId, x: 140, y: tallSingle ? 115 : 90, hotspot: 1 }],
      width: 280,
      height: tallSingle ? 240 : 180
    },
    answer: { kind: "label_hotspots", labels: { 1: apparatusId } }
  };
}
function listStemEquipmentPresets() {
  return Object.entries(EQUIPMENT_PRESETS).map(([id, p]) => ({ id, label: p.label }));
}
function renderStemDiagramSvg3(presetIdOrConfig) {
  const preset = typeof presetIdOrConfig === "string" ? EQUIPMENT_PRESETS[presetIdOrConfig] : presetIdOrConfig;
  if (!preset) return "";
  const template = preset.template || preset;
  const showLabels = !!preset.showLabels;
  return renderEquipmentSvg(template, { showLabels, hotspotNumbers: false });
}
function stemPreviewHtml3(presetIdOrConfig) {
  const svg = renderStemDiagramSvg3(presetIdOrConfig);
  return svg || `<p class="muted">No preview</p>`;
}
function apparatusOptionsHtml(subject, selected = "") {
  return apparatusIdsForSubject(subject).map((id) => {
    const sel = id === selected ? " selected" : "";
    return `<option value="${id}"${sel}>${escapeHtml3(APPARATUS[id].label)}</option>`;
  }).join("");
}
function initialStateForConfig3(cfg) {
  const kind = cfg?.kind || "identify";
  if (kind === "identify") return { kind, selectedId: "" };
  const labels = {};
  const items = cfg?.template?.items || [];
  items.forEach((item, i) => {
    const n = item.hotspot ?? i + 1;
    labels[n] = "";
  });
  return { kind, hotspotLabels: labels };
}
function readState3() {
  return _equipState;
}
function writeState3(s) {
  _equipState = s;
}
function renderEquipmentWorkflow(q, key, presentation = "practice") {
  const cfg = getEquipmentConfig(q);
  if (!cfg) {
    return `<div class="item"><p class="bad">This equipment question is missing equipment_config.</p></div>`;
  }
  const state = initialStateForConfig3(cfg);
  writeState3(state);
  const subject = q._subject || q.spec_points?.subject || "";
  const kindLabel = cfg.kind === "identify" ? "Identify the apparatus" : "Label the apparatus";
  let controls = "";
  if (cfg.kind === "identify") {
    controls = `
      <label style="font-size:0.85rem;font-weight:600;">This apparatus is a:</label>
      <select id="equipIdentifySelect" class="select-fit" style="margin-top:6px;max-width:300px;">
        <option value="">\u2014 Choose \u2014</option>
        ${apparatusOptionsHtml(subject)}
      </select>`;
  } else {
    const items = cfg.template?.items || [];
    controls = items.map((item, i) => {
      const n = item.hotspot ?? i + 1;
      return `
      <div style="margin-bottom:8px;">
        <label style="font-size:0.85rem;font-weight:600;">Label ${n}</label>
        <select data-equip-hotspot="${n}" class="select-fit" style="display:block;margin-top:4px;max-width:300px;">
          <option value="">\u2014 Choose \u2014</option>
          ${apparatusOptionsHtml(subject)}
        </select>
      </div>`;
    }).join("");
  }
  return `
    <div class="item equipment-workflow" id="equipmentWorkflowRoot" data-equip-kind="${escapeHtml3(cfg.kind)}">
      <div style="font-weight:700;margin-bottom:8px;">${escapeHtml3(kindLabel)}</div>
      <div id="equipmentDiagramMount">${renderEquipmentSvg(cfg.template, { hotspotNumbers: cfg.kind === "label_hotspots" })}</div>
      <div style="margin-top:12px;">${controls}</div>
      <button type="button" class="btn btn-secondary" data-equip-action="reset" style="margin-top:10px;padding:6px 12px;font-size:0.8rem;">Reset</button>
    </div>`;
}
function wireEquipmentWorkflow(q) {
  const cfg = getEquipmentConfig(q);
  if (!cfg) return;
  const root = document.getElementById("equipmentWorkflowRoot");
  if (!root) return;
  root.querySelector("#equipIdentifySelect")?.addEventListener("change", (e) => {
    const state = readState3() || initialStateForConfig3(cfg);
    state.selectedId = e.target.value;
    writeState3(state);
  });
  root.querySelectorAll("[data-equip-hotspot]").forEach((sel) => {
    sel.addEventListener("change", (e) => {
      const state = readState3() || initialStateForConfig3(cfg);
      if (!state.hotspotLabels) state.hotspotLabels = {};
      state.hotspotLabels[e.target.getAttribute("data-equip-hotspot")] = e.target.value;
      writeState3(state);
    });
  });
  root.querySelector('[data-equip-action="reset"]')?.addEventListener("click", () => {
    writeState3(initialStateForConfig3(cfg));
    const idSel = root.querySelector("#equipIdentifySelect");
    if (idSel) idSel.value = "";
    root.querySelectorAll("[data-equip-hotspot]").forEach((sel) => {
      sel.value = "";
    });
  });
}
function collectEquipmentResponse(q) {
  const cfg = getEquipmentConfig(q);
  const state = readState3() || initialStateForConfig3(cfg);
  return { type: "equipment", kind: cfg?.kind, ...deepClone2(state) };
}
function markIdentify2(resp, answer) {
  const ok = resp.selectedId && resp.selectedId === answer.apparatusId;
  return {
    correct: ok,
    detail: ok ? "Apparatus identified correctly" : `Expected ${APPARATUS[answer.apparatusId]?.label || answer.apparatusId}`
  };
}
function markHotspots(resp, answer) {
  const expected = answer.labels || {};
  const got = resp.hotspotLabels || {};
  const keys = Object.keys(expected);
  const ok = keys.length > 0 && keys.every((k) => got[k] === expected[k] || got[String(k)] === expected[k]);
  return {
    correct: ok,
    detail: ok ? "All labels correct" : "One or more labels are incorrect"
  };
}
function markEquipmentResponse(q, resp, key, markPoints, cleanUrl) {
  const cfg = getEquipmentConfig(q);
  const max = q.max_marks || 1;
  const ao = { AO1: 0, AO2: 0, AO3: 0 };
  const maxAo = { AO1: max, AO2: 0, AO3: 0 };
  const answer = key?.key_payload || cfg?.answer || {};
  const kind = cfg?.kind || resp?.kind || answer.kind;
  let result = { correct: false, detail: "Unable to mark" };
  if (kind === "identify") result = markIdentify2(resp, answer);
  else if (kind === "label_hotspots") result = markHotspots(resp, answer);
  const total = result.correct ? max : 0;
  if (total) ao.AO1 = max;
  const missing = [];
  if (!result.correct) {
    const tip = answer.feedback || result.detail || "Check the apparatus names carefully.";
    missing.push({
      ao: "AO1",
      label: result.detail,
      feedback: tip,
      text: tip,
      flashcard_text: tip,
      resource_url: cleanUrl || null
    });
  }
  return {
    total,
    max,
    ao,
    maxAo,
    missing,
    quality: total ? 5 : 1,
    feedbackPayload: {
      missing,
      equipment: { student: resp, expected: answer, detail: result.detail }
    }
  };
}
function renderEquipmentModelAnswerHtml(expected, { title = "Model answer" } = {}) {
  let body = "";
  if (expected?.apparatusId) {
    body = `<p style="margin:0;">Correct: <strong>${escapeHtml3(APPARATUS[expected.apparatusId]?.label || expected.apparatusId)}</strong></p>`;
  } else if (expected?.labels) {
    body = `<ul style="margin:0;padding-left:18px;">${Object.entries(expected.labels).map(
      ([n, id]) => `<li>${escapeHtml3(n)}: ${escapeHtml3(APPARATUS[id]?.label || id)}</li>`
    ).join("")}</ul>`;
  }
  return `
    <div style="margin-top:12px;padding:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
      <strong>${escapeHtml3(title)}</strong>
      <div style="margin-top:8px;">${body}</div>
    </div>`;
}
var APPARATUS, APPARATUS_IDS, EQUIPMENT_PRESETS, _equipState;
var init_equipmentWorkflow = __esm({
  "src/equipmentWorkflow.js"() {
    init_diagramSvgUtils();
    APPARATUS = {
      // Chemistry / shared glassware
      beaker: {
        label: "Beaker",
        subjects: ["chemistry", "biology", "shared"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -28 -40 L -24 40 L 24 40 L 28 -40" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-28" y1="-40" x2="28" y2="-40" stroke="#0f172a" stroke-width="2"/>
        <line x1="-20" y1="10" x2="20" y2="10" stroke="#93c5fd" stroke-width="1.5"/>
      </g>`
      },
      conical_flask: {
        label: "Conical flask",
        subjects: ["chemistry"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -10 -42 L -10 -18 L -28 40 L 28 40 L 10 -18 L 10 -42 Z" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-10" y1="-42" x2="10" y2="-42" stroke="#0f172a" stroke-width="2"/>
        <ellipse cx="0" cy="28" rx="18" ry="6" fill="#bfdbfe" stroke="none" opacity="0.6"/>
      </g>`
      },
      measuring_cylinder: {
        label: "Measuring cylinder",
        subjects: ["chemistry", "physics", "biology", "shared"],
        draw: (x, y, s = 1) => {
          const left = -22;
          const right = 22;
          const y0 = 80;
          const pxPer = 4;
          const ticks = [];
          for (let v = 0; v <= 40; v++) {
            const ty = y0 - v * pxPer;
            let len = 6;
            let sw = 1;
            if (v % 10 === 0) {
              len = 16;
              sw = 2;
            } else if (v % 5 === 0) {
              len = 10;
              sw = 1.5;
            }
            ticks.push(
              `<line x1="${left}" y1="${ty}" x2="${left + len}" y2="${ty}" stroke-width="${sw}"/>`
            );
          }
          return `
      <g transform="translate(${x},${y}) scale(${s})">
        <g fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="${left}" y1="${y0 - 40 * pxPer - 4}" x2="${left}" y2="${y0}"/>
          <line x1="${right}" y1="${y0 - 40 * pxPer - 4}" x2="${right}" y2="${y0}"/>
          <line x1="${left - 6}" y1="${y0}" x2="${right + 6}" y2="${y0}"/>
        </g>
        <g stroke="#334155" stroke-linecap="round">
          ${ticks.join("\n          ")}
        </g>
        <g fill="#0f172a" font-family="system-ui,Segoe UI,sans-serif" font-size="9" font-weight="600" text-anchor="end">
          <text x="${left - 4}" y="${y0 - 10 * pxPer + 3}">10</text>
          <text x="${left - 4}" y="${y0 - 20 * pxPer + 3}">20</text>
          <text x="${left - 4}" y="${y0 - 30 * pxPer + 3}">30</text>
          <text x="${left - 4}" y="${y0 - 40 * pxPer + 3}">40</text>
        </g>
        <text x="0" y="${y0 - 40 * pxPer - 12}" fill="#64748b" font-family="system-ui,Segoe UI,sans-serif" font-size="8" text-anchor="middle">cm<tspan baseline-shift="super" font-size="6">3</tspan></text>
      </g>`;
        }
      },
      burette: {
        label: "Burette",
        subjects: ["chemistry"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-8" y="-50" width="16" height="70" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-6" y1="-30" x2="-2" y2="-30" stroke="#64748b" stroke-width="1"/>
        <line x1="-6" y1="-10" x2="-2" y2="-10" stroke="#64748b" stroke-width="1"/>
        <line x1="-6" y1="10" x2="-2" y2="10" stroke="#64748b" stroke-width="1"/>
        <rect x="-10" y="20" width="20" height="8" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="0" y1="28" x2="0" y2="48" stroke="#0f172a" stroke-width="2"/>
        <circle cx="0" cy="50" r="2" fill="#0f172a"/>
      </g>`
      },
      pipette: {
        label: "Pipette",
        subjects: ["chemistry", "biology"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <line x1="0" y1="-48" x2="0" y2="40" stroke="#0f172a" stroke-width="2"/>
        <ellipse cx="0" cy="-48" rx="8" ry="6" fill="none" stroke="#0f172a" stroke-width="2"/>
        <path d="M -4 28 L 0 48 L 4 28" fill="none" stroke="#0f172a" stroke-width="2"/>
        <ellipse cx="0" cy="0" rx="10" ry="14" fill="none" stroke="#0f172a" stroke-width="2"/>
      </g>`
      },
      volumetric_flask: {
        label: "Volumetric flask",
        subjects: ["chemistry"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -8 -48 L -8 -10 Q -32 10 -28 40 L 28 40 Q 32 10 8 -10 L 8 -48 Z" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-8" y1="-48" x2="8" y2="-48" stroke="#0f172a" stroke-width="2"/>
        <line x1="-22" y1="8" x2="22" y2="8" stroke="#64748b" stroke-width="1.5" stroke-dasharray="3 2"/>
      </g>`
      },
      test_tube: {
        label: "Test tube",
        subjects: ["chemistry", "biology", "shared"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -10 -40 L -10 28 Q -10 42 0 42 Q 10 42 10 28 L 10 -40 Z" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-10" y1="-40" x2="10" y2="-40" stroke="#0f172a" stroke-width="2"/>
      </g>`
      },
      boiling_tube: {
        label: "Boiling tube",
        subjects: ["chemistry", "biology"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -12 -44 L -12 30 Q -12 46 0 46 Q 12 46 12 30 L 12 -44 Z" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-12" y1="-44" x2="12" y2="-44" stroke="#0f172a" stroke-width="2"/>
      </g>`
      },
      funnel: {
        label: "Funnel",
        subjects: ["chemistry"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -28 -30 L 0 10 L 28 -30 Z" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="0" y1="10" x2="0" y2="44" stroke="#0f172a" stroke-width="2"/>
      </g>`
      },
      evaporating_basin: {
        label: "Evaporating basin",
        subjects: ["chemistry"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -36 -8 Q -36 28 0 28 Q 36 28 36 -8" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-36" y1="-8" x2="36" y2="-8" stroke="#0f172a" stroke-width="2"/>
      </g>`
      },
      bunsen_burner: {
        label: "Bunsen burner",
        subjects: ["chemistry"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-18" y="20" width="36" height="10" fill="none" stroke="#0f172a" stroke-width="2"/>
        <rect x="-6" y="-10" width="12" height="30" fill="none" stroke="#0f172a" stroke-width="2"/>
        <path d="M -4 -10 Q 0 -36 4 -10" fill="#fbbf24" stroke="#d97706" stroke-width="1.5"/>
        <circle cx="10" cy="8" r="4" fill="none" stroke="#0f172a" stroke-width="1.5"/>
      </g>`
      },
      tripod: {
        label: "Tripod",
        subjects: ["chemistry"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <line x1="-30" y1="-20" x2="30" y2="-20" stroke="#0f172a" stroke-width="2"/>
        <line x1="-30" y1="-20" x2="-34" y2="40" stroke="#0f172a" stroke-width="2"/>
        <line x1="0" y1="-20" x2="0" y2="40" stroke="#0f172a" stroke-width="2"/>
        <line x1="30" y1="-20" x2="34" y2="40" stroke="#0f172a" stroke-width="2"/>
      </g>`
      },
      gauze: {
        label: "Gauze",
        subjects: ["chemistry"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-32" y="-6" width="64" height="12" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-24" y1="-6" x2="-24" y2="6" stroke="#94a3b8" stroke-width="1"/>
        <line x1="-8" y1="-6" x2="-8" y2="6" stroke="#94a3b8" stroke-width="1"/>
        <line x1="8" y1="-6" x2="8" y2="6" stroke="#94a3b8" stroke-width="1"/>
        <line x1="24" y1="-6" x2="24" y2="6" stroke="#94a3b8" stroke-width="1"/>
      </g>`
      },
      gas_syringe: {
        label: "Gas syringe",
        subjects: ["chemistry"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-40" y="-12" width="70" height="24" fill="none" stroke="#0f172a" stroke-width="2" rx="2"/>
        <rect x="10" y="-8" width="28" height="16" fill="#e2e8f0" stroke="#0f172a" stroke-width="1.5"/>
        <line x1="38" y1="0" x2="52" y2="0" stroke="#0f172a" stroke-width="2"/>
        <line x1="-30" y1="-8" x2="-30" y2="8" stroke="#64748b" stroke-width="1"/>
        <line x1="-10" y1="-8" x2="-10" y2="8" stroke="#64748b" stroke-width="1"/>
      </g>`
      },
      thermometer: {
        label: "Thermometer",
        subjects: ["chemistry", "physics", "biology", "shared"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-4" y="-44" width="8" height="70" fill="none" stroke="#0f172a" stroke-width="2" rx="4"/>
        <circle cx="0" cy="36" r="10" fill="#ef4444" stroke="#0f172a" stroke-width="2"/>
        <line x1="0" y1="26" x2="0" y2="-20" stroke="#ef4444" stroke-width="2"/>
      </g>`
      },
      stand_clamp: {
        label: "Stand and clamp",
        subjects: ["chemistry", "physics"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-28" y="36" width="56" height="8" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-20" y1="36" x2="-20" y2="-44" stroke="#0f172a" stroke-width="3"/>
        <rect x="-20" y="-10" width="36" height="8" fill="none" stroke="#0f172a" stroke-width="2"/>
        <circle cx="20" cy="-6" r="6" fill="none" stroke="#0f172a" stroke-width="2"/>
      </g>`
      },
      chromatography_tank: {
        label: "Chromatography tank",
        subjects: ["chemistry"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-36" y="-36" width="72" height="72" fill="none" stroke="#0f172a" stroke-width="2" rx="2"/>
        <line x1="-28" y1="24" x2="28" y2="24" stroke="#93c5fd" stroke-width="3"/>
        <line x1="0" y1="-28" x2="0" y2="24" stroke="#64748b" stroke-width="1.5"/>
        <circle cx="0" cy="8" r="3" fill="#7c3aed"/>
        <circle cx="0" cy="-4" r="3" fill="#2563eb"/>
      </g>`
      },
      pestle_mortar: {
        label: "Pestle and mortar",
        subjects: ["chemistry", "biology"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -32 8 Q -32 36 0 36 Q 32 36 32 8" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-32" y1="8" x2="32" y2="8" stroke="#0f172a" stroke-width="2"/>
        <line x1="8" y1="0" x2="28" y2="-28" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
      </g>`
      },
      spatula: {
        label: "Spatula",
        subjects: ["chemistry"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <line x1="-40" y1="0" x2="20" y2="0" stroke="#0f172a" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="30" cy="0" rx="12" ry="6" fill="none" stroke="#0f172a" stroke-width="2"/>
      </g>`
      },
      teat_pipette: {
        label: "Teat pipette",
        subjects: ["chemistry", "biology"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <ellipse cx="0" cy="-36" rx="10" ry="12" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="0" y1="-24" x2="0" y2="40" stroke="#0f172a" stroke-width="2"/>
        <path d="M -3 32 L 0 44 L 3 32" fill="none" stroke="#0f172a" stroke-width="1.5"/>
      </g>`
      },
      // Biology
      microscope: {
        label: "Light microscope",
        subjects: ["biology"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-24" y="28" width="48" height="12" fill="none" stroke="#0f172a" stroke-width="2"/>
        <path d="M -8 28 L -8 -8 L 8 -8 L 8 28" fill="none" stroke="#0f172a" stroke-width="2"/>
        <circle cx="0" cy="-20" r="12" fill="none" stroke="#0f172a" stroke-width="2"/>
        <circle cx="0" cy="-20" r="5" fill="none" stroke="#0f172a" stroke-width="1.5"/>
        <rect x="-6" y="-8" width="12" height="16" fill="none" stroke="#0f172a" stroke-width="1.5"/>
        <line x1="8" y1="4" x2="22" y2="4" stroke="#0f172a" stroke-width="2"/>
      </g>`
      },
      slide: {
        label: "Microscope slide",
        subjects: ["biology"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-40" y="-12" width="80" height="24" fill="#e0f2fe" stroke="#0f172a" stroke-width="2" rx="2"/>
        <rect x="-10" y="-8" width="20" height="16" fill="none" stroke="#64748b" stroke-width="1.5"/>
      </g>`
      },
      petri_dish: {
        label: "Petri dish",
        subjects: ["biology"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <ellipse cx="0" cy="4" rx="36" ry="16" fill="#fef3c7" stroke="#0f172a" stroke-width="2"/>
        <ellipse cx="0" cy="-4" rx="36" ry="16" fill="none" stroke="#0f172a" stroke-width="2"/>
        <circle cx="-8" cy="0" r="4" fill="none" stroke="#16a34a" stroke-width="1.5"/>
        <circle cx="10" cy="2" r="5" fill="none" stroke="#16a34a" stroke-width="1.5"/>
      </g>`
      },
      syringe: {
        label: "Syringe",
        subjects: ["biology", "chemistry"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-36" y="-10" width="60" height="20" fill="none" stroke="#0f172a" stroke-width="2" rx="2"/>
        <rect x="8" y="-6" width="24" height="12" fill="#e2e8f0" stroke="#0f172a" stroke-width="1.5"/>
        <line x1="32" y1="0" x2="44" y2="0" stroke="#0f172a" stroke-width="2"/>
        <line x1="-36" y1="0" x2="-48" y2="0" stroke="#0f172a" stroke-width="2"/>
      </g>`
      },
      forceps: {
        label: "Forceps",
        subjects: ["biology"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -30 -20 Q 0 0 -30 20" fill="none" stroke="#0f172a" stroke-width="2"/>
        <path d="M -24 -16 Q 4 0 -24 16" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="0" y1="0" x2="36" y2="0" stroke="#0f172a" stroke-width="2"/>
      </g>`
      },
      quadrat: {
        label: "Quadrat",
        subjects: ["biology"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-36" y="-36" width="72" height="72" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="-12" y1="-36" x2="-12" y2="36" stroke="#94a3b8" stroke-width="1"/>
        <line x1="12" y1="-36" x2="12" y2="36" stroke="#94a3b8" stroke-width="1"/>
        <line x1="-36" y1="-12" x2="36" y2="-12" stroke="#94a3b8" stroke-width="1"/>
        <line x1="-36" y1="12" x2="36" y2="12" stroke="#94a3b8" stroke-width="1"/>
      </g>`
      },
      stopwatch: {
        label: "Stopwatch",
        subjects: ["biology", "physics", "chemistry", "shared"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <circle cx="0" cy="4" r="28" fill="none" stroke="#0f172a" stroke-width="2"/>
        <circle cx="0" cy="4" r="3" fill="#0f172a"/>
        <line x1="0" y1="4" x2="0" y2="-14" stroke="#0f172a" stroke-width="2"/>
        <line x1="0" y1="4" x2="14" y2="12" stroke="#0f172a" stroke-width="2"/>
        <rect x="-6" y="-32" width="12" height="8" fill="none" stroke="#0f172a" stroke-width="1.5"/>
      </g>`
      },
      ruler: {
        label: "Metre rule / ruler",
        subjects: ["physics", "biology", "shared"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-50" y="-10" width="100" height="20" fill="#fef3c7" stroke="#0f172a" stroke-width="2"/>
        <line x1="-40" y1="-10" x2="-40" y2="-2" stroke="#0f172a" stroke-width="1"/>
        <line x1="-20" y1="-10" x2="-20" y2="-2" stroke="#0f172a" stroke-width="1"/>
        <line x1="0" y1="-10" x2="0" y2="0" stroke="#0f172a" stroke-width="1.5"/>
        <line x1="20" y1="-10" x2="20" y2="-2" stroke="#0f172a" stroke-width="1"/>
        <line x1="40" y1="-10" x2="40" y2="-2" stroke="#0f172a" stroke-width="1"/>
      </g>`
      },
      // Physics
      power_supply: {
        label: "Power supply",
        subjects: ["physics"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-40" y="-24" width="80" height="48" fill="none" stroke="#0f172a" stroke-width="2" rx="4"/>
        <text x="0" y="4" text-anchor="middle" font-size="11" font-weight="700" fill="#0f172a" font-family="system-ui,sans-serif">PSU</text>
        <circle cx="-22" cy="0" r="5" fill="none" stroke="#dc2626" stroke-width="2"/>
        <circle cx="22" cy="0" r="5" fill="none" stroke="#000" stroke-width="2"/>
      </g>`
      },
      physical_ammeter: {
        label: "Ammeter (instrument)",
        subjects: ["physics"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-28" y="-20" width="56" height="40" fill="none" stroke="#0f172a" stroke-width="2" rx="4"/>
        <circle cx="0" cy="0" r="12" fill="none" stroke="#0f172a" stroke-width="2"/>
        <text x="0" y="4" text-anchor="middle" font-size="12" font-weight="700" fill="#0f172a" font-family="system-ui,sans-serif">A</text>
      </g>`
      },
      physical_voltmeter: {
        label: "Voltmeter (instrument)",
        subjects: ["physics"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-28" y="-20" width="56" height="40" fill="none" stroke="#0f172a" stroke-width="2" rx="4"/>
        <circle cx="0" cy="0" r="12" fill="none" stroke="#0f172a" stroke-width="2"/>
        <text x="0" y="4" text-anchor="middle" font-size="12" font-weight="700" fill="#0f172a" font-family="system-ui,sans-serif">V</text>
      </g>`
      },
      ray_box: {
        label: "Ray box",
        subjects: ["physics"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-30" y="-16" width="40" height="32" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="10" y1="0" x2="48" y2="0" stroke="#fbbf24" stroke-width="3"/>
        <line x1="10" y1="-8" x2="44" y2="-16" stroke="#fbbf24" stroke-width="2"/>
        <line x1="10" y1="8" x2="44" y2="16" stroke="#fbbf24" stroke-width="2"/>
      </g>`
      },
      spring: {
        label: "Spring",
        subjects: ["physics"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M 0 -40 L 0 -28 Q 12 -24 0 -16 Q -12 -8 0 0 Q 12 8 0 16 Q -12 24 0 32 L 0 44" fill="none" stroke="#0f172a" stroke-width="2"/>
      </g>`
      },
      newton_meter: {
        label: "Newton meter",
        subjects: ["physics"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-12" y="-40" width="24" height="60" fill="none" stroke="#0f172a" stroke-width="2" rx="2"/>
        <line x1="-8" y1="-20" x2="8" y2="-20" stroke="#64748b" stroke-width="1"/>
        <line x1="-8" y1="0" x2="8" y2="0" stroke="#64748b" stroke-width="1"/>
        <path d="M 0 20 L 0 40 Q -6 48 0 52" fill="none" stroke="#0f172a" stroke-width="2"/>
        <text x="0" y="-26" text-anchor="middle" font-size="8" fill="#0f172a" font-family="system-ui,sans-serif">N</text>
      </g>`
      },
      trolley: {
        label: "Trolley",
        subjects: ["physics"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-36" y="-12" width="72" height="24" fill="none" stroke="#0f172a" stroke-width="2" rx="2"/>
        <circle cx="-20" cy="16" r="8" fill="none" stroke="#0f172a" stroke-width="2"/>
        <circle cx="20" cy="16" r="8" fill="none" stroke="#0f172a" stroke-width="2"/>
      </g>`
      },
      ramp: {
        label: "Ramp",
        subjects: ["physics"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <path d="M -48 24 L 48 24 L 48 16 L -48 -24 Z" fill="#f1f5f9" stroke="#0f172a" stroke-width="2"/>
      </g>`
      },
      balance: {
        label: "Balance / scales",
        subjects: ["physics", "chemistry"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-32" y="8" width="64" height="20" fill="none" stroke="#0f172a" stroke-width="2" rx="2"/>
        <rect x="-24" y="-16" width="48" height="24" fill="none" stroke="#0f172a" stroke-width="2"/>
        <text x="0" y="0" text-anchor="middle" font-size="10" fill="#0f172a" font-family="system-ui,sans-serif">0.00</text>
      </g>`
      },
      oscilloscope: {
        label: "Oscilloscope",
        subjects: ["physics"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-40" y="-28" width="80" height="56" fill="none" stroke="#0f172a" stroke-width="2" rx="4"/>
        <rect x="-32" y="-20" width="48" height="36" fill="#0f172a" stroke="#0f172a" stroke-width="1"/>
        <path d="M -28 0 Q -20 -12 -12 0 Q -4 12 4 0 Q 12 -12 20 0" fill="none" stroke="#4ade80" stroke-width="2"/>
        <circle cx="28" cy="-8" r="4" fill="none" stroke="#0f172a" stroke-width="1.5"/>
        <circle cx="28" cy="8" r="4" fill="none" stroke="#0f172a" stroke-width="1.5"/>
      </g>`
      },
      microphone: {
        label: "Microphone",
        subjects: ["physics"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-12" y="-28" width="24" height="36" rx="12" fill="none" stroke="#0f172a" stroke-width="2"/>
        <path d="M -18 0 Q -18 20 0 24 Q 18 20 18 0" fill="none" stroke="#0f172a" stroke-width="2"/>
        <line x1="0" y1="24" x2="0" y2="40" stroke="#0f172a" stroke-width="2"/>
        <line x1="-12" y1="40" x2="12" y2="40" stroke="#0f172a" stroke-width="2"/>
      </g>`
      },
      loudspeaker: {
        label: "Loudspeaker",
        subjects: ["physics"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-24" y="-16" width="20" height="32" fill="none" stroke="#0f172a" stroke-width="2"/>
        <path d="M -4 -16 L 24 -32 L 24 32 L -4 16 Z" fill="none" stroke="#0f172a" stroke-width="2"/>
      </g>`
      },
      radiation_absorber: {
        label: "Radiation absorber",
        subjects: ["physics"],
        draw: (x, y, s = 1) => `
      <g transform="translate(${x},${y}) scale(${s})">
        <rect x="-28" y="-36" width="16" height="72" fill="#cbd5e1" stroke="#0f172a" stroke-width="2"/>
        <rect x="-4" y="-36" width="16" height="72" fill="#94a3b8" stroke="#0f172a" stroke-width="2"/>
        <rect x="20" y="-36" width="16" height="72" fill="#64748b" stroke="#0f172a" stroke-width="2"/>
      </g>`
      }
    };
    APPARATUS_IDS = Object.keys(APPARATUS);
    EQUIPMENT_PRESETS = {
      identify_beaker: {
        label: "Identify: beaker",
        kind: "identify",
        template: { items: [{ apparatusId: "beaker", x: 140, y: 90 }], width: 280, height: 180 },
        answer: { kind: "identify", apparatusId: "beaker" }
      },
      identify_burette: {
        label: "Identify: burette",
        kind: "identify",
        template: { items: [{ apparatusId: "burette", x: 140, y: 90 }], width: 280, height: 200 },
        answer: { kind: "identify", apparatusId: "burette" }
      },
      identify_microscope: {
        label: "Identify: light microscope",
        kind: "identify",
        template: { items: [{ apparatusId: "microscope", x: 140, y: 90 }], width: 280, height: 200 },
        answer: { kind: "identify", apparatusId: "microscope" }
      },
      identify_ray_box: {
        label: "Identify: ray box",
        kind: "identify",
        template: { items: [{ apparatusId: "ray_box", x: 140, y: 90 }], width: 280, height: 180 },
        answer: { kind: "identify", apparatusId: "ray_box" }
      },
      identify_spring: {
        label: "Identify: spring",
        kind: "identify",
        template: { items: [{ apparatusId: "spring", x: 140, y: 90 }], width: 280, height: 200 },
        answer: { kind: "identify", apparatusId: "spring" }
      },
      identify_quadrat: {
        label: "Identify: quadrat",
        kind: "identify",
        template: { items: [{ apparatusId: "quadrat", x: 140, y: 90 }], width: 280, height: 200 },
        answer: { kind: "identify", apparatusId: "quadrat" }
      },
      titration_setup: {
        label: "RP: titration apparatus (label)",
        kind: "label_hotspots",
        template: {
          width: 420,
          height: 220,
          items: [
            { apparatusId: "burette", x: 100, y: 100, hotspot: 1 },
            { apparatusId: "conical_flask", x: 220, y: 120, hotspot: 2 },
            { apparatusId: "stand_clamp", x: 340, y: 100, hotspot: 3 }
          ]
        },
        answer: {
          kind: "label_hotspots",
          labels: { 1: "burette", 2: "conical_flask", 3: "stand_clamp" }
        }
      },
      microscope_setup: {
        label: "RP: microscope + slide (label)",
        kind: "label_hotspots",
        template: {
          width: 360,
          height: 200,
          items: [
            { apparatusId: "microscope", x: 110, y: 100, hotspot: 1 },
            { apparatusId: "slide", x: 260, y: 100, hotspot: 2 }
          ]
        },
        answer: {
          kind: "label_hotspots",
          labels: { 1: "microscope", 2: "slide" }
        }
      },
      spring_extension: {
        label: "RP: spring extension (label)",
        kind: "label_hotspots",
        template: {
          width: 360,
          height: 220,
          items: [
            { apparatusId: "stand_clamp", x: 90, y: 100, hotspot: 1 },
            { apparatusId: "spring", x: 200, y: 100, hotspot: 2 },
            { apparatusId: "ruler", x: 300, y: 100, hotspot: 3 }
          ]
        },
        answer: {
          kind: "label_hotspots",
          labels: { 1: "stand_clamp", 2: "spring", 3: "ruler" }
        }
      },
      iv_bench: {
        label: "RP: I\u2013V bench instruments",
        kind: "label_hotspots",
        template: {
          width: 400,
          height: 200,
          items: [
            { apparatusId: "power_supply", x: 90, y: 100, hotspot: 1 },
            { apparatusId: "physical_ammeter", x: 210, y: 100, hotspot: 2 },
            { apparatusId: "physical_voltmeter", x: 320, y: 100, hotspot: 3 }
          ]
        },
        answer: {
          kind: "label_hotspots",
          labels: { 1: "power_supply", 2: "physical_ammeter", 3: "physical_voltmeter" }
        }
      }
    };
    _equipState = null;
  }
});

// src/lazyEquipmentWorkflow.js
var lazyEquipmentWorkflow_exports = {};
__export(lazyEquipmentWorkflow_exports, {
  loadEquipmentWorkflow: () => loadEquipmentWorkflow
});
function loadEquipmentWorkflow() {
  if (!equipmentWorkflowPromise) {
    equipmentWorkflowPromise = Promise.resolve().then(() => (init_equipmentWorkflow(), equipmentWorkflow_exports));
  }
  return equipmentWorkflowPromise;
}
var equipmentWorkflowPromise;
var init_lazyEquipmentWorkflow = __esm({
  "src/lazyEquipmentWorkflow.js"() {
    equipmentWorkflowPromise = null;
  }
});

// src/evalEngine.js
init_utils();

// src/lazyCalculationWorkflow.js
var calculationWorkflowPromise = null;
function loadCalculationWorkflow() {
  if (!calculationWorkflowPromise) {
    calculationWorkflowPromise = Promise.resolve().then(() => (init_calculationWorkflow(), calculationWorkflow_exports));
  }
  return calculationWorkflowPromise;
}

// src/evalEngine.js
var MCQ_FLASHCARD_ADDED_MSG = "This question has been added to your flashcard list.";
var LEGACY_FLASHCARD_REVIEW_SUFFIX = / Review your flashcards for this specific unit or definition\.?$/i;
function formatAnswerLabel(answer) {
  return String(answer || "").replace(/\|/g, " / ").trim();
}
function looksLikeInlineMath(text) {
  const s = String(text || "");
  return /\$[^$]+\$/.test(s) || /\\\(/.test(s) || /\\ce\{/.test(s);
}
function formatFlashcardAnswerDisplay(answer) {
  let s = formatAnswerLabel(answer);
  if (!s || looksLikeInlineMath(s)) return s;
  const letterMatch = s.match(/^([A-Za-z]\.)\s+(.*)$/);
  let prefix = "";
  let body = s;
  if (letterMatch) {
    prefix = `${letterMatch[1]} `;
    body = letterMatch[2].trim();
  }
  if (!body || looksLikeInlineMath(body)) return s;
  if (/^[\d.+−\-×x/^eE\s]+$/.test(body)) return prefix + body;
  if (/^[a-z]/.test(body)) {
    body = body.charAt(0).toUpperCase() + body.slice(1);
  }
  if (!/[.!?]$/.test(body)) body += ".";
  return prefix + body;
}
function formatMcqAnswerWithLetter(options, answerText) {
  const answer = formatAnswerLabel(answerText).replace(/^[A-Za-z]\.\s+/, "");
  if (!answer) return "";
  const opts = Array.isArray(options) ? options : [];
  const idx = opts.findIndex((opt) => String(opt).trim() === answer);
  if (idx < 0) return formatFlashcardAnswerDisplay(answer);
  return formatFlashcardAnswerDisplay(`${String.fromCharCode(65 + idx)}. ${answer}`);
}
function formatAnswerFlashcard(answer, explanation = "") {
  const answerLabel = formatFlashcardAnswerDisplay(answer);
  const explain = String(explanation || "").trim();
  if (answerLabel && explain) {
    const bare = answerLabel.replace(/^[A-Za-z]\.\s+/, "").replace(/[.!?]$/, "");
    const explainHasAnswer = explain.toLowerCase().includes(bare.toLowerCase());
    return explainHasAnswer ? explain : `${answerLabel}

${explain}`;
  }
  return answerLabel || explain;
}
function splitFlashcardInsight(m = {}, options = null) {
  let answer = formatAnswerLabel(m?.answer_label || m?.answer || m?.point_text || "");
  if (options) answer = formatMcqAnswerWithLetter(options, answer);
  let explanation = "";
  const flashcardText = String(m?.flashcard_text || "").trim();
  if (flashcardText) {
    const parts = flashcardText.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
    if (!answer && parts.length) {
      answer = options ? formatMcqAnswerWithLetter(options, parts[0]) : parts[0];
      explanation = parts.slice(1).join("\n\n");
    } else if (answer && parts.length) {
      const answerBare = answer.replace(/^[A-Za-z]\.\s+/, "").replace(/[.!?]$/, "").toLowerCase();
      explanation = parts.filter((p) => {
        const bare = p.replace(/^[A-Za-z]\.\s+/, "").replace(/[.!?]$/, "").toLowerCase();
        return bare !== answerBare && bare !== answer.toLowerCase();
      }).join("\n\n");
    }
  }
  if (!explanation) {
    let text = m?.text || m?.feedback || m?.label || "";
    text = text.replace(LEGACY_FLASHCARD_REVIEW_SUFFIX, "");
    text = text.replace(new RegExp(`\\s*${MCQ_FLASHCARD_ADDED_MSG.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`), "");
    text = text.trim();
    const answerBare = answer.replace(/^[A-Za-z]\.\s+/, "").replace(/[.!?]$/, "").toLowerCase();
    if (text && (!answer || !text.toLowerCase().includes(answerBare))) {
      explanation = text;
    } else if (text && !answer) {
      answer = text;
    }
  }
  if (!answer && options?.length) {
    const hay = `${flashcardText}
${m?.text || ""}`;
    const quoted = hay.match(/The correct answer is\s+"([^"]+)"/i) || hay.match(/The correct answer is\s+(\S.+?)\.?$/im);
    if (quoted?.[1]) answer = formatMcqAnswerWithLetter(options, quoted[1]);
    else {
      const hit = options.find((opt) => hay.includes(String(opt)));
      if (hit) answer = formatMcqAnswerWithLetter(options, hit);
    }
  }
  answer = formatFlashcardAnswerDisplay(answer);
  return {
    answer: answer || "",
    explanation: explanation || "",
    text: answer && explanation ? `${answer}

${explanation}` : answer || explanation
  };
}
function flashcardInsightFromMissing(m) {
  const split = splitFlashcardInsight(m);
  return split.text.trim();
}
function cleanMcqFeedbackText(text) {
  return String(text || "").replace(LEGACY_FLASHCARD_REVIEW_SUFFIX, "").trim();
}
function getMcqTargetAo(q, markPoints) {
  const ao2 = Number(q?.ao2_marks) || 0;
  const ao3 = Number(q?.ao3_marks) || 0;
  const ao1 = Number(q?.ao1_marks) || 0;
  if (ao2 > 0) return "AO2";
  if (ao3 > 0) return "AO3";
  if (ao1 > 0) return "AO1";
  if (markPoints?.[0]?.ao) return markPoints[0].ao;
  return "AO1";
}
function applyMcqMaxAoFromQuestion(q, max, maxAo) {
  const hasStored = q.ao1_marks != null || q.ao2_marks != null || q.ao3_marks != null;
  if (hasStored) {
    maxAo.AO1 = Number(q.ao1_marks) || 0;
    maxAo.AO2 = Number(q.ao2_marks) || 0;
    maxAo.AO3 = Number(q.ao3_marks) || 0;
    return;
  }
  maxAo.AO1 = max;
}
function resolveMcqWrongFeedback(selectedAnswer, key, markPoints, targetCorrect, cleanUrl = null, targetAo = "AO1", options = null) {
  const optionFeedback = key?.key_payload?.option_feedback || {};
  const specificText = cleanMcqFeedbackText(optionFeedback[selectedAnswer]);
  const genericText = cleanMcqFeedbackText(markPoints?.[0]?.feedback_if_missing);
  const fallbackText = looksLikeInlineMath(targetCorrect) ? `The correct answer is ${targetCorrect}.` : `The correct answer is "${targetCorrect}".`;
  const imageUrl = markPoints?.[0]?.image_url || "";
  const answerLabel = formatMcqAnswerWithLetter(options, targetCorrect) || formatFlashcardAnswerDisplay(targetCorrect);
  const contentBlocks = [];
  if (specificText) contentBlocks.push(specificText);
  if (genericText && genericText !== specificText) contentBlocks.push(genericText);
  if (!contentBlocks.length) contentBlocks.push(fallbackText);
  const flashcardExplain = genericText || "";
  const combinedFlashcard = flashcardExplain ? formatAnswerFlashcard(answerLabel, flashcardExplain) : answerLabel || fallbackText;
  const missing = contentBlocks.map((blockText, index) => ({
    ao: targetAo,
    text: index === 0 ? `${blockText} ${MCQ_FLASHCARD_ADDED_MSG}` : blockText,
    flashcard_text: index === 0 ? combinedFlashcard : void 0,
    answer: targetCorrect || void 0,
    answer_label: answerLabel || void 0,
    url: cleanUrl,
    image_url: index === 0 ? imageUrl : ""
  }));
  return missing;
}
function getLevenshteinDistance(s1, s2) {
  const track = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }
  return track[s2.length][s1.length];
}
function isFuzzyMatch(userWord, targetKeyword, threshold = 0.85) {
  const w1 = userWord.toLowerCase().trim();
  const w2 = targetKeyword.toLowerCase().trim();
  if (w1 === w2) return true;
  if (w1.length === 0 || w2.length === 0) return false;
  const distance = getLevenshteinDistance(w1, w2);
  const maxLength = Math.max(w1.length, w2.length);
  const similarity = 1 - distance / maxLength;
  return similarity >= threshold;
}
function parseKeywordExpression(expr) {
  if (!expr?.trim()) return [];
  return expr.split(",").map((s) => s.trim()).filter(Boolean);
}
function isShellConfigKeyword(expr) {
  if (!expr?.trim()) return false;
  return expr.split("|").every((part) => /^[\d\s,.]+$/.test(part.trim()) && /\d/.test(part));
}
function normalizeShellConfig(text) {
  const nums = String(text || "").match(/\d+/g);
  return nums ? nums.join(",") : "";
}
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function synonymRegex(syn) {
  const escaped = escapeRegExp(syn.trim().toLowerCase());
  if (syn.includes(" ")) {
    return new RegExp(escaped.replace(/\s+/g, "\\s+"), "i");
  }
  return new RegExp(`\\b${escaped}\\b`, "i");
}
function checkSynonymGroupMatch(groupExpr, studentWords, rawText) {
  if (!groupExpr) return false;
  const synonyms = groupExpr.split("|").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const lowerRawText = rawText.toLowerCase();
  const cleanRaw = lowerRawText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, " ").replace(/\s+/g, " ").trim();
  const negations = ["not", "no", "without", "never", "zero"];
  return synonyms.some((syn) => {
    const synIndex = lowerRawText.search(synonymRegex(syn));
    if (synIndex !== -1) {
      const lookbackStart = Math.max(0, synIndex - 15);
      const contextualSnippet = lowerRawText.substring(lookbackStart, synIndex);
      const isNegated = negations.some((neg) => {
        const regex = new RegExp(`\\b${neg}\\b`);
        return regex.test(contextualSnippet);
      });
      if (isNegated) return false;
    }
    if (cleanRaw.includes(syn)) return true;
    return studentWords.some((userWord) => isFuzzyMatch(userWord, syn, 0.85));
  });
}
function checkKeywordOrSynonymsMatch(targetExpr, studentWords, rawText) {
  if (!targetExpr) return false;
  if (isShellConfigKeyword(targetExpr)) {
    const studentNorm = normalizeShellConfig(rawText);
    if (!studentNorm) return false;
    return targetExpr.split("|").map((s) => normalizeShellConfig(s)).some((n) => n && n === studentNorm);
  }
  const groups = parseKeywordExpression(targetExpr);
  return groups.every((group) => checkSynonymGroupMatch(group, studentWords, rawText));
}
function findStudentAnswerHighlights(rawText, allTargetKeywords) {
  if (!rawText?.trim() || !allTargetKeywords?.length) return [];
  const cleanStudentText = rawText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  const studentWords = cleanStudentText.split(/\s+/).filter(Boolean);
  const highlights = [];
  const addRange = (start, end, type, match) => {
    if (start < 0 || end <= start || end > rawText.length) return;
    const overlaps = highlights.some((h) => start < h.end && end > h.start);
    if (!overlaps) highlights.push({ start, end, type, match });
  };
  for (const targetExpr of allTargetKeywords) {
    for (const group of parseKeywordExpression(targetExpr)) {
      const synonyms = group.split("|").map((s) => s.trim()).filter(Boolean);
      for (const syn of synonyms) {
        const synLower = syn.toLowerCase();
        const re = synonymRegex(syn);
        const match = re.exec(rawText);
        if (match) {
          addRange(match.index, match.index + match[0].length, "exact", synLower);
          break;
        }
        const fuzzyWord = studentWords.find((w) => isFuzzyMatch(w, synLower, 0.85));
        if (fuzzyWord) {
          const wordRe = new RegExp(`\\b${escapeRegExp(fuzzyWord)}\\b`, "i");
          const fuzzyMatch = wordRe.exec(rawText);
          if (fuzzyMatch) {
            addRange(fuzzyMatch.index, fuzzyMatch.index + fuzzyMatch[0].length, "fuzzy", synLower);
            break;
          }
        }
      }
    }
  }
  return highlights.sort((a, b) => a.start - b.start);
}
function renderHighlightedStudentAnswer(rawText, allTargetKeywords) {
  const highlights = findStudentAnswerHighlights(rawText, allTargetKeywords);
  if (!highlights.length) return escapeHtml(rawText);
  const parts = [];
  let cursor = 0;
  for (const highlight of highlights) {
    if (highlight.start > cursor) {
      parts.push(escapeHtml(rawText.slice(cursor, highlight.start)));
    }
    const slice = rawText.slice(highlight.start, highlight.end);
    if (highlight.type === "exact") {
      parts.push(
        `<span class="match-exact" title="Exact match for: ${escapeHtml(highlight.match)}">${escapeHtml(slice)}</span>`
      );
    } else {
      parts.push(
        `<span class="match-fuzzy" style="background-color: #fff7ed; color: #9a3412; border-bottom: 2px solid #f97316;" title="Spelling correction target: ${escapeHtml(highlight.match)}">${escapeHtml(slice)} <b style="font-weight:700;">[spelling: ${escapeHtml(highlight.match)}]</b></span>`
      );
    }
    cursor = highlight.end;
  }
  if (cursor < rawText.length) {
    parts.push(escapeHtml(rawText.slice(cursor)));
  }
  return parts.join("");
}
function updateSRS({ quality, ef, reps, interval, caps = null }) {
  let newEF = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  let newReps = reps;
  let newInterval = interval;
  let lapse = 0;
  if (caps) {
    const floor = caps.efFloor ?? 1.3;
    const ceil = caps.efCeil ?? Infinity;
    newEF = Math.min(ceil, Math.max(floor, newEF));
  }
  if (quality < 3) {
    newReps = 0;
    newInterval = 1;
    lapse = 1;
  } else {
    newReps = reps + 1;
    if (newReps === 1) {
      newInterval = 1;
    } else if (newReps === 2) {
      newInterval = 6;
    } else {
      let mult = newEF;
      if (caps && caps.softGrowthAfterReps != null && newReps >= caps.softGrowthAfterReps && caps.softGrowthMult != null) {
        mult = Math.min(newEF, caps.softGrowthMult);
      }
      newInterval = Math.round(interval * mult);
    }
  }
  if (caps?.maxInterval != null) {
    newInterval = Math.min(newInterval, caps.maxInterval);
  }
  return { newEF, newReps, newInterval, lapse };
}
function computeSessionQuality(qualities) {
  if (!qualities.length) return 0;
  const passCount = qualities.filter((q) => q >= 3).length;
  const rate = passCount / qualities.length;
  if (rate >= 0.9) return 5;
  if (rate >= 0.7) return 4;
  if (rate >= 0.5) return 3;
  if (rate >= 0.25) return 1;
  return 0;
}
var PUNCTUATION_STRIP = /[.,\/#!$%\^&\*;:{}=\-_`~()?]/g;
function getTipHtmlForCommandWord(word) {
  if (word === "describe") {
    return `
      <div class="exam-tip exam-tip--describe">
        <strong>\u{1F4CB} AQA GCSE Examiner Tip (DESCRIBE)</strong><br/>
        Give a detailed account of facts, characteristics, steps, or features. <strong>Do not explain why!</strong> State <em>what</em> happens or <em>how</em> a practical procedure is done without adding underlying scientific theory.
      </div>
    `;
  }
  if (word === "explain") {
    return `
      <div class="exam-tip exam-tip--explain">
        <strong>\u{1F4CB} AQA GCSE Examiner Tip (EXPLAIN)</strong><br/>
        Set out purposes or reasons. You must use scientific relationships and theory. Structure your statements with explicit logical connectors like <strong>"because..."</strong>, <strong>"this means that..."</strong>, or <strong>"consequently..."</strong> to claim your marks.
      </div>
    `;
  }
  if (word === "evaluate") {
    return `
      <div class="exam-tip exam-tip--evaluate">
        <strong>\u{1F4CB} AQA GCSE Examiner Tip (EVALUATE)</strong><br/>
        Make a qualitative judgement based on available facts or data criteria. You must explicitly provide <strong>advantages (pros)</strong>, <strong>disadvantages (cons)</strong>, and finish with a clear, justified <strong>conclusion</strong>.
      </div>
    `;
  }
  if (word === "calculate") {
    return `
      <div class="exam-tip exam-tip--calculate">
        <strong>\u{1F4CB} AQA GCSE Examiner Tip (CALCULATE)</strong><br/>
        Find a numerical answer. You must <strong>show every step of your working out</strong>. Always check if unit conversions are needed first, recall/rearrange the formula, insert values, and state the correct <strong>units</strong>.
      </div>
    `;
  }
  if (word === "compare") {
    return `
      <div class="exam-tip exam-tip--compare">
        <strong>\u{1F4CB} AQA GCSE Examiner Tip (COMPARE)</strong><br/>
        Identify the similarities and/or differences between two or more items. Ensure you describe <strong>both variables</strong> across the comparison instead of just describing one of them in isolation.
      </div>
    `;
  }
  if (word === "state" || word === "name") {
    return `
      <div class="exam-tip exam-tip--state">
        <strong>\u{1F4CB} AQA GCSE Examiner Tip (${word.toUpperCase()})</strong><br/>
        Provide a concise, factual answer without any background explanation or computation. Keep your response short, precise, and directly focused on the required keyword, fact, or definition.
      </div>
    `;
  }
  if (word === "suggest") {
    return `
      <div class="exam-tip exam-tip--suggest">
        <strong>\u{1F4CB} AQA GCSE Examiner Tip (SUGGEST)</strong><br/>
        Apply your scientific knowledge to a novel or unfamiliar situation. There is often more than one acceptable logical path here, so deduce a reasoned, scientifically valid hypothesis or explanation.
      </div>
    `;
  }
  if (word === "discuss") {
    return `
      <div class="exam-tip exam-tip--discuss">
        <strong>\u{1F4CB} AQA GCSE Examiner Tip (DISCUSS)</strong><br/>
        Write about the key issues, theories, or observations surrounding the topic. Explore different scientific perspectives or factors (e.g., biological impacts vs. environmental costs) balanced evenly.
      </div>
    `;
  }
  if (word === "justify") {
    return `
      <div class="exam-tip exam-tip--justify">
        <strong>\u{1F4CB} AQA GCSE Examiner Tip (JUSTIFY)</strong><br/>
        Provide evidence, data points, or robust theoretical reasoning to support a previously stated answer, choice, or experimental conclusion.
      </div>
    `;
  }
  if (word === "determine") {
    return `
      <div class="exam-tip exam-tip--determine">
        <strong>\u{1F4CB} AQA GCSE Examiner Tip (DETERMINE)</strong><br/>
        Use the data provided in the prompt, or quantitative evidence from a graph/table, to calculate or logically establish the single correct value or conclusion.
      </div>
    `;
  }
  if (word === "define") {
    return `
      <div class="exam-tip exam-tip--define">
        <strong>\u{1F4CB} AQA GCSE Examiner Tip (DEFINE)</strong><br/>
        State the exact scientific meaning of a word, term, or physical quantity. Use precise specification keywords to ensure full credit.
      </div>
    `;
  }
  return "";
}
function isKnownCommandWord(word) {
  return Boolean(word && getTipHtmlForCommandWord(word));
}
function getLeadingCommandWordInfo(segment) {
  const tokens = segment.trim().split(/\s+/);
  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
    const word = tokens[tokenIndex].toLowerCase().replace(PUNCTUATION_STRIP, "");
    if (!word) continue;
    if (/^\(?[a-z]\)?$/.test(word) || /^\d+\.?$/.test(word)) continue;
    return { word, tokenIndex };
  }
  return null;
}
function getLeadingCommandWord(segment) {
  return getLeadingCommandWordInfo(segment)?.word ?? null;
}
function splitPromptSegments(promptText) {
  return promptText.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}
function findCommandWordRangeInSegment(segment, tokenIndex) {
  let count = 0;
  const regex = /\S+/g;
  let match;
  while ((match = regex.exec(segment)) !== null) {
    if (count === tokenIndex) {
      return { start: match.index, end: match.index + match[0].length };
    }
    count++;
  }
  return null;
}
function getTipTextForCommandWord(word) {
  const html = getTipHtmlForCommandWord(word);
  if (!html) return "";
  return html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}
function highlightCommandWordsInPrompt(promptText, options = {}) {
  const { withTooltips = false } = options;
  const text = promptText || "";
  if (!text) return "";
  const segments = splitPromptSegments(text);
  if (!segments.length) return escapeHtml(text);
  const highlights = [];
  let searchFrom = 0;
  for (const segment of segments) {
    const segmentStart = text.indexOf(segment, searchFrom);
    if (segmentStart === -1) continue;
    searchFrom = segmentStart + segment.length;
    const info = getLeadingCommandWordInfo(segment);
    if (!info || !isKnownCommandWord(info.word)) continue;
    const range = findCommandWordRangeInSegment(segment, info.tokenIndex);
    if (!range) continue;
    highlights.push({
      start: segmentStart + range.start,
      end: segmentStart + range.end,
      word: info.word
    });
  }
  if (!highlights.length) return escapeHtml(text);
  highlights.sort((a, b) => a.start - b.start);
  const parts = [];
  let last = 0;
  for (const highlight of highlights) {
    parts.push(escapeHtml(text.slice(last, highlight.start)));
    const tipText = withTooltips ? getTipTextForCommandWord(highlight.word) : "";
    const titleAttr = tipText ? ` title="${escapeHtml(tipText)}"` : "";
    parts.push(
      `<span class="command-word command-word--${highlight.word}"${titleAttr}>${escapeHtml(text.slice(highlight.start, highlight.end))}</span>`
    );
    last = highlight.end;
  }
  parts.push(escapeHtml(text.slice(last)));
  return parts.join("");
}
function renderPromptStemHtml(promptText, options = {}) {
  const inlineHtml = highlightCommandWordsInPrompt(promptText, options);
  if (!inlineHtml) return "";
  const lines = inlineHtml.split(/\r?\n/);
  const out = [];
  let textRun = [];
  let listItems = [];
  const bulletRe = /^\s*(?:[-*•])\s+(.*\S)\s*$/;
  const flushText = () => {
    if (textRun.length) {
      out.push(textRun.join("<br>"));
      textRun = [];
    }
  };
  const flushList = () => {
    if (listItems.length) {
      out.push(
        `<ul style="margin:6px 0 0; padding-left:20px;">${listItems.map((li) => `<li style="margin:2px 0;">${li}</li>`).join("")}</ul>`
      );
      listItems = [];
    }
  };
  for (const line of lines) {
    const match = line.match(bulletRe);
    if (match) {
      flushText();
      listItems.push(match[1]);
    } else {
      flushList();
      textRun.push(line);
    }
  }
  flushText();
  flushList();
  return out.join("");
}
function getAQACommandWordHelper(promptText) {
  const segments = splitPromptSegments(promptText || "");
  if (!segments.length) return "";
  const seen = /* @__PURE__ */ new Set();
  const banners = [];
  for (const segment of segments) {
    const word = getLeadingCommandWord(segment);
    if (!word || seen.has(word)) continue;
    if (!isKnownCommandWord(word)) continue;
    const tipHtml = getTipHtmlForCommandWord(word);
    seen.add(word);
    banners.push(tipHtml);
  }
  return banners.join("");
}
function getGradableMarkPoints(markPoints) {
  return (markPoints || []).filter((mp) => String(mp.point_text || "").trim());
}
async function markResponse(q, resp, key, markPoints) {
  let total = 0, max = q.max_marks || 1;
  let ao = { AO1: 0, AO2: 0, AO3: 0 };
  let maxAo = { AO1: 0, AO2: 0, AO3: 0 };
  let missing = [], quality = 0;
  let stepResults = null;
  const gradableMarkPoints = getGradableMarkPoints(markPoints);
  if (!key) return { total: 0, max, ao, maxAo, missing, quality: 0, feedbackPayload: {} };
  const cleanUrl = q && typeof q.resource_links === "string" && q.resource_links.trim().toLowerCase().startsWith("http") ? q.resource_links.trim() : null;
  if (q.question_type === "mcq") {
    applyMcqMaxAoFromQuestion(q, max, maxAo);
  } else if (gradableMarkPoints.length > 0) {
    gradableMarkPoints.forEach((mp) => {
      maxAo[mp.ao] = (maxAo[mp.ao] || 0) + (mp.max_marks || 1);
    });
  } else {
    if (q.question_type === "numeric") {
      maxAo.AO2 = max;
    } else if (q.question_type === "chemistry_interactive" || q.question_type === "circuit_interactive" || q.question_type === "equipment_interactive") {
      maxAo.AO1 = max;
    } else if (q.question_type === "extended_response") {
      maxAo.AO1 = Math.ceil(max / 3);
      maxAo.AO2 = Math.floor(max / 3);
      maxAo.AO3 = max - maxAo.AO1 - maxAo.AO2;
    } else {
      maxAo.AO1 = max;
    }
  }
  if (key.key_type === "mcq") {
    const targetCorrect = key.key_payload?.correct || key.key_payload?.answer || "";
    total = resp.answer === targetCorrect ? max : 0;
    quality = total ? 5 : 1;
    const targetAo = getMcqTargetAo(q, markPoints);
    if (total > 0) {
      ao[targetAo] = max;
    } else {
      missing.push(
        ...resolveMcqWrongFeedback(resp.answer, key, markPoints, targetCorrect, cleanUrl, targetAo, q.options)
      );
    }
  } else if (key.key_type === "numeric") {
    const {
      markCalculationResponse: markCalculationResponse2,
      getCalculationConfig: getCalculationConfig2,
      getActiveSteps: getActiveSteps2,
      buildNumericFlashcardInsights: buildNumericFlashcardInsights2
    } = await loadCalculationWorkflow();
    const calcConfig = getCalculationConfig2(q);
    const calcSteps = getActiveSteps2(calcConfig);
    const equationSheet = q._equationSheet || null;
    if (calcSteps.length > 1 || calcSteps[0]?.type !== "calculate") {
      max = calcSteps.reduce((sum, s) => sum + (Number(s.marks) || 0), 0);
    }
    const calcResult = markCalculationResponse2(q, resp, key, markPoints, cleanUrl, equationSheet);
    total = calcResult.total;
    if (calcResult.max > 0) max = calcResult.max;
    ao.AO1 = calcResult.ao.AO1;
    ao.AO2 = calcResult.ao.AO2;
    ao.AO3 = calcResult.ao.AO3;
    maxAo.AO1 = calcResult.maxAo.AO1;
    maxAo.AO2 = calcResult.maxAo.AO2;
    maxAo.AO3 = calcResult.maxAo.AO3;
    missing.push(...calcResult.missing);
    quality = calcResult.quality;
    stepResults = calcResult.stepResults;
    const feedbackPayload = {
      missing: calcResult.missing,
      stepResults: calcResult.stepResults,
      flashcard_steps: buildNumericFlashcardInsights2(q, key, {
        missing: calcResult.missing,
        stepResults: calcResult.stepResults
      }, equationSheet)
    };
    return { total, max, ao, maxAo, missing, quality, feedbackPayload, stepResults };
  } else if (key.key_type === "chemistry") {
    const { loadChemistryWorkflow: loadChemistryWorkflow2 } = await Promise.resolve().then(() => (init_lazyChemistryWorkflow(), lazyChemistryWorkflow_exports));
    const { markChemistryResponse: markChemistryResponse2 } = await loadChemistryWorkflow2();
    const chemResult = markChemistryResponse2(q, resp, key, markPoints, cleanUrl);
    return {
      total: chemResult.total,
      max: chemResult.max,
      ao: chemResult.ao,
      maxAo: chemResult.maxAo,
      missing: chemResult.missing,
      quality: chemResult.quality,
      feedbackPayload: chemResult.feedbackPayload,
      stepResults: null
    };
  } else if (key.key_type === "circuit") {
    const { loadCircuitWorkflow: loadCircuitWorkflow2 } = await Promise.resolve().then(() => (init_lazyCircuitWorkflow(), lazyCircuitWorkflow_exports));
    const { markCircuitResponse: markCircuitResponse2 } = await loadCircuitWorkflow2();
    const circuitResult = markCircuitResponse2(q, resp, key, markPoints, cleanUrl);
    return {
      total: circuitResult.total,
      max: circuitResult.max,
      ao: circuitResult.ao,
      maxAo: circuitResult.maxAo,
      missing: circuitResult.missing,
      quality: circuitResult.quality,
      feedbackPayload: circuitResult.feedbackPayload,
      stepResults: null
    };
  } else if (key.key_type === "equipment") {
    const { loadEquipmentWorkflow: loadEquipmentWorkflow2 } = await Promise.resolve().then(() => (init_lazyEquipmentWorkflow(), lazyEquipmentWorkflow_exports));
    const { markEquipmentResponse: markEquipmentResponse2 } = await loadEquipmentWorkflow2();
    const equipResult = markEquipmentResponse2(q, resp, key, markPoints, cleanUrl);
    return {
      total: equipResult.total,
      max: equipResult.max,
      ao: equipResult.ao,
      maxAo: equipResult.maxAo,
      missing: equipResult.missing,
      quality: equipResult.quality,
      feedbackPayload: equipResult.feedbackPayload,
      stepResults: null
    };
  } else if (key.key_type === "pick_n") {
    const pool = Array.isArray(key.key_payload.pool) ? key.key_payload.pool : [];
    const marksPerHit = Number(key.key_payload.marks_per_hit) || 1;
    const targetAo = ao[key.key_payload.ao] !== void 0 ? key.key_payload.ao : "AO1";
    const textRaw = (resp.text || "").toLowerCase();
    const cleanStudentText = textRaw.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
    const studentWords = cleanStudentText.split(/\s+/).filter(Boolean);
    maxAo.AO1 = 0;
    maxAo.AO2 = 0;
    maxAo.AO3 = 0;
    maxAo[targetAo] = max;
    const matched = [];
    const missingItems = [];
    pool.forEach((item) => {
      if (checkKeywordOrSynonymsMatch(item, studentWords, textRaw)) matched.push(item);
      else missingItems.push(item);
    });
    total = Math.min(matched.length * marksPerHit, max);
    ao[targetAo] = total;
    if (total < max) {
      const marksShort = max - total;
      const moreNeeded = Math.max(1, Math.ceil(marksShort / marksPerHit));
      const acceptable = missingItems.map((i) => i.replace(/\|/g, " / ")).join(", ");
      const foundNote = matched.length > 0 ? `You correctly named ${matched.length}. ` : "";
      const coreText = `${foundNote}Give ${moreNeeded} more correct response${moreNeeded === 1 ? "" : "s"} for full marks.`;
      const acceptableNote = acceptable ? ` Acceptable answers include: ${acceptable}.` : "";
      missing.push({
        ao: targetAo,
        text: `${coreText}${acceptableNote}`,
        flashcard_text: coreText.trim(),
        url: cleanUrl
      });
    }
    if (total === 0) quality = 0;
    else if (total < max) quality = 3;
    else quality = 5;
  } else if (key.key_type === "keywords") {
    const required = key.key_payload.required || [];
    const optional = key.key_payload.optional || [];
    const minOptional = key.key_payload.min_optional || 0;
    const textRaw = (resp.text || "").toLowerCase();
    const cleanStudentText = textRaw.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
    const studentWords = cleanStudentText.split(/\s+/).filter(Boolean);
    if (gradableMarkPoints.length > 0) {
      max = gradableMarkPoints.reduce((sum, mp) => sum + (mp.max_marks || 1), 0);
      gradableMarkPoints.forEach((mp) => {
        const pointEarned = checkKeywordOrSynonymsMatch(mp.point_text, studentWords, textRaw);
        if (pointEarned) {
          const awarded = mp.max_marks || 1;
          total += awarded;
          ao[mp.ao] += awarded;
        } else {
          let fbText = mp.feedback_if_missing || `Missing keyword concept: "${mp.point_text || "required definition"}".`;
          missing.push({
            ao: mp.ao,
            text: fbText,
            flashcard_text: formatAnswerFlashcard(mp.point_text, mp.feedback_if_missing),
            point_text: mp.point_text || "",
            url: cleanUrl,
            image_url: mp.image_url || ""
          });
        }
      });
    } else {
      const hasAllRequired = required.every(
        (targetKeyword) => checkKeywordOrSynonymsMatch(targetKeyword, studentWords, textRaw)
      );
      const optionalHits = optional.filter(
        (targetKeyword) => checkKeywordOrSynonymsMatch(targetKeyword, studentWords, textRaw)
      ).length;
      total = hasAllRequired && optionalHits >= minOptional ? max : 0;
      if (total > 0) {
        ao.AO1 = max;
      } else {
        let missingTerms = [];
        required.forEach((r) => {
          const hit = checkKeywordOrSynonymsMatch(r, studentWords, textRaw);
          if (!hit) {
            missingTerms.push(r.replace(/\|/g, " / "));
          }
        });
        let feedbackText = missingTerms.length > 0 ? `Your answer is missing these required terms: **${missingTerms.join(", ")}**.` : "Your answer is missing some required keywords.";
        missing.push({
          ao: "AO1",
          text: feedbackText,
          flashcard_text: missingTerms.length ? formatAnswerFlashcard(missingTerms.join(", "), "") : feedbackText,
          point_text: missingTerms.join(", "),
          url: cleanUrl
        });
      }
    }
    if (total === 0) quality = 0;
    else if (total < max) quality = 3;
    else quality = 5;
  }
  return { total, max, ao, maxAo, missing, quality, feedbackPayload: { missing }, stepResults };
}
function computeQuestionAOMaxCaps(q, markPoints = [], calculationWorkflow = null) {
  const max = q.max_marks || 1;
  const maxAo = { AO1: 0, AO2: 0, AO3: 0 };
  if (q.question_type === "numeric" && calculationWorkflow) {
    const { getCalculationConfig: getCalculationConfig2, getActiveSteps: getActiveSteps2 } = calculationWorkflow;
    const config = getCalculationConfig2(q);
    const steps = getActiveSteps2(config);
    if (steps.length > 0) {
      if (steps.length === 1 && steps[0]?.type === "calculate") {
        maxAo.AO2 = max;
        return maxAo;
      }
      for (const step of steps) {
        const marks = Number(step.marks) || 0;
        const stepAo = step.ao || (step.type === "equation_select" ? "AO1" : "AO2");
        maxAo[stepAo] = (maxAo[stepAo] || 0) + marks;
      }
      return maxAo;
    }
  }
  if (q.question_type === "mcq") {
    applyMcqMaxAoFromQuestion(q, max, maxAo);
    return maxAo;
  }
  if (q.question_type === "chemistry_interactive" || q.question_type === "circuit_interactive" || q.question_type === "equipment_interactive") {
    maxAo.AO1 = max;
    return maxAo;
  }
  if (markPoints.length > 0) {
    const gradable = getGradableMarkPoints(markPoints);
    if (gradable.length > 0) {
      for (const mp of gradable) {
        if (mp.ao && maxAo[mp.ao] !== void 0) {
          maxAo[mp.ao] += Number(mp.max_marks) || 1;
        }
      }
      return maxAo;
    }
  }
  if (q.question_type === "numeric") {
    maxAo.AO2 = max;
  } else if (q.question_type === "extended_response") {
    maxAo.AO1 = Math.ceil(max / 3);
    maxAo.AO2 = Math.floor(max / 3);
    maxAo.AO3 = max - maxAo.AO1 - maxAo.AO2;
  } else {
    maxAo.AO1 = max;
  }
  return maxAo;
}
export {
  MCQ_FLASHCARD_ADDED_MSG,
  checkKeywordOrSynonymsMatch,
  computeQuestionAOMaxCaps,
  computeSessionQuality,
  findStudentAnswerHighlights,
  flashcardInsightFromMissing,
  formatAnswerFlashcard,
  formatFlashcardAnswerDisplay,
  formatMcqAnswerWithLetter,
  getAQACommandWordHelper,
  getGradableMarkPoints,
  getLevenshteinDistance,
  getMcqTargetAo,
  getTipTextForCommandWord,
  highlightCommandWordsInPrompt,
  isFuzzyMatch,
  isShellConfigKeyword,
  markResponse,
  normalizeShellConfig,
  parseKeywordExpression,
  renderHighlightedStudentAnswer,
  renderPromptStemHtml,
  resolveMcqWrongFeedback,
  splitFlashcardInsight,
  updateSRS
};
