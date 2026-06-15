// Significant figures helpers for GCSE numeric grading

/**
 * Count significant figures in a numeric string (GCSE conventions).
 */
export function countSigFigs(value) {
  if (value == null || value === "") return 0;
  let s = String(value).trim().replace(/,/g, "");
  if (!s || s === "-" || s === "+") return 0;

  const isNegative = s.startsWith("-");
  if (isNegative) s = s.slice(1);

  if (/e/i.test(s)) {
    const [mantissa] = s.toLowerCase().split("e");
    return countSigFigs(isNegative ? `-${mantissa}` : mantissa);
  }

  if (s.includes(".")) {
    s = s.replace(/^0+/, "");
    s = s.replace(".", "");
    s = s.replace(/0+$/, "");
    return s.replace(/[^0-9]/g, "").length || 0;
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
 */
export function matchesSigFigs(studentValue, expectedValue, n, tolerance = 0) {
  const student = Number(studentValue);
  const expected = Number(expectedValue);
  if (!Number.isFinite(student) || !Number.isFinite(expected)) return false;

  const roundedExpected = roundToSigFigs(expected, n);
  const tol = Math.max(Math.abs(tolerance), Math.abs(roundedExpected) * 1e-9, 1e-9);

  if (Math.abs(student - roundedExpected) <= tol) return true;

  const studentSf = countSigFigs(String(studentValue));
  if (studentSf !== n) return false;

  return Math.abs(student - roundedExpected) <= tol * 10;
}
