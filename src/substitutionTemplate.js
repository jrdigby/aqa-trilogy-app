// Structured substitution templates — render, collect, mark, numeric rearrangement
import { escapeHtml } from "./utils.js";

const SLOT_ID_ALIASES = {
  "Δv": "delta_v",
  "Δt": "delta_t",
  "ΔE": "delta_E",
  "Δθ": "delta_theta",
  "ρ": "rho",
  "λ": "lambda"
};

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
  return equationSheet.equations.find(
    (eq) => eq.id === needle || eq.label === needle
  ) || null;
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
  return equation?.substitution_template || null;
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
  const first = template.tokens?.find((t) => t.kind === "slot");
  return first?.id || null;
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
      html += `<input type="text" class="calc-sub-slot" data-slot-id="${escapeHtml(item.id)}" aria-label="Substitute ${escapeHtml(label)}" placeholder="?" title="${escapeHtml(label)}" style="${inputStyle} width:4.5em; min-width:3em; text-align:center;"/>`;
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
  return `<input id="calc_substitution" type="text" placeholder="e.g. E_k = 0.5 × 2.0 × 4.0²" style="${inputStyle} width:100%;"/>`;
}

export function renderPendingEquationSelectSubstitution() {
  return `<p class="calc-sub-pending" style="font-size:0.85rem;color:#64748b;margin:0;font-style:italic;">Select an equation in the step above first.</p>`;
}

