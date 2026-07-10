// Significant figures helpers for GCSE numeric grading

import { parseStudentNumber } from "./parseStudentNumber.js";

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

/**
 * Count significant figures in a numeric string (GCSE conventions).
 */
export function countSigFigs(value) {
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

/**
 * Round a number to n significant figures.
 */
export function roundToSigFigs(value, n) {
  const num = Number(value);
  if (!Number.isFinite(num) || n < 1) return num;
  if (num === 0) return 0;

  const sign = num < 0 ? -1 : 1;
  const abs = Math.abs(num);
  const power = Math.floor(Math.log10(abs));
  const factor = Math.pow(10, n - 1 - power);
  return (sign * Math.round(abs * factor)) / factor;
}

/**
 * True if student value matches expected when rounded to n sig figs (within tolerance).
 * When requireSigFigCount is true, the student's answer must use exactly n significant figures
 * (used for the separate sig figs mark on the final answer).
 */
export function matchesSigFigs(studentValue, expectedValue, n, tolerance = 0, options = {}) {
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
    // GCSE: 700 is acceptable as the 2 s.f. rounded value even without a decimal point
    if (student === roundedExpected) return true;
    return false;
  }

  if (requireSigFigCount && studentSf !== n) return false;

  return Math.abs(student - roundedExpected) <= tol * 10;
}
