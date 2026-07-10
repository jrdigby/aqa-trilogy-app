// Parse student numeric answers — decimals, calculator notation, and UK standard form.

const UNICODE_SUPERSCRIPT = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
  "⁻": "-", "⁺": "+"
};

const STANDARD_FORM_RE =
  /^(-?\d+(?:\.\d+)?)\s*[×x*]\s*10\s*(?:\^|\*\*)?\s*(-?\d+)\s*$/i;

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

/**
 * True when the question prompt asks for an answer in standard form.
 */
export function promptRequiresStandardForm(promptText) {
  const p = String(promptText || "").toLowerCase();
  return /\bin\s+standard\s+form\b/.test(p) || /\bgive\s+(?:your\s+)?answer\s+in\s+standard\s+form\b/.test(p);
}

/**
 * True when the raw student text is presented as a × 10^n standard form value (GCSE style).
 * Calculator e-notation and plain decimals do not count.
 */
export function isStandardFormPresentation(raw) {
  const parts = parseStandardFormParts(raw);
  if (!parts) return false;
  const absMantissa = Math.abs(parts.mantissa);
  return absMantissa >= 1 && absMantissa < 10;
}

/**
 * Parse a student numeric string into a finite number, or null if invalid/empty.
 */
export function parseStudentNumber(raw) {
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

/** Shorthand: numeric value or null. */
export function studentNumberValue(raw) {
  return parseStudentNumber(raw).value;
}

/** True when the string parses to a finite number. */
export function isValidStudentNumber(raw) {
  return parseStudentNumber(raw).valid;
}

function formatPlainNumberLatex(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e6 || (abs > 0 && abs < 0.001)) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = n / Math.pow(10, exp);
    const mantissaStr = String(Number(mantissa.toPrecision(10)));
    return `${mantissaStr} \\times 10^{${exp}}`;
  }
  return String(n);
}

/**
 * LaTeX for live preview under numeric inputs (MathJax).
 * Uses explicit standard form when the student typed ×10^n; otherwise plain or auto-scientific.
 */
export function formatNumberLatexPreview(raw) {
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

export function numericInputPlaceholder(requiresStandardForm = false) {
  return requiresStandardForm
    ? "e.g. 3.2x10^6"
    : "e.g. 4500 or 3.2x10^3";
}

/** Width for final-answer / conversion / sig-fig student inputs (fits e.g. -2.5×10^-12). */
export const STUDENT_NUMERIC_INPUT_WIDTH = "15ch";
export const STUDENT_NUMERIC_INPUT_MIN_WIDTH = "13ch";

/** Width for structured substitution slot inputs (fits e.g. 3.34x10^5). */
export const STUDENT_SUB_SLOT_INPUT_WIDTH = "15ch";
export const STUDENT_SUB_SLOT_INPUT_MIN_WIDTH = "14ch";
export const STUDENT_SUB_SLOT_INPUT_MAX_WIDTH = "20ch";

/** Inline style fragment for substitution slot inputs. */
export function studentSubSlotInputStyle(baseInputStyle) {
  return `${baseInputStyle} width:${STUDENT_SUB_SLOT_INPUT_WIDTH}; min-width:${STUDENT_SUB_SLOT_INPUT_MIN_WIDTH}; max-width:${STUDENT_SUB_SLOT_INPUT_MAX_WIDTH}; text-align:center; box-sizing:border-box; font-variant-numeric:tabular-nums;`;
}

/** Inline style fragment for final-answer style numeric inputs. */
export function studentNumericInputStyle(baseInputStyle) {
  return `${baseInputStyle} width:${STUDENT_NUMERIC_INPUT_WIDTH}; min-width:${STUDENT_NUMERIC_INPUT_MIN_WIDTH}; max-width:100%; box-sizing:border-box; font-variant-numeric:tabular-nums;`;
}

/**
 * Collapsible helper panel explaining how to type numbers and standard form.
 * Includes MathJax examples — typeset after render via triggerMathTypeset.
 */
export function renderStandardFormInputHelper({ requiresStandardForm = false } = {}) {
  const border = requiresStandardForm ? "#7dd3fc" : "#e2e8f0";
  const bg = requiresStandardForm ? "#f0f9ff" : "#f8fafc";
  const openAttr = requiresStandardForm ? " open" : "";
  const summary = requiresStandardForm
    ? "How to type your answer in standard form"
    : "How to type numbers";

  const codeStyle = "background:#fff;padding:2px 6px;border-radius:3px;border:1px solid #e2e8f0;font-family:ui-monospace,Consolas,monospace;font-size:0.92em;";

  const requiredNote = requiresStandardForm
    ? `<p style="margin:10px 0 0;font-size:0.82rem;font-weight:600;color:#0369a1;">
        This question requires standard form — use the <code style="${codeStyle}">x10^</code> pattern below
        (not plain <code style="${codeStyle}">334000</code> or calculator <code style="${codeStyle}">3.34e5</code>).
      </p>`
    : "";

  return `
    <details class="calc-numeric-format-helper"${openAttr}
      style="margin:12px 0 0;border:1px solid ${border};border-radius:8px;background:${bg};padding:8px 12px;font-size:0.82rem;color:#334155;line-height:1.45;">
      <summary style="cursor:pointer;font-weight:700;color:#0f172a;list-style-position:outside;">
        ${summary}
      </summary>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid ${border};">
        <p style="margin:0 0 6px;font-weight:600;">Standard form — type on your keyboard:</p>
        <p style="margin:0 0 8px;padding:8px 10px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;">
          <code style="${codeStyle}">a</code>
          <span style="color:#64748b;"> then </span>
          <code style="${codeStyle}">x10^</code>
          <span style="color:#64748b;"> then the power </span>
          <code style="${codeStyle}">n</code>
          <span style="color:#64748b;"> &nbsp;→&nbsp; e.g. </span>
          <code style="${codeStyle}">3.2x10^6</code>
        </p>
        <p style="margin:0 0 6px;">Examples to type:</p>
        <ul style="margin:0 0 8px;padding-left:18px;">
          <li style="margin-bottom:4px;">
            <code style="${codeStyle}">3.2x10^6</code>
            <span style="color:#64748b;"> or </span>
            <code style="${codeStyle}">3.2×10^6</code>
            <span style="color:#64748b;"> → </span>
            $3.2 \\times 10^{6}$
          </li>
          <li style="margin-bottom:4px;">
            <code style="${codeStyle}">4.5x10^3</code>
            <span style="color:#64748b;"> → </span>
            $4.5 \\times 10^{3}$
          </li>
          <li style="margin-bottom:4px;">
            <code style="${codeStyle}">1.2x10^-4</code>
            <span style="color:#64748b;"> (negative power) → </span>
            $1.2 \\times 10^{-4}$
          </li>
          <li>
            <strong>Ordinary numbers</strong> also work:
            <code style="${codeStyle}">4500</code>,
            <code style="${codeStyle}">0.003</code>,
            <code style="${codeStyle}">3.2e8</code>
          </li>
        </ul>
        <p style="margin:0;font-size:0.78rem;color:#64748b;">
          Use <strong>x</strong> or <strong>×</strong> before 10; use <strong>^</strong> before the exponent.
          Spaces are optional (<code style="${codeStyle}">3.2 x 10^6</code>).
        </p>
        ${requiredNote}
      </div>
    </details>`;
}