export function renderSubstitutionStepInner(ctx, inputStyle) {
  if (ctx.mode === "pending") {
    return renderPendingEquationSelectSubstitution();
  }
  if (ctx.mode !== "structured" || !ctx.template) {
    return renderFreeTextSubstitution(inputStyle);
  }
  return `<div id="calc_substitution_structured" data-equation-id="${escapeHtml(ctx.equationId || "")}">${renderSubstitutionHtml(ctx.template, inputStyle)}</div>`;
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

export function collectSubstitutionPayload(config, equationSheet, subStep) {
  const ctx = resolveSubstitutionContext(config, equationSheet, subStep);
  if (ctx.mode === "pending") {
    return { mode: "structured", equation_id: null, slots: {}, text: "" };
  }
  if (ctx.mode === "structured" && ctx.template) {
    const root = resolveCalculationWorkflowRoot();
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

export function substitutionPayloadIsComplete(payload, options = {}) {
  if (!payload) return false;
  if (payload.mode === "free_text") return !!payload.text;
  if (!payload.equation_id) return false;
  const slots = payload.slots || {};
  const unknownId = payload.rearrangement_subject || options.rearrangementSubject || null;
  const omit = new Set(options.omitSlotIds || []);
  return Object.entries(slots).every(([id, v]) => {
    if (unknownId && id === unknownId) return true;
    if (omit.has(id)) return true;
    return String(v ?? "").trim() !== "";
  });
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
    const sNum = parseFloat(normalized);
    const aNum = parseFloat(na);
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

function matchCommutativeGroup(groupSlotIds, payload, slotAnswers, unknownId = null) {
  if (!groupSlotIds.length) return true;
  if (groupSlotIds.length === 1) {
    const id = groupSlotIds[0];
    if (unknownId && id === unknownId) {
      const val = String(payload.slots?.[id] ?? "").trim();
      if (!val) return true;
    }
    return slotValueMatches(payload.slots?.[id], slotAnswers[id]);
  }

  const assigned = new Set();
  function tryAssign(idx) {
    if (idx >= groupSlotIds.length) return true;
    const expId = groupSlotIds[idx];
    const accepted = slotAnswers[expId];
    for (const studId of groupSlotIds) {
      if (assigned.has(studId)) continue;
      if (unknownId && studId === unknownId) {
        const val = String(payload.slots?.[studId] ?? "").trim();
        if (!val) {
          assigned.add(studId);
          if (tryAssign(idx + 1)) return true;
          assigned.delete(studId);
          continue;
        }
      }
      if (!slotValueMatches(payload.slots?.[studId], accepted)) continue;
      assigned.add(studId);
      if (tryAssign(idx + 1)) return true;
      assigned.delete(studId);
    }
    return false;
  }
  return tryAssign(0);
}

/** Template-aware substitution match with commutative × groups. */
export function substitutionSlotsMatchCommutative(payload, subStep, template) {
  if (!payload || payload.mode !== "structured" || !subStep?.slot_answers) return false;
  if (!payload.equation_id) return false;
  if (!template) return false;

  const unknownId = subStep.rearrangement_subject || null;
  const resultSlot = !unknownId ? identifyResultSlotFromTemplate(template) : null;
  const shouldSkipSlot = (id) => {
    if (unknownId && id === unknownId) return true;
    if (resultSlot && id === resultSlot) return true;
    return false;
  };

  const { fixedSlots, commutativeGroups } = parseCommutativeGroups(template);
  const allGrouped = new Set([...fixedSlots, ...commutativeGroups.flat()]);

  for (const id of fixedSlots) {
    if (shouldSkipSlot(id)) continue;
    const accepted = normalizeAcceptedSlotValues(subStep.slot_answers[id]);
    if (!accepted?.length) return false;
    if (!slotValueMatches(payload.slots?.[id], accepted)) return false;
  }

  for (const group of commutativeGroups) {
    const activeGroup = group.filter((id) => !shouldSkipSlot(id));
    if (!activeGroup.length) continue;
    const hasAnswers = activeGroup.every((id) =>
      normalizeAcceptedSlotValues(subStep.slot_answers[id])?.length
    );
    if (!hasAnswers) return false;
    if (!matchCommutativeGroup(activeGroup, payload, subStep.slot_answers, unknownId)) return false;
  }

  for (const id of getSlotIdsFromTemplate(template)) {
    if (allGrouped.has(id)) continue;
    if (shouldSkipSlot(id)) continue;
    const accepted = normalizeAcceptedSlotValues(subStep.slot_answers[id]);
    if (!accepted?.length) return false;
    if (!slotValueMatches(payload.slots?.[id], accepted)) return false;
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
  const t = String(text ?? "").trim();
  return t !== "" && !Number.isNaN(parseFloat(t));
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
    if (text && Number.isNaN(parseFloat(text))) {
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
      if (t && !Number.isNaN(parseFloat(t))) out[id] = t;
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

function applyDistractorPattern(correctExpr, pattern, slotAnswers, subject) {
  const sub = subject;
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
  const fromSelect = document.getElementById("calc_equation_select")?.closest(".calc-workflow-panel");
  if (fromSelect) return fromSelect;
  const fromStructured = document.getElementById("calc_substitution_structured")?.closest(".calc-workflow-panel");
  if (fromStructured) return fromStructured;
  const sandboxPanel = document.getElementById("sandboxStage")?.querySelector(".calc-workflow-panel");
  if (sandboxPanel) return sandboxPanel;
  const sandbox = document.getElementById("sandboxStage");
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
  return Number.isFinite(parseFloat(el.value));
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
  const rearrStep = (config?.steps || []).find((s) => s.type === "rearrangement");
  const unknownId = subStep?.rearrangement_subject || rearrStep?.subject || null;
  for (const id of getSlotIdsFromTemplate(ctx.template)) {
    if (unknownId && id === unknownId) continue;
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
  const studentConv = convRaw !== "" && Number.isFinite(parseFloat(convRaw)) ? parseFloat(convRaw) : null;
  const resp = Number.isFinite(studentConv) ? { steps: { conversion: studentConv } } : null;
  const siSlots = buildSiSlotAnswersForRearrangement(subStep, convStep, resp, studentSlots);
  const built = buildNumericRearrangementOptions(eq, subStep, rearrStep, { siSlotAnswers: siSlots });
  refreshRearrangementSelect(rearrStep, built);
}

export function refreshSubstitutionStepDom(config, equationSheet, subStep, inputStyle) {
  const container = document.querySelector('.calc-step[data-step="substitution"] .calc-sub-step-inner');
  if (!container) return;
  const ctx = resolveSubstitutionContext(config, equationSheet, subStep);
  container.innerHTML = renderSubstitutionStepInner(ctx, inputStyle);
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

  const convStep = config.steps.find((s) => s.type === "conversion");

  const steps = config.steps.map((step) => {
    if (step.type === "substitution" && convStep) {
      const normalized = resolveSubstitutionMarkScheme(step, convStep);
      return {
        ...normalized,
        si_slot_answers: normalized.slot_answers
      };
    }
    if (step.type !== "rearrangement") return step;
    if (step.mode === "symbolic") return step;
    const subForRearr = convStep
      ? resolveSubstitutionMarkScheme(subStep, convStep)
      : subStep;
    if (!subForRearr.slot_answers) return step;
    const siSlots = buildSiSlotAnswersForRearrangement(subForRearr, convStep);
    const built = buildNumericRearrangementOptions(equation, subForRearr, step, { siSlotAnswers: siSlots });
    if (!built.answer) return step;
    return {
      ...step,
      mode: "numeric",
      subject: built.subject || step.subject,
      answer: built.answer,
      distractors: built.distractors
    };
  });

  return { ...config, steps };
}
