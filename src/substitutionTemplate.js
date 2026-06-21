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

export function resolveEquationIdForSubstitution(config, equationSheet, subStep) {
  const eqSelectStep = (config?.steps || []).find((s) => s.type === "equation_select");
  if (typeof document !== "undefined") {
    const selected = document.getElementById("calc_equation_select")?.value?.trim();
    if (selected) return selected;
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

export function isStructuredSubstitutionStep(step) {
  if (!step || step.type !== "substitution") return false;
  if (step.mode === "structured") return true;
  if (step.slot_answers && Object.keys(step.slot_answers).length > 0) return true;
  return false;
}

export function resolveSubstitutionContext(config, equationSheet, subStep) {
  if (!isStructuredSubstitutionStep(subStep)) {
    return { mode: "free_text", template: null, equationId: null, equation: null };
  }
  const equationId = resolveEquationIdForSubstitution(config, equationSheet, subStep);
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
      html += `<input type="text" class="calc-sub-slot" data-slot-id="${escapeHtml(item.id)}" aria-label="Substitute ${escapeHtml(label)}" placeholder="${escapeHtml(label)}" style="${inputStyle} width:4.5em; min-width:3em; text-align:center;"/>`;
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

export function renderSubstitutionStepInner(ctx, inputStyle) {
  if (ctx.mode !== "structured" || !ctx.template) {
    return renderFreeTextSubstitution(inputStyle);
  }
  return `<div id="calc_substitution_structured" data-equation-id="${escapeHtml(ctx.equationId || "")}">${renderSubstitutionHtml(ctx.template, inputStyle)}</div>`;
}

export function collectStructuredSubstitution(template) {
  const slots = {};
  if (!template) return slots;
  document.querySelectorAll(".calc-sub-slot").forEach((el) => {
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
  if (ctx.mode === "structured" && ctx.template) {
    const slots = collectStructuredSubstitution(ctx.template);
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
  const slots = payload.slots || {};
  return Object.values(slots).every((v) => String(v ?? "").trim() !== "");
}

function slotValueMatches(studentVal, acceptedList) {
  const normalized = normalizeSlotValue(studentVal);
  if (!normalized) return false;
  return (acceptedList || []).some((a) => normalizeSlotValue(a) === normalized);
}

export function substitutionSlotsMatch(payload, subStep, template) {
  if (!payload || payload.mode !== "structured" || !subStep?.slot_answers) return false;
  const slotIds = getSlotIdsFromTemplate(template);
  if (!slotIds.length) return false;
  for (const id of slotIds) {
    const accepted = subStep.slot_answers[id];
    if (!accepted || !Array.isArray(accepted)) return false;
    if (!slotValueMatches(payload.slots?.[id], accepted)) return false;
  }
  return true;
}

function lookupSlotValue(slotAnswers, slotId) {
  const vals = slotAnswers?.[slotId];
  if (!vals?.length) return slotId;
  return String(vals[0]);
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceSlotIdsInExpression(expr, slotAnswers) {
  let result = String(expr || "");
  const ids = Object.keys(slotAnswers || {}).sort((a, b) => b.length - a.length);
  for (const id of ids) {
    const val = lookupSlotValue(slotAnswers, id);
    const label = Object.entries(SLOT_ID_ALIASES).find(([, v]) => v === id)?.[0];
    const patterns = [id, label].filter(Boolean);
    for (const p of patterns) {
      result = result.replace(new RegExp(`\\b${escapeRegex(p)}\\b`, "g"), val);
    }
  }
  return result.replace(/\s+/g, " ").trim();
}

function applyDistractorPattern(correctExpr, pattern, slotAnswers, subject) {
  const sub = lookupSlotValue(slotAnswers, subject);
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
      .map((k) => lookupSlotValue(slotAnswers, k));
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

export function buildNumericRearrangementOptions(equation, subStep, rearrStep) {
  const subject = rearrStep?.subject || subStep?.rearrangement_subject || equation?.rearrangement_forms?.default_subject;
  const variant = getRearrangementVariant(equation, subject);
  const slotAnswers = subStep?.slot_answers || {};
  if (!variant) return { answer: rearrStep?.answer || "", distractors: rearrStep?.distractors || [] };

  const correct = replaceSlotIdsInExpression(variant.correct, slotAnswers);
  const distractors = [];
  const seen = new Set([correct]);

  for (const pattern of variant.distractor_patterns || []) {
    const d = applyDistractorPattern(variant.correct, pattern, slotAnswers, variant.subject);
    if (d) {
      const numeric = replaceSlotIdsInExpression(d, slotAnswers);
      if (numeric && !seen.has(numeric)) {
        seen.add(numeric);
        distractors.push(numeric);
      }
    }
  }

  for (const manual of rearrStep?.distractors || []) {
    if (manual && !seen.has(manual)) {
      seen.add(manual);
      distractors.push(manual);
    }
  }

  return { answer: correct, distractors, subject: variant.subject };
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

  const steps = config.steps.map((step) => {
    if (step.type !== "rearrangement") return step;
    if (step.mode === "symbolic") return step;
    if (!subStep.slot_answers) return step;
    const built = buildNumericRearrangementOptions(equation, subStep, step);
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
